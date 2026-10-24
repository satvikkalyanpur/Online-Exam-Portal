# Initial Architecture (Project Setup, Issue #1)

This document records the technology choices that fill the "Items to Confirm" in
Section 7 of the Software Architecture Document (SAD). It does not change the SAD's
logical architecture.

## Confirmed stack
| Area | Choice |
| ---- | ------ |
| Frontend | React + Vite (http://localhost:5173) |
| Backend | Node.js + Express, written in TypeScript (http://localhost:4000) |
| Database | MySQL, accessed through Prisma ORM |
| Configuration | Environment variables in `server/.env` (not committed); `server/.env.example` lists the required keys |

## Request flow
Browser (React UI) -> HTTP/JSON -> Express API -> Prisma -> MySQL

## Mapping to SAD logical components
| SAD component | Implemented by |
| ------------- | -------------- |
| User Interface / Presentation | `online-exam-portal-minimal/client` (React + Vite) |
| Authentication and Authorization | Express API in `server/src` (JWT secret configured via `JWT_SECRET`); built in US01 and US02 |
| Examination Management, Question Bank, Attempt Management, Evaluation and Reporting | Express API in `server/src`, built in later stories (US03 to US17) |
| Data Persistence and Recovery | MySQL via Prisma; schema in `online-exam-portal-minimal/database/schema.prisma` |
| Security and Activity Logging | Built in US18 and US21 |

## Repository layout
- `online-exam-portal-minimal/client` - frontend
- `online-exam-portal-minimal/server` - backend API
- `online-exam-portal-minimal/database` - Prisma schema
- `docs` - documentation

## Deviations from the SAD
None. The SAD describes responsibilities, not technologies, so the stack above only fills in the details it left open.

## Verification
- The server starts and prints `API listening on http://localhost:4000`.
- `prisma db push` reports the database is in sync with the schema.
- The client starts with `npm run dev`.