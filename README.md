ClockMate Pro ⏱️
Enterprise Shift Management & Payroll Compliance System
Victoria University — Information Technology Project

---

OVERVIEW
ClockMate Pro is a production-ready workforce management platform designed for high-turnover, shift-based environments such as hospitality, retail, and healthcare.

It combines secure attendance tracking, intelligent scheduling, and automated payroll compliance aligned with Australian Fair Work regulations.

The system emphasizes data integrity, fraud prevention, and real-time operational efficiency through a modern full-stack architecture.

---

CORE FEATURES

Smart Attendance System

* Secure geofenced clock-in and clock-out using the Haversine formula
* Photo verification (Base64 compressed) to prevent buddy punching
* Server-side validation to eliminate client-side spoofing

Advanced Scheduling

* Interactive drag-and-drop shift planner
* Real-time conflict detection
* Export schedules directly to PDF
* Mobile-first responsive design

Fair Work Compliance Automation

* Automatic leave accrual (7.69%) based on hours worked
* Built-in penalty rate calculations:
  Sunday shifts → 1.5x pay
  Public holidays → 2.25x pay
* Fully enforced on the server side for accuracy and compliance

Dispute Center

* Integrated communication system between employees and managers
* Resolve timesheet issues before payroll processing
* Improves transparency and reduces payroll errors

Performance Optimization

* Powered by TanStack React Query
* Optimistic UI updates
* Background data caching
* Smooth, zero-flicker user experience

Timezone Enforcement

* Hardcoded Australia/Sydney timezone using date-fns-tz
* Prevents manipulation via device clock changes

---

PROJECT ARCHITECTURE

clockmate/
├── app/                        Frontend (Vite + React + TypeScript + Tailwind)
│   ├── src/
│   │   ├── components/         Reusable UI components
│   │   ├── hooks/              Custom hooks
│   │   ├── lib/                API client and utilities
│   │   └── pages/dashboard/    Core modules
│   │       ├── Clock.tsx       Attendance and photo capture
│   │       ├── Schedule.tsx    Shift management
│   │       ├── Timesheets.tsx  Dispute center
│   │       ├── Leave.tsx       Leave tracking
│   │       └── Payslips.tsx    Payroll viewing
│
├── backend/                    Backend (Node.js + Express + MongoDB)
│   ├── src/
│   │   ├── models/             Database schemas
│   │   ├── middleware/         Authentication and authorization
│   │   ├── utils/              Haversine calculations
│   │   └── routes/             API endpoints
│
└── README.md

---

LOCAL SETUP INSTRUCTIONS

Prerequisites

* Node.js version 18 or higher
* MongoDB Atlas account or local MongoDB instance

Database Setup

1. Create a MongoDB cluster
2. Create a database user
3. Allow network access (0.0.0.0/0 for development)
4. Copy your connection string

Example:
mongodb+srv://username:password@cluster0.mongodb.net/clockmate

---

BACKEND SETUP

1. Navigate to backend folder
   cd backend

2. Install dependencies
   npm install

3. Create .env file

PORT=3001
MONGODB_URI=your_connection_string
JWT_SECRET=your_secret_key

4. Start server
   npm run dev

---

FRONTEND SETUP

1. Navigate to app folder
   cd app

2. Install dependencies
   npm install

3. Create .env file

VITE_API_URL=http://localhost:3001/api

4. Start development server
   npm run dev

Application will run at:
http://localhost:5173

---

MOBILE APP CONVERSION (CAPACITOR)

Step 1: Install Capacitor
npm install @capacitor/core @capacitor/cli
npm install @capacitor/ios @capacitor/android

Initialize project
npx cap init ClockMate com.victoriauni.clockmate

---

Step 2: Configure Build

Ensure capacitor.config.ts includes:

appId: com.victoriauni.clockmate
appName: ClockMate Pro
webDir: dist

---

Step 3: Build and Sync

npm run build
npx cap add android
npx cap add ios
npx cap sync

---

Step 4: Run on Device

npx cap open android
or
npx cap open ios

Install required plugins
npm install @capacitor/camera @capacitor/geolocation

---

SUMMARY

ClockMate Pro delivers a secure, scalable, and compliant workforce management solution tailored for Australian businesses.

By combining modern frontend technologies with a robust backend system, it ensures accuracy, efficiency, and a seamless user experience across both web and mobile platforms.

---
