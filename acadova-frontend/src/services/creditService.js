import api from './api';

export const creditService = {
  getMyCreditHistory: async (page = 1) => {
    return api.get(`/api/credits/mine?page=${page}`);
  },
};

export default creditService;
