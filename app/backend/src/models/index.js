import mongoose from 'mongoose';

// User Schema
const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  phone: String,
  avatar: String,
  role: { type: String, enum: ['OWNER', 'ADMIN', 'MANAGER', 'EMPLOYEE', 'OBSERVER'], default: 'EMPLOYEE' },
  permissions: [{ type: String }],
  orgId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization' },
  isActive: { type: Boolean, default: true },
  settings: {
    notifications: {
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
      sms: { type: Boolean, default: false },
      shiftReminders: { type: Boolean, default: true },
      timesheetApprovals: { type: Boolean, default: true },
      leaveUpdates: { type: Boolean, default: true },
    },
    twoFactorEnabled: { type: Boolean, default: false },
    timezone: { type: String, default: 'Australia/Sydney' },
    dateFormat: { type: String, default: 'dd/MM/yyyy' },
    timeFormat: { type: String, default: '12h' },
  },
  lastLogin: Date,
}, { timestamps: true });

// Organization Schema
const OrganizationSchema = new mongoose.Schema({
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  timezone: { type: String, default: 'Australia/Sydney' },
  currency: { type: String, default: 'AUD' },
  settings: {
    dateFormat: { type: String, default: 'dd/MM/yyyy' },
    timeFormat: { type: String, default: '12h' },
    workingDays: { type: [Number], default: [1, 2, 3, 4, 5] },
    publicHolidays: { type: [String], default: [] },
    timesheetSettings: {
      periodType: { type: String, default: 'weekly' },
      weekStartDay: { type: String, default: 'monday' },
      timesheetDueDay: { type: Number, default: 2 },
      approvalWorkflow: { type: String, default: 'manager' },
      roundingRule: {
        interval: { type: Number, default: 15 },
        direction: { type: String, default: 'nearest' },
      },
      overtimeThresholds: {
        daily: { hours: { type: Number, default: 8 } },
        dailyDouble: { hours: { type: Number, default: 12 } },
        weekly: { hours: { type: Number, default: 38 } },
      },
      breakRules: {
        autoDeductAfterHours: { type: Number, default: 5 },
        duration: { type: Number, default: 30 },
        type: { type: String, default: 'unpaid' },
      },
      lockPeriodDays: { type: Number, default: 7 },
    },
    features: { type: Map, of: Boolean, default: {} },
  },
  subscription: {
    plan: { type: String, default: 'STARTER' },
    status: { type: String, default: 'ACTIVE' },
    expiryDate: Date,
    maxUsers: { type: Number, default: 10 },
  },
  branding: {
    logo: String,
    primaryColor: { type: String, default: '#3b82f6' },
    secondaryColor: { type: String, default: '#64748b' },
  },
}, { timestamps: true });

// Employee Schema
const EmployeeSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.Mixed, ref: 'User' },
  orgId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
  employeeId: { type: String },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true },
  phone: String,
  avatar: String,
  department: { type: String, default: 'General' },
  position: { type: String, default: 'Employee' },
  employmentType: { type: String, enum: ['FULL_TIME', 'PART_TIME', 'CASUAL', 'CONTRACTOR'], default: 'FULL_TIME' },
  startDate: { type: Date, default: Date.now },
  terminationDate: Date,
  payRate: { type: Number, default: 0 },
  payCurrency: { type: String, default: 'AUD' },
  payType: { type: String, enum: ['HOURLY', 'SALARY'], default: 'HOURLY' },
  locations: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Location' }],
  managerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
  role: { type: String, enum: ['OWNER', 'ADMIN', 'MANAGER', 'EMPLOYEE', 'OBSERVER'], default: 'EMPLOYEE' },
  inviteStatus: { type: String, enum: ['INVITED', 'JOINED'], default: 'JOINED' },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

// Location Schema
const LocationSchema = new mongoose.Schema({
  orgId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
  name: { type: String, required: true },
  address: { type: String, required: true },
  coordinates: {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
  },
  geofence: {
    type: { type: String, default: 'CIRCLE' },
    center: {
      lat: Number,
      lng: Number,
    },
    radius: { type: Number, default: 200 },
  },
  timezone: { type: String, default: 'Australia/Sydney' },
  qrCodeEnabled: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

// Shift Schema
const ShiftSchema = new mongoose.Schema({
  orgId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
  locationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Location' },
  title: { type: String, required: true },
  description: String,
  department: String,
  assignedTo: [{ type: mongoose.Schema.Types.Mixed }],
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  timezone: { type: String, default: 'Australia/Sydney' },
  type: { type: String, default: 'REGULAR' },
  status: { type: String, default: 'SCHEDULED' },
  color: { type: String, default: '#3b82f6' },
  notes: String,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

// Time Entry Schema
const TimeEntrySchema = new mongoose.Schema({
  orgId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
  userId: { type: String, required: true },
  shiftId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shift' },
  clockIn: {
    time: { type: Date, required: true },
    location: {
      lat: Number,
      lng: Number,
      accuracy: Number,
    },
    photoUrl: String,
    photoBase64: String,
    deviceId: String,
    ipAddress: String,
    method: { type: String, default: 'WEB' },
    geofenceStatus: { type: String, default: 'INSIDE' },
    geofenceDistance: Number,
    matchedLocationId: String,
  },
  clockOut: {
    time: Date,
    location: {
      lat: Number,
      lng: Number,
      accuracy: Number,
    },
    method: String,
    geofenceStatus: String,
    geofenceDistance: Number,
  },
  breaks: [{
    start: Date,
    end: Date,
    type: { type: String, default: 'UNPAID' },
  }],
  totalHours: { type: Number, default: 0 },
  regularHours: { type: Number, default: 0 },
  overtimeHours: { type: Number, default: 0 },
  status: { type: String, enum: ['ACTIVE', 'COMPLETED', 'DISPUTED', 'APPROVED', 'PENDING'], default: 'ACTIVE' },
  notes: String,
  editsHistory: [{
    field: String,
    oldValue: mongoose.Schema.Types.Mixed,
    newValue: mongoose.Schema.Types.Mixed,
    editedBy: String,
    reason: String,
    timestamp: { type: Date, default: Date.now },
  }],
  comments: [{
    text: String,
    authorId: String,
    authorName: String,
    createdAt: { type: Date, default: Date.now },
  }],
  lastEditedAt: Date,
  lastEditedBy: String,
  lastEditedByName: String,
  source: { type: String, default: 'WEB' },
}, { timestamps: true });

// Timesheet Schema
const TimesheetSchema = new mongoose.Schema({
  orgId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
  userId: { type: String, required: true },
  payPeriod: {
    start: { type: Date, required: true },
    end: { type: Date, required: true },
  },
  entries: [{ type: mongoose.Schema.Types.ObjectId, ref: 'TimeEntry' }],
  summary: {
    regularHours: { type: Number, default: 0 },
    overtimeHours: { type: Number, default: 0 },
    doubleTimeHours: { type: Number, default: 0 },
    breakHours: { type: Number, default: 0 },
    totalHours: { type: Number, default: 0 },
    totalPay: { type: Number, default: 0 },
  },
  status: { type: String, enum: ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'PAID'], default: 'DRAFT' },
  submittedAt: Date,
  approvedBy: String,
  approvedAt: Date,
  rejectionReason: String,
}, { timestamps: true });

// Leave Type Schema
const LeaveTypeSchema = new mongoose.Schema({
  orgId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
  name: { type: String, required: true },
  type: { type: String, enum: ['ANNUAL', 'SICK', 'PERSONAL', 'PUBLIC_HOLIDAY', 'CUSTOM'], default: 'ANNUAL' },
  color: { type: String, default: '#3b82f6' },
  isPaid: { type: Boolean, default: true },
  accrualRule: {
    type: { type: String, default: 'FIXED' },
    amount: { type: Number, default: 20 },
    period: { type: String, default: 'YEARLY' },
  },
  carryOverRules: {
    maxDays: { type: Number, default: 5 },
    expiry: Date,
  },
}, { timestamps: true });

// Leave Balance Schema
const LeaveBalanceSchema = new mongoose.Schema({
  orgId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
  userId: { type: String, required: true },
  leaveTypeId: { type: mongoose.Schema.Types.ObjectId, ref: 'LeaveType', required: true },
  entitlementDays: { type: Number, default: 0 },
  usedDays: { type: Number, default: 0 },
  pendingDays: { type: Number, default: 0 },
  carriedOverDays: { type: Number, default: 0 },
  year: { type: Number, default: () => new Date().getFullYear() },
}, { timestamps: true });

// Leave Request Schema
const LeaveRequestSchema = new mongoose.Schema({
  orgId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
  userId: { type: String, required: true },
  leaveTypeId: { type: mongoose.Schema.Types.ObjectId, ref: 'LeaveType', required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  duration: { type: String, enum: ['FULL', 'AM', 'PM'], default: 'FULL' },
  days: { type: Number, required: true },
  reason: String,
  attachmentUrl: String,
  status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'], default: 'PENDING' },
  approvedBy: String,
  approvedAt: Date,
  rejectionReason: String,
}, { timestamps: true });

// Payslip Schema
const PayslipSchema = new mongoose.Schema({
  orgId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
  userId: { type: String, required: true },
  employeeId: { type: String, required: true },
  payPeriod: {
    start: Date,
    end: Date,
  },
  payDate: Date,
  earnings: {
    regularHours: { type: Number, default: 0 },
    regularRate: { type: Number, default: 0 },
    regularPay: { type: Number, default: 0 },
    overtimeHours: { type: Number, default: 0 },
    overtimeRate: { type: Number, default: 0 },
    overtimePay: { type: Number, default: 0 },
    doubleTimeHours: { type: Number, default: 0 },
    doubleTimeRate: { type: Number, default: 0 },
    doubleTimePay: { type: Number, default: 0 },
    grossPay: { type: Number, default: 0 },
  },
  deductions: {
    tax: { type: Number, default: 0 },
    superannuation: { type: Number, default: 0 },
    medicare: { type: Number, default: 0 },
    other: [{ name: String, amount: Number }],
    total: { type: Number, default: 0 },
  },
  leaveTaken: [{ leaveType: String, days: Number, amount: Number }],
  grossPay: { type: Number, default: 0 },
  netPay: { type: Number, default: 0 },
  tax: { type: Number, default: 0 },
  superannuation: { type: Number, default: 0 },
  regularHours: { type: Number, default: 0 },
  overtimeHours: { type: Number, default: 0 },
  ytd: {
    grossPay: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    superannuation: { type: Number, default: 0 },
  },
  status: { type: String, enum: ['DRAFT', 'PUBLISHED', 'PAID'], default: 'DRAFT' },
  notes: String,
}, { timestamps: true });

// Invite Schema
const InviteSchema = new mongoose.Schema({
  orgId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
  email: { type: String, required: true },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  role: { type: String, default: 'EMPLOYEE' },
  department: { type: String, default: 'General' },
  position: { type: String, default: 'Employee' },
  employmentType: { type: String, default: 'FULL_TIME' },
  payRate: { type: Number, default: 0 },
  payType: { type: String, default: 'HOURLY' },
  employeeId: String,
  status: { type: String, enum: ['PENDING', 'ACCEPTED', 'EXPIRED'], default: 'PENDING' },
  invitedBy: {
    id: String,
    firstName: String,
    lastName: String,
  },
  expiresAt: { type: Date, default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
}, { timestamps: true });

// Template Schema
const TemplateSchema = new mongoose.Schema({
  orgId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
  name: { type: String, required: true },
  department: { type: String, default: 'General' },
  color: { type: String, default: '#3b82f6' },
  locationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Location' },
  type: { type: String, default: 'REGULAR' },
  startTime: String,
  endTime: String,
  assignedTo: [{ type: String }],
  breaks: [{ start: String, end: String, type: { type: String, default: 'UNPAID' } }],
  payModifiers: [{ type: String, amount: Number, reason: String }],
  notes: String,
  recurrence: {
    frequency: { type: String, default: 'WEEKLY' },
    interval: { type: Number, default: 1 },
    daysOfWeek: [{ type: Number }],
    endDate: Date,
  },
}, { timestamps: true });

// Activity Log Schema
const ActivitySchema = new mongoose.Schema({
  orgId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
  actorId: { type: String, required: true },
  action: { type: String, required: true },
  entityType: { type: String, required: true },
  entityId: { type: String, required: true },
  metadata: {
    before: mongoose.Schema.Types.Mixed,
    after: mongoose.Schema.Types.Mixed,
  },
  ipAddress: String,
  userAgent: String,
}, { timestamps: true });

export const User = mongoose.model('User', UserSchema);
export const Organization = mongoose.model('Organization', OrganizationSchema);
export const Employee = mongoose.model('Employee', EmployeeSchema);
export const Location = mongoose.model('Location', LocationSchema);
export const Shift = mongoose.model('Shift', ShiftSchema);
export const TimeEntry = mongoose.model('TimeEntry', TimeEntrySchema);
export const Timesheet = mongoose.model('Timesheet', TimesheetSchema);
export const LeaveType = mongoose.model('LeaveType', LeaveTypeSchema);
export const LeaveBalance = mongoose.model('LeaveBalance', LeaveBalanceSchema);
export const LeaveRequest = mongoose.model('LeaveRequest', LeaveRequestSchema);
export const Payslip = mongoose.model('Payslip', PayslipSchema);
export const Invite = mongoose.model('Invite', InviteSchema);
export const Template = mongoose.model('Template', TemplateSchema);
export const Activity = mongoose.model('Activity', ActivitySchema);
