import express from 'express';
import mongoose from 'mongoose';
import { haversineDistance, findNearestLocation } from '../utils/geo.js';
import { TimeEntry, Employee, Location } from '../models/index.js';

const router = express.Router();

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------
function serializeDoc(doc) {
  if (!doc) return doc;
  const serialized = JSON.parse(JSON.stringify(doc));
  if (serialized._id) serialized.id = serialized._id;
  if (serialized.userId?._id) {
    serialized.userId =
      typeof serialized.userId === 'object'
        ? serialized.userId._id.toString()
        : serialized.userId;
  }
  return serialized;
}

function serializeDocs(docs) {
  return (docs || []).map(serializeDoc);
}

// ------------------------------------------------------------------
// GET /api/time-entries  (list with filters)
// ------------------------------------------------------------------
router.get('/', async (req, res) => {
  try {
    const { orgId, userId, startDate, endDate, status, locationId } = req.query;
    const query = {};
    if (orgId) query.orgId = new mongoose.Types.ObjectId(orgId);
    if (userId) query.userId = userId;
    if (status) query.status = status;
    if (locationId) query['clockIn.matchedLocationId'] = locationId;

    if (startDate || endDate) {
      query['clockIn.time'] = {};
      if (startDate) query['clockIn.time'].$gte = new Date(startDate);
      if (endDate) query['clockIn.time'].$lte = new Date(endDate);
    }

    const entries = await TimeEntry.find(query).sort({ 'clockIn.time': -1 }).limit(500);
    res.json(serializeDocs(entries));
  } catch (err) {
    console.error('[timeEntries] list error:', err);
    res.status(500).json({ error: err.message || 'Failed to list entries' });
  }
});

// ------------------------------------------------------------------
// GET /api/time-entries/current/:userId
// ------------------------------------------------------------------
router.get('/current/:userId', async (req, res) => {
  try {
    const entry = await TimeEntry.findOne({
      userId: req.params.userId,
      status: 'ACTIVE',
    }).sort({ createdAt: -1 });
    if (!entry) return res.status(404).json({ error: 'No active entry' });
    res.json(serializeDoc(entry.toObject()));
  } catch (err) {
    console.error('[timeEntries] get current error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ------------------------------------------------------------------
// GET /api/time-entries/:id
// ------------------------------------------------------------------
router.get('/:id', async (req, res) => {
  try {
    const entry = await TimeEntry.findById(req.params.id);
    if (!entry) return res.status(404).json({ error: 'Not found' });
    res.json(serializeDoc(entry.toObject()));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ------------------------------------------------------------------
// POST /api/time-entries/clock-in
// ------------------------------------------------------------------
router.post('/clock-in', async (req, res) => {
  try {
    const { orgId, userId, location, accuracy, method, notes, photoBase64 } = req.body;

    if (!orgId || !userId) {
      return res.status(400).json({ error: 'orgId and userId are required' });
    }

    // Find employee's default location(s)
    const employee = await Employee.findOne({ orgId: new mongoose.Types.ObjectId(orgId), userId }).lean();
    let locations = [];
    if (employee?.locations?.length) {
      locations = await Location.find({
        _id: { $in: employee.locations },
        isActive: { $ne: false },
      }).lean();
    }
    if (locations.length === 0) {
      locations = await Location.find({ orgId: new mongoose.Types.ObjectId(orgId), isActive: { $ne: false } }).lean();
    }

    // Server-side geofence check
    let geofenceStatus = 'INSIDE';
    let geofenceDistance = null;
    let matchedLocation = null;

    if (location?.lat != null && location?.lng != null && locations.length > 0) {
      const { location: nearest, distance } = findNearestLocation(location.lat, location.lng, locations);
      if (nearest) {
        matchedLocation = nearest;
        geofenceDistance = distance;
        const radius = nearest.geofence?.radius || 200;
        if (distance > radius) {
          geofenceStatus = 'GEOFENCE_OVERRIDE';
        }
      }
    }

    const clockInPayload = {
      time: new Date().toISOString(),
      location: location ? { lat: location.lat, lng: location.lng, accuracy } : undefined,
      method: method || 'WEB',
      deviceInfo: req.headers['user-agent'],
      geofenceStatus,
      geofenceDistance,
      matchedLocationId: matchedLocation?._id?.toString(),
      photoBase64: photoBase64 || undefined,
    };

    const entry = new TimeEntry({
      orgId: new mongoose.Types.ObjectId(orgId),
      userId,
      clockIn: clockInPayload,
      status: 'ACTIVE',
      notes: notes || undefined,
      source: method || 'WEB',
    });
    await entry.save();

    res.status(201).json(serializeDoc(entry.toObject()));
  } catch (err) {
    console.error('[timeEntries] clock-in error:', err);
    res.status(500).json({ error: err.message || 'Clock-in failed' });
  }
});

// ------------------------------------------------------------------
// POST /api/time-entries/clock-out
// ------------------------------------------------------------------
router.post('/clock-out', async (req, res) => {
  try {
    const { entryId, location, accuracy, method, notes } = req.body;
    if (!entryId) {
      return res.status(400).json({ error: 'entryId is required' });
    }

    const entry = await TimeEntry.findById(entryId);
    if (!entry) return res.status(404).json({ error: 'Time entry not found' });

    let geofenceStatus = entry.clockIn?.geofenceStatus || 'INSIDE';
    let geofenceDistance = entry.clockIn?.geofenceDistance || null;

    if (location?.lat != null && location?.lng != null && entry.clockIn?.matchedLocationId) {
      const matchedLoc = await Location.findById(entry.clockIn.matchedLocationId).lean();
      if (matchedLoc?.coordinates) {
        const distance = haversineDistance(
          location.lat,
          location.lng,
          matchedLoc.coordinates.lat,
          matchedLoc.coordinates.lng
        );
        geofenceDistance = distance;
        const radius = matchedLoc.geofence?.radius || 200;
        if (distance > radius) {
          geofenceStatus = 'GEOFENCE_OVERRIDE';
        }
      }
    }

    const clockInTime = new Date(entry.clockIn.time);
    const clockOutTime = new Date();
    let totalMs = clockOutTime.getTime() - clockInTime.getTime();

    let breakMs = 0;
    for (const b of (entry.breaks || [])) {
      if (b.start && b.end) {
        breakMs += new Date(b.end).getTime() - new Date(b.start).getTime();
      }
    }
    totalMs = Math.max(0, totalMs - breakMs);
    const totalHours = totalMs / (1000 * 60 * 60);

    entry.clockOut = {
      time: clockOutTime.toISOString(),
      location: location ? { lat: location.lat, lng: location.lng, accuracy } : undefined,
      method: method || 'WEB',
      geofenceStatus,
      geofenceDistance,
    };
    entry.status = 'COMPLETED';
    entry.totalHours = totalHours;
    entry.regularHours = Math.min(totalHours, 8);
    entry.overtimeHours = Math.max(0, totalHours - 8);
    if (notes) entry.notes = notes;
    await entry.save();

    res.status(200).json(serializeDoc(entry.toObject()));
  } catch (err) {
    console.error('[timeEntries] clock-out error:', err);
    res.status(500).json({ error: err.message || 'Clock-out failed' });
  }
});

// ------------------------------------------------------------------
// GET /api/time-entries/pending-manual?orgId=xxx
// ------------------------------------------------------------------
router.get('/pending-manual', async (req, res) => {
  try {
    const { orgId } = req.query;
    if (!orgId) return res.status(400).json({ error: 'orgId required' });
    const entries = await TimeEntry.find({
      orgId: new mongoose.Types.ObjectId(orgId),
      status: 'PENDING',
      source: 'MANUAL',
    }).sort({ createdAt: -1 }).lean();
    res.json(serializeDocs(entries));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ------------------------------------------------------------------
// POST /api/time-entries/manual
// ------------------------------------------------------------------
router.post('/manual', async (req, res) => {
  try {
    const { orgId, userId, clockInTime, clockOutTime, notes, reason, status } = req.body;
    if (!orgId || !userId || !clockInTime || !clockOutTime) {
      return res.status(400).json({ error: 'Missing required fields: orgId, userId, clockInTime, clockOutTime' });
    }

    const cin = new Date(clockInTime);
    const cout = new Date(clockOutTime);
    let totalMs = cout.getTime() - cin.getTime();
    const totalHours = Math.max(0, totalMs / (1000 * 60 * 60));

    const entry = new TimeEntry({
      orgId: new mongoose.Types.ObjectId(orgId),
      userId,
      clockIn: { time: cin.toISOString(), method: 'MANUAL' },
      clockOut: { time: cout.toISOString(), method: 'MANUAL' },
      status: status || 'PENDING',
      totalHours,
      regularHours: Math.min(totalHours, 8),
      overtimeHours: Math.max(0, totalHours - 8),
      notes: notes || reason || undefined,
      source: 'MANUAL',
    });
    await entry.save();

    res.status(201).json(serializeDoc(entry.toObject()));
  } catch (err) {
    console.error('[timeEntries] manual entry error:', err);
    res.status(500).json({ error: err.message || 'Manual entry failed' });
  }
});

// ------------------------------------------------------------------
// POST /api/time-entries/:id/approve-manual
// ------------------------------------------------------------------
router.post('/:id/approve-manual', async (req, res) => {
  try {
    const entry = await TimeEntry.findById(req.params.id);
    if (!entry) return res.status(404).json({ error: 'Not found' });
    if (entry.status !== 'PENDING') return res.status(400).json({ error: 'Entry is not pending' });

    entry.status = 'COMPLETED';
    await entry.save();
    res.json(serializeDoc(entry.toObject()));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ------------------------------------------------------------------
// POST /api/time-entries/:id/reject-manual
// ------------------------------------------------------------------
router.post('/:id/reject-manual', async (req, res) => {
  try {
    const { reason } = req.body;
    const entry = await TimeEntry.findById(req.params.id);
    if (!entry) return res.status(404).json({ error: 'Not found' });

    entry.status = 'REJECTED';
    entry.notes = `${entry.notes || ''} [REJECTED${reason ? ': ' + reason : ''}]`.trim();
    await entry.save();
    res.json(serializeDoc(entry.toObject()));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ------------------------------------------------------------------
// POST /api/time-entries/:id/break-start
// ------------------------------------------------------------------
router.post('/:id/break-start', async (req, res) => {
  try {
    const { type } = req.body;
    const entry = await TimeEntry.findById(req.params.id);
    if (!entry) return res.status(404).json({ error: 'Not found' });
    if (!entry.breaks) entry.breaks = [];
    entry.breaks.push({ start: new Date().toISOString(), type });
    await entry.save();
    res.json(serializeDoc(entry.toObject()));
  } catch (err) {
    console.error('[timeEntries] break-start error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ------------------------------------------------------------------
// POST /api/time-entries/:id/break-end
// ------------------------------------------------------------------
router.post('/:id/break-end', async (req, res) => {
  try {
    const entry = await TimeEntry.findById(req.params.id);
    if (!entry) return res.status(404).json({ error: 'Not found' });
    const activeBreak = entry.breaks?.find((b) => b.start && !b.end);
    if (activeBreak) {
      activeBreak.end = new Date().toISOString();
      await entry.save();
    }
    res.json(serializeDoc(entry.toObject()));
  } catch (err) {
    console.error('[timeEntries] break-end error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ------------------------------------------------------------------
// POST /api/time-entries/:id/comments
// ------------------------------------------------------------------
router.post('/:id/comments', async (req, res) => {
  try {
    const { text, authorId, authorName } = req.body;
    const entry = await TimeEntry.findById(req.params.id);
    if (!entry) return res.status(404).json({ error: 'Not found' });
    if (!entry.comments) entry.comments = [];
    entry.comments.push({ text, authorId: authorId || 'unknown', authorName: authorName || 'Unknown', createdAt: new Date() });
    await entry.save();
    res.json(serializeDoc(entry.toObject()));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ------------------------------------------------------------------
// PUT /api/time-entries/:id
// ------------------------------------------------------------------
router.put('/:id', async (req, res) => {
  try {
    const updates = req.body;
    const entry = await TimeEntry.findById(req.params.id);
    if (!entry) return res.status(404).json({ error: 'Not found' });

    // Apply simple field updates
    if (updates.status) entry.status = updates.status;
    if (updates.notes !== undefined) entry.notes = updates.notes;
    if (updates.clockInTime) entry.clockIn.time = new Date(updates.clockInTime);
    if (updates.clockOutTime) entry.clockOut = { ...(entry.clockOut || {}), time: new Date(updates.clockOutTime) };

    // Recalculate totals if both times present
    if (entry.clockIn?.time && entry.clockOut?.time) {
      let totalMs = new Date(entry.clockOut.time).getTime() - new Date(entry.clockIn.time).getTime();
      let breakMs = 0;
      for (const b of (entry.breaks || [])) {
        if (b.start && b.end) breakMs += new Date(b.end).getTime() - new Date(b.start).getTime();
      }
      totalMs = Math.max(0, totalMs - breakMs);
      const totalHours = totalMs / (1000 * 60 * 60);
      entry.totalHours = totalHours;
      entry.regularHours = Math.min(totalHours, 8);
      entry.overtimeHours = Math.max(0, totalHours - 8);
    }

    await entry.save();
    res.json(serializeDoc(entry.toObject()));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
