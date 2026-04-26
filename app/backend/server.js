import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

import timeEntryRoutes from './src/routes/timeEntries.js';
import employeeRoutes from './src/routes/employees.js';
import authRoutes from './src/routes/auth.js';
import orgRoutes from './src/routes/orgs.js';
import shiftRoutes from './src/routes/shifts.js';
import leaveRoutes from './src/routes/leave.js';
import timesheetRoutes from './src/routes/timesheets.js';
import locationRoutes from './src/routes/locations.js';
import payslipRoutes from './src/routes/payslips.js';
import dashboardRoutes from './src/routes/dashboard.js';
import inviteRoutes from './src/routes/invites.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// CORS
app.use(cors({ origin: true, credentials: true }));

// Body parser with LARGE limits for base64 photos
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/clockmate';
mongoose.connect(MONGODB_URI)
  .then(() => console.log('[Server] MongoDB connected'))
  .catch(err => console.error('[Server] MongoDB connection error:', err));

// Health check
app.get('/api/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// API Routes
app.use('/api/time-entries', timeEntryRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/orgs', orgRoutes);
app.use('/api/shifts', shiftRoutes);
app.use('/api/leave', leaveRoutes);
app.use('/api/timesheets', timesheetRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/payslips', payslipRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/invites', inviteRoutes);

// 404 handler - return JSON, not HTML
app.use((_req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Global error handler
app.use((err, _req, res, _next) => {
  console.error('[Server] unhandled error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`[Server] ClockMate API running on http://localhost:${PORT}`);
});
