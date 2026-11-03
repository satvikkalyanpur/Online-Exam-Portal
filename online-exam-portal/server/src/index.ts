import 'dotenv/config';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';

if (!process.env.JWT_SECRET || !process.env.DATABASE_URL) {
  console.error('\nserver/.env is missing or incomplete.');
  console.error('Copy server/.env.example to server/.env and fill in your MySQL password.\n');
  process.exit(1);
}

const port = Number(process.env.PORT ?? 4000);
const websiteBuilt = fs.existsSync(fileURLToPath(new URL('../../client/dist/index.html', import.meta.url)));

createApp().listen(port, () => {
  if (websiteBuilt) {
    console.log(`\nOnline Exam Portal is running. Open http://localhost:${port} in your browser.`);
    console.log('Press Ctrl+C to stop.\n');
  } else {
    console.log(`API listening on http://localhost:${port}`);
  }
});
