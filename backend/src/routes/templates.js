import express from 'express';
import ScheduleTemplate from '../models/ScheduleTemplate.js';
import Shift from '../models/Shift.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { serializeDoc } from '../utils/response.js';

const s = (doc) => serializeDoc(doc);
const sa = (docs) => docs.map(d => serializeDoc(d));

const router = express.Router();

// Get all templates for org
router.get('/', authenticate, async (req, res) => {
  try {
    const { orgId } = req.query;
    const templates = await ScheduleTemplate.find({
      orgId: orgId || req.user.orgId,
      isActive: true
    }).populate('locationId', 'name');
    res.json(sa(templates));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// Create template
router.post('/', authenticate, authorize('OWNER', 'ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const template = await ScheduleTemplate.create({
      orgId: req.user.orgId,
      ...req.body
    });
    res.status(201).json(s(template));
  } catch (error) {
    res.status(500).json({ error: 'Failed to create template' });
  }
});

// Apply template to date range
router.post('/:id/apply', authenticate, authorize('OWNER', 'ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const { startDate, endDate } = req.body;
    const template = await ScheduleTemplate.findById(req.params.id);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const shifts = [];
    const start = new Date(startDate);
    const end = new Date(endDate);

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dayOfWeek = d.getDay();
      const pattern = template.shiftPatterns.find(p => p.dayOfWeek === dayOfWeek);
      if (!pattern) continue;

      const [startH, startM] = pattern.startTime.split(':').map(Number);
      const [endH, endM] = pattern.endTime.split(':').map(Number);

      const shiftStart = new Date(d);
      shiftStart.setHours(startH, startM, 0, 0);
      const shiftEnd = new Date(d);
      shiftEnd.setHours(endH, endM, 0, 0);

      shifts.push({
        orgId: req.user.orgId,
        locationId: template.locationId,
        title: template.name,
        description: template.description,
        department: template.department,
        startTime: shiftStart,
        endTime: shiftEnd,
        color: template.color,
        requiredRoles: pattern.requiredRoles,
        requiredSkills: pattern.skills,
        breaks: [{ start: null, end: null, duration: 0.5, type: 'UNPAID', description: 'Meal break' }],
        templateId: template._id,
        source: 'TEMPLATE',
        createdBy: req.user._id
      });
    }

    const created = await Shift.insertMany(shifts);
    res.status(201).json({
      message: `${created.length} shifts created from template`,
      shifts: sa(created)
    });
  } catch (error) {
    console.error('Apply template error:', error);
    res.status(500).json({ error: 'Failed to apply template' });
  }
});

// Delete template
router.delete('/:id', authenticate, authorize('OWNER', 'ADMIN'), async (req, res) => {
  try {
    await ScheduleTemplate.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ message: 'Template deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

export default router;
