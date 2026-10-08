const mongoose = require('mongoose');

const aiMetadataSchema = new mongoose.Schema(
  {
    predictedCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
    },
    predictedPriority: {
      type: String,
      enum: {
        values: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
        message: '{VALUE} is not a valid priority',
      },
      default: null,
    },
    probableIssue: {
      type: String,
      trim: true,
      default: null,
    },
    confidence: {
      type: Number,
      min: [0, 'Confidence must be at least 0'],
      max: [1, 'Confidence cannot exceed 1'],
      default: null,
    },
    suggestedKnowledgeArticles: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'KnowledgeArticle',
      },
    ],
    model: {
      type: String,
      trim: true,
      default: null,
    },
    processedAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false }
);

const ticketSchema = new mongoose.Schema(
  {
    // Basic Information
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Organization ID is required'],
    },
    ticketNumber: {
      type: String,
      required: [true, 'Ticket number is required'],
      trim: true,
    },
    title: {
      type: String,
      required: [true, 'Ticket title is required'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Ticket description is required'],
      trim: true,
    },

    // Requester, Department, Category
    requesterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Requester ID is required'],
    },
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      required: [true, 'Department ID is required'],
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Category ID is required'],
    },
    subcategoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
    },

    // Priority and Status
    priority: {
      type: String,
      required: [true, 'Priority is required'],
      enum: {
        values: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
        message: '{VALUE} is not a valid priority',
      },
      default: 'MEDIUM',
    },
    status: {
      type: String,
      required: [true, 'Status is required'],
      enum: {
        values: [
          'OPEN',
          'ASSIGNED',
          'IN_PROGRESS',
          'PENDING',
          'RESOLVED',
          'CLOSED',
        ],
        message: '{VALUE} is not a valid status',
      },
      default: 'OPEN',
    },

    // Assignment
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    assignedAt: {
      type: Date,
      default: null,
    },

    // Related Asset
    relatedAssetId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Asset',
      default: null,
    },

    // Ticket Channel
    channel: {
      type: String,
      enum: {
        values: ['PORTAL', 'EMAIL', 'PHONE', 'CHAT'],
        message: '{VALUE} is not a valid channel',
      },
      default: 'PORTAL',
    },

    // SLA Fields
    slaPolicyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SlaPolicy',
      default: null,
    },
    responseDue: {
      type: Date,
      default: null,
    },
    resolutionDue: {
      type: Date,
      default: null,
    },
    firstRespondedAt: {
      type: Date,
      default: null,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    closedAt: {
      type: Date,
      default: null,
    },
    isResponseBreached: {
      type: Boolean,
      default: false,
    },
    isResolutionBreached: {
      type: Boolean,
      default: false,
    },
    escalationLevel: {
      type: Number,
      enum: {
        values: [0, 1, 2, 3],
        message:
          '{VALUE} is not a valid escalation level (0=NORMAL, 1=APPROACHING_BREACH, 2=BREACHED, 3=SEVERE_ESCALATION)',
      },
      default: 0,
    },

    // Pending SLA Tracking
    slaPausedAt: {
      type: Date,
      default: null,
    },
    totalSlaPausedMinutes: {
      type: Number,
      default: 0,
      min: [0, 'Total SLA paused minutes cannot be negative'],
    },

    // Resolution
    resolutionNotes: {
      type: String,
      trim: true,
      default: null,
    },
    rootCause: {
      type: String,
      trim: true,
      default: null,
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    // Reopening
    reopenedCount: {
      type: Number,
      default: 0,
      min: [0, 'Reopened count cannot be negative'],
    },
    lastReopenedAt: {
      type: Date,
      default: null,
    },
    lastReopenedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reopenReason: {
      type: String,
      trim: true,
      default: null,
    },

    // Tags
    tags: [
      {
        type: String,
        trim: true,
      },
    ],

    // AI Metadata
    aiMetadata: {
      type: aiMetadataSchema,
      default: () => ({}),
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
ticketSchema.index({ organizationId: 1, status: 1, priority: 1 });
ticketSchema.index({ organizationId: 1, assignedTo: 1, status: 1 });
ticketSchema.index({ organizationId: 1, departmentId: 1, status: 1 });
ticketSchema.index({ organizationId: 1, requesterId: 1, createdAt: -1 });
ticketSchema.index({ organizationId: 1, ticketNumber: 1 }, { unique: true });
ticketSchema.index({ resolutionDue: 1, status: 1 });

const Ticket = mongoose.model('Ticket', ticketSchema);

module.exports = Ticket;
