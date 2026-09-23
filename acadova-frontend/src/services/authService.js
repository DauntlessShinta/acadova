import api from './api';

export const authService = {
  register: async ({ name, email, password, skillsToTeach, skillsToLearn }) => {
    return api.post('/api/auth/register', {
      name,
      email,
      password,
      skillsToTeach: Array.isArray(skillsToTeach) ? skillsToTeach : [],
      skillsToLearn: Array.isArray(skillsToLearn) ? skillsToLearn : [],
    });
  },

  login: async (email, password) => {
    return api.post('/api/auth/login', { email, password });
  },

  getHealth: async () => {
    return api.get('/api/health');
  },
};

export default authService;

