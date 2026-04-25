import express from 'express';
import Invite from '../models/Invite.js';
import Employee from '../models/Employee.js';
import User from '../models/User.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { serializeDoc } from '../utils/response.js';

const s = (doc) => serializeDoc(doc);
const sa = (docs) => docs.map(d => serializeDoc(d));

const router = express.Router();

// Get all invites for an org
router.get('/', authenticate, async (req, res) => {
  try {
    const { orgId } = req.query;
    const query = { orgId: orgId || req.user.orgId };
    
    const invites = await Invite.find(query)
      .populate('invitedBy', 'firstName lastName')
      .sort({ createdAt: -1 });

    res.json(sa(invites));
  } catch (error) {
    console.error('Get invites error:', error);
    res.status(500).json({ error: 'Failed to fetch invites' });
  }
});

// Create invite (admin/manager only)
router.post('/', authenticate, authorize('OWNER', 'ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const {
      email,
      firstName,
      lastName,
      role,
      department,
      position,
      employmentType,
      payRate,
      payType,
      employeeId
    } = req.body;

    const orgId = req.user.orgId;
    if (!orgId) {
      return res.status(400).json({ error: 'You must be in an organization to invite members' });
    }

    const lowerEmail = email.toLowerCase();

    // Check if user already exists
    const existingUser = await User.findOne({ email: lowerEmail });
    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already has an account' });
    }

    // Check if already invited
    const existingInvite = await Invite.findOne({ orgId, email: lowerEmail, status: 'PENDING' });
    if (existingInvite) {
      return res.status(400).json({ error: 'This email has already been invited' });
    }

    // Check if already an employee
    const existingEmployee = await Employee.findOne({ orgId, email: lowerEmail });
    if (existingEmployee) {
      return res.status(400).json({ error: 'This person is already a member of your organization' });
    }

    // Create invite
    const invite = await Invite.create({
      orgId,
      email: lowerEmail,
      firstName,
      lastName,
      role: role || 'EMPLOYEE',
      department: department || 'General',
      position: position || 'Employee',
      employmentType: employmentType || 'FULL_TIME',
      payRate: payRate || 25,
      payType: payType || 'HOURLY',
      employeeId,
      invitedBy: req.user._id
    });

    // Also create an employee record with INVITED status
    const employeeCount = await Employee.countDocuments({ orgId });
    await Employee.create({
      orgId,
      userId: null, // Will be linked when user joins
      employeeId: employeeId || `EMP${String(employeeCount + 1).padStart(3, '0')}`,
      firstName,
      lastName,
      email: lowerEmail,
      department: department || 'General',
      position: position || 'Employee',
      employmentType: employmentType || 'FULL_TIME',
      payRate: payRate || 25,
      payType: payType || 'HOURLY',
      inviteStatus: 'INVITED'
    });

    const populatedInvite = await Invite.findById(invite._id)
      .populate('invitedBy', 'firstName lastName');

    res.status(201).json(s(populatedInvite));
  } catch (error) {
    console.error('Create invite error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ error: 'This email has already been invited to this organization' });
    }
    res.status(500).json({ error: 'Failed to create invite' });
  }
});

// Cancel invite
router.delete('/:id', authenticate, authorize('OWNER', 'ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const invite = await Invite.findById(req.params.id);
    if (!invite) {
      return res.status(404).json({ error: 'Invite not found' });
    }

    // Also remove the INVITED employee record
    await Employee.deleteOne({
      orgId: invite.orgId,
      email: invite.email,
      inviteStatus: 'INVITED'
    });

    await Invite.findByIdAndDelete(req.params.id);
    res.json({ message: 'Invite cancelled' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to cancel invite' });
  }
});

export default router;
