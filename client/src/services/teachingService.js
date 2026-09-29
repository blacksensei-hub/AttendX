// client/src/services/teachingService.js
import api from './api';
import { download } from './consoleService';

/**
 * Lecturer tools (/teaching) and the signed-in user's own tools (/me).
 * The server answers with a flat { success, message, ...fields } body.
 */
const get  = (url, params) => api.get(url, { params }).then(r => r.data);
const post = (url, body)   => api.post(url, body).then(r => r.data);
const put  = (url, body)   => api.put(url, body).then(r => r.data);
const patch = (url, body)  => api.patch(url, body).then(r => r.data);
const del  = (url)         => api.delete(url).then(r => r.data);

export const teachingApi = {
  timetable:     (week)               => get('/teaching/timetable', { week }),
  classHub:      (classId)            => get(`/teaching/classes/${classId}`),
  roster:        (classId)            => get(`/teaching/classes/${classId}/roster`),
  student:       (classId, studentId) => get(`/teaching/classes/${classId}/students/${studentId}`),
  addStaff:      (classId, body)      => post(`/teaching/classes/${classId}/staff`, body),
  updateStaff:   (classId, userId, role) => patch(`/teaching/classes/${classId}/staff/${userId}`, { role }),
  removeStaff:   (classId, userId)    => del(`/teaching/classes/${classId}/staff/${userId}`),
  excuses:       (status)             => get('/teaching/excuses', { status }),
  reviewExcuse:  (id, decision, note) => put(`/teaching/excuses/${id}/review`, { decision, note }),
};

export const meApi = {
  timetable:     (week)  => get('/me/timetable', { week }),
  planner:       ()      => get('/me/planner'),
  preferences:   ()      => get('/me/preferences'),
  savePreferences: (reminderMinutes) => put('/me/preferences', { reminderMinutes }),
  makeFeed:      ()      => post('/me/calendar-feed'),
  removeFeed:    ()      => del('/me/calendar-feed'),
  downloadIcs:   ()      => download('/me/timetable.ics', 'attendx-timetable.ics'),
  semesters:     ()      => get('/me/semesters'),
  statement:     (semesterId) => download('/me/statement.pdf', 'attendance-statement.pdf', { semesterId }),
  excuses:       ()      => get('/me/excuses'),
  requestExcuse: (body)  => post('/me/excuses', body),
  withdrawExcuse: (id)   => del(`/me/excuses/${id}`),
};

// Human labels shared by every page that shows a request.
export const EXCUSE_REASONS = {
  medical:     'Illness or medical',
  bereavement: 'Bereavement',
  university:  'University business',
  religious:   'Religious observance',
  family:      'Family emergency',
  other:       'Other',
};

export const ROLE_LABEL = { owner: 'Owner', co_lecturer: 'Co-lecturer', ta: 'Teaching assistant' };
