import api from './api';

export const analyticsService = {
  getSubjectAnalytics: async () => {
    return api.get('/api/analytics/subjects');
  },

  getSessionAnalytics: async () => {
    return api.get('/api/analytics/sessions');
  },

  getRatingAnalytics: async () => {
    return api.get('/api/analytics/ratings');
  },

  getCreditAnalytics: async () => {
    return api.get('/api/analytics/credits');
  },

  getAdminUsers: async () => {
    return api.get('/api/admin/users');
  },

  getAdminSessions: async () => api.get('/api/admin/sessions'),

  updateUserRole: async (id, role) => {
    return api.patch(`/api/admin/users/${id}/role`, { role });
  },
  updateUserStatus: async (id, status, reason) => api.patch(`/api/admin/users/${id}/status`,
    { status, ...(reason ? { reason } : {}) }),
  getAuditLogs: async (params = {}) => api.get(`/api/admin/audit-logs?${new URLSearchParams(params)}`),
  getSecurityOverview: async (params = {}) => api.get(`/api/admin/security?${new URLSearchParams(params)}`),
};

export default analyticsService;
