import api, { getToken } from './apiClient.js';

const API_BASE_URL = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) || '/api';

/**
 * ServiceDesk Pro — Ticket Management Service
 */
export const ticketService = {
  /**
   * Fetches paginated and filtered tickets.
   */
  getTickets: async (params = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        query.append(key, val);
      }
    });
    const queryString = query.toString() ? `?${query.toString()}` : '';
    return api.get(`/tickets${queryString}`);
  },

  /**
   * Retrieves single ticket by ID with populated details.
   */
  getTicketById: async (ticketId) => {
    return api.get(`/tickets/${ticketId}`);
  },

  /**
   * Creates a new ticket.
   */
  createTicket: async (ticketData) => {
    return api.post('/tickets', ticketData);
  },

  /**
   * Updates permitted ticket fields.
   */
  updateTicket: async (ticketId, updateData) => {
    return api.patch(`/tickets/${ticketId}`, updateData);
  },

  /**
   * Assigns or reassigns a ticket.
   */
  assignTicket: async (ticketId, assignedTo) => {
    return api.patch(`/tickets/${ticketId}/assign`, { assignedTo });
  },

  /**
   * Advances ticket lifecycle status.
   */
  changeTicketStatus: async (ticketId, statusData) => {
    return api.patch(`/tickets/${ticketId}/status`, statusData);
  },

  /**
   * Links or unlinks an authorized asset to a ticket.
   */
  linkAsset: async (ticketId, assetId) => {
    return api.patch(`/tickets/${ticketId}/asset`, { assetId });
  },

  /**
   * Retrieves comments thread for a ticket.
   */
  getComments: async (ticketId) => {
    return api.get(`/tickets/${ticketId}/comments`);
  },

  /**
   * Submits a public comment or internal note with optional attachments.
   */
  addComment: async (ticketId, formData) => {
    return api.post(`/tickets/${ticketId}/comments`, formData);
  },

  /**
   * Retrieves chronological activity feed for a ticket.
   */
  getActivityFeed: async (ticketId) => {
    return api.get(`/tickets/${ticketId}/activity`);
  },

  /**
   * Retrieves work logs for a ticket (technicians/managers/admins only).
   */
  getWorkLogs: async (ticketId) => {
    return api.get(`/tickets/${ticketId}/work-logs`);
  },

  /**
   * Records a work log entry on a ticket.
   */
  createWorkLog: async (ticketId, data) => {
    return api.post(`/tickets/${ticketId}/work-logs`, data);
  },

  /**
   * Deletes a work log entry.
   */
  deleteWorkLog: async (ticketId, workLogId) => {
    return api.delete(`/tickets/${ticketId}/work-logs/${workLogId}`);
  },

  /**
   * Retrieves organization categories for dropdowns.
   */
  getCategories: async (params = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        query.append(key, val);
      }
    });
    const queryString = query.toString() ? `?${query.toString()}` : '';
    return api.get(`/categories${queryString}`);
  },

  /**
   * Retrieves organization or user assets for linking.
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
   * Downloads a ticket attachment securely with Bearer token authentication.
   */
  downloadAttachment: async (ticketId, filename, originalName) => {
    const token = getToken();
    const cleanBase = API_BASE_URL.replace(/\/+$/, '');
    const url = `${cleanBase}/tickets/${ticketId}/attachments/${encodeURIComponent(filename)}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    if (!response.ok) {
      let errMsg = 'Failed to download attachment';
      try {
        const errJson = await response.json();
        if (errJson && errJson.message) errMsg = errJson.message;
      } catch {
        // ignore json parse error
      }
      throw new Error(errMsg);
    }

    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = originalName || filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(downloadUrl);
  },
};

export default ticketService;
