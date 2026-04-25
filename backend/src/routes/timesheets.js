import express from 'express';
import Timesheet from '../models/Timesheet.js';
import TimeEntry from '../models/TimeEntry.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { serializeDoc } from '../utils/response.js';

const s = (doc) => serializeDoc(doc);
const sa = (docs) => docs.map(d => serializeDoc(d));

const router = express.Router();

// Get all timesheets
router.get('/', authenticate, async (req, res) => {
  try {
    const { orgId, userId, status } = req.query;
    const query = { orgId: orgId || req.user.orgId };

    if (userId) query.userId = userId;
    if (status) query.status = status;

    const timesheets = await Timesheet.find(query)
      .populate('userId', 'firstName lastName email')
      .populate('entries')
      .sort({ 'payPeriod.start': -1 });

    res.json(sa(timesheets));
  } catch (error) {
    console.error('Get timesheets error:', error);
    res.status(500).json({ error: 'Failed to fetch timesheets' });
  }
});

// Get timesheet by ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    const timesheet = await Timesheet.findById(req.params.id)
      .populate('userId', 'firstName lastName email')
      .populate('entries');

    if (!timesheet) {
      return res.status(404).json({ error: 'Timesheet not found' });
    }

    res.json(s(timesheet));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch timesheet' });
  }
});

// Create timesheet
router.post('/', authenticate, async (req, res) => {
  try {
    const { userId, payPeriod, entryIds } = req.body;

    // Calculate summary from entries
    const entries = entryIds 
      ? await TimeEntry.find({ _id: { $in: entryIds } })
      : [];
    
    const summary = entries.reduce((acc, entry) => {
      acc.regularHours += (entry.regularHours || 0);
      acc.overtimeHours += (entry.overtimeHours || 0);
      acc.totalHours += (entry.totalHours || 0);
      return acc;
    }, {
      regularHours: 0,
      overtimeHours: 0,
      doubleTimeHours: 0,
      breakHours: 0,
      totalHours: 0,
      totalPay: 0
    });

    const timesheet = await Timesheet.create({
      orgId: req.user.orgId,
      userId: userId || req.user._id,
      payPeriod: {
        start: new Date(payPeriod.start),
        end: new Date(payPeriod.end)
      },
      entries: entryIds || [],
      summary,
      status: 'DRAFT'
    });

    const populatedTimesheet = await Timesheet.findById(timesheet._id)
      .populate('userId', 'firstName lastName')
      .populate('entries');

    res.status(201).json(s(populatedTimesheet));
  } catch (error) {
    console.error('Create timesheet error:', error);
    res.status(500).json({ error: 'Failed to create timesheet' });
  }
});

// Auto-generate timesheet from time entries
router.post('/auto-generate', authenticate, async (req, res) => {
  try {
    const { userId, orgId, startDate, endDate } = req.body;
    const targetUserId = userId || req.user._id;
    const targetOrgId = orgId || req.user.orgId;

    // Find completed time entries in the date range
    const entries = await TimeEntry.find({
      orgId: targetOrgId,
      userId: targetUserId,
      status: 'COMPLETED',
      'clockIn.time': {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      }
    });

    if (entries.length === 0) {
      return res.status(400).json({ error: 'No completed time entries found for this period' });
    }

    // Calculate summary
    const summary = entries.reduce((acc, entry) => {
      acc.regularHours += (entry.regularHours || 0);
      acc.overtimeHours += (entry.overtimeHours || 0);
      acc.totalHours += (entry.totalHours || 0);
      return acc;
    }, {
      regularHours: 0,
      overtimeHours: 0,
      doubleTimeHours: 0,
      breakHours: 0,
      totalHours: 0,
      totalPay: 0
    });

    const timesheet = await Timesheet.create({
      orgId: targetOrgId,
      userId: targetUserId,
      payPeriod: {
        start: new Date(startDate),
        end: new Date(endDate)
      },
      entries: entries.map(e => e._id),
      summary,
      status: 'DRAFT'
    });

    const populatedTimesheet = await Timesheet.findById(timesheet._id)
      .populate('userId', 'firstName lastName')
      .populate('entries');

    res.status(201).json(s(populatedTimesheet));
  } catch (error) {
    console.error('Auto-generate timesheet error:', error);
    res.status(500).json({ error: 'Failed to auto-generate timesheet' });
  }
});

// Submit timesheet
router.post('/:id/submit', authenticate, async (req, res) => {
  try {
    const timesheet = await Timesheet.findByIdAndUpdate(
      req.params.id,
      { status: 'SUBMITTED', submittedAt: new Date() },
      { new: true }
    );

    if (!timesheet) {
      return res.status(404).json({ error: 'Timesheet not found' });
    }

    res.json(s(timesheet));
  } catch (error) {
    res.status(500).json({ error: 'Failed to submit timesheet' });
  }
});

// Approve timesheet
router.post('/:id/approve', authenticate, authorize('OWNER', 'ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const timesheet = await Timesheet.findByIdAndUpdate(
      req.params.id,
      {
        status: 'APPROVED',
        approvedBy: req.user._id,
        approvedAt: new Date()
      },
      { new: true }
    );

    if (!timesheet) {
      return res.status(404).json({ error: 'Timesheet not found' });
    }

    res.json(s(timesheet));
  } catch (error) {
    res.status(500).json({ error: 'Failed to approve timesheet' });
  }
});

// Reject timesheet
router.post('/:id/reject', authenticate, authorize('OWNER', 'ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const { reason } = req.body;

    const timesheet = await Timesheet.findByIdAndUpdate(
      req.params.id,
      {
        status: 'REJECTED',
        rejectionReason: reason
      },
      { new: true }
    );

    if (!timesheet) {
      return res.status(404).json({ error: 'Timesheet not found' });
    }

    res.json(s(timesheet));
  } catch (error) {
    res.status(500).json({ error: 'Failed to reject timesheet' });
  }
});

export default router;
