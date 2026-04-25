import express from 'express';
import Payslip from '../models/Payslip.js';
import Employee from '../models/Employee.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { serializeDoc } from '../utils/response.js';

const s = (doc) => serializeDoc(doc);
const sa = (docs) => docs.map(d => serializeDoc(d));

const router = express.Router();

// Get all payslips for org/user
router.get('/', authenticate, async (req, res) => {
  try {
    const { orgId, userId, status } = req.query;
    const query = { orgId: orgId || req.user.orgId };

    if (userId) query.userId = userId;
    if (status) query.status = status;

    const payslips = await Payslip.find(query)
      .populate('userId', 'firstName lastName email')
      .populate('employeeId', 'employeeId department position')
      .sort({ 'payPeriod.start': -1 });

    res.json(sa(payslips));
  } catch (error) {
    console.error('Get payslips error:', error);
    res.status(500).json({ error: 'Failed to fetch payslips' });
  }
});

// Get payslip by ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    const payslip = await Payslip.findById(req.params.id)
      .populate('userId', 'firstName lastName email')
      .populate('employeeId', 'employeeId department position payRate payType');

    if (!payslip) {
      return res.status(404).json({ error: 'Payslip not found' });
    }

    res.json(s(payslip));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch payslip' });
  }
});

// Create payslip (admin/owner only)
router.post('/', authenticate, authorize('OWNER', 'ADMIN'), async (req, res) => {
  try {
    const { userId, employeeId, payPeriod, payDate, earnings, deductions, leaveTaken, notes } = req.body;

    const employee = await Employee.findById(employeeId);
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    // Calculate net pay
    const grossPay = earnings?.grossPay || 0;
    const totalDeductions = deductions?.total || 0;
    const netPay = grossPay - totalDeductions;

    const payslip = await Payslip.create({
      orgId: req.user.orgId,
      userId,
      employeeId,
      payPeriod: {
        start: new Date(payPeriod.start),
        end: new Date(payPeriod.end)
      },
      payDate: new Date(payDate),
      earnings: {
        regularHours: earnings?.regularHours || 0,
        regularRate: earnings?.regularRate || employee.payRate || 0,
        regularPay: earnings?.regularPay || 0,
        overtimeHours: earnings?.overtimeHours || 0,
        overtimeRate: earnings?.overtimeRate || (employee.payRate * 1.5) || 0,
        overtimePay: earnings?.overtimePay || 0,
        doubleTimeHours: earnings?.doubleTimeHours || 0,
        doubleTimeRate: earnings?.doubleTimeRate || (employee.payRate * 2) || 0,
        doubleTimePay: earnings?.doubleTimePay || 0,
        grossPay
      },
      deductions: {
        tax: deductions?.tax || 0,
        superannuation: deductions?.superannuation || 0,
        medicare: deductions?.medicare || 0,
        other: deductions?.other || [],
        total: totalDeductions
      },
      leaveTaken: leaveTaken || [],
      netPay,
      notes
    });

    const populatedPayslip = await Payslip.findById(payslip._id)
      .populate('userId', 'firstName lastName email')
      .populate('employeeId', 'employeeId department position');

    res.status(201).json(s(populatedPayslip));
  } catch (error) {
    console.error('Create payslip error:', error);
    res.status(500).json({ error: 'Failed to create payslip' });
  }
});

// Update payslip status
router.put('/:id/status', authenticate, authorize('OWNER', 'ADMIN'), async (req, res) => {
  try {
    const { status } = req.body;
    const payslip = await Payslip.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!payslip) {
      return res.status(404).json({ error: 'Payslip not found' });
    }

    res.json(s(payslip));
  } catch (error) {
    res.status(500).json({ error: 'Failed to update payslip' });
  }
});

// Delete payslip
router.delete('/:id', authenticate, authorize('OWNER', 'ADMIN'), async (req, res) => {
  try {
    await Payslip.findByIdAndDelete(req.params.id);
    res.json({ message: 'Payslip deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete payslip' });
  }
});

export default router;
