// ClockMate Pro - Profile Page with Real API Integration
import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  User, Mail, Phone, MapPin, Briefcase, Calendar, Shield,
  Clock, DollarSign, Award, Loader2, Camera, Save, CheckCircle2,
  AlertTriangle, X, Moon, Globe, Bell
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { SkeletonCard } from '@/components/SkeletonCard';
import { useAuthStore } from '@/store';
import { updateUser, uploadAvatar } from '@/lib/api';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import type { Employee } from '@/types';

const DEPARTMENTS = ['Engineering', 'Sales', 'Marketing', 'HR', 'Finance', 'Operations', 'Customer Support', 'IT', 'Legal', 'Administration', 'General'];
const POSITIONS = ['Manager', 'Senior Engineer', 'Engineer', 'Junior Engineer', 'Team Lead', 'Specialist', 'Analyst', 'Coordinator', 'Director', 'VP', 'Intern', 'Consultant', 'Employee'];

function formatAUPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('61') && digits.length >= 11) {
    return `+${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;
  }
  if (digits.startsWith('0') && digits.length === 10) {
    return `+61 ${digits.slice(1, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }
  return phone;
}

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateAUPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 9;
}

function AvatarUpload({ currentUrl, onUpload, maxSizeMB = 2 }: { currentUrl?: string; onUpload: (file: File) => Promise<void>; maxSizeMB?: number }) {
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (file.size > maxSizeMB * 1024 * 1024) {
      toast.error(`File too large. Max ${maxSizeMB}MB`);
      return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('Only JPG, PNG, WebP images allowed');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);
    setUploading(true);
    try { await onUpload(file); setPreview(null); }
    catch (err: unknown) { toast.error((err as Error).message || 'Upload failed'); }
    finally { setUploading(false); }
  };

  const src = preview || currentUrl;
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative">
        {src ? (
          <img src={src} alt="Avatar" className="size-24 rounded-full object-cover border-4 border-white shadow-lg" />
        ) : (
          <div className="size-24 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-3xl font-bold border-4 border-white shadow-lg">
            <User className="size-10" />
          </div>
        )}
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="absolute bottom-0 right-0 size-8 rounded-full bg-slate-800 text-white flex items-center justify-center shadow-md hover:bg-slate-700 disabled:opacity-50"
          aria-label="Change profile photo"
        >
          {uploading ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
      />
      <p className="text-xs text-slate-400">JPG/PNG, max {maxSizeMB}MB</p>
    </div>
  );
}

export default function ProfilePage() {
  const { user, setUser } = useAuthStore();
  const employee = user as unknown as Employee | undefined;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [form, setForm] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || '',
    phone: user?.phone || '',
    department: employee?.department || 'General',
    position: employee?.position || 'Employee',
    timezone: 'Australia/Sydney',
    notifications: true,
    darkMode: false,
  });

  const [confirmDialog, setConfirmDialog] = useState({ open: false, title: '', description: '', onConfirm: () => {} });

  useEffect(() => {
    if (user) {
      setForm(p => ({
        ...p,
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || '',
        phone: user.phone || '',
        department: employee?.department || 'General',
        position: employee?.position || 'Employee',
      }));
    }
  }, [user, employee?.department, employee?.position]);

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.firstName.trim()) e.firstName = 'First name is required';
    if (!form.lastName.trim()) e.lastName = 'Last name is required';
    if (!form.email.trim()) e.email = 'Email is required';
    else if (!validateEmail(form.email)) e.email = 'Invalid email address';
    if (form.phone && !validateAUPhone(form.phone)) e.phone = 'Invalid phone number';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate() || !user?.id) return;
    setSaving(true);
    try {
      const updated = await updateUser(user.id, {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
      });
      setUser(updated);
      toast.success('Profile saved successfully');
    } catch (err: unknown) {
      const error = err as Error;
      logger.error('[Profile] save failed:', error);
      toast.error(error.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (file: File) => {
    if (!user?.id) return;
    const result = await uploadAvatar(user.id, file);
    setUser({ ...user, avatar: result.avatar });
    toast.success('Profile photo updated');
  };

  const handlePhoneChange = (val: string) => {
    const formatted = formatAUPhone(val);
    setForm(p => ({ ...p, phone: formatted }));
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4 px-4">
        <SkeletonCard rows={4} />
        <SkeletonCard rows={3} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center px-4">
        <AlertTriangle className="size-12 text-amber-500 mb-3" />
        <p className="text-slate-600 font-medium">Not logged in</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4 px-4 sm:px-0">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-2 mb-4">
          <User className="size-4 text-slate-400" />
          <span className="text-sm text-slate-500">My Profile</span>
        </div>
      </motion.div>

      <Tabs defaultValue="profile">
        <TabsList className="mb-4">
          <TabsTrigger value="profile"><User className="size-4 mr-1" />Profile</TabsTrigger>
          <TabsTrigger value="preferences"><Globe className="size-4 mr-1" />Preferences</TabsTrigger>
          <TabsTrigger value="security"><Shield className="size-4 mr-1" />Security</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center mb-6">
                <AvatarUpload currentUrl={user.avatar} onUpload={handleAvatarUpload} />
                <h3 className="text-lg font-semibold mt-3">{user.firstName} {user.lastName}</h3>
                <Badge variant="secondary" className="mt-1">{user.role}</Badge>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium flex items-center gap-1 mb-1">
                    <User className="size-3.5 text-slate-400" />First Name
                  </label>
                  <Input value={form.firstName} onChange={e => setForm(p => ({ ...p, firstName: e.target.value }))} className={errors.firstName ? 'border-red-300' : ''} />
                  {errors.firstName && <p className="text-xs text-red-500 mt-1">{errors.firstName}</p>}
                </div>
                <div>
                  <label className="text-sm font-medium flex items-center gap-1 mb-1">
                    <User className="size-3.5 text-slate-400" />Last Name
                  </label>
                  <Input value={form.lastName} onChange={e => setForm(p => ({ ...p, lastName: e.target.value }))} className={errors.lastName ? 'border-red-300' : ''} />
                  {errors.lastName && <p className="text-xs text-red-500 mt-1">{errors.lastName}</p>}
                </div>
                <div>
                  <label className="text-sm font-medium flex items-center gap-1 mb-1">
                    <Mail className="size-3.5 text-slate-400" />Email
                  </label>
                  <Input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} className={errors.email ? 'border-red-300' : ''} />
                  {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
                </div>
                <div>
                  <label className="text-sm font-medium flex items-center gap-1 mb-1">
                    <Phone className="size-3.5 text-slate-400" />Phone
                  </label>
                  <Input value={form.phone} onChange={e => handlePhoneChange(e.target.value)} placeholder="+61 4XX XXX XXX" className={errors.phone ? 'border-red-300' : ''} />
                  {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone}</p>}
                </div>
              </div>

              <div className="mt-4 flex justify-end">
                <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
                  {saving ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Save className="size-4 mr-2" />}
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Employment Details Card */}
          {employee && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Briefcase className="size-4" />Employment Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <p className="text-xs text-slate-500 flex items-center gap-1"><Briefcase className="size-3" />Department</p>
                    <p className="text-sm font-medium mt-1">{employee.department || 'Not set'}</p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <p className="text-xs text-slate-500 flex items-center gap-1"><Award className="size-3" />Position</p>
                    <p className="text-sm font-medium mt-1">{employee.position || 'Not set'}</p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <p className="text-xs text-slate-500 flex items-center gap-1"><DollarSign className="size-3" />Pay Rate</p>
                    <p className="text-sm font-medium mt-1">${employee.payRate || 0} / {employee.payType === 'HOURLY' ? 'hour' : 'year'}</p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <p className="text-xs text-slate-500 flex items-center gap-1"><Calendar className="size-3" />Start Date</p>
                    <p className="text-sm font-medium mt-1">{employee.startDate ? new Date(employee.startDate).toLocaleDateString() : 'Not set'}</p>
                  </div>
                </div>
                {employee.employeeId && (
                  <div className="p-3 bg-slate-50 rounded-lg flex items-center gap-2">
                    <Shield className="size-4 text-slate-400" />
                    <span className="text-sm text-slate-600">Employee ID: <strong>{employee.employeeId}</strong></span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="preferences" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Preferences</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="size-8 rounded-lg bg-blue-100 flex items-center justify-center"><Bell className="size-4 text-blue-600" /></div>
                  <div>
                    <p className="text-sm font-medium">Notifications</p>
                    <p className="text-xs text-slate-500">Receive shift and timesheet alerts</p>
                  </div>
                </div>
                <input type="checkbox" checked={form.notifications} onChange={e => setForm(p => ({ ...p, notifications: e.target.checked }))} className="size-5" />
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="size-8 rounded-lg bg-slate-800 flex items-center justify-center"><Moon className="size-4 text-white" /></div>
                  <div>
                    <p className="text-sm font-medium">Dark Mode</p>
                    <p className="text-xs text-slate-500">Coming soon</p>
                  </div>
                </div>
                <input type="checkbox" checked={form.darkMode} onChange={e => setForm(p => ({ ...p, darkMode: e.target.checked }))} className="size-5" disabled />
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="text-sm font-medium flex items-center gap-2"><Globe className="size-4 text-slate-400" />Timezone</p>
                <select value={form.timezone} onChange={e => setForm(p => ({ ...p, timezone: e.target.value }))} className="w-full mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm">
                  <option value="Australia/Sydney">Australia/Sydney (AEST/AEDT)</option>
                  <option value="Australia/Melbourne">Australia/Melbourne</option>
                  <option value="Australia/Brisbane">Australia/Brisbane</option>
                  <option value="Australia/Perth">Australia/Perth</option>
                  <option value="Pacific/Auckland">Pacific/Auckland</option>
                  <option value="UTC">UTC</option>
                </select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Security</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="p-3 bg-slate-50 rounded-lg flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Password</p>
                  <p className="text-xs text-slate-500">Last changed recently</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => toast.info('Password change coming soon')}>Change</Button>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Two-Factor Authentication</p>
                  <p className="text-xs text-slate-500">Add extra security</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => toast.info('2FA coming soon')}>Enable</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        isOpen={confirmDialog.open}
        title={confirmDialog.title}
        description={confirmDialog.description}
        onConfirm={() => { confirmDialog.onConfirm(); setConfirmDialog(p => ({ ...p, open: false })); }}
        onCancel={() => setConfirmDialog(p => ({ ...p, open: false }))}
      />
    </div>
  );
}
