import express from 'express';
import Location from '../models/Location.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { serializeDoc } from '../utils/response.js';

const s = (doc) => serializeDoc(doc);
const sa = (docs) => docs.map(d => serializeDoc(d));

const router = express.Router();

// Get all locations
router.get('/', authenticate, async (req, res) => {
  try {
    const { orgId } = req.query;
    const query = orgId ? { orgId } : { orgId: req.user.orgId };

    const locations = await Location.find(query);
    res.json(sa(locations));
  } catch (error) {
    console.error('Get locations error:', error);
    res.status(500).json({ error: 'Failed to fetch locations' });
  }
});

// Get location by ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    const location = await Location.findById(req.params.id);
    if (!location) {
      return res.status(404).json({ error: 'Location not found' });
    }
    res.json(s(location));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch location' });
  }
});

// Create location
router.post('/', authenticate, authorize('OWNER', 'ADMIN'), async (req, res) => {
  try {
    const {
      name,
      address,
      coordinates,
      geofence,
      timezone,
      managers
    } = req.body;

    const location = await Location.create({
      orgId: req.user.orgId,
      name,
      address,
      coordinates,
      geofence: geofence || {
        type: 'CIRCLE',
        center: coordinates,
        radius: 100
      },
      timezone: timezone || 'Australia/Sydney',
      managers: managers || [],
      qrCode: `qr-${Date.now()}`
    });

    res.status(201).json(location);
  } catch (error) {
    console.error('Create location error:', error);
    res.status(500).json({ error: 'Failed to create location' });
  }
});

// Update location
router.put('/:id', authenticate, authorize('OWNER', 'ADMIN'), async (req, res) => {
  try {
    const location = await Location.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    if (!location) {
      return res.status(404).json({ error: 'Location not found' });
    }

    res.json(s(location));
  } catch (error) {
    res.status(500).json({ error: 'Failed to update location' });
  }
});

// Delete location
router.delete('/:id', authenticate, authorize('OWNER', 'ADMIN'), async (req, res) => {
  try {
    const location = await Location.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!location) {
      return res.status(404).json({ error: 'Location not found' });
    }

    res.json({ message: 'Location deactivated' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to deactivate location' });
  }
});

export default router;
