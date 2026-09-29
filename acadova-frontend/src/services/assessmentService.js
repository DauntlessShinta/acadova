import api from './api';

export const assessmentService = {
  list: () => api.get('/api/assessments'),
  get: (id) => api.get(`/api/assessments/${id}`),
  submit: (id, answers) => api.post(`/api/assessments/${id}/submit`, { answers }),
  getResult: (id) => api.get(`/api/assessments/attempts/${id}`),
  staffList: () => api.get('/api/moderator/assessments'),
  staffGet: (id) => api.get(`/api/moderator/assessments/${id}`),
  create: (body) => api.post('/api/moderator/assessments', body),
  publish: (id) => api.post(`/api/moderator/assessments/${id}/publish`, {}),
};

export default assessmentService;
