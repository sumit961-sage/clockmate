import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, ChevronLeft, ChevronRight, Clock, MapPin,
  Loader2, ArrowLeft, Briefcase, Trash2, Edit3, X,
  AlertTriangle, Copy, Sun, Bookmark, CalendarDays,
  Repeat, Save, Bug, MapPinned, Eye, Send, CheckCircle2,
  XCircle, DollarSign, Users, ArrowRight, TrendingUp,
  ThumbsUp, ThumbsDown, RefreshCw, Lock, Unlock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import EmployeeSidebar from '@/components/EmployeeSidebar';
import {
  getShifts, createShift, updateShift, deleteShift,
  assignEmployeeToShift, getEmployees, getLocations,
  getTemplates, createTemplate, deleteTemplate, applyTemplate
} from '@/lib/api';
import { useAuthStore } from '@/store';
import { toast } from 'sonner';
import {
  format, addDays, subDays, startOfWeek, endOfWeek,
  isSameDay, differenceInMinutes, isToday, isPast, addWeeks
} from 'date-fns';
import type { Shift, Employee, Location, User, Template } from '@/types';

/* ════════════════════════════════════════════
   CONSTANTS
   ════════════════════════════════════════════ */
const HOURS = Array.from({ length: 18 }, (_, i) => i + 6);
const TYPE_COLORS: Record<string, string> = {
  REGULAR: '#3b82f6', SPLIT: '#8b5cf6', ON_CALL: '#f59e0b',
  TRAINING: '#10b981', SLEEPOVER: '#6366f1', MEETING: '#06b6d4', OVERTIME: '#ef4444',
};
const TYPE_LABELS: Record<string, string> = {
  REGULAR: 'Regular', SPLIT: 'Split', ON_CALL: 'On-Call',
  TRAINING: 'Training', SLEEPOVER: 'Sleepover', MEETING: 'Meeting', OVERTIME: 'Overtime',
};

/* ════════════════════════════════════════════
   ID EXTRACTION UTILITIES (Robust)
   ════════════════════════════════════════════ */

/** Extract a string ID from various possible formats */
function extractId(obj: unknown): string | null {
  if (!obj) return null;
  if (typeof obj === 'string') return obj;
  if (typeof obj === 'object' && obj !== null) {
    const o = obj as Record<string, unknown>;
    if (typeof o.id === 'string') return o.id;
    if (typeof o._id === 'string') return o._id;
    if (typeof o.userId === 'string') return o.userId;
    if (o.id && typeof o.id === 'object') {
      const nested = o.id as Record<string, unknown>;
      if (typeof nested.id === 'string') return nested.id;
    }
  }
  return null;
}

/** Get the User ID from an Employee record (handles populated userId) */
function getEmployeeUserId(emp: Employee): string {
  const uid = extractId(((emp as unknown) as Record<string, unknown>).userId);
  if (uid) return uid;
  return emp.id;
}

/** Extract all assigned user IDs from a shift */
function getAssignedIds(shift: Shift): string[] {
  return (shift.assignedTo || [])
    .map((a: unknown) => extractId(a))
    .filter((id): id is string => id !== null);
}

/** Check if a user is assigned to a shift (tries all possible ID fields) */
function userMatchesShift(user: User | null, shift: Shift): boolean {
  if (!user) return false;
  const assignedIds = getAssignedIds(shift);
  if (assignedIds.length === 0) return false;

  const u = user as unknown as Record<string, unknown>;
  const userIds = [
    user.id,
    u._id,
    u.userId,
    u.employeeId,
  ].filter((id): id is string => typeof id === 'string');

  return userIds.some(uid => assignedIds.includes(uid));
}

/** Calculate shift cost based on assigned employees */
function calculateShiftCost(shift: Shift, employees: Employee[]): number {
  const assignedIds = getAssignedIds(shift);
  const assigned = assignedIds.map(id => employees.find(e => e.id === id || getEmployeeUserId(e) === id)).filter((e): e is Employee => !!e);
  const duration = shift.startTime && shift.endTime ? differenceInMinutes(new Date(shift.endTime), new Date(shift.startTime)) / 60 : 0;
  return assigned.reduce((sum, emp) => sum + (duration * (emp.payRate || 0)), 0);
}

/* ════════════════════════════════════════════
   SHIFT CONFIRMATION ACTIONS (Employee)
   ════════════════════════════════════════════ */
function ShiftActions({ shift, user, onConfirm, onDecline, onSwap }: {
  shift: Shift; user: User | null;
  onConfirm: (s: Shift) => void; onDecline: (s: Shift) => void; onSwap: (s: Shift) => void;
}) {
  const isAssigned = userMatchesShift(user, shift);
  if (!isAssigned) return null;
  if (shift.status === 'COMPLETED' || shift.status === 'CANCELLED') return null;

  return (
    <div className="flex items-center gap-1 mt-2">
      {shift.status === 'SCHEDULED' && (
        <>
          <Button size="sm" variant="outline" className="h-7 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50" onClick={() => onConfirm(shift)}>
            <ThumbsUp className="size-3 mr-1" />Confirm
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs border-red-300 text-red-700 hover:bg-red-50" onClick={() => onDecline(shift)}>
            <ThumbsDown className="size-3 mr-1" />Decline
          </Button>
        </>
      )}
      {shift.status === 'CONFIRMED' && (
        <Badge className="bg-emerald-100 text-emerald-700 text-[10px] h-5 gap-1"><CheckCircle2 className="size-3" />Confirmed</Badge>
      )}
      <Button size="sm" variant="ghost" className="h-7 text-xs text-blue-600 hover:text-blue-700" onClick={() => onSwap(shift)}>
        <RefreshCw className="size-3 mr-1" />Swap
      </Button>
    </div>
  );
}

/* ════════════════════════════════════════════
   SHIFT SWAP MODAL
   ════════════════════════════════════════════ */
function ShiftSwapModal({ shift, isOpen, onClose, employees, onRequest }: {
  shift: Shift | null; isOpen: boolean; onClose: () => void;
  employees: Employee[]; onRequest: (shiftId: string, targetEmpId: string, reason: string) => Promise<void>;
}) {
  const [targetEmp, setTargetEmp] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (isOpen) { setTargetEmp(''); setReason(''); } }, [isOpen]);

  if (!shift) return null;

  const assignedIds = getAssignedIds(shift);
  const available = employees.filter(e => e.inviteStatus !== 'INVITED' && !assignedIds.includes(getEmployeeUserId(e)));

  const handleSubmit = async () => {
    if (!targetEmp) { toast.error('Select a colleague'); return; }
    setSaving(true);
    try { await onRequest(shift.id, targetEmp, reason); onClose(); toast.success('Swap request sent'); }
    catch (e: unknown) { toast.error((e as Error).message || 'Failed'); }
    finally { setSaving(false); }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          <motion.div className="fixed z-50 bg-white rounded-2xl shadow-2xl w-[95vw] max-w-md p-5 space-y-4" style={{ left: '50%', top: '47%', transform: 'translate(-50%, -50%)' }} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold flex items-center gap-2"><RefreshCw className="size-5 text-blue-500" />Request Shift Swap</h3>
              <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100"><X className="size-5" /></button>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg">
              <p className="text-sm font-medium">{shift.title}</p>
              <p className="text-xs text-slate-500">{shift.startTime ? format(new Date(shift.startTime), 'EEEE, MMM d, h:mm a') : ''} – {shift.endTime ? format(new Date(shift.endTime), 'h:mm a') : ''}</p>
            </div>
            <div>
              <label className="text-sm font-medium">Swap with</label>
              <select value={targetEmp} onChange={e => setTargetEmp(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm mt-1">
                <option value="">Select colleague...</option>
                {available.map(emp => <option key={emp.id} value={getEmployeeUserId(emp)}>{emp.firstName} {emp.lastName} – {emp.position}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Reason (optional)</label>
              <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Why do you need to swap?" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm mt-1" rows={2} />
            </div>
            <div className="flex gap-2"><Button onClick={handleSubmit} disabled={saving || !targetEmp} className="flex-1">{saving ? <Loader2 className="size-4 animate-spin" /> : 'Send Request'}</Button><Button variant="outline" onClick={onClose}>Cancel</Button></div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ════════════════════════════════════════════
   AVAILABILITY GRID (Employee availability)
   ════════════════════════════════════════════ */
function AvailabilityGrid({ employees, weekDays, shifts }: {
  employees: Employee[]; weekDays: Date[]; shifts: Shift[];
}) {
  const [showAvail, setShowAvail] = useState(false);

  // Simple availability: if employee has no shifts on a day, they're available
  const isAvailable = (emp: Employee, day: Date) => {
    const empId = getEmployeeUserId(emp);
    return !shifts.some(s => {
      if (!s.startTime || !getAssignedIds(s).includes(empId)) return false;
      return isSameDay(new Date(s.startTime), day);
    });
  };

  if (!showAvail) {
    return (
      <Button size="sm" variant="outline" onClick={() => setShowAvail(true)} className="w-full">
        <Users className="size-4 mr-1" />Show Availability
      </Button>
    );
  }

  return (
    <motion.div className="border rounded-xl bg-white overflow-hidden" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
      <div className="p-3 border-b flex items-center justify-between">
        <h4 className="text-sm font-semibold flex items-center gap-2"><Users className="size-4" />Availability</h4>
        <button onClick={() => setShowAvail(false)} className="p-1 rounded hover:bg-slate-100"><X className="size-4" /></button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b">
              <th className="p-2 text-left font-medium text-slate-500">Employee</th>
              {weekDays.map(d => <th key={d.toISOString()} className="p-2 text-center font-medium text-slate-500">{format(d, 'EEE d')}</th>)}
            </tr>
          </thead>
          <tbody>
            {employees.filter(e => e.inviteStatus !== 'INVITED').slice(0, 15).map(emp => (
              <tr key={emp.id} className="border-b last:border-0">
                <td className="p-2 font-medium">{emp.firstName} {emp.lastName?.[0]}.</td>
                {weekDays.map(d => {
                  const avail = isAvailable(emp, d);
                  return <td key={d.toISOString()} className="p-2 text-center"><div className={`inline-block size-3 rounded-full ${avail ? 'bg-emerald-400' : 'bg-red-300'}`} title={avail ? 'Available' : 'Assigned'} /></td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}

/* ════════════════════════════════════════════
   VIEW-ONLY SHIFT DETAIL (Employee)
   ════════════════════════════════════════════ */
function ViewOnlyShiftSheet({ shift, isOpen, onClose, employees, locations }: {
  shift: Shift | null; isOpen: boolean; onClose: () => void; employees: Employee[]; locations: Location[];
}) {
  if (!shift) return null;
  const assignedIds = getAssignedIds(shift);
  const assigned = assignedIds.map(id => employees.find(e => e.id === id || getEmployeeUserId(e) === id)).filter((e): e is Employee => !!e);
  const location = locations.find(l => l.id === (typeof shift.locationId === 'string' ? shift.locationId : (shift.locationId as Record<string, string>)?.id));
  const duration = shift.startTime && shift.endTime ? differenceInMinutes(new Date(shift.endTime), new Date(shift.startTime)) : 0;
  const hours = Math.floor(duration / 60);
  const mins = duration % 60;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          <motion.div
            className="fixed z-50 bg-white rounded-2xl shadow-2xl w-[92vw] max-w-md"
            style={{ maxHeight: '80vh', left: '50%', top: '45%', transform: 'translate(-50%, -50%)' }}
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}>
            <div className="overflow-y-auto p-5 space-y-4" style={{ maxHeight: '80vh' }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-10 rounded-full" style={{ backgroundColor: shift.color || TYPE_COLORS[shift.type || 'REGULAR'] }} />
                  <div>
                    <h3 className="text-lg font-semibold">{shift.title}</h3>
                    <div className="flex gap-1 mt-1">
                      <Badge variant="secondary" className="text-xs mt-1">{TYPE_LABELS[shift.type || 'REGULAR']}</Badge>
                      {shift.status === 'CONFIRMED' && <Badge className="bg-emerald-100 text-emerald-700 text-[10px] h-5"><CheckCircle2 className="size-3 mr-1" />Confirmed</Badge>}
                      {shift.status === 'DRAFT' && <Badge className="bg-slate-100 text-slate-600 text-[10px] h-5"><Lock className="size-3 mr-1" />Draft</Badge>}
                    </div>
                  </div>
                </div>
                <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100" aria-label="Close"><X className="size-5" /></button>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl flex items-center gap-3">
                <Clock className="size-5 text-slate-400 shrink-0" />
                <div>
                  <p className="font-medium text-sm">{shift.startTime ? format(new Date(shift.startTime), 'EEEE, MMM d, h:mm a') : ''} – {shift.endTime ? format(new Date(shift.endTime), 'h:mm a') : ''}</p>
                  <p className="text-xs text-slate-500">{hours}h {mins > 0 ? `${mins}m` : ''}</p>
                </div>
              </div>
              {location && <div className="flex items-center gap-2 text-sm text-slate-600"><MapPin className="size-4 text-slate-400 shrink-0" />{location.name}</div>}
              <div>
                <p className="text-sm font-medium mb-2">Team Members</p>
                <div className="flex flex-wrap gap-2">
                  {assigned.map(emp => (
                    <div key={emp.id} className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-1.5">
                      <div className="size-6 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white text-[10px] font-bold">{emp.firstName[0]}</div>
                      <span className="text-sm">{emp.firstName} {emp.lastName}</span>
                    </div>
                  ))}
                  {assigned.length === 0 && <span className="text-sm text-amber-600">No one assigned yet</span>}
                </div>
              </div>
              {shift.notes && <div className="p-3 bg-amber-50 rounded-lg border border-amber-100"><p className="text-sm text-amber-800">{shift.notes}</p></div>}
              <Button variant="outline" className="w-full" onClick={onClose}>Close</Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ════════════════════════════════════════════
   MANAGER VIEW SHIFT SHEET (View first, then Edit/Delete)
   ════════════════════════════════════════════ */
function ManagerViewShiftSheet({ shift, isOpen, onClose, employees, locations, onEdit, onDelete, onAssign, conflictIds, onConfirm, onDecline, cost }: {
  shift: Shift | null; isOpen: boolean; onClose: () => void; employees: Employee[]; locations: Location[];
  onEdit: (s: Shift) => void; onDelete: (id: string) => void; onAssign: (s: Shift, empId: string) => void; conflictIds: Set<string>;
  onConfirm?: (s: Shift) => void; onDecline?: (s: Shift) => void; cost: number;
}) {
  if (!shift) return null;
  const assignedIds = getAssignedIds(shift);
  const assigned = assignedIds.map(id => employees.find(e => e.id === id || getEmployeeUserId(e) === id)).filter((e): e is Employee => !!e);
  const unassigned = employees.filter(e => e.inviteStatus !== 'INVITED' && !assignedIds.includes(getEmployeeUserId(e)));
  const location = locations.find(l => l.id === (typeof shift.locationId === 'string' ? shift.locationId : (shift.locationId as Record<string, string>)?.id));
  const duration = shift.startTime && shift.endTime ? differenceInMinutes(new Date(shift.endTime), new Date(shift.startTime)) : 0;
  const hasConflict = conflictIds.has(shift.id);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          <motion.div
            className="fixed z-50 bg-white rounded-2xl shadow-2xl w-[92vw] max-w-md"
            style={{ maxHeight: '80vh', left: '50%', top: '45%', transform: 'translate(-50%, -50%)' }}
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}>
            <div className="overflow-y-auto p-5 space-y-4" style={{ maxHeight: '80vh' }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-10 rounded-full ${hasConflict ? 'bg-red-500' : ''}`} style={{ backgroundColor: hasConflict ? undefined : (shift.color || TYPE_COLORS[shift.type || 'REGULAR']) }} />
                  <div>
                    <h3 className="text-lg font-semibold">{shift.title}</h3>
                    <div className="flex gap-1 mt-1">
                      <Badge variant="secondary" className="text-xs">{TYPE_LABELS[shift.type || 'REGULAR']}</Badge>
                      {assigned.length === 0 && <Badge className="bg-amber-500 text-white text-xs"><AlertTriangle className="size-3 mr-1" />Open</Badge>}
                      {hasConflict && <Badge className="bg-red-500 text-white text-xs"><AlertTriangle className="size-3 mr-1" />Conflict</Badge>}
                      {shift.status === 'CONFIRMED' && <Badge className="bg-emerald-100 text-emerald-700 text-[10px]"><CheckCircle2 className="size-3 mr-1" />Confirmed</Badge>}
                      {shift.status === 'DRAFT' && <Badge className="bg-slate-100 text-slate-600 text-[10px]"><Lock className="size-3 mr-1" />Draft</Badge>}
                    </div>
                  </div>
                </div>
                <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100" aria-label="Close"><X className="size-5" /></button>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl flex items-center gap-3">
                <Clock className="size-5 text-slate-400 shrink-0" />
                <div>
                  <p className="font-medium text-sm">{shift.startTime ? format(new Date(shift.startTime), 'EEEE, MMM d, h:mm a') : ''} – {shift.endTime ? format(new Date(shift.endTime), 'h:mm a') : ''}</p>
                  <p className="text-xs text-slate-500">{Math.floor(duration / 60)}h {duration % 60 > 0 ? `${duration % 60}m` : ''}</p>
                </div>
              </div>

              {location && <div className="flex items-center gap-2 text-sm text-slate-600"><MapPin className="size-4 text-slate-400 shrink-0" />{location.name}</div>}

              {/* Cost Preview */}
              <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-100">
                <div className="flex items-center gap-2 text-sm text-emerald-700">
                  <DollarSign className="size-4" />
                  <span className="font-medium">Est. Cost: ${cost.toFixed(2)}</span>
                </div>
                <p className="text-[10px] text-emerald-600 ml-6">{assigned.length} staff × {Math.floor(duration / 60)}h @ avg ${assigned.length > 0 ? (cost / assigned.length / (duration / 60)).toFixed(2) : '0.00'}/hr</p>
              </div>

              <div>
                <p className="text-sm font-medium mb-2">Assigned ({assigned.length})</p>
                <div className="flex flex-wrap gap-2">
                  {assigned.map(emp => (
                    <div key={emp.id} className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-1.5">
                      <div className="size-6 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white text-[10px] font-bold">{emp.firstName[0]}</div>
                      <span className="text-sm">{emp.firstName} {emp.lastName}</span>
                    </div>
                  ))}
                  {assigned.length === 0 && <span className="text-sm text-amber-600">Unassigned – open shift</span>}
                </div>
              </div>

              {unassigned.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Quick Assign</p>
                  <select onChange={e => { if (e.target.value) { onAssign(shift, e.target.value); e.target.value = ''; } }} className="w-full text-sm rounded-lg border border-slate-300 px-3 py-2" defaultValue="">
                    <option value="">+ Select employee...</option>
                    {unassigned.map(emp => <option key={emp.id} value={getEmployeeUserId(emp)}>{emp.firstName} {emp.lastName}</option>)}
                  </select>
                </div>
              )}

              {shift.notes && <div className="p-3 bg-amber-50 rounded-lg border border-amber-100"><p className="text-sm text-amber-800">{shift.notes}</p></div>}

              <div className="flex gap-2 pt-2">
                <Button className="flex-1" onClick={() => { onClose(); onEdit(shift); }}><Edit3 className="size-4 mr-1" />Edit Shift</Button>
                <Button variant="destructive" className="flex-1" onClick={() => { onClose(); onDelete(shift.id); }}><Trash2 className="size-4 mr-1" />Delete</Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ════════════════════════════════════════════
   ADMIN EDIT / CREATE MODAL with Cost Preview
   ════════════════════════════════════════════ */
function ShiftEditModal({ shift, isOpen, onClose, onSave, onSaveTemplate, employees, locations, departments, templates, lockedEmployeeId, isSaving }: {
  shift: Shift | null; isOpen: boolean; onClose: () => void; onSave: (data: Record<string, unknown>) => Promise<void>; onSaveTemplate?: (data: Record<string, unknown>) => void;
  employees: Employee[]; locations: Location[]; departments: string[]; templates: Template[]; lockedEmployeeId?: string; isSaving?: boolean;
}) {
  const [form, setForm] = useState({
    title: '', startTime: '', endTime: '', type: 'REGULAR' as Shift['type'], department: 'General',
    assignedTo: [] as string[], locationId: '', color: '#3b82f6', notes: '', status: 'DRAFT' as Shift['status'],
    repeat: false, repeatCount: '4', repeatFrequency: 'WEEKLY'
  });
  const isEditing = !!(shift && shift.id);

  useEffect(() => {
    if (shift) {
      const assignedIds = getAssignedIds(shift);
      if (lockedEmployeeId && !assignedIds.includes(lockedEmployeeId)) assignedIds.push(lockedEmployeeId);
      setForm({
        title: shift.title || '', startTime: shift.startTime ? new Date(shift.startTime).toISOString().slice(0, 16) : '',
        endTime: shift.endTime ? new Date(shift.endTime).toISOString().slice(0, 16) : '',
        type: shift.type || 'REGULAR', department: shift.department || 'General',
        assignedTo: assignedIds, locationId: typeof shift.locationId === 'string' ? shift.locationId : extractId(shift.locationId) || '',
        color: shift.color || '#3b82f6', notes: shift.notes || '', status: shift.status || 'DRAFT',
        repeat: false, repeatCount: '4', repeatFrequency: 'WEEKLY',
      });
    } else {
      const now = new Date(); now.setMinutes(0);
      const end = new Date(now.getTime() + 8 * 60 * 60 * 1000);
      setForm({ title: '', startTime: now.toISOString().slice(0, 16), endTime: end.toISOString().slice(0, 16), type: 'REGULAR', department: 'General', assignedTo: lockedEmployeeId ? [lockedEmployeeId] : [], locationId: '', color: '#3b82f6', notes: '', status: 'DRAFT', repeat: false, repeatCount: '4', repeatFrequency: 'WEEKLY' });
    }
  }, [shift, lockedEmployeeId]);

  const applyTemplate = (templateId: string) => {
    const t = templates.find(x => x.id === templateId);
    if (!t) return;
    setForm(p => ({ ...p, title: (t.name as string) || p.title, department: (t.department as string) || p.department, locationId: extractId(t.locationId) || p.locationId, color: (t.color as string) || p.color }));
    toast.success(`Template "${t.name as string}" applied`);
  };

  // Cost preview calculation
  const costPreview = useMemo(() => {
    const duration = form.startTime && form.endTime ? differenceInMinutes(new Date(form.endTime), new Date(form.startTime)) / 60 : 0;
    const assigned = employees.filter(e => form.assignedTo.includes(getEmployeeUserId(e)));
    return { duration, total: assigned.reduce((s, e) => s + duration * (e.payRate || 0), 0), avgRate: assigned.length > 0 ? assigned.reduce((s, e) => s + (e.payRate || 0), 0) / assigned.length : 0 };
  }, [form, employees]);

  const handleSubmit = async () => {
    if (!form.title || !form.startTime || !form.endTime) { toast.error('Fill in title, start and end time'); return; }
    if (new Date(form.endTime) <= new Date(form.startTime)) { toast.error('End time must be after start'); return; }
    const payload: Record<string, unknown> = {
      ...form, id: shift?.id,
      startTime: new Date(form.startTime).toISOString(),
      endTime: new Date(form.endTime).toISOString(),
    };
    if (form.repeat && !isEditing && parseInt(form.repeatCount) > 1) {
      payload._repeatCount = parseInt(form.repeatCount);
      payload._repeatFrequency = form.repeatFrequency;
    }
    delete payload.repeat; delete payload.repeatCount; delete payload.repeatFrequency;
    await onSave(payload);
    onClose();
  };

  const toggleEmp = (id: string) => setForm(p => ({ ...p, assignedTo: p.assignedTo.includes(id) ? p.assignedTo.filter(x => x !== id) : [...p.assignedTo, id] }));

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          <motion.div
            className="fixed z-50 bg-white rounded-2xl shadow-2xl w-[95vw] sm:w-full sm:max-w-lg flex flex-col"
            style={{ maxHeight: '92vh', left: '50%', top: '47%', transform: 'translate(-50%, -50%)' }}
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}>
            <div className="overflow-y-auto p-5 space-y-4" style={{ maxHeight: '92vh' }}>
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">{isEditing ? 'Edit Shift' : 'Create Shift'}</h3>
                <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100" aria-label="Close"><X className="size-5" /></button>
              </div>
              {templates.length > 0 && (
                <div>
                  <label className="text-sm font-medium">Load from Template</label>
                  <select value="" onChange={e => { if (e.target.value) { applyTemplate(e.target.value); e.target.value = ''; } }} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm mt-1">
                    <option value="">-- Select a template --</option>
                    {templates.map(t => <option key={t.id as string} value={t.id as string}>{t.name as string}</option>)}
                  </select>
                </div>
              )}
              <Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Shift title" />
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-sm font-medium">Start</label><input type="datetime-local" value={form.startTime} onChange={e => setForm(p => ({ ...p, startTime: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></div>
                <div><label className="text-sm font-medium">End</label><input type="datetime-local" value={form.endTime} onChange={e => setForm(p => ({ ...p, endTime: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-sm font-medium">Type</label><select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value as Shift['type'] }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">{Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
                <div><label className="text-sm font-medium">Department</label><select value={form.department} onChange={e => setForm(p => ({ ...p, department: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">{departments.map(d => <option key={d} value={d}>{d}</option>)}</select></div>
              </div>
              <div><label className="text-sm font-medium">Location</label><select value={form.locationId} onChange={e => setForm(p => ({ ...p, locationId: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm mt-1"><option value="">No location</option>{locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select></div>
              <div>
                <label className="text-sm font-medium">Assign To</label>
                <div className="mt-1 max-h-28 overflow-y-auto space-y-0.5 border rounded-lg p-2">
                  {employees.filter(e => e.inviteStatus !== 'INVITED').map(emp => {
                    const empUserId = getEmployeeUserId(emp);
                    const isLocked = lockedEmployeeId === empUserId;
                    return (
                      <label key={emp.id} className={`flex items-center gap-2 p-1.5 rounded cursor-pointer ${isLocked ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
                        <input type="checkbox" checked={form.assignedTo.includes(empUserId)} onChange={() => toggleEmp(empUserId)} disabled={isLocked} className="size-4 rounded" />
                        <div className="size-5 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white text-[8px] font-bold">{emp.firstName?.[0]}</div>
                        <span className="text-sm truncate">{emp.firstName} {emp.lastName} <span className="text-slate-400">(${emp.payRate || 0}/hr)</span></span>
                        {isLocked && <span className="text-[10px] text-blue-500 ml-auto">(selected)</span>}
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Cost Preview */}
              {costPreview.duration > 0 && form.assignedTo.length > 0 && (
                <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-100">
                  <div className="flex items-center gap-2 text-sm text-emerald-700">
                    <DollarSign className="size-4" />
                    <span className="font-medium">Cost Preview: ${costPreview.total.toFixed(2)}</span>
                  </div>
                  <p className="text-[10px] text-emerald-600 ml-6">{form.assignedTo.length} staff × {costPreview.duration.toFixed(1)}h @ ${costPreview.avgRate.toFixed(2)}/hr avg</p>
                </div>
              )}

              {/* Status toggle */}
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <label className="text-sm font-medium">Status</label>
                <div className="flex gap-3 mt-1">
                  <label className={`flex-1 flex items-center gap-2 p-2 rounded-lg border cursor-pointer ${form.status === 'DRAFT' ? 'border-amber-300 bg-amber-50' : 'border-slate-200'}`}>
                    <input type="radio" checked={form.status === 'DRAFT'} onChange={() => setForm(p => ({ ...p, status: 'DRAFT' }))} className="size-4" />
                    <span className="text-sm flex items-center gap-1"><Lock className="size-3" />Draft</span>
                  </label>
                  <label className={`flex-1 flex items-center gap-2 p-2 rounded-lg border cursor-pointer ${form.status === 'SCHEDULED' ? 'border-blue-300 bg-blue-50' : 'border-slate-200'}`}>
                    <input type="radio" checked={form.status === 'SCHEDULED'} onChange={() => setForm(p => ({ ...p, status: 'SCHEDULED' }))} className="size-4" />
                    <span className="text-sm flex items-center gap-1"><Unlock className="size-3" />Published</span>
                  </label>
                </div>
              </div>

              {!isEditing && (
                <div className="p-3 bg-purple-50 rounded-lg border border-purple-100 space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={form.repeat} onChange={e => setForm(p => ({ ...p, repeat: e.target.checked }))} className="size-4 rounded" /><span className="text-sm font-medium flex items-center gap-1"><Repeat className="size-4 text-purple-600" />Repeat weekly</span></label>
                  {form.repeat && <div className="flex gap-2 items-center"><span className="text-sm text-slate-600">for</span><input type="number" value={form.repeatCount} onChange={e => setForm(p => ({ ...p, repeatCount: e.target.value }))} min="1" max="52" className="w-16 rounded border border-slate-300 px-2 py-1 text-sm text-center" /><span className="text-sm text-slate-600">weeks</span></div>}
                </div>
              )}
              <div><label className="text-sm font-medium">Notes</label><textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} className="w-full mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm" rows={2} placeholder="Notes..." /></div>
              <div className="flex gap-2 flex-wrap pb-2">
                <Button onClick={handleSubmit} disabled={isSaving} className="flex-1 min-w-[100px]">{isSaving ? <Loader2 className="size-4 animate-spin" /> : (isEditing ? 'Save Changes' : 'Create Shift')}</Button>
                {isEditing && <Button variant="destructive" onClick={() => { onSave({ action: 'delete', id: shift!.id }); onClose(); }} className="flex-1 min-w-[100px]" disabled={isSaving}><Trash2 className="size-4 mr-1" />Delete</Button>}
                <Button variant="outline" onClick={() => onSaveTemplate?.({ name: form.title, department: form.department, color: form.color, locationId: form.locationId })} className="min-w-[100px]" disabled={!form.title}><Save className="size-4 mr-1" />Save as Template</Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ════════════════════════════════════════════
   TEMPLATE MANAGER DRAWER
   ════════════════════════════════════════════ */
function TemplateManagerDrawer({ isOpen, onClose, templates, onCreate, onDelete, onApply }: {
  isOpen: boolean; onClose: () => void; templates: Template[]; onCreate: (data: Record<string, unknown>) => void; onDelete: (id: string) => void; onApply: (id: string) => void;
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDept, setNewDept] = useState('General');
  const [newColor, setNewColor] = useState('#3b82f6');

  const handleCreate = () => {
    if (!newName.trim()) { toast.error('Enter template name'); return; }
    onCreate({ name: newName.trim(), department: newDept, color: newColor });
    setNewName(''); setShowCreate(false);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          <motion.div className="fixed right-0 top-0 bottom-0 w-full max-w-sm bg-white shadow-2xl z-50 overflow-y-auto" initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 300 }}>
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Templates</h3>
                <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100" aria-label="Close"><X className="size-5" /></button>
              </div>
              {!showCreate ? (
                <Button size="sm" variant="outline" className="w-full" onClick={() => setShowCreate(true)}><Plus className="size-4 mr-1" />Create Template</Button>
              ) : (
                <motion.div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-3" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                  <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Template name" />
                  <div className="grid grid-cols-2 gap-2">
                    <select value={newDept} onChange={e => setNewDept(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm"><option>General</option><option>Clinical</option><option>Administrative</option><option>Support</option></select>
                    <input type="color" value={newColor} onChange={e => setNewColor(e.target.value)} className="w-full h-9 rounded cursor-pointer" />
                  </div>
                  <div className="flex gap-2"><Button size="sm" onClick={handleCreate} className="flex-1">Create</Button><Button size="sm" variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button></div>
                </motion.div>
              )}
              <Separator />
              {templates.length === 0 ? (
                <div className="text-center py-8"><Bookmark className="size-12 mx-auto text-slate-300 mb-3" /><p className="text-slate-500">No templates yet</p></div>
              ) : (
                <div className="space-y-3">
                  {templates.map(t => (
                    <div key={t.id as string} className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="flex items-center gap-3">
                        <div className="size-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: (t.color as string) || '#3b82f6' }}><Bookmark className="size-5 text-white" /></div>
                        <div className="min-w-0 flex-1"><p className="font-medium text-sm">{t.name as string}</p><p className="text-xs text-slate-500">{t.department as string}</p></div>
                        <button onClick={() => { if (confirm('Delete this template?')) onDelete(t.id as string); }} className="p-1.5 rounded-lg hover:bg-red-100 text-red-500" aria-label={`Delete template ${t.name as string}`}><Trash2 className="size-4" /></button>
                      </div>
                      <Button size="sm" variant="outline" className="w-full mt-2 text-xs" onClick={() => onApply(t.id as string)}><Copy className="size-3 mr-1" />Apply to Week</Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ════════════════════════════════════════════
   EMPLOYEE SCHEDULE VIEW (Card List)
   ════════════════════════════════════════════ */
function EmployeeScheduleView({ shifts, employees, locations, onOpenDetail, user, onConfirm, onDecline, onSwap }: {
  shifts: Shift[]; employees: Employee[]; locations: Location[]; onOpenDetail: (s: Shift) => void;
  user: User | null; onConfirm: (s: Shift) => void; onDecline: (s: Shift) => void; onSwap: (s: Shift) => void;
}) {
  const now = new Date();
  const todayShifts = shifts.filter(s => s.startTime && isToday(new Date(s.startTime)));
  const upcomingShifts = shifts.filter(s => s.startTime && new Date(s.startTime) > now && !isToday(new Date(s.startTime)));
  const pastShifts = shifts.filter(s => s.startTime && new Date(s.endTime || s.startTime) < now && !isToday(new Date(s.startTime)));

  const ShiftCard = ({ shift, highlight = false }: { shift: Shift; highlight?: boolean }) => {
    const location = locations.find(l => l.id === (typeof shift.locationId === 'string' ? shift.locationId : extractId(shift.locationId) || ''));
    const assignedIds = getAssignedIds(shift);
    const assigned = assignedIds.map(id => employees.find(e => e.id === id || getEmployeeUserId(e) === id)).filter((e): e is Employee => !!e);
    const duration = shift.startTime && shift.endTime ? differenceInMinutes(new Date(shift.endTime), new Date(shift.startTime)) : 0;
    const isActive = shift.startTime && shift.endTime && now >= new Date(shift.startTime) && now <= new Date(shift.endTime);

    return (
      <motion.button
        className={`w-full text-left p-4 rounded-xl border transition-all ${highlight ? 'bg-blue-50 border-blue-200 shadow-sm' : 'bg-white border-slate-200 hover:shadow-md'}`}
        onClick={() => onOpenDetail(shift)}
        whileTap={{ scale: 0.98 }}>
        <div className="flex items-start gap-3">
          <div className="w-1.5 h-12 rounded-full shrink-0 mt-0.5" style={{ backgroundColor: shift.color || TYPE_COLORS[shift.type || 'REGULAR'] }} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm">{shift.title}</span>
              {isActive && <Badge className="bg-green-500 text-white text-[10px] h-5 animate-pulse">Active Now</Badge>}
              {shift.status === 'CONFIRMED' && <Badge className="bg-emerald-100 text-emerald-700 text-[10px] h-5"><CheckCircle2 className="size-3 mr-1" />Confirmed</Badge>}
              {shift.status === 'DRAFT' && <Badge className="bg-slate-100 text-slate-500 text-[10px] h-5"><Lock className="size-3 mr-1" />Draft</Badge>}
            </div>
            <div className="flex items-center gap-1 text-sm text-slate-600 mt-1">
              <Clock className="size-3.5 text-slate-400" />
              {shift.startTime ? format(new Date(shift.startTime), 'h:mm a') : ''} – {shift.endTime ? format(new Date(shift.endTime), 'h:mm a') : ''}
              <span className="text-slate-400 mx-1">·</span>
              <span className="text-xs text-slate-500">{Math.floor(duration / 60)}h{duration % 60 > 0 ? ` ${duration % 60}m` : ''}</span>
            </div>
            {location && <div className="flex items-center gap-1 text-xs text-slate-500 mt-1"><MapPinned className="size-3" />{location.name}</div>}
            <ShiftActions shift={shift} user={user} onConfirm={onConfirm} onDecline={onDecline} onSwap={onSwap} />
            {assigned.length > 0 && (
              <div className="flex items-center gap-1 mt-2">
                <div className="flex -space-x-1.5">
                  {assigned.slice(0, 3).map(emp => (
                    <div key={emp.id} className="size-5 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white text-[8px] font-bold border-2 border-white">{emp.firstName[0]}</div>
                  ))}
                </div>
                {assigned.length > 3 && <span className="text-[10px] text-slate-500 ml-1">+{assigned.length - 3} more</span>}
              </div>
            )}
          </div>
        </div>
      </motion.button>
    );
  };

  return (
    <div className="space-y-5 max-w-lg mx-auto">
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-2 h-2 rounded-full bg-blue-500" />
          <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Today</h3>
          <span className="text-xs text-slate-400">{format(new Date(), 'EEEE, MMM d')}</span>
        </div>
        {todayShifts.length === 0 ? (
          <Card className="bg-slate-50 border-dashed"><CardContent className="py-8 text-center">
            <Sun className="size-10 mx-auto text-amber-400 mb-2" />
            <p className="text-sm text-slate-500 font-medium">No shifts today</p>
            <p className="text-xs text-slate-400 mt-1">Enjoy your day off!</p>
          </CardContent></Card>
        ) : (
          <div className="space-y-2">{todayShifts.map(s => <ShiftCard key={s.id} shift={s} highlight />)}</div>
        )}
      </div>

      {upcomingShifts.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-emerald-400" />
            <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Upcoming</h3>
            <span className="text-xs text-slate-400">{upcomingShifts.length} shift{upcomingShifts.length > 1 ? 's' : ''}</span>
          </div>
          <div className="space-y-2">{upcomingShifts.map(s => <ShiftCard key={s.id} shift={s} />)}</div>
        </div>
      )}

      {pastShifts.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-slate-300" />
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Past</h3>
          </div>
          <div className="space-y-2 opacity-60">{pastShifts.slice(0, 3).map(s => <ShiftCard key={s.id} shift={s} />)}</div>
        </div>
      )}

      {shifts.length === 0 && (
        <div className="text-center py-16">
          <CalendarDays className="size-16 mx-auto text-slate-200 mb-4" />
          <p className="text-lg font-semibold text-slate-400">No shifts this week</p>
          <p className="text-sm text-slate-400 mt-1">Check back later for your schedule</p>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════
   DAY VIEW (Manager)
   ════════════════════════════════════════════ */
function DayView({ date, shifts, employees, onEdit, onDelete, onAssign, onCreate, conflictIds }: {
  date: Date; shifts: Shift[]; employees: Employee[];
  onEdit: (s: Shift) => void; onDelete: (id: string) => void; onAssign: (s: Shift, empId: string) => void; onCreate: () => void; conflictIds: Set<string>;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{format(date, 'EEEE, MMMM d, yyyy')}</h3>
        <Button size="sm" onClick={onCreate}><Plus className="size-4 mr-1" />Add Shift</Button>
      </div>
      {shifts.length === 0 ? (
        <Card className="border-dashed"><CardContent className="py-12 text-center">
          <CalendarDays className="size-12 mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 font-medium">No shifts scheduled</p>
          <p className="text-sm text-slate-400 mt-1">This day is empty</p>
          <Button size="sm" variant="outline" className="mt-4" onClick={onCreate}><Plus className="size-4 mr-1" />Create first shift</Button>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {shifts.map(shift => {
            const assignedIds = getAssignedIds(shift);
            const assigned = assignedIds.map(id => employees.find(e => e.id === id || getEmployeeUserId(e) === id)).filter((e): e is Employee => !!e);
            const unassigned = employees.filter(e => e.inviteStatus !== 'INVITED' && !assignedIds.includes(getEmployeeUserId(e)));
            const hasConflict = conflictIds.has(shift.id);
            return (
              <motion.div key={shift.id} layoutId={shift.id}>
                <Card className={`overflow-hidden cursor-pointer hover:shadow-md transition-shadow ${hasConflict ? 'border-red-400 ring-1 ring-red-200' : ''}`} onClick={() => onEdit(shift)}>
                  <div className="flex">
                    <div className="w-1.5 flex-shrink-0" style={{ backgroundColor: shift.color || TYPE_COLORS[shift.type || 'REGULAR'] }} />
                    <CardContent className="py-3 px-4 flex-1">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-semibold text-sm">{shift.title}</h4>
                            <Badge variant="secondary" className="text-[10px] h-5">{TYPE_LABELS[shift.type || 'REGULAR']}</Badge>
                            {assigned.length === 0 && <Badge className="bg-amber-500 text-white text-[10px] h-5"><AlertTriangle className="size-3 mr-1" />Open</Badge>}
                            {hasConflict && <Badge className="bg-red-500 text-white text-[10px] h-5"><AlertTriangle className="size-3 mr-1" />Conflict</Badge>}
                            {shift.status === 'DRAFT' && <Badge className="bg-slate-100 text-slate-500 text-[10px] h-5"><Lock className="size-3 mr-1" />Draft</Badge>}
                            {shift.status === 'CONFIRMED' && <Badge className="bg-emerald-100 text-emerald-700 text-[10px] h-5"><CheckCircle2 className="size-3 mr-1" />Confirmed</Badge>}
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 flex-wrap">
                            <span><Clock className="size-3 inline mr-1" />{shift.startTime ? format(new Date(shift.startTime), 'h:mm a') : ''} – {shift.endTime ? format(new Date(shift.endTime), 'h:mm a') : ''}</span>
                            <span><Briefcase className="size-3 inline mr-1" />{shift.department || 'General'}</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {assigned.map(emp => (
                              <Badge key={emp.id} variant="secondary" className="text-[10px] gap-1 h-6 pl-1"><div className="size-4 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white text-[8px] font-bold">{emp.firstName[0]}</div>{emp.firstName} {emp.lastName}</Badge>
                            ))}
                          </div>
                          {unassigned.length > 0 && (
                            <div className="mt-2" onClick={e => e.stopPropagation()}>
                              <select onChange={e => { if (e.target.value) { onAssign(shift, e.target.value); e.target.value = ''; } }} className="text-xs rounded border border-slate-300 px-2 py-1" defaultValue="">
                                <option value="">+ Assign employee...</option>
                                {unassigned.map(emp => <option key={emp.id} value={getEmployeeUserId(emp)}>{emp.firstName} {emp.lastName}</option>)}
                              </select>
                            </div>
                          )}
                        </div>
                        <div className="flex gap-1 ml-2 flex-shrink-0">
                          <Button size="icon" variant="ghost" className="size-8" onClick={e => { e.stopPropagation(); onEdit(shift); }} aria-label={`Edit ${shift.title}`}><Edit3 className="size-4" /></Button>
                          <Button size="icon" variant="ghost" className="size-8 text-red-500" onClick={e => { e.stopPropagation(); onDelete(shift.id); }} aria-label={`Delete ${shift.title}`}><Trash2 className="size-4" /></Button>
                        </div>
                      </div>
                    </CardContent>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════
   COST SUMMARY CARD
   ════════════════════════════════════════════ */
function CostSummary({ shifts, employees }: { shifts: Shift[]; employees: Employee[] }) {
  const totalCost = useMemo(() => shifts.reduce((sum, s) => sum + calculateShiftCost(s, employees), 0), [shifts, employees]);
  const totalHours = useMemo(() => shifts.reduce((sum, s) => {
    return sum + (s.startTime && s.endTime ? differenceInMinutes(new Date(s.endTime), new Date(s.startTime)) / 60 : 0);
  }, 0), [shifts]);

  return (
    <motion.div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-emerald-700 font-medium text-sm">
          <DollarSign className="size-4" />Weekly Labor Cost
        </div>
        <span className="text-lg font-bold text-emerald-800">${totalCost.toFixed(0)}</span>
      </div>
      <p className="text-xs text-emerald-600 ml-6">{totalHours.toFixed(0)}h scheduled · {shifts.length} shifts</p>
    </motion.div>
  );
}

/* ════════════════════════════════════════════
   DEBUG PANEL
   ════════════════════════════════════════════ */
function DebugPanel({ user, shifts, employees }: { user: User | null; shifts: Shift[]; employees: Employee[] }) {
  const [open, setOpen] = useState(false);
  if (!open) return (
    <button onClick={() => setOpen(true)} className="fixed bottom-4 right-4 z-50 p-3 bg-slate-800 text-white rounded-full shadow-lg hover:bg-slate-700" title="Debug">
      <Bug className="size-5" />
    </button>
  );

  const u = user as unknown as Record<string, unknown>;
  const userIds = [user?.id, u?._id, u?.userId, u?.employeeId].filter((id): id is string => typeof id === 'string');
  const matchingShifts = user ? shifts.filter(s => userMatchesShift(user, s)) : [];
  const sampleShift = shifts[0];
  const sampleAssignedIds = sampleShift ? getAssignedIds(sampleShift) : [];

  return (
    <motion.div className="fixed bottom-4 right-4 z-50 bg-slate-800 text-white rounded-xl shadow-2xl p-4 w-80 max-h-96 overflow-y-auto" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-semibold text-sm">Debug Panel</h4>
        <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-white"><X className="size-4" /></button>
      </div>
      <div className="space-y-2 text-xs">
        <div className="bg-slate-700 rounded p-2">
          <p className="text-slate-400 font-medium">Your User IDs:</p>
          {userIds.map((id, i) => <p key={i} className="font-mono text-green-400">{id as string}</p>)}
          {userIds.length === 0 && <p className="text-red-400">No user IDs found!</p>}
        </div>
        <div className="bg-slate-700 rounded p-2">
          <p className="text-slate-400 font-medium">Shifts loaded: <span className="text-white">{shifts.length}</span></p>
          <p className="text-slate-400 font-medium">Matching your ID: <span className={matchingShifts.length > 0 ? 'text-green-400' : 'text-red-400'}>{matchingShifts.length}</span></p>
        </div>
        {sampleShift && (
          <div className="bg-slate-700 rounded p-2">
            <p className="text-slate-400 font-medium">Sample shift "{sampleShift.title}":</p>
            <p className="text-slate-400">Assigned IDs:</p>
            {sampleAssignedIds.map((id, i) => (
              <p key={i} className={`font-mono ${userIds.includes(id) ? 'text-green-400' : 'text-yellow-400'}`}>{id} {userIds.includes(id) ? '✓ MATCH' : '✗ no match'}</p>
            ))}
            {sampleAssignedIds.length === 0 && <p className="text-red-400">No assigned IDs!</p>}
          </div>
        )}
        <div className="bg-slate-700 rounded p-2">
          <p className="text-slate-400 font-medium">Employees:</p>
          {employees.slice(0, 3).map(emp => (
            <p key={emp.id} className="font-mono text-slate-300">{emp.firstName}: emp.id={emp.id}, userId={getEmployeeUserId(emp)}</p>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

/* ════════════════════════════════════════════
   MAIN SCHEDULE PAGE
   ════════════════════════════════════════════ */
export default function SchedulePage() {
  const { orgId } = useParams<{ orgId: string }>();
  const { user } = useAuthStore();
  const isManager = ['ADMIN', 'OWNER', 'MANAGER'].includes(user?.role || '');
  const isAdmin = ['ADMIN', 'OWNER'].includes(user?.role || '');

  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'week' | 'day'>('week');
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [filterDept, setFilterDept] = useState('all');
  const [filterType, setFilterType] = useState('all');

  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('all');
  const selectedEmployee = employees.find(e => getEmployeeUserId(e) === selectedEmployeeId);

  // Modals
  const [detailShift, setDetailShift] = useState<Shift | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [managerViewShift, setManagerViewShift] = useState<Shift | null>(null);
  const [managerViewOpen, setManagerViewOpen] = useState(false);
  const [editShift, setEditShift] = useState<Shift | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [templateDrawerOpen, setTemplateDrawerOpen] = useState(false);
  const [swapShift, setSwapShift] = useState<Shift | null>(null);
  const [swapOpen, setSwapOpen] = useState(false);

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  useEffect(() => { if (orgId) loadData(); }, [orgId, currentDate]);

  async function loadData() {
    if (!orgId) return;
    try {
      setLoading(true);
      const ws = startOfWeek(currentDate, { weekStartsOn: 1 }).toISOString();
      const we = endOfWeek(currentDate, { weekStartsOn: 1 }).toISOString();
      const [sh, em, lo, te] = await Promise.all([
        getShifts(orgId, ws, we), getEmployees(orgId), getLocations(orgId), isAdmin ? getTemplates(orgId) : Promise.resolve([]),
      ]);
      setShifts(sh); setEmployees(em); setLocations(lo); setTemplates(te);
    } catch (e) { toast.error('Failed to load schedule'); } finally { setLoading(false); }
  }

  const departments = useMemo(() => Array.from(new Set(['General', ...shifts.map(s => s.department || 'General')])), [shifts]);

  /* ── VISIBLE SHIFTS (with robust ID matching) ── */
  const visibleShifts = useMemo(() => {
    let result = [...shifts];

    // Employee view: only show shifts assigned to current user
    if (!isManager && user) {
      result = result.filter(s => userMatchesShift(user, s));
    }

    // Manager view: filter by selected employee
    if (isManager && selectedEmployeeId !== 'all') {
      result = result.filter(s => {
        const assignedIds = getAssignedIds(s);
        return assignedIds.includes(selectedEmployeeId);
      });
    }

    if (filterDept !== 'all') result = result.filter(s => (s.department || 'General') === filterDept);
    if (filterType !== 'all') result = result.filter(s => s.type === filterType);
    return result;
  }, [shifts, isManager, user, selectedEmployeeId, filterDept, filterType]);

  const getDayShifts = (day: Date) => visibleShifts.filter(s => s.startTime && isSameDay(new Date(s.startTime), day)).sort((a, b) => new Date(a.startTime!).getTime() - new Date(b.startTime!).getTime());

  const getShiftStyle = (shift: Shift) => {
    const s = new Date(shift.startTime || 0);
    const e = new Date(shift.endTime || 0);
    const top = Math.max(0, (s.getHours() + s.getMinutes() / 60 - 6) * 48);
    const height = Math.max(28, (e.getHours() + e.getMinutes() / 60 - Math.max(6, s.getHours() + s.getMinutes() / 60)) * 48);
    return { top, height };
  };

  /* ── CONFLICT DETECTION ── */
  const { conflicts, conflictShiftIds } = useMemo(() => {
    const c: string[] = [];
    const ids = new Set<string>();
    const empShifts: Record<string, Shift[]> = {};
    const seenKeys = new Set<string>();

    visibleShifts.forEach(s => {
      getAssignedIds(s).forEach(id => {
        if (!id) return;
        const key = `${id}::${s.id}`;
        if (seenKeys.has(key)) return;
        seenKeys.add(key);
        if (!empShifts[id]) empShifts[id] = [];
        empShifts[id].push(s);
      });
    });

    Object.entries(empShifts).forEach(([empId, list]) => {
      if (list.length < 2) return;
      const sorted = list.sort((a, b) => new Date(a.startTime || 0).getTime() - new Date(b.startTime || 0).getTime());
      for (let i = 0; i < sorted.length - 1; i++) {
        const currEnd = new Date(sorted[i].endTime || 0).getTime();
        const nextStart = new Date(sorted[i + 1].startTime || 0).getTime();
        if (currEnd > nextStart && sorted[i].id !== sorted[i + 1].id) {
          const emp = employees.find(e => e.id === empId || getEmployeeUserId(e) === empId);
          c.push(`${emp?.firstName || 'Employee'}: "${sorted[i].title}" overlaps "${sorted[i + 1].title}"`);
          ids.add(sorted[i].id); ids.add(sorted[i + 1].id);
        }
      }
    });
    return { conflicts: c, conflictShiftIds: ids };
  }, [visibleShifts, employees]);

  /* ── OCCUPIED SLOTS (O(1) lookup) ── */
  const occupiedSlots = useMemo(() => {
    const set = new Set<string>();
    visibleShifts.forEach(s => {
      if (!s.startTime || !s.endTime) return;
      const st = new Date(s.startTime);
      const en = new Date(s.endTime);
      const dayKey = format(st, 'yyyy-MM-dd');
      const startHour = st.getHours() + st.getMinutes() / 60;
      const endHour = en.getHours() + en.getMinutes() / 60;
      for (let h = Math.floor(startHour); h <= Math.floor(endHour); h++) {
        if (h >= 6 && h <= 23) set.add(`${dayKey}::${h}`);
      }
    });
    return set;
  }, [visibleShifts]);

  const slotHasShift = useCallback((day: Date, hour: number) => {
    return occupiedSlots.has(`${format(day, 'yyyy-MM-dd')}::${hour}`);
  }, [occupiedSlots]);

  const weeklyHours = useMemo(() => visibleShifts.reduce((sum, s) => {
    const st = s.startTime ? new Date(s.startTime).getTime() : 0;
    const en = s.endTime ? new Date(s.endTime).getTime() : 0;
    return sum + (en - st) / 3600000;
  }, 0), [visibleShifts]);

  /* ── ACTIONS ── */
  const openEdit = useCallback((shift?: Shift) => {
    if (shift) setEditShift(shift);
    else {
      const now = new Date(); now.setMinutes(0);
      const end = new Date(now.getTime() + 8 * 60 * 60 * 1000);
      const def = (isManager && selectedEmployeeId !== 'all') ? [selectedEmployeeId] : [];
      setEditShift({ id: '', orgId: orgId || '', title: '', assignedTo: def, startTime: now.toISOString(), endTime: end.toISOString(), type: 'REGULAR', status: 'DRAFT' } as Shift);
    }
    setEditOpen(true);
  }, [isManager, selectedEmployeeId, orgId]);

  const handleSave = useCallback(async (data: Record<string, unknown>) => {
    if (!orgId || isSaving) return;
    if (data.action === 'delete') { await deleteShift(data.id as string); toast.success('Deleted'); loadData(); return; }

    const count = (data._repeatCount as number) || 1;
    const frequency = (data._repeatFrequency as string) || 'WEEKLY';

    setIsSaving(true);
    try {
      for (let i = 0; i < count; i++) {
        const payload: Record<string, unknown> = { ...data, orgId };
        delete payload._repeatCount;
        delete payload._repeatFrequency;
        if (i > 0) {
          const offsetDays = frequency === 'WEEKLY' ? i * 7 : i;
          const st = new Date(payload.startTime as string); st.setDate(st.getDate() + offsetDays);
          const en = new Date(payload.endTime as string); en.setDate(en.getDate() + offsetDays);
          payload.startTime = st.toISOString();
          payload.endTime = en.toISOString();
        }
        if (data.id && i === 0) {
          await updateShift(data.id as string, payload as Partial<Shift>);
        } else {
          await createShift(payload as Partial<Shift>);
        }
      }
      toast.success(data.id ? 'Shift updated' : (count > 1 ? `${count} shifts created` : 'Shift created'));
      loadData();
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Failed');
    } finally {
      setIsSaving(false);
    }
  }, [orgId, isSaving]);

  const handleSaveTemplate = useCallback(async (data: Record<string, unknown>) => {
    try { await createTemplate({ ...data, orgId }); toast.success('Template saved'); if (orgId) { const te = await getTemplates(orgId); setTemplates(te); } }
    catch (e: unknown) { toast.error((e as Error).message || 'Failed'); }
  }, [orgId]);

  const handleDeleteTemplate = useCallback(async (id: string) => {
    try { await deleteTemplate(id); toast.success('Deleted'); setTemplates(p => p.filter(t => t.id !== id)); }
    catch (e: unknown) { toast.error((e as Error).message || 'Failed'); }
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('Delete this shift?')) return;
    try { await deleteShift(id); toast.success('Deleted'); loadData(); } catch (e: unknown) { toast.error((e as Error).message); }
  }, []);

  const handleApplyTemplate = useCallback(async (tid: string) => {
    try { const ws = startOfWeek(currentDate, { weekStartsOn: 1 }).toISOString(); const we = endOfWeek(currentDate, { weekStartsOn: 1 }).toISOString(); await applyTemplate(tid, ws, we); toast.success('Applied'); loadData(); }
    catch (e: unknown) { toast.error((e as Error).message); }
  }, [currentDate]);

  const handleQuickAssign = useCallback(async (shift: Shift, empId: string) => {
    try { await assignEmployeeToShift(shift.id, empId); toast.success('Assigned'); loadData(); } catch (e: unknown) { toast.error((e as Error).message); }
  }, []);

  // ── NEW: Publish Week ──
  const handlePublishWeek = useCallback(async () => {
    if (!orgId) return;
    const draftShifts = shifts.filter(s => s.status === 'DRAFT');
    if (draftShifts.length === 0) { toast.info('No draft shifts to publish'); return; }
    if (!confirm(`Publish ${draftShifts.length} draft shifts?`)) return;
    setIsSaving(true);
    try {
      for (const s of draftShifts) {
        await updateShift(s.id, { status: 'SCHEDULED' });
      }
      toast.success(`${draftShifts.length} shifts published`);
      loadData();
    } catch (e: unknown) { toast.error((e as Error).message || 'Failed'); }
    finally { setIsSaving(false); }
  }, [orgId, shifts]);

  // ── NEW: Copy Week to Next ──
  const handleCopyWeek = useCallback(async () => {
    if (!orgId) return;
    if (visibleShifts.length === 0) { toast.error('No shifts to copy'); return; }
    if (!confirm(`Copy ${visibleShifts.length} shifts to next week?`)) return;
    setIsSaving(true);
    try {
      let copied = 0;
      for (const s of visibleShifts) {
        const newStart = addWeeks(new Date(s.startTime!), 1);
        const newEnd = addWeeks(new Date(s.endTime!), 1);
        await createShift({
          ...s,
          id: undefined,
          orgId,
          startTime: newStart.toISOString(),
          endTime: newEnd.toISOString(),
          status: 'DRAFT',
          source: 'MANUAL',
        });
        copied++;
      }
      toast.success(`${copied} shifts copied to next week`);
      loadData();
    } catch (e: unknown) { toast.error((e as Error).message || 'Failed'); }
    finally { setIsSaving(false); }
  }, [orgId, visibleShifts]);

  // ── NEW: Shift Confirm/Decline ──
  const handleConfirmShift = useCallback(async (shift: Shift) => {
    try { await updateShift(shift.id, { status: 'CONFIRMED' }); toast.success('Shift confirmed'); loadData(); }
    catch (e: unknown) { toast.error((e as Error).message || 'Failed'); }
  }, []);

  const handleDeclineShift = useCallback(async (shift: Shift) => {
    if (!confirm('Decline this shift?')) return;
    try { await updateShift(shift.id, { status: 'CANCELLED' }); toast.success('Shift declined'); loadData(); }
    catch (e: unknown) { toast.error((e as Error).message || 'Failed'); }
  }, []);

  // ── NEW: Shift Swap ──
  const handleSwapRequest = useCallback(async (shiftId: string, targetEmpId: string, reason: string) => {
    // In a real app, this would create a swap request record
    toast.success(`Swap request sent to ${employees.find(e => getEmployeeUserId(e) === targetEmpId)?.firstName || 'colleague'}`);
    console.log('Swap request:', { shiftId, targetEmpId, reason });
  }, [employees]);

  const handleOpenDetail = useCallback((shift: Shift) => { setDetailShift(shift); setDetailOpen(true); }, []);

  const handleOpenManagerView = useCallback((shift: Shift) => { setManagerViewShift(shift); setManagerViewOpen(true); }, []);

  const handleOpenSwap = useCallback((shift: Shift) => { setSwapShift(shift); setSwapOpen(true); }, []);

  const draftCount = shifts.filter(s => s.status === 'DRAFT').length;

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="size-8 animate-spin text-blue-600" /></div>;

  /* ════════════════════════════════════════════
     EMPLOYEE VIEW
     ════════════════════════════════════════════ */
  if (!isManager) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2"><ArrowLeft className="size-4 text-slate-400" /><span className="text-sm text-slate-500">My Schedule</span></div>
          <h2 className="text-base font-semibold">{format(weekStart, 'MMM d')} – {format(weekEnd, 'MMM d')}</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setCurrentDate(subDays(currentDate, 7))}><ChevronLeft className="size-4" /></Button>
          <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>This Week</Button>
          <Button variant="outline" size="icon" onClick={() => setCurrentDate(addDays(currentDate, 7))}><ChevronRight className="size-4" /></Button>
        </div>
        <EmployeeScheduleView shifts={visibleShifts} employees={employees} locations={locations} onOpenDetail={handleOpenDetail}
          user={user} onConfirm={handleConfirmShift} onDecline={handleDeclineShift} onSwap={handleOpenSwap} />
        <ViewOnlyShiftSheet shift={detailShift} isOpen={detailOpen} onClose={() => setDetailOpen(false)} employees={employees} locations={locations} />
        <ShiftSwapModal shift={swapShift} isOpen={swapOpen} onClose={() => setSwapOpen(false)} employees={employees} onRequest={handleSwapRequest} />
        <DebugPanel user={user} shifts={shifts} employees={employees} />
      </div>
    );
  }

  /* ════════════════════════════════════════════
     MANAGER VIEW
     ════════════════════════════════════════════ */
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2"><ArrowLeft className="size-4 text-slate-400" /><span className="text-sm text-slate-500">Manage Schedules</span></div>

      <div className="flex flex-col lg:flex-row gap-4">
        {/* Employee Sidebar */}
        <EmployeeSidebar
          employees={employees.filter(e => e.inviteStatus !== 'INVITED')}
          selectedId={selectedEmployeeId}
          onSelect={setSelectedEmployeeId}
          onSelectAll={() => setSelectedEmployeeId('all')}
        />

        {/* Main Calendar */}
        <div className="flex-1 min-w-0 space-y-3">
          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => setCurrentDate(subDays(currentDate, viewMode === 'week' ? 7 : 1))}><ChevronLeft className="size-4" /></Button>
              <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>Today</Button>
              <Button variant="outline" size="icon" onClick={() => setCurrentDate(addDays(currentDate, viewMode === 'week' ? 7 : 1))}><ChevronRight className="size-4" /></Button>
              <h2 className="text-base font-semibold ml-1">{format(weekStart, 'MMM d')} – {format(weekEnd, 'MMM d')}</h2>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Tabs value={viewMode} onValueChange={v => setViewMode(v as 'week' | 'day')}><TabsList><TabsTrigger value="week">Week</TabsTrigger><TabsTrigger value="day">Day</TabsTrigger></TabsList></Tabs>
              <select value={filterDept} onChange={e => setFilterDept(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"><option value="all">All Depts</option>{departments.map(d => <option key={d} value={d}>{d}</option>)}</select>
              <select value={filterType} onChange={e => setFilterType(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"><option value="all">All Types</option>{Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
              <Button size="sm" onClick={() => openEdit()}><Plus className="size-4 mr-1" />Shift</Button>
              {isAdmin && <Button size="sm" variant="outline" onClick={() => setTemplateDrawerOpen(true)}><Bookmark className="size-4 mr-1" />Templates</Button>}
            </div>
          </div>

          {/* Cost Summary + Actions */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex-1"><CostSummary shifts={visibleShifts} employees={employees} /></div>
            <div className="flex gap-2">
              {draftCount > 0 && (
                <Button size="sm" variant="outline" onClick={handlePublishWeek} disabled={isSaving} className="border-emerald-300 text-emerald-700 hover:bg-emerald-50">
                  <Unlock className="size-4 mr-1" />Publish ({draftCount})
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={handleCopyWeek} disabled={isSaving}>
                <Copy className="size-4 mr-1" />Copy to Next
              </Button>
            </div>
          </div>

          {/* Selected employee info */}
          {selectedEmployee && (
            <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
              <div className="size-8 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white text-sm font-bold">{selectedEmployee.firstName[0]}</div>
              <div className="flex-1">
                <p className="font-medium text-sm">{selectedEmployee.firstName} {selectedEmployee.lastName} – {selectedEmployee.position}</p>
                <p className="text-xs text-slate-500">{weeklyHours.toFixed(1)}h scheduled this week · ${selectedEmployee.payRate || 0}/hr</p>
              </div>
            </div>
          )}

          {/* Availability Grid */}
          <AvailabilityGrid employees={employees} weekDays={weekDays} shifts={shifts} />

          {/* Conflict banner */}
          {conflicts.length > 0 && (
            <motion.div className="bg-red-50 border border-red-200 rounded-lg p-3" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
              <div className="flex items-center gap-2 text-red-700 font-medium text-sm"><AlertTriangle className="size-4" />{conflicts.length} conflict{conflicts.length > 1 ? 's' : ''}</div>
              {conflicts.slice(0, 3).map((c, i) => <p key={i} className="text-xs text-red-600 ml-6">{c}</p>)}
            </motion.div>
          )}

          {/* WEEK VIEW */}
          {viewMode === 'week' ? (
            <div className="border rounded-xl overflow-hidden bg-white">
              <div className="grid grid-cols-[50px_repeat(7,1fr)] border-b bg-slate-50">
                <div className="p-2 text-[10px] font-medium text-slate-400 border-r text-center">Time</div>
                {weekDays.map(day => (
                  <div key={`h-${format(day, 'yyyy-MM-dd')}`} className={`p-2 text-center border-r last:border-r-0 ${isSameDay(day, new Date()) ? 'bg-blue-50' : ''}`}>
                    <div className="text-[10px] text-slate-500">{format(day, 'EEE')}</div>
                    <div className={`text-sm font-semibold ${isSameDay(day, new Date()) ? 'text-blue-600' : ''}`}>{format(day, 'd')}</div>
                    <div className="text-[9px] text-slate-400">{getDayShifts(day).length} shifts</div>
                  </div>
                ))}
              </div>
              <div className="relative" style={{ height: `${HOURS.length * 48}px` }}>
                {HOURS.map(hour => (
                  <div key={`r-${hour}`} className="absolute left-0 right-0 border-b border-slate-100 flex" style={{ top: `${(hour - 6) * 48}px`, height: '48px' }}>
                    <div className="w-[50px] text-[10px] text-slate-400 text-right pr-1.5 pt-1 border-r">{hour === 12 ? '12p' : hour > 12 ? `${hour - 12}p` : `${hour}a`}</div>
                  </div>
                ))}

                {/* Shift blocks */}
                {weekDays.map((day, di) => getDayShifts(day).map(shift => {
                  const { top, height } = getShiftStyle(shift);
                  const assignedIds = getAssignedIds(shift);
                  const assigned = assignedIds.map(id => employees.find(e => e.id === id || getEmployeeUserId(e) === id)).filter((e): e is Employee => !!e);
                  const isUnassigned = assigned.length === 0;
                  const hasConflict = conflictShiftIds.has(shift.id);
                  return (
                    <motion.div
                      key={`s-${shift.id}-${format(day, 'yyyy-MM-dd')}`}
                      className={`absolute rounded-md border shadow-sm cursor-pointer overflow-hidden z-[5] ${isUnassigned ? 'border-dashed' : ''} ${hasConflict ? 'ring-2 ring-red-400 ring-offset-1' : 'border-white/60'}`}
                      style={{ left: `calc(50px + ${di * 13.3}% + 1px)`, width: `calc(13.3% - 2px)`, top: `${top + 1}px`, height: `${Math.max(32, height - 2)}px`, backgroundColor: isUnassigned ? '#f59e0b' : (shift.color || TYPE_COLORS[shift.type || 'REGULAR']) }}
                      onClick={() => handleOpenManagerView(shift)}
                      whileHover={{ scale: 1.03, zIndex: 20 }} whileTap={{ scale: 0.98 }}>
                      <div className="px-1 py-0.5 text-white text-[10px] leading-tight h-full flex flex-col justify-center pointer-events-none">
                        <div className="font-semibold truncate flex items-center gap-0.5">
                          {shift.status === 'DRAFT' && <Lock className="size-2 text-white/70" />}
                          {hasConflict && <AlertTriangle className="size-2.5 text-red-200" />}
                          {isUnassigned && <AlertTriangle className="size-2.5" />}
                          {shift.title}
                        </div>
                        {assigned.length > 0 && <div className="truncate text-[9px] opacity-90">{assigned.slice(0, 2).map(e => `${e.firstName} ${e.lastName?.[0]}.`).join(', ')}{assigned.length > 2 && ` +${assigned.length - 2}`}</div>}
                        <div className="text-[8px] opacity-70">{shift.startTime ? format(new Date(shift.startTime), 'HH:mm') : ''}–{shift.endTime ? format(new Date(shift.endTime), 'HH:mm') : ''}</div>
                      </div>
                    </motion.div>
                  );
                }))}

                {/* Quick-add on empty slots */}
                {weekDays.map((day, di) => HOURS.map(hour => {
                  if (slotHasShift(day, hour)) return null;
                  return (
                    <button
                      key={`a-${format(day, 'yyyy-MM-dd')}-${hour}`}
                      className="absolute opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center text-blue-300 hover:text-blue-500 hover:bg-blue-50/30 rounded z-[1]"
                      style={{ left: `calc(50px + ${di * 13.3}% + 1px)`, width: `calc(13.3% - 2px)`, top: `${(hour - 6) * 48}px`, height: '48px' }}
                      aria-label={`Add shift at ${hour}:00`}
                      onClick={() => { const st = new Date(day); st.setHours(hour, 0); const en = new Date(day); en.setHours(hour + 4, 0); const def = (selectedEmployeeId !== 'all') ? [selectedEmployeeId] : []; setEditShift({ id: '', orgId: orgId || '', title: '', assignedTo: def, startTime: st.toISOString(), endTime: en.toISOString(), type: 'REGULAR', status: 'DRAFT' } as Shift); setEditOpen(true); }}>
                      <Plus className="size-4" />
                    </button>
                  );
                }))}
              </div>
            </div>
          ) : (
            <DayView date={currentDate} shifts={getDayShifts(currentDate)} employees={employees} onEdit={openEdit} onDelete={handleDelete} onAssign={handleQuickAssign} onCreate={() => openEdit()} conflictIds={conflictShiftIds} />
          )}
        </div>
      </div>

      <ManagerViewShiftSheet shift={managerViewShift} isOpen={managerViewOpen} onClose={() => setManagerViewOpen(false)} employees={employees} locations={locations} onEdit={openEdit} onDelete={handleDelete} onAssign={handleQuickAssign} conflictIds={conflictShiftIds} onConfirm={handleConfirmShift} onDecline={handleDeclineShift} cost={managerViewShift ? calculateShiftCost(managerViewShift, employees) : 0} />
      <ShiftEditModal shift={editShift} isOpen={editOpen} onClose={() => setEditOpen(false)} onSave={handleSave} onSaveTemplate={handleSaveTemplate} employees={employees} locations={locations} departments={departments} templates={templates} lockedEmployeeId={selectedEmployeeId !== 'all' ? selectedEmployeeId : undefined} isSaving={isSaving} />
      {isAdmin && <TemplateManagerDrawer isOpen={templateDrawerOpen} onClose={() => setTemplateDrawerOpen(false)} templates={templates} onCreate={handleSaveTemplate} onDelete={handleDeleteTemplate} onApply={handleApplyTemplate} />}
      <ShiftSwapModal shift={swapShift} isOpen={swapOpen} onClose={() => setSwapOpen(false)} employees={employees} onRequest={handleSwapRequest} />
      <DebugPanel user={user} shifts={shifts} employees={employees} />
    </div>
  );
}
