// ClockMate Pro - Zustand State Management
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  User, Organization, Employee, Location, Shift, TimeEntry,
  Timesheet, LeaveType, LeaveBalance, LeaveRequest,
  AdminDashboard, ManagerDashboard, EmployeeDashboard, Coordinates,
} from '@/types';

// ==================== AUTH STORE (NO PERSIST - reads from localStorage directly) ====================

interface AuthState {
  user: User | null;
  currentOrg: Organization | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isHydrated: boolean;
  setUser: (user: User | null) => void;
  setCurrentOrg: (org: Organization | null) => void;
  setAuthenticated: (value: boolean) => void;
  setLoading: (value: boolean) => void;
  setHydrated: (value: boolean) => void;
  logout: () => void;
  initFromStorage: () => void;
  refreshFromStorage: () => void; // Re-read role from localStorage
  refreshUser: () => Promise<void>; // Fetch fresh user profile from backend
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  currentOrg: null,
  isAuthenticated: false,
  isLoading: false,
  isHydrated: false,

  setUser: (user) => {
    set({ user, isAuthenticated: !!user });
    // Also sync to localStorage
    if (user) {
      const existing = JSON.parse(localStorage.getItem('user') || '{}');
      localStorage.setItem('user', JSON.stringify({ ...existing, ...user }));
    }
  },

  setCurrentOrg: (org) => {
    set({ currentOrg: org });
    if (org) {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        user.currentOrg = org;
        localStorage.setItem('user', JSON.stringify(user));
      }
    }
  },

  setAuthenticated: (value) => set({ isAuthenticated: value }),
  setLoading: (value) => set({ isLoading: value }),
  setHydrated: (value) => set({ isHydrated: value }),

  logout: () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
    set({ user: null, currentOrg: null, isAuthenticated: false, isHydrated: true });
  },

  initFromStorage: () => {
    try {
      const userStr = localStorage.getItem('user');
      const token = localStorage.getItem('accessToken');
      if (userStr && token) {
        const user = JSON.parse(userStr);
        // Validate: if user has role, use it; if not, default to EMPLOYEE
        if (!user.role) user.role = 'EMPLOYEE';
        set({ user, isAuthenticated: true, currentOrg: user?.currentOrg || null });
      }
    } catch (e) {
      console.error('Failed to init auth from storage', e);
    }
    set({ isHydrated: true });
  },

  // Re-read from localStorage (useful after org creation when role changes to OWNER)
  refreshFromStorage: () => {
    try {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        const currentState = get();
        // Only update if role changed
        if (user.role && user.role !== currentState.user?.role) {
          set({ user: { ...currentState.user, ...user } });
        }
      }
    } catch (e) {
      console.error('Failed to refresh auth from storage', e);
    }
  },

  // Fetch fresh user profile from backend (call after role change)
  refreshUser: async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) return;
      const { getCurrentUser } = await import('@/lib/api');
      const user = await getCurrentUser();
      if (user) {
        set({ user: { ...get().user, ...user } as User, isAuthenticated: true });
        // Sync to localStorage
        const existing = JSON.parse(localStorage.getItem('user') || '{}');
        localStorage.setItem('user', JSON.stringify({ ...existing, ...user }));
      }
    } catch (e) {
      console.error('Failed to refresh user', e);
    }
  },
}));

// ==================== ORGANIZATION STORE ====================

interface OrgState {
  currentOrg: Organization | null;
  orgs: Organization[];
  setCurrentOrg: (org: Organization | null) => void;
  setOrgs: (orgs: Organization[]) => void;
  addOrg: (org: Organization) => void;
}

export const useOrgStore = create<OrgState>()(
  persist(
    (set) => ({
      currentOrg: null,
      orgs: [],
      setCurrentOrg: (org) => set({ currentOrg: org }),
      setOrgs: (orgs) => set({ orgs }),
      addOrg: (org) => set((state) => ({ orgs: [...state.orgs, org] })),
    }),
    {
      name: 'org-storage',
      partialize: (state) => ({ currentOrg: state.currentOrg, orgs: state.orgs }),
    }
  )
);

// ==================== CLOCK STORE ====================

interface ClockState {
  isClockedIn: boolean;
  currentTimeEntry: TimeEntry | null;
  isLoading: boolean;
  error: string | null;
  userLocation: Coordinates | null;
  locationStatus: 'idle' | 'loading' | 'success' | 'error';
  withinGeofence: boolean;
  nearestLocation: Location | null;
  distanceToLocation: number | null;
  setClockedIn: (value: boolean) => void;
  setCurrentTimeEntry: (entry: TimeEntry | null) => void;
  setLoading: (value: boolean) => void;
  setError: (error: string | null) => void;
  setUserLocation: (location: Coordinates | null) => void;
  setLocationStatus: (status: 'idle' | 'loading' | 'success' | 'error') => void;
  setWithinGeofence: (value: boolean) => void;
  setNearestLocation: (location: Location | null) => void;
  setDistanceToLocation: (distance: number | null) => void;
  reset: () => void;
}

export const useClockStore = create<ClockState>((set) => ({
  isClockedIn: false,
  currentTimeEntry: null,
  isLoading: false,
  error: null,
  userLocation: null,
  locationStatus: 'idle',
  withinGeofence: false,
  nearestLocation: null,
  distanceToLocation: null,
  setClockedIn: (value) => set({ isClockedIn: value }),
  setCurrentTimeEntry: (entry) => set({ currentTimeEntry: entry }),
  setLoading: (value) => set({ isLoading: value }),
  setError: (error) => set({ error }),
  setUserLocation: (location) => set({ userLocation: location }),
  setLocationStatus: (status) => set({ locationStatus: status }),
  setWithinGeofence: (value) => set({ withinGeofence: value }),
  setNearestLocation: (location) => set({ nearestLocation: location }),
  setDistanceToLocation: (distance) => set({ distanceToLocation: distance }),
  reset: () => set({
    isClockedIn: false, currentTimeEntry: null, isLoading: false, error: null,
    userLocation: null, locationStatus: 'idle', withinGeofence: false,
    nearestLocation: null, distanceToLocation: null,
  }),
}));

// ==================== DASHBOARD STORE ====================

interface DashboardState {
  adminDashboard: AdminDashboard | null;
  managerDashboard: ManagerDashboard | null;
  employeeDashboard: EmployeeDashboard | null;
  isLoading: boolean;
  setAdminDashboard: (data: AdminDashboard | null) => void;
  setManagerDashboard: (data: ManagerDashboard | null) => void;
  setEmployeeDashboard: (data: EmployeeDashboard | null) => void;
  setLoading: (value: boolean) => void;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  adminDashboard: null, managerDashboard: null, employeeDashboard: null, isLoading: false,
  setAdminDashboard: (data) => set({ adminDashboard: data }),
  setManagerDashboard: (data) => set({ managerDashboard: data }),
  setEmployeeDashboard: (data) => set({ employeeDashboard: data }),
  setLoading: (value) => set({ isLoading: value }),
}));

// ==================== EMPLOYEE STORE ====================

interface EmployeeState {
  employees: Employee[];
  selectedEmployee: Employee | null;
  isLoading: boolean;
  setEmployees: (employees: Employee[]) => void;
  addEmployee: (employee: Employee) => void;
  updateEmployee: (employee: Employee) => void;
  removeEmployee: (id: string) => void;
  setSelectedEmployee: (employee: Employee | null) => void;
  setLoading: (value: boolean) => void;
}

export const useEmployeeStore = create<EmployeeState>((set) => ({
  employees: [], selectedEmployee: null, isLoading: false,
  setEmployees: (employees) => set({ employees }),
  addEmployee: (employee) => set((state) => ({ employees: [...state.employees, employee] })),
  updateEmployee: (employee) => set((state) => ({ employees: state.employees.map((e) => (e.id === employee.id ? employee : e)) })),
  removeEmployee: (id) => set((state) => ({ employees: state.employees.filter((e) => e.id !== id) })),
  setSelectedEmployee: (employee) => set({ selectedEmployee: employee }),
  setLoading: (value) => set({ isLoading: value }),
}));

// ==================== SHIFT STORE ====================

interface ShiftState {
  shifts: Shift[];
  selectedShift: Shift | null;
  isLoading: boolean;
  setShifts: (shifts: Shift[]) => void;
  addShift: (shift: Shift) => void;
  updateShift: (shift: Shift) => void;
  removeShift: (id: string) => void;
  setSelectedShift: (shift: Shift | null) => void;
  setLoading: (value: boolean) => void;
}

export const useShiftStore = create<ShiftState>((set) => ({
  shifts: [], selectedShift: null, isLoading: false,
  setShifts: (shifts) => set({ shifts }),
  addShift: (shift) => set((state) => ({ shifts: [...state.shifts, shift] })),
  updateShift: (shift) => set((state) => ({ shifts: state.shifts.map((s) => (s.id === shift.id ? shift : s)) })),
  removeShift: (id) => set((state) => ({ shifts: state.shifts.filter((s) => s.id !== id) })),
  setSelectedShift: (shift) => set({ selectedShift: shift }),
  setLoading: (value) => set({ isLoading: value }),
}));

// ==================== TIMESHEET STORE ====================

interface TimesheetState {
  timesheets: Timesheet[];
  selectedTimesheet: Timesheet | null;
  isLoading: boolean;
  setTimesheets: (timesheets: Timesheet[]) => void;
  addTimesheet: (timesheet: Timesheet) => void;
  updateTimesheet: (timesheet: Timesheet) => void;
  setSelectedTimesheet: (timesheet: Timesheet | null) => void;
  setLoading: (value: boolean) => void;
}

export const useTimesheetStore = create<TimesheetState>((set) => ({
  timesheets: [], selectedTimesheet: null, isLoading: false,
  setTimesheets: (timesheets) => set({ timesheets }),
  addTimesheet: (timesheet) => set((state) => ({ timesheets: [...state.timesheets, timesheet] })),
  updateTimesheet: (timesheet) => set((state) => ({ timesheets: state.timesheets.map((t) => (t.id === timesheet.id ? timesheet : t)) })),
  setSelectedTimesheet: (timesheet) => set({ selectedTimesheet: timesheet }),
  setLoading: (value) => set({ isLoading: value }),
}));

// ==================== LEAVE STORE ====================

interface LeaveState {
  leaveTypes: LeaveType[];
  leaveBalances: LeaveBalance[];
  leaveRequests: LeaveRequest[];
  isLoading: boolean;
  setLeaveTypes: (types: LeaveType[]) => void;
  setLeaveBalances: (balances: LeaveBalance[]) => void;
  setLeaveRequests: (requests: LeaveRequest[]) => void;
  addLeaveRequest: (request: LeaveRequest) => void;
  updateLeaveRequest: (request: LeaveRequest) => void;
  setLoading: (value: boolean) => void;
}

export const useLeaveStore = create<LeaveState>((set) => ({
  leaveTypes: [], leaveBalances: [], leaveRequests: [], isLoading: false,
  setLeaveTypes: (types) => set({ leaveTypes: types }),
  setLeaveBalances: (balances) => set({ leaveBalances: balances }),
  setLeaveRequests: (requests) => set({ leaveRequests: requests }),
  addLeaveRequest: (request) => set((state) => ({ leaveRequests: [...state.leaveRequests, request] })),
  updateLeaveRequest: (request) => set((state) => ({ leaveRequests: state.leaveRequests.map((r) => (r.id === request.id ? request : r)) })),
  setLoading: (value) => set({ isLoading: value }),
}));

// ==================== LOCATION STORE ====================

interface LocationState {
  locations: Location[];
  selectedLocation: Location | null;
  isLoading: boolean;
  setLocations: (locations: Location[]) => void;
  addLocation: (location: Location) => void;
  updateLocation: (location: Location) => void;
  removeLocation: (id: string) => void;
  setSelectedLocation: (location: Location | null) => void;
  setLoading: (value: boolean) => void;
}

export const useLocationStore = create<LocationState>((set) => ({
  locations: [], selectedLocation: null, isLoading: false,
  setLocations: (locations) => set({ locations }),
  addLocation: (location) => set((state) => ({ locations: [...state.locations, location] })),
  updateLocation: (location) => set((state) => ({ locations: state.locations.map((l) => (l.id === location.id ? location : l)) })),
  removeLocation: (id) => set((state) => ({ locations: state.locations.filter((l) => l.id !== id) })),
  setSelectedLocation: (location) => set({ selectedLocation: location }),
  setLoading: (value) => set({ isLoading: value }),
}));

// ==================== UI STORE ====================

interface UIState {
  sidebarOpen: boolean;
  isMobile: boolean;
  setSidebarOpen: (value: boolean) => void;
  toggleSidebar: () => void;
  setIsMobile: (value: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true, isMobile: false,
  setSidebarOpen: (value) => set({ sidebarOpen: value }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setIsMobile: (value) => set({ isMobile: value }),
}));
