// ClockMate Pro - Team Management Page (Unified Add Employee)
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { 
  Users, 
  Plus, 
  Search, 
  Mail, 
  Phone, 
  MapPin,
  Loader2,
  MoreHorizontal,
  UserCircle,
  Briefcase,
  DollarSign,
  X,
  Clock,
  CheckCircle2,
  UserPlus,
  Ban,
  ArrowLeft,
  Edit3,
  Trash2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ExternalLink
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { getEmployees, addOrInviteEmployee, updateEmployee, deleteEmployee, getInvites, cancelInvite, getShifts } from '@/lib/api';
import { useEmployeeStore, useAuthStore } from '@/store';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { logger } from '@/lib/logger';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import type { Employee, Invite, Shift } from '@/types';

const DEPARTMENTS = ['Engineering','Sales','Marketing','HR','Finance','Operations','Customer Support','IT','Legal','Administration','General'];
const POSITIONS = ['Manager','Senior Engineer','Engineer','Junior Engineer','Team Lead','Specialist','Analyst','Coordinator','Director','VP','Intern','Consultant','Employee'];
const EMPLOYMENT_TYPES = [
  { value: 'FULL_TIME', label: 'Full Time' },
  { value: 'PART_TIME', label: 'Part Time' },
  { value: 'CASUAL', label: 'Casual' },
  { value: 'CONTRACTOR', label: 'Contractor' },
];

export default function TeamPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const { user, refreshUser } = useAuthStore();
  const { employees, setEmployees, addEmployee, removeEmployee } = useEmployeeStore();
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [activeTab, setActiveTab] = useState('members');
  
  // Confirm dialog
  const [confirmDialog, setConfirmDialog] = useState({
    open: false, title: '', description: '', variant: 'default' as 'default' | 'destructive',
    onConfirm: () => {}, onCancel: () => {},
  });

  // Add Employee Dialog
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Add form - unified: just email + details, backend decides add or invite
  const [addForm, setAddForm] = useState({
    email: '',
    role: 'EMPLOYEE',
    department: 'General',
    position: 'Employee',
    employmentType: 'FULL_TIME',
    payRate: '25',
    payType: 'HOURLY' as 'HOURLY' | 'SALARY',
  });
  const [addErrors, setAddErrors] = useState<Record<string, string>>({});

  // Edit Employee Dialog
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [editForm, setEditForm] = useState({
    department: '', position: '', employmentType: 'FULL_TIME',
    payRate: '', payType: 'HOURLY' as 'HOURLY' | 'SALARY',
    isActive: true, role: 'EMPLOYEE',
  });
  const [editing, setEditing] = useState(false);

  // Employee Schedule dialog
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [scheduleEmployee, setScheduleEmployee] = useState<Employee | null>(null);
  const [employeeShifts, setEmployeeShifts] = useState<Shift[]>([]);
  const [scheduleWeek, setScheduleWeek] = useState(new Date());
  const [loadingShifts, setLoadingShifts] = useState(false);

  useEffect(() => { loadData(); }, [orgId]);

  async function openEmployeeSchedule(emp: Employee) {
    setScheduleEmployee(emp);
    setScheduleDialogOpen(true);
    setLoadingShifts(true);
    try {
      const ws = new Date(scheduleWeek); ws.setDate(ws.getDate() - ws.getDay() + 1);
      const we = new Date(ws); we.setDate(we.getDate() + 6);
      const shifts = await getShifts(orgId!, ws.toISOString(), we.toISOString());
      // Filter to only this employee's shifts
      const empShifts = shifts.filter((s: any) => {
        const assignedIds = (s.assignedTo || []).map((a: any) => typeof a === 'string' ? a : a.id);
        return assignedIds.includes(emp.userId) || assignedIds.includes(emp.id);
      });
      setEmployeeShifts(empShifts);
    } catch (e) { toast.error('Failed to load employee schedule'); }
    finally { setLoadingShifts(false); }
  }

  async function loadData() {
    if (!orgId) return;
    try {
      setLoading(true);
      const [emps, invs] = await Promise.all([
        getEmployees(orgId),
        getInvites(orgId),
      ]);
      setEmployees(emps);
      setInvites(invs);
    } catch (error) {
      toast.error('Failed to load team data');
    } finally {
      setLoading(false);
    }
  }

  // ============ ADD EMPLOYEE (Unified) ============
  const validateAdd = () => {
    const e: Record<string, string> = {};
    if (!addForm.email.trim()) e.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addForm.email)) e.email = 'Invalid email';
    setAddErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleAddEmployee = async () => {
    if (!orgId || !validateAdd()) return;
    try {
      setSubmitting(true);
      const result = await addOrInviteEmployee({
        orgId,
        email: addForm.email.trim(),
        role: addForm.role,
        department: addForm.department,
        position: addForm.position,
        employmentType: addForm.employmentType,
        payRate: addForm.payRate ? Number(addForm.payRate) : undefined,
        payType: addForm.payType,
      });

      addEmployee(result.employee);
      toast.success(result.message);
      setIsAddDialogOpen(false);
      resetAddForm();
      
      // Reload to get fresh data
      if (result.action === 'INVITED') {
        loadData(); // Refresh invites list too
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to add employee');
    } finally { setSubmitting(false); }
  };

  const resetAddForm = () => {
    setAddForm({
      email: '', role: 'EMPLOYEE', department: 'General',
      position: 'Employee', employmentType: 'FULL_TIME',
      payRate: '25', payType: 'HOURLY'
    });
    setAddErrors({});
  };

  // ============ EDIT EMPLOYEE ============
  const openEditDialog = (emp: Employee) => {
    setEditingEmployee(emp);
    setEditForm({
      department: emp.department,
      position: emp.position,
      employmentType: emp.employmentType,
      payRate: emp.payRate?.toString() || '',
      payType: emp.payType || 'HOURLY',
      isActive: emp.isActive,
      role: emp.role || 'EMPLOYEE',
    });
    setIsEditDialogOpen(true);
  };

  const handleEditEmployee = async () => {
    if (!editingEmployee) return;
    try {
      setEditing(true);
      const updateData: Record<string, unknown> = {
        department: editForm.department,
        position: editForm.position,
        employmentType: editForm.employmentType,
        payRate: editForm.payRate ? Number(editForm.payRate) : undefined,
        payType: editForm.payType,
        isActive: editForm.isActive,
      };
      // Only include role if it changed (triggers User role sync on backend)
      if (editForm.role && editForm.role !== editingEmployee.role) {
        updateData.role = editForm.role;
      }
      await updateEmployee(editingEmployee.id, updateData);
      toast.success('Employee updated');
      setIsEditDialogOpen(false);
      loadData();
      // Refresh current user's role if they changed their own role
      if (editingEmployee.userId === user?.id && updateData.role) {
        await refreshUser();
        toast.info('Your role has been updated. Refresh the page if menus don\'t update.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to update employee');
    } finally { setEditing(false); }
  };

  // ============ DELETE EMPLOYEE ============
  const handleDeleteEmployee = async (empId: string) => {
    setConfirmDialog({
      open: true,
      title: 'Remove Employee',
      description: 'Are you sure you want to remove this employee?',
      variant: 'destructive',
      onConfirm: async () => {
        try {
          await deleteEmployee(empId);
          removeEmployee(empId);
          toast.success('Employee removed');
          loadData();
        } catch (err: unknown) {
          toast.error((err as Error).message || 'Failed to remove employee');
        }
      },
      onCancel: () => setConfirmDialog(p => ({ ...p, open: false })),
    });
  };

  // ============ CANCEL INVITE ============
  const handleCancelInvite = async (inviteId: string) => {
    try {
      await cancelInvite(inviteId);
      toast.success('Invite cancelled');
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to cancel invite');
    }
  };

  // ============ FILTERS ============
  const filtered = employees.filter(emp => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q || emp.firstName?.toLowerCase().includes(q) ||
      emp.lastName?.toLowerCase().includes(q) || emp.email?.toLowerCase().includes(q) ||
      emp.position?.toLowerCase().includes(q) || (emp.employeeId && emp.employeeId.toLowerCase().includes(q));
    const matchesDept = filterDepartment === 'all' || emp.department === filterDepartment;
    const matchesStatus = filterStatus === 'all' ||
      (filterStatus === 'joined' && emp.inviteStatus === 'JOINED') ||
      (filterStatus === 'invited' && emp.inviteStatus === 'INVITED') ||
      (filterStatus === 'active' && emp.isActive && emp.inviteStatus !== 'INVITED') ||
      (filterStatus === 'inactive' && !emp.isActive);
    return matchesSearch && matchesDept && matchesStatus;
  });

  const departments = Array.from(new Set(employees.map(e => e.department)));

  const getEmpTypeColor = (type: string) => {
    switch (type) {
      case 'FULL_TIME': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'PART_TIME': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'CASUAL': return 'bg-purple-100 text-purple-700 border-purple-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="size-8 animate-spin text-blue-600" /></div>;

  return (
    <div className="space-y-6">
      {/* Back indicator */}
      <div className="flex items-center gap-2">
        <ArrowLeft className="size-4 text-slate-400" />
        <span className="text-sm text-slate-500">Team Management</span>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Team</h2>
          <p className="text-sm text-slate-500">
            {employees.filter(e => e.inviteStatus === 'JOINED').length} joined • {employees.filter(e => e.inviteStatus === 'INVITED').length} invited • {employees.length} total
          </p>
        </div>
        
        {/* SINGLE Add Employee Button */}
        <Dialog open={isAddDialogOpen} onOpenChange={(o) => { setIsAddDialogOpen(o); if (!o) resetAddForm(); }}>
          <DialogTrigger asChild>
            <Button><UserPlus className="size-4 mr-2" />Add Employee</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserPlus className="size-5" />
                Add Employee
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-5 py-4">
              {/* Info text */}
              <p className="text-sm text-slate-600 bg-blue-50 p-3 rounded-lg border border-blue-100">
                Enter the employee's email and details. If they already have an account, they'll be added immediately. If not, they'll receive an invitation to join.
              </p>

              {/* Email */}
              <div>
                <label className="text-sm font-medium">Email Address *</label>
                <Input 
                  type="email" 
                  value={addForm.email} 
                  onChange={e => setAddForm(p => ({ ...p, email: e.target.value }))}
                  className={addErrors.email ? 'border-red-300' : ''} 
                  placeholder="employee@company.com" 
                />
                {addErrors.email && <p className="text-xs text-red-500 mt-1">{addErrors.email}</p>}
              </div>

              {/* Role */}
              <div>
                <label className="text-sm font-medium">Role</label>
                <select 
                  value={addForm.role} 
                  onChange={e => setAddForm(p => ({ ...p, role: e.target.value }))}
                  className="w-full mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="EMPLOYEE">Employee</option>
                  <option value="MANAGER">Manager</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>

              <Separator />

              {/* Employment Details */}
              <h4 className="text-sm font-semibold text-slate-700">Employment Details</h4>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Department</label>
                  <select 
                    value={addForm.department} 
                    onChange={e => setAddForm(p => ({ ...p, department: e.target.value }))}
                    className="w-full mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">Position</label>
                  <select 
                    value={addForm.position} 
                    onChange={e => setAddForm(p => ({ ...p, position: e.target.value }))}
                    className="w-full mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Employment Type</label>
                  <select 
                    value={addForm.employmentType} 
                    onChange={e => setAddForm(p => ({ ...p, employmentType: e.target.value }))}
                    className="w-full mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    {EMPLOYMENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">Pay Rate ($)</label>
                  <Input 
                    type="number" 
                    value={addForm.payRate} 
                    onChange={e => setAddForm(p => ({ ...p, payRate: e.target.value }))}
                    placeholder="25" 
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Pay Type</label>
                <div className="flex gap-2 mt-1">
                  {(['HOURLY','SALARY'] as const).map(t => (
                    <Button key={t} type="button" variant={addForm.payType === t ? 'default' : 'outline'}
                      onClick={() => setAddForm(p => ({ ...p, payType: t }))} className="flex-1" size="sm">
                      {t === 'HOURLY' ? 'Per Hour' : 'Per Year'}
                    </Button>
                  ))}
                </div>
              </div>

              <Button onClick={handleAddEmployee} disabled={submitting} className="w-full">
                {submitting ? <><Loader2 className="size-4 mr-2 animate-spin" />Adding...</> : <><UserPlus className="size-4 mr-2" />Add Employee</>}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
          <Input placeholder="Search by name, email, position..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10" />
        </div>
        <div className="flex gap-2">
          <select value={filterDepartment} onChange={e => setFilterDepartment(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="all">All Departments</option>
            {departments.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="all">All Status</option>
            <option value="joined">Joined</option>
            <option value="invited">Invited</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-blue-50 border-blue-200"><CardContent className="pt-4 pb-3">
          <p className="text-2xl font-bold text-blue-700">{employees.length}</p><p className="text-xs text-blue-600">Total Members</p>
        </CardContent></Card>
        <Card className="bg-emerald-50 border-emerald-200"><CardContent className="pt-4 pb-3">
          <p className="text-2xl font-bold text-emerald-700">{employees.filter(e => e.inviteStatus === 'JOINED').length}</p><p className="text-xs text-emerald-600">Joined</p>
        </CardContent></Card>
        <Card className="bg-amber-50 border-amber-200"><CardContent className="pt-4 pb-3">
          <p className="text-2xl font-bold text-amber-700">{employees.filter(e => e.inviteStatus === 'INVITED').length}</p><p className="text-xs text-amber-600">Invited</p>
        </CardContent></Card>
        <Card className="bg-purple-50 border-purple-200"><CardContent className="pt-4 pb-3">
          <p className="text-2xl font-bold text-purple-700">{departments.length}</p><p className="text-xs text-purple-600">Departments</p>
        </CardContent></Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="members">All Members</TabsTrigger>
          <TabsTrigger value="invited">Invited ({employees.filter(e => e.inviteStatus === 'INVITED').length})</TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(emp => (
              <Card key={emp.id} className="hover:shadow-md transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="size-12">
                        <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-500 text-white font-semibold">
                          {emp.firstName?.[0] || '?'}{emp.lastName?.[0] || ''}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-semibold">{emp.firstName || 'Pending'} {emp.lastName || ''}</p>
                        <p className="text-sm text-slate-500">{emp.position}</p>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="size-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEmployeeSchedule(emp)}>
                          <CalendarDays className="size-4 mr-2" />View Schedule
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openEditDialog(emp)}>
                          <Edit3 className="size-4 mr-2" />Edit Details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDeleteEmployee(emp.id)} className="text-red-600">
                          <Trash2 className="size-4 mr-2" />Remove
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center gap-2 text-sm text-slate-600"><Mail className="size-4 text-slate-400" />{emp.email}</div>
                    {emp.phone && <div className="flex items-center gap-2 text-sm text-slate-600"><Phone className="size-4 text-slate-400" />{emp.phone}</div>}
                    <div className="flex items-center gap-2 text-sm text-slate-600"><MapPin className="size-4 text-slate-400" />{emp.department}</div>
                    {emp.employeeId && <div className="flex items-center gap-2 text-sm text-slate-600"><Briefcase className="size-4 text-slate-400" />ID: {emp.employeeId}</div>}
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className={getEmpTypeColor(emp.employmentType)}>{emp.employmentType?.replace('_', ' ')}</Badge>
                    {emp.inviteStatus === 'INVITED' ? (
                      <Badge variant="secondary" className="bg-amber-100 text-amber-700 border-amber-200"><Clock className="size-3 mr-1" />Invited</Badge>
                    ) : (
                      <Badge variant={emp.isActive ? 'default' : 'secondary'}>{emp.isActive ? 'Active' : 'Inactive'}</Badge>
                    )}
                  </div>
                  {emp.payRate && (
                    <div className="mt-3 pt-3 border-t border-slate-100">
                      <p className="text-sm text-slate-500"><DollarSign className="size-3 inline" />${emp.payRate.toLocaleString()} / {emp.payType === 'HOURLY' ? 'hour' : 'year'}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
          {filtered.length === 0 && (
            <div className="text-center py-12"><Users className="size-12 mx-auto text-slate-300 mb-4" /><p className="text-slate-500">No members found</p></div>
          )}
        </TabsContent>

        <TabsContent value="invited" className="mt-4">
          {employees.filter(e => e.inviteStatus === 'INVITED').length === 0 ? (
            <div className="text-center py-12"><UserPlus className="size-12 mx-auto text-slate-300 mb-4" /><p className="text-slate-500">No pending invites</p><p className="text-sm text-slate-400 mt-1">Add an employee to send your first invitation</p></div>
          ) : (
            <div className="space-y-3">
              {employees.filter(e => e.inviteStatus === 'INVITED').map(emp => (
                <div key={emp.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-4">
                    <div className="size-12 rounded-xl bg-amber-100 flex items-center justify-center">
                      <Clock className="size-6 text-amber-600" />
                    </div>
                    <div>
                      <p className="font-semibold">{emp.firstName || 'Pending'} {emp.lastName || ''}</p>
                      <p className="text-sm text-slate-500">{emp.email}</p>
                      <p className="text-xs text-slate-400">{emp.department} • {emp.position} • ID: {emp.employeeId}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary" className="bg-amber-100 text-amber-700 border-amber-200"><Clock className="size-3 mr-1" />Invited</Badge>
                    <Button variant="outline" size="sm" onClick={() => handleDeleteEmployee(emp.id)} className="text-red-600 border-red-200 hover:bg-red-50">
                      <Ban className="size-4 mr-1" />Cancel
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Edit Employee Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Edit Employee</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Department</label>
                <select 
                  value={editForm.department} 
                  onChange={e => setEditForm(p => ({ ...p, department: e.target.value }))}
                  className="w-full mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Position</label>
                <select 
                  value={editForm.position} 
                  onChange={e => setEditForm(p => ({ ...p, position: e.target.value }))}
                  className="w-full mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Pay Rate</label>
                <Input value={editForm.payRate} onChange={e => setEditForm(p => ({ ...p, payRate: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium">Pay Type</label>
                <div className="flex gap-2 mt-1">
                  {(['HOURLY','SALARY'] as const).map(t => (
                    <Button key={t} type="button" variant={editForm.payType === t ? 'default' : 'outline'}
                      onClick={() => setEditForm(p => ({ ...p, payType: t }))} className="flex-1" size="sm">
                      {t === 'HOURLY' ? 'Hourly' : 'Salary'}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
            {/* Role - CRITICAL: This is what controls permissions */}
            <div>
              <label className="text-sm font-medium">Role (controls permissions)</label>
              <select 
                value={editForm.role} 
                onChange={e => setEditForm(p => ({ ...p, role: e.target.value }))}
                className="w-full mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="EMPLOYEE">Employee - Can clock in/out, view own schedule</option>
                <option value="MANAGER">Manager - Can manage schedules, approve timesheets</option>
                <option value="ADMIN">Admin - Full access except billing/ownership</option>
                <option value="OWNER">Owner - Full system access</option>
              </select>
              <p className="text-xs text-slate-400 mt-1">Changing role updates permissions immediately</p>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <span className="text-sm font-medium">Active</span>
              <input 
                type="checkbox" 
                checked={editForm.isActive} 
                onChange={e => setEditForm(p => ({ ...p, isActive: e.target.checked }))}
                className="size-5"
              />
            </div>
            <Button onClick={handleEditEmployee} disabled={editing} className="w-full">
              {editing ? <><Loader2 className="size-4 mr-2 animate-spin" />Saving...</> : 'Save Changes'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Employee Schedule Dialog */}
      <Dialog open={scheduleDialogOpen} onOpenChange={setScheduleDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="size-5" />
              {scheduleEmployee?.firstName} {scheduleEmployee?.lastName}'s Schedule
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Week nav */}
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => setScheduleWeek(d => { const nd = new Date(d); nd.setDate(nd.getDate() - 7); return nd; })}>
                <ChevronLeft className="size-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setScheduleWeek(new Date())}>This Week</Button>
              <Button variant="outline" size="icon" onClick={() => setScheduleWeek(d => { const nd = new Date(d); nd.setDate(nd.getDate() + 7); return nd; })}>
                <ChevronRight className="size-4" />
              </Button>
              <span className="text-sm text-slate-500">
                {(() => { const ws = new Date(scheduleWeek); ws.setDate(ws.getDate() - ws.getDay() + 1); const we = new Date(ws); we.setDate(we.getDate() + 6); return `${format(ws, 'MMM d')} - ${format(we, 'MMM d, yyyy')}`; })()}
              </span>
              <Link to={`/dashboard/${orgId}/schedule?employee=${scheduleEmployee?.userId || scheduleEmployee?.id}`} className="ml-auto" onClick={() => setScheduleDialogOpen(false)}>
                <Button variant="outline" size="sm"><ExternalLink className="size-3 mr-1" />Open in Schedule</Button>
              </Link>
            </div>

            {loadingShifts ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="size-8 animate-spin text-blue-600" /></div>
            ) : employeeShifts.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <CalendarDays className="size-12 mx-auto text-slate-300 mb-3" />
                <p>No shifts scheduled for this week</p>
              </div>
            ) : (
              <div className="space-y-2">
                {employeeShifts.map((shift: any) => (
                  <div key={shift.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                    <div className="w-1.5 h-10 rounded-full shrink-0" style={{ backgroundColor: shift.color || '#3b82f6' }} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{shift.title}</p>
                      <p className="text-xs text-slate-500">
                        {shift.startTime ? format(new Date(shift.startTime), 'EEEE, MMM d') : ''} • {shift.startTime ? format(new Date(shift.startTime), 'h:mm a') : ''} - {shift.endTime ? format(new Date(shift.endTime), 'h:mm a') : ''}
                      </p>
                      {shift.department && <p className="text-xs text-slate-400">{shift.department}</p>}
                    </div>
                    <Badge variant="secondary" className="text-[10px]">{shift.status || 'SCHEDULED'}</Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        isOpen={confirmDialog.open}
        title={confirmDialog.title}
        description={confirmDialog.description}
        variant={confirmDialog.variant}
        onConfirm={() => { confirmDialog.onConfirm(); setConfirmDialog(p => ({ ...p, open: false })); }}
        onCancel={() => setConfirmDialog(p => ({ ...p, open: false }))}
      />
    </div>
  );
}
