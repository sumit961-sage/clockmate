// ClockMate Pro - Locations Page with Real Creation Form
import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin, Plus, Loader2, X, Trash2, Edit3, Search, Navigation,
  QrCode, Clock, CheckCircle2, AlertTriangle,
  ChevronRight, LocateFixed, Globe, Crosshair
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { SkeletonCard } from '@/components/SkeletonCard';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useAuthStore } from '@/store';
import { getLocations, createLocation, updateLocation, deleteLocation } from '@/lib/api';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import type { Location, LocationCreateData } from '@/types';

const AU_TIMEZONES = [
  'Australia/Sydney', 'Australia/Melbourne', 'Australia/Brisbane',
  'Australia/Perth', 'Australia/Adelaide', 'Australia/Darwin',
  'Australia/Hobart', 'Australia/Canberra',
];

function LocationForm({ onSubmit, onCancel, initialData }: {
  onSubmit: (data: LocationCreateData) => Promise<void>;
  onCancel: () => void;
  initialData?: Partial<Location>;
}) {
  const [form, setForm] = useState<LocationCreateData>({
    name: initialData?.name || '',
    address: initialData?.address || '',
    coordinates: {
      lat: initialData?.coordinates?.lat || 0,
      lng: initialData?.coordinates?.lng || 0,
    },
    geofence: {
      type: 'CIRCLE',
      radius: initialData?.geofence?.radius || 200,
    },
    timezone: initialData?.timezone || 'Australia/Sydney',
    qrCodeEnabled: initialData?.qrCodeEnabled || false,
    isActive: initialData?.isActive !== false,
  });
  const [saving, setSaving] = useState(false);
  const geo = useGeolocation();

  const handleUseCurrentLocation = () => {
    geo.getPosition();
  };

  useEffect(() => {
    if (geo.position) {
      setForm(p => ({
        ...p,
        coordinates: {
          lat: geo.position!.latitude,
          lng: geo.position!.longitude,
        },
      }));
      toast.success('GPS coordinates captured');
    }
  }, [geo.position]);

  const validate = (): boolean => {
    if (!form.name.trim()) { toast.error('Location name is required'); return false; }
    if (!form.address.trim()) { toast.error('Address is required'); return false; }
    if (form.coordinates.lat < -90 || form.coordinates.lat > 90) { toast.error('Latitude must be between -90 and 90'); return false; }
    if (form.coordinates.lng < -180 || form.coordinates.lng > 180) { toast.error('Longitude must be between -180 and 180'); return false; }
    return true;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSaving(true);
    try { await onSubmit(form); onCancel(); }
    catch (err: unknown) { toast.error((err as Error).message || 'Failed to save'); }
    finally { setSaving(false); }
  };

  return (
    <motion.div
      className="fixed z-50 bg-white rounded-2xl shadow-2xl w-[95vw] max-w-lg p-5 space-y-4"
      style={{ left: '50%', top: '47%', transform: 'translate(-50%, -50%)' }}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <MapPin className="size-5 text-blue-500" />
          {initialData?.id ? 'Edit Location' : 'Add Location'}
        </h3>
        <button onClick={onCancel} className="p-1 rounded-lg hover:bg-slate-100" aria-label="Close">
          <X className="size-5" />
        </button>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-sm font-medium">Location Name *</label>
          <Input
            value={form.name}
            onChange={e => setForm(p => ({ ...p, name: e.target.value.slice(0, 100) }))}
            placeholder="Head Office, Site A, etc."
            maxLength={100}
          />
        </div>

        <div>
          <label className="text-sm font-medium">Full Address *</label>
          <textarea
            value={form.address}
            onChange={e => setForm(p => ({ ...p, address: e.target.value }))}
            placeholder="123 Main St, Sydney NSW 2000"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm mt-1"
            rows={2}
          />
        </div>

        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium flex items-center gap-1">
              <Crosshair className="size-3.5" />GPS Coordinates
            </label>
            <Button size="sm" variant="outline" onClick={handleUseCurrentLocation} disabled={geo.loading} className="h-7 text-xs">
              {geo.loading ? <Loader2 className="size-3 animate-spin" /> : <><LocateFixed className="size-3 mr-1" />Use My GPS</>}
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500">Latitude</label>
              <Input
                type="number"
                step="any"
                value={form.coordinates.lat}
                onChange={e => setForm(p => ({ ...p, coordinates: { ...p.coordinates, lat: parseFloat(e.target.value) || 0 } }))}
              />
            </div>
            <div>
              <label className="text-xs text-slate-500">Longitude</label>
              <Input
                type="number"
                step="any"
                value={form.coordinates.lng}
                onChange={e => setForm(p => ({ ...p, coordinates: { ...p.coordinates, lng: parseFloat(e.target.value) || 0 } }))}
              />
            </div>
          </div>
          {geo.error && <p className="text-xs text-red-500 mt-1">GPS error: {geo.error}</p>}
        </div>

        <div>
          <label className="text-sm font-medium flex items-center gap-1">
            <Navigation className="size-3.5" />Geofence Radius: {form.geofence.radius}m
          </label>
          <input
            type="range"
            min={50}
            max={2000}
            step={50}
            value={form.geofence.radius}
            onChange={e => setForm(p => ({ ...p, geofence: { ...p.geofence, radius: parseInt(e.target.value) } }))}
            className="w-full mt-1"
          />
          <div className="flex justify-between text-xs text-slate-400">
            <span>50m</span>
            <span>500m</span>
            <span>1000m</span>
            <span>2000m</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium">Timezone</label>
            <select
              value={form.timezone}
              onChange={e => setForm(p => ({ ...p, timezone: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm mt-1"
            >
              {AU_TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">Status</label>
            <div className="flex gap-2 mt-1">
              <button
                onClick={() => setForm(p => ({ ...p, isActive: true }))}
                className={`flex-1 p-2 rounded-lg border text-sm ${form.isActive ? 'bg-emerald-50 border-emerald-300' : 'border-slate-200'}`}
              >
                Active
              </button>
              <button
                onClick={() => setForm(p => ({ ...p, isActive: false }))}
                className={`flex-1 p-2 rounded-lg border text-sm ${!form.isActive ? 'bg-red-50 border-red-300' : 'border-slate-200'}`}
              >
                Inactive
              </button>
            </div>
          </div>
        </div>

        <label className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg cursor-pointer">
          <input
            type="checkbox"
            checked={form.qrCodeEnabled}
            onChange={e => setForm(p => ({ ...p, qrCodeEnabled: e.target.checked }))}
            className="size-4"
          />
          <span className="text-sm">Enable QR Code check-in</span>
        </label>
      </div>

      <div className="flex gap-2 pt-2">
        <Button onClick={handleSubmit} disabled={saving} className="flex-1">
          {saving ? <Loader2 className="size-4 animate-spin" /> : initialData?.id ? 'Save Changes' : 'Create Location'}
        </Button>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </motion.div>
  );
}

export default function LocationsPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const { user } = useAuthStore();
  const isManager = ['ADMIN', 'OWNER', 'MANAGER'].includes(user?.role || '');

  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Partial<Location> | undefined>(undefined);

  const [confirmDialog, setConfirmDialog] = useState({
    open: false, title: '', description: '', variant: 'default' as 'default' | 'destructive',
    onConfirm: () => {}, onCancel: () => {},
  });

  const loadData = useCallback(async () => {
    if (!orgId) return;
    try {
      setLoading(true);
      const data = await getLocations(orgId);
      setLocations(data);
    } catch (err: unknown) {
      const error = err as Error;
      logger.error('[Locations] load failed:', error);
      toast.error(error.message || 'Failed to load locations');
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCreate = async (data: LocationCreateData) => {
    if (!orgId) return;
    await createLocation({ ...data, orgId });
    toast.success('Location created');
    loadData();
  };

  const handleUpdate = async (data: LocationCreateData) => {
    if (!editingLocation?.id) return;
    await updateLocation(editingLocation.id, { ...data, id: editingLocation.id });
    toast.success('Location updated');
    setEditingLocation(undefined);
    loadData();
  };

  const handleDelete = (id: string) => {
    setConfirmDialog({
      open: true,
      title: 'Delete Location',
      description: 'This will permanently remove this location and its geofence settings.',
      variant: 'destructive',
      onConfirm: async () => {
        try {
          await deleteLocation(id);
          toast.success('Location deleted');
          loadData();
        } catch (err: unknown) {
          toast.error((err as Error).message || 'Delete failed');
        }
      },
      onCancel: () => setConfirmDialog(p => ({ ...p, open: false })),
    });
  };

  const filtered = locations.filter(l =>
    l.name.toLowerCase().includes(search.toLowerCase()) ||
    l.address?.toLowerCase().includes(search.toLowerCase())
  );

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
          <MapPin className="size-4 text-slate-400" />
          <span className="text-sm text-slate-500">Locations</span>
        </div>
        {isManager && (
          <Button size="sm" onClick={() => { setEditingLocation(undefined); setFormOpen(true); }}>
            <Plus className="size-4 mr-1" />Add Location
          </Button>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search locations..."
          className="pl-10"
        />
      </div>

      <div className="space-y-3">
        {filtered.map(loc => (
          <motion.div
            key={loc.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className={`overflow-hidden ${!loc.isActive ? 'opacity-60' : ''}`}>
              <div className="flex">
                <div className="w-1 flex-shrink-0" style={{ backgroundColor: loc.isActive ? '#10b981' : '#94a3b8' }} />
                <CardContent className="py-3 px-4 flex-1">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-semibold text-sm">{loc.name}</h4>
                        <Badge variant="secondary" className="text-[10px] h-5">{loc.geofence?.radius || 200}m</Badge>
                        {!loc.isActive && <Badge className="bg-slate-100 text-slate-500 text-[10px] h-5">Inactive</Badge>}
                        {loc.qrCodeEnabled && <Badge className="bg-purple-100 text-purple-700 text-[10px] h-5"><QrCode className="size-2.5 mr-1" />QR</Badge>}
                      </div>
                      <p className="text-xs text-slate-500 mt-1">{loc.address || 'No address'}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                        <span className="flex items-center gap-1"><Globe className="size-3" />{loc.timezone || 'UTC'}</span>
                        <span className="flex items-center gap-1"><MapPin className="size-3" />{loc.coordinates?.lat.toFixed(4)}, {loc.coordinates?.lng.toFixed(4)}</span>
                      </div>
                    </div>
                    {isManager && (
                      <div className="flex gap-1 ml-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-8"
                          aria-label={`Edit ${loc.name}`}
                          onClick={() => { setEditingLocation(loc); setFormOpen(true); }}
                        >
                          <Edit3 className="size-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-8 text-red-500"
                          aria-label={`Delete ${loc.name}`}
                          onClick={() => handleDelete(loc.id)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12">
          <MapPin className="size-12 mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 font-medium">No locations found</p>
          <p className="text-sm text-slate-400 mt-1">{search ? 'Try a different search' : 'Add your first work location'}</p>
        </div>
      )}

      <AnimatePresence>
        {formOpen && (
          <>
            <motion.div
              className="fixed inset-0 bg-black/40 z-40"
              onClick={() => setFormOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
            <LocationForm
              onSubmit={editingLocation?.id ? handleUpdate : handleCreate}
              onCancel={() => { setFormOpen(false); setEditingLocation(undefined); }}
              initialData={editingLocation}
            />
          </>
        )}
      </AnimatePresence>

      <ConfirmDialog
        isOpen={confirmDialog.open}
        title={confirmDialog.title}
        description={confirmDialog.description}
        variant={confirmDialog.variant}
        onConfirm={confirmDialog.onConfirm}
        onCancel={confirmDialog.onCancel}
      />
    </div>
  );
}
