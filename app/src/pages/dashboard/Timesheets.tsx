import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileText, Download, CheckCircle2, XCircle, Clock, ChevronLeft, ChevronRight,
  Loader2, ArrowLeft, Plus, Trash2, Edit3, X, MessageSquare, Send,
  AlertTriangle, CalendarDays, Settings, UserCheck, UserX, ClipboardCheck,
  ChevronDown, ChevronUp, History, DollarSign, TrendingUp, Shield,
  BarChart3, Eye, Ban, Receipt, ExternalLink, Filter
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import EmployeeSidebar from '@/components/EmployeeSidebar';
import {
  getTimesheets, getTimeEntries, getEmployees,
  submitTimesheet, approveTimesheet, rejectTimesheet,
  autoGenerateTimesheet, updateTimesheetSettings,
  addTimeEntryComment, updateTimeEntry,
} from '@/lib/api';
import { useAuthStore } from '@/store';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { logger } from '@/lib/logger';
import {
  format, startOfWeek, endOfWeek, addDays, subDays,
  differenceInDays, differenceInMinutes, isSameDay, isToday,
} from 'date-fns';
import type { TimeEntry, Employee, Timesheet, TimesheetSettings, TimeEntryComment } from '@/types';

/* ════════════════════════════════════════════
   CONSTANTS
   ════════════════════════════════════════════ */
const DEFAULT_SETTINGS: TimesheetSettings = {
  periodType: 'weekly', weekStartDay: 'monday', timesheetDueDay: 2,
  approvalWorkflow: 'manager',
  roundingRule: { interval: 15, direction: 'nearest' },
  overtimeThresholds: { daily: { hours: 8 }, dailyDouble: { hours: 12 }, weekly: { hours: 38 } },
  breakRules: { autoDeductAfterHours: 5, duration: 30, type: 'unpaid' },
  lockPeriodDays: 7,
};
const WEEK_START_MAP: Record<string, number> = { sunday: 0, monday: 1, saturday: 6 };
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/* ════════════════════════════════════════════
   ID HELPERS
   ════════════════════════════════════════════ */
function extractId(obj: unknown): string | null {
  if (!obj) return null;
  if (typeof obj === 'string') return obj;
  if (typeof obj === 'object' && obj !== null) {
    const o = obj as Record<string, unknown>;
    if (typeof o.id === 'string') return o.id;
    if (typeof o._id === 'string') return o._id;
    if (typeof o.userId === 'string') return o.userId;
  }
  return null;
}
function getEmployeeUserId(emp: Employee): string {
  const uid = extractId((emp as unknown as Record<string, unknown>).userId);
  return uid || emp.id;
}
function getDateKey(d: Date) { return format(d, 'yyyy-MM-dd'); }

/* ════════════════════════════════════════════
   PAY PERIOD
   ════════════════════════════════════════════ */
function getPayPeriod(date: Date, settings: TimesheetSettings) {
  const ws = (WEEK_START_MAP[settings.weekStartDay] ?? 1) as 0 | 1 | 6;
  if (settings.periodType === 'fortnightly') {
    const yearStart = startOfWeek(new Date(date.getFullYear(), 0, 1), { weekStartsOn: ws });
    const daysDiff = Math.max(0, differenceInDays(date, yearStart));
    const start = addDays(yearStart, Math.floor(daysDiff / 14) * 14);
    const end = addDays(start, 13);
    return { start, end, label: `${format(start, 'MMM d')} – ${format(end, 'MMM d, yyyy')}` };
  }
  const start = startOfWeek(date, { weekStartsOn: ws });
  const end = endOfWeek(date, { weekStartsOn: ws });
  return { start, end, label: `${format(start, 'MMM d')} – ${format(end, 'MMM d, yyyy')}` };
}
function getDueDate(periodEnd: Date, dueDay: number) {
  const end = new Date(periodEnd);
  let daysToAdd = dueDay - end.getDay();
  if (daysToAdd <= 0) daysToAdd += 7;
  return addDays(end, daysToAdd);
}
function getPeriodOffset(date: Date, settings: TimesheetSettings, dir: 'prev' | 'next') {
  return dir === 'prev' ? subDays(date, settings.periodType === 'fortnightly' ? 14 : 7) : addDays(date, settings.periodType === 'fortnightly' ? 14 : 7);
}

/* ════════════════════════════════════════════
   STATUS / DUE UI
   ════════════════════════════════════════════ */
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
    DRAFT: { label: 'Draft', cls: 'bg-slate-100 text-slate-700 border-slate-200', icon: <FileText className="size-3" /> },
    SUBMITTED: { label: 'Submitted', cls: 'bg-amber-50 text-amber-700 border-amber-200', icon: <Clock className="size-3" /> },
    APPROVED: { label: 'Approved', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: <CheckCircle2 className="size-3" /> },
    REJECTED: { label: 'Rejected', cls: 'bg-red-50 text-red-700 border-red-200', icon: <XCircle className="size-3" /> },
  };
  const c = map[status] || map.DRAFT;
  return <Badge variant="outline" className={`${c.cls} gap-1 font-medium text-xs`}>{c.icon}{c.label}</Badge>;
}
function DueIndicator({ periodEnd, dueDay, status }: { periodEnd: Date; dueDay: number; status: string }) {
  const daysUntil = differenceInDays(getDueDate(periodEnd, dueDay), new Date());
  if (status === 'APPROVED') return <span className="text-xs text-emerald-600 flex items-center gap-1"><CheckCircle2 className="size-3" />Approved</span>;
  if (status === 'SUBMITTED') return <span className="text-xs text-amber-600 flex items-center gap-1"><Clock className="size-3" />Awaiting review</span>;
  if (daysUntil < 0) return <span className="text-xs text-red-600 font-medium flex items-center gap-1"><AlertTriangle className="size-3" />Overdue by {Math.abs(daysUntil)}d</span>;
  if (daysUntil === 0) return <span className="text-xs text-amber-600 font-medium flex items-center gap-1"><AlertTriangle className="size-3" />Due today</span>;
  return <span className="text-xs text-blue-600 flex items-center gap-1"><Clock className="size-3" />Due in {daysUntil}d</span>;
}

/* ════════════════════════════════════════════
   COMMENT DRAWER
   ════════════════════════════════════════════ */
function CommentDrawer({ isOpen, onClose, comments, onAdd, canAdd }: { isOpen: boolean; onClose: () => void; comments: TimeEntryComment[]; onAdd: (t: string) => void; canAdd: boolean }) {
  const [text, setText] = useState('');
  const send = () => { if (!text.trim()) return; onAdd(text.trim()); setText(''); };
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          <motion.div className="fixed right-0 top-0 bottom-0 w-full max-w-sm bg-white shadow-2xl z-50 flex flex-col" initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 300 }}>
            <div className="p-4 border-b flex items-center justify-between"><h3 className="font-semibold flex items-center gap-2"><MessageSquare className="size-4" />Comments ({comments.length})</h3><button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100"><X className="size-5" /></button></div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {comments.length === 0 ? <p className="text-sm text-slate-400 text-center py-8">No comments yet</p> : comments.map((c, i) => (
                <div key={i} className={`p-3 rounded-lg ${c.authorName?.includes('Admin') || c.authorName?.includes('Manager') ? 'bg-blue-50 border border-blue-100' : 'bg-slate-50'}`}>
                  <p className="text-sm">{c.text}</p><p className="text-[10px] text-slate-400 mt-1">{c.authorName} – {format(new Date(c.createdAt), 'MMM d, h:mm a')}</p>
                </div>
              ))}
            </div>
            {canAdd && (
              <div className="p-3 border-t flex gap-2">
                <Input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder="Add comment..." className="flex-1" />
                <Button size="sm" onClick={send}><Send className="size-4" /></Button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ════════════════════════════════════════════
   ENTRY EDIT MODAL with Dispute Center
   ════════════════════════════════════════════ */
function EntryEditModal({ isOpen, onClose, onSave, onAddComment, entry, ps, pe, canManage }: {
  isOpen: boolean; onClose: () => void; onSave: (d: Record<string, unknown>) => Promise<void>;
  onAddComment?: (text: string) => Promise<void>;
  entry: TimeEntry | null; ps: Date; pe: Date; canManage?: boolean;
}) {
  const [tab, setTab] = useState<'details' | 'dispute'>('details');
  const [form, setForm] = useState({ date: '', clockIn: '', clockOut: '', breakMins: '30', notes: '' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);

  // Reset tab when opening
  useMemo(() => { if (isOpen) setTab('details'); }, [isOpen]);

  useMemo(() => {
    if (entry) {
      setForm({ date: entry.clockIn?.time ? format(new Date(entry.clockIn.time), 'yyyy-MM-dd') : '', clockIn: entry.clockIn?.time ? format(new Date(entry.clockIn.time), 'HH:mm') : '', clockOut: entry.clockOut?.time ? format(new Date(entry.clockOut.time), 'HH:mm') : '', breakMins: '30', notes: entry.notes || '' });
    } else { setForm({ date: format(ps, 'yyyy-MM-dd'), clockIn: '09:00', clockOut: '17:00', breakMins: '30', notes: '' }); }
  }, [entry, ps]);

  const submit = async () => {
    if (!form.date || !form.clockIn || !form.clockOut) { toast.error('Fill all fields'); return; }
    const cin = new Date(`${form.date}T${form.clockIn}`); const cout = new Date(`${form.date}T${form.clockOut}`);
    if (cout <= cin) { toast.error('Clock out must be after clock in'); return; }
    setSaving(true);
    try { await onSave({ clockInTime: cin.toISOString(), clockOutTime: cout.toISOString(), breakMinutes: parseInt(form.breakMins) || 0, notes: form.notes, entryId: entry?.id }); onClose(); toast.success('Saved'); }
    catch (e: unknown) { toast.error((e as Error).message); } finally { setSaving(false); }
  };

  const sendMessage = async () => {
    if (!msg.trim() || !onAddComment) return;
    setSendingMsg(true);
    try { await onAddComment(msg.trim()); setMsg(''); toast.success('Message sent'); }
    catch (e: unknown) { toast.error((e as Error).message || 'Failed to send'); }
    finally { setSendingMsg(false); }
  };

  const mins = form.clockIn && form.clockOut ? differenceInMinutes(new Date(`${form.date}T${form.clockOut}`), new Date(`${form.date}T${form.clockIn}`)) - (parseInt(form.breakMins) || 0) : 0;
  const hrs = Math.max(0, mins / 60);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          <motion.div className="fixed z-50 bg-white rounded-2xl shadow-2xl w-[95vw] max-w-lg" style={{ left: '50%', top: '8%', transform: 'translateX(-50%)', maxHeight: '85vh' }} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
            <div className="p-5 space-y-4 overflow-y-auto" style={{ maxHeight: '85vh' }}>
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">{entry ? 'Edit Entry' : 'Add Entry'}</h3>
                <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100"><X className="size-5" /></button>
              </div>

              {/* Tabs */}
              {entry && (
                <div className="flex gap-2 border-b">
                  <button onClick={() => setTab('details')} className={`px-3 py-2 text-sm font-medium border-b-2 ${tab === 'details' ? 'border-blue-500 text-blue-700' : 'border-transparent text-slate-500'}`}>Details</button>
                  <button onClick={() => setTab('dispute')} className={`px-3 py-2 text-sm font-medium border-b-2 ${tab === 'dispute' ? 'border-blue-500 text-blue-700' : 'border-transparent text-slate-500'}`}>
                    Dispute Center {entry.status === 'DISPUTED' && <span className="ml-1 text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">Active</span>}
                  </button>
                </div>
              )}

              {tab === 'details' && (
                <div className="space-y-4">
                  <div><label className="text-sm font-medium">Date</label><input type="date" value={form.date} min={format(ps, 'yyyy-MM-dd')} max={format(pe, 'yyyy-MM-dd')} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm mt-1" /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="text-sm font-medium">Clock In</label><input type="time" value={form.clockIn} onChange={e => setForm(p => ({ ...p, clockIn: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm mt-1" /></div>
                    <div><label className="text-sm font-medium">Clock Out</label><input type="time" value={form.clockOut} onChange={e => setForm(p => ({ ...p, clockOut: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm mt-1" /></div>
                  </div>
                  <div><label className="text-sm font-medium">Break (min)</label><input type="number" value={form.breakMins} onChange={e => setForm(p => ({ ...p, breakMins: e.target.value }))} min="0" max="120" step="5" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm mt-1" /></div>
                  <div className="p-3 bg-blue-50 rounded-lg"><p className="text-sm text-blue-700 font-medium">Total: {hrs.toFixed(1)}h</p><p className="text-xs text-blue-500">{Math.floor(hrs)}h {Math.round((hrs % 1) * 60)}m after break</p></div>
                  <div><label className="text-sm font-medium">Notes</label><textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} className="w-full mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm" rows={2} /></div>
                  <div className="flex gap-2"><Button onClick={submit} disabled={saving} className="flex-1">{saving ? <Loader2 className="size-4 animate-spin" /> : (entry ? 'Save Changes' : 'Add Entry')}</Button><Button variant="outline" onClick={onClose}>Cancel</Button></div>
                </div>
              )}

              {tab === 'dispute' && entry && (
                <div className="space-y-3">
                  <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                    <p className="text-sm text-amber-700 font-medium">Dispute Center</p>
                    <p className="text-xs text-amber-600">Discuss this entry with {canManage ? 'the employee' : 'your manager'}.</p>
                  </div>

                  {/* Chat thread */}
                  <div className="bg-slate-50 rounded-lg border border-slate-200 p-3 space-y-3 max-h-64 overflow-y-auto">
                    {(!entry.comments || entry.comments.length === 0) ? (
                      <p className="text-sm text-slate-400 text-center py-4">No messages yet. Start the conversation below.</p>
                    ) : entry.comments.map((c, i) => (
                      <div key={i} className={`flex gap-2 ${c.authorName?.includes('Admin') || c.authorName?.includes('Manager') ? 'flex-row' : 'flex-row-reverse'}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0 ${c.authorName?.includes('Admin') || c.authorName?.includes('Manager') ? 'bg-blue-500' : 'bg-emerald-500'}`}>
                          {(c.authorName?.[0] || 'U').toUpperCase()}
                        </div>
                        <div className={`max-w-[75%] p-2.5 rounded-lg text-sm ${c.authorName?.includes('Admin') || c.authorName?.includes('Manager') ? 'bg-white border border-slate-200 rounded-tl-none' : 'bg-blue-50 border border-blue-100 rounded-tr-none'}`}>
                          <p className="text-xs font-medium text-slate-500 mb-0.5">{c.authorName}</p>
                          <p className="text-slate-700">{c.text}</p>
                          <p className="text-[10px] text-slate-400 mt-1 text-right">{format(new Date(c.createdAt), 'MMM d, h:mm a')}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Reply input */}
                  <div className="flex gap-2">
                    <Input value={msg} onChange={e => setMsg(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }} placeholder="Type a message..." className="flex-1" />
                    <Button size="sm" onClick={sendMessage} disabled={sendingMsg || !msg.trim()}><Send className="size-4" /></Button>
                  </div>

                  {/* Manager actions */}
                  {canManage && entry.status === 'DISPUTED' && (
                    <div className="flex gap-2 pt-2">
                      <Button size="sm" variant="outline" className="text-emerald-600 border-emerald-200" onClick={async () => { await onSave({ entryId: entry.id, status: 'APPROVED' }); onClose(); }}>
                        <CheckCircle2 className="size-4 mr-1" />Approve Entry
                      </Button>
                    </div>
                  )}
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
   REJECT MODAL
   ════════════════════════════════════════════ */
function RejectModal({ isOpen, onClose, onReject }: { isOpen: boolean; onClose: () => void; onReject: (r: string) => Promise<void> }) {
  const [reason, setReason] = useState(''); const [saving, setSaving] = useState(false);
  const submit = async () => { if (!reason.trim()) { toast.error('Enter reason'); return; } setSaving(true); try { await onReject(reason.trim()); onClose(); } catch (e: unknown) { toast.error((e as Error).message); } finally { setSaving(false); } };
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          <motion.div className="fixed z-50 bg-white rounded-2xl shadow-2xl w-[92vw] max-w-sm p-5 space-y-4" style={{ left: '50%', top: '47%', transform: 'translate(-50%, -50%)' }} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
            <h3 className="text-lg font-semibold flex items-center gap-2"><UserX className="size-5 text-red-500" />Reject Timesheet</h3>
            <p className="text-sm text-slate-500">Employee will be notified and can resubmit.</p>
            <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason..." className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" rows={3} />
            <div className="flex gap-2"><Button variant="destructive" onClick={submit} disabled={saving} className="flex-1">{saving ? <Loader2 className="size-4 animate-spin" /> : 'Reject'}</Button><Button variant="outline" onClick={onClose}>Cancel</Button></div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ════════════════════════════════════════════
   SETTINGS MODAL
   ════════════════════════════════════════════ */
function SettingsModal({ isOpen, onClose, settings, onSave }: { isOpen: boolean; onClose: () => void; settings: TimesheetSettings; onSave: (s: TimesheetSettings) => Promise<void> }) {
  const [form, setForm] = useState<TimesheetSettings>(settings); const [saving, setSaving] = useState(false);
  useMemo(() => { setForm(settings); }, [settings]);
  const upd = (path: string, val: unknown) => setForm(p => { const n = { ...p }; const k = path.split('.'); let t: Record<string, unknown> = n as unknown as Record<string, unknown>; for (let i = 0; i < k.length - 1; i++) t = t[k[i]] as Record<string, unknown>; t[k[k.length - 1]] = val; return n; });
  const submit = async () => { setSaving(true); try { await onSave(form); onClose(); } catch (e: unknown) { toast.error((e as Error).message); } finally { setSaving(false); } };
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          <motion.div className="fixed z-50 bg-white rounded-2xl shadow-2xl w-[95vw] max-w-lg" style={{ maxHeight: '92vh', left: '50%', top: '47%', transform: 'translate(-50%, -50%)' }} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
            <div className="overflow-y-auto p-5 space-y-4" style={{ maxHeight: '92vh' }}>
              <div className="flex items-center justify-between"><h3 className="text-lg font-semibold flex items-center gap-2"><Settings className="size-5" />Timesheet Settings</h3><button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100"><X className="size-5" /></button></div>
              <div><label className="text-sm font-medium">Pay Period</label><div className="flex gap-3 mt-1">{(['weekly', 'fortnightly'] as const).map(t => (<label key={t} className={`flex-1 flex items-center gap-2 p-2 rounded-lg border cursor-pointer ${form.periodType === t ? 'border-blue-300 bg-blue-50' : 'border-slate-200'}`}><input type="radio" checked={form.periodType === t} onChange={() => upd('periodType', t)} className="size-4" /><span className="text-sm capitalize">{t === 'fortnightly' ? 'Fortnightly' : 'Weekly'}</span></label>))}</div></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-sm font-medium">Week Starts</label><select value={form.weekStartDay} onChange={e => upd('weekStartDay', e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm mt-1">{DAY_NAMES.map((d, i) => <option key={i} value={d.toLowerCase()}>{d}</option>)}</select></div>
                <div><label className="text-sm font-medium">Due Day</label><select value={form.timesheetDueDay} onChange={e => upd('timesheetDueDay', parseInt(e.target.value))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm mt-1">{DAY_NAMES.map((d, i) => <option key={i} value={i}>{d}</option>)}</select></div>
              </div>
              <div><label className="text-sm font-medium">OT Threshold (hrs/day)</label><input type="number" value={form.overtimeThresholds.daily.hours} onChange={e => upd('overtimeThresholds.daily.hours', parseFloat(e.target.value))} min="1" max="24" step="0.5" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm mt-1" /></div>
              <div className="flex gap-2 pt-2"><Button onClick={submit} disabled={saving} className="flex-1">{saving ? <Loader2 className="size-4 animate-spin" /> : 'Save Settings'}</Button><Button variant="outline" onClick={onClose}>Cancel</Button></div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ════════════════════════════════════════════
   COMPLIANCE PANEL
   ════════════════════════════════════════════ */
function CompliancePanel({ dayGroups, otThreshold, settings }: {
  dayGroups: { key: string; date: Date; entries: TimeEntry[] }[];
  otThreshold: number;
  settings: TimesheetSettings;
}) {
  const issues = useMemo(() => {
    const found: { type: 'break' | 'consecutive' | 'overtime'; message: string; day?: Date }[] = [];
    dayGroups.forEach(dg => {
      const dayTotal = dg.entries.reduce((s, e) => s + (e.totalHours || 0), 0);
      const hasBreak = dg.entries.some(e => (e.breaks?.length || 0) > 0);
      if (dayTotal > otThreshold) {
        found.push({ type: 'overtime', message: `${format(dg.date, 'EEE')}: ${dayTotal.toFixed(1)}h exceeds ${otThreshold}h threshold`, day: dg.date });
      }
      if (dayTotal > (settings.breakRules?.autoDeductAfterHours || 5) && !hasBreak) {
        found.push({ type: 'break', message: `${format(dg.date, 'EEE')}: No break recorded after ${dayTotal.toFixed(1)}h`, day: dg.date });
      }
    });
    const workedDays = dayGroups.filter(dg => dg.entries.length > 0);
    if (workedDays.length >= 7) {
      found.push({ type: 'consecutive', message: `${workedDays.length} consecutive days worked this period` });
    }
    return found;
  }, [dayGroups, otThreshold, settings]);

  if (issues.length === 0) return null;

  return (
    <motion.div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
      <div className="flex items-center gap-2 text-amber-700 font-medium text-sm">
        <Shield className="size-4" />Compliance Alerts ({issues.length})
      </div>
      {issues.map((issue, i) => (
        <div key={i} className="flex items-start gap-2 ml-6 text-xs text-amber-600">
          {issue.type === 'break' && <Clock className="size-3 mt-0.5 shrink-0" />}
          {issue.type === 'overtime' && <TrendingUp className="size-3 mt-0.5 shrink-0" />}
          {issue.type === 'consecutive' && <AlertTriangle className="size-3 mt-0.5 shrink-0" />}
          {issue.message}
        </div>
      ))}
    </motion.div>
  );
}

/* ════════════════════════════════════════════
   COST REPORT
   ════════════════════════════════════════════ */
function CostReport({ entries, employees }: { entries: TimeEntry[]; employees: Employee[] }) {
  const [showReport, setShowReport] = useState(false);

  const report = useMemo(() => {
    const byEmployee: Record<string, { emp: Employee; hours: number; cost: number }> = {};
    entries.forEach(e => {
      const emp = employees.find(emp => emp.id === e.userId || getEmployeeUserId(emp) === e.userId);
      if (!emp) return;
      const key = emp.id;
      if (!byEmployee[key]) byEmployee[key] = { emp, hours: 0, cost: 0 };
      byEmployee[key].hours += (e.totalHours || 0);
      byEmployee[key].cost += ((e.regularHours || 0) * (emp.payRate || 0)) + ((e.overtimeHours || 0) * (emp.payRate || 0) * 1.5);
    });
    const values = Object.values(byEmployee);
    return {
      employees: values,
      totalHours: values.reduce((s, v) => s + v.hours, 0),
      totalCost: values.reduce((s, v) => s + v.cost, 0),
      totalRegular: values.reduce((s, v) => s + (v.hours * (v.emp.payRate || 0)), 0),
      totalOT: values.reduce((s, v) => s + v.cost - (v.hours * (v.emp.payRate || 0)), 0),
    };
  }, [entries, employees]);

  if (!showReport) {
    return (
      <motion.div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 cursor-pointer hover:bg-emerald-100 transition-colors" onClick={() => setShowReport(true)} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-emerald-700 font-medium text-sm">
            <DollarSign className="size-4" />Cost Report
          </div>
          <span className="text-lg font-bold text-emerald-800">${report.totalCost.toFixed(0)}</span>
        </div>
        <p className="text-xs text-emerald-600 ml-6">{report.employees.length} employees · {report.totalHours.toFixed(0)}h · Click for details</p>
      </motion.div>
    );
  }

  return (
    <motion.div className="rounded-lg border border-emerald-200 bg-white p-4 space-y-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold flex items-center gap-2"><BarChart3 className="size-4" />Labor Cost Report</h4>
        <button onClick={() => setShowReport(false)} className="p-1 rounded hover:bg-slate-100"><X className="size-4" /></button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div className="p-2 bg-emerald-50 rounded text-center"><p className="text-lg font-bold text-emerald-800">${report.totalCost.toFixed(0)}</p><p className="text-[10px] text-emerald-600">Total Cost</p></div>
        <div className="p-2 bg-blue-50 rounded text-center"><p className="text-lg font-bold text-blue-800">{report.totalHours.toFixed(0)}h</p><p className="text-[10px] text-blue-600">Total Hours</p></div>
        <div className="p-2 bg-amber-50 rounded text-center"><p className="text-lg font-bold text-amber-800">${Math.max(0, report.totalOT).toFixed(0)}</p><p className="text-[10px] text-amber-600">OT Premium</p></div>
      </div>
      <div className="space-y-1 max-h-48 overflow-y-auto">
        {report.employees.map(({ emp, hours, cost }) => (
          <div key={emp.id} className="flex items-center justify-between p-2 bg-slate-50 rounded text-sm">
            <div className="flex items-center gap-2">
              <div className="size-6 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white text-[8px] font-bold">{emp.firstName[0]}</div>
              <span className="truncate">{emp.firstName} {emp.lastName}</span>
            </div>
            <div className="text-right">
              <p className="font-medium">${cost.toFixed(0)}</p>
              <p className="text-[10px] text-slate-400">{hours.toFixed(1)}h @ ${emp.payRate || 0}/hr</p>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

/* ════════════════════════════════════════════
   DAY BOX (with employee name, edit indicator)
   ════════════════════════════════════════════ */
function DayBox({ dayDate, entries, isManager, onComment, onEdit, onDispute, otThreshold, employees, showEmployee, onSelect, isSelected }: {
  dayDate: Date; entries: TimeEntry[]; isManager: boolean;
  onComment: (e: TimeEntry) => void; onEdit: (e: TimeEntry) => void; onDispute: (e: TimeEntry) => void;
  otThreshold: number; employees: Employee[]; showEmployee: boolean; onSelect?: (id: string) => void; isSelected?: boolean;
}) {
  const [expanded, setExpanded] = useState(true);
  const dayTotal = entries.reduce((s, e) => s + (e.totalHours || 0), 0);
  const isTodayFlag = isToday(dayDate);
  const dayIdx = dayDate.getDay();

  const getEntryEmployee = (entry: TimeEntry) => {
    const eid = extractId(entry.userId);
    if (!eid) return undefined;
    return employees.find(e => e.id === eid || getEmployeeUserId(e) === eid);
  };

  return (
    <motion.div className={`rounded-xl border bg-white overflow-hidden ${isTodayFlag ? 'border-blue-300 ring-1 ring-blue-100' : 'border-slate-200'} ${isSelected ? 'ring-2 ring-blue-400' : ''}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center justify-between p-3 hover:bg-slate-50 transition-colors">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex flex-col items-center justify-center ${isTodayFlag ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-600'}`}>
            <span className="text-[10px] font-medium leading-none">{SHORT_DAYS[dayIdx]}</span>
            <span className="text-sm font-bold leading-none">{format(dayDate, 'd')}</span>
          </div>
          <div className="text-left">
            <p className={`text-sm font-semibold ${isTodayFlag ? 'text-blue-700' : 'text-slate-700'}`}>{format(dayDate, 'EEEE')}</p>
            <p className="text-xs text-slate-400">{entries.length} entry{entries.length !== 1 ? 'ies' : 'y'} · {dayTotal.toFixed(1)}h</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {dayTotal > otThreshold && <Badge className="bg-amber-100 text-amber-700 text-[10px] h-5">OT</Badge>}
          {expanded ? <ChevronUp className="size-4 text-slate-400" /> : <ChevronDown className="size-4 text-slate-400" />}
        </div>
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
            <div className="px-3 pb-3 space-y-2">
              <Separator />
              {entries.length === 0 ? (
                <div className="py-4 text-center"><p className="text-sm text-slate-400">No entries</p></div>
              ) : entries.map(entry => {
                const cin = entry.clockIn?.time ? new Date(entry.clockIn.time) : null;
                const cout = entry.clockOut?.time ? new Date(entry.clockOut.time) : null;
                const hrs = entry.totalHours || 0;
                const isOT = hrs > otThreshold;
                const emp = showEmployee ? getEntryEmployee(entry) : undefined;
                const hasComments = (entry.comments?.length || 0) > 0;
                const isEdited = !!entry.lastEditedAt;
                const isDisputed = entry.status === 'DISPUTED';
                const isPending = entry.status === 'PENDING';
                return (
                  <div key={entry.id} className={`p-3 rounded-lg border ${isDisputed ? 'border-red-200 bg-red-50/30' : isPending ? 'border-amber-200 bg-amber-50/30' : isOT ? 'border-amber-200 bg-amber-50/30' : 'border-slate-100 bg-slate-50/50'}`}>
                    {/* Employee name (All Staff view) */}
                    {showEmployee && emp && (
                      <div className="flex items-center gap-1.5 mb-2">
                        <div className="size-5 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white text-[8px] font-bold">{emp.firstName[0]}</div>
                        <span className="text-xs font-medium text-slate-600">{emp.firstName} {emp.lastName}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock className={`size-4 ${isDisputed ? 'text-red-500' : isPending ? 'text-amber-500' : isOT ? 'text-amber-500' : 'text-blue-400'}`} />
                        <span className="text-sm font-medium">{cin ? format(cin, 'h:mm a') : '--:--'} – {cout ? format(cout, 'h:mm a') : '--:--'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-bold ${isDisputed ? 'text-red-600' : isPending ? 'text-amber-600' : isOT ? 'text-amber-600' : 'text-slate-700'}`}>{hrs.toFixed(1)}h</span>
                        <div className="flex items-center gap-0.5">
                          {isDisputed && <Badge className="bg-red-100 text-red-700 text-[9px] h-5">Disputed</Badge>}
                          {isPending && <Badge className="bg-amber-100 text-amber-700 text-[9px] h-5">Pending</Badge>}
                          {hasComments && <MessageSquare className="size-3.5 text-blue-400" />}
                          {isEdited && <span title="Edited"><History className="size-3.5 text-amber-500" /></span>}
                          <button onClick={() => onComment(entry)} className="p-1 rounded hover:bg-slate-200 text-slate-400" title="Comments"><MessageSquare className="size-3.5" /></button>
                          {isManager && <button onClick={() => onEdit(entry)} className="p-1 rounded hover:bg-slate-200 text-slate-400" title="Edit"><Edit3 className="size-3.5" /></button>}
                          {!isManager && <button onClick={() => onDispute(entry)} className="p-1 rounded hover:bg-slate-200 text-red-400" title="Dispute"><Ban className="size-3.5" /></button>}
                        </div>
                      </div>
                    </div>
                    {entry.lastEditedAt && entry.lastEditedByName && (
                      <div className="flex items-center gap-1 text-[10px] text-amber-600 mt-1 ml-6">
                        <Edit3 className="size-3" />Edited by {entry.lastEditedByName} on {format(new Date(entry.lastEditedAt), 'MMM d')}
                      </div>
                    )}
                    {entry.notes && <p className="text-xs text-slate-400 mt-0.5 ml-6">{entry.notes}</p>}
                    <div className="flex items-center gap-2 mt-0.5 ml-6">
                      <span className="text-[10px] text-slate-400">R: {(entry.regularHours || 0).toFixed(1)}h</span>
                      {(entry.overtimeHours || 0) > 0 && <span className="text-[10px] text-amber-500">OT: {(entry.overtimeHours || 0).toFixed(1)}h</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ════════════════════════════════════════════
   MAIN PAGE with React Query
   ════════════════════════════════════════════ */
export default function TimesheetsPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const navigate = useNavigate();
  const { user, currentOrg, setCurrentOrg } = useAuthStore();
  const isManager = ['ADMIN', 'OWNER', 'MANAGER'].includes(user?.role || '');
  const isAdmin = ['ADMIN', 'OWNER'].includes(user?.role || '');
  const queryClient = useQueryClient();

  // Settings from org (reactive to store updates)
  const tsSettings = useMemo(() => {
    const s = currentOrg?.settings?.timesheetSettings;
    return s ? { ...DEFAULT_SETTINGS, ...s } : DEFAULT_SETTINGS;
  }, [currentOrg?.settings?.timesheetSettings]);

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('all');
  const [editEntry, setEditEntry] = useState<TimeEntry | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [commentEntry, setCommentEntry] = useState<TimeEntry | null>(null);
  const [commentOpen, setCommentOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Confirm dialog
  const [confirmDialog, setConfirmDialog] = useState({
    open: false, title: '', description: '', variant: 'default' as 'default' | 'destructive',
    onConfirm: () => {}, onCancel: () => {},
  });

  // Batch selection state
  const [batchSelected, setBatchSelected] = useState<Set<string>>(new Set());
  const [batchMode, setBatchMode] = useState(false);

  const { start: ps, end: pe, label } = useMemo(() => getPayPeriod(currentDate, tsSettings), [currentDate, tsSettings]);

  const viewingUserId = useMemo(() => {
    if (!isManager) return user?.id || '';
    if (selectedEmployeeId === 'all') return user?.id || '';
    return selectedEmployeeId;
  }, [isManager, user, selectedEmployeeId]);

  const isManagingOthers = isManager && selectedEmployeeId !== 'all' && selectedEmployeeId !== user?.id;

  // ─── React Query: Employees ───
  const { data: employees = [], isLoading: employeesLoading } = useQuery({
    queryKey: ['employees', orgId],
    queryFn: () => getEmployees(orgId!),
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
  });

  // ─── React Query: Timesheets ───
  const { data: timesheets = [], isLoading: timesheetsLoading } = useQuery({
    queryKey: ['timesheets', orgId],
    queryFn: () => getTimesheets(orgId!, {}),
    enabled: !!orgId,
    staleTime: 2 * 60 * 1000,
  });

  // ─── React Query: Time Entries ───
  const { data: entries = [], isLoading: entriesLoading } = useQuery({
    queryKey: ['timeEntries', orgId, viewingUserId, ps.toISOString(), pe.toISOString(), selectedEmployeeId],
    queryFn: async () => {
      if (!orgId || !viewingUserId) return [];
      const psStr = ps.toISOString();
      const peStr = pe.toISOString();
      const all: TimeEntry[] = [];
      if (isManager && selectedEmployeeId === 'all') {
        const empIds = employees.filter(e => e.inviteStatus !== 'INVITED').map(e => getEmployeeUserId(e));
        const uniqueIds = [...new Set(empIds)].filter(Boolean);
        for (const uid of uniqueIds.slice(0, 20)) {
          try { const ents = await getTimeEntries(orgId, { userId: uid, startDate: psStr, endDate: peStr }); all.push(...ents); }
          catch (err: unknown) { logger.error('[Timesheets] load entries failed:', err); }
        }
      } else {
        try { const ents = await getTimeEntries(orgId, { userId: viewingUserId, startDate: psStr, endDate: peStr }); all.push(...ents); }
        catch (err: unknown) { logger.error('[Timesheets] load entries failed:', err); }
      }
      return all;
    },
    enabled: !!orgId && !!viewingUserId,
    staleTime: 60 * 1000,
  });

  const activeTimesheet = useMemo(() => {
    if (!viewingUserId) return null;
    return timesheets.find(ts => ts.userId === viewingUserId && isSameDay(new Date(ts.payPeriod.start), ps)) || null;
  }, [timesheets, viewingUserId, ps]);
  const currentStatus = activeTimesheet?.status || 'DRAFT';
  const tsId = activeTimesheet?.id || '';

  const visibleEntries = useMemo(() => {
    if (!viewingUserId) return [];
    if (isManager && selectedEmployeeId === 'all') return entries;
    return entries.filter(e => {
      const entryUserId = typeof e.userId === 'string' ? e.userId : extractId(e.userId);
      return entryUserId === viewingUserId;
    });
  }, [entries, viewingUserId, isManager, selectedEmployeeId]);

  // Day grouping
  const dayGroups = useMemo(() => {
    const days: { key: string; date: Date; entries: TimeEntry[] }[] = [];
    let d = new Date(ps);
    while (d <= pe) { days.push({ key: getDateKey(d), date: new Date(d), entries: [] }); d = addDays(d, 1); }
    visibleEntries.forEach(e => {
      const dateVal = e.clockIn?.time || (e as unknown as Record<string, string>).startTime;
      if (dateVal) { try { const k = getDateKey(new Date(dateVal)); const day = days.find(d => d.key === k); if (day) day.entries.push(e); } catch { /* skip */ } }
    });
    return days;
  }, [visibleEntries, ps, pe]);

  const totals = useMemo(() => visibleEntries.reduce((a, e) => ({ total: a.total + (e.totalHours || 0), regular: a.regular + (e.regularHours || 0), overtime: a.overtime + (e.overtimeHours || 0) }), { total: 0, regular: 0, overtime: 0 }), [visibleEntries]);

  // ─── OPTIMISTIC MUTATIONS ───
  const approveMutation = useMutation({
    mutationFn: (id: string) => approveTimesheet(id, user?.id || ''),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['timesheets', orgId] });
      const previous = queryClient.getQueryData<Timesheet[]>(['timesheets', orgId]);
      queryClient.setQueryData(['timesheets', orgId], (old: Timesheet[] | undefined) => {
        if (!old) return old;
        return old.map(ts => ts.id === id ? { ...ts, status: 'APPROVED', approvedBy: user?.id, approvedAt: new Date().toISOString() } as Timesheet : ts);
      });
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) queryClient.setQueryData(['timesheets', orgId], context.previous);
      toast.error('Failed to approve');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['timesheets', orgId] });
      queryClient.invalidateQueries({ queryKey: ['timeEntries', orgId] });
    },
    onSuccess: () => toast.success('Approved'),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => rejectTimesheet(id, reason),
    onMutate: async ({ id, reason }) => {
      await queryClient.cancelQueries({ queryKey: ['timesheets', orgId] });
      const previous = queryClient.getQueryData<Timesheet[]>(['timesheets', orgId]);
      queryClient.setQueryData(['timesheets', orgId], (old: Timesheet[] | undefined) => {
        if (!old) return old;
        return old.map(ts => ts.id === id ? { ...ts, status: 'REJECTED', rejectionReason: reason } as Timesheet : ts);
      });
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(['timesheets', orgId], context.previous);
      toast.error('Failed to reject');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['timesheets', orgId] });
      queryClient.invalidateQueries({ queryKey: ['timeEntries', orgId] });
    },
    onSuccess: () => toast.success('Rejected'),
  });

  const submitMutation = useMutation({
    mutationFn: (id: string) => submitTimesheet(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['timesheets', orgId] });
      const previous = queryClient.getQueryData<Timesheet[]>(['timesheets', orgId]);
      queryClient.setQueryData(['timesheets', orgId], (old: Timesheet[] | undefined) => {
        if (!old) return old;
        return old.map(ts => ts.id === id ? { ...ts, status: 'SUBMITTED', submittedAt: new Date().toISOString() } as Timesheet : ts);
      });
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) queryClient.setQueryData(['timesheets', orgId], context.previous);
      toast.error('Failed to submit');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['timesheets', orgId] });
    },
    onSuccess: () => toast.success('Submitted'),
  });

  // ─── ACTIONS ───
  const handleGenerate = async () => { if (!orgId || !viewingUserId) return; try { await autoGenerateTimesheet({ userId: viewingUserId, orgId, startDate: ps.toISOString(), endDate: pe.toISOString() }); toast.success('Generated'); queryClient.invalidateQueries({ queryKey: ['timesheets', orgId] }); queryClient.invalidateQueries({ queryKey: ['timeEntries', orgId] }); } catch (e: unknown) { toast.error((e as Error).message || 'Failed'); } };

  const handleSubmit = async () => {
    if (!tsId) { toast.error('No timesheet'); return; }
    setConfirmDialog({
      open: true,
      title: 'Submit Timesheet',
      description: 'You cannot edit after submission. Continue?',
      variant: 'default',
      onConfirm: async () => { submitMutation.mutate(tsId); setConfirmDialog(p => ({ ...p, open: false })); },
      onCancel: () => setConfirmDialog(p => ({ ...p, open: false })),
    });
  };

  const handleApprove = async () => { if (!tsId) return; approveMutation.mutate(tsId); };
  const handleReject = async (reason: string) => { if (!tsId) return; rejectMutation.mutate({ id: tsId, reason }); };

  const handleSaveSettings = async (newSettings: TimesheetSettings) => {
    if (!orgId) return;
    try {
      const updatedOrg = await updateTimesheetSettings(orgId, newSettings as unknown as Record<string, unknown>);
      if (updatedOrg && setCurrentOrg) setCurrentOrg(updatedOrg);
      toast.success('Settings saved and applied');
    } catch (e: unknown) { toast.error((e as Error).message || 'Failed to save'); }
  };

  // ─── PAYROLL EXPORT ───
  const handlePayrollExport = () => {
    const rows = visibleEntries.map(e => {
      const emp = employees.find(emp => emp.id === e.userId || getEmployeeUserId(emp) === e.userId);
      return {
        Employee: emp ? `${emp.firstName} ${emp.lastName}` : e.userId,
        'Emp ID': emp?.employeeId || '',
        Date: e.clockIn?.time ? format(new Date(e.clockIn.time), 'yyyy-MM-dd') : '',
        'Clock In': e.clockIn?.time ? format(new Date(e.clockIn.time), 'HH:mm') : '',
        'Clock Out': e.clockOut?.time ? format(new Date(e.clockOut.time), 'HH:mm') : '',
        'Total Hrs': (e.totalHours || 0).toFixed(2),
        Regular: (e.regularHours || 0).toFixed(2),
        OT: (e.overtimeHours || 0).toFixed(2),
        'OT Premium': ((e.overtimeHours || 0) * ((emp?.payRate || 0) * 0.5)).toFixed(2),
        'Base Pay': ((e.regularHours || 0) * (emp?.payRate || 0)).toFixed(2),
        'Total Pay': (((e.regularHours || 0) * (emp?.payRate || 0)) + ((e.overtimeHours || 0) * (emp?.payRate || 0) * 1.5)).toFixed(2),
        Status: e.status,
        Notes: e.notes || '',
      };
    });
    if (rows.length === 0) { toast.error('Nothing to export'); return; }
    const h = Object.keys(rows[0]);
    const csv = [h.join(','), ...rows.map(r => h.map(c => `"${(r as Record<string, string>)[c] || ''}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `payroll-${getDateKey(ps)}.csv`; a.click(); URL.revokeObjectURL(url);
    toast.success('Payroll exported');
  };

  // ─── BASIC EXPORT ───
  const handleExport = () => {
    const rows = visibleEntries.map(e => ({
      Date: e.clockIn?.time ? format(new Date(e.clockIn.time), 'yyyy-MM-dd') : '',
      'Clock In': e.clockIn?.time ? format(new Date(e.clockIn.time), 'HH:mm') : '',
      'Clock Out': e.clockOut?.time ? format(new Date(e.clockOut.time), 'HH:mm') : '',
      'Total Hrs': (e.totalHours || 0).toFixed(2), Regular: (e.regularHours || 0).toFixed(2), OT: (e.overtimeHours || 0).toFixed(2), Status: e.status, Notes: e.notes || ''
    }));
    if (rows.length === 0) { toast.error('Nothing to export'); return; }
    const h = Object.keys(rows[0]);
    const csv = [h.join(','), ...rows.map(r => h.map(c => `"${(r as Record<string, string>)[c] || ''}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `timesheet-${getDateKey(ps)}.csv`; a.click(); URL.revokeObjectURL(url);
    toast.success('Exported');
  };

  // ─── COMMENTS ───
  const handleAddComment = async (entryId: string, text: string) => {
    try {
      await addTimeEntryComment(entryId, text);
      toast.success('Comment saved');
      queryClient.invalidateQueries({ queryKey: ['timeEntries', orgId] });
    }
    catch (e: unknown) { toast.error((e as Error).message || 'Failed to save comment'); }
  };

  // ─── EDIT ENTRY ───
  const handleEditEntry = async (data: Record<string, unknown>) => {
    const entryId = data.entryId as string;
    if (!entryId) { toast.success('Entry added (demo mode)'); return; }
    try {
      await updateTimeEntry(entryId, data);
      toast.success('Entry updated');
      queryClient.invalidateQueries({ queryKey: ['timeEntries', orgId] });
    }
    catch (e: unknown) { toast.error((e as Error).message || 'Failed to update'); }
  };

  // ─── DISPUTE ───
  const handleDispute = async (entry: TimeEntry) => {
    setConfirmDialog({
      open: true,
      title: 'Dispute Entry',
      description: 'Flag this entry for manager review?',
      variant: 'default',
      onConfirm: async () => {
        try {
          await updateTimeEntry(entry.id, { status: 'DISPUTED', notes: `${entry.notes || ''} [DISPUTED]`.trim() });
          toast.success('Entry disputed');
          queryClient.invalidateQueries({ queryKey: ['timeEntries', orgId] });
        }
        catch (e: unknown) { toast.error((e as Error).message || 'Failed'); }
        setConfirmDialog(p => ({ ...p, open: false }));
      },
      onCancel: () => setConfirmDialog(p => ({ ...p, open: false })),
    });
  };

  // ─── BATCH ACTIONS ───
  const toggleBatchSelect = (id: string) => {
    setBatchSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const batchApproveMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      for (const id of ids) { await approveTimesheet(id, user?.id || ''); }
    },
    onMutate: async (ids) => {
      await queryClient.cancelQueries({ queryKey: ['timesheets', orgId] });
      const previous = queryClient.getQueryData<Timesheet[]>(['timesheets', orgId]);
      queryClient.setQueryData(['timesheets', orgId], (old: Timesheet[] | undefined) => {
        if (!old) return old;
        return old.map(ts => ids.includes(ts.id) ? { ...ts, status: 'APPROVED', approvedBy: user?.id, approvedAt: new Date().toISOString() } as Timesheet : ts);
      });
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(['timesheets', orgId], context.previous);
      toast.error('Batch approve failed');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['timesheets', orgId] });
      queryClient.invalidateQueries({ queryKey: ['timeEntries', orgId] });
    },
    onSuccess: (_d, ids) => { toast.success(`${ids.length} approved`); setBatchSelected(new Set()); setBatchMode(false); },
  });

  const handleBatchApprove = async () => {
    if (batchSelected.size === 0) return;
    setConfirmDialog({
      open: true,
      title: 'Batch Approve',
      description: `Approve ${batchSelected.size} timesheets?`,
      variant: 'default',
      onConfirm: async () => {
        batchApproveMutation.mutate([...batchSelected]);
        setConfirmDialog(p => ({ ...p, open: false }));
      },
      onCancel: () => setConfirmDialog(p => ({ ...p, open: false })),
    });
  };

  const openComments = (e: TimeEntry) => { setCommentEntry(e); setCommentOpen(true); };
  const selectedEmployee = employees.find(e => getEmployeeUserId(e) === selectedEmployeeId);

  const loading = employeesLoading || timesheetsLoading || entriesLoading;

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="size-8 animate-spin text-blue-600" /></div>;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <ArrowLeft className="size-4 text-slate-400" />
          <span className="text-sm text-slate-500">
            {isManagingOthers ? `Managing: ${selectedEmployee?.firstName || ''} ${selectedEmployee?.lastName || ''}` : 'My Timesheet'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && <Button size="sm" variant="outline" onClick={() => setSettingsOpen(true)}><Settings className="size-4 mr-1" />Settings</Button>}
          <Button size="sm" variant="outline" onClick={handleExport}><Download className="size-4 mr-1" />Export</Button>
          {isManager && (
            <Button size="sm" variant="outline" onClick={handlePayrollExport} className="border-emerald-300 text-emerald-700 hover:bg-emerald-50">
              <DollarSign className="size-4 mr-1" />Payroll
            </Button>
          )}
        </div>
      </div>

      {/* Period Nav */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setCurrentDate(getPeriodOffset(currentDate, tsSettings, 'prev'))}><ChevronLeft className="size-4" /></Button>
          <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>Current</Button>
          <Button variant="outline" size="icon" onClick={() => setCurrentDate(getPeriodOffset(currentDate, tsSettings, 'next'))}><ChevronRight className="size-4" /></Button>
        </div>
        <div>
          <h2 className="text-base font-semibold">{label} <span className="text-slate-400 font-normal text-sm">({tsSettings.periodType === 'fortnightly' ? 'Fortnightly' : 'Weekly'})</span></h2>
          <DueIndicator periodEnd={pe} dueDay={tsSettings.timesheetDueDay} status={currentStatus} />
        </div>
      </div>

      {/* Status Banner */}
      {currentStatus !== 'DRAFT' && (
        <motion.div className={`rounded-lg p-3 border ${currentStatus === 'APPROVED' ? 'bg-emerald-50 border-emerald-200' : currentStatus === 'REJECTED' ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-2">
            {currentStatus === 'APPROVED' && <><CheckCircle2 className="size-4 text-emerald-600" /><span className="text-sm font-medium text-emerald-700">Approved{activeTimesheet?.approvedAt ? ` on ${format(new Date(activeTimesheet.approvedAt), 'MMM d')}` : ''}</span></>}
            {currentStatus === 'SUBMITTED' && <><Clock className="size-4 text-amber-600" /><span className="text-sm font-medium text-amber-700">Submitted – awaiting review</span></>}
            {currentStatus === 'REJECTED' && <><XCircle className="size-4 text-red-600" /><span className="text-sm font-medium text-red-700">Rejected{activeTimesheet?.rejectionReason ? `: ${activeTimesheet.rejectionReason}` : ''}</span></>}
          </div>
        </motion.div>
      )}

      <div className="flex flex-col lg:flex-row gap-4">
        {/* Sidebar (manager only) */}
        {isManager && <EmployeeSidebar employees={employees.filter(e => e.inviteStatus !== 'INVITED')} selectedId={selectedEmployeeId} onSelect={setSelectedEmployeeId} onSelectAll={() => setSelectedEmployeeId('all')} />}

        <div className="flex-1 min-w-0 space-y-4">
          {/* Viewing indicator */}
          {isManagingOthers && selectedEmployee && (
            <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
              <div className="size-8 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white text-sm font-bold">{selectedEmployee.firstName[0]}</div>
              <div className="flex-1">
                <p className="font-medium text-sm">{selectedEmployee.firstName} {selectedEmployee.lastName} – {selectedEmployee.position}</p>
                <div className="flex items-center gap-2"><StatusBadge status={currentStatus} /><span className="text-xs text-slate-500">{totals.total.toFixed(1)}h</span></div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            {!isManager && currentStatus === 'DRAFT' && (
              <Button size="sm" onClick={handleSubmit} disabled={submitting || visibleEntries.length === 0 || submitMutation.isPending}>{submitting || submitMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <><Send className="size-4 mr-1" />Submit Timesheet</>}</Button>
            )}
            {isManager && isManagingOthers && currentStatus === 'DRAFT' && (
              <Button size="sm" variant="outline" onClick={() => { setEditEntry(null); setEditOpen(true); }}><Plus className="size-4 mr-1" />Add Entry</Button>
            )}
            {isManager && isManagingOthers && currentStatus === 'SUBMITTED' && (
              <><Button size="sm" onClick={handleApprove} disabled={approveMutation.isPending} className="bg-emerald-600 hover:bg-emerald-700">{approveMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <><CheckCircle2 className="size-4 mr-1" />Approve</>}</Button>
              <Button size="sm" variant="destructive" onClick={() => setRejectOpen(true)} disabled={rejectMutation.isPending}><XCircle className="size-4 mr-1" />Reject</Button></>
            )}
            {isManager && isManagingOthers && visibleEntries.length === 0 && (
              <Button size="sm" variant="outline" onClick={handleGenerate}><Plus className="size-4 mr-1" />Generate from Clock Data</Button>
            )}
            {/* Payslip Link */}
            {!isManagingOthers && (
              <Button size="sm" variant="ghost" onClick={() => navigate(`/orgs/${orgId}/payslips`)}>
                <Receipt className="size-4 mr-1" />Payslips
              </Button>
            )}
            {/* Batch mode toggle */}
            {isManager && isManagingOthers && timesheets.length > 0 && (
              <Button size="sm" variant={batchMode ? "secondary" : "ghost"} onClick={() => { setBatchMode(!batchMode); setBatchSelected(new Set()); }}>
                <Filter className="size-4 mr-1" />{batchMode ? 'Cancel Batch' : 'Batch'}
              </Button>
            )}
          </div>

          {/* Batch actions */}
          {batchMode && batchSelected.size > 0 && (
            <motion.div className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg border border-blue-200" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <span className="text-sm text-blue-700">{batchSelected.size} selected</span>
              <Button size="sm" onClick={handleBatchApprove} disabled={batchApproveMutation.isPending} className="h-7 text-xs bg-emerald-600">{batchApproveMutation.isPending ? <Loader2 className="size-3 animate-spin" /> : <><CheckCircle2 className="size-3 mr-1" />Approve</>}</Button>
              <Button size="sm" variant="ghost" onClick={() => setBatchSelected(new Set())} className="h-7 text-xs">Clear</Button>
            </motion.div>
          )}

          {/* Totals */}
          {visibleEntries.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Card><CardContent className="p-3 text-center"><p className="text-2xl font-bold text-slate-800">{totals.total.toFixed(1)}h</p><p className="text-xs text-slate-500">Total</p></CardContent></Card>
              <Card><CardContent className="p-3 text-center"><p className="text-2xl font-bold text-blue-600">{totals.regular.toFixed(1)}h</p><p className="text-xs text-slate-500">Regular</p></CardContent></Card>
              <Card><CardContent className="p-3 text-center"><p className="text-2xl font-bold text-amber-600">{totals.overtime.toFixed(1)}h</p><p className="text-xs text-slate-500">Overtime</p></CardContent></Card>
            </div>
          )}

          {/* Compliance Panel */}
          {visibleEntries.length > 0 && (
            <CompliancePanel dayGroups={dayGroups} otThreshold={tsSettings.overtimeThresholds.daily.hours} settings={tsSettings} />
          )}

          {/* Cost Report (manager only) */}
          {isManager && visibleEntries.length > 0 && (
            <CostReport entries={visibleEntries} employees={employees} />
          )}

          {/* Day Boxes */}
          <div className="space-y-3">
            {dayGroups.map(d => (
              <DayBox key={d.key} dayDate={d.date} entries={d.entries} isManager={isManager}
                onComment={openComments} onEdit={e => { setEditEntry(e); setEditOpen(true); }} onDispute={handleDispute}
                otThreshold={tsSettings.overtimeThresholds.daily.hours}
                employees={employees} showEmployee={isManager && selectedEmployeeId === 'all'} />
            ))}
          </div>

          {visibleEntries.length === 0 && (
            <div className="text-center py-12">
              <ClipboardCheck className="size-12 mx-auto text-slate-300 mb-3" />
              <p className="text-slate-500 font-medium">No entries this period</p>
              <p className="text-sm text-slate-400 mt-1">{isManagingOthers ? 'Generate from clock data or add manually' : 'Clock in/out to record your hours'}</p>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <CommentDrawer isOpen={commentOpen} onClose={() => setCommentOpen(false)}
        comments={commentEntry?.comments || []}
        onAdd={t => commentEntry && handleAddComment(commentEntry.id, t)}
        canAdd={currentStatus === 'DRAFT' || currentStatus === 'REJECTED'} />
      <EntryEditModal isOpen={editOpen} onClose={() => setEditOpen(false)} onSave={handleEditEntry} onAddComment={editEntry ? async (text) => { await handleAddComment(editEntry.id, text); } : undefined} entry={editEntry} ps={ps} pe={pe} canManage={isManager} />
      <RejectModal isOpen={rejectOpen} onClose={() => setRejectOpen(false)} onReject={handleReject} />
      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} settings={tsSettings} onSave={handleSaveSettings} />

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
