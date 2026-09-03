# Online Exam Portal

## Project Description

The **Online Exam Portal** is a web-based examination system designed to conduct and manage examinations digitally. The system allows students to securely log in, view scheduled examinations, attend exams within the allotted time, and receive automatically evaluated results.

Teachers can manage the question bank, while administrators can create and schedule examinations and generate performance reports. The system also includes automatic answer saving, countdown timers, automatic submission, role-based access control, activity logging, data security, and backup/recovery mechanisms to provide a reliable and secure examination process.

## Project Requirements

The project documentation is based on the Software Requirements Specification (SRS), which defines the functional and non-functional requirements of the Online Exam Portal.

### Main Functional Requirements

* Secure user authentication
* Role-based access for Students, Teachers, and Administrators
* Viewing available examinations and schedules
* Creating and scheduling examinations
* Question bank management
* Multiple-choice question support
* Online examination with countdown timer
* Automatic answer saving
* Question navigation and marking for review
* Automatic examination submission when time expires
* Automatic evaluation of objective-type questions
* Result generation and viewing
* Examination reports and performance statistics
* Activity and examination logs

### Main Non-Functional Requirements

* Security and protection of sensitive data
* System availability during examinations
* Reasonable response time
* Support for multiple simultaneous students
* Responsive interface for computers, tablets, and mobile devices
* Data consistency during temporary network interruptions
* Backup and recovery of examination and result data

## System Users

### Student

Students can:

* Log in securely
* View available examinations
* Start examinations according to their schedules
* Answer and navigate between questions
* Mark questions for review
* Have answers automatically saved
* Submit examinations
* View evaluated results

### Teacher / Examiner

Teachers can:

* Log in using their credentials
* Manage the question bank
* Add questions
* Edit questions
* Delete questions
* Prepare questions for examinations

### Administrator

Administrators can:

* Manage examinations
* Create and schedule examinations
* Configure examination details
* Generate examination reports
* View performance statistics
* Manage system-level access and security

## Repository Documentation

All project documentation is maintained in the `Documents` folder.

```text
Documents/
│
├── SRS Document
├── Test Plan Document
├── Use Case Diagram
└── Use Case Flow
```

### 1. SRS Document

The **Software Requirements Specification (SRS)** defines the requirements of the Online Exam Portal, including functional and non-functional requirements.

It describes the expected behaviour of the system and the requirements for authentication, examination management, question management, online examination, evaluation, results, reporting, security, performance, usability, reliability, and backup/recovery.

**File:** `Documents/SRS Document`

### 2. Test Case / Test Plan Document

The **Test Plan Document** contains test cases for the implemented functional use cases of the system.

The test cases include:

* Unit Testing
* Integration Testing
* System Testing
* Valid input scenarios
* Invalid input scenarios
* Preconditions
* Test steps
* Test data
* Expected results
* Actual results
* Pass/Fail status

The `Actual Result` and `Test Result` fields are populated after manually executing the corresponding test cases on the implemented system.

**File:** `Documents/Test Plan Document`

### 3. Use Case Diagram

The **Use Case Diagram (UCD)** represents the interaction between the system and its primary actors:

* Student
* Teacher / Examiner
* Administrator

It illustrates the major functions of the Online Exam Portal and how each actor interacts with the system.

**File:** `Documents/Use Case Diagram`

### 4. Use Case Flow

The **Use Case Flow (UCF)** describes the sequence of actions performed during the major system use cases.

The documented flows include:

1. User Login
2. Create & Schedule Examination
3. Manage Question Bank
4. View Available Examinations
5. Take Online Examination
6. Evaluate Examination
7. View Examination Results
8. Generate Performance Reports
9. Activity Logging

Each use case includes its primary actor, main flow, and relevant alternate/exception flows.

**File:** `Documents/Use Case Flow`

## Project Structure

```text
Online-Exam-Portal/
│
├── Documents/
│   ├── SRS Document
│   ├── Test Plan Document
│   ├── Use Case Diagram
│   └── Use Case Flow
│
├── src/
│   └── ...
│
└── README.md
```

> The `src` directory and implementation structure will contain the actual application source code.

## Key Features

* 🔐 Secure authentication
* 👥 Role-based access control
* 📝 Question bank management
* 📅 Examination scheduling
* ⏱️ Countdown examination timer
* 💾 Automatic answer saving
* 🔄 Automatic submission
* 📊 Automatic objective-question evaluation
* 📈 Performance reports
* 📋 Examination results
* 🔒 Examination and data security
* 🗃️ Activity logging
* 💽 Backup and recovery

## Documentation

The complete project requirements and design documentation can be found in the [`Documents`](./Documents) folder.

---

**Project Title:** Online Exam Portal
