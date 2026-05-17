import api from './api';

export const classService = {
  // Lecturer: get all their classes
  getMyClasses: () => api.get('/classes').then(r => r.data),

  // Create a new class
  createClass: (data) => api.post('/classes', data).then(r => r.data),

  // Update class
  updateClass: (id, data) => api.put(`/classes/${id}`, data).then(r => r.data),

  // Delete class
  deleteClass: (id) => api.delete(`/classes/${id}`).then(r => r.data),

  // Get class details with enrolled students
  getClassDetail: (id) => api.get(`/classes/${id}`).then(r => r.data),

  // Student: join a class by code
  joinClass: (code) => api.post('/classes/join', { code }).then(r => r.data),

  // Student: get enrolled classes
  getEnrolledClasses: () => api.get('/classes/enrolled').then(r => r.data),

  // Get class students list
  getClassStudents: (id) => api.get(`/classes/${id}/students`).then(r => r.data),
};