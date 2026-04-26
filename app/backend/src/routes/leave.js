import express from 'express';
import mongoose from 'mongoose';
import { LeaveRequest, LeaveBalance, LeaveType } from '../models/index.js';

const router = express.Router();

function serializeDoc(doc) {
  if (!doc) return doc;
  const s = JSON.parse(JSON.stringify(doc));
  if (s._id) s.id = s._id;
  return s;
}

// GET /api/leave/requests?orgId=xxx&userId=xxx&status=xxx
router.get('/requests', async (req, res) => {
  try {
    const { orgId, userId, status } = req.query;
    const query = {};
    if (orgId) query.orgId = new mongoose.Types.ObjectId(orgId);
    if (userId) query.userId = userId;
    if (status) query.status = status;
    const requests = await LeaveRequest.find(query).sort({ createdAt: -1 }).lean();
    res.json(requests.map(r => { const d = JSON.parse(JSON.stringify(r)); d.id = d._id; return d; }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/leave/requests
router.post('/requests', async (req, res) => {
  try {
    const lr = new LeaveRequest(req.body);
    await lr.save();
    res.status(201).json(serializeDoc(lr.toObject()));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/leave/requests/:id/approve
router.post('/requests/:id/approve', async (req, res) => {
  try {
    const lr = await LeaveRequest.findByIdAndUpdate(req.params.id, { status: 'APPROVED', approvedAt: new Date() }, { new: true });
    if (!lr) return res.status(404).json({ error: 'Not found' });
    res.json(serializeDoc(lr.toObject()));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/leave/requests/:id/reject
router.post('/requests/:id/reject', async (req, res) => {
  try {
    const { reason } = req.body;
    const lr = await LeaveRequest.findByIdAndUpdate(req.params.id, { status: 'REJECTED', rejectionReason: reason }, { new: true });
    if (!lr) return res.status(404).json({ error: 'Not found' });
    res.json(serializeDoc(lr.toObject()));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/leave/balances?userId=xxx
router.get('/balances', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId required' });
    const balances = await LeaveBalance.find({ userId }).populate('leaveTypeId').lean();
    res.json(balances.map(b => {
      const d = JSON.parse(JSON.stringify(b));
      d.id = d._id;
      if (d.leaveTypeId) { d.leaveType = d.leaveTypeId; delete d.leaveTypeId; }
      return d;
    }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
