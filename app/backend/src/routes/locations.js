import express from 'express';
import mongoose from 'mongoose';
import { Location } from '../models/index.js';

const router = express.Router();

function serializeDoc(doc) {
  if (!doc) return doc;
  const s = JSON.parse(JSON.stringify(doc));
  if (s._id) s.id = s._id;
  return s;
}

// GET /api/locations?orgId=xxx
router.get('/', async (req, res) => {
  try {
    const { orgId } = req.query;
    if (!orgId) return res.status(400).json({ error: 'orgId required' });
    const locations = await Location.find({ orgId: new mongoose.Types.ObjectId(orgId), isActive: { $ne: false } }).lean();
    res.json(locations.map(l => { const d = JSON.parse(JSON.stringify(l)); d.id = d._id; return d; }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/locations
router.post('/', async (req, res) => {
  try {
    const loc = new Location(req.body);
    await loc.save();
    res.status(201).json(serializeDoc(loc.toObject()));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/locations/:id
router.put('/:id', async (req, res) => {
  try {
    const loc = await Location.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!loc) return res.status(404).json({ error: 'Not found' });
    res.json(serializeDoc(loc.toObject()));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/locations/:id
router.delete('/:id', async (req, res) => {
  try {
    await Location.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
