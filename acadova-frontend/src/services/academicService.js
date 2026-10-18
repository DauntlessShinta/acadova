import api from './api';
import { apiUrl } from '../utils/apiUrl';
const base = '/api/academic';
export default {
  plans: subjectId => api.get(`${base}/plans${subjectId ? '?subjectId=' + subjectId : ''}`),
  createPlan: body => api.post(`${base}/plans`, body),
  editPlan: (id, body) => api.patch(`${base}/plans/${id}`, body),
  removePlan: (id, version) => api.delete(`${base}/plans/${id}`, { body: { version } }),
  planPreferences: enabled => api.patch(`${base}/plans/preferences`, { enabled }),
  dismissNudge: (key, subjectId) => api.post(`${base}/plans/nudges/dismiss${subjectId ? '?subjectId=' + subjectId : ''}`, { key }),
  state: () => api.get(`${base}/state`), subject: id => api.get(`${base}/subjects/${id}`),
  select: currentTermId => api.patch(`${base}/current-term`, { currentTermId }),
  create: (type, body) => api.post(`${base}/${type}`, body), edit: (type, id, body) => api.patch(`${base}/${type}/${id}`, body),
  remove: (type, id) => api.delete(`${base}/${type}/${id}`, { body: {} }),
  associate: (id, body) => api.patch(`${base}/study-sets/${id}/associations`, body),
  upload: (file, values, options = {}) => { const body = new FormData(); body.append('document', file); for (const [key, value] of Object.entries(values)) if (value) body.append(key, value); return api.post(`${base}/resources/upload`, body, options); },
  download: async (resource, { open = false } = {}) => {
    const tab = open && resource.kind === 'pdf' ? window.open('about:blank', '_blank') : null;
    if (tab) tab.opener = null;
    try {
    const response = await fetch(apiUrl(import.meta.env.VITE_API_URL || '', `${base}/resources/${resource.id}/file`), { headers: { Authorization: `Bearer ${localStorage.getItem('acadova_token')}` } });
    if (!response.ok) throw new Error('Private file unavailable. Sign in again or retry.');
    const url = URL.createObjectURL(await response.blob());
    if (tab && !tab.closed) tab.location.replace(url);
    else { const anchor = document.createElement('a'); anchor.href = url; anchor.download = resource.fileName || `resource.${resource.kind}`; anchor.click(); }
    setTimeout(() => URL.revokeObjectURL(url), open ? 60000 : 1000);
    } catch (error) { tab?.close(); throw error; }
  },
};
