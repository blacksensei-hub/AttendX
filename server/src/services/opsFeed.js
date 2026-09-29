// server/src/services/opsFeed.js

/**
 * ═════════════════════════════════════════════════════════════════
 * Two small registries the admin console reads live.
 *
 * opsEmit — pushes an event to every connected admin (the "admin:ops"
 * room, joined automatically in config/socket.js). The live operations
 * wall listens for these. Payloads carry class names and counts, never
 * student names: the wall is meant for a projector.
 *
 * beat / heartbeats — each background job records when it last ran, so
 * the health page can tell a stalled scheduler from a quiet one.
 * ═════════════════════════════════════════════════════════════════
 */

let ioRef = null;
const setIo = (io) => { ioRef = io; };

function opsEmit(event, payload) {
  try {
    ioRef?.to('admin:ops').emit(event, { ...payload, at: new Date().toISOString() });
  } catch (err) {
    console.warn('[Ops] emit failed:', err.message);
  }
}

const beats = {};
const startedAt = new Date();
const beat = (name) => { beats[name] = new Date().toISOString(); };
const heartbeats = () => ({ ...beats });

module.exports = { setIo, opsEmit, beat, heartbeats, startedAt };
