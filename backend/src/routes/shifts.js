import express from 'express';
import Shift from '../models/Shift.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { serializeDoc } from '../utils/response.js';

const s = (doc) => serializeDoc(doc);
const sa = (docs) => docs.map(d => serializeDoc(d));

const router = express.Router();

function sanitizeObjectId(value) {
  if (!value || value === '' || value === 'null' || value === 'undefined') return null;
  return value;
}

function extractIds(assignedTo) {
  if (!Array.isArray(assignedTo)) return [];
  return assignedTo.map(item => {
    if (typeof item === 'string') return item;
    if (item && typeof item === 'object') return item.id || item._id || item.userId || null;
    return null;
  }).filter(id => id && id !== 'null' && id !== 'undefined');
}

// Get all shifts
router.get('/', authenticate, async (req, res) => {
  try {
    const { orgId, startDate, endDate, locationId } = req.query;
    const query = { orgId: orgId || req.user.orgId };
    if (startDate && endDate) {
      query.startTime = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }
    if (locationId) query.locationId = locationId;
    const shifts = await Shift.find(query)
      .populate('locationId', 'name address')
      .populate('assignedTo', 'firstName lastName email')
      .sort({ startTime: 1 });
    res.json(sa(shifts));
  } catch (error) {
    console.error('Get shifts error:', error);
    res.status(500).json({ error: 'Failed to fetch shifts' });
  }
});

// Create shift with conflict check
router.post('/', authenticate, authorize('OWNER', 'ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const { locationId, title, description, assignedTo, startTime, endTime,
      timezone, type, status, requiredSkills, recurrence, breaks, department,
      color, notes, requiredRoles, payModifiers } = req.body;

    const sanitizedLocationId = sanitizeObjectId(locationId);
    const sanitizedAssignedTo = extractIds(assignedTo || []);
    const start = new Date(startTime);
    const end = new Date(endTime);

    // Check for conflicts per employee
    const conflicts = [];
    for (const userId of sanitizedAssignedTo) {
      const existing = await Shift.findOne({
        orgId: req.user.orgId,
        assignedTo: userId,
        status: { $nin: ['CANCELLED'] },
        $or: [
          { startTime: { $lt: end, $gte: start } },
          { endTime: { $gt: start, $lte: end } },
          { startTime: { $lte: start }, endTime: { $gte: end } }
        ]
      });
      if (existing) {
        conflicts.push(`Employee already has "${existing.title}" from ${existing.startTime.toLocaleTimeString()} to ${existing.endTime.toLocaleTimeString()}`);
      }
    }

    const shiftData = {
      orgId: req.user.orgId,
      title,
      description: description || '',
      assignedTo: sanitizedAssignedTo,
      startTime: start,
      endTime: end,
      timezone: timezone || 'Australia/Sydney',
      type: type || 'REGULAR',
      status: status || 'SCHEDULED',
      requiredSkills: requiredSkills || [],
      recurrence: recurrence || undefined,
      breaks: breaks || [],
      department: department || 'General',
      color: color || '#3b82f6',
      notes: notes || '',
      requiredRoles: requiredRoles || [],
      payModifiers: payModifiers || [],
      createdBy: req.user._id,
    };
    if (sanitizedLocationId) shiftData.locationId = sanitizedLocationId;

    const shift = await Shift.create(shiftData);
    const populatedShift = await Shift.findById(shift._id)
      .populate('locationId', 'name address')
      .populate('assignedTo', 'firstName lastName email');

    res.status(201).json(s(populatedShift));
  } catch (error) {
    console.error('Create shift error:', error);
    res.status(500).json({ error: 'Failed to create shift: ' + error.message });
  }
});

// Update shift
router.put('/:id', authenticate, authorize('OWNER', 'ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const { locationId, assignedTo } = req.body;
    const sanitizedLocationId = sanitizeObjectId(locationId);
    const sanitizedAssignedTo = assignedTo ? extractIds(assignedTo) : undefined;
    const updateData = { ...req.body };
    if (sanitizedLocationId) updateData.locationId = sanitizedLocationId;
    else delete updateData.locationId;
    if (sanitizedAssignedTo !== undefined) updateData.assignedTo = sanitizedAssignedTo;
    delete updateData._repeatCount;
    delete updateData._repeatFrequency;

    const shift = await Shift.findByIdAndUpdate(req.params.id, updateData, { new: true })
      .populate('locationId', 'name address')
      .populate('assignedTo', 'firstName lastName email');
    if (!shift) return res.status(404).json({ error: 'Shift not found' });
    res.json(s(shift));
  } catch (error) {
    console.error('Update shift error:', error);
    res.status(500).json({ error: 'Failed to update shift: ' + error.message });
  }
});

// Assign employee
router.put('/:id/assign', authenticate, authorize('OWNER', 'ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId required' });
    const shift = await Shift.findById(req.params.id);
    if (!shift) return res.status(404).json({ error: 'Shift not found' });
    const existingShifts = await Shift.find({
      orgId: shift.orgId, assignedTo: userId, status: { $nin: ['CANCELLED'] }, _id: { $ne: shift._id },
      $or: [
        { startTime: { $lt: shift.endTime, $gte: shift.startTime } },
        { endTime: { $gt: shift.startTime, $lte: shift.endTime } },
        { startTime: { $lte: shift.startTime }, endTime: { $gte: shift.endTime } }
      ]
    });
    if (existingShifts.length > 0) {
      return res.status(400).json({
        error: 'Employee already assigned during this time',
        conflicts: existingShifts.map(s => ({ id: s._id.toString(), title: s.title, startTime: s.startTime, endTime: s.endTime }))
      });
    }
    if (!shift.assignedTo.includes(userId)) { shift.assignedTo.push(userId); await shift.save(); }
    const populatedShift = await Shift.findById(shift._id)
      .populate('locationId', 'name address')
      .populate('assignedTo', 'firstName lastName email');
    res.json(s(populatedShift));
  } catch (error) {
    console.error('Assign shift error:', error);
    res.status(500).json({ error: 'Failed to assign employee' });
  }
});

// Unassign employee
router.put('/:id/unassign', authenticate, authorize('OWNER', 'ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const { userId } = req.body;
    const shift = await Shift.findById(req.params.id);
    if (!shift) return res.status(404).json({ error: 'Shift not found' });
    shift.assignedTo = shift.assignedTo.filter(id => id.toString() !== userId);
    await shift.save();
    const populatedShift = await Shift.findById(shift._id)
      .populate('locationId', 'name address')
      .populate('assignedTo', 'firstName lastName email');
    res.json(s(populatedShift));
  } catch (error) {
    res.status(500).json({ error: 'Failed to unassign employee' });
  }
});

// Delete shift
router.delete('/:id', authenticate, authorize('OWNER', 'ADMIN', 'MANAGER'), async (req, res) => {
  try { await Shift.findByIdAndDelete(req.params.id); res.json({ message: 'Shift deleted' }); }
  catch (error) { res.status(500).json({ error: 'Failed to delete shift' }); }
});

export default router;
