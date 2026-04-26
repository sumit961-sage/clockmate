import express from 'express';
import mongoose from 'mongoose';
import { TimeEntry, LeaveRequest, Employee, Payslip } from '../models/index.js';

const router = express.Router();

// GET /api/dashboard/:orgId/summary
router.get('/:orgId/summary', async (req, res) => {
  try {
    const orgId = new mongoose.Types.ObjectId(req.params.orgId);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [activeEntries, pendingLeave, employees, totalPayslips] = await Promise.all([
      TimeEntry.countDocuments({ orgId, status: 'ACTIVE' }),
      LeaveRequest.countDocuments({ orgId, status: 'PENDING' }),
      Employee.countDocuments({ orgId, isActive: true }),
      Payslip.countDocuments({ orgId }),
    ]);

    const todayEntries = await TimeEntry.find({ orgId, 'clockIn.time': { $gte: today } }).lean();
    const todayHours = todayEntries.reduce((s, e) => s + (e.totalHours || 0), 0);

    res.json({
      activeEmployees: activeEntries,
      pendingApprovals: pendingLeave,
      totalEmployees: employees,
      totalPayslips,
      todayHours,
      lateClockIns: 0,
      upcomingShifts: 0,
      complianceAlerts: [],
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/dashboard/:orgId/activity
router.get('/:orgId/activity', async (req, res) => {
  try {
    const entries = await TimeEntry.find({ orgId: new mongoose.Types.ObjectId(req.params.orgId) })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();
    res.json(entries.map(e => ({
      id: e._id,
      actor: { firstName: 'User', lastName: e.userId?.slice(0, 6) || 'Unknown' },
      action: e.status === 'ACTIVE' ? 'CLOCKED_IN' : 'CLOCKED_OUT',
      entityType: 'TIME_ENTRY',
      entityId: e._id,
      timestamp: e.createdAt || e.clockIn?.time,
      details: `${(e.totalHours || 0).toFixed(1)}h`,
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/dashboard/:orgId/analytics
router.get('/:orgId/analytics', async (req, res) => {
  try {
    const { range = 'week' } = req.query;
    const days = range === 'week' ? 7 : range === 'month' ? 30 : 90;
    const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    start.setHours(0, 0, 0, 0);

    const entries = await TimeEntry.find({
      orgId: new mongoose.Types.ObjectId(req.params.orgId),
      'clockIn.time': { $gte: start },
    }).lean();

    const hoursByDay = {};
    for (let i = 0; i < days; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      hoursByDay[d.toISOString().split('T')[0]] = 0;
    }

    entries.forEach(e => {
      const d = new Date(e.clockIn?.time || e.createdAt);
      const key = d.toISOString().split('T')[0];
      if (hoursByDay[key] !== undefined) hoursByDay[key] += (e.totalHours || 0);
    });

    res.json({
      labels: Object.keys(hoursByDay),
      hoursWorked: Object.values(hoursByDay),
      totalHours: entries.reduce((s, e) => s + (e.totalHours || 0), 0),
      avgDailyHours: entries.length > 0 ? (entries.reduce((s, e) => s + (e.totalHours || 0), 0) / entries.length) : 0,
      overtimeHours: entries.reduce((s, e) => s + (e.overtimeHours || 0), 0),
      absentCount: 0,
      lateCount: 0,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
