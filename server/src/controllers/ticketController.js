const ticketService = require('../services/ticketService');

/**
 * @desc    Create a new ticket
 * @route   POST /api/tickets
 * @access  Private (All authenticated users)
 */
const createTicket = async (req, res, next) => {
  try {
    const ticket = await ticketService.createTicket(
      req.user.organizationId,
      req.body,
      req.user,
      req
    );
    res.status(201).json({
      success: true,
      data: ticket,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    List tickets with filters and pagination
 * @route   GET /api/tickets
 * @access  Private (Role-scoped access)
 */
const getTickets = async (req, res, next) => {
  try {
    const result = await ticketService.getTickets(
      req.user.organizationId,
      req.user,
      req.query
    );
    res.status(200).json({
      success: true,
      data: result.tickets,
      pagination: result.pagination,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Get ticket by ID
 * @route   GET /api/tickets/:id
 * @access  Private (Role-scoped access)
 */
const getTicketById = async (req, res, next) => {
  try {
    const ticket = await ticketService.getTicketById(
      req.user.organizationId,
      req.params.id,
      req.user
    );
    res.status(200).json({
      success: true,
      data: ticket,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Update ticket fields
 * @route   PATCH /api/tickets/:id
 * @access  Private (Role-permitted fields)
 */
const updateTicket = async (req, res, next) => {
  try {
    const ticket = await ticketService.updateTicket(
      req.user.organizationId,
      req.params.id,
      req.body,
      req.user,
      req
    );
    res.status(200).json({
      success: true,
      data: ticket,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Assign or reassign a ticket
 * @route   PATCH /api/tickets/:id/assign
 * @access  Private (TECHNICIAN, IT_MANAGER, SYSTEM_ADMIN)
 */
const assignTicket = async (req, res, next) => {
  try {
    const ticket = await ticketService.assignTicket(
      req.user.organizationId,
      req.params.id,
      req.body.assignedTo,
      req.user,
      req
    );
    res.status(200).json({
      success: true,
      data: ticket,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Change ticket lifecycle status
 * @route   PATCH /api/tickets/:id/status
 * @access  Private (Role-scoped transition)
 */
const changeTicketStatus = async (req, res, next) => {
  try {
    const ticket = await ticketService.changeTicketStatus(
      req.user.organizationId,
      req.params.id,
      req.body,
      req.user,
      req
    );
    res.status(200).json({
      success: true,
      data: ticket,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Link asset to ticket
 * @route   PATCH /api/tickets/:id/asset
 * @access  Private (Role-scoped access)
 */
const linkAsset = async (req, res, next) => {
  try {
    const ticket = await ticketService.linkAssetToTicket(
      req.user.organizationId,
      req.params.id,
      req.body.assetId,
      req.user,
      req
    );
    res.status(200).json({
      success: true,
      data: ticket,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createTicket,
  getTickets,
  getTicketById,
  updateTicket,
  assignTicket,
  changeTicketStatus,
  linkAsset,
};
