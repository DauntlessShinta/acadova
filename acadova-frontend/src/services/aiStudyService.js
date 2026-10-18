import api from './api';
const base = '/api/ai-study';
export default {
  status: () => api.get(`${base}/status`),
  progress: (key, options = {}) => api.get(`${base}/requests/${encodeURIComponent(key)}`, options),
  source: id => api.get(`${base}/sources/${id}`),
  generateResource: (source, type, key, count, {syntheticOnly = false, ...options} = {}) => api.post(`${base}/generate-resource`, { resourceId: source.resourceId, sourceId: source.sourceId, type, mode: 'strict_source', [syntheticOnly?'syntheticConsent':'providerConsent']: true, count }, { ...options, headers: { 'Idempotency-Key': key } }),
  generate: (file, type, key, mode = 'standard', count, {syntheticOnly = false, ...options} = {}) => {
    const body = new FormData(); body.append('document', file); body.append('type', type); body.append(syntheticOnly?'syntheticConsent':'providerConsent', 'true');
    body.append('mode', mode); if (count !== undefined) body.append('count', String(count));
    return api.post(`${base}/generate`, body, { ...options, headers: { 'Idempotency-Key': key } });
  },
  save: (previewId, title, associations = {}) => api.post(`${base}/sets`, { previewId, title, ...associations }),
  mine: () => api.get(`${base}/sets`), get: id => api.get(`${base}/sets/${id}`),
  rename: (id, title, version) => api.patch(`${base}/sets/${id}`, { title, version }),
  remove: (id, version) => api.post(`${base}/sets/${id}/delete`, { version }),
  practice: (id, answers) => api.post(`${base}/sets/${id}/practice`, { answers }),
};
