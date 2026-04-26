import express from 'express';
import mongoose from 'mongoose';
import { Employee, Organization, Location } from '../models/index.js';

const router = express.Router();

function serializeDoc(doc) {
  if (!doc) return doc;
  const s = JSON.parse(JSON.stringify(doc));
  if (s._id) s.id = s._id;
  if (s.orgId?._id) s.orgId = s.orgId._id.toString();
  return s;
}
function serializeDocs(docs) { return (docs || []).map(serializeDoc); }

// GET /api/employees?orgId=xxx
router.get('/', async (req, res) => {
  try {
    const { orgId } = req.query;
    if (!orgId) return res.status(400).json({ error: 'orgId required' });
    const employees = await Employee.find({ orgId: new mongoose.Types.ObjectId(orgId) }).lean();
    res.json(serializeDocs(employees));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/employees/:id
router.get('/:id', async (req, res) => {
  try {
    const emp = await Employee.findById(req.params.id).lean();
    if (!emp) return res.status(404).json({ error: 'Not found' });
    res.json(serializeDoc(emp));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/employees
router.post('/', async (req, res) => {
  try {
    const emp = new Employee(req.body);
    await emp.save();
    res.status(201).json(serializeDoc(emp.toObject()));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/employees/:id
router.put('/:id', async (req, res) => {
  try {
    const emp = await Employee.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!emp) return res.status(404).json({ error: 'Not found' });
    res.json(serializeDoc(emp.toObject()));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/employees/:id
router.delete('/:id', async (req, res) => {
  try {
    await Employee.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
