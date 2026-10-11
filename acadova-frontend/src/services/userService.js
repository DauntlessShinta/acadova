import api from './api';

export const userService = {
  getMe: async () => {
    return api.get('/api/users/me');
  },

  updateMe: async ({ name, skillsToTeach, skillsToLearn, weeklyAvailability }) => {
    return api.patch('/api/users/me', { name, skillsToTeach, skillsToLearn, weeklyAvailability });
  },
  finishOnboarding: async () => api.post('/api/users/me/onboarding', {}),

  getUserReviews: async (id) => api.get('/api/users/' + id + '/reviews'),

  searchTutors: async (subject = '') => {
    const query = subject ? `?subject=${encodeURIComponent(subject)}` : '';
    return api.get(`/api/users/tutors${query}`);
  },

  getUserById: async (id) => {
    return api.get(`/api/users/${id}`);
  },
};

export default userService;
