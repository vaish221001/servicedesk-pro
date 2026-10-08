const Asset = require('../models/Asset');
const AssetAssignment = require('../models/AssetAssignment');
const Vendor = require('../models/Vendor');
const Department = require('../models/Department');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const { createAuditLog } = require('./auditService');
const { createNotification } = require('./notificationService');

/**
 * Creates a new asset.
 */
const createAsset = async (organizationId, data, actor, req = null) => {
  const {
    assetTag,
    name,
    assetType,
    category,
    manufacturer,
    model,
    serialNumber,
    vendorId = null,
    purchaseDate = null,
    purchaseCost = null,
    warrantyExpiry = null,
    status = 'IN_STOCK',
    location,
    departmentId = null,
    specifications = {},
    notes,
    isActive = true,
  } = data;

  if (!assetTag || !assetTag.trim()) {
    throw new AppError('Asset tag is required', 400);
  }
  if (!name || !name.trim()) {
    throw new AppError('Asset name is required', 400);
  }
  if (!assetType) {
    throw new AppError('Asset type is required', 400);
  }

  // 1. Verify Unique assetTag within organization
  const existingAsset = await Asset.findOne({
    organizationId,
    assetTag: assetTag.trim().toUpperCase(),
  });
  if (existingAsset) {
    throw new AppError(`An asset with tag '${assetTag.toUpperCase()}' already exists in this organization`, 400);
  }

  // 2. Validate Vendor if supplied
  if (vendorId) {
    const vendor = await Vendor.findOne({ _id: vendorId, organizationId, isActive: true });
    if (!vendor) {
      throw new AppError('Invalid vendor or vendor belongs to another organization', 400);
    }
  }

  // 3. Validate Department if supplied
  if (departmentId) {
    const department = await Department.findOne({ _id: departmentId, organizationId, isActive: true });
    if (!department) {
      throw new AppError('Invalid department or department belongs to another organization', 400);
    }
  }

  const asset = await Asset.create({
    organizationId,
    assetTag: assetTag.trim().toUpperCase(),
    name: name.trim(),
    assetType,
    category: category ? category.trim() : null,
    manufacturer: manufacturer ? manufacturer.trim() : null,
    model: model ? model.trim() : null,
    serialNumber: serialNumber ? serialNumber.trim() : null,
    vendorId,
    purchaseDate,
    purchaseCost,
    warrantyExpiry,
    status,
    location: location ? location.trim() : null,
    departmentId,
    currentAssigneeId: null,
    specifications,
    notes: notes ? notes.trim() : null,
    isActive,
  });

  await createAuditLog({
    organizationId,
    actorType: 'HUMAN',
    actorId: actor._id,
    actorRole: actor.role,
    action: 'ASSET_CREATED',
    entityType: 'ASSET',
    entityId: asset._id,
    details: { assetTag: asset.assetTag, name: asset.name, status: asset.status },
    req,
  });

  return asset;
};

/**
 * Lists assets with role-based scoping, filtering, search, and pagination.
 */
const getAssets = async (organizationId, user, query = {}) => {
  const filter = { organizationId };

  // 1. Role-Based Scoping
  if (user.role === 'EMPLOYEE') {
    // Employees can ONLY view assets currently assigned to them
    filter.currentAssigneeId = user._id;
  }

  // 2. Filters
  if (query.status) {
    filter.status = query.status;
  }
  if (query.assetType) {
    filter.assetType = query.assetType;
  }
  if (query.departmentId) {
    filter.departmentId = query.departmentId;
  }
  if (query.vendorId) {
    filter.vendorId = query.vendorId;
  }
  if (query.currentAssigneeId && user.role !== 'EMPLOYEE') {
    filter.currentAssigneeId = query.currentAssigneeId;
  }
  if (query.isActive !== undefined) {
    filter.isActive = query.isActive === 'true' || query.isActive === true;
  }

  // 3. Search (assetTag, name, serialNumber, model)
  if (query.search) {
    const searchRegex = new RegExp(query.search.trim(), 'i');
    filter.$or = [
      { assetTag: searchRegex },
      { name: searchRegex },
      { serialNumber: searchRegex },
      { model: searchRegex },
    ];
  }

  // 4. Pagination
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
  const skip = (page - 1) * limit;

  const [assets, total] = await Promise.all([
    Asset.find(filter)
      .populate('departmentId', 'name code')
      .populate('vendorId', 'name')
      .populate('currentAssigneeId', 'firstName lastName email departmentId')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Asset.countDocuments(filter),
  ]);

  return {
    assets,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};

/**
 * Gets a single asset by ID with employee custody verification.
 */
const getAssetById = async (organizationId, assetId, user) => {
  const asset = await Asset.findOne({ _id: assetId, organizationId })
    .populate('departmentId', 'name code')
    .populate('vendorId', 'name contactPerson email phone')
    .populate('currentAssigneeId', 'firstName lastName email role departmentId');

  if (!asset) {
    throw new AppError('Asset not found', 404);
  }

  // Role Access Verification
  if (user.role === 'EMPLOYEE') {
    const assigneeId = asset.currentAssigneeId?._id || asset.currentAssigneeId;
    if (!assigneeId || assigneeId.toString() !== user._id.toString()) {
      throw new AppError('You do not have permission to view this asset', 403);
    }
  }

  return asset;
};

/**
 * Updates an asset.
 */
const updateAsset = async (organizationId, assetId, data, actor, req = null) => {
  const asset = await Asset.findOne({ _id: assetId, organizationId });
  if (!asset) {
    throw new AppError('Asset not found', 404);
  }

  const previousSnapshot = {
    name: asset.name,
    assetTag: asset.assetTag,
    status: asset.status,
    location: asset.location,
  };

  // Asset Tag Uniqueness Check
  if (data.assetTag && data.assetTag.toUpperCase() !== asset.assetTag) {
    const conflict = await Asset.findOne({
      organizationId,
      assetTag: data.assetTag.toUpperCase().trim(),
    });
    if (conflict) {
      throw new AppError(`Asset tag '${data.assetTag.toUpperCase()}' is already taken`, 400);
    }
    asset.assetTag = data.assetTag.toUpperCase().trim();
  }

  if (data.name !== undefined) asset.name = data.name.trim();
  if (data.assetType !== undefined) asset.assetType = data.assetType;
  if (data.category !== undefined) asset.category = data.category?.trim() || null;
  if (data.manufacturer !== undefined) asset.manufacturer = data.manufacturer?.trim() || null;
  if (data.model !== undefined) asset.model = data.model?.trim() || null;
  if (data.serialNumber !== undefined) asset.serialNumber = data.serialNumber?.trim() || null;
  if (data.location !== undefined) asset.location = data.location?.trim() || null;
  if (data.notes !== undefined) asset.notes = data.notes?.trim() || null;
  if (data.purchaseCost !== undefined) asset.purchaseCost = data.purchaseCost;
  if (data.purchaseDate !== undefined) asset.purchaseDate = data.purchaseDate;
  if (data.warrantyExpiry !== undefined) asset.warrantyExpiry = data.warrantyExpiry;
  if (data.specifications !== undefined) asset.specifications = data.specifications;
  if (data.isActive !== undefined) asset.isActive = !!data.isActive;

  if (data.vendorId !== undefined) {
    if (data.vendorId) {
      const vendor = await Vendor.findOne({ _id: data.vendorId, organizationId, isActive: true });
      if (!vendor) throw new AppError('Invalid vendor or belongs to another organization', 400);
      asset.vendorId = data.vendorId;
    } else {
      asset.vendorId = null;
    }
  }

  if (data.departmentId !== undefined) {
    if (data.departmentId) {
      const dept = await Department.findOne({ _id: data.departmentId, organizationId, isActive: true });
      if (!dept) throw new AppError('Invalid department or belongs to another organization', 400);
      asset.departmentId = data.departmentId;
    } else {
      asset.departmentId = null;
    }
  }

  await asset.save();

  await createAuditLog({
    organizationId,
    actorType: 'HUMAN',
    actorId: actor._id,
    actorRole: actor.role,
    action: 'ASSET_UPDATED',
    entityType: 'ASSET',
    entityId: asset._id,
    details: { previous: previousSnapshot, updated: { name: asset.name, status: asset.status } },
    req,
  });

  return asset;
};

/**
 * Assigns an asset to a user/department (checkout), preventing conflicting active assignments.
 */
const assignAsset = async (organizationId, assetId, data, actor, req = null) => {
  const { assignedTo: targetUserId, departmentId, notes } = data;

  if (!targetUserId) {
    throw new AppError('Target assignee (assignedTo) user ID is required', 400);
  }

  const asset = await Asset.findOne({ _id: assetId, organizationId });
  if (!asset) {
    throw new AppError('Asset not found', 404);
  }

  // 1. Prevent Conflicting Active Assignments
  if (asset.status === 'ASSIGNED' || asset.currentAssigneeId) {
    throw new AppError(
      'Asset is currently assigned to another user. Please return it before reassigning.',
      400
    );
  }

  const activeAssignment = await AssetAssignment.findOne({
    assetId: asset._id,
    organizationId,
    returnedAt: null,
  });
  if (activeAssignment) {
    throw new AppError('Conflicting active assignment detected. Please return the asset first.', 400);
  }

  // 2. Validate Assignee in same organization
  const targetUser = await User.findOne({ _id: targetUserId, organizationId, isActive: true });
  if (!targetUser) {
    throw new AppError('Assignee user not found or inactive in this organization', 400);
  }

  // 3. Resolve & validate department
  const resolvedDeptId = departmentId || targetUser.departmentId;
  if (resolvedDeptId) {
    const dept = await Department.findOne({ _id: resolvedDeptId, organizationId, isActive: true });
    if (!dept) throw new AppError('Invalid department or belongs to another organization', 400);
  }

  // 4. Create immutable AssetAssignment record
  const assignment = await AssetAssignment.create({
    organizationId,
    assetId: asset._id,
    assignedTo: targetUser._id,
    assignedBy: actor._id,
    assignedAt: new Date(),
    returnedAt: null,
    notes: notes ? notes.trim() : null,
  });

  // 5. Update Asset custody fields
  asset.status = 'ASSIGNED';
  asset.currentAssigneeId = targetUser._id;
  asset.departmentId = resolvedDeptId;
  await asset.save();

  // 6. Notify Assignee
  await createNotification({
    organizationId,
    recipientId: targetUser._id,
    senderId: actor._id,
    type: 'ASSET_ASSIGNED',
    title: `Asset Assigned: ${asset.name} (${asset.assetTag})`,
    message: `You have been assigned custody of ${asset.name}.`,
    relatedAssetId: asset._id,
  });

  // 7. Audit Log
  await createAuditLog({
    organizationId,
    actorType: 'HUMAN',
    actorId: actor._id,
    actorRole: actor.role,
    action: 'ASSET_ASSIGNED',
    entityType: 'ASSET',
    entityId: asset._id,
    details: {
      assignmentId: assignment._id,
      assignedTo: targetUser._id,
      assignedToName: `${targetUser.firstName} ${targetUser.lastName}`,
    },
    req,
  });

  return { asset, assignment };
};

/**
 * Returns an asset back to inventory (check-in).
 */
const returnAsset = async (organizationId, assetId, data, actor, req = null) => {
  const { returnCondition = 'GOOD', notes } = data;

  const asset = await Asset.findOne({ _id: assetId, organizationId });
  if (!asset) {
    throw new AppError('Asset not found', 404);
  }

  if (asset.status !== 'ASSIGNED' && !asset.currentAssigneeId) {
    throw new AppError('Asset is not currently assigned and cannot be returned', 400);
  }

  // Find active assignment record
  const assignment = await AssetAssignment.findOne({
    assetId: asset._id,
    organizationId,
    returnedAt: null,
  });

  if (assignment) {
    assignment.returnedAt = new Date();
    assignment.returnCondition = returnCondition;
    if (notes) assignment.notes = notes.trim();
    await assignment.save();
  }

  const previousAssigneeId = asset.currentAssigneeId;
  asset.status = 'IN_STOCK';
  asset.currentAssigneeId = null;
  await asset.save();

  await createAuditLog({
    organizationId,
    actorType: 'HUMAN',
    actorId: actor._id,
    actorRole: actor.role,
    action: 'ASSET_RETURNED',
    entityType: 'ASSET',
    entityId: asset._id,
    details: {
      previousAssigneeId,
      returnCondition,
    },
    req,
  });

  return { asset, assignment };
};

/**
 * Retrieves historical assignments for an asset.
 */
const getAssetAssignments = async (organizationId, assetId, user) => {
  // Validate asset belongs to organization
  await getAssetById(organizationId, assetId, user);

  const assignments = await AssetAssignment.find({ assetId, organizationId })
    .populate('assignedTo', 'firstName lastName email departmentId')
    .populate('assignedBy', 'firstName lastName email role')
    .sort({ assignedAt: -1 });

  return assignments;
};

/**
 * Deactivates an asset.
 */
const deleteAsset = async (organizationId, assetId, actor, req = null) => {
  const asset = await Asset.findOne({ _id: assetId, organizationId });
  if (!asset) {
    throw new AppError('Asset not found', 404);
  }

  if (asset.status === 'ASSIGNED' || asset.currentAssigneeId) {
    throw new AppError('Cannot deactivate an asset that is currently assigned. Return it first.', 400);
  }

  asset.isActive = false;
  asset.status = 'RETIRED';
  await asset.save();

  await createAuditLog({
    organizationId,
    actorType: 'HUMAN',
    actorId: actor._id,
    actorRole: actor.role,
    action: 'ASSET_DELETED',
    entityType: 'ASSET',
    entityId: asset._id,
    details: { assetTag: asset.assetTag, softDeleted: true },
    req,
  });

  return { message: 'Asset deactivated successfully' };
};

module.exports = {
  createAsset,
  getAssets,
  getAssetById,
  updateAsset,
  assignAsset,
  returnAsset,
  getAssetAssignments,
  deleteAsset,
};
