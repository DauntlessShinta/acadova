import api from './api';
const endpoint = (name, params = {}) => `/api/analytics/${name}` + (Object.keys(params).length ? `?${new URLSearchParams(params)}` : '');

export const analyticsService = {
  getAdminDashboard: (params, options) => api.get('/api/admin/dashboard?' + new URLSearchParams(params), options),
  getModeratorAnalytics: (params, options) => api.get('/api/moderator/analytics?' + new URLSearchParams(params), options),
  getSubjectAnalytics: async (params, options) => {
    return api.get(endpoint('subjects', params), options);
  },

  getSessionAnalytics: async (params, options) => {
    return api.get(endpoint('sessions', params), options);
  },

  getRatingAnalytics: async (params, options) => {
    return api.get(endpoint('ratings', params), options);
  },

  getCreditAnalytics: async (params, options) => {
    return api.get(endpoint('credits', params), options);
  },
  getLearningAnalytics: async (params, options) => api.get(endpoint('learning', params), options),
  getAdminOverview: async (_params, options) => api.get('/api/admin/overview', options),
  getAdminOperations: async (_params, options) => api.get('/api/admin/operations', options),
  getRecentLedger: async (_params, options) => api.get('/api/admin/credits/activity', options),
  getModeratorDashboard: async (params = {}, options) => api.get('/api/moderator/overview?' + new URLSearchParams(params), options),
  getTrustSummary: async (_params, options) => api.get('/api/admin/trust-summary', options),

  getAdminUsers: async (params = {}) => {
    return api.get('/api/admin/users?' + new URLSearchParams(params));
  },

  getAdminSessions: async (params = {}) => api.get('/api/admin/sessions?' + new URLSearchParams(params)),

  updateUserRole: async (id, role) => {
    return api.patch(`/api/admin/users/${id}/role`, { role });
  },
  updateUserStatus: async (id, status, reason) => api.patch(`/api/admin/users/${id}/status`,
    { status, ...(reason ? { reason } : {}) }),
  getAuditLogs: async (params = {}, options) => api.get(`/api/admin/audit-logs?${new URLSearchParams(params)}`, options),
  getSecurityOverview: async (params = {}, options) => api.get(`/api/admin/security?${new URLSearchParams(params)}`, options),
};

export default analyticsService;
