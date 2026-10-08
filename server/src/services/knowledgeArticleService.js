const KnowledgeArticle = require('../models/KnowledgeArticle');
const Category = require('../models/Category');
const AppError = require('../utils/AppError');
const { createAuditLog } = require('./auditService');

/**
 * Converts a string to a URL-friendly slug.
 *
 * @param {string} text
 * @returns {string}
 */
const slugify = (text) => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[\s\W-]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

/**
 * Generates an organization-scoped unique slug for a knowledge article.
 *
 * @param {string|import('mongoose').Types.ObjectId} organizationId
 * @param {string} title
 * @param {string|null} preferredSlug
 * @param {string|null} excludeArticleId
 * @returns {Promise<string>}
 */
const generateUniqueSlug = async (organizationId, title, preferredSlug = null, excludeArticleId = null) => {
  let baseSlug = slugify(preferredSlug || title);
  if (!baseSlug) {
    baseSlug = 'article-' + Date.now();
  }

  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const query = { organizationId, slug };
    if (excludeArticleId) {
      query._id = { $ne: excludeArticleId };
    }

    const existing = await KnowledgeArticle.findOne(query).select('_id');
    if (!existing) {
      return slug;
    }

    counter++;
    slug = `${baseSlug}-${counter}`;
  }
};

/**
 * Creates a new knowledge article.
 */
const createArticle = async (organizationId, data, actor, req = null) => {
  const {
    title,
    content,
    summary,
    categoryId,
    tags = [],
    status = 'DRAFT',
    visibility = 'PUBLIC',
    slug: customSlug,
  } = data;

  if (!title || !title.trim()) {
    throw new AppError('Article title is required', 400);
  }
  if (!content || !content.trim()) {
    throw new AppError('Article content is required', 400);
  }
  if (!categoryId) {
    throw new AppError('Category ID is required', 400);
  }

  // 1. Validate Category within same organization
  const category = await Category.findOne({ _id: categoryId, organizationId, isActive: true });
  if (!category) {
    throw new AppError('Invalid category or category belongs to another organization', 400);
  }

  // 2. Validate enum fields
  if (status && !['DRAFT', 'PUBLISHED', 'ARCHIVED'].includes(status)) {
    throw new AppError('Invalid article status', 400);
  }
  if (visibility && !['PUBLIC', 'INTERNAL_ONLY'].includes(visibility)) {
    throw new AppError('Invalid article visibility', 400);
  }

  // 3. Generate unique slug
  const slug = await generateUniqueSlug(organizationId, title, customSlug);

  const article = await KnowledgeArticle.create({
    organizationId,
    title: title.trim(),
    slug,
    content: content.trim(),
    summary: summary ? summary.trim() : null,
    categoryId,
    tags: Array.isArray(tags) ? tags.map((t) => t.trim()).filter(Boolean) : [],
    authorId: actor._id,
    status,
    visibility,
    lastReviewedAt: status === 'PUBLISHED' ? new Date() : null,
    reviewedBy: status === 'PUBLISHED' ? actor._id : null,
  });

  await createAuditLog({
    organizationId,
    actorType: 'HUMAN',
    actorId: actor._id,
    actorRole: actor.role,
    action: 'ARTICLE_CREATED',
    entityType: 'KNOWLEDGE_ARTICLE',
    entityId: article._id,
    details: { title: article.title, slug: article.slug, status: article.status, visibility: article.visibility },
    req,
  });

  return article;
};

/**
 * Lists knowledge articles with role-based visibility restrictions, filtering, search, and pagination.
 */
const getArticles = async (organizationId, user, query = {}) => {
  const filter = { organizationId };

  // 1. Role-Based Visibility Restrictions
  if (user.role === 'EMPLOYEE' || user.role === 'ASSET_MANAGER') {
    // Non-technical roles can ONLY view PUBLISHED and PUBLIC articles
    filter.status = 'PUBLISHED';
    filter.visibility = 'PUBLIC';
  } else {
    // Non-employees (technicians, managers, admins) can filter status & visibility
    if (query.status) {
      filter.status = query.status;
    }
    if (query.visibility) {
      filter.visibility = query.visibility;
    }
  }

  // 2. Category & Tag Filters
  if (query.categoryId) {
    filter.categoryId = query.categoryId;
  }
  if (query.tag) {
    filter.tags = query.tag.trim();
  }
  if (query.authorId) {
    filter.authorId = query.authorId;
  }

  // 3. Search Filter
  if (query.search) {
    const searchRegex = new RegExp(query.search.trim(), 'i');
    const searchFilter = [
      { title: searchRegex },
      { summary: searchRegex },
      { content: searchRegex },
      { tags: searchRegex },
    ];
    if (filter.$or) {
      filter.$and = [{ $or: filter.$or }, { $or: searchFilter }];
      delete filter.$or;
    } else {
      filter.$or = searchFilter;
    }
  }

  // 4. Pagination
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
  const skip = (page - 1) * limit;

  // 5. Sorting
  const sort = query.sort || '-createdAt';

  const [articles, total] = await Promise.all([
    KnowledgeArticle.find(filter)
      .populate('categoryId', 'name')
      .populate('authorId', 'firstName lastName email')
      .populate('reviewedBy', 'firstName lastName email')
      .select('-content') // Exclude full content from list views for performance
      .sort(sort)
      .skip(skip)
      .limit(limit),
    KnowledgeArticle.countDocuments(filter),
  ]);

  return {
    articles,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};

/**
 * Retrieves a single knowledge article by ID or slug with visibility enforcement and view count increment.
 */
const getArticleByIdOrSlug = async (organizationId, identifier, user) => {
  const isObjectId = /^[0-9a-fA-F]{24}$/.test(identifier);
  const query = { organizationId };

  if (isObjectId) {
    query.$or = [{ _id: identifier }, { slug: identifier }];
  } else {
    query.slug = identifier.toLowerCase().trim();
  }

  const article = await KnowledgeArticle.findOne(query)
    .populate('categoryId', 'name')
    .populate('authorId', 'firstName lastName email')
    .populate('reviewedBy', 'firstName lastName email');

  if (!article) {
    throw new AppError('Knowledge article not found', 404);
  }

  // Visibility Verification
  if (user.role === 'EMPLOYEE' || user.role === 'ASSET_MANAGER') {
    if (article.status !== 'PUBLISHED' || article.visibility !== 'PUBLIC') {
      throw new AppError('You do not have permission to view this article', 403);
    }
  }

  // Increment viewCount atomically
  article.viewCount = (article.viewCount || 0) + 1;
  await article.save();

  return article;
};

/**
 * Updates a knowledge article.
 */
const updateArticle = async (organizationId, articleId, data, actor, req = null) => {
  const article = await KnowledgeArticle.findOne({ _id: articleId, organizationId });
  if (!article) {
    throw new AppError('Knowledge article not found', 404);
  }

  // Author Ownership & Role Check
  if (
    actor.role === 'TECHNICIAN' &&
    article.authorId.toString() !== actor._id.toString()
  ) {
    throw new AppError('Technicians can only update articles they authored', 403);
  }

  const previousSnapshot = {
    title: article.title,
    status: article.status,
    visibility: article.visibility,
    categoryId: article.categoryId,
  };

  if (data.title !== undefined) {
    if (!data.title.trim()) throw new AppError('Article title cannot be empty', 400);
    article.title = data.title.trim();
  }

  if (data.slug !== undefined && data.slug.trim()) {
    article.slug = await generateUniqueSlug(organizationId, article.title, data.slug, article._id);
  }

  if (data.content !== undefined) {
    if (!data.content.trim()) throw new AppError('Article content cannot be empty', 400);
    article.content = data.content.trim();
  }

  if (data.summary !== undefined) {
    article.summary = data.summary?.trim() || null;
  }

  if (data.categoryId !== undefined) {
    const category = await Category.findOne({ _id: data.categoryId, organizationId, isActive: true });
    if (!category) {
      throw new AppError('Invalid category or category belongs to another organization', 400);
    }
    article.categoryId = data.categoryId;
  }

  if (Array.isArray(data.tags)) {
    article.tags = data.tags.map((t) => t.trim()).filter(Boolean);
  }

  if (data.status !== undefined) {
    if (!['DRAFT', 'PUBLISHED', 'ARCHIVED'].includes(data.status)) {
      throw new AppError('Invalid article status', 400);
    }
    article.status = data.status;
  }

  if (data.visibility !== undefined) {
    if (!['PUBLIC', 'INTERNAL_ONLY'].includes(data.visibility)) {
      throw new AppError('Invalid article visibility', 400);
    }
    article.visibility = data.visibility;
  }

  await article.save();

  await createAuditLog({
    organizationId,
    actorType: 'HUMAN',
    actorId: actor._id,
    actorRole: actor.role,
    action: 'ARTICLE_UPDATED',
    entityType: 'KNOWLEDGE_ARTICLE',
    entityId: article._id,
    details: { previous: previousSnapshot, updated: { title: article.title, status: article.status } },
    req,
  });

  return article;
};

/**
 * Publishes a knowledge article.
 */
const publishArticle = async (organizationId, articleId, actor, req = null) => {
  const article = await KnowledgeArticle.findOne({ _id: articleId, organizationId });
  if (!article) {
    throw new AppError('Knowledge article not found', 404);
  }

  if (
    actor.role === 'TECHNICIAN' &&
    article.authorId.toString() !== actor._id.toString()
  ) {
    throw new AppError('Technicians can only publish articles they authored', 403);
  }

  const previousStatus = article.status;
  article.status = 'PUBLISHED';
  article.lastReviewedAt = new Date();
  article.reviewedBy = actor._id;
  await article.save();

  await createAuditLog({
    organizationId,
    actorType: 'HUMAN',
    actorId: actor._id,
    actorRole: actor.role,
    action: 'ARTICLE_PUBLISHED',
    entityType: 'KNOWLEDGE_ARTICLE',
    entityId: article._id,
    details: { previousStatus, status: 'PUBLISHED' },
    req,
  });

  return article;
};

/**
 * Archives a knowledge article.
 */
const archiveArticle = async (organizationId, articleId, actor, req = null) => {
  const article = await KnowledgeArticle.findOne({ _id: articleId, organizationId });
  if (!article) {
    throw new AppError('Knowledge article not found', 404);
  }

  if (
    actor.role === 'TECHNICIAN' &&
    article.authorId.toString() !== actor._id.toString()
  ) {
    throw new AppError('Technicians can only archive articles they authored', 403);
  }

  const previousStatus = article.status;
  article.status = 'ARCHIVED';
  await article.save();

  await createAuditLog({
    organizationId,
    actorType: 'HUMAN',
    actorId: actor._id,
    actorRole: actor.role,
    action: 'ARTICLE_ARCHIVED',
    entityType: 'KNOWLEDGE_ARTICLE',
    entityId: article._id,
    details: { previousStatus, status: 'ARCHIVED' },
    req,
  });

  return article;
};

/**
 * Records a review on an article.
 */
const reviewArticle = async (organizationId, articleId, actor, req = null) => {
  const article = await KnowledgeArticle.findOne({ _id: articleId, organizationId });
  if (!article) {
    throw new AppError('Knowledge article not found', 404);
  }

  article.lastReviewedAt = new Date();
  article.reviewedBy = actor._id;
  await article.save();

  await createAuditLog({
    organizationId,
    actorType: 'HUMAN',
    actorId: actor._id,
    actorRole: actor.role,
    action: 'ARTICLE_REVIEWED',
    entityType: 'KNOWLEDGE_ARTICLE',
    entityId: article._id,
    details: { reviewedAt: article.lastReviewedAt, reviewedBy: actor._id },
    req,
  });

  return article;
};

/**
 * Submits helpfulness feedback for an article (helpful or not helpful).
 */
const voteFeedback = async (organizationId, articleId, voteData, user) => {
  const { vote, helpful } = voteData;

  const article = await KnowledgeArticle.findOne({ _id: articleId, organizationId });
  if (!article) {
    throw new AppError('Knowledge article not found', 404);
  }

  // Employees can only vote on published and public articles
  if (user.role === 'EMPLOYEE') {
    if (article.status !== 'PUBLISHED' || article.visibility !== 'PUBLIC') {
      throw new AppError('You do not have permission to vote on this article', 403);
    }
  }

  let isHelpful = false;
  if (vote !== undefined) {
    if (['helpful', 'HELPFUL', true].includes(vote)) {
      isHelpful = true;
    } else if (['notHelpful', 'NOT_HELPFUL', false].includes(vote)) {
      isHelpful = false;
    } else {
      throw new AppError("Invalid vote value. Must be 'helpful' or 'notHelpful'", 400);
    }
  } else if (helpful !== undefined) {
    isHelpful = !!helpful;
  } else {
    throw new AppError("Feedback vote is required (must provide 'vote' or 'helpful')", 400);
  }

  if (isHelpful) {
    article.helpfulVotes = (article.helpfulVotes || 0) + 1;
  } else {
    article.notHelpfulVotes = (article.notHelpfulVotes || 0) + 1;
  }

  await article.save();

  return {
    helpfulVotes: article.helpfulVotes,
    notHelpfulVotes: article.notHelpfulVotes,
    message: 'Feedback recorded successfully',
  };
};

/**
 * Deletes a knowledge article (system admins and managers only).
 */
const deleteArticle = async (organizationId, articleId, actor, req = null) => {
  const article = await KnowledgeArticle.findOne({ _id: articleId, organizationId });
  if (!article) {
    throw new AppError('Knowledge article not found', 404);
  }

  if (['EMPLOYEE', 'TECHNICIAN'].includes(actor.role)) {
    throw new AppError('Only IT Managers and System Admins can delete knowledge articles', 403);
  }

  await KnowledgeArticle.deleteOne({ _id: articleId, organizationId });

  await createAuditLog({
    organizationId,
    actorType: 'HUMAN',
    actorId: actor._id,
    actorRole: actor.role,
    action: 'ARTICLE_DELETED',
    entityType: 'KNOWLEDGE_ARTICLE',
    entityId: articleId,
    details: { title: article.title, slug: article.slug },
    req,
  });

  return { message: 'Article deleted successfully' };
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
  generateUniqueSlug,
  slugify,
};
