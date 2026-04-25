import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import morgan from 'morgan';
import mongoose from 'mongoose';

import authRoutes from './src/routes/auth.js';
import orgRoutes from './src/routes/organizations.js';
import employeeRoutes from './src/routes/employees.js';
import locationRoutes from './src/routes/locations.js';
import shiftRoutes from './src/routes/shifts.js';
import timeEntryRoutes from './src/routes/timeEntries.js';
import timesheetRoutes from './src/routes/timesheets.js';
import leaveRoutes from './src/routes/leave.js';
import dashboardRoutes from './src/routes/dashboard.js';
import inviteRoutes from './src/routes/invites.js';
import payslipRoutes from './src/routes/payslips.js';
import templateRoutes from './src/routes/templates.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/clockmate';

mongoose.connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/orgs', orgRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/shifts', shiftRoutes);
app.use('/api/time-entries', timeEntryRoutes);
app.use('/api/timesheets', timesheetRoutes);
app.use('/api/leave', leaveRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/invites', inviteRoutes);
app.use('/api/payslips', payslipRoutes);
app.use('/api/templates', templateRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
