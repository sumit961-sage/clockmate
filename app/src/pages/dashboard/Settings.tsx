// ClockMate Pro - Settings Page with Unified Save + Debounced Auto-Save
import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Settings, Bell, Clock, Shield, Globe, DollarSign,
  Loader2, Save, CheckCircle2, AlertTriangle, ChevronDown,
  Moon, Sun, Monitor
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { SkeletonCard } from '@/components/SkeletonCard';
import { useDebounce } from '@/hooks/useDebounce';
import { useAuthStore } from '@/store';
import { updateOrg, updateOrgNotifications, updateTimesheetSettings } from '@/lib/api';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import type { TimesheetSettings, Organization, OrgSettings } from '@/types';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const CURRENCIES = [
  { code: 'AUD', symbol: '$', name: 'Australian Dollar' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'NZD', symbol: '$', name: 'New Zealand Dollar' },
];

const DEFAULT_TS: TimesheetSettings = {
  periodType: 'weekly',
  weekStartDay: 'monday',
  timesheetDueDay: 2,
  approvalWorkflow: 'manager',
  roundingRule: { interval: 15, direction: 'nearest' },
  overtimeThresholds: { daily: { hours: 8 }, dailyDouble: { hours: 12 }, weekly: { hours: 38 } },
  breakRules: { autoDeductAfterHours: 5, duration: 30, type: 'unpaid' },
  lockPeriodDays: 7,
};

function SaveIndicator({ status }: { status: 'idle' | 'saving' | 'saved' | 'error' }) {
  if (status === 'idle') return null;
  if (status === 'saving') return <Badge variant="outline" className="text-amber-600 border-amber-200 gap-1"><Loader2 className="size-3 animate-spin" />Saving...</Badge>;
  if (status === 'saved') return <Badge variant="outline" className="text-emerald-600 border-emerald-200 gap-1"><CheckCircle2 className="size-3" />Saved</Badge>;
  return <Badge variant="outline" className="text-red-600 border-red-200 gap-1"><AlertTriangle className="size-3" />Error</Badge>;
}

export default function SettingsPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const { user, currentOrg, setCurrentOrg } = useAuthStore();
  const isAdmin = ['ADMIN', 'OWNER'].includes(user?.role || '');

  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Organization settings
  const [orgForm, setOrgForm] = useState({
    name: '',
    timezone: 'Australia/Sydney',
    currency: 'AUD',
    dateFormat: 'DD/MM/YYYY',
    timeFormat: '12h' as '12h' | '24h',
    industry: '',
    location: '',
  });

  // Notification toggles
  const [notifications, setNotifications] = useState({
    email: true,
    push: true,
    sms: false,
    shiftReminders: true,
    timesheetApprovals: true,
    leaveUpdates: true,
    overtimeAlerts: true,
    geofenceAlerts: false,
    weeklyDigest: true,
  });

  // Timesheet settings
  const [tsSettings, setTsSettings] = useState<TimesheetSettings>(DEFAULT_TS);

  // Debounced values for auto-save
  const debouncedNotifications = useDebounce(notifications, 500);
  const debouncedOrg = useDebounce(orgForm, 800);
  const debouncedTs = useDebounce(tsSettings, 800);

  const [confirmDialog, setConfirmDialog] = useState({
    open: false, title: '', description: '', variant: 'default' as 'default' | 'destructive',
    onConfirm: () => {}, onCancel: () => {},
  });

  useEffect(() => {
    if (currentOrg) {
      setOrgForm({
        name: currentOrg.name || '',
        timezone: currentOrg.timezone || 'Australia/Sydney',
        currency: currentOrg.currency || 'AUD',
        dateFormat: currentOrg.settings?.dateFormat || 'DD/MM/YYYY',
        timeFormat: (currentOrg.settings?.timeFormat as '12h' | '24h') || '12h',
        industry: currentOrg.industry || '',
        location: currentOrg.location || '',
      });
      const s = currentOrg.settings;
      if (s?.timesheetSettings) {
        setTsSettings({ ...DEFAULT_TS, ...s.timesheetSettings });
      }
      setLoading(false);
    }
  }, [currentOrg]);

  // Auto-save notifications
  useEffect(() => {
    if (!orgId || loading) return;
    const saveNotifications = async () => {
      setSaveStatus('saving');
      try {
        await updateOrgNotifications(orgId, debouncedNotifications);
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } catch (err: unknown) {
        logger.error('[Settings] auto-save notifications failed:', err);
        setSaveStatus('error');
      }
    };
    saveNotifications();
  }, [debouncedNotifications, orgId, loading]);

  // Auto-save org
  useEffect(() => {
    if (!orgId || loading) return;
    const saveOrg = async () => {
      try {
        const updated = await updateOrg(orgId, {
          name: debouncedOrg.name,
          timezone: debouncedOrg.timezone,
          currency: debouncedOrg.currency,
          settings: {
            dateFormat: debouncedOrg.dateFormat,
            timeFormat: debouncedOrg.timeFormat,
            workingDays: currentOrg?.settings?.workingDays || [1, 2, 3, 4, 5],
            publicHolidays: currentOrg?.settings?.publicHolidays || [],
            timesheetSettings: tsSettings,
            features: currentOrg?.settings?.features || {},
          } as OrgSettings,
        });
        if (setCurrentOrg) setCurrentOrg(updated);
      } catch (err: unknown) {
        logger.error('[Settings] auto-save org failed:', err);
      }
    };
    saveOrg();
  }, [debouncedOrg, orgId, loading, setCurrentOrg]);

  // Auto-save timesheet settings
  useEffect(() => {
    if (!orgId || loading) return;
    const saveTs = async () => {
      try {
        const updated = await updateTimesheetSettings(orgId, debouncedTs as unknown as Record<string, unknown>);
        if (setCurrentOrg) setCurrentOrg(updated);
      } catch (err: unknown) {
        logger.error('[Settings] auto-save timesheet settings failed:', err);
      }
    };
    saveTs();
  }, [debouncedTs, orgId, loading, setCurrentOrg]);

  const handleToggle = (key: keyof typeof notifications) => {
    setNotifications(p => ({ ...p, [key]: !p[key] }));
  };

  const toggleTimeFormat = () => {
    setOrgForm(p => ({ ...p, timeFormat: p.timeFormat === '12h' ? '24h' : '12h' }));
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4 px-4">
        <SkeletonCard rows={3} />
        <SkeletonCard rows={4} />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center px-4">
        <Shield className="size-12 text-slate-300 mb-3" />
        <p className="text-slate-600 font-medium">Settings restricted to administrators</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4 px-4 sm:px-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings className="size-4 text-slate-400" />
          <span className="text-sm text-slate-500">Settings</span>
        </div>
        <SaveIndicator status={saveStatus} />
      </div>

      <Tabs defaultValue="general">
        <TabsList className="mb-4 flex-wrap h-auto">
          <TabsTrigger value="general"><Globe className="size-4 mr-1" />General</TabsTrigger>
          <TabsTrigger value="notifications"><Bell className="size-4 mr-1" />Notifications</TabsTrigger>
          <TabsTrigger value="timesheets"><Clock className="size-4 mr-1" />Timesheets</TabsTrigger>
          <TabsTrigger value="payroll"><DollarSign className="size-4 mr-1" />Payroll</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Organization</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Organization Name</label>
                <Input value={orgForm.name} onChange={e => setOrgForm(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Timezone</label>
                  <select value={orgForm.timezone} onChange={e => setOrgForm(p => ({ ...p, timezone: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm mt-1">
                    <option value="Australia/Sydney">Australia/Sydney</option>
                    <option value="Australia/Melbourne">Australia/Melbourne</option>
                    <option value="Australia/Brisbane">Australia/Brisbane</option>
                    <option value="Australia/Perth">Australia/Perth</option>
                    <option value="Pacific/Auckland">Pacific/Auckland</option>
                    <option value="UTC">UTC</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">Currency</label>
                  <select value={orgForm.currency} onChange={e => setOrgForm(p => ({ ...p, currency: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm mt-1">
                    {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.symbol} {c.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Industry</label>
                  <Input value={orgForm.industry} onChange={e => setOrgForm(p => ({ ...p, industry: e.target.value }))} placeholder="e.g. Healthcare" />
                </div>
                <div>
                  <label className="text-sm font-medium">Location</label>
                  <Input value={orgForm.location} onChange={e => setOrgForm(p => ({ ...p, location: e.target.value }))} placeholder="e.g. Sydney, AU" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Date & Time Format</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <button
                  onClick={toggleTimeFormat}
                  className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border transition-colors ${orgForm.timeFormat === '12h' ? 'bg-blue-50 border-blue-300' : 'border-slate-200 hover:bg-slate-50'}`}
                >
                  <Sun className="size-4" />12-hour (AM/PM)
                </button>
                <button
                  onClick={toggleTimeFormat}
                  className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border transition-colors ${orgForm.timeFormat === '24h' ? 'bg-blue-50 border-blue-300' : 'border-slate-200 hover:bg-slate-50'}`}
                >
                  <Monitor className="size-4" />24-hour
                </button>
              </div>
              <p className="text-xs text-slate-400 mt-2">Preview: {orgForm.timeFormat === '12h' ? '2:30 PM' : '14:30'}</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Bell className="size-4" />Notification Channels
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { key: 'email' as const, label: 'Email Notifications', desc: 'Receive updates via email' },
                { key: 'push' as const, label: 'Push Notifications', desc: 'Browser and mobile push alerts' },
                { key: 'sms' as const, label: 'SMS Alerts', desc: 'Text messages for urgent updates' },
              ].map(item => (
                <div key={item.key} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="text-xs text-slate-500">{item.desc}</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifications[item.key]}
                    onChange={() => handleToggle(item.key)}
                    className="size-5 cursor-pointer"
                    aria-label={`Toggle ${item.label}`}
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Event Notifications</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { key: 'shiftReminders' as const, label: 'Shift Reminders', desc: 'Before shift starts' },
                { key: 'timesheetApprovals' as const, label: 'Timesheet Approvals', desc: 'When timesheets need review' },
                { key: 'leaveUpdates' as const, label: 'Leave Updates', desc: 'Requests and approvals' },
                { key: 'overtimeAlerts' as const, label: 'Overtime Alerts', desc: 'When thresholds exceeded' },
                { key: 'geofenceAlerts' as const, label: 'Geofence Alerts', desc: 'Clock in/out outside range' },
                { key: 'weeklyDigest' as const, label: 'Weekly Digest', desc: 'Summary every Monday' },
              ].map(item => (
                <div key={item.key} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="text-xs text-slate-500">{item.desc}</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifications[item.key]}
                    onChange={() => handleToggle(item.key)}
                    className="size-5 cursor-pointer"
                    aria-label={`Toggle ${item.label}`}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="timesheets" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Pay Period</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Period Type</label>
                <div className="flex gap-2 mt-1">
                  {(['weekly', 'fortnightly', 'monthly'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => setTsSettings(p => ({ ...p, periodType: t }))}
                      className={`flex-1 p-2 rounded-lg border text-sm capitalize ${tsSettings.periodType === t ? 'bg-blue-50 border-blue-300' : 'border-slate-200 hover:bg-slate-50'}`}
                    >
                      {t === 'fortnightly' ? 'Fortnightly' : t}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Week Starts On</label>
                  <select
                    value={tsSettings.weekStartDay}
                    onChange={e => setTsSettings(p => ({ ...p, weekStartDay: e.target.value as 'sunday' | 'monday' | 'saturday' }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm mt-1"
                  >
                    {DAYS.map((d, i) => <option key={i} value={d.toLowerCase()}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">Timesheet Due Day</label>
                  <select
                    value={tsSettings.timesheetDueDay}
                    onChange={e => setTsSettings(p => ({ ...p, timesheetDueDay: parseInt(e.target.value) }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm mt-1"
                  >
                    {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Overtime Rules</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Daily OT Threshold (hrs)</label>
                  <Input
                    type="number"
                    min="1"
                    max="24"
                    step="0.5"
                    value={tsSettings.overtimeThresholds.daily.hours}
                    onChange={e => setTsSettings(p => ({ ...p, overtimeThresholds: { ...p.overtimeThresholds, daily: { hours: parseFloat(e.target.value) } } }))}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Weekly OT Threshold (hrs)</label>
                  <Input
                    type="number"
                    min="1"
                    max="80"
                    step="0.5"
                    value={tsSettings.overtimeThresholds.weekly.hours}
                    onChange={e => setTsSettings(p => ({ ...p, overtimeThresholds: { ...p.overtimeThresholds, weekly: { hours: parseFloat(e.target.value) } } }))}
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Break Auto-Deduct After (hrs)</label>
                <Input
                  type="number"
                  min="0"
                  max="12"
                  step="0.5"
                  value={tsSettings.breakRules.autoDeductAfterHours}
                  onChange={e => setTsSettings(p => ({ ...p, breakRules: { ...p.breakRules, autoDeductAfterHours: parseFloat(e.target.value) } }))}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payroll" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Payroll Settings</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                <p className="text-sm text-blue-700 font-medium">Payroll is calculated on the backend</p>
                <p className="text-xs text-blue-600 mt-1">Tax, super, and net pay are computed server-side based on employee pay rates and organization settings.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Tax Rate (%)</label>
                  <Input type="number" value="15" disabled className="bg-slate-50" />
                  <p className="text-xs text-slate-400 mt-1">Managed by backend</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Super Rate (%)</label>
                  <Input type="number" value="11" disabled className="bg-slate-50" />
                  <p className="text-xs text-slate-400 mt-1">Managed by backend</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

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
