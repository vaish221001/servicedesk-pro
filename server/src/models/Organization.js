const mongoose = require('mongoose');

const organizationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Organization name is required'],
      trim: true,
    },
    slug: {
      type: String,
      required: [true, 'Organization slug is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    domain: {
      type: String,
      trim: true,
      lowercase: true,
    },
    contactEmail: {
      type: String,
      required: [true, 'Contact email is required'],
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid contact email address'],
    },
    phone: {
      type: String,
      trim: true,
    },
    timezone: {
      type: String,
      default: 'UTC',
      trim: true,
    },
    businessHours: {
      start: {
        type: String,
        default: '09:00',
      },
      end: {
        type: String,
        default: '18:00',
      },
      workingDays: {
        type: [Number],
        default: [1, 2, 3, 4, 5],
        validate: {
          validator: function (days) {
            return (
              Array.isArray(days) &&
              days.every((d) => Number.isInteger(d) && d >= 0 && d <= 6)
            );
          },
          message: 'Working days must be integers between 0 (Sunday) and 6 (Saturday)',
        },
      },
    },
    defaultSlaPolicyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SlaPolicy',
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
organizationSchema.index({ domain: 1 }, { sparse: true });

const Organization = mongoose.model('Organization', organizationSchema);

module.exports = Organization;
