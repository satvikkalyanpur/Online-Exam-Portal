import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import { router } from './routes.js';
import { HttpError } from './http.js';
import { noStore, securityHeaders } from './security.js';

// The website built by `npm run build` in the client folder.
const clientDist = fileURLToPath(new URL('../../client/dist', import.meta.url));

export function createApp() {
  const app = express();
  app.use(securityHeaders);
  // Only needed when the website runs on the Vite dev server (port 5173).
  app.use(cors({ origin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173' }));

  const smallJson = express.json({ limit: '100kb' });
  app.use((req, res, next) => (req.path === '/api/backup/restore' ? next() : smallJson(req, res, next)));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });
  app.use('/api', noStore, router);
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found.' });
  });

  // Serve the website itself, if it has been built.
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.use((req, res, next) => (req.method === 'GET' ? res.sendFile('index.html', { root: clientDist }) : next()));
  }

  // Turns thrown errors into JSON responses. Express 5 also sends rejected promises here.
  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof HttpError) {
      res.status(error.status).json({ error: error.message, ...error.extra });
      return;
    }
    if (error && typeof error === 'object' && 'type' in error) {
      if (error.type === 'entity.parse.failed') {
        res.status(400).json({ error: 'The request body is not valid JSON.' });
        return;
      }
      if (error.type === 'entity.too.large') {
        res.status(413).json({ error: 'The request is too large.' });
        return;
      }
    }
    console.error(error);
    res.status(500).json({ error: 'Something went wrong on the server.' });
  });

  return app;
}
