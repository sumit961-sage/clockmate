// ClockMate Pro - TypeScript Type Definitions

// User Roles
export type UserRole = 'OWNER' | 'ADMIN' | 'MANAGER' | 'EMPLOYEE' | 'OBSERVER';

// Organization Plans
export type PlanType = 'STARTER' | 'TEAM' | 'BUSINESS' | 'ENTERPRISE';

// Employment Types
export type EmploymentType = 'FULL_TIME' | 'PART_TIME' | 'CASUAL' | 'CONTRACTOR';

// Leave Types
export type LeaveTypeCategory = 'ANNUAL' | 'SICK' | 'PERSONAL' | 'PUBLIC_HOLIDAY' | 'CUSTOM';

// Shift Types
export type ShiftType = 'REGULAR' | 'OVERTIME' | 'ON_CALL' | 'TRAINING' | 'MEETING';

// Manual Entry Reason
export type ManualEntryReason = 'FORGOT' | 'APP_ISSUE' | 'PHONE_DIED' | 'OTHER';

// Manual Entry Request
export interface ManualEntryRequest {
  orgId: string;
  userId: string;
  clockInTime: string;
  clockOutTime: string;
  notes?: string;
  reason: ManualEntryReason;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
}

// Swap Request
export interface SwapRequest {
  id: string;
  shiftId: string;
  fromEmployeeId: string;
  toEmployeeId: string;
  fromEmployeeName?: string;
  toEmployeeName?: string;
  shiftTitle?: string;
  reason?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
}

// Location Create Data
export interface LocationCreateData {
  name: string;
  address: string;
  coordinates: { lat: number; lng: number };
  geofence: { type: 'CIRCLE'; radius: number };
  timezone?: string;
  qrCodeEnabled?: boolean;
  isActive?: boolean;
}

// Payslip Create Payload
export interface PayslipCreatePayload {
  orgId: string;
  employeeId: string;
  payPeriod: { start: string; end: string };
  payDate: string;
  regularHours: number;
  overtimeHours: number;
}

// Dashboard Data
export interface DashboardData {
  todayAttendance: { present: number; late: number; absent: number };
  pendingApprovals: { timesheets: number; leaveRequests: number };
  upcomingLeave: Array<{
    employeeName: string;
    startDate: string;
    endDate: string;
    days: number;
  }>;
}

// Template Interface
export interface Template {
  id: string;
  orgId: string;
  name: string;
  department: string;
  color?: string;
  locationId?: string;
  type?: string;
  startTime?: string;
  endTime?: string;
  assignedTo?: string[];
  breaks?: { start: string; end: string; type: 'PAID' | 'UNPAID' }[];
  payModifiers?: { type: 'PENALTY' | 'ALLOWANCE' | 'BONUS'; amount: number; reason?: string }[];
  notes?: string;
  recurrence?: Recurrence;
  createdAt?: string;
  updatedAt?: string;
}

// Time Entry Status
export type TimeEntryStatus = 'ACTIVE' | 'COMPLETED' | 'DISPUTED' | 'APPROVED' | 'PENDING';

// Timesheet Status
export type TimesheetStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'PAID';

// Leave Request Status
export type LeaveRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

// Payslip Status
export type PayslipStatus = 'DRAFT' | 'PUBLISHED' | 'PAID';

// Clock Methods
export type ClockMethod = 'MOBILE' | 'WEB' | 'KIOSK' | 'QR_CODE' | 'SLACK';

// Geofence Types
export type GeofenceType = 'CIRCLE' | 'POLYGON';

// User Interface
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  avatar?: string;
  role: UserRole;
  permissions: Permission[];
  orgId: string;
  isActive: boolean;
  createdAt: string;
  lastLogin?: string;
  settings: UserSettings;
}

export interface UserSettings {
  notifications: NotificationSettings;
  twoFactorEnabled: boolean;
  timezone: string;
  dateFormat: string;
  timeFormat: '12h' | '24h';
}

export interface NotificationSettings {
  email: boolean;
  push: boolean;
  sms: boolean;
  shiftReminders: boolean;
  timesheetApprovals: boolean;
  leaveUpdates: boolean;
}

// Permission Interface
export interface Permission {
  id: string;
  name: string;
  description: string;
}

// Organization Interface
export interface Organization {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  currency: string;
  settings: OrgSettings;
  subscription: Subscription;
  branding: Branding;
  role?: UserRole;
  plan?: PlanType;
  location?: string;
  type?: string;
  industry?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrgSettings {
  dateFormat: string;
  timeFormat: string;
  workingDays: number[];
  publicHolidays: string[];
  timesheetSettings: TimesheetSettings;
  features: Record<string, boolean>;
  overtimeRules?: OvertimeRules;
  breakRules?: BreakRules;
}

export interface TimesheetConfig {
  defaultShiftDuration: number;
  gracePeriod: number;
  dailyOvertimeThreshold: number;
  weeklyOvertimeThreshold: number;
  overtimeRate: number;
  autoDeductBreaks: boolean;
  breakDeductAfter: number;
  breakDeductDuration: number;
  geofencingRequired: boolean;
  sessionTimeout: number;
  maxLoginAttempts: number;
}

export interface TimesheetSettings {
  periodType: 'weekly' | 'fortnightly' | 'semi_monthly' | 'monthly';
  weekStartDay: 'sunday' | 'monday' | 'saturday';
  timesheetDueDay: number;
  approvalWorkflow: 'manager' | 'auto' | 'hr_final';
  roundingRule: { interval: number; direction: 'nearest' | 'up' | 'down' };
  overtimeThresholds: {
    daily: { hours: number };
    dailyDouble: { hours: number };
    weekly: { hours: number };
  };
  breakRules: { autoDeductAfterHours: number; duration: number; type: 'paid' | 'unpaid' };
  lockPeriodDays: number;
}

export interface OvertimeRules {
  dailyThreshold: number;
  weeklyThreshold: number;
  rate: number;
}

export interface BreakRules {
  autoDeduct: boolean;
  deductAfter: number;
  deductDuration: number;
}

export interface Subscription {
  plan: PlanType;
  status: 'ACTIVE' | 'CANCELLED' | 'EXPIRED' | 'TRIAL';
  expiryDate?: string;
  maxUsers: number;
}

export interface Branding {
  logo?: string;
  primaryColor: string;
  secondaryColor: string;
}

// Employee Interface
export interface Employee {
  id: string;
  userId: string | { id?: string; _id?: string; [key: string]: unknown };
  orgId: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  avatar?: string;
  department: string;
  position: string;
  employmentType: EmploymentType;
  startDate: string;
  terminationDate?: string;
  payRate: number;
  payCurrency: string;
  payType: 'HOURLY' | 'SALARY';
  locations: string[];
  managerId?: string;
  manager?: Employee;
  emergencyContact?: EmergencyContact;
  documents: Document[];
  certifications: Certification[];
  role?: 'OWNER' | 'ADMIN' | 'MANAGER' | 'EMPLOYEE' | 'OBSERVER';
  inviteStatus?: 'INVITED' | 'JOINED';
  isActive: boolean;
  customFields?: Record<string, unknown>;
}

export interface Invite {
  id: string;
  orgId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'OWNER' | 'ADMIN' | 'MANAGER' | 'EMPLOYEE' | 'OBSERVER';
  department: string;
  position: string;
  employmentType: EmploymentType;
  payRate: number;
  payType: 'HOURLY' | 'SALARY';
  employeeId?: string;
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED';
  invitedBy?: {
    id: string;
    firstName: string;
    lastName: string;
  };
  expiresAt: string;
  createdAt: string;
}

export interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
}

export interface Document {
  id: string;
  type: string;
  name: string;
  url: string;
  uploadedAt: string;
  expiryDate?: string;
}

export interface Certification {
  id: string;
  name: string;
  issuer?: string;
  issueDate?: string;
  expiryDate?: string;
  fileUrl?: string;
}

// Location Interface
export interface Location {
  id: string;
  orgId: string;
  name: string;
  address: string;
  coordinates: Coordinates;
  geofence: Geofence;
  timezone: string;
  qrCode?: string;
  qrCodeEnabled?: boolean;
  isActive?: boolean;
  settings?: LocationSettings;
  managers?: string[];
}

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface Geofence {
  type: GeofenceType;
  center?: Coordinates;
  radius?: number;
  coordinates?: Coordinates[];
}

export interface LocationSettings {
  payRate?: number;
  workingHours?: WorkingHours;
}

export interface WorkingHours {
  start: string;
  end: string;
}

// Shift Interface
export interface Shift {
  id: string;
  orgId: string;
  locationId?: string | { id: string; name: string };
  location?: Location;
  title: string;
  description?: string;
  department?: string;
  assignedTo: any[];
  assignedEmployees?: Employee[];
  startTime: string;
  endTime: string;
  timezone?: string;
  type: 'REGULAR' | 'SPLIT' | 'ON_CALL' | 'TRAINING' | 'SLEEPOVER' | 'MEETING' | 'OVERTIME';
  status: 'DRAFT' | 'SCHEDULED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'OPEN';
  color?: string;
  requiredSkills?: string[];
  requiredRoles?: { role: string; count: number; skillsRequired?: string[] }[];
  recurrence?: Recurrence;
  breaks?: ScheduledBreak[];
  payModifiers?: { type: 'PENALTY' | 'ALLOWANCE' | 'BONUS'; amount: number; reason?: string }[];
  notes?: string;
  source?: 'MANUAL' | 'TEMPLATE' | 'AUTO_SCHEDULED';
  templateId?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Recurrence {
  frequency: 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';
  interval: number;
  daysOfWeek?: number[];
  endDate?: string;
}

export interface ScheduledBreak {
  start: string;
  end: string;
  type: 'PAID' | 'UNPAID';
}

// Time Entry Interface
export interface TimeEntryComment {
  text: string;
  authorId: string;
  authorName: string;
  createdAt: string;
}

export interface TimeEntry {
  id: string;
  orgId: string;
  userId: string;
  employee?: Employee;
  shiftId?: string;
  shift?: Shift;
  clockIn: ClockEvent;
  clockOut?: ClockEvent;
  breaks: Break[];
  totalHours: number;
  regularHours: number;
  overtimeHours: number;
  status: TimeEntryStatus;
  notes?: string;
  jobCosting?: JobCosting;
  editsHistory: EditHistory[];
  comments: TimeEntryComment[];
  lastEditedAt?: string;
  lastEditedBy?: string;
  lastEditedByName?: string;
  createdAt: string;
}

export interface ClockEvent {
  time: string;
  location?: Coordinates;
  accuracy?: number;
  photoUrl?: string;
  photoBase64?: string;
  deviceId?: string;
  ipAddress?: string;
  method: ClockMethod;
  withinGeofence?: boolean;
  geofenceStatus?: 'INSIDE' | 'GEOFENCE_OVERRIDE';
  geofenceDistance?: number;
  matchedLocationId?: string;
}

export interface Break {
  id: string;
  start: string;
  end?: string;
  type: 'PAID' | 'UNPAID';
  duration?: number;
}

export interface JobCosting {
  projectId?: string;
  projectName?: string;
  costCode?: string;
  clientId?: string;
}

export interface EditHistory {
  field: string;
  oldValue: any;
  newValue: any;
  editedBy: string;
  reason?: string;
  timestamp: string;
}

// Timesheet Interface
export interface Timesheet {
  id: string;
  orgId: string;
  userId: string;
  employee?: Employee;
  payPeriod: PayPeriod;
  entries: TimeEntry[];
  summary: TimesheetSummary;
  status: TimesheetStatus;
  submittedAt?: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;
  editsHistory?: EditHistory[];
}

export interface PayPeriod {
  start: string;
  end: string;
}

export interface TimesheetSummary {
  regularHours: number;
  overtimeHours: number;
  doubleTimeHours: number;
  breakHours: number;
  totalHours: number;
  totalPay: number;
}

// Payslip Interface
export interface Payslip {
  id: string;
  orgId: string;
  userId: string;
  employeeId: string;
  employee?: Employee;
  employeeName?: string;
  payPeriod: PayPeriod;
  payDate: string;
  earnings: PayslipEarnings;
  deductions: PayslipDeductions;
  leaveTaken: PayslipLeaveTaken[];
  grossPay?: number;
  netPay: number;
  tax?: number;
  superannuation?: number;
  regularHours?: number;
  overtimeHours?: number;
  overtimeRate?: number;
  ytd: PayslipYTD;
  status: PayslipStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PayslipEarnings {
  regularHours: number;
  regularRate: number;
  regularPay: number;
  overtimeHours: number;
  overtimeRate: number;
  overtimePay: number;
  doubleTimeHours: number;
  doubleTimeRate: number;
  doubleTimePay: number;
  grossPay: number;
}

export interface PayslipDeductions {
  tax: number;
  superannuation: number;
  medicare: number;
  other: { name: string; amount: number }[];
  total: number;
}

export interface PayslipLeaveTaken {
  leaveType: string;
  days: number;
  amount: number;
}

export interface PayslipYTD {
  grossPay: number;
  tax: number;
  superannuation: number;
}

// Leave Type Interface
export interface LeaveType {
  id: string;
  orgId: string;
  name: string;
  type: LeaveTypeCategory;
  color: string;
  isPaid: boolean;
  accrualRule: AccrualRule;
  carryOverRules: CarryOverRules;
}

export interface AccrualRule {
  type: 'FIXED' | 'HOURS_WORKED';
  amount: number;
  period: 'YEARLY' | 'MONTHLY' | 'FORTNIGHTLY' | 'WEEKLY';
}

export interface CarryOverRules {
  maxDays: number;
  expiry?: string;
}

// Leave Balance Interface
export interface LeaveBalance {
  id: string;
  orgId: string;
  userId: string;
  leaveTypeId: string;
  leaveType?: LeaveType;
  entitlementDays: number;
  usedDays: number;
  pendingDays: number;
  carriedOverDays: number;
  year: number;
  availableDays: number;
}

// Leave Request Interface
export interface LeaveRequest {
  id: string;
  orgId: string;
  userId: string;
  employee?: Employee;
  leaveTypeId: string;
  leaveType?: LeaveType;
  startDate: string;
  endDate: string;
  duration: 'FULL' | 'AM' | 'PM';
  days: number;
  reason?: string;
  attachmentUrl?: string;
  status: LeaveRequestStatus;
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;
  createdAt: string;
}

// Activity/Audit Log Interface
export interface Activity {
  id: string;
  orgId: string;
  actorId: string;
  actor?: Employee;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'EXPORT' | 'APPROVE' | 'REJECT';
  entityType: string;
  entityId: string;
  metadata?: {
    before?: any;
    after?: any;
  };
  ipAddress?: string;
  userAgent?: string;
  timestamp: string;
}

// Dashboard Interfaces
export interface AdminDashboard {
  todayAttendance: TodayAttendance;
  laborCostSummary: LaborCostSummary;
  overtimeAlerts: OvertimeAlert[];
  upcomingLeave: UpcomingLeave[];
  pendingApprovals: PendingApprovals;
}

export interface TodayAttendance {
  present: number;
  absent: number;
  onLeave: number;
  late: number;
  total: number;
}

export interface LaborCostSummary {
  today: number;
  lastWeek: number;
  budget: number;
  variance: number;
}

export interface OvertimeAlert {
  employeeId: string;
  employeeName: string;
  hoursThisWeek: number;
  threshold: number;
}

export interface UpcomingLeave {
  employeeId: string;
  employeeName: string;
  startDate: string;
  endDate: string;
  days: number;
}

export interface PendingApprovals {
  timesheets: number;
  leaveRequests: number;
  timeEdits: number;
}

export interface ManagerDashboard {
  teamAttendanceRate: number;
  lateArrivalsThisWeek: number;
  pendingApprovals: PendingApprovals;
  shiftCoverageHealth: ShiftCoverageHealth;
  teamMembers: Employee[];
}

export interface ShiftCoverageHealth {
  healthy: number;
  understaffed: number;
  overstaffed: number;
}

export interface EmployeeDashboard {
  currentPayPeriod: CurrentPayPeriod;
  leaveBalances: LeaveBalance[];
  upcomingShifts: Shift[];
  isClockedIn: boolean;
  currentTimeEntry?: TimeEntry;
}

export interface CurrentPayPeriod {
  start: string;
  end: string;
  hoursWorked: number;
  regularHours: number;
  overtimeHours: number;
}

// Report Interfaces
export interface AttendanceReport {
  date: string;
  employees: AttendanceRecord[];
}

export interface AttendanceRecord {
  employeeId: string;
  employeeName: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'ON_LEAVE';
  clockIn?: string;
  clockOut?: string;
  hoursWorked?: number;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Auth Types
export interface AuthResponse {
  accessToken: string;
  refreshToken?: string;
  user: User;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  name: string;
  email: string;
  password: string;
}

export interface CreateOrgData {
  name: string;
  plan: PlanType;
  location?: string;
  type?: string;
  industry?: string;
}

// Notification Interface
export interface Notification {
  id: string;
  userId: string;
  orgId: string;
  type: string;
  title: string;
  message: string;
  data?: any;
  read: boolean;
  createdAt: string;
}

// Geolocation Types
export interface GeolocationPosition {
  coords: {
    latitude: number;
    longitude: number;
    accuracy: number;
    altitude?: number;
    altitudeAccuracy?: number;
    heading?: number;
    speed?: number;
  };
  timestamp: number;
}

// Filter Types
export interface EmployeeFilter {
  department?: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'ALL';
  location?: string;
  manager?: string;
}

export interface TimeEntryFilter {
  startDate?: string;
  endDate?: string;
  userId?: string;
  status?: TimeEntryStatus;
  locationId?: string;
}

export interface LeaveRequestFilter {
  status?: LeaveRequestStatus;
  userId?: string;
  leaveType?: string;
  startDate?: string;
  endDate?: string;
}

// Re-export Organization as Org for convenience
export type Org = Organization;
