// ClockMate Pro - Payslips Page with Backend-Driven Calculations
import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText, Download, Plus, X, Loader2, ChevronDown, ChevronUp,
  Calendar, DollarSign, User, Clock, Briefcase, CheckCircle2,
  AlertTriangle, RefreshCw, Eye, ArrowLeft, Receipt
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { SkeletonCard } from '@/components/SkeletonCard';
import { useAuthStore } from '@/store';
import {
  getPayslips, createPayslip, getEmployees, getPayslipPdf
} from '@/lib/api';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import type { Payslip, Employee, PayslipCreatePayload } from '@/types';
import { format, startOfWeek, endOfWeek, subWeeks } from 'date-fns';

function PayslipCreateModal({ isOpen, onClose, employees, onCreate, orgId }: {
  isOpen: boolean; onClose: () => void; employees: Employee[];
  onCreate: (data: PayslipCreatePayload) => Promise<void>; orgId: string;
}) {
  const [form, setForm] = useState({
    employeeId: '',
    payPeriodStart: format(subWeeks(new Date(), 1), 'yyyy-MM-dd'),
    payPeriodEnd: format(new Date(), 'yyyy-MM-dd'),
    payDate: format(new Date(), 'yyyy-MM-dd'),
    regularHours: '38',
    overtimeHours: '0',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!form.employeeId) { toast.error('Select an employee'); return; }
    const regularHours = parseFloat(form.regularHours);
    const overtimeHours = parseFloat(form.overtimeHours);
    if (isNaN(regularHours) || regularHours < 0) { toast.error('Invalid regular hours'); return; }
    if (isNaN(overtimeHours) || overtimeHours < 0) { toast.error('Invalid overtime hours'); return; }

    setSaving(true);
    try {
      await onCreate({
        orgId,
        employeeId: form.employeeId,
        payPeriod: { start: form.payPeriodStart, end: form.payPeriodEnd },
        payDate: form.payDate,
        regularHours,
        overtimeHours,
      });
      onClose();
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Failed to create payslip');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          <motion.div
            className="fixed z-50 bg-white rounded-2xl shadow-2xl w-[95vw] max-w-md p-5 space-y-4"
            style={{ left: '50%', top: '47%', transform: 'translate(-50%, -50%)' }}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold flex items-center gap-2"><Receipt className="size-5 text-blue-500" />Create Payslip</h3>
              <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100" aria-label="Close"><X className="size-5" /></button>
            </div>
            <p className="text-sm text-slate-500">Tax, super, and net pay will be calculated by the backend.</p>

            <div>
              <label className="text-sm font-medium">Employee *</label>
              <select
                value={form.employeeId}
                onChange={e => setForm(p => ({ ...p, employeeId: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm mt-1"
              >
                <option value="">Select employee...</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName} – {emp.position}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Pay Period Start</label>
                <input type="date" value={form.payPeriodStart} onChange={e => setForm(p => ({ ...p, payPeriodStart: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Pay Period End</label>
                <input type="date" value={form.payPeriodEnd} onChange={e => setForm(p => ({ ...p, payPeriodEnd: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm mt-1" />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Pay Date</label>
              <input type="date" value={form.payDate} onChange={e => setForm(p => ({ ...p, payDate: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm mt-1" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Regular Hours</label>
                <Input type="number" min="0" step="0.5" value={form.regularHours} onChange={e => setForm(p => ({ ...p, regularHours: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium">Overtime Hours</label>
                <Input type="number" min="0" step="0.5" value={form.overtimeHours} onChange={e => setForm(p => ({ ...p, overtimeHours: e.target.value }))} />
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSubmit} disabled={saving} className="flex-1">
                {saving ? <Loader2 className="size-4 animate-spin" /> : 'Create Payslip'}
              </Button>
              <Button variant="outline" onClick={onClose}>Cancel</Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default function PayslipsPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const { user } = useAuthStore();
  const isManager = ['ADMIN', 'OWNER', 'MANAGER'].includes(user?.role || '');

  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const [confirmDialog, setConfirmDialog] = useState({
    open: false, title: '', description: '', variant: 'default' as 'default' | 'destructive',
    onConfirm: () => {}, onCancel: () => {},
  });

  const loadData = useCallback(async () => {
    if (!orgId) return;
    try {
      setLoading(true);
      const [ps, emps] = await Promise.all([getPayslips(orgId), getEmployees(orgId)]);
      setPayslips(ps); setEmployees(emps);
    } catch (err: unknown) {
      const error = err as Error;
      logger.error('[Payslips] load failed:', error);
      toast.error(error.message || 'Failed to load payslips');
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCreate = async (data: PayslipCreatePayload) => {
    await createPayslip(data);
    toast.success('Payslip created');
    loadData();
  };

  const handleDownloadPdf = async (id: string) => {
    setDownloadingId(id);
    try {
      const blob = await getPayslipPdf(id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `payslip-${id}.pdf`; a.click();
      URL.revokeObjectURL(url);
      toast.success('PDF downloaded');
    } catch (err: unknown) {
      toast.error((err as Error).message || 'PDF download failed');
    } finally {
      setDownloadingId(null);
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-4 px-4">
        <SkeletonCard rows={3} />
        <SkeletonCard rows={2} />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4 px-4 sm:px-0">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <ArrowLeft className="size-4 text-slate-400" />
          <span className="text-sm text-slate-500">Payslips</span>
        </div>
        {isManager && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4 mr-1" />Create Payslip
          </Button>
        )}
      </div>

      <div className="space-y-3">
        {payslips.map(payslip => {
          const emp = employees.find(e => e.id === payslip.employeeId);
          const isExpanded = expandedId === payslip.id;
          return (
            <motion.div key={payslip.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <Card>
                <CardContent className="py-3 px-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="size-10 rounded-lg bg-blue-100 flex items-center justify-center">
                        <FileText className="size-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          {emp ? `${emp.firstName} ${emp.lastName}` : payslip.employeeName || 'Unknown'}
                        </p>
                        <p className="text-xs text-slate-500">
                          {payslip.payPeriod?.start ? format(new Date(payslip.payPeriod.start), 'dd MMM') : ''} – {payslip.payPeriod?.end ? format(new Date(payslip.payPeriod.end), 'dd MMM yyyy') : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        ${payslip.grossPay?.toFixed(2) || '0.00'}
                      </Badge>
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : payslip.id)}
                        className="p-1 rounded hover:bg-slate-100"
                        aria-label={isExpanded ? 'Collapse' : 'Expand'}
                      >
                        {isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                      </button>
                    </div>
                  </div>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="pt-3 mt-3 border-t space-y-2">
                          {/* Pay Summary - from backend only */}
                          <div className="grid grid-cols-2 gap-2">
                            <div className="p-2 bg-slate-50 rounded">
                              <p className="text-[10px] text-slate-500">Gross Pay</p>
                              <p className="text-sm font-bold">${payslip.grossPay?.toFixed(2) || '0.00'}</p>
                            </div>
                            <div className="p-2 bg-slate-50 rounded">
                              <p className="text-[10px] text-slate-500">Net Pay</p>
                              <p className="text-sm font-bold text-emerald-700">${payslip.netPay?.toFixed(2) || '0.00'}</p>
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-2 text-center">
                            <div className="p-2 bg-red-50 rounded">
                              <p className="text-[10px] text-red-600">Tax</p>
                              <p className="text-xs font-medium">${payslip.tax?.toFixed(2) || '0.00'}</p>
                            </div>
                            <div className="p-2 bg-blue-50 rounded">
                              <p className="text-[10px] text-blue-600">Super</p>
                              <p className="text-xs font-medium">${payslip.superannuation?.toFixed(2) || '0.00'}</p>
                            </div>
                            <div className="p-2 bg-amber-50 rounded">
                              <p className="text-[10px] text-amber-600">Hours</p>
                              <p className="text-xs font-medium">{payslip.regularHours?.toFixed(1) || '0'}h</p>
                            </div>
                          </div>

                          {payslip.overtimeHours && payslip.overtimeHours > 0 && (
                            <p className="text-xs text-amber-600 text-center">OT: {payslip.overtimeHours}h @ {payslip.overtimeRate || '1.5x'}</p>
                          )}

                          <div className="flex gap-2 pt-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1"
                              onClick={() => handleDownloadPdf(payslip.id)}
                              disabled={downloadingId === payslip.id}
                            >
                              {downloadingId === payslip.id ? (
                                <Loader2 className="size-3 animate-spin mr-1" />
                              ) : (
                                <Download className="size-3 mr-1" />
                              )}
                              PDF
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1"
                              onClick={() => toast.info('Regenerate coming soon')}
                            >
                              <RefreshCw className="size-3 mr-1" />Regenerate
                            </Button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {payslips.length === 0 && (
        <div className="text-center py-12">
          <Receipt className="size-12 mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 font-medium">No payslips yet</p>
          <p className="text-sm text-slate-400 mt-1">Create a payslip to get started</p>
        </div>
      )}

      <PayslipCreateModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        employees={employees}
        onCreate={handleCreate}
        orgId={orgId || ''}
      />

      <ConfirmDialog
        isOpen={confirmDialog.open}
        title={confirmDialog.title}
        description={confirmDialog.description}
        variant={confirmDialog.variant}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(p => ({ ...p, open: false }))}
      />
    </div>
  );
}
