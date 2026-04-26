import express from 'express';
import mongoose from 'mongoose';
import { Shift, Template } from '../models/index.js';

const router = express.Router();

function serializeDoc(doc) {
  if (!doc) return doc;
  const s = JSON.parse(JSON.stringify(doc));
  if (s._id) s.id = s._id;
  return s;
}

// GET /api/shifts?orgId=xxx&startDate=xxx&endDate=xxx
// Uses overlap detection: finds shifts that intersect with the date range.
// A shift overlaps if: shift.start <= range.end AND shift.end >= range.start
router.get('/', async (req, res) => {
  try {
    const { orgId, startDate, endDate, assignedTo, locationId } = req.query;
    const query = {};
    if (orgId) query.orgId = new mongoose.Types.ObjectId(orgId);
    if (locationId) query.locationId = new mongoose.Types.ObjectId(locationId);

    // Robust overlap query
    if (startDate && endDate) {
      const rangeStart = new Date(startDate);
      const rangeEnd = new Date(endDate);
      // Shift overlaps if it starts before range ends AND ends after range starts
      query.$and = [
        { startTime: { $lte: rangeEnd } },
        { endTime: { $gte: rangeStart } }
      ];
    } else if (startDate) {
      query.startTime = { $gte: new Date(startDate) };
    } else if (endDate) {
      query.endTime = { $lte: new Date(endDate) };
    }

    if (assignedTo) query.assignedTo = { $in: [assignedTo] };

    const shifts = await Shift.find(query).sort({ startTime: 1 }).lean();
    res.json(shifts.map(s => { const d = JSON.parse(JSON.stringify(s)); d.id = d._id; return d; }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/shifts
router.post('/', async (req, res) => {
  try {
    const shift = new Shift(req.body);
    await shift.save();
    res.status(201).json(serializeDoc(shift.toObject()));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/shifts/:id
router.put('/:id', async (req, res) => {
  try {
    const shift = await Shift.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!shift) return res.status(404).json({ error: 'Not found' });
    res.json(serializeDoc(shift.toObject()));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/shifts/:id
router.delete('/:id', async (req, res) => {
  try {
    await Shift.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/shifts/templates?orgId=xxx
router.get('/templates', async (req, res) => {
  try {
    const { orgId } = req.query;
    const templates = await Template.find({ orgId: new mongoose.Types.ObjectId(orgId) }).lean();
    res.json(templates.map(t => { const d = JSON.parse(JSON.stringify(t)); d.id = d._id; return d; }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/shifts/templates
router.post('/templates', async (req, res) => {
  try {
    const t = new Template(req.body);
    await t.save();
    res.status(201).json(serializeDoc(t.toObject()));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
