import api from './api';

export const creditService = {
  getMyCreditHistory: async () => {
    return api.get('/api/credits/mine');
  },
};

export default creditService;

