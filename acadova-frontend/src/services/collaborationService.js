import api from './api';
const circles = '/api/study-circles'; const sharing = '/api/study-sharing';
export default {
  circles: params => api.get(circles + (params ? '?' + new URLSearchParams(params) : '')),
  circle: id => api.get(`${circles}/${id}`), create: body => api.post(circles, body),
  action: (id, action, body = {}) => api.post(`${circles}/${id}/${action}`, body),
  reportCircle: (id, reason) => api.post(`${circles}/${id}/report`, { reason }),
  volunteers: q => api.get(`${circles}/volunteers` + (q ? '?' + new URLSearchParams({ q }) : '')),
  profile: () => api.get(`${circles}/volunteer-profile`), saveProfile: body => api.put(`${circles}/volunteer-profile`, body),
  moderation: () => api.get(`${circles}/moderation`), moderate: (id, body) => api.post(`${circles}/moderation/${id}`, body),
  sharing: id => api.get(`${sharing}/${id}`), changeSharing: (id, body) => api.put(`${sharing}/${id}`, body),
  openShare: (id, token) => api.post(`${sharing}/${id}/open`, { token }), reportShare: (id, token, reason) => api.post(`${sharing}/${id}/report`, { token, reason }),
};
