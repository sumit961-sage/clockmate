import { useState, useEffect, useCallback, useRef } from 'react';

export interface GeoPosition {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude: number | null;
  altitudeAccuracy: number | null;
  heading: number | null;
  speed: number | null;
}

export interface GeoState {
  position: GeoPosition | null;
  error: string | null;
  loading: boolean;
  permission: 'granted' | 'denied' | 'prompt' | 'unknown';
}

export interface GeoReturn extends GeoState {
  getPosition: () => void;
  startWatching: () => void;
  stopWatching: () => void;
}

/**
 * Geolocation hook with error handling and permission checking
 */
export function useGeolocation(options?: PositionOptions): GeoReturn {
  const [state, setState] = useState<GeoState>({
    position: null,
    error: null,
    loading: false,
    permission: 'unknown',
  });

  const watchId = useRef<number | null>(null);

  const getPosition = useCallback(() => {
    if (!navigator.geolocation) {
      setState(s => ({ ...s, error: 'Geolocation not supported', loading: false }));
      return;
    }

    setState(s => ({ ...s, loading: true, error: null }));

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setState({
          position: {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            altitude: pos.coords.altitude,
            altitudeAccuracy: pos.coords.altitudeAccuracy,
            heading: pos.coords.heading,
            speed: pos.coords.speed,
          },
          error: null,
          loading: false,
          permission: 'granted',
        });
      },
      (err) => {
        let msg = 'Failed to get location';
        switch (err.code) {
          case err.PERMISSION_DENIED:
            msg = 'Location permission denied. Please enable in browser settings.';
            setState(s => ({ ...s, error: msg, loading: false, permission: 'denied' }));
            return;
          case err.POSITION_UNAVAILABLE:
            msg = 'Location unavailable. Try again or check GPS.';
            break;
          case err.TIMEOUT:
            msg = 'Location request timed out.';
            break;
        }
        setState(s => ({ ...s, error: msg, loading: false }));
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 60000,
        ...options,
      }
    );
  }, [options]);

  // Watch position
  const startWatching = useCallback(() => {
    if (!navigator.geolocation || watchId.current !== null) return;

    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        setState({
          position: {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            altitude: pos.coords.altitude,
            altitudeAccuracy: pos.coords.altitudeAccuracy,
            heading: pos.coords.heading,
            speed: pos.coords.speed,
          },
          error: null,
          loading: false,
          permission: 'granted',
        });
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setState(s => ({ ...s, error: 'Permission denied', permission: 'denied', loading: false }));
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
  }, []);

  const stopWatching = useCallback(() => {
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
  }, []);

  // Check permission state on mount
  useEffect(() => {
    if (navigator.permissions) {
      navigator.permissions.query({ name: 'geolocation' as PermissionName }).then((result) => {
        setState(s => ({ ...s, permission: result.state as 'granted' | 'denied' | 'prompt' }));
        result.addEventListener('change', () => {
          setState(s => ({ ...s, permission: result.state as 'granted' | 'denied' | 'prompt' }));
        });
      });
    }
  }, []);

  useEffect(() => {
    return () => {
      if (watchId.current !== null) {
        navigator.geolocation.clearWatch(watchId.current);
      }
    };
  }, []);

  return { ...state, getPosition, startWatching, stopWatching };
}
