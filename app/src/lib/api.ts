// ClockMate Pro - Real API Client
import type {
  User,
  Organization,
  Employee,
  Location,
  Shift,
  TimeEntry,
  Timesheet,
  LeaveType,
  LeaveBalance,
  LeaveRequest,
  Invite,
  Payslip,
  AuthResponse,
  CreateOrgData,
  Org,
  ManualEntryRequest,
  SwapRequest,
  LocationCreateData,
  PayslipCreatePayload,
  Template,
} from '@/types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// Helper to get auth token
const getToken = (): string | null => {
  return localStorage.getItem('accessToken');
};

// Generic API request function
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const token = getToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers as Record<string, string>,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'API request failed');
  }

  return data;
}

// ==================== AUTH API ====================

export async function startPasswordAuth(email: string, password: string): Promise<AuthResponse> {
  return apiRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function registerUser(name: string, email: string, password: string): Promise<AuthResponse> {
  return apiRequest('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, password }),
  });
}

export async function logout(): Promise<void> {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('user');
}

export async function getCurrentUser(): Promise<User | null> {
  try {
    return await apiRequest('/auth/me');
  } catch (err: unknown) {
    const error = err as Error;
    console.error('[API] getCurrentUser failed:', error.message);
    return null;
  }
}

// ==================== ORGANIZATION API ====================

export async function getOrgs(): Promise<Organization[]> {
  return apiRequest('/orgs');
}

export async function createOrg(data: CreateOrgData): Promise<Organization> {
  return apiRequest('/orgs', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getOrgById(orgId: string): Promise<Organization> {
  return apiRequest(`/orgs/${orgId}`);
}

export async function updateOrg(orgId: string, data: Partial<Organization>): Promise<Organization> {
  return apiRequest(`/orgs/${orgId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// ==================== EMPLOYEE API ====================

export async function getEmployees(orgId: string): Promise<Employee[]> {
  return apiRequest(`/employees?orgId=${orgId}`);
}

export async function getEmployeeById(employeeId: string): Promise<Employee> {
  return apiRequest(`/employees/${employeeId}`);
}

export async function updateEmployee(employeeId: string, data: Partial<Employee>): Promise<Employee> {
  return apiRequest(`/employees/${employeeId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteEmployee(employeeId: string): Promise<void> {
  return apiRequest(`/employees/${employeeId}`, {
    method: 'DELETE',
  });
}

export async function createEmployee(data: Partial<Employee>): Promise<Employee> {
  return apiRequest('/employees', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ==================== LOCATION API ====================

export async function getLocations(orgId: string): Promise<Location[]> {
  return apiRequest(`/locations?orgId=${orgId}`);
}

export async function createLocation(data: Partial<Location>): Promise<Location> {
  return apiRequest('/locations', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ==================== TEMPLATE API ====================

export async function getTemplates(orgId: string): Promise<Template[]> {
  return apiRequest(`/templates?orgId=${orgId}`);
}

export async function createTemplate(data: Partial<Template>): Promise<Template> {
  return apiRequest('/templates', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function applyTemplate(templateId: string, startDate: string, endDate: string): Promise<any> {
  return apiRequest(`/templates/${templateId}/apply`, {
    method: 'POST',
    body: JSON.stringify({ startDate, endDate }),
  });
}

export async function deleteTemplate(templateId: string): Promise<void> {
  return apiRequest(`/templates/${templateId}`, { method: 'DELETE' });
}

// ==================== SHIFT API ====================

export async function getShifts(orgId: string, startDate?: string, endDate?: string): Promise<Shift[]> {
  let url = `/shifts?orgId=${orgId}`;
  if (startDate) url += `&startDate=${startDate}`;
  if (endDate) url += `&endDate=${endDate}`;
  return apiRequest(url);
}

export async function createShift(data: Partial<Shift>): Promise<Shift> {
  return apiRequest('/shifts', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateShift(shiftId: string, data: Partial<Shift>): Promise<Shift> {
  return apiRequest(`/shifts/${shiftId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteShift(shiftId: string): Promise<void> {
  return apiRequest(`/shifts/${shiftId}`, { method: 'DELETE' });
}

export async function assignEmployeeToShift(shiftId: string, userId: string): Promise<Shift> {
  return apiRequest(`/shifts/${shiftId}/assign`, {
    method: 'PUT',
    body: JSON.stringify({ userId }),
  });
}

export async function unassignEmployeeFromShift(shiftId: string, userId: string): Promise<Shift> {
  return apiRequest(`/shifts/${shiftId}/unassign`, {
    method: 'PUT',
    body: JSON.stringify({ userId }),
  });
}

export async function bulkCreateShifts(shifts: Partial<Shift>[]): Promise<{ message: string; shifts: Shift[] }> {
  return apiRequest('/shifts/bulk', {
    method: 'POST',
    body: JSON.stringify({ shifts }),
  });
}

// ==================== TIME ENTRY API ====================

export async function getTimeEntries(orgId: string, filters?: { userId?: string; startDate?: string; endDate?: string }): Promise<TimeEntry[]> {
  let url = `/time-entries?orgId=${orgId}`;
  if (filters?.userId) url += `&userId=${filters.userId}`;
  if (filters?.startDate) url += `&startDate=${filters.startDate}`;
  if (filters?.endDate) url += `&endDate=${filters.endDate}`;
  return apiRequest(url);
}

export async function clockIn(data: {
  orgId: string;
  userId: string;
  location?: { lat: number; lng: number };
  accuracy?: number;
  method: string;
  notes?: string;
  photoBase64?: string;
}): Promise<TimeEntry> {
  return apiRequest('/time-entries/clock-in', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function clockOut(data: {
  entryId: string;
  location?: { lat: number; lng: number };
  accuracy?: number;
  method: string;
  notes?: string;
}): Promise<TimeEntry> {
  return apiRequest('/time-entries/clock-out', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function startBreak(entryId: string, type: 'PAID' | 'UNPAID'): Promise<TimeEntry> {
  return apiRequest(`/time-entries/${entryId}/break-start`, {
    method: 'POST',
    body: JSON.stringify({ type }),
  });
}

export async function endBreak(entryId: string, breakId: string): Promise<TimeEntry> {
  return apiRequest(`/time-entries/${entryId}/break-end`, {
    method: 'POST',
  });
}

export async function getCurrentTimeEntry(userId: string): Promise<TimeEntry | null> {
  try {
    return await apiRequest(`/time-entries/current/${userId}`);
  } catch (err: unknown) {
    const error = err as Error;
    console.error('[API] getCurrentTimeEntry failed:', error.message);
    return null;
  }
}

// ==================== TIMESHEET API ====================

export async function getTimesheets(orgId: string, filters?: { userId?: string; status?: string }): Promise<Timesheet[]> {
  let url = `/timesheets?orgId=${orgId}`;
  if (filters?.userId) url += `&userId=${filters.userId}`;
  if (filters?.status) url += `&status=${filters.status}`;
  return apiRequest(url);
}

export async function createTimesheet(data: Partial<Timesheet>): Promise<Timesheet> {
  return apiRequest('/timesheets', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function submitTimesheet(timesheetId: string): Promise<Timesheet> {
  return apiRequest(`/timesheets/${timesheetId}/submit`, {
    method: 'POST',
  });
}

export async function approveTimesheet(timesheetId: string, approvedBy: string): Promise<Timesheet> {
  return apiRequest(`/timesheets/${timesheetId}/approve`, {
    method: 'POST',
  });
}

export async function rejectTimesheet(timesheetId: string, reason: string): Promise<Timesheet> {
  return apiRequest(`/timesheets/${timesheetId}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export async function updateTimesheetSettings(orgId: string, settings: Record<string, unknown>): Promise<Organization> {
  return apiRequest(`/orgs/${orgId}/timesheet-settings`, {
    method: 'PUT',
    body: JSON.stringify({ timesheetSettings: settings }),
  });
}

export async function addTimeEntryComment(entryId: string, text: string): Promise<TimeEntry> {
  return apiRequest(`/time-entries/${entryId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
}

export async function updateTimeEntry(entryId: string, data: Record<string, unknown>): Promise<TimeEntry> {
  return apiRequest(`/time-entries/${entryId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// ==================== LEAVE API ====================

export async function getLeaveTypes(orgId: string): Promise<LeaveType[]> {
  return apiRequest(`/leave/types?orgId=${orgId}`);
}

export async function getLeaveBalances(userId: string): Promise<LeaveBalance[]> {
  return apiRequest(`/leave/balances/${userId}`);
}

export async function getLeaveRequests(orgId: string, filters?: { userId?: string; status?: string }): Promise<LeaveRequest[]> {
  let url = `/leave/requests?orgId=${orgId}`;
  if (filters?.userId) url += `&userId=${filters.userId}`;
  if (filters?.status) url += `&status=${filters.status}`;
  return apiRequest(url);
}

export async function createLeaveRequest(data: Partial<LeaveRequest>): Promise<LeaveRequest> {
  return apiRequest('/leave/requests', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function approveLeaveRequest(requestId: string, approvedBy: string): Promise<LeaveRequest> {
  return apiRequest(`/leave/requests/${requestId}/approve`, {
    method: 'POST',
  });
}

export async function rejectLeaveRequest(requestId: string, reason: string): Promise<LeaveRequest> {
  return apiRequest(`/leave/requests/${requestId}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

// ==================== INVITE API ====================

export async function getInvites(orgId: string): Promise<Invite[]> {
  return apiRequest(`/invites?orgId=${orgId}`);
}

export async function createInvite(data: Partial<Invite>): Promise<Invite> {
  return apiRequest('/invites', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function cancelInvite(inviteId: string): Promise<void> {
  return apiRequest(`/invites/${inviteId}`, {
    method: 'DELETE',
  });
}

// ==================== UNIFIED ADD/INVITE API ====================

export async function addOrInviteEmployee(data: {
  email: string;
  role?: string;
  department?: string;
  position?: string;
  employmentType?: string;
  payRate?: number;
  payType?: string;
  employeeId?: string;
  orgId?: string;
}): Promise<{ action: 'ADDED' | 'INVITED'; message: string; employee: Employee }> {
  return apiRequest('/employees/add-or-invite', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ==================== PAYSLIP API ====================

export async function getPayslips(orgId: string, filters?: { userId?: string; status?: string }): Promise<Payslip[]> {
  let url = `/payslips?orgId=${orgId}`;
  if (filters?.userId) url += `&userId=${filters.userId}`;
  if (filters?.status) url += `&status=${filters.status}`;
  return apiRequest(url);
}

export async function getPayslipById(payslipId: string): Promise<Payslip> {
  return apiRequest(`/payslips/${payslipId}`);
}

export async function createPayslip(data: Partial<Payslip>): Promise<Payslip> {
  return apiRequest('/payslips', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updatePayslipStatus(payslipId: string, status: string): Promise<Payslip> {
  return apiRequest(`/payslips/${payslipId}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  });
}

export async function deletePayslip(payslipId: string): Promise<void> {
  return apiRequest(`/payslips/${payslipId}`, {
    method: 'DELETE',
  });
}

export async function autoGenerateTimesheet(data: { userId?: string; orgId: string; startDate: string; endDate: string }): Promise<Timesheet> {
  return apiRequest('/timesheets/auto-generate', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ==================== DASHBOARD API ====================

export async function getAdminDashboard(orgId: string): Promise<import('@/types').DashboardData> {
  return apiRequest(`/dashboard/admin/${orgId}`);
}

export async function getManagerDashboard(orgId: string, _managerId: string): Promise<import('@/types').DashboardData> {
  return apiRequest(`/dashboard/manager/${orgId}`);
}

export async function getEmployeeDashboard(orgId: string, userId: string): Promise<import('@/types').EmployeeDashboard> {
  return apiRequest(`/dashboard/employee/${orgId}/${userId}`);
}

// ==================== USER API ====================

export async function updateUser(userId: string, data: Partial<User>): Promise<User> {
  return apiRequest(`/users/${userId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function uploadAvatar(userId: string, file: File): Promise<{ avatar: string }> {
  const url = `${API_BASE_URL}/users/${userId}/avatar`;
  const token = getToken();
  const formData = new FormData();
  formData.append('avatar', file);
  const response = await fetch(url, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Avatar upload failed');
  return data;
}

// ==================== ORG SETTINGS API ====================

export async function updateOrgNotifications(orgId: string, notifications: Record<string, boolean>): Promise<Organization> {
  return apiRequest(`/orgs/${orgId}/notifications`, {
    method: 'PUT',
    body: JSON.stringify(notifications),
  });
}

// ==================== LOCATION API (Full CRUD) ====================

export async function updateLocation(locationId: string, data: Partial<Location>): Promise<Location> {
  return apiRequest(`/locations/${locationId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteLocation(locationId: string): Promise<void> {
  return apiRequest(`/locations/${locationId}`, { method: 'DELETE' });
}

// ==================== MANUAL TIME ENTRY API ====================

export async function createManualTimeEntry(data: ManualEntryRequest): Promise<TimeEntry> {
  return apiRequest('/time-entries/manual', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getPendingManualEntries(orgId: string): Promise<TimeEntry[]> {
  return apiRequest(`/time-entries/pending-manual?orgId=${orgId}`);
}

export async function approveManualEntry(entryId: string): Promise<TimeEntry> {
  return apiRequest(`/time-entries/${entryId}/approve-manual`, { method: 'POST' });
}

export async function rejectManualEntry(entryId: string, reason: string): Promise<TimeEntry> {
  return apiRequest(`/time-entries/${entryId}/reject-manual`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

// ==================== SHIFT SWAP API ====================

export async function createSwapRequest(data: {
  shiftId: string;
  fromEmployeeId: string;
  toEmployeeId: string;
  reason?: string;
}): Promise<SwapRequest> {
  return apiRequest('/shifts/swap-request', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getSwapRequests(orgId: string): Promise<SwapRequest[]> {
  return apiRequest(`/shifts/swap-requests?orgId=${orgId}`);
}

export async function approveSwapRequest(requestId: string): Promise<SwapRequest> {
  return apiRequest(`/shifts/swap-requests/${requestId}/approve`, { method: 'POST' });
}

export async function rejectSwapRequest(requestId: string, reason?: string): Promise<SwapRequest> {
  return apiRequest(`/shifts/swap-requests/${requestId}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

// ==================== PAYSLIP PDF API ====================

export async function getPayslipPdf(payslipId: string): Promise<Blob> {
  const url = `${API_BASE_URL}/payslips/${payslipId}/pdf`;
  const token = getToken();
  const response = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) throw new Error('Failed to download PDF');
  return response.blob();
}

// ==================== GEOFENCE UTILITIES ====================

export function calculateDistance(coord1: { lat: number; lng: number }, coord2: { lat: number; lng: number }): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = coord1.lat * Math.PI / 180;
  const φ2 = coord2.lat * Math.PI / 180;
  const Δφ = ((coord2.lat - coord1.lat) * Math.PI) / 180;
  const Δλ = ((coord2.lng - coord1.lng) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

export function isWithinGeofence(
  userLocation: { lat: number; lng: number },
  geofence: any
): boolean {
  if (geofence.type === 'CIRCLE' && geofence.center && geofence.radius) {
    const distance = calculateDistance(userLocation, geofence.center);
    return distance <= geofence.radius;
  }
  return false;
}

// Re-export types for convenience
export type { Org };
