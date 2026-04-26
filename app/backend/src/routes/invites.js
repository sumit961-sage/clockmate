import express from 'express';
import mongoose from 'mongoose';
import { Invite, Employee, User } from '../models/index.js';
import bcrypt from 'bcryptjs';

const router = express.Router();

function serializeDoc(doc) {
  if (!doc) return doc;
  const s = JSON.parse(JSON.stringify(doc));
  if (s._id) s.id = s._id;
  return s;
}

// POST /api/invites
router.post('/', async (req, res) => {
  try {
    const invite = new Invite(req.body);
    await invite.save();
    res.status(201).json(serializeDoc(invite.toObject()));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/invites/:id/resend
router.post('/:id/resend', async (req, res) => {
  try {
    const invite = await Invite.findByIdAndUpdate(req.params.id, { expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) }, { new: true });
    if (!invite) return res.status(404).json({ error: 'Not found' });
    res.json(serializeDoc(invite.toObject()));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/invites/:id/cancel
router.post('/:id/cancel', async (req, res) => {
  try {
    await Invite.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/invites/:id/accept
router.post('/:id/accept', async (req, res) => {
  try {
    const { password } = req.body;
    const invite = await Invite.findById(req.params.id);
    if (!invite) return res.status(404).json({ error: 'Invite not found' });
    if (invite.status !== 'PENDING') return res.status(400).json({ error: 'Invite already processed' });
    if (new Date() > invite.expiresAt) return res.status(400).json({ error: 'Invite expired' });

    const hashed = await bcrypt.hash(password, 10);
    const user = new User({
      email: invite.email,
      password: hashed,
      firstName: invite.firstName,
      lastName: invite.lastName,
      orgId: invite.orgId,
      role: invite.role || 'EMPLOYEE',
    });
    await user.save();

    const employee = new Employee({
      userId: user._id.toString(),
      orgId: invite.orgId,
      employeeId: invite.employeeId,
      firstName: invite.firstName,
      lastName: invite.lastName,
      email: invite.email,
      department: invite.department,
      position: invite.position,
      employmentType: invite.employmentType,
      payRate: invite.payRate,
      payType: invite.payType,
      role: invite.role || 'EMPLOYEE',
      inviteStatus: 'JOINED',
    });
    await employee.save();

    invite.status = 'ACCEPTED';
    await invite.save();

    res.json({ success: true, user: serializeDoc(user.toObject()), employee: serializeDoc(employee.toObject()) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
