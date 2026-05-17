import api from './api';

export const reportService = {
  exportCSV: async (classId, sessionId) => {
    const params = new URLSearchParams();
    if (classId)   params.set('classId', classId);
    if (sessionId) params.set('sessionId', sessionId);

    const res = await api.get(`/reports/export/csv?${params}`, {
      responseType: 'blob',
    });
    return res.data;
  },

  exportPDF: async (classId, sessionId) => {
    const params = new URLSearchParams();
    if (classId)   params.set('classId', classId);
    if (sessionId) params.set('sessionId', sessionId);

    const res = await api.get(`/reports/export/pdf?${params}`, {
      responseType: 'blob',
    });
    return res.data;
  },

  getSummary: (classId) =>
    api.get(`/reports/summary/${classId}`).then(r => r.data),

  getDashboardStats: () =>
    api.get('/reports/dashboard').then(r => r.data),
};