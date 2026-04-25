import express from 'express';
import LeaveType from '../models/LeaveType.js';
import LeaveBalance from '../models/LeaveBalance.js';
import LeaveRequest from '../models/LeaveRequest.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { serializeDoc } from '../utils/response.js';

const s = (doc) => serializeDoc(doc);
const sa = (docs) => docs.map(d => serializeDoc(d));

const router = express.Router();

// Get all leave types for org
router.get('/types', authenticate, async (req, res) => {
  try {
    const { orgId } = req.query;
    const types = await LeaveType.find({ orgId: orgId || req.user.orgId });
    res.json(sa(types));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch leave types' });
  }
});

// Create leave type
router.post('/types', authenticate, authorize('OWNER', 'ADMIN'), async (req, res) => {
  try {
    const leaveType = await LeaveType.create({
      orgId: req.user.orgId,
      ...req.body
    });
    res.status(201).json(s(leaveType));
  } catch (error) {
    res.status(500).json({ error: 'Failed to create leave type' });
  }
});

// Get leave balances for user
router.get('/balances/:userId', authenticate, async (req, res) => {
  try {
    const currentYear = new Date().getFullYear();
    const balances = await LeaveBalance.find({
      userId: req.params.userId,
      year: currentYear
    }).populate('leaveTypeId');

    // Serialize and calculate available days
    const serializedBalances = balances.map(b => {
      const obj = b.toObject ? b.toObject() : b;
      const leaveType = obj.leaveTypeId;
      
      const result = {};
      for (const [key, value] of Object.entries(obj)) {
        if (key === '_id') {
          result.id = value.toString();
        } else if (key === '__v') {
          continue;
        } else if (key === 'leaveTypeId' && value) {
          // Serialize nested leave type
          result.leaveType = s(leaveType);
          result.leaveTypeId = value._id ? value._id.toString() : value.toString();
        } else if (value instanceof Date) {
          result[key] = value.toISOString();
        } else if (typeof value === 'object' && value !== null && value._id) {
          result[key] = s(value);
        } else {
          result[key] = value;
        }
      }
      
      result.availableDays = (result.entitlementDays || 0) + (result.carriedOverDays || 0) - (result.usedDays || 0) - (result.pendingDays || 0);
      return result;
    });

    res.json(serializedBalances);
  } catch (error) {
    console.error('Get leave balances error:', error);
    res.status(500).json({ error: 'Failed to fetch leave balances' });
  }
});

// Get all leave requests
router.get('/requests', authenticate, async (req, res) => {
  try {
    const { orgId, userId, status } = req.query;
    const query = { orgId: orgId || req.user.orgId };

    if (userId) query.userId = userId;
    if (status) query.status = status;

    const requests = await LeaveRequest.find(query)
      .populate('userId', 'firstName lastName email')
      .populate('leaveTypeId')
      .sort({ createdAt: -1 });

    res.json(sa(requests));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch leave requests' });
  }
});

// Create leave request
router.post('/requests', authenticate, async (req, res) => {
  try {
    const { leaveTypeId, startDate, endDate, duration, days, reason } = req.body;

    // Check if enough balance
    const currentYear = new Date().getFullYear();
    const balance = await LeaveBalance.findOne({
      userId: req.user._id,
      leaveTypeId,
      year: currentYear
    });

    if (balance) {
      const availableDays = balance.entitlementDays + balance.carriedOverDays - balance.usedDays - balance.pendingDays;
      if (availableDays < days) {
        return res.status(400).json({ error: 'Insufficient leave balance' });
      }

      // Update pending days
      balance.pendingDays += days;
      await balance.save();
    }

    const request = await LeaveRequest.create({
      orgId: req.user.orgId,
      userId: req.user._id,
      leaveTypeId,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      duration: duration || 'FULL',
      days,
      reason,
      status: 'PENDING'
    });

    const populatedRequest = await LeaveRequest.findById(request._id)
      .populate('userId', 'firstName lastName')
      .populate('leaveTypeId');

    res.status(201).json(s(populatedRequest));
  } catch (error) {
    console.error('Create leave request error:', error);
    res.status(500).json({ error: 'Failed to create leave request' });
  }
});

// Approve leave request
router.post('/requests/:id/approve', authenticate, authorize('OWNER', 'ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const request = await LeaveRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ error: 'Leave request not found' });
    }

    // Update balance
    const currentYear = new Date().getFullYear();
    const balance = await LeaveBalance.findOne({
      userId: request.userId,
      leaveTypeId: request.leaveTypeId,
      year: currentYear
    });

    if (balance) {
      balance.pendingDays -= request.days;
      balance.usedDays += request.days;
      await balance.save();
    }

    request.status = 'APPROVED';
    request.approvedBy = req.user._id;
    request.approvedAt = new Date();
    await request.save();

    const populatedRequest = await LeaveRequest.findById(request._id)
      .populate('userId', 'firstName lastName')
      .populate('leaveTypeId');

    res.json(s(populatedRequest));
  } catch (error) {
    res.status(500).json({ error: 'Failed to approve leave request' });
  }
});

// Reject leave request
router.post('/requests/:id/reject', authenticate, authorize('OWNER', 'ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const { reason } = req.body;
    const request = await LeaveRequest.findById(req.params.id);

    if (!request) {
      return res.status(404).json({ error: 'Leave request not found' });
    }

    // Restore balance
    const currentYear = new Date().getFullYear();
    const balance = await LeaveBalance.findOne({
      userId: request.userId,
      leaveTypeId: request.leaveTypeId,
      year: currentYear
    });

    if (balance) {
      balance.pendingDays -= request.days;
      await balance.save();
    }

    request.status = 'REJECTED';
    request.rejectionReason = reason;
    await request.save();

    const populatedRequest = await LeaveRequest.findById(request._id)
      .populate('userId', 'firstName lastName')
      .populate('leaveTypeId');

    res.json(s(populatedRequest));
  } catch (error) {
    res.status(500).json({ error: 'Failed to reject leave request' });
  }
});

export default router;
