import api from './apiClient.js';

/**
 * ServiceDesk Pro — Knowledge Base Service
 */
export const knowledgeService = {
  /**
   * Fetches paginated, searched, and filtered articles.
   */
  getArticles: async (params = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        query.append(key, val);
      }
    });
    const queryString = query.toString() ? `?${query.toString()}` : '';
    return api.get(`/knowledge-base${queryString}`);
  },

  /**
   * Retrieves single article by ID or slug with view count increment.
   */
  getArticle: async (idOrSlug) => {
    return api.get(`/knowledge-base/${idOrSlug}`);
  },

  /**
   * Creates a new knowledge article.
   */
  createArticle: async (articleData) => {
    return api.post('/knowledge-base', articleData);
  },

  /**
   * Updates an existing knowledge article.
   */
  updateArticle: async (articleId, updateData) => {
    return api.patch(`/knowledge-base/${articleId}`, updateData);
  },

  /**
   * Deletes a knowledge article (Admins/Managers).
   */
  deleteArticle: async (articleId) => {
    return api.delete(`/knowledge-base/${articleId}`);
  },

  /**
   * Publishes an article.
   */
  publishArticle: async (articleId) => {
    return api.patch(`/knowledge-base/${articleId}/publish`);
  },

  /**
   * Archives an article.
   */
  archiveArticle: async (articleId) => {
    return api.patch(`/knowledge-base/${articleId}/archive`);
  },

  /**
   * Records a review on an article.
   */
  reviewArticle: async (articleId) => {
    return api.patch(`/knowledge-base/${articleId}/review`);
  },

  /**
   * Submits helpfulness feedback vote ('helpful' or 'notHelpful').
   */
  voteFeedback: async (articleId, isHelpful) => {
    return api.post(`/knowledge-base/${articleId}/feedback`, {
      vote: isHelpful ? 'helpful' : 'notHelpful',
    });
  },

  /**
   * Retrieves organization categories for filtering/authoring.
   */
  getCategories: async (params = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        query.append(key, val);
      }
    });
    const queryString = query.toString() ? `?${query.toString()}` : '';
    return api.get(`/categories${queryString}`);
  },
};

export default knowledgeService;
