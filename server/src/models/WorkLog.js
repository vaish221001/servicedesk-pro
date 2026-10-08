const mongoose = require('mongoose');

const workLogSchema = new mongoose.Schema(
  {
    ticketId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ticket',
      required: [true, 'Ticket ID is required'],
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Organization ID is required'],
    },
    technicianId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Technician ID is required'],
    },
    timeSpentMinutes: {
      type: Number,
      required: [true, 'Time spent in minutes is required'],
      min: [1, 'Time spent must be at least 1 minute'],
    },
    workDate: {
      type: Date,
      required: [true, 'Work date is required'],
      default: Date.now,
    },
    description: {
      type: String,
      required: [true, 'Work description is required'],
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index to retrieve a ticket's work log history efficiently
workLogSchema.index({ ticketId: 1, createdAt: -1 });

const WorkLog = mongoose.model('WorkLog', workLogSchema);

module.exports = WorkLog;
