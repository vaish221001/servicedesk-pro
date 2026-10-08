const mongoose = require('mongoose');

const slaTargetSchema = new mongoose.Schema(
  {
    priority: {
      type: String,
      required: [true, 'Target priority is required'],
      enum: {
        values: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
        message: '{VALUE} is not a valid priority',
      },
    },
    responseTimeMinutes: {
      type: Number,
      required: [true, 'Response time in minutes is required'],
      min: [1, 'Response time must be at least 1 minute'],
    },
    resolutionTimeMinutes: {
      type: Number,
      required: [true, 'Resolution time in minutes is required'],
      min: [1, 'Resolution time must be at least 1 minute'],
    },
  },
  { _id: false }
);

const escalationRuleSchema = new mongoose.Schema(
  {
    priority: {
      type: String,
      required: [true, 'Escalation priority is required'],
      enum: {
        values: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
        message: '{VALUE} is not a valid priority',
      },
    },
    triggerStage: {
      type: String,
      required: [true, 'Escalation trigger stage is required'],
      enum: {
        values: [
          'APPROACHING_RESPONSE_BREACH',
          'RESPONSE_BREACHED',
          'APPROACHING_RESOLUTION_BREACH',
          'RESOLUTION_BREACHED',
        ],
        message: '{VALUE} is not a valid trigger stage',
      },
    },
    thresholdPercentage: {
      type: Number,
      default: 80,
      min: [0, 'Threshold percentage cannot be negative'],
      max: [100, 'Threshold percentage cannot exceed 100'],
    },
    notifyRoles: [
      {
        type: String,
        enum: {
          values: ['SYSTEM_ADMIN', 'IT_MANAGER', 'TECHNICIAN'],
          message: '{VALUE} is not a valid notification role',
        },
      },
    ],
    notifyUserIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    action: {
      type: String,
      required: [true, 'Escalation action is required'],
      enum: {
        values: ['NOTIFY', 'REASSIGN', 'ESCALATE_PRIORITY'],
        message: '{VALUE} is not a valid escalation action',
      },
      default: 'NOTIFY',
    },
    reassignToUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { _id: false }
);

const slaPolicySchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Organization ID is required'],
    },
    name: {
      type: String,
      required: [true, 'SLA policy name is required'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    businessHoursOnly: {
      type: Boolean,
      default: true,
    },
    targets: {
      type: [slaTargetSchema],
      required: [true, 'At least one SLA target is required'],
      validate: {
        validator: function (val) {
          return Array.isArray(val) && val.length > 0;
        },
        message: 'SLA policy must have at least one target defined',
      },
    },
    escalationRules: {
      type: [escalationRuleSchema],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
slaPolicySchema.index({ organizationId: 1 });
slaPolicySchema.index({ organizationId: 1, isActive: 1 });
slaPolicySchema.index({ organizationId: 1, isDefault: 1 });

const SlaPolicy = mongoose.model('SlaPolicy', slaPolicySchema);

module.exports = SlaPolicy;
