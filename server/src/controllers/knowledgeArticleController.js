const knowledgeArticleService = require('../services/knowledgeArticleService');

/**
 * @desc    Create a new knowledge article
 * @route   POST /api/knowledge-base
 * @access  Private (SYSTEM_ADMIN, IT_MANAGER, TECHNICIAN)
 */
const createArticle = async (req, res, next) => {
  try {
    const article = await knowledgeArticleService.createArticle(
      req.user.organizationId,
      req.body,
      req.user,
      req
    );
    res.status(201).json({
      success: true,
      data: article,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    List knowledge articles with search, tags, category filter and pagination
 * @route   GET /api/knowledge-base
 * @access  Private (Role-scoped: employees only see published public articles)
 */
const getArticles = async (req, res, next) => {
  try {
    const result = await knowledgeArticleService.getArticles(
      req.user.organizationId,
      req.user,
      req.query
    );
    res.status(200).json({
      success: true,
      data: result.articles,
      pagination: result.pagination,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Get knowledge article by ID or slug
 * @route   GET /api/knowledge-base/:id
 * @access  Private (Role-scoped)
 */
const getArticleByIdOrSlug = async (req, res, next) => {
  try {
    const article = await knowledgeArticleService.getArticleByIdOrSlug(
      req.user.organizationId,
      req.params.id,
      req.user
    );
    res.status(200).json({
      success: true,
      data: article,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Update knowledge article
 * @route   PATCH /api/knowledge-base/:id
 * @access  Private (SYSTEM_ADMIN, IT_MANAGER, TECHNICIAN)
 */
const updateArticle = async (req, res, next) => {
  try {
    const article = await knowledgeArticleService.updateArticle(
      req.user.organizationId,
      req.params.id,
      req.body,
      req.user,
      req
    );
    res.status(200).json({
      success: true,
      data: article,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Publish knowledge article
 * @route   PATCH /api/knowledge-base/:id/publish
 * @access  Private (SYSTEM_ADMIN, IT_MANAGER, TECHNICIAN)
 */
const publishArticle = async (req, res, next) => {
  try {
    const article = await knowledgeArticleService.publishArticle(
      req.user.organizationId,
      req.params.id,
      req.user,
      req
    );
    res.status(200).json({
      success: true,
      data: article,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Archive knowledge article
 * @route   PATCH /api/knowledge-base/:id/archive
 * @access  Private (SYSTEM_ADMIN, IT_MANAGER, TECHNICIAN)
 */
const archiveArticle = async (req, res, next) => {
  try {
    const article = await knowledgeArticleService.archiveArticle(
      req.user.organizationId,
      req.params.id,
      req.user,
      req
    );
    res.status(200).json({
      success: true,
      data: article,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Record review for knowledge article
 * @route   PATCH /api/knowledge-base/:id/review
 * @access  Private (SYSTEM_ADMIN, IT_MANAGER, TECHNICIAN)
 */
const reviewArticle = async (req, res, next) => {
  try {
    const article = await knowledgeArticleService.reviewArticle(
      req.user.organizationId,
      req.params.id,
      req.user,
      req
    );
    res.status(200).json({
      success: true,
      data: article,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Submit helpful/not helpful feedback vote for knowledge article
 * @route   POST /api/knowledge-base/:id/feedback
 * @access  Private (All authenticated users)
 */
const voteFeedback = async (req, res, next) => {
  try {
    const result = await knowledgeArticleService.voteFeedback(
      req.user.organizationId,
      req.params.id,
      req.body,
      req.user
    );
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Delete knowledge article
 * @route   DELETE /api/knowledge-base/:id
 * @access  Private (SYSTEM_ADMIN, IT_MANAGER)
 */
const deleteArticle = async (req, res, next) => {
  try {
    const result = await knowledgeArticleService.deleteArticle(
      req.user.organizationId,
      req.params.id,
      req.user,
      req
    );
    res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createArticle,
  getArticles,
  getArticleByIdOrSlug,
  updateArticle,
  publishArticle,
  archiveArticle,
  reviewArticle,
  voteFeedback,
  deleteArticle,
};
