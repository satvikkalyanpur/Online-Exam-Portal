// Prisma CLI configuration (Prisma 7). Run Prisma commands from the `server` folder.
import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: '../database/schema.prisma',
  migrations: {
    seed: 'tsx src/seed.ts',
  },
  datasource: {
    // Read directly (not with Prisma's env() helper) so `prisma generate`, which runs
    // during `npm install`, works before server/.env exists. Commands that connect
    // to the database (db push, db seed) still need it set.
    url: process.env.DATABASE_URL ?? '',
  },
});
