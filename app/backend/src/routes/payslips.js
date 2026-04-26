import express from 'express';
import mongoose from 'mongoose';
import { Payslip } from '../models/index.js';

const router = express.Router();

function serializeDoc(doc) {
  if (!doc) return doc;
  const s = JSON.parse(JSON.stringify(doc));
  if (s._id) s.id = s._id;
  return s;
}

// GET /api/payslips?orgId=xxx&userId=xxx
router.get('/', async (req, res) => {
  try {
    const { orgId, userId } = req.query;
    const query = {};
    if (orgId) query.orgId = new mongoose.Types.ObjectId(orgId);
    if (userId) query.userId = userId;
    const payslips = await Payslip.find(query).sort({ payDate: -1 }).lean();
    res.json(payslips.map(p => { const d = JSON.parse(JSON.stringify(p)); d.id = d._id; return d; }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/payslips/:id
router.get('/:id', async (req, res) => {
  try {
    const p = await Payslip.findById(req.params.id).lean();
    if (!p) return res.status(404).json({ error: 'Not found' });
    res.json(serializeDoc(p));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/payslips/generate
router.post('/generate', async (req, res) => {
  try {
    const { orgId, userId, employeeId, payPeriod } = req.body;
    const p = new Payslip({ orgId: new mongoose.Types.ObjectId(orgId), userId, employeeId, payPeriod, payDate: new Date() });
    await p.save();
    res.status(201).json(serializeDoc(p.toObject()));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/payslips/:id/publish
router.put('/:id/publish', async (req, res) => {
  try {
    const p = await Payslip.findByIdAndUpdate(req.params.id, { status: 'PUBLISHED' }, { new: true });
    if (!p) return res.status(404).json({ error: 'Not found' });
    res.json(serializeDoc(p.toObject()));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
