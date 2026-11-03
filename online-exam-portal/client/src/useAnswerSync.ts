// US10 + US19: saves each answer as soon as it is chosen. If the connection is
// lost, unsent answers are kept on this device (they survive a page refresh)
// and sent again, oldest first, once the connection is back.
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, api } from './api';
import type { OptionKey } from './types';

type Unsent = Record<string, OptionKey>;

const storageKey = (attemptId: string) => `exam-portal:unsent:${attemptId}`;

/** Answers chosen on this device that the server has not confirmed yet. */
export function readUnsent(attemptId: string): Unsent {
  try {
    const raw = localStorage.getItem(storageKey(attemptId));
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? (parsed as Unsent) : {};
  } catch {
    return {};
  }
}

function writeUnsent(attemptId: string, unsent: Unsent) {
  try {
    if (Object.keys(unsent).length) localStorage.setItem(storageKey(attemptId), JSON.stringify(unsent));
    else localStorage.removeItem(storageKey(attemptId));
  } catch {
    // Storage blocked: answers are still kept in memory until the page closes.
  }
}

/**
 * A failure worth retrying: no connection, the server is temporarily down, or
 * the login expired (the answer is sent after the student logs in again).
 */
function isTemporary(error: unknown) {
  return error instanceof ApiError && (error.status === 0 || error.status === 401 || error.status >= 500);
}

export function useAnswerSync(attemptId: string | null, onRejected: (questionId: string, message: string) => void) {
  const unsent = useRef<Unsent>({});
  const sending = useRef<Promise<void> | null>(null);
  const [unsentCount, setUnsentCount] = useState(0);
  const [offline, setOffline] = useState(false);

  // Pick up answers left over from before a refresh.
  useEffect(() => {
    if (!attemptId) return;
    unsent.current = readUnsent(attemptId);
    setUnsentCount(Object.keys(unsent.current).length);
  }, [attemptId]);

  const sendAll = useCallback((): Promise<void> => {
    if (!attemptId) return Promise.resolve();
    // Only one request at a time, so answers reach the server in the order they were given.
    if (sending.current) return sending.current;

    const job = (async () => {
      try {
        let questionId: string | undefined;
        while ((questionId = Object.keys(unsent.current)[0])) {
          const option = unsent.current[questionId];
          try {
            await api(`/attempts/${attemptId}/answers/${questionId}`, {
              method: 'PUT',
              body: { selectedOption: option },
            });
            setOffline(false);
            // Keep it if the student changed the answer again while this one was being sent.
            if (unsent.current[questionId] === option) delete unsent.current[questionId];
          } catch (error) {
            if (isTemporary(error)) {
              setOffline(true);
              break;
            }
            delete unsent.current[questionId];
            onRejected(questionId, error instanceof Error ? error.message : 'Answer not saved.');
          }
          writeUnsent(attemptId, unsent.current);
        }
      } finally {
        writeUnsent(attemptId, unsent.current);
        setUnsentCount(Object.keys(unsent.current).length);
      }
    })();
    // Cleared after the job finishes. (Clearing it inside the job would run too
    // early when there is nothing to send, leaving a finished job stored here.)
    sending.current = job;
    void job.finally(() => {
      if (sending.current === job) sending.current = null;
    });
    return job;
  }, [attemptId, onRejected]);

  const saveAnswer = useCallback(
    (questionId: string, option: OptionKey) => {
      if (!attemptId) return;
      unsent.current = { ...unsent.current, [questionId]: option };
      writeUnsent(attemptId, unsent.current);
      setUnsentCount(Object.keys(unsent.current).length);
      void sendAll();
    },
    [attemptId, sendAll]
  );

  // Retry when the browser reports the connection is back, and every few seconds meanwhile.
  useEffect(() => {
    if (!attemptId) return;
    const retry = () => void sendAll();
    window.addEventListener('online', retry);
    const timer = window.setInterval(() => {
      if (Object.keys(unsent.current).length) retry();
    }, 5000);
    retry();
    return () => {
      window.removeEventListener('online', retry);
      window.clearInterval(timer);
    };
  }, [attemptId, sendAll]);

  /** Sends everything still waiting. Resolves to true when nothing is left unsent. */
  const flush = useCallback(async () => {
    await sendAll();
    // A new answer may have been chosen while the last request was in flight.
    if (Object.keys(unsent.current).length) await sendAll();
    return Object.keys(unsent.current).length === 0;
  }, [sendAll]);

  const clear = useCallback(() => {
    unsent.current = {};
    if (attemptId) writeUnsent(attemptId, {});
    setUnsentCount(0);
  }, [attemptId]);

  return { saveAnswer, flush, clear, unsentCount, offline, isUnsent: (id: string) => id in unsent.current };
}
