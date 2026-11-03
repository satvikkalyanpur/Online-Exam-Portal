import 'dotenv/config';
import { PrismaClient } from './generated/prisma/client.js';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

// The MariaDB driver adapter works with both MySQL (5.7+, 8.x) and MariaDB.
function connectionConfig() {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    throw new Error('DATABASE_URL is not set. Copy server/.env.example to server/.env and fill it in.');
  }
  const url = new URL(raw);
  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ''),
    connectionLimit: 10,
    // Needed for MySQL 8's default login method on a local (non-TLS) connection.
    allowPublicKeyRetrieval: true,
  };
}

const prisma = new PrismaClient({ adapter: new PrismaMariaDb(connectionConfig()) });

export default prisma;
