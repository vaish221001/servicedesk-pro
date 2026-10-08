const mongoose = require('mongoose');

const assetAssignmentSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Organization ID is required'],
    },
    assetId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Asset',
      required: [true, 'Asset ID is required'],
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Assigned-to user ID is required'],
    },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Assigned-by user ID is required'],
    },
    assignedAt: {
      type: Date,
      default: Date.now,
    },
    returnedAt: {
      type: Date,
      default: null,
    },
    returnCondition: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
assetAssignmentSchema.index({ organizationId: 1, assetId: 1, assignedAt: -1 });
assetAssignmentSchema.index({ organizationId: 1, assignedTo: 1, returnedAt: 1 });

const AssetAssignment = mongoose.model('AssetAssignment', assetAssignmentSchema);

module.exports = AssetAssignment;
