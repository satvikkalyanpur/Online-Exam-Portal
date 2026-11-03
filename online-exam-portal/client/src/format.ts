const dateFormat = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});
const timeFormat = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });

export function formatDate(iso: string) {
  return dateFormat.format(new Date(iso));
}

export function formatTime(iso: string) {
  return timeFormat.format(new Date(iso));
}

/** "Mon, 26 Oct 2026, 9:00 am – 6:00 pm" or across days "… 9:00 am – Fri, 30 Oct 2026, 6:00 pm" */
export function formatSchedule(startIso: string, endIso: string) {
  const sameDay = new Date(startIso).toDateString() === new Date(endIso).toDateString();
  return sameDay
    ? `${formatDate(startIso)}, ${formatTime(startIso)} – ${formatTime(endIso)}`
    : `${formatDate(startIso)}, ${formatTime(startIso)} – ${formatDate(endIso)}, ${formatTime(endIso)}`;
}

export function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export function formatCountdown(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** plural(1, 'question') → "1 question", plural(3, 'question') → "3 questions". */
export function plural(count: number, word: string, pluralWord = `${word}s`) {
  return `${count} ${count === 1 ? word : pluralWord}`;
}

/** Value for <input type="datetime-local"> in the browser's time zone. */
export function toDateTimeLocal(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function formatDateTime(iso: string) {
  return `${formatDate(iso)}, ${formatTime(iso)}`;
}

/** "2 days 3 h", "3 h 20 min", "5 min 10 s" — for "opens in …" countdowns. */
export function formatWait(milliseconds: number) {
  const total = Math.max(0, Math.ceil(milliseconds / 1000));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (days > 0) return `${plural(days, 'day')} ${hours} h`;
  if (hours > 0) return `${hours} h ${minutes} min`;
  if (minutes > 0) return `${minutes} min ${seconds} s`;
  return `${seconds} s`;
}

export function formatPercent(value: number | null) {
  return value === null ? '–' : `${value}%`;
}
