const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Organization ID is required'],
    },
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      required: [true, 'Department ID is required'],
    },
    name: {
      type: String,
      required: [true, 'Category name is required'],
      trim: true,
    },
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
    },
    defaultPriority: {
      type: String,
      enum: {
        values: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
        message: '{VALUE} is not a valid priority',
      },
      default: 'MEDIUM',
    },
    defaultSlaPolicyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SlaPolicy',
      default: null,
    },
    defaultAssigneeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
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
// Cross-document constraints (e.g., verifying parentId belongs to the same organization and department)
// are enforced at the service/controller layer rather than in schema validation.
categorySchema.index({ organizationId: 1, departmentId: 1 });
categorySchema.index({ organizationId: 1, parentId: 1 });
categorySchema.index({ organizationId: 1, name: 1 });

const Category = mongoose.model('Category', categorySchema);

module.exports = Category;
