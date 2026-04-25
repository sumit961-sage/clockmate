import express from 'express';
import TimeEntry from '../models/TimeEntry.js';
import { authenticate } from '../middleware/auth.js';
import { serializeDoc } from '../utils/response.js';

const router = express.Router();

// Helper to serialize
const s = (doc) => serializeDoc(doc);
const sa = (docs) => docs.map(d => serializeDoc(d));

// Get all time entries
router.get('/', authenticate, async (req, res) => {
  try {
    const { orgId, userId, startDate, endDate } = req.query;
    const query = {};

    if (orgId) query.orgId = orgId;
    if (userId) query.userId = userId;
    if (startDate && endDate) {
      query['clockIn.time'] = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const entries = await TimeEntry.find(query)
      .sort({ 'clockIn.time': -1 });

    res.json(sa(entries));
  } catch (error) {
    console.error('Get time entries error:', error);
    res.status(500).json({ error: 'Failed to fetch time entries' });
  }
});

// Get current active time entry for user
router.get('/current/:userId', authenticate, async (req, res) => {
  try {
    const entry = await TimeEntry.findOne({
      userId: req.params.userId,
      status: 'ACTIVE'
    });

    res.json(s(entry));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch current time entry' });
  }
});

// Clock in
router.post('/clock-in', authenticate, async (req, res) => {
  try {
    const { location, accuracy, method, withinGeofence, notes } = req.body;

    // Check if already clocked in
    const existingEntry = await TimeEntry.findOne({
      userId: req.user._id,
      status: 'ACTIVE'
    });

    if (existingEntry) {
      return res.status(400).json({ error: 'Already clocked in' });
    }

    const entry = await TimeEntry.create({
      orgId: req.user.orgId,
      userId: req.user._id,
      clockIn: {
        time: new Date(),
        location,
        accuracy,
        method: method || 'WEB',
        withinGeofence: withinGeofence !== false
      },
      breaks: [],
      status: 'ACTIVE',
      notes
    });

    res.status(201).json(s(entry));
  } catch (error) {
    console.error('Clock in error:', error);
    res.status(500).json({ error: 'Failed to clock in' });
  }
});

// Clock out
router.post('/clock-out', authenticate, async (req, res) => {
  try {
    const { location, accuracy, method, withinGeofence, notes } = req.body;

    // Find active entry
    const entry = await TimeEntry.findOne({
      userId: req.user._id,
      status: 'ACTIVE'
    });

    if (!entry) {
      return res.status(400).json({ error: 'No active time entry found' });
    }

    const clockOutTime = new Date();
    const clockInTime = new Date(entry.clockIn.time);
    const totalMs = clockOutTime - clockInTime;
    const totalHours = totalMs / (1000 * 60 * 60);

    // Calculate break hours
    let breakHours = 0;
    for (const b of entry.breaks) {
      if (b.start && b.end) {
        breakHours += ((new Date(b.end) - new Date(b.start)) / (1000 * 60 * 60));
      }
    }

    const workedHours = Math.max(0, totalHours - breakHours);
    const regularHours = Math.min(workedHours, 8);
    const overtimeHours = Math.max(0, workedHours - 8);

    entry.clockOut = {
      time: clockOutTime,
      location,
      accuracy,
      method: method || 'WEB',
      withinGeofence: withinGeofence !== false
    };
    entry.totalHours = parseFloat(workedHours.toFixed(2));
    entry.regularHours = parseFloat(regularHours.toFixed(2));
    entry.overtimeHours = parseFloat(overtimeHours.toFixed(2));
    entry.status = 'COMPLETED';
    if (notes) entry.notes = notes;

    await entry.save();

    res.json(s(entry));
  } catch (error) {
    console.error('Clock out error:', error);
    res.status(500).json({ error: 'Failed to clock out' });
  }
});

// Start break
router.post('/:entryId/break-start', authenticate, async (req, res) => {
  try {
    const { type } = req.body;
    const entry = await TimeEntry.findOne({
      _id: req.params.entryId,
      userId: req.user._id,
      status: 'ACTIVE'
    });

    if (!entry) {
      return res.status(400).json({ error: 'No active time entry found' });
    }

    entry.breaks.push({
      start: new Date(),
      type: type || 'UNPAID'
    });

    await entry.save();
    res.json(s(entry));
  } catch (error) {
    console.error('Break start error:', error);
    res.status(500).json({ error: 'Failed to start break' });
  }
});

// End break
router.post('/:entryId/break-end', authenticate, async (req, res) => {
  try {
    const entry = await TimeEntry.findOne({
      _id: req.params.entryId,
      userId: req.user._id,
      status: 'ACTIVE'
    });

    if (!entry) {
      return res.status(400).json({ error: 'No active time entry found' });
    }

    // Find the last active break (one with start but no end)
    const activeBreak = entry.breaks[entry.breaks.length - 1];
    if (!activeBreak || activeBreak.end) {
      return res.status(400).json({ error: 'No active break found' });
    }

    activeBreak.end = new Date();
    const breakDuration = (new Date(activeBreak.end) - new Date(activeBreak.start)) / (1000 * 60 * 60);
    activeBreak.duration = parseFloat(breakDuration.toFixed(2));

    await entry.save();
    res.json(s(entry));
  } catch (error) {
    console.error('Break end error:', error);
    res.status(500).json({ error: 'Failed to end break' });
  }
});

// Add comment to a time entry
router.post('/:entryId/comments', authenticate, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: 'Comment text required' });

    const entry = await TimeEntry.findById(req.params.entryId);
    if (!entry) return res.status(404).json({ error: 'Entry not found' });

    // Verify user has access (same org or admin)
    const isAdmin = ['ADMIN', 'OWNER', 'MANAGER'].includes(req.user.role);
    const isOwnEntry = entry.userId.toString() === req.user.id;
    if (entry.orgId.toString() !== req.user.orgId && !isAdmin) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const comment = {
      text: text.trim(),
      authorId: req.user.id,
      authorName: req.user.firstName ? `${req.user.firstName} ${req.user.lastName || ''}`.trim() : 'User',
      createdAt: new Date()
    };

    entry.comments.push(comment);
    await entry.save();
    res.json(s(entry));
  } catch (error) {
    console.error('Comment add error:', error);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

// Edit a time entry (manager/admin only)
router.put('/:entryId', authenticate, async (req, res) => {
  try {
    const isAdmin = ['ADMIN', 'OWNER', 'MANAGER'].includes(req.user.role);
    if (!isAdmin) return res.status(403).json({ error: 'Only managers can edit entries' });

    const entry = await TimeEntry.findById(req.params.entryId);
    if (!entry) return res.status(404).json({ error: 'Entry not found' });

    const { clockInTime, clockOutTime, breakMinutes, notes } = req.body;
    const edits = [];

    if (clockInTime && entry.clockIn?.time !== clockInTime) {
      edits.push({ field: 'clockIn', oldValue: entry.clockIn?.time, newValue: clockInTime, editedBy: req.user.id, timestamp: new Date() });
      if (!entry.clockIn) entry.clockIn = {};
      entry.clockIn.time = new Date(clockInTime);
    }
    if (clockOutTime && entry.clockOut?.time !== clockOutTime) {
      edits.push({ field: 'clockOut', oldValue: entry.clockOut?.time, newValue: clockOutTime, editedBy: req.user.id, timestamp: new Date() });
      if (!entry.clockOut) entry.clockOut = {};
      entry.clockOut.time = new Date(clockOutTime);
    }
    if (notes !== undefined && entry.notes !== notes) {
      edits.push({ field: 'notes', oldValue: entry.notes, newValue: notes, editedBy: req.user.id, timestamp: new Date() });
      entry.notes = notes;
    }

    // Recalculate hours
    if (entry.clockIn?.time && entry.clockOut?.time) {
      const diffMs = new Date(entry.clockOut.time).getTime() - new Date(entry.clockIn.time).getTime();
      const breakHrs = (breakMinutes || 0) / 60;
      const totalHrs = Math.max(0, (diffMs / (1000 * 60 * 60)) - breakHrs);
      entry.totalHours = Math.round(totalHrs * 100) / 100;
      entry.regularHours = Math.min(entry.totalHours, 8);
      entry.overtimeHours = Math.max(0, entry.totalHours - 8);
    }

    if (edits.length > 0) {
      entry.editsHistory.push(...edits);
      entry.lastEditedAt = new Date();
      entry.lastEditedBy = req.user.id;
      entry.lastEditedByName = req.user.firstName ? `${req.user.firstName} ${req.user.lastName || ''}`.trim() : 'Manager';
    }

    await entry.save();
    res.json(s(entry));
  } catch (error) {
    console.error('Edit entry error:', error);
    res.status(500).json({ error: 'Failed to edit entry' });
  }
});

export default router;
