# Online Exam Portal — Minimal Skeleton

Minimal starting structure for the Online Exam Portal. It intentionally contains **placeholders only**; implement requirements in separate feature branches and merge them through pull requests.

## Stack
- React + TypeScript (client)
- Node.js + Express + TypeScript (server)
- PostgreSQL + Prisma (database schema foundation)

## Run the starter

Prerequisites: Node.js 20+ and PostgreSQL.

### Backend
1. Create a PostgreSQL database named `online_exam_portal`.
2. Copy `server/.env.example` to `server/.env` and set `DATABASE_URL` and `JWT_SECRET`.
3. In a terminal:

```bash
cd server
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run dev
```

### Frontend
In a second terminal:

```bash
cd client
npm install
npm run dev
```

Open the local URL printed by Vite.

## Suggested branch workflow
Create one branch per issue, for example `feature/authentication`, `feature/role-access`, `feature/exam-management`, `feature/question-bank`, `feature/exam-attempt`, `feature/auto-evaluation`, and `feature/reports`. Implement only that issue, test it, and open a pull request.

## Current status
This is not a working exam system yet. Authentication, role permissions, exam CRUD, question management, attempts, autosaving, timers, grading, reports, tests, and operational security are intentionally left for future issues.
