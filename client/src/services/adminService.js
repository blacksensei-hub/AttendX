// client/src/services/adminService.js

import api from './api';

const unwrap = (res) => res?.data ?? res ?? {};

// ─── Dashboard stats ─────────────────────────────────────────
const getStats = async () => {
  const { data } = await api.get('/admin/stats');
  return unwrap(data);
};

// ─── Users ───────────────────────────────────────────────────
const listUsers = async (params = {}) => {
  const { data } = await api.get('/admin/users', { params });
  return unwrap(data);
};

const toggleUserStatus = async (userId) => {
  const { data } = await api.put(`/admin/users/${userId}/toggle`);
  return unwrap(data);
};

const updateUserRole = async (userId, role) => {
  const { data } = await api.put(`/admin/users/${userId}/role`, { role });
  return unwrap(data);
};

const deleteUser = async (userId) => {
  const { data } = await api.delete(`/admin/users/${userId}`);
  return unwrap(data);
};

// Clears a student's device lock so their next sign-in registers a new
// device. Needed when someone legitimately changes phone, reinstalls the
// app, or clears their browser — otherwise they're locked out for good.
// Clears one platform's device lock (web or mobile) so the student's next
// sign-in on that platform registers a new device. Scoped to a single
// platform — resetting mobile ("got a new phone") doesn't need to also
// sign the student out of a laptop session that never had a problem.
const resetUserDevice = async (userId, platform) => {
  const { data } = await api.put(`/admin/users/${userId}/reset-device/${platform}`);
  return unwrap(data);
};

// ─── Classes ─────────────────────────────────────────────────
const listClasses = async (params = {}) => {
  const { data } = await api.get('/admin/classes', { params });
  return unwrap(data);
};

// ─── Sessions ────────────────────────────────────────────────
const getActiveSessions = async () => {
  const { data } = await api.get('/admin/sessions/active');
  return unwrap(data);
};

const forceCloseSession = async (sessionId) => {
  const { data } = await api.put(`/admin/sessions/${sessionId}/close`);
  return unwrap(data);
};

// ─── Impersonation ───────────────────────────────────────────
// The route is POST /impersonation/start/:userId — the target id goes in
// the PATH, not the body. Only `reason` is sent as the payload.
const startImpersonation = async (targetUserId, reason) => {
  const { data } = await api.post(`/impersonation/start/${targetUserId}`, { reason });
  return unwrap(data);
};

const stopImpersonation = async () => {
  const { data } = await api.post('/impersonation/stop');
  return unwrap(data);
};

const listImpersonationLogs = async (params = {}) => {
  const { data } = await api.get('/impersonation/logs', { params });
  return unwrap(data);
};

// ─── At-risk dashboard ───────────────────────────────────────
const getAtRisk = async () => {
  const { data } = await api.get('/admin/at-risk');
  return unwrap(data);
};

const notifyAtRiskStudent = async (userId, classId) => {
  const { data } = await api.post(`/admin/at-risk/notify-student/${userId}/${classId}`);
  return unwrap(data);
};

const notifyAtRiskLecturer = async (userId, classId) => {
  const { data } = await api.post(`/admin/at-risk/notify-lecturer/${userId}/${classId}`);
  return unwrap(data);
};

// ─── Campus heatmap ──────────────────────────────────────────
const getHeatmapData = async () => {
  const { data } = await api.get('/admin/heatmap');
  return unwrap(data);
};

// ─── Announcements ───────────────────────────────────────────
const previewAnnouncement = async (params = {}) => {
  const { data } = await api.get('/admin/announcements/preview', { params });
  return unwrap(data);
};

const sendAnnouncement = async (body = {}) => {
  const { data } = await api.post('/admin/announcements', body);
  return unwrap(data);
};

// ─── Named exports ────────────────────────────────────────────
export {
  getStats,
  listUsers,
  toggleUserStatus,
  updateUserRole,
  deleteUser,
  resetUserDevice,
  listClasses,
  getActiveSessions,
  forceCloseSession,
  startImpersonation,
  stopImpersonation,
  listImpersonationLogs,
  getAtRisk,
  notifyAtRiskStudent,
  notifyAtRiskLecturer,
  getHeatmapData,
  previewAnnouncement,
  sendAnnouncement,
};

// ─── Object export (used by Announcements.jsx + other pages) ──
export const adminService = {
  getStats,
  listUsers,
  toggleUserStatus,
  updateUserRole,
  deleteUser,
  resetUserDevice,
  listClasses,
  getClasses:           listClasses,
  getActiveSessions,
  forceCloseSession,
  startImpersonation,
  stopImpersonation,
  listImpersonationLogs,
  getAtRisk,
  notifyAtRiskStudent,
  notifyAtRiskLecturer,
  getHeatmapData,
  previewAnnouncement,
  sendAnnouncement,
};

export default adminService;