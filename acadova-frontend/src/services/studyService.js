import api from './api';
const base = '/api/study-sets';
const staff = '/api/moderator/study-sets';
export default {
  mine: () => api.get(base), get: id => api.get(`${base}/${id}`),
  create: body => api.post(base, body), edit: (id, body) => api.patch(`${base}/${id}`, body),
  remove: (id, version) => api.post(`${base}/${id}/delete`, { version }),
  start: id => api.post(`${base}/${id}/start`, {}), attempt: id => api.get(`${base}/attempts/${id}`),
  submit: (id, answers) => api.post(`${base}/attempts/${id}/submit`, { answers }),
  review: id => api.get(`${base}/${id}/review`), results: () => api.get(`${base}/results`),
  shared: q => api.get(`${base}/shared` + (q ? '?' + new URLSearchParams({ q }) : '')),
  publish: (id, version) => api.post(`${base}/${id}/publication`, { version }),
  withdraw: (id, version) => api.post(`${base}/${id}/withdraw`, { version }),
  report: (id, reason) => api.post(`${base}/${id}/report`, { reason }),
  staffList: view => api.get(staff + (view === 'removed' ? '?view=removed' : '')), staffGet: id => api.get(`${staff}/${id}`),
  decide: (id, body) => api.post(`${staff}/${id}/decision`, body),
  closeReport: (id, reason, version) => api.post(`${staff}/reports/${id}/close`, { reason, version }),
};
