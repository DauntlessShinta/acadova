import api from './api';

export const creditService = {
  getMyCreditHistory: async (page = 1) => {
    return api.get(`/api/credits/mine?page=${page}`);
  },
  getCurrentRules: () => api.get('/api/credits/rules'),
};

export default creditService;
