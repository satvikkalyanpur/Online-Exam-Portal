# How to run the Online Exam Portal

A web application for running multiple-choice examinations online. Administrators
schedule exams, teachers write the questions, and students take the exams
against a timer and see their results as soon as they submit.

It covers every user story in the backlog, US01 to US22 (Sprint 1 and Sprint 2).

## What each role can do

**Students** see their scheduled exams, start an exam once it opens, move between
questions, mark questions for review, and submit. Answers are saved as they go,
also while the internet connection is down. When the timer reaches zero the exam
is submitted automatically. Results, with each question marked right or wrong,
are shown straight after submitting.

**Teachers** manage the question bank: add, edit and delete questions, and choose
which exams each question belongs to.

**Administrators** create and schedule exams, publish them, and see student
performance reports, exam statistics and the activity log. They can also back up
and restore all exam and result data.

---

## Running the portal

You need two programs on your computer, installed once:

- **Node.js 22 LTS** (or newer) from [nodejs.org](https://nodejs.org).
- **MySQL 8** from [dev.mysql.com/downloads/installer](https://dev.mysql.com/downloads/installer/).
  In the installer choose *Server only*, keep port **3306**, and set a root
  password you will remember. (XAMPP or MariaDB also work.)

VS Code is not needed. Any terminal works: Command Prompt or PowerShell on
Windows, Terminal on a Mac.

### First time

**1. Create the database.** Open *MySQL 8.0 Command Line Client* from the Start
menu, type your root password, then run:

```sql
CREATE DATABASE IF NOT EXISTS online_exam_portal;
```

Type `exit` to close it.

**2. Tell the portal your MySQL password.** In the folder
`online-exam-portal-minimal/server`, make a copy of `.env.example` and name the
copy `.env`. Open `.env` in Notepad and replace `your_password` with your MySQL
root password:

```
DATABASE_URL="mysql://root:your_password@localhost:3306/online_exam_portal"
```

If the password contains `@`, `#`, `/`, `:`, `?` or `%`, write them as `%40`,
`%23`, `%2F`, `%3A`, `%3F` and `%25`. For example, `Pass@123` becomes `Pass%40123`.

**3. Install and set up.** Open a terminal in the `online-exam-portal-minimal`
folder. On Windows, open the folder in File Explorer, click the address bar,
type `cmd` and press Enter. Then run:

```
npm run setup
```

This installs everything, creates the tables, and adds test accounts and sample
exams. It takes a few minutes the first time.

### Every time

In the same folder:

```
npm start
```

When it says *Online Exam Portal is running*, open **http://localhost:4000** in
your browser. To stop the portal, press `Ctrl + C` in the terminal.

### If you ran an earlier version of this project

The database layout has changed, so start with a clean database once:

```
npm run reset-db
```

This deletes all existing data in `online_exam_portal`, recreates the tables
and adds the sample data again. You can also use it any time you want a fresh
start before testing.

---

## Test accounts

| Role          | Email                | Password    |
| ------------- | -------------------- | ----------- |
| Administrator | admin@example.com    | Admin@123   |
| Teacher       | teacher@example.com  | Teacher@123 |
| Student       | student@example.com  | Student@123 |
| Student       | student2@example.com | Student@123 |

The sample data contains:

- two open exams: *Computer Science Fundamentals* and *Data Structures and Algorithms*
- *Operating Systems Quiz*, which opens tomorrow at 10:00, to show an exam that is not available yet
- *Database Systems*, a draft that students cannot see
- two finished attempts by the second student, so the reports and statistics have data from the start

## A short tour

These steps follow the test cases in `Documents/Online_Exam_Portal_Test_Case_Plan.pdf`.

1. **Administrator:** *Examinations → Create examination.* Give it a title, subject,
   duration, marks and an opening time a few minutes ago. Keep *Published* ticked. (TC_06)
2. **Teacher:** *Add question*, tick the new exam under *Use in examinations*.
   Edit one question, then delete one; deleting asks for confirmation first. (TC_07–09)
3. **Student:** the new exam appears with its subject, date, duration, number of
   questions and schedule. *Operating Systems Quiz* shows when it opens and
   cannot be started yet. (TC_05, TC_14)
4. **Student:** start the exam. Answer, use *Next* and *Previous*, jump with the
   numbered buttons, tick *Mark for review*. The timer counts down at the top. (TC_10–13)
5. **Student:** turn off Wi-Fi and pick an answer. A yellow notice says it is kept
   on the device. Turn Wi-Fi back on and it shows *Answer saved*. (TC_21)
6. **Student:** *Review answers → Submit examination.* The score appears at once,
   and *My results* shows each question marked right or wrong. The correct answers
   are revealed after the exam closes. (TC_16, TC_17)
7. **Automatic submission:** create an exam with a duration of **1 minute**, start
   it as a student and wait. When the timer reaches zero it is submitted on its own.
   This also happens if the student closes the browser. (TC_15)
8. **Administrator:** *Reports* (filter by exam, download as CSV), *Statistics* and
   *Activity log*. (TC_18, TC_19, TC_23)

### Backup and recovery (TC_22)

1. Log in as the administrator and open **Backup**.
2. **Download backup** saves one `.json` file containing every exam, question,
   attempt, answer and result.
3. To recover, choose **Choose backup file…**, pick the file, then
   **Restore this backup** and confirm.

The whole file is checked before anything changes. If it is damaged or
inconsistent, it is refused and the data stays as it was. The backup contains
account details (passwords are stored encrypted), so keep the file private.

---

## Useful commands

Run these in the `online-exam-portal-minimal` folder.

| Command            | What it does                                                    |
| ------------------ | --------------------------------------------------------------- |
| `npm run setup`    | First-time install, creates the tables, adds the sample data    |
| `npm start`        | Starts the portal on http://localhost:4000                      |
| `npm run reset-db` | Deletes all data and starts again with the sample data          |
| `npm test`         | Runs the 52 automated API tests (needs the sample data in place) |
| `npm run check`    | Type-checks everything, runs the tests and builds the website   |

## Troubleshooting

| What you see                                               | What to do                                                                                       |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `'npm' is not recognized`                                  | Install Node.js, then close the terminal and open a new one.                                      |
| `server/.env is missing or incomplete`                     | Do step 2. On Windows, check the file is called `.env` and not `.env.txt`.                         |
| `Access denied for user 'root'`                            | The password in `.env` is wrong, or has a special character that needs encoding (see step 2).    |
| `Can't reach database server` / `ECONNREFUSED`             | MySQL is not running. Start the *MySQL80* service, or start MySQL in XAMPP. XAMPP may use port 3307. |
| `Unknown database 'online_exam_portal'`                    | Run the `CREATE DATABASE` command from step 1.                                                    |
| Setup stops with a warning about data loss or a required column | You have tables from an older version. Run `npm run reset-db`.                               |
| `EADDRINUSE: address already in use :::4000`               | The portal is already running in another terminal. Close it, or set `PORT=4001` in `.env`.        |
| Login page says *Cannot reach the server*                  | The terminal running `npm start` was closed. Start it again.                                      |

---

## How it is built

| Part     | Technology                                                    |
| -------- | ------------------------------------------------------------- |
| Website  | React + TypeScript, built with Vite (`client/`)               |
| Server   | Node.js + Express + TypeScript (`server/`)                    |
| Database | MySQL 8, accessed through Prisma (`database/schema.prisma`)   |
| Login    | Passwords hashed with bcrypt; signed login tokens (JWT)       |

`npm start` builds the website and the server delivers it together with the API,
so everything runs on one address. The server decides everything that matters
(who may do what, deadlines, scores), so nothing can be skipped by changing the
page in the browser.

```
online-exam-portal-minimal/
├── client/src/
│   ├── App.tsx               login and the screens for each role
│   ├── components/           one file per screen (ExamAttempt, Results, QuestionBank, …)
│   └── useAnswerSync.ts      saving answers, including while offline
├── server/src/
│   ├── routes.ts             every API route and which role may use it
│   ├── auth.ts               login and role checks
│   ├── exams.ts              exams (create, edit, publish, list)
│   ├── questions.ts          question bank
│   ├── attempts.ts           taking an exam
│   ├── grading.ts            submitting and marking
│   ├── results.ts            a student's results
│   ├── reports.ts            performance reports and statistics
│   ├── backup.ts             backup and restore
│   ├── activityLog.ts        activity log
│   ├── security.ts           security headers and login lockout
│   └── seed.ts               test accounts and sample data
├── server/test/              automated API tests for Sprint 1 and Sprint 2
└── database/schema.prisma    the database tables
```

Every API route, and the role allowed to use it, is listed in
`online-exam-portal-minimal/server/src/routes.ts`. The SRS, use case diagram,
use case flows and test plan are in the `Documents` folder.

### For development

To see changes instantly while editing code, run the server and the website
separately, in two terminals:

```
cd online-exam-portal-minimal/server  &&  npm run dev
cd online-exam-portal-minimal/client  &&  npm run dev
```

and open http://localhost:5173.

## User stories

| Story | Feature                                     | Story | Feature                                  |
| ----- | ------------------------------------------- | ----- | ---------------------------------------- |
| US01  | Login                                       | US12  | No access before the scheduled time      |
| US02  | Role-based access                           | US13  | Automatic submission when time runs out  |
| US03  | View available exams                        | US14  | Automatic marking                        |
| US04  | Create examination                          | US15  | View results                             |
| US05  | Add questions                               | US16  | Student performance reports              |
| US06  | Edit questions                              | US17  | Examination statistics                   |
| US07  | Delete questions                            | US18  | Protected credentials and exam data      |
| US08  | Take an exam online                         | US19  | Consistent data after a lost connection  |
| US09  | Countdown timer                             | US20  | Backup and recovery                      |
| US10  | Answers saved automatically                 | US21  | Activity logs                            |
| US11  | Move between questions and review           | US22  | Works on computers, tablets and phones   |
