import express from 'express';
import { body, validationResult } from 'express-validator';
import User from '../models/User.js';
import Employee from '../models/Employee.js';
import Organization from '../models/Organization.js';
import LeaveType from '../models/LeaveType.js';
import LeaveBalance from '../models/LeaveBalance.js';
import { generateToken } from '../middleware/auth.js';

const router = express.Router();

// Register
router.post('/register', [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, password } = req.body;
    const [firstName, ...lastNameParts] = name.split(' ');
    const lastName = lastNameParts.join(' ') || '';
    const lowerEmail = email.toLowerCase();

    // Check if email exists
    const existingUser = await User.findOne({ email: lowerEmail });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Check for pending invite
    const { default: Invite } = await import('../models/Invite.js');
    const pendingInvite = await Invite.findOne({
      email: lowerEmail,
      status: 'PENDING',
      expiresAt: { $gt: new Date() }
    });

    let orgId = null;
    let role = 'EMPLOYEE';

    // If invited, link to that org
    if (pendingInvite) {
      orgId = pendingInvite.orgId;
      role = pendingInvite.role;

      // Mark invite as accepted
      pendingInvite.status = 'ACCEPTED';
      await pendingInvite.save();
    }

    // Create user (no org if not invited)
    const user = await User.create({
      email: lowerEmail,
      password,
      firstName,
      lastName,
      role,
      orgId
    });

    // If invited, create employee record and leave balances
    if (pendingInvite) {
      const employeeCount = await Employee.countDocuments({ orgId: pendingInvite.orgId });
      await Employee.create({
        userId: user._id,
        orgId: pendingInvite.orgId,
        employeeId: pendingInvite.employeeId || `EMP${String(employeeCount + 1).padStart(3, '0')}`,
        firstName,
        lastName,
        email: lowerEmail,
        department: pendingInvite.department,
        position: pendingInvite.position,
        employmentType: pendingInvite.employmentType,
        payRate: pendingInvite.payRate,
        payType: pendingInvite.payType,
        inviteStatus: 'JOINED'
      });

      // Create leave balances
      const leaveTypes = await LeaveType.find({ orgId: pendingInvite.orgId });
      const currentYear = new Date().getFullYear();
      await LeaveBalance.insertMany(
        leaveTypes.map(lt => ({
          orgId: pendingInvite.orgId,
          userId: user._id,
          leaveTypeId: lt._id,
          entitlementDays: lt.accrualRule.amount,
          usedDays: 0,
          pendingDays: 0,
          carriedOverDays: 0,
          year: currentYear
        }))
      );
    }

    const token = generateToken(user._id);

    res.status(201).json({
      accessToken: token,
      user: {
        id: user._id.toString(),
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        orgId: user.orgId ? user.orgId.toString() : null,
        hasOrg: !!user.orgId
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Helper: Get effective role (from Employee record if available)
async function getEffectiveRole(user) {
  if (!user.orgId) return user.role;
  try {
    const employee = await Employee.findOne({ orgId: user.orgId, userId: user._id });
    if (employee && employee.role) {
      return employee.role;
    }
  } catch (err) {
    console.warn('Role sync failed:', err.message);
  }
  return user.role;
}

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isValidPassword = await user.comparePassword(password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    const token = generateToken(user._id);

    // ═══ Use Employee role if available (role may have been changed via Employee edit) ═══
    const effectiveRole = await getEffectiveRole(user);

    res.json({
      accessToken: token,
      user: {
        id: user._id.toString(),
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: effectiveRole,
        orgId: user.orgId ? user.orgId.toString() : null
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get current user
router.get('/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const jwt = await import('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
    const decoded = jwt.default.verify(token, JWT_SECRET);
    
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // ═══ Use Employee role if available ═══
    const effectiveRole = await getEffectiveRole(user);

    res.json({
      id: user._id.toString(),
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: effectiveRole,
      orgId: user.orgId ? user.orgId.toString() : null,
      settings: user.settings
    });
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

export default router;
