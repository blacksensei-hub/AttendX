// client/src/services/consoleService.js
import api from './api';

/**
 * API calls for the admin console features (overview, analytics,
 * calendar, fraud review, audit trail, announcements, settings,
 * people import, search, live ops and health). The server answers
 * with a flat { success, message, ...fields } body, returned as is.
 */
const get  = (url, params) => api.get(url, { params }).then(r => r.data);
const post = (url, body)   => api.post(url, body).then(r => r.data);
const put  = (url, body)   => api.put(url, body).then(r => r.data);
const del  = (url)         => api.delete(url).then(r => r.data);

// Authenticated file download (CSV, PDF): fetch as a blob, then save.
export async function download(url, filename, params) {
  const res = await api.get(url, { params, responseType: 'blob', timeout: 60000 });
  const href = URL.createObjectURL(res.data);
  const a = Object.assign(document.createElement('a'), { href, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}

export const consoleApi = {
  overview:       ()        => get('/admin/overview'),
  search:         (q)       => get('/admin/search', { q }),
  ops:            ()        => get('/admin/ops'),
  health:         ()        => get('/admin/health'),

  settings:       ()        => get('/admin/settings'),
  saveSettings:   (values)  => put('/admin/settings', { values }),
  testDigest:     ()        => post('/admin/digest/test'),

  analytics:      (params)  => get('/admin/analytics', params),
  analyticsPdf:   (params)  => download('/admin/analytics/report.pdf', 'attendx-institution-report.pdf', params),

  calendar:       (month)   => get('/admin/calendar', { month }),
  saveSemester:   (id, b)   => (id ? put(`/admin/semesters/${id}`, b) : post('/admin/semesters', b)),
  archiveSemester:(id)      => put(`/admin/semesters/${id}/archive`),
  deleteSemester: (id)      => del(`/admin/semesters/${id}`),
  saveEvent:      (id, b)   => (id ? put(`/admin/calendar/events/${id}`, b) : post('/admin/calendar/events', b)),
  deleteEvent:    (id)      => del(`/admin/calendar/events/${id}`),

  fraud:          (params)  => get('/admin/fraud', params),
  reviewFlag:     (id, b)   => put(`/admin/fraud/${id}`, b),
  sweepFraud:     ()        => post('/admin/fraud/sweep'),

  audit:          (params)  => get('/admin/audit', params),
  auditCsv:       (params)  => download('/admin/audit/export', 'attendx-audit-trail.csv', params),

  announcements:  ()        => get('/admin/announcements'),
  annOptions:     ()        => get('/admin/announcements/options'),
  annCount:       (audience, value) => get('/admin/announcements/count', { audience, value }),
  saveAnn:        (id, b)   => (id ? put(`/admin/announcements/${id}`, b) : post('/admin/announcements', b)),
  sendAnn:        (id)      => post(`/admin/announcements/${id}/send`),
  deleteAnn:      (id)      => del(`/admin/announcements/${id}`),
  annReceipts:    (id)      => get(`/admin/announcements/${id}/receipts`),

  importUsers:    (rows, dryRun, sendInvites = true) => post('/admin/users/import', { rows, dryRun, sendInvites }),
  bulkUsers:      (ids, action, role) => post('/admin/users/bulk', { ids, action, role }),
  resendInvite:   (id)      => post(`/admin/users/${id}/invite`),
};

// Public (signed-out) invite endpoints.
export const inviteApi = {
  check:  (token)           => get(`/auth/invite/${token}`),
  accept: (token, password) => post(`/auth/invite/${token}`, { password }),
};
