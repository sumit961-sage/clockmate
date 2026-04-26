import express from 'express';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, Organization, Employee } from '../models/index.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'clockmate-dev-secret-change-in-production';

function serializeDoc(doc) {
  if (!doc) return doc;
  const s = JSON.parse(JSON.stringify(doc));
  if (s._id) s.id = s._id;
  return s;
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { email, password, firstName, lastName, orgName } = req.body;
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ error: 'Email already registered' });

    const org = new Organization({ name: orgName, slug: orgName.toLowerCase().replace(/\s+/g, '-') });
    await org.save();

    const hashed = await bcrypt.hash(password, 10);
    const user = new User({ email, password: hashed, firstName, lastName, orgId: org._id, role: 'OWNER' });
    await user.save();

    const token = jwt.sign({ userId: user._id, role: user.role, orgId: org._id }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ user: serializeDoc(user), token, org: serializeDoc(org) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ error: 'Invalid credentials' });

    const org = await Organization.findById(user.orgId);
    const token = jwt.sign({ userId: user._id, role: user.role, orgId: user.orgId }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ user: serializeDoc(user), token, org: serializeDoc(org) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/me
router.get('/me', async (req, res) => {
  try {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'No token' });
    const token = auth.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(serializeDoc(user));
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// PUT /api/auth/me
router.put('/me', async (req, res) => {
  try {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'No token' });
    const token = auth.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findByIdAndUpdate(decoded.userId, req.body, { new: true });
    res.json(serializeDoc(user));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
