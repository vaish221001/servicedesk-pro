const express = require('express');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const { upload } = require('../utils/fileStorage');
const {
  createTicket,
  getTickets,
  getTicketById,
  updateTicket,
  assignTicket,
  changeTicketStatus,
  linkAsset,
} = require('../controllers/ticketController');
const {
  addComment,
  getComments,
  getActivityFeed,
  downloadAttachment,
} = require('../controllers/commentController');
const {
  createWorkLog,
  getWorkLogs,
  updateWorkLog,
  deleteWorkLog,
} = require('../controllers/workLogController');

const router = express.Router();

// All ticket routes require authentication
router.use(auth);

// Ticket CRUD & Listing
router.post('/', createTicket);
router.get('/', getTickets);
router.get('/:id', getTicketById);
router.patch('/:id', updateTicket);

// Assignment (Restricted to technicians, managers, and admins)
router.patch(
  '/:id/assign',
  authorize('TECHNICIAN', 'IT_MANAGER', 'SYSTEM_ADMIN'),
  assignTicket
);

// Status transition
router.patch('/:id/status', changeTicketStatus);

// Link Asset to Ticket
router.patch('/:id/asset', linkAsset);

// Comments and Conversation Thread
router.post('/:id/comments', upload.array('attachments', 5), addComment);
router.get('/:id/comments', getComments);

// Chronological Activity Feed
router.get('/:id/activity', getActivityFeed);

// Secure Attachment Download
router.get('/:id/attachments/:filename', downloadAttachment);

// Work Logs (Restricted to technicians, managers, and admins)
router.post(
  '/:id/work-logs',
  authorize('TECHNICIAN', 'IT_MANAGER', 'SYSTEM_ADMIN'),
  createWorkLog
);
router.get(
  '/:id/work-logs',
  authorize('TECHNICIAN', 'IT_MANAGER', 'SYSTEM_ADMIN'),
  getWorkLogs
);
router.patch(
  '/:id/work-logs/:workLogId',
  authorize('TECHNICIAN', 'IT_MANAGER', 'SYSTEM_ADMIN'),
  updateWorkLog
);
router.delete(
  '/:id/work-logs/:workLogId',
  authorize('TECHNICIAN', 'IT_MANAGER', 'SYSTEM_ADMIN'),
  deleteWorkLog
);

module.exports = router;
