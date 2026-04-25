import express from 'express';
import Employee from '../models/Employee.js';
import User from '../models/User.js';
import Invite from '../models/Invite.js';
import LeaveType from '../models/LeaveType.js';
import LeaveBalance from '../models/LeaveBalance.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { serializeDoc } from '../utils/response.js';

const s = (doc) => serializeDoc(doc);
const sa = (docs) => docs.map(d => serializeDoc(d));

const router = express.Router();

// ═══════════════════════════════════════════════════
// GET /employees - Include owner/admin users too
// ═══════════════════════════════════════════════════
router.get('/', authenticate, async (req, res) => {
  try {
    const { orgId } = req.query;
    const queryOrgId = orgId || req.user.orgId;
    
    // 1. Get all Employee records
    const employees = await Employee.find({ orgId: queryOrgId })
      .populate('userId', 'firstName lastName email')
      .sort({ createdAt: -1 });

    // 2. Extract userIds that already have Employee records
    const employeeUserIds = employees
      .map(e => {
        if (!e.userId) return null;
        // Handle populated Mongoose document
        if (e.userId._id) {
          const id = e.userId._id;
          return typeof id.toHexString === 'function' ? id.toHexString() : id.toString();
        }
        // Handle plain ObjectId
        return typeof e.userId.toHexString === 'function' ? e.userId.toHexString() : e.userId.toString();
      })
      .filter(Boolean);
    
    // 3. Find owner/admin users WITHOUT Employee records
    const ownerQuery = { orgId: queryOrgId };
    if (employeeUserIds.length > 0) {
      ownerQuery._id = { $nin: employeeUserIds };
    }
    
    const ownerUsers = await User.find(ownerQuery).select('_id firstName lastName email role');

    // 4. Convert owner users to employee-like objects
    const ownerAsEmployees = ownerUsers.map(u => {
      const userObj = u.toObject ? u.toObject() : u;
      return {
        id: userObj._id.toString(),
        _id: userObj._id,
        userId: {
          id: userObj._id.toString(),
          _id: userObj._id,
          firstName: userObj.firstName,
          lastName: userObj.lastName,
          email: userObj.email
        },
        orgId: queryOrgId,
        firstName: userObj.firstName || 'Owner',
        lastName: userObj.lastName || '',
        email: userObj.email || '',
        position: userObj.role || 'Owner',
        department: 'Administration',
        role: userObj.role || 'OWNER',
        employmentType: 'FULL_TIME',
        inviteStatus: 'JOINED',
        isActive: true,
        isOwner: true,
        createdAt: userObj.createdAt || new Date()
      };
    });

    // 5. Combine and return
    const combined = [...employees.map(s), ...ownerAsEmployees.map(s)];
    res.json(combined);
  } catch (error) {
    console.error('Get employees error:', error);
    res.status(500).json({ error: 'Failed to fetch employees' });
  }
});

// Get single employee
router.get('/:id', authenticate, async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id)
      .populate('userId', 'firstName lastName email');
    
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    
    res.json(s(employee));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch employee' });
  }
});

// ═══════════════════════════════════════════════════
// Unified: Add employee or send invite
// ═══════════════════════════════════════════════════
router.post('/add-or-invite', authenticate, authorize('OWNER', 'ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const {
      email,
      role,
      department,
      position,
      employmentType,
      payRate,
      payType,
      employeeId
    } = req.body;

    const orgId = req.user.orgId || req.body.orgId;
    if (!orgId) {
      return res.status(400).json({ error: 'Organization ID required' });
    }

    const lowerEmail = email.toLowerCase().trim();

    // Check if already an employee in this org
    const existingEmployee = await Employee.findOne({ orgId, email: lowerEmail });
    if (existingEmployee) {
      return res.status(400).json({ error: 'This person is already in your organization' });
    }

    // Check if already invited
    const existingInvite = await Invite.findOne({ orgId, email: lowerEmail, status: 'PENDING' });
    if (existingInvite) {
      return res.status(400).json({ error: 'This email has already been invited' });
    }

    // Check if user already has an account
    const existingUser = await User.findOne({ email: lowerEmail });

    const employeeCount = await Employee.countDocuments({ orgId });
    const newEmployeeId = employeeId || `EMP${String(employeeCount + 1).padStart(3, '0')}`;

    if (existingUser) {
      // User exists - add them directly
      // ═══ CRITICAL: Update user's org AND role ═══
      existingUser.orgId = orgId;
      if (role) {
        existingUser.role = role; // Update User role too!
      }
      await existingUser.save();

      // Create leave balances
      const leaveTypes = await LeaveType.find({ orgId });
      const currentYear = new Date().getFullYear();
      if (leaveTypes.length > 0) {
        await LeaveBalance.insertMany(
          leaveTypes.map(lt => ({
            orgId,
            userId: existingUser._id,
            leaveTypeId: lt._id,
            entitlementDays: lt.accrualRule?.amount || 0,
            usedDays: 0,
            pendingDays: 0,
            carriedOverDays: 0,
            year: currentYear
          }))
        );
      }

      const employee = await Employee.create({
        orgId,
        userId: existingUser._id,
        employeeId: newEmployeeId,
        firstName: existingUser.firstName || '',
        lastName: existingUser.lastName || '',
        email: lowerEmail,
        role: role || 'EMPLOYEE',
        department: department || 'General',
        position: position || 'Employee',
        employmentType: employmentType || 'FULL_TIME',
        payRate: payRate || 25,
        payType: payType || 'HOURLY',
        inviteStatus: 'JOINED'
      });

      const populatedEmployee = await Employee.findById(employee._id)
        .populate('userId', 'firstName lastName email');

      res.status(201).json({
        action: 'ADDED',
        message: `${existingUser.firstName || existingUser.email} has been added to your organization`,
        employee: s(populatedEmployee)
      });
    } else {
      // User doesn't exist - create invite
      const invite = await Invite.create({
        orgId,
        email: lowerEmail,
        firstName: '',
        lastName: '',
        role: role || 'EMPLOYEE',
        department: department || 'General',
        position: position || 'Employee',
        employmentType: employmentType || 'FULL_TIME',
        payRate: payRate || 25,
        payType: payType || 'HOURLY',
        employeeId: newEmployeeId,
        invitedBy: req.user._id
      });

      // Create employee record with INVITED status
      const employee = await Employee.create({
        orgId,
        userId: null,
        employeeId: newEmployeeId,
        firstName: '',
        lastName: '',
        email: lowerEmail,
        role: role || 'EMPLOYEE',
        department: department || 'General',
        position: position || 'Employee',
        employmentType: employmentType || 'FULL_TIME',
        payRate: payRate || 25,
        payType: payType || 'HOURLY',
        inviteStatus: 'INVITED'
      });

      const populatedEmployee = await Employee.findById(employee._id)
        .populate('userId', 'firstName lastName email');

      res.status(201).json({
        action: 'INVITED',
        message: `Invitation sent to ${lowerEmail}. They'll be added when they sign up.`,
        employee: s(populatedEmployee),
        invite: s(invite)
      });
    }
  } catch (error) {
    console.error('Add or invite error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ error: 'This email is already associated with your organization' });
    }
    res.status(500).json({ error: 'Failed to add or invite employee' });
  }
});

// Create employee directly (legacy)
router.post('/', authenticate, authorize('OWNER', 'ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const { orgId, firstName, lastName, email, department, position, employmentType, payRate, payType, employeeId, startDate, role } = req.body;

    const existingEmployee = await Employee.findOne({ orgId, email: email.toLowerCase() });
    if (existingEmployee) {
      return res.status(400).json({ error: 'Employee with this email already exists' });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    
    let userId = null;
    if (existingUser) {
      userId = existingUser._id;
      existingUser.orgId = orgId;
      if (role) existingUser.role = role;
      await existingUser.save();
    }

    const employeeCount = await Employee.countDocuments({ orgId });

    const employee = await Employee.create({
      orgId,
      userId: userId,
      employeeId: employeeId || `EMP${String(employeeCount + 1).padStart(3, '0')}`,
      firstName,
      lastName,
      email: email.toLowerCase(),
      phone: req.body.phone,
      role: role || 'EMPLOYEE',
      department: department || 'General',
      position: position || 'Employee',
      employmentType: employmentType || 'FULL_TIME',
      payRate: payRate || 25,
      payType: payType || 'HOURLY',
      startDate: startDate ? new Date(startDate) : new Date(),
      inviteStatus: userId ? 'JOINED' : 'INVITED'
    });

    const populatedEmployee = await Employee.findById(employee._id)
      .populate('userId', 'firstName lastName email');

    res.status(201).json(s(populatedEmployee));
  } catch (error) {
    console.error('Create employee error:', error);
    res.status(500).json({ error: 'Failed to create employee' });
  }
});

// ═══════════════════════════════════════════════════
// PUT /employees/:id - CRITICAL: Sync role to User
// ═══════════════════════════════════════════════════
router.put('/:id', authenticate, authorize('OWNER', 'ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const { role, ...otherUpdates } = req.body;

    // 1. Find the employee first
    const existingEmployee = await Employee.findById(req.params.id);
    if (!existingEmployee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    // 2. If role is being changed, ALSO update the linked User document
    if (role && role !== existingEmployee.role) {
      console.log(`Role change: ${existingEmployee.role} → ${role} for employee ${req.params.id}`);
      
      // Update the linked User's role
      if (existingEmployee.userId) {
        await User.findByIdAndUpdate(existingEmployee.userId, { role });
        console.log(`Updated User ${existingEmployee.userId} role to ${role}`);
      }
      
      // Also update Employee role
      otherUpdates.role = role;
    }

    // 3. Update the Employee document
    const employee = await Employee.findByIdAndUpdate(
      req.params.id,
      { $set: otherUpdates },
      { new: true }
    ).populate('userId', 'firstName lastName email role');

    res.json(s(employee));
  } catch (error) {
    console.error('Update employee error:', error);
    res.status(500).json({ error: 'Failed to update employee' });
  }
});

// Delete employee
router.delete('/:id', authenticate, authorize('OWNER', 'ADMIN'), async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id);
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    // Also delete associated invite if exists
    await Invite.deleteOne({ orgId: employee.orgId, email: employee.email });

    await Employee.findByIdAndDelete(req.params.id);
    res.json({ message: 'Employee removed' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete employee' });
  }
});

export default router;
