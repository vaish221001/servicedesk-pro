const mongoose = require('mongoose');

const attachmentSchema = new mongoose.Schema(
  {
    fileName: {
      type: String,
      required: [true, 'Attachment file name is required'],
      trim: true,
    },
    fileUrl: {
      type: String,
      required: [true, 'Attachment file URL is required'],
      trim: true,
    },
    fileSize: {
      type: Number,
      required: [true, 'Attachment file size is required'],
      min: [0, 'File size cannot be negative'],
    },
    mimeType: {
      type: String,
      required: [true, 'Attachment MIME type is required'],
      trim: true,
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const ticketCommentSchema = new mongoose.Schema(
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
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Author ID is required'],
    },
    content: {
      type: String,
      required: [true, 'Comment content is required'],
      trim: true,
    },
    isInternal: {
      type: Boolean,
      default: false,
    },
    attachments: {
      type: [attachmentSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// Index to retrieve the chronological conversation thread for a ticket
ticketCommentSchema.index({ ticketId: 1, createdAt: 1 });

const TicketComment = mongoose.model('TicketComment', ticketCommentSchema);

module.exports = TicketComment;
