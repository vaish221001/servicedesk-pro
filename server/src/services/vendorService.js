const Vendor = require('../models/Vendor');
const AppError = require('../utils/AppError');
const { createAuditLog } = require('./auditService');

/**
 * Creates a new vendor.
 */
const createVendor = async (organizationId, data, actor, req = null) => {
  const { name, contactPerson, email, phone, website, address, notes, isActive = true } = data;

  if (!name || !name.trim()) {
    throw new AppError('Vendor name is required', 400);
  }

  const vendor = await Vendor.create({
    organizationId,
    name: name.trim(),
    contactPerson: contactPerson ? contactPerson.trim() : null,
    email: email ? email.toLowerCase().trim() : null,
    phone: phone ? phone.trim() : null,
    website: website ? website.trim() : null,
    address: address ? address.trim() : null,
    notes: notes ? notes.trim() : null,
    isActive,
  });

  await createAuditLog({
    organizationId,
    actorType: 'HUMAN',
    actorId: actor._id,
    actorRole: actor.role,
    action: 'VENDOR_CREATED',
    entityType: 'VENDOR',
    entityId: vendor._id,
    details: { name: vendor.name },
    req,
  });

  return vendor;
};

/**
 * Lists vendors with search and pagination.
 */
const getVendors = async (organizationId, query = {}) => {
  const filter = { organizationId };

  if (query.isActive !== undefined) {
    filter.isActive = query.isActive === 'true' || query.isActive === true;
  }

  if (query.search) {
    const searchRegex = new RegExp(query.search.trim(), 'i');
    filter.$or = [
      { name: searchRegex },
      { contactPerson: searchRegex },
      { email: searchRegex },
    ];
  }

  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
  const skip = (page - 1) * limit;

  const [vendors, total] = await Promise.all([
    Vendor.find(filter).sort({ name: 1 }).skip(skip).limit(limit),
    Vendor.countDocuments(filter),
  ]);

  return {
    vendors,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};

/**
 * Gets vendor by ID.
 */
const getVendorById = async (organizationId, vendorId) => {
  const vendor = await Vendor.findOne({ _id: vendorId, organizationId });
  if (!vendor) {
    throw new AppError('Vendor not found', 404);
  }
  return vendor;
};

/**
 * Updates a vendor.
 */
const updateVendor = async (organizationId, vendorId, data, actor, req = null) => {
  const vendor = await Vendor.findOne({ _id: vendorId, organizationId });
  if (!vendor) {
    throw new AppError('Vendor not found', 404);
  }

  const previousSnapshot = { name: vendor.name, isActive: vendor.isActive };

  if (data.name !== undefined) {
    if (!data.name.trim()) throw new AppError('Vendor name cannot be empty', 400);
    vendor.name = data.name.trim();
  }
  if (data.contactPerson !== undefined) vendor.contactPerson = data.contactPerson?.trim() || null;
  if (data.email !== undefined) vendor.email = data.email?.toLowerCase().trim() || null;
  if (data.phone !== undefined) vendor.phone = data.phone?.trim() || null;
  if (data.website !== undefined) vendor.website = data.website?.trim() || null;
  if (data.address !== undefined) vendor.address = data.address?.trim() || null;
  if (data.notes !== undefined) vendor.notes = data.notes?.trim() || null;
  if (data.isActive !== undefined) vendor.isActive = !!data.isActive;

  await vendor.save();

  await createAuditLog({
    organizationId,
    actorType: 'HUMAN',
    actorId: actor._id,
    actorRole: actor.role,
    action: 'VENDOR_UPDATED',
    entityType: 'VENDOR',
    entityId: vendor._id,
    details: { previous: previousSnapshot, updated: { name: vendor.name, isActive: vendor.isActive } },
    req,
  });

  return vendor;
};

/**
 * Deactivates or removes a vendor.
 */
const deleteVendor = async (organizationId, vendorId, actor, req = null) => {
  const vendor = await Vendor.findOne({ _id: vendorId, organizationId });
  if (!vendor) {
    throw new AppError('Vendor not found', 404);
  }

  vendor.isActive = false;
  await vendor.save();

  await createAuditLog({
    organizationId,
    actorType: 'HUMAN',
    actorId: actor._id,
    actorRole: actor.role,
    action: 'VENDOR_DELETED',
    entityType: 'VENDOR',
    entityId: vendor._id,
    details: { name: vendor.name, softDeleted: true },
    req,
  });

  return { message: 'Vendor deactivated successfully' };
};

module.exports = {
  createVendor,
  getVendors,
  getVendorById,
  updateVendor,
  deleteVendor,
};
