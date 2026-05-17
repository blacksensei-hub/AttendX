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
const startImpersonation = async (targetUserId, reason) => {
  const { data } = await api.post('/impersonation/start', { targetUserId, reason });
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

// ─── Named exports ────────────────────────────────────────────
export {
  getStats,
  listUsers,
  toggleUserStatus,
  updateUserRole,
  deleteUser,
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
};

// ─── Object export ────────────────────────────────────────────
export const adminService = {
  getStats,
  listUsers,
  toggleUserStatus,
  updateUserRole,
  deleteUser,
  listClasses,
  getClasses:         listClasses,
  getActiveSessions,
  forceCloseSession,
  startImpersonation,
  stopImpersonation,
  listImpersonationLogs,
  getAtRisk,
  notifyAtRiskStudent,
  notifyAtRiskLecturer,
  getHeatmapData,
};

export default adminService;