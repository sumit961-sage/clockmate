// ClockMate Pro - Clock In/Out Hook
import { useCallback } from 'react';
import { useClockStore, useAuthStore } from '@/store';
import {
  clockIn as clockInApi,
  clockOut as clockOutApi,
  startBreak as startBreakApi,
  endBreak as endBreakApi,
  isWithinGeofence as checkGeofence,
} from '@/lib/api';
import { useGeolocation } from './useGeolocation';
import { isWithinGeofence, haversineDistance } from '@/lib/geo';
import type { Coordinates, ClockMethod, Location } from '@/types';

interface UseClockReturn {
  isClockedIn: boolean;
  isLoading: boolean;
  error: string | null;
  userLocation: Coordinates | null;
  locationStatus: 'idle' | 'loading' | 'success' | 'error';
  withinGeofence: boolean;
  nearestLocation: Location | null;
  distanceToLocation: number | null;
  currentTimeEntry: any;
  clockIn: (method?: ClockMethod) => Promise<void>;
  clockOut: (method?: ClockMethod) => Promise<void>;
  startBreak: (type: 'PAID' | 'UNPAID') => Promise<void>;
  endBreak: (breakId: string) => Promise<void>;
  getLocation: () => void;
  checkLocation: (locations: Location[]) => boolean;
  clearError: () => void;
}

export function useClock(): UseClockReturn {
  const { user, currentOrg } = useAuthStore();
  const {
    isClockedIn,
    currentTimeEntry,
    setClockedIn,
    setCurrentTimeEntry,
    setLoading,
    setError,
    setUserLocation,
    setLocationStatus,
    setWithinGeofence,
    setNearestLocation,
    setDistanceToLocation,
  } = useClockStore();

  const geo = useGeolocation({
    enableHighAccuracy: true,
    timeout: 10000,
  });

  const getLocation = useCallback(() => {
    setLocationStatus('loading');
    geo.getPosition();
  }, [geo, setLocationStatus]);

  const checkLocation = useCallback((locations: Location[]): boolean => {
    if (!geo.position || locations.length === 0) return false;

    let closestLoc: Location | null = null;
    let minDist = Infinity;

    for (let i = 0; i < locations.length; i++) {
      const loc = locations[i];
      if (!loc.coordinates?.lat || !loc.coordinates?.lng) continue;
      const dist = haversineDistance(
        geo.position.latitude,
        geo.position.longitude,
        loc.coordinates.lat,
        loc.coordinates.lng
      );
      if (dist < minDist) {
        minDist = dist;
        closestLoc = loc;
      }
    }

    if (closestLoc) {
      setNearestLocation(closestLoc);
      setDistanceToLocation(minDist);

      const gf = closestLoc.geofence;
      const radius = gf?.radius || 200;
      const within = minDist <= radius;
      setWithinGeofence(within);

      return within;
    }

    return false;
  }, [geo.position, setNearestLocation, setDistanceToLocation, setWithinGeofence]);

  const clockIn = useCallback(async (method: ClockMethod = 'WEB') => {
    if (!user || !currentOrg) {
      setError('You must be logged in to clock in');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const position = geo.position ? {
        lat: geo.position.latitude,
        lng: geo.position.longitude,
      } : undefined;

      const entry = await clockInApi({
        orgId: currentOrg.id,
        userId: user.id,
        location: position,
        accuracy: geo.position?.accuracy,
        method,
      });

      setCurrentTimeEntry(entry);
      setClockedIn(true);
    } catch (err: any) {
      setError(err.message || 'Failed to clock in. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [user, currentOrg, geo.position, setCurrentTimeEntry, setClockedIn, setLoading, setError]);

  const clockOut = useCallback(async (method: ClockMethod = 'WEB') => {
    if (!currentTimeEntry) {
      setError('No active time entry found');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const position = geo.position ? {
        lat: geo.position.latitude,
        lng: geo.position.longitude,
      } : undefined;

      await clockOutApi({
        entryId: currentTimeEntry.id,
        location: position,
        accuracy: geo.position?.accuracy,
        method,
      });

      setCurrentTimeEntry(null);
      setClockedIn(false);
    } catch (err: any) {
      setError(err.message || 'Failed to clock out. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [currentTimeEntry, geo.position, setCurrentTimeEntry, setClockedIn, setLoading, setError]);

  const startBreak = useCallback(async (type: 'PAID' | 'UNPAID') => {
    if (!currentTimeEntry) {
      setError('No active time entry found');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const entry = await startBreakApi(currentTimeEntry.id, type);
      setCurrentTimeEntry(entry);
    } catch (err: any) {
      setError(err.message || 'Failed to start break. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [currentTimeEntry, setCurrentTimeEntry, setLoading, setError]);

  const endBreak = useCallback(async (breakId: string) => {
    if (!currentTimeEntry) {
      setError('No active time entry found');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const entry = await endBreakApi(currentTimeEntry.id, breakId);
      setCurrentTimeEntry(entry);
    } catch (err: any) {
      setError(err.message || 'Failed to end break. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [currentTimeEntry, setCurrentTimeEntry, setLoading, setError]);

  const clearError = useCallback(() => {
    setError(null);
  }, [setError]);

  return {
    isClockedIn,
    isLoading: useClockStore.getState().isLoading || geo.loading,
    error: useClockStore.getState().error || geo.error,
    userLocation: useClockStore.getState().userLocation,
    locationStatus: useClockStore.getState().locationStatus,
    withinGeofence: useClockStore.getState().withinGeofence,
    nearestLocation: useClockStore.getState().nearestLocation,
    distanceToLocation: useClockStore.getState().distanceToLocation,
    currentTimeEntry,
    clockIn,
    clockOut,
    startBreak,
    endBreak,
    getLocation,
    checkLocation,
    clearError,
  };
}
