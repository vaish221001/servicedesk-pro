const express = require('express');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const {
  createArticle,
  getArticles,
  getArticleByIdOrSlug,
  updateArticle,
  publishArticle,
  archiveArticle,
  reviewArticle,
  voteFeedback,
  deleteArticle,
} = require('../controllers/knowledgeArticleController');

const router = express.Router();

// All knowledge base routes require authentication
router.use(auth);

// Article Listing & Retrieval
router.get('/', getArticles);
router.get('/:id', getArticleByIdOrSlug);

// Article Authoring & Updates
router.post(
  '/',
  authorize('SYSTEM_ADMIN', 'IT_MANAGER', 'TECHNICIAN'),
  createArticle
);

router.patch(
  '/:id',
  authorize('SYSTEM_ADMIN', 'IT_MANAGER', 'TECHNICIAN'),
  updateArticle
);

router.delete(
  '/:id',
  authorize('SYSTEM_ADMIN', 'IT_MANAGER'),
  deleteArticle
);

// Lifecycle Transitions (Publish, Archive, Review)
router.patch(
  '/:id/publish',
  authorize('SYSTEM_ADMIN', 'IT_MANAGER', 'TECHNICIAN'),
  publishArticle
);
router.post(
  '/:id/publish',
  authorize('SYSTEM_ADMIN', 'IT_MANAGER', 'TECHNICIAN'),
  publishArticle
);

router.patch(
  '/:id/archive',
  authorize('SYSTEM_ADMIN', 'IT_MANAGER', 'TECHNICIAN'),
  archiveArticle
);
router.post(
  '/:id/archive',
  authorize('SYSTEM_ADMIN', 'IT_MANAGER', 'TECHNICIAN'),
  archiveArticle
);

router.patch(
  '/:id/review',
  authorize('SYSTEM_ADMIN', 'IT_MANAGER', 'TECHNICIAN'),
  reviewArticle
);
router.post(
  '/:id/review',
  authorize('SYSTEM_ADMIN', 'IT_MANAGER', 'TECHNICIAN'),
  reviewArticle
);

// Helpfulness Feedback Voting (Accessible to all authenticated users)
router.post('/:id/feedback', voteFeedback);

module.exports = router;
