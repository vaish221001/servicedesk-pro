import ticketService from './ticketService.js';
import assetService from './assetService.js';

/**
 * ServiceDesk Pro — Reporting & Analytics Service
 *
 * Aggregates real metrics from backend ticket, SLA, and asset endpoints.
 * Provides CSV export generation and data calculations.
 */
export const reportService = {
  /**
   * Fetches data and computes comprehensive helpdesk & asset KPIs.
   *
   * @param {Object} [filters={}] - Optional filters (dateRange, departmentId, categoryId)
   * @returns {Promise<Object>} Calculated metrics object
   */
  getReportMetrics: async (filters = {}) => {
    // 1. Fetch tickets and assets with high limit for comprehensive reporting
    const [ticketRes, assetRes] = await Promise.all([
      ticketService.getTickets({ limit: 500, ...(filters.departmentId ? { departmentId: filters.departmentId } : {}) }),
      assetService.getAssets({ limit: 500 }),
    ]);

    const rawTickets = ticketRes?.data || [];
    const rawAssets = assetRes?.data || [];

    // 2. Filter tickets by date range if specified
    const now = new Date();
    let startDate = null;
    if (filters.dateRange === '7d') {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (filters.dateRange === '30d') {
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else if (filters.dateRange === '90d') {
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    }

    const tickets = startDate
      ? rawTickets.filter((t) => new Date(t.createdAt) >= startDate)
      : rawTickets;

    // 3. Compute Ticket Status Distribution
    const statusCounts = {
      OPEN: 0,
      ASSIGNED: 0,
      IN_PROGRESS: 0,
      PENDING: 0,
      RESOLVED: 0,
      CLOSED: 0,
    };

    tickets.forEach((t) => {
      if (statusCounts[t.status] !== undefined) {
        statusCounts[t.status]++;
      }
    });

    const activeTicketsCount =
      statusCounts.OPEN + statusCounts.ASSIGNED + statusCounts.IN_PROGRESS + statusCounts.PENDING;
    const resolvedTicketsCount = statusCounts.RESOLVED + statusCounts.CLOSED;

    // 4. Compute Priority Distribution
    const priorityCounts = {
      CRITICAL: 0,
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0,
    };

    tickets.forEach((t) => {
      if (priorityCounts[t.priority] !== undefined) {
        priorityCounts[t.priority]++;
      }
    });

    // 5. Compute SLA Compliance Metrics
    let breachedCount = 0;
    let approachingBreachCount = 0;
    let resolvedWithTimes = 0;
    let totalResolutionHours = 0;

    tickets.forEach((t) => {
      if (t.isResolutionBreached || t.escalationLevel === 2 || t.escalationLevel === 3) {
        breachedCount++;
      } else if (t.escalationLevel === 1) {
        approachingBreachCount++;
      }

      // Resolution Time for resolved/closed tickets
      if (t.resolvedAt && t.createdAt) {
        const created = new Date(t.createdAt).getTime();
        const resolved = new Date(t.resolvedAt).getTime();
        const pausedMs = (t.totalSlaPausedMinutes || 0) * 60 * 1000;
        const netDurationMs = Math.max(0, resolved - created - pausedMs);
        const durationHours = netDurationMs / (1000 * 60 * 60);

        totalResolutionHours += durationHours;
        resolvedWithTimes++;
      }
    });

    const totalTickets = tickets.length;
    const slaComplianceRate =
      totalTickets > 0 ? Math.max(0, Math.round(((totalTickets - breachedCount) / totalTickets) * 100)) : 100;
    const avgResolutionHours =
      resolvedWithTimes > 0 ? (totalResolutionHours / resolvedWithTimes).toFixed(1) : '—';

    // 6. Compute Technician Workload
    const technicianWorkload = {};
    tickets.forEach((t) => {
      if (['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'PENDING'].includes(t.status)) {
        const techName = t.assignedTo
          ? `${t.assignedTo.firstName} ${t.assignedTo.lastName}`
          : 'Unassigned Queue';
        technicianWorkload[techName] = (technicianWorkload[techName] || 0) + 1;
      }
    });

    // 7. Compute Asset Statistics
    const assetStats = {
      total: rawAssets.length,
      inStock: 0,
      assigned: 0,
      inRepair: 0,
      retired: 0,
      totalProcurementCost: 0,
      typeDistribution: {},
    };

    rawAssets.forEach((a) => {
      if (a.status === 'IN_STOCK') assetStats.inStock++;
      if (a.status === 'ASSIGNED') assetStats.assigned++;
      if (a.status === 'IN_REPAIR') assetStats.inRepair++;
      if (a.status === 'RETIRED' || a.status === 'DISPOSED') assetStats.retired++;

      if (a.purchaseCost) {
        assetStats.totalProcurementCost += Number(a.purchaseCost);
      }

      const type = a.assetType || 'OTHER';
      assetStats.typeDistribution[type] = (assetStats.typeDistribution[type] || 0) + 1;
    });

    return {
      totalTickets,
      activeTicketsCount,
      resolvedTicketsCount,
      statusCounts,
      priorityCounts,
      slaComplianceRate,
      breachedCount,
      approachingBreachCount,
      avgResolutionHours,
      technicianWorkload,
      assetStats,
      tickets,
      assets: rawAssets,
    };
  },

  /**
   * Generates and triggers download of a sanitized Tickets CSV report.
   *
   * @param {Array<Object>} tickets - Array of ticket objects
   * @param {string} [filename='service_desk_tickets_report.csv']
   */
  exportTicketsCSV: (tickets, filename = null) => {
    if (!tickets || tickets.length === 0) {
      throw new Error('No ticket records available to export.');
    }

    const headers = [
      'Ticket Number',
      'Subject',
      'Status',
      'Priority',
      'Category',
      'Requester Name',
      'Requester Email',
      'Assignee Name',
      'Created Date',
      'Resolved Date',
      'SLA Resolution Breached',
      'Resolution Notes',
    ];

    const rows = tickets.map((t) => {
      const requester = t.requesterId || t.createdBy;
      const reqName = requester ? `${requester.firstName || ''} ${requester.lastName || ''}`.trim() : 'Unknown';
      const reqEmail = requester?.email || '';
      const assigneeName = t.assignedTo ? `${t.assignedTo.firstName || ''} ${t.assignedTo.lastName || ''}`.trim() : 'Unassigned';

      return [
        t.ticketNumber || '',
        `"${(t.title || '').replace(/"/g, '""')}"`,
        t.status || '',
        t.priority || '',
        t.categoryId?.name ? `"${t.categoryId.name.replace(/"/g, '""')}"` : '',
        `"${reqName.replace(/"/g, '""')}"`,
        reqEmail,
        `"${assigneeName.replace(/"/g, '""')}"`,
        t.createdAt ? new Date(t.createdAt).toISOString() : '',
        t.resolvedAt ? new Date(t.resolvedAt).toISOString() : '',
        t.isResolutionBreached ? 'YES' : 'NO',
        t.resolutionNotes ? `"${t.resolutionNotes.replace(/"/g, '""')}"` : '',
      ];
    });

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');

    if (typeof window !== 'undefined' && typeof document !== 'undefined' && document.createElement) {
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const downloadName = filename || `servicedesk_tickets_${new Date().toISOString().substring(0, 10)}.csv`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = downloadName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }

    return csvContent;
  },

  /**
   * Generates and triggers download of a sanitized Assets CSV report.
   *
   * @param {Array<Object>} assets - Array of asset objects
   * @param {string} [filename='asset_inventory_report.csv']
   * @returns {string} CSV content
   */
  exportAssetsCSV: (assets, filename = null) => {
    if (!assets || assets.length === 0) {
      throw new Error('No asset records available to export.');
    }

    const headers = [
      'Asset Tag',
      'Asset Name',
      'Type',
      'Status',
      'Category',
      'Manufacturer',
      'Model',
      'Serial Number',
      'Location',
      'Assigned Custodian',
      'Purchase Cost',
      'Purchase Date',
      'Warranty Expiry',
    ];

    const rows = assets.map((a) => {
      const custodian = a.currentAssigneeId ? `${a.currentAssigneeId.firstName || ''} ${a.currentAssigneeId.lastName || ''}`.trim() : 'In Stock';
      return [
        a.assetTag || '',
        `"${(a.name || '').replace(/"/g, '""')}"`,
        a.assetType || '',
        a.status || '',
        a.category ? `"${a.category.replace(/"/g, '""')}"` : '',
        a.manufacturer ? `"${a.manufacturer.replace(/"/g, '""')}"` : '',
        a.model ? `"${a.model.replace(/"/g, '""')}"` : '',
        a.serialNumber ? `"${a.serialNumber.replace(/"/g, '""')}"` : '',
        a.location ? `"${a.location.replace(/"/g, '""')}"` : '',
        `"${custodian.replace(/"/g, '""')}"`,
        a.purchaseCost !== null && a.purchaseCost !== undefined ? Number(a.purchaseCost).toFixed(2) : '',
        a.purchaseDate ? new Date(a.purchaseDate).toISOString().substring(0, 10) : '',
        a.warrantyExpiry ? new Date(a.warrantyExpiry).toISOString().substring(0, 10) : '',
      ];
    });

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');

    if (typeof window !== 'undefined' && typeof document !== 'undefined' && document.createElement) {
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const downloadName = filename || `servicedesk_assets_${new Date().toISOString().substring(0, 10)}.csv`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = downloadName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }

    return csvContent;
  },
};

export default reportService;
