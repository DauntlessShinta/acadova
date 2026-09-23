import api from './api';

export const ratingService = {
  submitRating: async ({ sessionId, rating, comment }) => {
    return api.post('/api/ratings', {
      sessionId,
      rating: Number(rating),
      comment: comment?.trim() || undefined,
    });
  },
};

export default ratingService;

