// backend/src/utils/geo.js
/**
 * Geo utility using the Haversine formula.
 * All distance values are in meters.
 */

/**
 * Convert degrees to radians.
 */
function toRad(deg) {
  return (deg * Math.PI) / 180;
}

/**
 * Haversine distance between two lat/lng points (in meters).
 */
export function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth radius in meters
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δφ = toRad(lat2 - lat1);
  const Δλ = toRad(lon2 - lon1);

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // distance in meters
}

/**
 * Check whether a user's position falls inside a geofence circle.
 * @returns {{ within: boolean; distance: number }}
 */
export function isWithinGeofence(userLat, userLng, siteLat, siteLng, radiusMeters) {
  const distance = haversineDistance(userLat, userLng, siteLat, siteLng);
  return {
    within: distance <= radiusMeters,
    distance,
  };
}

/**
 * Find the nearest location from a list.
 * @returns {{ location: object|null; distance: number }}
 */
export function findNearestLocation(userLat, userLng, locations) {
  let nearest = null;
  let minDist = Infinity;

  for (const loc of locations) {
    if (!loc.coordinates?.lat || !loc.coordinates?.lng) continue;
    const dist = haversineDistance(
      userLat,
      userLng,
      loc.coordinates.lat,
      loc.coordinates.lng
    );
    if (dist < minDist) {
      minDist = dist;
      nearest = loc;
    }
  }

  return { location: nearest, distance: minDist };
}
