import { Router } from 'express';
import type { Request, Response } from 'express';
import { requireAuth, requireAdmin } from './security.js';
import { BackupError, createBackup, getBackupStatus, restoreBackup } from './backup.js';

export const backupRouter = Router();

// Every backup/recovery endpoint is restricted to authenticated administrators.
backupRouter.use(requireAuth, requireAdmin);

function currentUserId(req: Request): string | null {
  return (req as Request & { user?: { id: string } }).user?.id ?? null;
}

function sendError(res: Response, error: unknown, fallback: string) {
  if (error instanceof BackupError) {
    return res.status(error.status).json({ error: error.message });
  }
  console.error(fallback, error);
  return res.status(500).json({ error: fallback });
}

// What is covered by a backup, with current row counts.
backupRouter.get('/status', async (_req, res) => {
  try {
    return res.json(await getBackupStatus());
  } catch (error) {
    return sendError(res, error, 'Unable to read backup status.');
  }
});

// Download a complete backup of examination and result data as JSON.
backupRouter.get('/backup', async (req, res) => {
  try {
    const backup = await createBackup(currentUserId(req));
    const stamp = backup.createdAt.replace(/[-:]/g, '').replace(/\..+$/, '').replace('T', '-');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="exam-backup-${stamp}.json"`);
    res.setHeader('Cache-Control', 'no-store');
    console.info(`[backup] backup created by user ${currentUserId(req) ?? 'unknown'}`);
    return res.send(JSON.stringify(backup));
  } catch (error) {
    return sendError(res, error, 'Unable to create the backup.');
  }
});

// Restore from an uploaded backup file (replaces current exam/result data atomically).
backupRouter.post('/restore', async (req, res) => {
  try {
    if (typeof req.body !== 'object' || req.body === null || Array.isArray(req.body)) {
      return res.status(400).json({ error: 'Upload a valid backup file.' });
    }
    const result = await restoreBackup(req.body, currentUserId(req));
    return res.json({ message: 'Data restored successfully.', ...result });
  } catch (error) {
    return sendError(res, error, 'Unable to restore the backup.');
  }
});