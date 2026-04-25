import express from 'express';
import TimeEntry from '../models/TimeEntry.js';
import Employee from '../models/Employee.js';
import LeaveRequest from '../models/LeaveRequest.js';
import Timesheet from '../models/Timesheet.js';
import Shift from '../models/Shift.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Get admin dashboard data
router.get('/admin/:orgId', authenticate, async (req, res) => {
  try {
    const { orgId } = req.params;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Today's attendance
    const todayEntries = await TimeEntry.find({
      orgId,
      'clockIn.time': { $gte: today, $lt: tomorrow }
    });

    const totalEmployees = await Employee.countDocuments({ orgId, isActive: true });
    const present = todayEntries.filter(e => e.status === 'ACTIVE' || e.status === 'COMPLETED').length;
    const late = todayEntries.filter(e => {
      const clockInHour = new Date(e.clockIn.time).getHours();
      return clockInHour >= 9;
    }).length;

    // Pending approvals
    const pendingTimesheets = await Timesheet.countDocuments({
      orgId,
      status: 'SUBMITTED'
    });

    const pendingLeaveRequests = await LeaveRequest.countDocuments({
      orgId,
      status: 'PENDING'
    });

    // Upcoming leave (next 7 days)
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);

    const upcomingLeave = await LeaveRequest.find({
      orgId,
      status: 'APPROVED',
      startDate: { $gte: today, $lte: nextWeek }
    }).populate('userId', 'firstName lastName');

    res.json({
      todayAttendance: {
        present,
        absent: totalEmployees - present,
        onLeave: 0,
        late,
        total: totalEmployees
      },
      laborCostSummary: {
        today: 2450.50,
        lastWeek: 18200.00,
        budget: 25000.00,
        variance: -1800.00
      },
      overtimeAlerts: [],
      upcomingLeave: upcomingLeave.map(l => ({
        employeeId: l.userId._id,
        employeeName: `${l.userId.firstName} ${l.userId.lastName}`,
        startDate: l.startDate,
        endDate: l.endDate,
        days: l.days
      })),
      pendingApprovals: {
        timesheets: pendingTimesheets,
        leaveRequests: pendingLeaveRequests,
        timeEdits: 0
      }
    });
  } catch (error) {
    console.error('Admin dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

// Get manager dashboard data
router.get('/manager/:orgId', authenticate, async (req, res) => {
  try {
    const { orgId } = req.params;
    const managerId = req.user._id;

    // Get team members
    const teamMembers = await Employee.find({
      orgId,
      managerId,
      isActive: true
    });

    const teamUserIds = teamMembers.map(e => e.userId);

    // Pending approvals for team
    const pendingTimesheets = await Timesheet.countDocuments({
      orgId,
      userId: { $in: teamUserIds },
      status: 'SUBMITTED'
    });

    const pendingLeaveRequests = await LeaveRequest.countDocuments({
      orgId,
      userId: { $in: teamUserIds },
      status: 'PENDING'
    });

    res.json({
      teamAttendanceRate: 92,
      lateArrivalsThisWeek: 3,
      pendingApprovals: {
        timesheets: pendingTimesheets,
        leaveRequests: pendingLeaveRequests,
        timeEdits: 0
      },
      shiftCoverageHealth: {
        healthy: 8,
        understaffed: 2,
        overstaffed: 1
      },
      teamMembers
    });
  } catch (error) {
    console.error('Manager dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

// Get employee dashboard data
router.get('/employee/:orgId/:userId', authenticate, async (req, res) => {
  try {
    const { orgId, userId } = req.params;

    // Current time entry
    const currentEntry = await TimeEntry.findOne({
      orgId,
      userId,
      status: 'ACTIVE'
    });

    // Week stats
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const weekEntries = await TimeEntry.find({
      orgId,
      userId,
      status: 'COMPLETED',
      'clockIn.time': { $gte: weekStart, $lt: weekEnd }
    });

    const totalHours = weekEntries.reduce((sum, e) => sum + e.totalHours, 0);
    const regularHours = weekEntries.reduce((sum, e) => sum + e.regularHours, 0);
    const overtimeHours = weekEntries.reduce((sum, e) => sum + e.overtimeHours, 0);

    // Upcoming shifts
    const upcomingShifts = await Shift.find({
      orgId,
      assignedTo: userId,
      startTime: { $gte: new Date() }
    })
      .populate('locationId', 'name')
      .sort({ startTime: 1 })
      .limit(5);

    res.json({
      currentPayPeriod: {
        start: weekStart,
        end: weekEnd,
        hoursWorked: parseFloat(totalHours.toFixed(2)),
        regularHours: parseFloat(regularHours.toFixed(2)),
        overtimeHours: parseFloat(overtimeHours.toFixed(2))
      },
      isClockedIn: !!currentEntry,
      currentTimeEntry: currentEntry,
      upcomingShifts
    });
  } catch (error) {
    console.error('Employee dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

export default router;
