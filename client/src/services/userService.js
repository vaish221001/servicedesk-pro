import api from './apiClient.js';

/**
 * ServiceDesk Pro — User Management Service
 *
 * Provides API client methods for administrative user listing, creation,
 * profile updating, password resets, and account status toggling.
 */
export const userService = {
  /**
   * Retrieves paginated, searched, and filtered users.
   */
  getUsers: async (params = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        query.append(key, val);
      }
    });
    const queryString = query.toString() ? `?${query.toString()}` : '';
    return api.get(`/users${queryString}`);
  },

  /**
   * Retrieves a single user by ID.
   */
  getUserById: async (userId) => {
    return api.get(`/users/${userId}`);
  },

  /**
   * Creates a new user record.
   */
  createUser: async (userData) => {
    return api.post('/users', userData);
  },

  /**
   * Updates an existing user's details, role, department, or password.
   */
  updateUser: async (userId, updateData) => {
    return api.patch(`/users/${userId}`, updateData);
  },

  /**
   * Activates or deactivates a user account.
   */
  setUserStatus: async (userId, isActive) => {
    return api.patch(`/users/${userId}/status`, { isActive });
  },

  /**
   * Retrieves organization departments for user form dropdowns.
   */
  getDepartments: async () => {
    const res = await api.get('/users/departments');
    return Array.isArray(res) ? res : res?.data || [];
  },
};

export default userService;
