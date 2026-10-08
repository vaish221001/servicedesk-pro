const mongoose = require('mongoose');

const assetSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Organization ID is required'],
    },
    assetTag: {
      type: String,
      required: [true, 'Asset tag is required'],
      trim: true,
      uppercase: true,
    },
    name: {
      type: String,
      required: [true, 'Asset name is required'],
      trim: true,
    },
    assetType: {
      type: String,
      required: [true, 'Asset type is required'],
      enum: {
        values: ['HARDWARE', 'SOFTWARE', 'NETWORK', 'PERIPHERAL', 'OTHER'],
        message: '{VALUE} is not a valid asset type',
      },
    },
    category: {
      type: String,
      trim: true,
    },
    manufacturer: {
      type: String,
      trim: true,
    },
    model: {
      type: String,
      trim: true,
    },
    serialNumber: {
      type: String,
      trim: true,
    },
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vendor',
      default: null,
    },
    purchaseDate: {
      type: Date,
      default: null,
    },
    purchaseCost: {
      type: Number,
      min: [0, 'Purchase cost cannot be negative'],
      default: null,
    },
    warrantyExpiry: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      required: [true, 'Asset status is required'],
      enum: {
        values: [
          'IN_STOCK',
          'ASSIGNED',
          'IN_REPAIR',
          'RETIRED',
          'LOST',
          'DISPOSED',
        ],
        message: '{VALUE} is not a valid asset status',
      },
      default: 'IN_STOCK',
    },
    location: {
      type: String,
      trim: true,
    },
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      default: null,
    },
    currentAssigneeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    specifications: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    notes: {
      type: String,
      trim: true,
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
assetSchema.index({ organizationId: 1, assetTag: 1 }, { unique: true });
assetSchema.index({ organizationId: 1, assetType: 1, status: 1 });
assetSchema.index({ organizationId: 1, departmentId: 1, status: 1 });
assetSchema.index({ organizationId: 1, currentAssigneeId: 1 });

const Asset = mongoose.model('Asset', assetSchema);

module.exports = Asset;
