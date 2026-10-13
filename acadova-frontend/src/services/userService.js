import api from './api';

export const userService = {
  getMe: async () => {
    return api.get('/api/users/me');
  },

  updateMe: async ({ name, skillsToTeach, skillsToLearn, weeklyAvailability, bio, university, yearLevel, languages, profileVisibility }) => {
    return api.patch('/api/users/me', { name, skillsToTeach, skillsToLearn, weeklyAvailability, bio, university, yearLevel, languages, profileVisibility });
  },
  finishOnboarding: async () => api.post('/api/users/me/onboarding', {}),

  getUserReviews: async (id) => api.get('/api/users/' + id + '/reviews'),

  searchTutors: async (filters = '') => {
    const values = typeof filters === 'string' ? { subject: filters } : filters;
    const query = new URLSearchParams(Object.entries(values).filter(([, value]) => value));
    return api.get(`/api/users/tutors${query.size ? '?' + query : ''}`);
  },

  getUserById: async (id) => {
    return api.get(`/api/users/${id}`);
  },
};

export default userService;
