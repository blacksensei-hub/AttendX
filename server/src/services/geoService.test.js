// server/src/services/geoService.test.js
const { test } = require('node:test');
const assert = require('node:assert/strict');

const { isWithinGeofence, isSuspiciousCoordinate } = require('./geoService');

// A lecture hall in Accra, and points a known distance north of it
// (one degree of latitude is about 111 km, so 0.0009 is about 100 m).
const hall = { centerLat: 5.6037, centerLng: -0.187, radiusMeters: 100 };
const north = (metres) => ({ studentLat: hall.centerLat + metres / 111_195, studentLng: hall.centerLng });

test('a phone in the room is inside the zone', () => {
  const { within, distance } = isWithinGeofence({ ...hall, ...north(20) });
  assert.equal(within, true);
  assert.ok(distance >= 19 && distance <= 21, `distance ${distance}`);
});

test('a phone just past the edge is outside, and the distance says by how much', () => {
  const { within, distance } = isWithinGeofence({ ...hall, ...north(130) });
  assert.equal(within, false);
  assert.ok(distance >= 128 && distance <= 132, `distance ${distance}`);
});

test('the edge itself counts as inside', () => {
  const at = isWithinGeofence({ ...hall, ...north(100) });
  assert.equal(at.within, at.distance <= 100);
});

test('a hostel a kilometre away is outside', () => {
  assert.equal(isWithinGeofence({ ...hall, ...north(1000) }).within, false);
});

test('coordinates sent as strings are read as numbers', () => {
  const { within } = isWithinGeofence({
    ...hall, studentLat: String(hall.centerLat), studentLng: String(hall.centerLng),
  });
  assert.equal(within, true);
});

test('a class with no zone set lets every scan through', () => {
  assert.deepEqual(
    isWithinGeofence({ studentLat: 51.5, studentLng: -0.12, centerLat: null, centerLng: null, radiusMeters: 100 }),
    { within: true, distance: 0 },
  );
});

test('impossible coordinates are suspicious', () => {
  assert.equal(isSuspiciousCoordinate(0, 0), true);            // "null island"
  assert.equal(isSuspiciousCoordinate(91, 0.5), true);
  assert.equal(isSuspiciousCoordinate(-91, 0.5), true);
  assert.equal(isSuspiciousCoordinate(5.6, 181), true);
  assert.equal(isSuspiciousCoordinate(5.6, -181), true);
  assert.equal(isSuspiciousCoordinate('north', -0.18), true);
  assert.equal(isSuspiciousCoordinate(undefined, -0.18), true);
});

test('real coordinates are not', () => {
  assert.equal(isSuspiciousCoordinate(5.6037, -0.187), false);
  assert.equal(isSuspiciousCoordinate('5.6037', '-0.187'), false);
  assert.equal(isSuspiciousCoordinate(-33.9, 151.2), false);
});
