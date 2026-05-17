const geolib = require('geolib');

/**
 * Check if student coordinates are within the class geofence.
 */
function isWithinGeofence({ studentLat, studentLng, centerLat, centerLng, radiusMeters }) {
  if (!centerLat || !centerLng) return true; // No geofence set — always pass

  const distance = geolib.getDistance(
    { latitude: parseFloat(studentLat), longitude: parseFloat(studentLng) },
    { latitude: parseFloat(centerLat),  longitude: parseFloat(centerLng)  }
  );

  return { within: distance <= radiusMeters, distance };
}

/**
 * Basic sanity check for coordinates (reject clearly invalid GPS)
 */
function isSuspiciousCoordinate(lat, lng) {
  const f = (n) => parseFloat(n);
  if (isNaN(f(lat)) || isNaN(f(lng))) return true;
  if (f(lat) === 0 && f(lng) === 0)   return true;  // Null island
  if (f(lat) < -90  || f(lat) > 90)   return true;
  if (f(lng) < -180 || f(lng) > 180)  return true;
  return false;
}

module.exports = { isWithinGeofence, isSuspiciousCoordinate };