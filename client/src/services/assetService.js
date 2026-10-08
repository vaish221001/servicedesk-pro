import api from './apiClient.js';

/**
 * ServiceDesk Pro — Asset & Vendor Management Service
 */
export const assetService = {
  /**
   * Fetches paginated and filtered assets.
   */
  getAssets: async (params = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        query.append(key, val);
      }
    });
    const queryString = query.toString() ? `?${query.toString()}` : '';
    return api.get(`/assets${queryString}`);
  },

  /**
   * Retrieves single asset by ID with populated details.
   */
  getAssetById: async (assetId) => {
    return api.get(`/assets/${assetId}`);
  },

  /**
   * Creates a new asset.
   */
  createAsset: async (assetData) => {
    return api.post('/assets', assetData);
  },

  /**
   * Updates an existing asset.
   */
  updateAsset: async (assetId, updateData) => {
    return api.patch(`/assets/${assetId}`, updateData);
  },

  /**
   * Deactivates/soft-deletes an asset.
   */
  deleteAsset: async (assetId) => {
    return api.delete(`/assets/${assetId}`);
  },

  /**
   * Check out / assign asset to a user.
   */
  assignAsset: async (assetId, { assignedTo, departmentId, notes }) => {
    return api.post(`/assets/${assetId}/assign`, { assignedTo, departmentId, notes });
  },

  /**
   * Check in / return asset back to inventory.
   */
  returnAsset: async (assetId, { returnCondition = 'GOOD', notes }) => {
    return api.post(`/assets/${assetId}/return`, { returnCondition, notes });
  },

  /**
   * Retrieves historical assignments for an asset.
   */
  getAssetAssignments: async (assetId) => {
    return api.get(`/assets/${assetId}/assignments`);
  },

  // ----------------------------------------------------
  // VENDOR MANAGEMENT
  // ----------------------------------------------------

  /**
   * Fetches paginated and searched vendors.
   */
  getVendors: async (params = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        query.append(key, val);
      }
    });
    const queryString = query.toString() ? `?${query.toString()}` : '';
    return api.get(`/vendors${queryString}`);
  },

  /**
   * Retrieves single vendor by ID.
   */
  getVendorById: async (vendorId) => {
    return api.get(`/vendors/${vendorId}`);
  },

  /**
   * Creates a new vendor.
   */
  createVendor: async (vendorData) => {
    return api.post('/vendors', vendorData);
  },

  /**
   * Updates an existing vendor.
   */
  updateVendor: async (vendorId, updateData) => {
    return api.patch(`/vendors/${vendorId}`, updateData);
  },

  /**
   * Deactivates/soft-deletes a vendor.
   */
  deleteVendor: async (vendorId) => {
    return api.delete(`/vendors/${vendorId}`);
  },

  /**
   * Retrieves assets associated with a specific vendor.
   */
  getVendorAssets: async (vendorId) => {
    return api.get(`/assets?vendorId=${vendorId}`);
  },
};

export default assetService;
