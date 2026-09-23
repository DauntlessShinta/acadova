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
};

export default analyticsService;

