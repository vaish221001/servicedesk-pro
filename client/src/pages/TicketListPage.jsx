import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import ticketService from '../services/ticketService';
import Card, { CardBody } from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import EmptyState from '../components/ui/EmptyState';
import Alert from '../components/ui/Alert';
import CreateTicketModal from '../components/tickets/CreateTicketModal';

import {
  Ticket,
  Search,
  PlusCircle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

export const TicketListPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isEmployee = user?.role === 'EMPLOYEE';

  const [tickets, setTickets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });

  // Filter States
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [sortBy, setSortBy] = useState('-createdAt');

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Load Categories for filter dropdown
  useEffect(() => {
    let ignore = false;
    async function loadCategories() {
      try {
        const catRes = await ticketService.getCategories({ isActive: true });
        if (!ignore && catRes) {
          const list = Array.isArray(catRes) ? catRes : (catRes.data || []);
          setCategories(list.filter((c) => !c.parentId));
        }
      } catch (err) {
        console.error('Failed to load categories for filter:', err);
      }
    }
    loadCategories();
    return () => {
      ignore = true;
    };
  }, []);

  // Fetch Tickets from API when dependencies change
  useEffect(() => {
    let ignore = false;

    async function loadTickets() {
      try {
        const params = {
          page: currentPage,
          limit: 15,
          sort: sortBy,
        };

        if (activeSearch.trim()) params.search = activeSearch.trim();
        if (statusFilter) params.status = statusFilter;
        if (priorityFilter) params.priority = priorityFilter;
        if (categoryFilter) params.categoryId = categoryFilter;

        const res = await ticketService.getTickets(params);
        if (!ignore && res && res.success) {
          setTickets(res.data || []);
          setPagination(
            res.pagination || { page: currentPage, limit: 15, total: res.data?.length || 0, totalPages: 1 }
          );
        }
      } catch (err) {
        if (!ignore) {
          console.error('Failed to fetch tickets:', err);
          setError(err.message || 'Failed to retrieve tickets from server');
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    loadTickets();

    return () => {
      ignore = true;
    };
  }, [currentPage, sortBy, activeSearch, statusFilter, priorityFilter, categoryFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setIsLoading(true);
    setActiveSearch(searchTerm);
    setCurrentPage(1);
  };

  const handleStatusChange = (e) => {
    setIsLoading(true);
    setStatusFilter(e.target.value);
    setCurrentPage(1);
  };

  const handlePriorityChange = (e) => {
    setIsLoading(true);
    setPriorityFilter(e.target.value);
    setCurrentPage(1);
  };

  const handleCategoryChange = (e) => {
    setIsLoading(true);
    setCategoryFilter(e.target.value);
    setCurrentPage(1);
  };

  const handleSortChange = (e) => {
    setIsLoading(true);
    setSortBy(e.target.value);
    setCurrentPage(1);
  };

  const handleResetFilters = () => {
    setIsLoading(true);
    setSearchTerm('');
    setActiveSearch('');
    setStatusFilter('');
    setPriorityFilter('');
    setCategoryFilter('');
    setSortBy('-createdAt');
    setCurrentPage(1);
  };

  const handlePageChange = (newPage) => {
    setIsLoading(true);
    setCurrentPage(newPage);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          padding: '1.25rem 1.5rem',
          backgroundColor: '#ffffff',
          borderRadius: 'var(--radius-xl)',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-xs)',
        }}
      >
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {isEmployee ? 'My Support Requests' : 'Ticket Management Directory'}
          </h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            {isEmployee
              ? 'Track issues, request assistance, and review updates on your submitted tickets'
              : 'Service desk queues, incident triage, and lifecycle status management'}
          </p>
        </div>

        <Button
          variant="primary"
          onClick={() => setIsCreateOpen(true)}
          icon={<PlusCircle size={16} />}
        >
          {isEmployee ? 'Submit New Ticket' : 'Create Ticket'}
        </Button>
      </div>

      {/* Filter Toolbar Card */}
      <Card>
        <CardBody style={{ padding: '1rem 1.25rem' }}>
          <form
            onSubmit={handleSearchSubmit}
            style={{
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.75rem',
            }}
          >
            {/* Search Input */}
            <div style={{ flex: '1 1 240px', position: 'relative' }}>
              <Search
                size={16}
                style={{
                  position: 'absolute',
                  left: '0.75rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--color-slate-400)',
                }}
              />
              <input
                type="text"
                className="form-input"
                placeholder="Search ticket #, title, or keywords..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ paddingLeft: '2.4rem' }}
              />
            </div>

            {/* Status Filter */}
            <div style={{ minWidth: '140px' }}>
              <select
                className="form-input"
                value={statusFilter}
                onChange={handleStatusChange}
              >
                <option value="">All Statuses</option>
                <option value="OPEN">Open</option>
                <option value="ASSIGNED">Assigned</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="PENDING">Pending</option>
                <option value="RESOLVED">Resolved</option>
                <option value="CLOSED">Closed</option>
              </select>
            </div>

            {/* Priority Filter */}
            <div style={{ minWidth: '130px' }}>
              <select
                className="form-input"
                value={priorityFilter}
                onChange={handlePriorityChange}
              >
                <option value="">All Priorities</option>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </div>

            {/* Category Filter */}
            <div style={{ minWidth: '150px' }}>
              <select
                className="form-input"
                value={categoryFilter}
                onChange={handleCategoryChange}
              >
                <option value="">All Categories</option>
                {categories.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Sort Order */}
            <div style={{ minWidth: '150px' }}>
              <select
                className="form-input"
                value={sortBy}
                onChange={handleSortChange}
              >
                <option value="-createdAt">Newest First</option>
                <option value="createdAt">Oldest First</option>
                <option value="-priority">Highest Priority</option>
                <option value="resolutionDue">Resolution Due</option>
              </select>
            </div>

            {/* Reset / Search Actions */}
            <Button type="submit" variant="secondary" size="sm">
              Filter
            </Button>
            {(activeSearch || statusFilter || priorityFilter || categoryFilter || sortBy !== '-createdAt') && (
              <Button type="button" variant="ghost" size="sm" onClick={handleResetFilters}>
                Reset
              </Button>
            )}
          </form>
        </CardBody>
      </Card>

      {/* Main Ticket List Table Card */}
      <Card>
        <CardBody style={{ padding: 0 }}>
          {error && (
            <div style={{ padding: '1rem' }}>
              <Alert variant="error" onClose={() => setError(null)}>
                {error}
              </Alert>
            </div>
          )}

          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '3.5rem 0' }}>
              <LoadingSpinner size="md" color="primary" />
              <p style={{ marginTop: '0.75rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                Loading tickets...
              </p>
            </div>
          ) : tickets.length === 0 ? (
            <EmptyState
              icon={<Ticket size={48} />}
              title="No tickets found"
              description={
                activeSearch || statusFilter || priorityFilter || categoryFilter
                  ? 'No tickets matched your filter criteria. Try clearing filters.'
                  : isEmployee
                  ? "You haven't submitted any support requests yet."
                  : 'There are currently no tickets in the queue.'
              }
              action={
                activeSearch || statusFilter || priorityFilter || categoryFilter ? (
                  <Button variant="secondary" size="sm" onClick={handleResetFilters}>
                    Clear Filters
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setIsCreateOpen(true)}
                    icon={<PlusCircle size={14} />}
                  >
                    Create First Ticket
                  </Button>
                )
              }
            />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)', backgroundColor: 'var(--color-slate-50)' }}>
                    <th style={{ textAlign: 'left', padding: '0.875rem 1rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      Ticket #
                    </th>
                    <th style={{ textAlign: 'left', padding: '0.875rem 1rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      Subject
                    </th>
                    <th style={{ textAlign: 'left', padding: '0.875rem 1rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      Status
                    </th>
                    <th style={{ textAlign: 'left', padding: '0.875rem 1rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      Priority
                    </th>
                    <th style={{ textAlign: 'left', padding: '0.875rem 1rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      Category
                    </th>
                    {!isEmployee && (
                      <th style={{ textAlign: 'left', padding: '0.875rem 1rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                        Requester
                      </th>
                    )}
                    <th style={{ textAlign: 'left', padding: '0.875rem 1rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      Assignee
                    </th>
                    <th style={{ textAlign: 'left', padding: '0.875rem 1rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      Created
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((t) => {
                    const requesterName = t.createdBy
                      ? `${t.createdBy.firstName} ${t.createdBy.lastName}`
                      : 'Unknown';
                    const assigneeName = t.assignedTo
                      ? `${t.assignedTo.firstName} ${t.assignedTo.lastName}`
                      : null;

                    return (
                      <tr
                        key={t._id}
                        onClick={() => navigate(`/tickets/${t._id}`)}
                        style={{
                          borderBottom: '1px solid var(--border-subtle)',
                          cursor: 'pointer',
                          transition: 'background-color var(--transition-fast)',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-slate-50)')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        <td style={{ padding: '0.875rem 1rem', fontWeight: 600, fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', color: 'var(--color-primary-600)' }}>
                          {t.ticketNumber}
                        </td>
                        <td style={{ padding: '0.875rem 1rem', maxWidth: '320px' }}>
                          <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {t.title}
                          </div>
                          {t.tags && t.tags.length > 0 && (
                            <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
                              {t.tags.slice(0, 3).map((tag, i) => (
                                <span
                                  key={i}
                                  style={{
                                    fontSize: '0.7rem',
                                    color: 'var(--text-muted)',
                                    backgroundColor: 'var(--color-slate-100)',
                                    padding: '0.1rem 0.35rem',
                                    borderRadius: 'var(--radius-sm)',
                                  }}
                                >
                                  #{tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '0.875rem 1rem' }}>
                          <Badge variant="status">{t.status}</Badge>
                        </td>
                        <td style={{ padding: '0.875rem 1rem' }}>
                          <Badge variant="priority">{t.priority}</Badge>
                        </td>
                        <td style={{ padding: '0.875rem 1rem', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                          <div>{t.categoryId?.name || '—'}</div>
                          {t.subcategoryId?.name && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {t.subcategoryId.name}
                            </div>
                          )}
                        </td>
                        {!isEmployee && (
                          <td style={{ padding: '0.875rem 1rem', fontSize: '0.8125rem', color: 'var(--text-primary)' }}>
                            {requesterName}
                          </td>
                        )}
                        <td style={{ padding: '0.875rem 1rem' }}>
                          {assigneeName ? (
                            <span style={{ fontSize: '0.8125rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                              {assigneeName}
                            </span>
                          ) : (
                            <span style={{ fontSize: '0.8125rem', color: 'var(--color-amber-600)', fontWeight: 500 }}>
                              Unassigned
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '0.875rem 1rem', fontSize: '0.775rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                          {t.createdAt ? new Date(t.createdAt).toLocaleDateString() : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Footer */}
          {pagination.totalPages > 1 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.875rem 1.25rem',
                borderTop: '1px solid var(--border-subtle)',
                backgroundColor: 'var(--color-slate-50)',
                fontSize: '0.8125rem',
                color: 'var(--text-secondary)',
              }}
            >
              <div>
                Page {pagination.page} of {pagination.totalPages} ({pagination.total} total tickets)
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={pagination.page <= 1 || isLoading}
                  onClick={() => handlePageChange(pagination.page - 1)}
                  icon={<ChevronLeft size={14} />}
                >
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={pagination.page >= pagination.totalPages || isLoading}
                  onClick={() => handlePageChange(pagination.page + 1)}
                  icon={<ChevronRight size={14} />}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Ticket Creation Modal */}
      {isCreateOpen && (
        <CreateTicketModal
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          onTicketCreated={(newTicket) => {
            setIsLoading(true);
            setCurrentPage(1);
            navigate(`/tickets/${newTicket._id}`);
          }}
        />
      )}
    </div>
  );
};

export default TicketListPage;
