































import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { router } from './routes.js';
import { backupRouter } from './backupRoutes.js';
 
const app = express();
app.use(cors({ origin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173' }));
// Larger body limit only for restore uploads; must be registered before the default parser.
app.use('/api/admin/data', express.json({ limit: '25mb' }));
app.use(express.json());
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/api', router);
app.use('/api/admin/data', backupRouter);
 
const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => console.log(`API listening on http://localhost:${port}`));
 

