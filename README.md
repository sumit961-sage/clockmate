# ClockMate Pro - Enterprise Workforce Management System

A full-stack enterprise workforce management platform with intelligent time tracking, GPS geofencing, shift scheduling, leave management, and automated timesheet processing.

## 🚀 Live Demo

**Frontend:** https://sp76r4rkdqzvc.ok.kimi.link

## 📋 Demo Credentials

Use any of these accounts to test different roles:

| Role | Email | Password |
|------|-------|----------|
| Owner | `owner@clockmate.com` | `password123` |
| Admin | `admin@clockmate.com` | `password123` |
| Manager | `manager@clockmate.com` | `password123` |
| Employee | `employee@clockmate.com` | `password123` |

## ✨ Features

### Core Modules
- **Multi-Organization Architecture** - Support for unlimited organizations with complete data isolation
- **RBAC (Role-Based Access Control)** - 5 user roles: Owner, Admin, Manager, Employee, Observer
- **Clock In/Out System** - GPS geofencing, real-time tracking, break management
- **Shift Scheduling** - Weekly calendar view, recurring shifts, conflict detection
- **Timesheet Management** - Auto-generation, approval workflows, payroll export
- **Leave Management** - Balance tracking, request workflows, approval chains
- **Employee Management** - Profiles, departments, certifications, documents
- **Location Management** - Multiple sites, geofence configuration, QR codes
- **Analytics Dashboard** - Attendance trends, hours breakdown, team performance

## 🛠️ Tech Stack

### Frontend
- React 18 + TypeScript
- Vite (build tool)
- Tailwind CSS
- shadcn/ui components
- Zustand (state management)
- TanStack Query (data fetching)
- Recharts (charts)
- React Router v6

### Backend
- Node.js 20+ with ES Modules
- Express.js
- MongoDB with Mongoose
- JWT Authentication
- bcryptjs (password hashing)

## 📁 Project Structure

```
/mnt/okcomputer/output/
├── app/                    # Frontend React application
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── pages/          # Page components
│   │   ├── hooks/          # Custom React hooks
│   │   ├── store/          # Zustand stores
│   │   ├── lib/            # API client and utilities
│   │   └── types/          # TypeScript type definitions
│   └── dist/               # Built frontend assets
│
└── backend/                # Node.js/Express backend
    ├── src/
    │   ├── models/         # Mongoose models
    │   ├── routes/         # API routes
    │   ├── middleware/     # Express middleware
    │   └── config/         # Configuration files
    └── server.js           # Entry point
```

## 🚀 Getting Started

### Prerequisites
- Node.js 20+ 
- MongoDB (local or Atlas)

### 1. Clone and Setup

```bash
# Navigate to the project directory
cd /mnt/okcomputer/output
```

### 2. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Configure environment variables
# Edit .env file with your MongoDB URI:
# MONGODB_URI=mongodb://localhost:27017/clockmate
# Or use MongoDB Atlas:
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/clockmate

# Start the backend server
npm run dev
```

The backend will start on `http://localhost:3001`

### 3. Frontend Setup

```bash
# Navigate to frontend directory
cd ../app

# Install dependencies (if not already installed)
npm install

# Configure API URL
# Edit .env file:
# VITE_API_URL=http://localhost:3001/api

# Start the development server
npm run dev
```

The frontend will start on `http://localhost:5173`

### 4. Build for Production

```bash
# Build frontend
cd app
npm run build

# The built files will be in app/dist/
```

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user

### Organizations
- `GET /api/orgs` - Get user's organizations
- `POST /api/orgs` - Create organization
- `GET /api/orgs/:id` - Get organization by ID
- `PUT /api/orgs/:id` - Update organization

### Employees
- `GET /api/employees?orgId=` - Get employees
- `POST /api/employees` - Create employee
- `GET /api/employees/:id` - Get employee by ID
- `PUT /api/employees/:id` - Update employee
- `DELETE /api/employees/:id` - Deactivate employee

### Locations
- `GET /api/locations?orgId=` - Get locations
- `POST /api/locations` - Create location
- `GET /api/locations/:id` - Get location by ID
- `PUT /api/locations/:id` - Update location
- `DELETE /api/locations/:id` - Deactivate location

### Shifts
- `GET /api/shifts?orgId=` - Get shifts
- `POST /api/shifts` - Create shift
- `GET /api/shifts/:id` - Get shift by ID
- `PUT /api/shifts/:id` - Update shift
- `DELETE /api/shifts/:id` - Cancel shift

### Time Entries
- `GET /api/time-entries?orgId=` - Get time entries
- `POST /api/time-entries/clock-in` - Clock in
- `POST /api/time-entries/clock-out` - Clock out
- `POST /api/time-entries/:id/break-start` - Start break
- `POST /api/time-entries/:id/break-end` - End break
- `GET /api/time-entries/current/:userId` - Get current active entry

### Timesheets
- `GET /api/timesheets?orgId=` - Get timesheets
- `POST /api/timesheets` - Create timesheet
- `POST /api/timesheets/:id/submit` - Submit timesheet
- `POST /api/timesheets/:id/approve` - Approve timesheet
- `POST /api/timesheets/:id/reject` - Reject timesheet

### Leave
- `GET /api/leave/types?orgId=` - Get leave types
- `POST /api/leave/types` - Create leave type
- `GET /api/leave/balances/:userId` - Get leave balances
- `GET /api/leave/requests?orgId=` - Get leave requests
- `POST /api/leave/requests` - Create leave request
- `POST /api/leave/requests/:id/approve` - Approve request
- `POST /api/leave/requests/:id/reject` - Reject request

### Dashboard
- `GET /api/dashboard/admin/:orgId` - Admin dashboard data
- `GET /api/dashboard/manager/:orgId` - Manager dashboard data
- `GET /api/dashboard/employee/:orgId/:userId` - Employee dashboard data

## 🔐 Environment Variables

### Backend (.env)
```
PORT=3001
MONGODB_URI=mongodb://localhost:27017/clockmate
JWT_SECRET=your-secret-key-here
NODE_ENV=development
```

### Frontend (.env)
```
VITE_API_URL=http://localhost:3001/api
```

## 📱 Mobile Support

The application is fully responsive and works on mobile devices. For production deployment, consider:
- Adding PWA support with service workers
- Implementing push notifications
- Adding biometric authentication

## 🚀 Deployment

### Frontend (Static Hosting)
The frontend can be deployed to any static hosting service:
- Vercel
- Netlify
- GitHub Pages
- AWS S3 + CloudFront

### Backend (Node.js Hosting)
The backend requires a Node.js runtime environment:
- Heroku
- Railway
- Render
- AWS EC2 / ECS
- Digital Ocean
- MongoDB Atlas for database

## 📝 License

MIT License - feel free to use this project for personal or commercial purposes.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
