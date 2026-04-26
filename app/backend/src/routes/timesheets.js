import express from 'express';
import mongoose from 'mongoose';
import { Timesheet, TimeEntry } from '../models/index.js';

const router = express.Router();

function serializeDoc(doc) {
  if (!doc) return doc;
  const s = JSON.parse(JSON.stringify(doc));
  if (s._id) s.id = s._id;
  return s;
}

// GET /api/timesheets?orgId=xxx
router.get('/', async (req, res) => {
  try {
    const { orgId } = req.query;
    if (!orgId) return res.status(400).json({ error: 'orgId required' });
    const ts = await Timesheet.find({ orgId: new mongoose.Types.ObjectId(orgId) }).sort({ createdAt: -1 }).lean();
    res.json(ts.map(t => { const d = JSON.parse(JSON.stringify(t)); d.id = d._id; return d; }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/timesheets
router.post('/', async (req, res) => {
  try {
    const t = new Timesheet(req.body);
    await t.save();
    res.status(201).json(serializeDoc(t.toObject()));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/timesheets/:id/submit
router.post('/:id/submit', async (req, res) => {
  try {
    const t = await Timesheet.findByIdAndUpdate(req.params.id, { status: 'SUBMITTED', submittedAt: new Date() }, { new: true });
    if (!t) return res.status(404).json({ error: 'Not found' });
    res.json(serializeDoc(t.toObject()));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/timesheets/:id/approve
router.post('/:id/approve', async (req, res) => {
  try {
    const { approvedBy } = req.body;
    const t = await Timesheet.findByIdAndUpdate(req.params.id, { status: 'APPROVED', approvedBy, approvedAt: new Date() }, { new: true });
    if (!t) return res.status(404).json({ error: 'Not found' });
    res.json(serializeDoc(t.toObject()));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/timesheets/:id/reject
router.post('/:id/reject', async (req, res) => {
  try {
    const { reason } = req.body;
    const t = await Timesheet.findByIdAndUpdate(req.params.id, { status: 'REJECTED', rejectionReason: reason }, { new: true });
    if (!t) return res.status(404).json({ error: 'Not found' });
    res.json(serializeDoc(t.toObject()));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/timesheets/auto-generate
router.post('/auto-generate', async (req, res) => {
  try {
    const { orgId, userId, startDate, endDate } = req.body;
    // Find entries in range and create timesheet
    const entries = await TimeEntry.find({
      orgId: new mongoose.Types.ObjectId(orgId),
      userId,
      'clockIn.time': { $gte: new Date(startDate), $lte: new Date(endDate) },
      status: { $in: ['COMPLETED', 'APPROVED'] },
    }).lean();

    const totalHours = entries.reduce((s, e) => s + (e.totalHours || 0), 0);
    const regular = entries.reduce((s, e) => s + (e.regularHours || 0), 0);
    const ot = entries.reduce((s, e) => s + (e.overtimeHours || 0), 0);

    const ts = new Timesheet({
      orgId: new mongoose.Types.ObjectId(orgId),
      userId,
      payPeriod: { start: new Date(startDate), end: new Date(endDate) },
      entries: entries.map(e => e._id),
      summary: { regularHours: regular, overtimeHours: ot, totalHours, totalPay: 0 },
      status: 'DRAFT',
    });
    await ts.save();
    res.status(201).json(serializeDoc(ts.toObject()));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
