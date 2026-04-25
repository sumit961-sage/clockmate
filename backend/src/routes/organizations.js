import express from 'express';
import Organization from '../models/Organization.js';
import User from '../models/User.js';
import Employee from '../models/Employee.js';
import Location from '../models/Location.js';
import LeaveType from '../models/LeaveType.js';
import LeaveBalance from '../models/LeaveBalance.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { serializeDoc } from '../utils/response.js';

const s = (doc) => serializeDoc(doc);
const sa = (docs) => docs.map(d => serializeDoc(d));

const router = express.Router();

// Get all organizations for current user
router.get('/', authenticate, async (req, res) => {
  try {
    // For now, return the user's organization
    const org = await Organization.findById(req.user.orgId);
    if (!org) {
      return res.json([]);
    }

    res.json([{
      id: org._id.toString(),
      name: org.name,
      slug: org.slug,
      role: req.user.role,
      plan: org.subscription.plan,
      location: org.location,
      timezone: org.timezone,
      currency: org.currency
    }]);
  } catch (error) {
    console.error('Get orgs error:', error);
    res.status(500).json({ error: 'Failed to fetch organizations' });
  }
});

// Create organization
router.post('/', authenticate, async (req, res) => {
  try {
    const { name, plan, location, type, industry } = req.body;

    const org = await Organization.create({
      name,
      slug: name.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now(),
      location,
      type,
      industry,
      subscription: {
        plan: plan || 'STARTER',
        status: 'ACTIVE',
        maxUsers: plan === 'STARTER' ? 5 : plan === 'TEAM' ? 25 : 100
      }
    });

    // Update user's org - creator is always OWNER
    req.user.orgId = org._id;
    req.user.role = 'OWNER';
    await req.user.save();

    // Create default location
    await Location.create({
      orgId: org._id,
      name: 'Main Office',
      address: location || 'TBD',
      coordinates: { lat: -33.8688, lng: 151.2093 },
      geofence: {
        type: 'CIRCLE',
        center: { lat: -33.8688, lng: 151.2093 },
        radius: 100
      }
    });

    // Create default leave types
    const leaveTypes = await LeaveType.insertMany([
      {
        orgId: org._id,
        name: 'Annual Leave',
        type: 'ANNUAL',
        color: '#22c55e',
        isPaid: true,
        accrualRule: { type: 'FIXED', amount: 20, period: 'YEARLY' }
      },
      {
        orgId: org._id,
        name: 'Sick Leave',
        type: 'SICK',
        color: '#ef4444',
        isPaid: true,
        accrualRule: { type: 'FIXED', amount: 10, period: 'YEARLY' }
      },
      {
        orgId: org._id,
        name: 'Personal Leave',
        type: 'PERSONAL',
        color: '#f59e0b',
        isPaid: true,
        accrualRule: { type: 'FIXED', amount: 3, period: 'YEARLY' }
      }
    ]);

    // Create leave balances for user
    const currentYear = new Date().getFullYear();
    await LeaveBalance.insertMany(
      leaveTypes.map(lt => ({
        orgId: org._id,
        userId: req.user._id,
        leaveTypeId: lt._id,
        entitlementDays: lt.accrualRule.amount,
        usedDays: 0,
        pendingDays: 0,
        carriedOverDays: 0,
        year: currentYear
      }))
    );

    res.status(201).json({
      id: org._id.toString(),
      name: org.name,
      slug: org.slug,
      plan: org.subscription.plan,
      role: 'OWNER'
    });
  } catch (error) {
    console.error('Create org error:', error);
    res.status(500).json({ error: 'Failed to create organization' });
  }
});

// Get organization by ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    const org = await Organization.findById(req.params.id);
    if (!org) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    res.json({
      id: org._id,
      name: org.name,
      slug: org.slug,
      timezone: org.timezone,
      currency: org.currency,
      settings: org.settings,
      subscription: org.subscription,
      branding: org.branding
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch organization' });
  }
});

// Update organization
router.put('/:id', authenticate, authorize('OWNER', 'ADMIN'), async (req, res) => {
  try {
    const updates = req.body;
    const org = await Organization.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true }
    );

    if (!org) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    res.json(org);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update organization' });
  }
});

// Update timesheet settings
router.put('/:id/timesheet-settings', authenticate, authorize('OWNER', 'ADMIN'), async (req, res) => {
  try {
    const { timesheetSettings } = req.body;
    const org = await Organization.findByIdAndUpdate(
      req.params.id,
      { $set: { 'settings.timesheetSettings': timesheetSettings } },
      { new: true }
    );
    if (!org) return res.status(404).json({ error: 'Organization not found' });
    res.json(s(org));
  } catch (error) {
    res.status(500).json({ error: 'Failed to update timesheet settings' });
  }
});

export default router;
