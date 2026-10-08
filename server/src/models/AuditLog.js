const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Organization ID is required'],
    },
    actorType: {
      type: String,
      required: [true, 'Actor type is required'],
      enum: {
        values: ['HUMAN', 'SYSTEM'],
        message: '{VALUE} is not a valid actor type',
      },
      default: 'HUMAN',
    },
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    actorRole: {
      type: String,
      trim: true,
      default: 'SYSTEM',
    },
    action: {
      type: String,
      required: [true, 'Action is required'],
      trim: true,
    },
    entityType: {
      type: String,
      required: [true, 'Entity type is required'],
      enum: {
        values: [
          'USER',
          'TICKET',
          'ASSET',
          'SLA_POLICY',
          'DEPARTMENT',
          'CATEGORY',
          'VENDOR',
          'KB_ARTICLE',
        ],
        message: '{VALUE} is not a valid entity type',
      },
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, 'Entity ID is required'],
    },
    ipAddress: {
      type: String,
      trim: true,
      default: null,
    },
    userAgent: {
      type: String,
      trim: true,
      default: null,
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      immutable: true,
    },
  },
  {
    timestamps: false,
  }
);

// Indexes
auditLogSchema.index({ organizationId: 1, entityType: 1, entityId: 1, timestamp: -1 });
auditLogSchema.index({ organizationId: 1, actorId: 1, timestamp: -1 });
auditLogSchema.index({ organizationId: 1, timestamp: -1 });

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

module.exports = AuditLog;
