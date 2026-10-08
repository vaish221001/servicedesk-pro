import { useState, useEffect } from 'react';
import { useAuth } from '../context/useAuth';
import userService from '../services/userService';
import Card, { CardHeader, CardTitle, CardDescription, CardBody } from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import EmptyState from '../components/ui/EmptyState';
import Alert from '../components/ui/Alert';
import CreateUserModal from '../components/users/CreateUserModal';
import EditUserModal from '../components/users/EditUserModal';
import ConfirmStatusModal from '../components/users/ConfirmStatusModal';

import {
  Users,
  UserPlus,
  Search,
  RotateCw,
  Edit,
  UserCheck,
  UserX,
  ChevronLeft,
  ChevronRight,
  Shield,
  Building,
} from 'lucide-react';

export const UserManagementPage = () => {
  const { user: currentUser } = useAuth();

  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });

  // Filters
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // States
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successNotice, setSuccessNotice] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedUserForEdit, setSelectedUserForEdit] = useState(null);
  const [selectedUserForStatus, setSelectedUserForStatus] = useState(null);

  // 1. Load active departments for dropdown filters and forms
  useEffect(() => {
    let ignore = false;
    async function loadDepts() {
      try {
        const depts = await userService.getDepartments();
        if (!ignore) {
          setDepartments(depts || []);
        }
      } catch (err) {
        console.error('Failed to load organization departments:', err);
      }
    }
    loadDepts();
    return () => {
      ignore = true;
    };
  }, []);

  // 2. Fetch users based on current filters, pagination, and refresh trigger
  useEffect(() => {
    let ignore = false;

    async function loadUsers() {
      setIsLoading(true);
      setError(null);
      try {
        const params = {
          page: currentPage,
          limit: 15,
        };
        if (activeSearch.trim()) params.search = activeSearch.trim();
        if (roleFilter) params.role = roleFilter;
        if (deptFilter) params.departmentId = deptFilter;
        if (statusFilter) params.status = statusFilter;

        const res = await userService.getUsers(params);
        if (!ignore && res && res.success) {
          setUsers(res.data || []);
          setPagination(
            res.pagination || { page: currentPage, limit: 15, total: res.data?.length || 0, totalPages: 1 }
          );
        }
      } catch (err) {
        if (!ignore) {
          console.error('Failed to fetch users:', err);
          setError(err.message || 'Unable to retrieve user directory.');
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    loadUsers();

    return () => {
      ignore = true;
    };
  }, [currentPage, activeSearch, roleFilter, deptFilter, statusFilter, refreshTrigger]);

  const handleRefresh = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  // Search submission
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setCurrentPage(1);
    setActiveSearch(searchTerm);
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setActiveSearch('');
    setRoleFilter('');
    setDeptFilter('');
    setStatusFilter('');
    setCurrentPage(1);
  };

  // Handlers for user state updates
  const handleUserCreated = (newUser) => {
    setSuccessNotice(`Successfully created user: ${newUser.firstName} ${newUser.lastName} (${newUser.email})`);
    setTimeout(() => setSuccessNotice(null), 5000);
    handleRefresh();
  };

  const handleUserUpdated = (updatedUser) => {
    setSuccessNotice(`Updated account details for ${updatedUser.firstName} ${updatedUser.lastName}`);
    setTimeout(() => setSuccessNotice(null), 5000);
    handleRefresh();
  };

  const handleStatusChanged = (updatedUser) => {
    const actionWord = updatedUser.isActive ? 'reactivated' : 'deactivated';
    setSuccessNotice(`Successfully ${actionWord} account for ${updatedUser.firstName} ${updatedUser.lastName}`);
    setTimeout(() => setSuccessNotice(null), 5000);
    handleRefresh();
  };

  // Metrics summary
  const totalCount = pagination.total || users.length;
  const activeCount = users.filter((u) => u.isActive).length;
  const adminCount = users.filter((u) => u.role === 'SYSTEM_ADMIN' || u.role === 'IT_MANAGER').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Top Header & Actions */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              User & Access Management
            </h1>
            <Badge color="purple">SYSTEM ADMIN</Badge>
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
            Manage staff accounts, assign technical roles, configure department access, and audit status.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Button
            variant="secondary"
            onClick={handleRefresh}
            isLoading={isLoading}
            icon={<RotateCw size={15} />}
          >
            Refresh
          </Button>
          <Button
            variant="primary"
            onClick={() => setIsCreateOpen(true)}
            icon={<UserPlus size={16} />}
          >
            Add New User
          </Button>
        </div>
      </div>

      {/* Notifications */}
      {successNotice && (
        <Alert variant="success" onClose={() => setSuccessNotice(null)}>
          {successNotice}
        </Alert>
      )}

      {error && (
        <Alert variant="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Metric Cards Row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
        }}
      >
        <Card>
          <CardBody style={{ padding: '1rem 1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>TOTAL USERS</span>
              <Users size={16} style={{ color: 'var(--color-primary-600)' }} />
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.35rem' }}>
              {isLoading ? <LoadingSpinner size="sm" /> : totalCount}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody style={{ padding: '1rem 1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>ACTIVE ACCOUNTS</span>
              <UserCheck size={16} style={{ color: 'var(--color-emerald-600)' }} />
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--color-emerald-600)', marginTop: '0.35rem' }}>
              {isLoading ? <LoadingSpinner size="sm" /> : activeCount}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody style={{ padding: '1rem 1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>ADMINS & MANAGERS</span>
              <Shield size={16} style={{ color: 'var(--color-purple-600)' }} />
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--color-purple-600)', marginTop: '0.35rem' }}>
              {isLoading ? <LoadingSpinner size="sm" /> : adminCount}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody style={{ padding: '1rem 1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>DEPARTMENTS</span>
              <Building size={16} style={{ color: 'var(--color-sky-600)' }} />
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--color-sky-600)', marginTop: '0.35rem' }}>
              {departments.length}
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card>
        <CardBody style={{ padding: '1rem' }}>
          <form
            onSubmit={handleSearchSubmit}
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.75rem',
              alignItems: 'center',
            }}
          >
            <div style={{ flex: '1 1 240px', position: 'relative' }}>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name, email, or job title..."
                style={{
                  width: '100%',
                  padding: '0.55rem 0.75rem 0.55rem 2.25rem',
                  fontSize: '0.875rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                }}
              />
              <Search
                size={16}
                style={{
                  position: 'absolute',
                  left: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                }}
              />
            </div>

            {/* Role Filter */}
            <select
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                setCurrentPage(1);
              }}
              style={{
                padding: '0.55rem 0.75rem',
                fontSize: '0.875rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
                backgroundColor: '#ffffff',
              }}
            >
              <option value="">All System Roles</option>
              <option value="SYSTEM_ADMIN">System Admin</option>
              <option value="IT_MANAGER">IT Manager</option>
              <option value="TECHNICIAN">Technician</option>
              <option value="EMPLOYEE">Employee</option>
              <option value="ASSET_MANAGER">Asset Manager</option>
            </select>

            {/* Department Filter */}
            <select
              value={deptFilter}
              onChange={(e) => {
                setDeptFilter(e.target.value);
                setCurrentPage(1);
              }}
              style={{
                padding: '0.55rem 0.75rem',
                fontSize: '0.875rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
                backgroundColor: '#ffffff',
              }}
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d._id} value={d._id}>
                  {d.name}
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              style={{
                padding: '0.55rem 0.75rem',
                fontSize: '0.875rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
                backgroundColor: '#ffffff',
              }}
            >
              <option value="">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive / Suspended</option>
            </select>

            <Button type="submit" variant="secondary" size="sm">
              Search
            </Button>

            {(activeSearch || roleFilter || deptFilter || statusFilter) && (
              <Button type="button" variant="ghost" size="sm" onClick={handleClearFilters}>
                Clear
              </Button>
            )}
          </form>
        </CardBody>
      </Card>

      {/* User Directory Table */}
      <Card>
        <CardHeader>
          <CardTitle>Staff Directory</CardTitle>
          <CardDescription>
            Showing {users.length} of {pagination.total} registered users in your tenant organization
          </CardDescription>
        </CardHeader>

        <CardBody style={{ padding: 0 }}>
          {isLoading ? (
            <div style={{ padding: '3.5rem', textAlign: 'center' }}>
              <LoadingSpinner size="md" color="primary" />
              <p style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                Loading user directory...
              </p>
            </div>
          ) : users.length === 0 ? (
            <div style={{ padding: '2rem' }}>
              <EmptyState
                icon={Users}
                title="No users found"
                description={
                  activeSearch || roleFilter || deptFilter || statusFilter
                    ? 'No users match your applied search criteria.'
                    : 'No user accounts have been provisioned in this organization.'
                }
                action={
                  activeSearch || roleFilter || deptFilter || statusFilter ? (
                    <Button variant="secondary" size="sm" onClick={handleClearFilters}>
                      Reset Filters
                    </Button>
                  ) : (
                    <Button variant="primary" size="sm" onClick={() => setIsCreateOpen(true)}>
                      Provision First User
                    </Button>
                  )
                }
              />
            </div>
          ) : (
            <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Department</th>
                    <th>Job Title</th>
                    <th>Status</th>
                    <th>Last Active</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const initials = `${(u.firstName || '')[0] || ''}${(u.lastName || '')[0] || ''}`.toUpperCase();
                    const isSelf = u._id === currentUser?._id;

                    return (
                      <tr key={u._id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                            <div
                              style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '50%',
                                backgroundColor: 'var(--color-primary-100)',
                                color: 'var(--color-primary-700)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 700,
                                fontSize: '0.75rem',
                              }}
                            >
                              {initials || 'U'}
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                                {u.firstName} {u.lastName}
                                {isSelf && (
                                  <span
                                    style={{
                                      marginLeft: '0.4rem',
                                      fontSize: '0.65rem',
                                      fontWeight: 600,
                                      padding: '1px 5px',
                                      borderRadius: 'var(--radius-sm)',
                                      backgroundColor: 'var(--color-primary-50)',
                                      color: 'var(--color-primary-600)',
                                    }}
                                  >
                                    YOU
                                  </span>
                                )}
                              </div>
                              {u.phone && (
                                <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>
                                  {u.phone}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
                          {u.email}
                        </td>

                        <td>
                          <Badge variant="role">{u.role}</Badge>
                        </td>

                        <td>
                          <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>
                            {u.departmentId?.name || '—'}
                          </span>
                        </td>

                        <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                          {u.jobTitle || '—'}
                        </td>

                        <td>
                          <Badge color={u.isActive ? 'emerald' : 'rose'}>
                            {u.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </td>

                        <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : 'Never logged in'}
                        </td>

                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedUserForEdit(u)}
                              icon={<Edit size={14} />}
                              title="Edit user details"
                            >
                              Edit
                            </Button>

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedUserForStatus(u)}
                              icon={u.isActive ? <UserX size={14} /> : <UserCheck size={14} />}
                              style={{
                                color: u.isActive ? 'var(--color-rose-600)' : 'var(--color-emerald-600)',
                              }}
                              title={u.isActive ? 'Deactivate account' : 'Reactivate account'}
                            >
                              {u.isActive ? 'Deactivate' : 'Reactivate'}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Controls */}
          {pagination.totalPages > 1 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.75rem 1.25rem',
                borderTop: '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Page {pagination.page} of {pagination.totalPages} ({pagination.total} users)
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={pagination.page <= 1 || isLoading}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  icon={<ChevronLeft size={14} />}
                >
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={pagination.page >= pagination.totalPages || isLoading}
                  onClick={() => setCurrentPage((p) => Math.min(pagination.totalPages, p + 1))}
                  icon={<ChevronRight size={14} />}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Modals */}
      <CreateUserModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onUserCreated={handleUserCreated}
        departments={departments}
      />

      <EditUserModal
        isOpen={Boolean(selectedUserForEdit)}
        onClose={() => setSelectedUserForEdit(null)}
        user={selectedUserForEdit}
        onUserUpdated={handleUserUpdated}
        departments={departments}
        currentAdminId={currentUser?._id}
      />

      <ConfirmStatusModal
        isOpen={Boolean(selectedUserForStatus)}
        onClose={() => setSelectedUserForStatus(null)}
        user={selectedUserForStatus}
        onStatusChanged={handleStatusChanged}
        currentAdminId={currentUser?._id}
      />
    </div>
  );
};

export default UserManagementPage;
