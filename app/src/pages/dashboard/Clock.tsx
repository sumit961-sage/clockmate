// ClockMate Pro - Clock In/Out Page with GPS, Live Attendance, Break Timeline, Photo Verification
// NOTE: Geofence check is performed server-side. Frontend only shows location for user awareness.
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play, Square, Coffee, MapPin, Clock, AlertCircle,
  CheckCircle2, Loader2, Navigation, Pause, Timer,
  ArrowLeft, LogIn, Plus, Minus, Users, Shield,
  Radio, TrendingUp, Bell, ChevronDown, ChevronUp,
  LocateFixed, LocateOff, Eye, History, Edit3,
  MessageSquare, X, Footprints, Globe, XCircle,
  Camera, Aperture, UserCheck
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuthStore } from '@/store';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useInterval } from '@/hooks/useInterval';
import { haversineDistance } from '@/lib/geo';
import {
  clockIn, clockOut, startBreak, endBreak,
  getCurrentTimeEntry, getTimeEntries, getShifts,
  getEmployees, getLocations, updateTimeEntry,
  addTimeEntryComment, autoGenerateTimesheet,
  createManualTimeEntry, getPendingManualEntries,
  approveManualEntry, rejectManualEntry,
} from '@/lib/api';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';
import type { TimeEntry, Shift, Employee, Location, ManualEntryReason } from '@/types';
import {
  format, startOfWeek, endOfWeek, differenceInMinutes,
  isSameDay, differenceInSeconds, addDays, isToday, isPast, isFuture
} from 'date-fns';

/* ════════════════════════════════════════════
   HELPERS
   ════════════════════════════════════════════ */
function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

/** Compute total break duration in milliseconds. */
function totalBreakMs(breaks: Array<{ start?: string; end?: string }>): number {
  let ms = 0;
  for (const b of breaks || []) {
    if (b.start && b.end) {
      ms += new Date(b.end).getTime() - new Date(b.start).getTime();
    } else if (b.start && !b.end) {
      // active break – subtract elapsed break time so timer pauses
      ms += Date.now() - new Date(b.start).getTime();
    }
  }
  return ms;
}

/* ════════════════════════════════════════════
   PHOTO CAPTURE MODAL (Device Camera)
   ════════════════════════════════════════════ */
function PhotoCaptureModal({ isOpen, onClose, onConfirm }: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (base64: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [captured, setCaptured] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Start camera when modal opens
  useEffect(() => {
    if (!isOpen) {
      stream?.getTracks().forEach(t => t.stop());
      setStream(null);
      setCaptured(null);
      setCameraError(null);
      return;
    }

    let cancelled = false;
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } } })
      .then(s => {
        if (cancelled) { s.getTracks().forEach(t => t.stop()); return; }
        setStream(s);
        if (videoRef.current) videoRef.current.srcObject = s;
      })
      .catch(err => {
        setCameraError(err?.message || 'Camera access denied');
        logger.error('[PhotoCapture] camera error:', err);
      });

    return () => { cancelled = true; stream?.getTracks().forEach(t => t.stop()); };
  }, [isOpen]);

  /** Resize and compress photo to keep base64 under ~100KB */
  const compressPhoto = (sourceCanvas: HTMLCanvasElement): string => {
    const MAX_WIDTH = 640;
    const MAX_HEIGHT = 480;
    let w = sourceCanvas.width;
    let h = sourceCanvas.height;
    // Scale down if larger than max
    if (w > MAX_WIDTH || h > MAX_HEIGHT) {
      const ratio = Math.min(MAX_WIDTH / w, MAX_HEIGHT / h);
      w = Math.round(w * ratio);
      h = Math.round(h * ratio);
    }
    const offscreen = document.createElement('canvas');
    offscreen.width = w;
    offscreen.height = h;
    const ctx2 = offscreen.getContext('2d');
    if (!ctx2) return sourceCanvas.toDataURL('image/jpeg', 0.6);
    ctx2.drawImage(sourceCanvas, 0, 0, w, h);
    return offscreen.toDataURL('image/jpeg', 0.6);
  };

  const takePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !stream) return;
    // Capture at full resolution first
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    // Compress before storing
    const compressed = compressPhoto(canvas);
    setCaptured(compressed);
  };

  const retake = () => setCaptured(null);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <>
        <motion.div className="fixed inset-0 bg-black/60 z-50" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
        <motion.div
          className="fixed z-50 bg-white rounded-2xl shadow-2xl w-[95vw] max-w-sm overflow-hidden"
          style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
        >
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold flex items-center gap-2"><Camera className="size-5 text-blue-500" />Photo Verification</h3>
              <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100" aria-label="Close"><X className="size-5" /></button>
            </div>
            <p className="text-sm text-slate-500">Take a quick selfie to verify your identity before clocking in.</p>

            {cameraError ? (
              <div className="p-4 bg-red-50 rounded-lg text-center">
                <AlertCircle className="size-8 text-red-500 mx-auto mb-2" />
                <p className="text-sm text-red-700">{cameraError}</p>
                <p className="text-xs text-red-500 mt-1">Please allow camera access and try again.</p>
              </div>
            ) : (
              <>
                <div className="relative aspect-[4/3] bg-slate-900 rounded-lg overflow-hidden">
                  {!captured ? (
                    <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                  ) : (
                    <img src={captured} alt="Captured selfie" className="w-full h-full object-cover" />
                  )}
                  {!captured && stream && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-40 h-40 border-2 border-white/50 rounded-full" />
                    </div>
                  )}
                </div>
                <canvas ref={canvasRef} className="hidden" />

                <div className="flex gap-2">
                  {!captured ? (
                    <Button onClick={takePhoto} className="flex-1" disabled={!stream}>
                      <Aperture className="size-4 mr-2" />Take Photo
                    </Button>
                  ) : (
                    <>
                      <Button variant="outline" onClick={retake} className="flex-1">
                        <Camera className="size-4 mr-2" />Retake
                      </Button>
                      <Button onClick={() => onConfirm(captured)} className="flex-1 bg-emerald-600 hover:bg-emerald-700">
                        <UserCheck className="size-4 mr-2" />Confirm & Clock In
                      </Button>
                    </>
                  )}
                </div>
              </>
            )}

            {!cameraError && (
              <button onClick={() => { onConfirm(''); }} className="w-full text-xs text-slate-400 hover:text-slate-600 py-1">
                Skip photo and clock in without verification
              </button>
            )}
          </div>
        </motion.div>
      </>
    </AnimatePresence>
  );
}

/* ════════════════════════════════════════════
   GEOFENCE STATUS COMPONENT (Display only – no gating)
   ════════════════════════════════════════════ */
function GeofenceStatus({ position, locations }: {
  position: { latitude: number; longitude: number } | null;
  locations: Location[];
}) {
  const nearest = useMemo(() => {
    if (!position || locations.length === 0) return null;
    let closest: { loc: Location; dist: number } | null = null;
    for (let i = 0; i < locations.length; i++) {
      const loc = locations[i];
      if (!loc.coordinates?.lat || !loc.coordinates?.lng) continue;
      const d = haversineDistance(
        position.latitude, position.longitude,
        loc.coordinates.lat, loc.coordinates.lng
      );
      if (!closest || d < closest.dist) closest = { loc, dist: d };
    }
    return closest;
  }, [position, locations]);

  if (!position) {
    return (
      <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
        <Loader2 className="size-4 animate-spin text-slate-400" />
        <span className="text-sm text-slate-500">Getting your location...</span>
      </div>
    );
  }

  if (!nearest) {
    return (
      <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-lg border border-amber-200">
        <Globe className="size-4 text-amber-500" />
        <span className="text-sm text-amber-700">No work locations configured</span>
      </div>
    );
  }

  const radius = nearest.loc.geofence?.radius || 200;
  const within = nearest.dist <= radius;

  return (
    <div className={`flex items-center gap-2 p-3 rounded-lg border ${within ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
      {within ? <LocateFixed className="size-4 text-emerald-600" /> : <LocateOff className="size-4 text-amber-500" />}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${within ? 'text-emerald-700' : 'text-amber-700'}`}>
          {within ? 'Within range' : 'Outside range'} of {nearest.loc.name}
        </p>
        <p className={`text-xs ${within ? 'text-emerald-600' : 'text-amber-600'}`}>
          {formatDistance(nearest.dist)} away · Geofence: {formatDistance(radius)}
        </p>
      </div>
      {!within && <Badge className="bg-amber-100 text-amber-700 text-[10px]">Server checks</Badge>}
    </div>
  );
}

/* ════════════════════════════════════════════
   SHIFT INFO CARD
   ════════════════════════════════════════════ */
function ShiftInfoCard({ shift, isClockedIn, clockInTime }: {
  shift: Shift | null; isClockedIn: boolean; clockInTime?: string;
}) {
  if (!shift) {
    return (
      <Card className="border-dashed border-slate-200 bg-slate-50/50">
        <CardContent className="py-6 text-center">
          <Clock className="size-8 mx-auto text-slate-300 mb-2" />
          <p className="text-sm text-slate-400">No shift scheduled for today</p>
        </CardContent>
      </Card>
    );
  }

  const start = shift.startTime ? new Date(shift.startTime) : null;
  const end = shift.endTime ? new Date(shift.endTime) : null;
  const now = new Date();
  const isLate = start && clockInTime && new Date(clockInTime) > new Date(start.getTime() + 5 * 60000);
  const minsLate = isLate && start && clockInTime ? differenceInMinutes(new Date(clockInTime), start) : 0;
  const isUpcoming = start && isFuture(start) && differenceInMinutes(start, now) <= 60;
  const minsUntil = start && isFuture(start) ? differenceInMinutes(start, now) : 0;

  return (
    <Card className="border-blue-200 bg-blue-50/30">
      <CardContent className="pt-4 pb-3">
        <div className="flex items-start gap-3">
          <div className="w-1 h-10 rounded-full shrink-0 mt-0.5" style={{ backgroundColor: shift.color || '#3b82f6' }} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-semibold text-sm text-slate-800">{shift.title}</h4>
              {isClockedIn && <Badge className="bg-emerald-500 text-white text-[10px] h-5"><Radio className="size-2 mr-1" />On Duty</Badge>}
              {isLate && <Badge className="bg-red-500 text-white text-[10px] h-5"><AlertCircle className="size-2 mr-1" />Late {minsLate}m</Badge>}
              {isUpcoming && <Badge className="bg-amber-500 text-white text-[10px] h-5"><Clock className="size-2 mr-1" />In {minsUntil}m</Badge>}
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 flex-wrap">
              {start && end && (
                <span className="flex items-center gap-1">
                  <Clock className="size-3" />
                  {format(start, 'h:mm a')} – {format(end, 'h:mm a')}
                  <span className="text-slate-400">({differenceInMinutes(end, start) / 60}h)</span>
                </span>
              )}
              {shift.department && <span className="flex items-center gap-1"><Shield className="size-3" />{shift.department}</span>}
            </div>
            {shift.notes && <p className="text-xs text-slate-500 mt-1 italic">{shift.notes}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ════════════════════════════════════════════
   OVERTIME WARNING
   ════════════════════════════════════════════ */
function OvertimeWarning({ entries, otThreshold, weeklyThreshold }: {
  entries: TimeEntry[]; otThreshold: number; weeklyThreshold: number;
}) {
  const todayTotal = entries
    .filter(e => e.clockIn?.time && isSameDay(new Date(e.clockIn.time), new Date()))
    .reduce((s, e) => s + (e.totalHours || 0), 0);

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekTotal = entries
    .filter(e => e.clockIn?.time && new Date(e.clockIn.time) >= weekStart)
    .reduce((s, e) => s + (e.totalHours || 0), 0);

  const showDaily = todayTotal > otThreshold;
  const showWeekly = weekTotal > weeklyThreshold;
  if (!showDaily && !showWeekly) return null;

  return (
    <motion.div
      className="rounded-lg border border-amber-200 bg-amber-50 p-3"
      initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
    >
      <div className="flex items-center gap-2 text-amber-700 font-medium text-sm mb-1">
        <TrendingUp className="size-4" />Overtime Alert
      </div>
      {showDaily && (
        <p className="text-xs text-amber-600 ml-6">
          Today: {todayTotal.toFixed(1)}h / {otThreshold}h threshold
          <span className="font-semibold"> ({(todayTotal - otThreshold).toFixed(1)}h OT)</span>
        </p>
      )}
      {showWeekly && (
        <p className="text-xs text-amber-600 ml-6">
          This week: {weekTotal.toFixed(1)}h / {weeklyThreshold}h threshold
          <span className="font-semibold"> ({(weekTotal - weeklyThreshold).toFixed(1)}h OT)</span>
        </p>
      )}
    </motion.div>
  );
}

/* ════════════════════════════════════════════
   BREAK TIMELINE
   ════════════════════════════════════════════ */
function BreakTimeline({ breaks, isOnBreak }: { breaks: Array<{ start: string; end?: string; type?: string }>; isOnBreak: boolean }) {
  if (breaks.length === 0 && !isOnBreak) return null;
  const allBreaks = [...breaks];

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-slate-600 flex items-center gap-1">
        <Coffee className="size-3.5" />Break History
      </h4>
      <div className="relative pl-4 space-y-3">
        <div className="absolute left-1.5 top-0 bottom-0 w-0.5 bg-slate-200 rounded-full" />
        {allBreaks.map((b, i) => {
          const start = b.start ? new Date(b.start) : null;
          const end = b.end ? new Date(b.end) : null;
          const duration = start && end ? differenceInMinutes(end, start) : 0;
          const isActive = !b.end;
          return (
            <motion.div
              key={i}
              className={`relative p-2.5 rounded-lg border text-sm ${isActive ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-100'}`}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <div className={`absolute -left-4 top-3 w-3 h-3 rounded-full border-2 ${isActive ? 'bg-amber-500 border-amber-300 animate-pulse' : 'bg-slate-400 border-slate-200'}`} />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Coffee className={`size-3.5 ${isActive ? 'text-amber-500' : 'text-slate-400'}`} />
                  <span className="font-medium text-slate-700">Break {i + 1}</span>
                  <span className="text-[10px] text-slate-400">({b.type || 'UNPAID'})</span>
                </div>
                {isActive && <Badge className="bg-amber-100 text-amber-700 text-[10px] h-5">Active</Badge>}
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                <span>{start ? format(start, 'h:mm a') : '--:--'}</span>
                <span>→</span>
                <span>{end ? format(end, 'h:mm a') : 'Now'}</span>
                {duration > 0 && <span className="text-slate-400">· {Math.floor(duration / 60)}h {duration % 60}m</span>}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════
   MANUAL ENTRY MODAL (Forgot to clock in)
   ════════════════════════════════════════════ */
function ManualEntryModal({ isOpen, onClose, onSave }: {
  isOpen: boolean; onClose: () => void;
  onSave: (data: { clockIn: string; clockOut: string; notes: string; reason: ManualEntryReason }) => Promise<void>;
}) {
  const [form, setForm] = useState({ date: format(new Date(), 'yyyy-MM-dd'), clockIn: '09:00', clockOut: '17:00', notes: '', reason: 'FORGOT' as ManualEntryReason });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) setForm({ date: format(new Date(), 'yyyy-MM-dd'), clockIn: '09:00', clockOut: '17:00', notes: '', reason: 'FORGOT' });
  }, [isOpen]);

  const handleSubmit = async () => {
    const cin = new Date(`${form.date}T${form.clockIn}`);
    const cout = new Date(`${form.date}T${form.clockOut}`);
    if (cout <= cin) { toast.error('Clock out must be after clock in'); return; }
    setSaving(true);
    try {
      await onSave({ clockIn: cin.toISOString(), clockOut: cout.toISOString(), notes: form.notes || 'Manual entry - forgot to clock', reason: form.reason });
      onClose();
      toast.success('Manual entry submitted for approval');
    } catch (e: unknown) {
      logger.error('[Clock] manual entry failed:', e);
      toast.error((e as Error).message || 'Failed');
    } finally { setSaving(false); }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          <motion.div
            className="fixed z-50 bg-white rounded-2xl shadow-2xl w-[95vw] max-w-md p-5 space-y-4"
            style={{ left: '50%', top: '47%', transform: 'translate(-50%, -50%)' }}
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold flex items-center gap-2"><History className="size-5 text-blue-500" />Forgot to Clock?</h3>
              <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100" aria-label="Close"><X className="size-5" /></button>
            </div>
            <p className="text-sm text-slate-500">Add a manual time entry. Your manager will be notified for approval.</p>
            <div><label className="text-sm font-medium">Date</label><input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm mt-1" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-sm font-medium">Clock In</label><input type="time" value={form.clockIn} onChange={e => setForm(p => ({ ...p, clockIn: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm mt-1" /></div>
              <div><label className="text-sm font-medium">Clock Out</label><input type="time" value={form.clockOut} onChange={e => setForm(p => ({ ...p, clockOut: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm mt-1" /></div>
            </div>
            <div>
              <label className="text-sm font-medium">Reason</label>
              <select value={form.reason} onChange={e => setForm(p => ({ ...p, reason: e.target.value as ManualEntryReason }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm mt-1">
                <option value="FORGOT">Forgot to clock</option>
                <option value="APP_ISSUE">App not working</option>
                <option value="PHONE_DIED">Phone died</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div><label className="text-sm font-medium">Notes</label><textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Additional details..." className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm mt-1" rows={2} /></div>
            <div className="flex gap-2"><Button onClick={handleSubmit} disabled={saving} className="flex-1">{saving ? <Loader2 className="size-4 animate-spin" /> : 'Submit for Approval'}</Button><Button variant="outline" onClick={onClose}>Cancel</Button></div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ════════════════════════════════════════════
   LIVE ATTENDANCE DASHBOARD (Admin/Manager)
   ════════════════════════════════════════════ */
function LiveAttendance({ orgId, employees, onBulkClockOut, onClockOutOne }: {
  orgId: string; employees: Employee[]; onBulkClockOut: (count: number) => void;
  onClockOutOne?: (entryId: string) => void;
}) {
  const [activeEntries, setActiveEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState<'active' | 'today'>('active');

  const loadActive = useCallback(async () => {
    if (!orgId) return;
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const entries = await getTimeEntries(orgId, { startDate: today.toISOString(), endDate: new Date().toISOString() });
      setActiveEntries(entries);
    } catch (err: unknown) {
      logger.error('[LiveAttendance] load failed:', err);
    } finally { setLoading(false); }
  }, [orgId]);

  useEffect(() => { loadActive(); }, [loadActive]);
  useInterval(loadActive, 30000);

  const nowActive = activeEntries.filter(e => e.status === 'ACTIVE');
  const todayCompleted = activeEntries.filter(e => e.status === 'COMPLETED');
  const getEmp = (userId: string) => employees.find(e => {
    const eid = typeof e.userId === 'string' ? e.userId : (e.userId as unknown as Record<string, unknown>)?._id?.toString?.() || e.userId?.toString?.() || e.id;
    return e.id === userId || eid === userId;
  });

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="size-4" />Live Attendance
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-xs text-emerald-600">
              <Radio className="size-3 animate-pulse" />{nowActive.length} active
            </div>
            {nowActive.length > 0 && (
              <Button size="sm" variant="destructive" onClick={() => onBulkClockOut(nowActive.length)} className="h-7 text-xs">
                <Square className="size-3 mr-1" />Clock Out All
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={selectedTab} onValueChange={v => setSelectedTab(v as 'active' | 'today')}>
          <TabsList className="mb-3"><TabsTrigger value="active" className="text-xs">Active Now</TabsTrigger><TabsTrigger value="today" className="text-xs">Today</TabsTrigger></TabsList>
        </Tabs>

        {loading ? (
          <div className="flex justify-center py-4"><Loader2 className="size-5 animate-spin text-slate-400" /></div>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {selectedTab === 'active' ? (
              nowActive.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">No one is currently clocked in</p>
              ) : nowActive.map(entry => {
                const emp = getEmp(entry.userId);
                const cin = entry.clockIn ? new Date(entry.clockIn.time) : null;
                const elapsed = cin ? Math.floor((Date.now() - cin.getTime() - totalBreakMs(entry.breaks || [])) / 1000) : 0;
                return (
                  <motion.div key={entry.id} className="flex items-center gap-3 p-2.5 bg-emerald-50 rounded-lg border border-emerald-100" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <div className="size-8 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white text-xs font-bold shrink-0">{emp?.firstName?.[0] || '?'}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{emp ? `${emp.firstName} ${emp.lastName}` : 'Unknown'}</p>
                      <p className="text-[10px] text-slate-500">Since {cin ? format(cin, 'h:mm a') : '--:--'}</p>
                    </div>
                    <span className="text-sm font-mono font-semibold text-emerald-700">{formatDuration(elapsed)}</span>
                    {onClockOutOne && (
                      <Button size="sm" variant="destructive" className="h-7 text-xs px-2" onClick={() => onClockOutOne(entry.id)}>
                        <Square className="size-3 mr-1" />Stop
                      </Button>
                    )}
                  </motion.div>
                );
              })
            ) : (
              todayCompleted.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">No completed entries today</p>
              ) : todayCompleted.slice(0, 20).map(entry => {
                const emp = getEmp(entry.userId);
                return (
                  <div key={entry.id} className="flex items-center gap-3 p-2 bg-slate-50 rounded-lg border border-slate-100">
                    <div className="size-8 rounded-full bg-gradient-to-br from-slate-400 to-slate-500 flex items-center justify-center text-white text-xs font-bold shrink-0">{emp?.firstName?.[0] || '?'}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{emp ? `${emp.firstName} ${emp.lastName}` : 'Unknown'}</p>
                      <p className="text-[10px] text-slate-500">{(entry.totalHours || 0).toFixed(1)}h · {entry.clockIn ? format(new Date(entry.clockIn.time), 'h:mm a') : ''} - {entry.clockOut ? format(new Date(entry.clockOut.time), 'h:mm a') : ''}</p>
                    </div>
                    <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
                  </div>
                );
              })
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ════════════════════════════════════════════
   OVERRIDE QUEUE (Manager)
   ════════════════════════════════════════════ */
function OverrideQueue({ orgId }: { orgId: string }) {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, [orgId]);

  async function loadData() {
    try {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const all = await getTimeEntries(orgId, { startDate: today.toISOString(), endDate: new Date().toISOString() });
      const overrides = all.filter(e => e.clockIn && e.clockIn.geofenceStatus === 'GEOFENCE_OVERRIDE');
      setEntries(overrides);
    } catch (err: unknown) {
      logger.error('[OverrideQueue] load failed:', err);
    } finally { setLoading(false); }
  }

  if (loading) return null;
  if (entries.length === 0) return null;

  return (
    <Card className="border-red-200">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2 text-red-700">
          <Shield className="size-4" />Geofence Overrides ({entries.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {entries.map(entry => (
            <div key={entry.id} className="flex items-center gap-2 p-2 bg-red-50 rounded-lg text-sm">
              <AlertCircle className="size-4 text-red-500 shrink-0" />
              <span className="flex-1 text-red-700">Clocked in outside geofence at {entry.clockIn ? format(new Date(entry.clockIn.time), 'h:mm a') : '--:--'}</span>
              {entry.clockIn?.photoBase64 && (
                <Badge className="bg-blue-100 text-blue-700 text-[10px] h-5"><Camera className="size-2.5 mr-1" />Photo</Badge>
              )}
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => toast.info('Override review coming soon')}>Review</Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/* ════════════════════════════════════════════
   MAIN CLOCK PAGE
   ════════════════════════════════════════════ */
export default function ClockPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const { user } = useAuthStore();
  const isManager = ['ADMIN', 'OWNER', 'MANAGER'].includes(user?.role || '');

  // Geolocation (raw coords sent to backend – no frontend gating)
  const geo = useGeolocation();

  // Auto-fetch GPS on mount and start watching
  useEffect(() => {
    geo.getPosition();
    geo.startWatching();
    return () => { geo.stopWatching(); };
  }, []);

  // Clock state
  const [isClockedIn, setIsClockedIn] = useState(false);
  const [currentEntry, setCurrentEntry] = useState<TimeEntry | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [onBreak, setOnBreak] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Photo verification state
  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const [pendingPhotoBase64, setPendingPhotoBase64] = useState<string>('');

  // Data
  const [todayEntries, setTodayEntries] = useState<TimeEntry[]>([]);
  const [weekEntries, setWeekEntries] = useState<TimeEntry[]>([]);
  const [todayShift, setTodayShift] = useState<Shift | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [activeTab, setActiveTab] = useState<'clock' | 'admin'>('clock');
  const [manualOpen, setManualOpen] = useState(false);

  // Confirm dialog
  const [confirmDialog, setConfirmDialog] = useState({
    open: false, title: '', description: '', variant: 'default' as 'default' | 'destructive',
    onConfirm: () => {}, onCancel: () => {},
  });

  // Pending manual entries (manager)
  const [pendingEntries, setPendingEntries] = useState<TimeEntry[]>([]);
  const [pendingLoading, setPendingLoading] = useState(false);

  // ─── Load current status ───
  useEffect(() => {
    if (orgId && user?.id) {
      loadCurrentEntry();
      loadTodayEntries();
      loadWeekEntries();
      loadTodayShift();
      loadLocations();
      if (isManager) { loadEmployees(); loadPendingEntries(); }
    }
  }, [orgId, user]);

  // ─── Timer: Date.now() - clockInTime - totalBreakMs ───
  useInterval(() => {
    if (isClockedIn && currentEntry?.clockIn?.time) {
      const clockInMs = new Date(currentEntry.clockIn.time).getTime();
      const breakMs = totalBreakMs(currentEntry.breaks || []);
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - clockInMs - breakMs) / 1000)));
    }
  }, isClockedIn ? 1000 : null);

  async function loadCurrentEntry() {
    if (!user?.id) return;
    try {
      const entry = await getCurrentTimeEntry(user.id);
      if (entry) {
        setCurrentEntry(entry);
        setIsClockedIn(true);
        const breaks = entry.breaks || [];
        const hasActiveBreak = breaks.some((b: { start?: string; end?: string }) => b.start && !b.end);
        setOnBreak(hasActiveBreak);
      }
    } catch (err: unknown) {
      logger.debug('[Clock] no active entry:', (err as Error).message);
    } finally { setLoading(false); }
  }

  async function loadTodayEntries() {
    if (!orgId || !user?.id) return;
    try {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const entries = await getTimeEntries(orgId, { userId: user.id, startDate: today.toISOString(), endDate: new Date().toISOString() });
      setTodayEntries(entries);
    } catch (err: unknown) {
      logger.error('[Clock] loadTodayEntries failed:', err);
    }
  }

  async function loadWeekEntries() {
    if (!orgId || !user?.id) return;
    try {
      const ws = startOfWeek(new Date(), { weekStartsOn: 1 });
      const entries = await getTimeEntries(orgId, { userId: user.id, startDate: ws.toISOString(), endDate: new Date().toISOString() });
      setWeekEntries(entries);
    } catch (err: unknown) {
      logger.error('[Clock] loadWeekEntries failed:', err);
    }
  }

  async function loadTodayShift() {
    if (!orgId || !user?.id) return;
    try {
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
      logger.debug('[Clock] Fetching shifts:', { orgId, start: todayStart.toISOString(), end: todayEnd.toISOString(), userId: user.id });
      const shifts = await getShifts(orgId, todayStart.toISOString(), todayEnd.toISOString());
      logger.debug('[Clock] Got shifts:', shifts.length, shifts.map((s: Shift) => ({ title: s.title, assignedTo: s.assignedTo, start: s.startTime })));
      // Find the first shift assigned to the current user
      const myShift = shifts.find((s: Shift) => {
        if (!s.assignedTo || !Array.isArray(s.assignedTo) || s.assignedTo.length === 0) return false;
        return s.assignedTo.some((a: unknown) => {
          // Handle multiple possible formats: string, object with id/userId/_id, or ObjectId
          if (typeof a === 'string') return a === user.id;
          if (a && typeof a === 'object') {
            const ao = a as Record<string, unknown>;
            const idVal = (ao.id || ao.userId || ao._id) as string | undefined;
            if (typeof idVal === 'string') return idVal === user.id;
            if (idVal && typeof (idVal as unknown as { toString: () => string }).toString === 'function') {
              return (idVal as unknown as { toString: () => string }).toString() === user.id;
            }
          }
          return false;
        });
      });
      if (myShift) {
        logger.debug('[Clock] Found shift:', myShift.title);
      } else {
        logger.debug('[Clock] No shift found for user', user.id, 'among', shifts.length, 'shifts');
      }
      setTodayShift(myShift || null);
    } catch (err: unknown) {
      logger.error('[Clock] loadTodayShift failed:', err);
    }
  }

  async function loadLocations() {
    if (!orgId) return;
    try {
      const locs = await getLocations(orgId);
      setLocations(locs);
    } catch (err: unknown) {
      logger.error('[Clock] loadLocations failed:', err);
    }
  }

  async function loadEmployees() {
    if (!orgId) return;
    try {
      const emps = await getEmployees(orgId);
      setEmployees(emps);
    } catch (err: unknown) {
      logger.error('[Clock] loadEmployees failed:', err);
    }
  }

  async function loadPendingEntries() {
    if (!orgId || !isManager) return;
    try {
      setPendingLoading(true);
      const entries = await getPendingManualEntries(orgId);
      setPendingEntries(entries);
    } catch (err: unknown) {
      logger.error('[Clock] loadPendingEntries failed:', err);
    } finally { setPendingLoading(false); }
  }

  // ─── Clock In (with photo verification step) ───
  const initiateClockIn = () => {
    if (!geo.position) {
      toast.error('GPS location required. Please enable location services.');
      return;
    }
    setPhotoModalOpen(true);
  };

  const executeClockIn = async (photoBase64: string) => {
    if (!orgId || !user?.id) return;
    setPhotoModalOpen(false);
    setActionLoading(true);
    try {
      const loc = geo.position ? { lat: geo.position.latitude, lng: geo.position.longitude } : undefined;
      const entry = await clockIn({
        orgId,
        userId: user.id,
        location: loc,
        accuracy: geo.position?.accuracy,
        method: 'WEB',
        photoBase64: photoBase64 || undefined,
      });
      setCurrentEntry(entry);
      setIsClockedIn(true);
      setElapsedSeconds(0);
      toast.success('Clocked in successfully!');
      loadTodayEntries();
    } catch (err: unknown) {
      const error = err as Error;
      logger.error('[Clock] clock-in failed:', error);
      toast.error(error.message || 'Failed to clock in');
    } finally { setActionLoading(false); }
  };

  // ─── Clock Out ───
  const handleClockOut = async () => {
    if (!currentEntry?.id) return;
    setConfirmDialog({
      open: true,
      title: 'Clock Out',
      description: 'Are you sure you want to clock out?',
      variant: 'default',
      onConfirm: async () => {
        setActionLoading(true);
        try {
          const loc = geo.position ? { lat: geo.position.latitude, lng: geo.position.longitude } : undefined;
          await clockOut({
            entryId: currentEntry.id,
            location: loc,
            accuracy: geo.position?.accuracy,
            method: 'WEB',
          });
          setCurrentEntry(null);
          setIsClockedIn(false);
          setElapsedSeconds(0);
          setOnBreak(false);

          // Auto-generate timesheet
          if (orgId && user?.id) {
            try {
              const ws = startOfWeek(new Date(), { weekStartsOn: 1 });
              const we = endOfWeek(new Date(), { weekStartsOn: 1 });
              await autoGenerateTimesheet({ orgId, userId: user.id, startDate: ws.toISOString(), endDate: we.toISOString() });
              toast.success('Timesheet updated');
            } catch (err: unknown) {
              logger.error('[Clock] autoGenerateTimesheet failed:', err);
            }
          }
          loadTodayEntries();
          loadWeekEntries();
          toast.success('Clocked out!');
        } catch (err: unknown) {
          const error = err as Error;
          logger.error('[Clock] clock-out failed:', error);
          toast.error(error.message || 'Failed to clock out');
        } finally { setActionLoading(false); }
      },
      onCancel: () => setConfirmDialog(p => ({ ...p, open: false })),
    });
  };

  // ─── Breaks ───
  const handleStartBreak = async () => {
    if (!currentEntry?.id) return;
    try {
      setActionLoading(true);
      await startBreak(currentEntry.id, 'UNPAID');
      setOnBreak(true);
      toast.success('Break started');
      await loadCurrentEntry();
    } catch (err: unknown) {
      logger.error('[Clock] startBreak failed:', err);
      toast.error((err as Error).message || 'Failed to start break');
    } finally { setActionLoading(false); }
  };

  const handleEndBreak = async () => {
    if (!currentEntry?.id) return;
    try {
      setActionLoading(true);
      await endBreak(currentEntry.id, '');
      setOnBreak(false);
      toast.success('Break ended');
      await loadCurrentEntry();
    } catch (err: unknown) {
      logger.error('[Clock] endBreak failed:', err);
      toast.error((err as Error).message || 'Failed to end break');
    } finally { setActionLoading(false); }
  };

  // ─── Manual Entry (Forgot to clock in) ───
  const handleManualEntry = async (data: { clockIn: string; clockOut: string; notes: string; reason: ManualEntryReason }) => {
    if (!orgId || !user?.id) {
      toast.error('Missing org or user info');
      throw new Error('Missing org or user info');
    }
    try {
      logger.debug('[Clock] Submitting manual entry:', { orgId, userId: user.id, clockIn: data.clockIn, clockOut: data.clockOut });
      const result = await createManualTimeEntry({
        orgId,
        userId: user.id,
        clockInTime: data.clockIn,
        clockOutTime: data.clockOut,
        notes: `[FORGOT REQUEST - ${data.reason}] ${data.notes || ''}`.trim(),
        reason: data.reason,
        status: 'PENDING',
      });
      logger.debug('[Clock] Manual entry created:', result);
      // Refresh all relevant data
      await Promise.all([loadTodayEntries(), loadWeekEntries()]);
      if (isManager) await loadPendingEntries();
      toast.success('Forgot clock-in request submitted for manager approval');
    } catch (err: unknown) {
      const msg = (err as Error).message || 'Failed to submit request';
      logger.error('[Clock] manual entry failed:', err);
      toast.error(`Failed: ${msg}`);
      throw err;
    }
  };

  // Summary
  const todayTotal = todayEntries.reduce((s, e) => s + (e.totalHours || 0), 0);
  const weekTotal = weekEntries.reduce((s, e) => s + (e.totalHours || 0), 0);
  const otDaily = 8;
  const otWeekly = 38;

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="size-8 animate-spin text-blue-600" /></div>;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4 px-4 sm:px-0">
      {/* Breadcrumb */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ArrowLeft className="size-4 text-slate-400" />
          <span className="text-sm text-slate-500">Time Clock</span>
        </div>
        {isManager && (
          <Tabs value={activeTab} onValueChange={v => setActiveTab(v as 'clock' | 'admin')}>
            <TabsList className="h-8"><TabsTrigger value="clock" className="text-xs"><Clock className="size-3 mr-1" />My Clock</TabsTrigger><TabsTrigger value="admin" className="text-xs"><Users className="size-3 mr-1" />Team</TabsTrigger></TabsList>
          </Tabs>
        )}
      </div>

      {activeTab === 'clock' ? (
        <>
          {/* Geofence Status – display only, no gating */}
          <GeofenceStatus position={geo.position} locations={locations} />

          {/* Shift Info */}
          <ShiftInfoCard shift={todayShift} isClockedIn={isClockedIn} clockInTime={currentEntry?.clockIn?.time} />

          {/* Overtime Warning */}
          <OvertimeWarning entries={[...todayEntries, ...weekEntries]} otThreshold={otDaily} weeklyThreshold={otWeekly} />

          {/* Clock Card */}
          <Card className={isClockedIn ? 'border-emerald-200 bg-emerald-50/30' : ''}>
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <div className="flex items-center justify-center gap-2">
                  <div className={`size-3 rounded-full ${isClockedIn ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                  <span className={`text-sm font-medium ${isClockedIn ? (onBreak ? 'text-amber-700' : 'text-emerald-700') : 'text-slate-600'}`}>
                    {isClockedIn ? (onBreak ? 'On Break' : 'Currently Clocked In') : 'Not Clocked In'}
                  </span>
                </div>

                {isClockedIn && (
                  <div className="text-5xl font-bold text-slate-800 font-mono tracking-wider">
                    {formatDuration(elapsedSeconds)}
                  </div>
                )}

                {onBreak && (
                  <motion.div
                    className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-4 py-2 text-amber-700 border border-amber-200"
                    initial={{ scale: 0.9 }} animate={{ scale: 1 }}
                  >
                    <Pause className="size-4" />
                    <span className="text-sm font-medium">On Break</span>
                  </motion.div>
                )}

                {isClockedIn && currentEntry?.clockIn?.photoBase64 && (
                  <Badge className="bg-blue-100 text-blue-700 text-[10px] h-5 gap-1"><Camera className="size-3" />Photo Verified</Badge>
                )}

                {isClockedIn && currentEntry?.clockIn?.geofenceStatus === 'GEOFENCE_OVERRIDE' && (
                  <Badge className="bg-red-100 text-red-700 text-[10px] h-5 gap-1"><AlertCircle className="size-3" />Outside Geofence</Badge>
                )}

                {isClockedIn && currentEntry?.clockIn?.location && (
                  <div className="flex items-center justify-center gap-1 text-xs text-slate-400">
                    <MapPin className="size-3" />
                    Location captured · Acc: {currentEntry.clockIn.accuracy ? `${Math.round(currentEntry.clockIn.accuracy)}m` : 'N/A'}
                  </div>
                )}

                <div className="pt-4 space-y-3">
                  {!isClockedIn ? (
                    <>
                      <Button
                        size="lg" onClick={initiateClockIn} disabled={actionLoading}
                        className="w-full max-w-xs h-16 text-lg bg-emerald-600 hover:bg-emerald-700"
                      >
                        {actionLoading ? <Loader2 className="size-6 animate-spin mr-2" /> : <><Camera className="size-5 mr-2" />Clock In</>}
                      </Button>
                      {!geo.position && geo.permission !== 'denied' && (
                        <p className="text-xs text-amber-600">Waiting for GPS location...</p>
                      )}
                    </>
                  ) : (
                    <div className="flex gap-3 justify-center flex-wrap">
                      {!onBreak && (
                        <Button size="lg" variant="outline" onClick={handleStartBreak} disabled={actionLoading}
                          className="h-14 text-base border-amber-300 text-amber-700 hover:bg-amber-50">
                          <Coffee className="size-5 mr-2" /> Start Break
                        </Button>
                      )}
                      {onBreak && (
                        <Button size="lg" variant="outline" onClick={handleEndBreak} disabled={actionLoading}
                          className="h-14 text-base bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100">
                          <Coffee className="size-5 mr-2" /> End Break
                        </Button>
                      )}
                      <Button size="lg" onClick={handleClockOut} disabled={actionLoading} variant="destructive"
                        className="h-14 text-base">
                        <Square className="size-5 mr-2" /> Clock Out
                      </Button>
                    </div>
                  )}

                  {!isClockedIn && (
                    <button onClick={() => setManualOpen(true)}
                      className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1 mx-auto mt-2">
                      <History className="size-3.5" />Forgot to clock in/out?
                    </button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Break Timeline */}
          {currentEntry && (
            <BreakTimeline breaks={currentEntry.breaks || []} isOnBreak={onBreak} />
          )}

          {/* Today's Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Timer className="size-4" />Today's Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="text-center p-3 bg-slate-50 rounded-lg">
                  <p className="text-2xl font-bold text-slate-800">{todayTotal.toFixed(1)}h</p>
                  <p className="text-xs text-slate-500">Total Hours</p>
                </div>
                <div className="text-center p-3 bg-slate-50 rounded-lg">
                  <p className="text-2xl font-bold text-slate-800">{todayEntries.length}</p>
                  <p className="text-xs text-slate-500">Sessions</p>
                </div>
                <div className="text-center p-3 bg-slate-50 rounded-lg">
                  <p className="text-2xl font-bold text-slate-800">{weekTotal.toFixed(1)}h</p>
                  <p className="text-xs text-slate-500">This Week</p>
                </div>
                <div className="text-center p-3 bg-slate-50 rounded-lg">
                  <p className={`text-2xl font-bold ${weekTotal > otWeekly ? 'text-amber-600' : 'text-slate-800'}`}>
                    {todayEntries.reduce((s, e) => s + (e.overtimeHours || 0), 0).toFixed(1)}h
                  </p>
                  <p className="text-xs text-slate-500">OT Today</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Completed Entries Today */}
          {todayEntries.filter(e => e.status === 'COMPLETED').length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle2 className="size-4" />Completed Sessions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {todayEntries.filter(e => e.status === 'COMPLETED').map(entry => (
                    <div key={entry.id} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg text-sm">
                      <div className="flex items-center gap-2">
                        <Clock className="size-3.5 text-slate-400" />
                        <span>{entry.clockIn ? format(new Date(entry.clockIn.time), 'h:mm a') : '--:--'} – {entry.clockOut ? format(new Date(entry.clockOut.time), 'h:mm a') : '--:--'}</span>
                      </div>
                      <span className="font-medium">{(entry.totalHours || 0).toFixed(1)}h</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        /* Admin Tab */
        <div className="space-y-4">
          <LiveAttendance orgId={orgId || ''} employees={employees} onBulkClockOut={count => {
            setConfirmDialog({
              open: true, title: 'Bulk Clock Out', description: `Clock out ${count} employees?`, variant: 'destructive',
              onConfirm: async () => {
                const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
                const active = await getTimeEntries(orgId || '', { startDate: todayStart.toISOString(), endDate: new Date().toISOString() });
                const nowActive = active.filter(e => e.status === 'ACTIVE');
                let successCount = 0;
                for (const entry of nowActive.slice(0, count)) {
                  try { await clockOut({ entryId: entry.id, method: 'WEB' }); successCount++; }
                  catch (err: unknown) { logger.error('[Clock] bulk clock out failed:', err); }
                }
                toast.success(`Clocked out ${successCount} of ${nowActive.length} employees`);
                loadTodayEntries();
              },
              onCancel: () => setConfirmDialog(p => ({ ...p, open: false })),
            });
          }} onClockOutOne={async (entryId) => {
            setConfirmDialog({
              open: true, title: 'Clock Out Employee', description: 'Stop timer for this employee?', variant: 'destructive',
              onConfirm: async () => {
                try { await clockOut({ entryId, method: 'WEB' }); toast.success('Employee clocked out'); loadTodayEntries(); }
                catch (err: unknown) { toast.error((err as Error).message || 'Failed'); }
                setConfirmDialog(p => ({ ...p, open: false }));
              },
              onCancel: () => setConfirmDialog(p => ({ ...p, open: false })),
            });
          }} />
          <OverrideQueue orgId={orgId || ''} />

          {/* Pending Manual Entries */}
          {pendingEntries.length > 0 && (
            <Card className="border-amber-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2 text-amber-700">
                  <History className="size-4" />Pending Manual Entries ({pendingEntries.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {pendingEntries.map(entry => {
                    const emp = employees.find(e => {
                      const eid = typeof e.userId === 'string' ? e.userId : (e.userId as unknown as Record<string, unknown>)?._id?.toString?.() || e.userId?.toString?.() || e.id;
                      return e.id === entry.userId || eid === entry.userId;
                    });
                    return (
                      <div key={entry.id} className="flex items-center gap-2 p-2 bg-amber-50 rounded-lg text-sm">
                        <div className="size-8 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                          {emp?.firstName?.[0] || '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{emp ? `${emp.firstName} ${emp.lastName}` : 'Unknown'}</p>
                          <p className="text-[10px] text-slate-500">
                            {entry.clockIn ? format(new Date(entry.clockIn.time), 'h:mm a') : ''} – {entry.clockOut ? format(new Date(entry.clockOut.time), 'h:mm a') : ''}
                          </p>
                        </div>
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" className="h-7 text-xs border-emerald-300 text-emerald-700" onClick={async () => {
                            try { await approveManualEntry(entry.id); toast.success('Approved'); loadPendingEntries(); loadTodayEntries(); }
                            catch (err: unknown) { toast.error((err as Error).message || 'Failed'); }
                          }}>
                            <CheckCircle2 className="size-3 mr-1" />Approve
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 text-xs border-red-300 text-red-700" onClick={async () => {
                            try { await rejectManualEntry(entry.id, 'Rejected by manager'); toast.success('Rejected'); loadPendingEntries(); }
                            catch (err: unknown) { toast.error((err as Error).message || 'Failed'); }
                          }}>
                            <XCircle className="size-3 mr-1" />Reject
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Modals */}
      <PhotoCaptureModal
        isOpen={photoModalOpen}
        onClose={() => setPhotoModalOpen(false)}
        onConfirm={executeClockIn}
      />
      <ManualEntryModal isOpen={manualOpen} onClose={() => setManualOpen(false)} onSave={handleManualEntry} />
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
