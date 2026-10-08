const mongoose = require('mongoose');

const knowledgeArticleSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Organization ID is required'],
    },
    title: {
      type: String,
      required: [true, 'Article title is required'],
      trim: true,
    },
    slug: {
      type: String,
      required: [true, 'Article slug is required'],
      lowercase: true,
      trim: true,
    },
    content: {
      type: String,
      required: [true, 'Article content is required'],
    },
    summary: {
      type: String,
      trim: true,
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Category ID is required'],
    },
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Author ID is required'],
    },
    status: {
      type: String,
      required: [true, 'Status is required'],
      enum: {
        values: ['DRAFT', 'PUBLISHED', 'ARCHIVED'],
        message: '{VALUE} is not a valid article status',
      },
      default: 'DRAFT',
    },
    visibility: {
      type: String,
      required: [true, 'Visibility is required'],
      enum: {
        values: ['PUBLIC', 'INTERNAL_ONLY'],
        message: '{VALUE} is not a valid visibility setting',
      },
      default: 'PUBLIC',
    },
    viewCount: {
      type: Number,
      default: 0,
      min: [0, 'View count cannot be negative'],
    },
    helpfulVotes: {
      type: Number,
      default: 0,
      min: [0, 'Helpful votes cannot be negative'],
    },
    notHelpfulVotes: {
      type: Number,
      default: 0,
      min: [0, 'Not helpful votes cannot be negative'],
    },
    lastReviewedAt: {
      type: Date,
      default: null,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
knowledgeArticleSchema.index({ organizationId: 1, slug: 1 }, { unique: true });
knowledgeArticleSchema.index({ organizationId: 1, status: 1, visibility: 1 });
knowledgeArticleSchema.index({ organizationId: 1, categoryId: 1 });
knowledgeArticleSchema.index({ title: 'text', content: 'text', tags: 'text' });

const KnowledgeArticle = mongoose.model('KnowledgeArticle', knowledgeArticleSchema);

module.exports = KnowledgeArticle;
