import api from './api';

export const sessionService = {
  openSession: (classId, data) =>
    api.post(`/sessions`, { classId, ...data }).then(r => r.data),

  closeSession: (sessionId) =>
    api.put(`/sessions/${sessionId}/close`).then(r => r.data),

  getSession: (sessionId) =>
    api.get(`/sessions/${sessionId}`).then(r => r.data),

  getActiveSession: (classId) =>
    api.get(`/sessions/active/${classId}`).then(r => r.data),

  getLiveAttendance: (sessionId) =>
    api.get(`/sessions/${sessionId}/attendance`).then(r => r.data),

  // Student: get active sessions for enrolled classes
  getActiveSessions: () =>
    api.get('/sessions/active').then(r => r.data),

  // Student: mark attendance via QR token
  markAttendance: (sessionId, qrToken, geo) =>
  api.post(`/attendance/mark`, {
    sessionId,
    qrToken,
    latitude:  geo?.latitude  ?? 0,
    longitude: geo?.longitude ?? 0,
    isMockGps: false,
  }).then(r => r.data),

  // Get current QR token (for lecturer to display)
  getCurrentQR: (sessionId) =>
    api.get(`/sessions/${sessionId}/qr`).then(r => r.data),
};