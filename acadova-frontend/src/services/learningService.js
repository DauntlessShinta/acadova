import api from './api';

const learningService = {
  topics: () => api.get('/api/learning/topics'),
  topic: (id) => api.get(`/api/learning/topics/${id}`),
  resource: (id) => api.get(`/api/learning/resources/${id}`),
  module: (id) => api.get(`/api/learning/modules/${id}`),
  unlockResource: (id) => api.post(`/api/learning/resources/${id}/unlock`, {}),
  unlockModule: (id) => api.post(`/api/learning/modules/${id}/unlock`, {}),
  submit: (body) => api.post('/api/learning/resources/submit', body),
  staffTopics: () => api.get('/api/moderator/learning/topics'),
  createTopic: (body) => api.post('/api/moderator/learning/topics', body),
  publishTopic: (id) => api.post(`/api/moderator/learning/topics/${id}/publish`, {}),
  archiveTopic: (id) => api.post(`/api/moderator/learning/topics/${id}/archive`, {}),
  staffResources: () => api.get('/api/moderator/learning/resources'),
  publishResource: (id, creditCost) => api.post(`/api/moderator/learning/resources/${id}/publish`, { creditCost }),
  rejectResource: (id, reason) => api.post(`/api/moderator/learning/resources/${id}/reject`, { reason }),
  archiveResource: (id) => api.post(`/api/moderator/learning/resources/${id}/archive`, {}),
  staffModules: () => api.get('/api/moderator/learning/modules'),
  createModule: (body) => api.post('/api/moderator/learning/modules', body),
  publishModule: (id, creditCost) => api.post(`/api/moderator/learning/modules/${id}/publish`, { creditCost }),
  archiveModule: (id) => api.post(`/api/moderator/learning/modules/${id}/archive`, {}),
};

export default learningService;
