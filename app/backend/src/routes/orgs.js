import express from 'express';
import mongoose from 'mongoose';
import { Organization, Employee, Location, Invite, LeaveType } from '../models/index.js';

const router = express.Router();

function serializeDoc(doc) {
  if (!doc) return doc;
  const s = JSON.parse(JSON.stringify(doc));
  if (s._id) s.id = s._id;
  return s;
}

// GET /api/orgs/:id
router.get('/:id', async (req, res) => {
  try {
    const org = await Organization.findById(req.params.id).lean();
    if (!org) return res.status(404).json({ error: 'Not found' });
    res.json(serializeDoc(org));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/orgs/:id
router.put('/:id', async (req, res) => {
  try {
    const org = await Organization.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!org) return res.status(404).json({ error: 'Not found' });
    res.json(serializeDoc(org));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/orgs/:id/employees
router.get('/:id/employees', async (req, res) => {
  try {
    const employees = await Employee.find({ orgId: new mongoose.Types.ObjectId(req.params.id) }).lean();
    res.json(employees.map(e => { const s = JSON.parse(JSON.stringify(e)); s.id = s._id; return s; }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/orgs/:id/locations
router.get('/:id/locations', async (req, res) => {
  try {
    const locations = await Location.find({ orgId: new mongoose.Types.ObjectId(req.params.id) }).lean();
    res.json(locations.map(l => { const s = JSON.parse(JSON.stringify(l)); s.id = s._id; return s; }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/orgs/:id/leave-types
router.get('/:id/leave-types', async (req, res) => {
  try {
    const types = await LeaveType.find({ orgId: new mongoose.Types.ObjectId(req.params.id) }).lean();
    res.json(types.map(t => { const s = JSON.parse(JSON.stringify(t)); s.id = s._id; return s; }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/orgs/:id/leave-types
router.post('/:id/leave-types', async (req, res) => {
  try {
    const lt = new LeaveType({ ...req.body, orgId: new mongoose.Types.ObjectId(req.params.id) });
    await lt.save();
    res.status(201).json(serializeDoc(lt.toObject()));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/orgs/:id/invites
router.get('/:id/invites', async (req, res) => {
  try {
    const invites = await Invite.find({ orgId: new mongoose.Types.ObjectId(req.params.id) }).lean();
    res.json(invites.map(i => { const s = JSON.parse(JSON.stringify(i)); s.id = s._id; return s; }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
