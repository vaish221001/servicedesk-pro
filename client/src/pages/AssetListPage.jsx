import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import assetService from '../services/assetService.js';
import Card, { CardBody } from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import EmptyState from '../components/ui/EmptyState';
import Alert from '../components/ui/Alert';

import CreateAssetModal from '../components/assets/CreateAssetModal';
import VendorModal from '../components/assets/VendorModal';
import VendorDetailModal from '../components/assets/VendorDetailModal';

import {
  HardDrive,
  Search,
  PlusCircle,
  Building2,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  ShieldAlert,
  Layers,
} from 'lucide-react';

export const AssetListPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isEmployee = user?.role === 'EMPLOYEE';
  const canManageAssets = ['SYSTEM_ADMIN', 'ASSET_MANAGER'].includes(user?.role);

  // Active View Tab: 'assets' or 'vendors'
  const [activeTab, setActiveTab] = useState('assets');

  // Asset States
  const [assets, setAssets] = useState([]);
  const [assetPagination, setAssetPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });
  const [assetPage, setAssetPage] = useState(1);
  const [assetSearch, setAssetSearch] = useState('');
  const [activeAssetSearch, setActiveAssetSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  // Vendor States
  const [vendors, setVendors] = useState([]);
  const [vendorPagination, setVendorPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });
  const [vendorPage, setVendorPage] = useState(1);
  const [vendorSearch, setVendorSearch] = useState('');
  const [activeVendorSearch, setActiveVendorSearch] = useState('');

  // UI States
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modals
  const [isCreateAssetOpen, setIsCreateAssetOpen] = useState(false);
  const [isVendorModalOpen, setIsVendorModalOpen] = useState(false);
  const [selectedVendorForEdit, setSelectedVendorForEdit] = useState(null);
  const [selectedVendorForView, setSelectedVendorForView] = useState(null);

  // 1. Fetch Assets Effect
  useEffect(() => {
    if (activeTab !== 'assets') return;

    let ignore = false;
    async function loadAssets() {
      try {
        const params = {
          page: assetPage,
          limit: 15,
        };
        if (activeAssetSearch.trim()) params.search = activeAssetSearch.trim();
        if (statusFilter) params.status = statusFilter;
        if (typeFilter) params.assetType = typeFilter;

        const res = await assetService.getAssets(params);
        if (!ignore && res && res.success) {
          setAssets(res.data || []);
          setAssetPagination(
            res.pagination || { page: assetPage, limit: 15, total: res.data?.length || 0, totalPages: 1 }
          );
        }
      } catch (err) {
        if (!ignore) {
          console.error('Failed to load assets:', err);
          setError(err.message || 'Failed to retrieve asset inventory');
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    loadAssets();
    return () => {
      ignore = true;
    };
  }, [activeTab, assetPage, activeAssetSearch, statusFilter, typeFilter]);

  // 2. Fetch Vendors Effect
  useEffect(() => {
    if (activeTab !== 'vendors' || isEmployee) return;

    let ignore = false;
    async function loadVendors() {
      try {
        const params = {
          page: vendorPage,
          limit: 15,
        };
        if (activeVendorSearch.trim()) params.search = activeVendorSearch.trim();

        const res = await assetService.getVendors(params);
        if (!ignore && res && res.success) {
          setVendors(res.data || []);
          setVendorPagination(
            res.pagination || { page: vendorPage, limit: 15, total: res.data?.length || 0, totalPages: 1 }
          );
        }
      } catch (err) {
        if (!ignore) {
          console.error('Failed to load vendors:', err);
          setError(err.message || 'Failed to retrieve vendor directory');
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    loadVendors();
    return () => {
      ignore = true;
    };
  }, [activeTab, vendorPage, activeVendorSearch, isEmployee]);

  // Handlers
  const handleAssetSearchSubmit = (e) => {
    e.preventDefault();
    setIsLoading(true);
    setActiveAssetSearch(assetSearch);
    setAssetPage(1);
  };

  const handleVendorSearchSubmit = (e) => {
    e.preventDefault();
    setIsLoading(true);
    setActiveVendorSearch(vendorSearch);
    setVendorPage(1);
  };

  const handleResetAssetFilters = () => {
    setIsLoading(true);
    setAssetSearch('');
    setActiveAssetSearch('');
    setStatusFilter('');
    setTypeFilter('');
    setAssetPage(1);
  };

  const handleResetVendorFilters = () => {
    setIsLoading(true);
    setVendorSearch('');
    setActiveVendorSearch('');
    setVendorPage(1);
  };

  const switchTab = (tab) => {
    if (tab === activeTab) return;
    setIsLoading(true);
    setError(null);
    setActiveTab(tab);
  };

  // Metrics calculation
  const inStockCount = assets.filter((a) => a.status === 'IN_STOCK').length;
  const assignedCount = assets.filter((a) => a.status === 'ASSIGNED').length;
  const inRepairCount = assets.filter((a) => a.status === 'IN_REPAIR').length;

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
            {isEmployee ? 'My Assigned Equipment' : 'IT Asset & Vendor Inventory'}
          </h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            {isEmployee
              ? 'View hardware custody, device serial numbers, and equipment assigned to your account'
              : 'Hardware inventory, license tracking, lifecycle status, and supplier accounts'}
          </p>
        </div>

        {!isEmployee && canManageAssets && (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {activeTab === 'assets' ? (
              <Button
                variant="primary"
                onClick={() => setIsCreateAssetOpen(true)}
                icon={<PlusCircle size={16} />}
              >
                Register Asset
              </Button>
            ) : (
              <Button
                variant="primary"
                onClick={() => {
                  setSelectedVendorForEdit(null);
                  setIsVendorModalOpen(true);
                }}
                icon={<Building2 size={16} />}
              >
                Add Supplier
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Tabs Toolbar (Staff only) */}
      {!isEmployee && (
        <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.25rem' }}>
          <button
            type="button"
            onClick={() => switchTab('assets')}
            style={{
              padding: '0.6rem 1.25rem',
              borderRadius: 'var(--radius-md) var(--radius-md) 0 0',
              fontWeight: 600,
              fontSize: '0.875rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: activeTab === 'assets' ? '#ffffff' : 'transparent',
              color: activeTab === 'assets' ? 'var(--color-primary-600)' : 'var(--text-secondary)',
              borderBottom: activeTab === 'assets' ? '2px solid var(--color-primary-600)' : '2px solid transparent',
              transition: 'all var(--transition-fast)',
            }}
          >
            <HardDrive size={16} />
            Hardware & Software Assets ({assetPagination.total})
          </button>

          <button
            type="button"
            onClick={() => switchTab('vendors')}
            style={{
              padding: '0.6rem 1.25rem',
              borderRadius: 'var(--radius-md) var(--radius-md) 0 0',
              fontWeight: 600,
              fontSize: '0.875rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: activeTab === 'vendors' ? '#ffffff' : 'transparent',
              color: activeTab === 'vendors' ? 'var(--color-primary-600)' : 'var(--text-secondary)',
              borderBottom: activeTab === 'vendors' ? '2px solid var(--color-primary-600)' : '2px solid transparent',
              transition: 'all var(--transition-fast)',
            }}
          >
            <Building2 size={16} />
            Vendor Directory ({vendorPagination.total})
          </button>
        </div>
      )}

      {/* Overview Stat Cards (Staff only on Assets tab) */}
      {!isEmployee && activeTab === 'assets' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <Card>
            <CardBody style={{ padding: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 600 }}>Total Assets</span>
                <Layers size={18} style={{ color: 'var(--color-primary-600)' }} />
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.25rem' }}>
                {assetPagination.total}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardBody style={{ padding: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 600 }}>In Stock (Available)</span>
                <Badge color="emerald">Ready</Badge>
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-emerald-600)', marginTop: '0.25rem' }}>
                {inStockCount}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardBody style={{ padding: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 600 }}>Currently Assigned</span>
                <Badge color="blue">Active</Badge>
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-primary-600)', marginTop: '0.25rem' }}>
                {assignedCount}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardBody style={{ padding: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 600 }}>Maintenance / In Repair</span>
                <Badge color="amber">Service</Badge>
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-amber-600)', marginTop: '0.25rem' }}>
                {inRepairCount}
              </div>
            </CardBody>
          </Card>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* ASSET TAB CONTENT */}
      {/* ---------------------------------------------------- */}
      {activeTab === 'assets' && (
        <>
          {/* Asset Search & Filter Card */}
          <Card>
            <CardBody style={{ padding: '1rem 1.25rem' }}>
              <form
                onSubmit={handleAssetSearchSubmit}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '0.75rem',
                }}
              >
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
                    placeholder="Search asset tag, name, model, serial #..."
                    value={assetSearch}
                    onChange={(e) => setAssetSearch(e.target.value)}
                    style={{ paddingLeft: '2.4rem' }}
                  />
                </div>

                {!isEmployee && (
                  <>
                    <div style={{ minWidth: '140px' }}>
                      <select
                        className="form-input"
                        value={statusFilter}
                        onChange={(e) => {
                          setIsLoading(true);
                          setStatusFilter(e.target.value);
                          setAssetPage(1);
                        }}
                      >
                        <option value="">All Statuses</option>
                        <option value="IN_STOCK">In Stock</option>
                        <option value="ASSIGNED">Assigned</option>
                        <option value="IN_REPAIR">In Repair</option>
                        <option value="RETIRED">Retired</option>
                        <option value="LOST">Lost</option>
                        <option value="DISPOSED">Disposed</option>
                      </select>
                    </div>

                    <div style={{ minWidth: '140px' }}>
                      <select
                        className="form-input"
                        value={typeFilter}
                        onChange={(e) => {
                          setIsLoading(true);
                          setTypeFilter(e.target.value);
                          setAssetPage(1);
                        }}
                      >
                        <option value="">All Types</option>
                        <option value="HARDWARE">Hardware</option>
                        <option value="SOFTWARE">Software License</option>
                        <option value="NETWORK">Network</option>
                        <option value="PERIPHERAL">Peripheral</option>
                        <option value="OTHER">Other</option>
                      </select>
                    </div>
                  </>
                )}

                <Button type="submit" variant="secondary" size="sm">
                  Search
                </Button>
                {(activeAssetSearch || statusFilter || typeFilter) && (
                  <Button type="button" variant="ghost" size="sm" onClick={handleResetAssetFilters}>
                    Reset
                  </Button>
                )}
              </form>
            </CardBody>
          </Card>

          {/* Asset Table Card */}
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
                    Loading asset inventory...
                  </p>
                </div>
              ) : assets.length === 0 ? (
                <EmptyState
                  icon={<HardDrive size={48} />}
                  title="No assets found"
                  description={
                    activeAssetSearch || statusFilter || typeFilter
                      ? 'No inventory items matched your filter criteria.'
                      : isEmployee
                      ? 'You have not been assigned any company equipment.'
                      : 'No equipment or software licenses registered in inventory yet.'
                  }
                  action={
                    activeAssetSearch || statusFilter || typeFilter ? (
                      <Button variant="secondary" size="sm" onClick={handleResetAssetFilters}>
                        Clear Filters
                      </Button>
                    ) : canManageAssets ? (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => setIsCreateAssetOpen(true)}
                        icon={<PlusCircle size={14} />}
                      >
                        Register First Asset
                      </Button>
                    ) : null
                  }
                />
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-subtle)', backgroundColor: 'var(--color-slate-50)' }}>
                        <th style={{ textAlign: 'left', padding: '0.875rem 1rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                          Asset Tag
                        </th>
                        <th style={{ textAlign: 'left', padding: '0.875rem 1rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                          Name & Specs
                        </th>
                        <th style={{ textAlign: 'left', padding: '0.875rem 1rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                          Type
                        </th>
                        <th style={{ textAlign: 'left', padding: '0.875rem 1rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                          Status
                        </th>
                        {!isEmployee && (
                          <th style={{ textAlign: 'left', padding: '0.875rem 1rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                            Assigned User
                          </th>
                        )}
                        <th style={{ textAlign: 'left', padding: '0.875rem 1rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                          Location / Dept
                        </th>
                        <th style={{ textAlign: 'left', padding: '0.875rem 1rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                          Warranty
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {assets.map((asset) => {
                        const assignee = asset.currentAssigneeId;
                        const assigneeName = assignee ? `${assignee.firstName} ${assignee.lastName}` : null;
                        const isWarrantyActive = asset.warrantyExpiry && new Date(asset.warrantyExpiry) > new Date();

                        return (
                          <tr
                            key={asset._id}
                            onClick={() => navigate(`/assets/${asset._id}`)}
                            style={{
                              borderBottom: '1px solid var(--border-subtle)',
                              cursor: 'pointer',
                              transition: 'background-color var(--transition-fast)',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-slate-50)')}
                            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                          >
                            <td style={{ padding: '0.875rem 1rem', fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', color: 'var(--color-primary-600)' }}>
                              {asset.assetTag}
                            </td>
                            <td style={{ padding: '0.875rem 1rem', maxWidth: '300px' }}>
                              <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                                {asset.name}
                              </div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                {asset.manufacturer} {asset.model} {asset.serialNumber ? `• S/N: ${asset.serialNumber}` : ''}
                              </div>
                            </td>
                            <td style={{ padding: '0.875rem 1rem' }}>
                              <Badge color="slate">{asset.assetType}</Badge>
                            </td>
                            <td style={{ padding: '0.875rem 1rem' }}>
                              <Badge variant="status">{asset.status}</Badge>
                            </td>
                            {!isEmployee && (
                              <td style={{ padding: '0.875rem 1rem' }}>
                                {assigneeName ? (
                                  <div>
                                    <div style={{ fontWeight: 500, fontSize: '0.8125rem', color: 'var(--text-primary)' }}>
                                      {assigneeName}
                                    </div>
                                    <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>
                                      {assignee.email}
                                    </div>
                                  </div>
                                ) : (
                                  <span style={{ fontSize: '0.8125rem', color: 'var(--color-emerald-600)', fontWeight: 500 }}>
                                    In Stock (Unassigned)
                                  </span>
                                )}
                              </td>
                            )}
                            <td style={{ padding: '0.875rem 1rem', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                              <div>{asset.location || '—'}</div>
                              {asset.departmentId?.name && (
                                <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>
                                  {asset.departmentId.name}
                                </div>
                              )}
                            </td>
                            <td style={{ padding: '0.875rem 1rem', fontSize: '0.775rem' }}>
                              {asset.warrantyExpiry ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                  {isWarrantyActive ? (
                                    <ShieldCheck size={14} style={{ color: 'var(--color-emerald-600)' }} />
                                  ) : (
                                    <ShieldAlert size={14} style={{ color: 'var(--color-rose-600)' }} />
                                  )}
                                  <span style={{ color: isWarrantyActive ? 'var(--text-primary)' : 'var(--color-rose-600)' }}>
                                    {new Date(asset.warrantyExpiry).toLocaleDateString()}
                                  </span>
                                </div>
                              ) : (
                                <span style={{ color: 'var(--text-muted)' }}>—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Asset Pagination Footer */}
              {assetPagination.totalPages > 1 && (
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
                    Page {assetPagination.page} of {assetPagination.totalPages} ({assetPagination.total} total assets)
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={assetPagination.page <= 1 || isLoading}
                      onClick={() => {
                        setIsLoading(true);
                        setAssetPage((p) => p - 1);
                      }}
                      icon={<ChevronLeft size={14} />}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={assetPagination.page >= assetPagination.totalPages || isLoading}
                      onClick={() => {
                        setIsLoading(true);
                        setAssetPage((p) => p + 1);
                      }}
                      icon={<ChevronRight size={14} />}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </CardBody>
          </Card>
        </>
      )}

      {/* ---------------------------------------------------- */}
      {/* VENDOR TAB CONTENT (Staff Only) */}
      {/* ---------------------------------------------------- */}
      {!isEmployee && activeTab === 'vendors' && (
        <>
          {/* Vendor Search Card */}
          <Card>
            <CardBody style={{ padding: '1rem 1.25rem' }}>
              <form
                onSubmit={handleVendorSearchSubmit}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '0.75rem',
                }}
              >
                <div style={{ flex: '1 1 280px', position: 'relative' }}>
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
                    placeholder="Search vendor name, contact person, or email..."
                    value={vendorSearch}
                    onChange={(e) => setVendorSearch(e.target.value)}
                    style={{ paddingLeft: '2.4rem' }}
                  />
                </div>

                <Button type="submit" variant="secondary" size="sm">
                  Search Suppliers
                </Button>
                {activeVendorSearch && (
                  <Button type="button" variant="ghost" size="sm" onClick={handleResetVendorFilters}>
                    Reset
                  </Button>
                )}
              </form>
            </CardBody>
          </Card>

          {/* Vendor Directory Cards Grid */}
          <Card>
            <CardBody style={{ padding: '1.25rem' }}>
              {isLoading ? (
                <div style={{ textAlign: 'center', padding: '3.5rem 0' }}>
                  <LoadingSpinner size="md" color="primary" />
                  <p style={{ marginTop: '0.75rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                    Loading vendor records...
                  </p>
                </div>
              ) : vendors.length === 0 ? (
                <EmptyState
                  icon={<Building2 size={48} />}
                  title="No suppliers found"
                  description={
                    activeVendorSearch
                      ? 'No suppliers matched your keyword query.'
                      : 'No vendor profiles registered in the directory yet.'
                  }
                  action={
                    canManageAssets ? (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => {
                          setSelectedVendorForEdit(null);
                          setIsVendorModalOpen(true);
                        }}
                        icon={<Building2 size={14} />}
                      >
                        Register First Supplier
                      </Button>
                    ) : null
                  }
                />
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
                  {vendors.map((vendor) => (
                    <div
                      key={vendor._id}
                      onClick={() => setSelectedVendorForView(vendor)}
                      style={{
                        padding: '1.25rem',
                        borderRadius: 'var(--radius-lg)',
                        border: '1px solid var(--border-subtle)',
                        backgroundColor: '#ffffff',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: '0.75rem',
                        transition: 'box-shadow var(--transition-fast), border-color var(--transition-fast)',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'var(--color-primary-300)';
                        e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--border-subtle)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                          <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>
                            {vendor.name}
                          </span>
                          <Badge color={vendor.isActive ? 'emerald' : 'slate'}>
                            {vendor.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>

                        {vendor.contactPerson && (
                          <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                            <span style={{ color: 'var(--text-muted)' }}>Rep: </span>
                            {vendor.contactPerson}
                          </div>
                        )}
                        {vendor.email && (
                          <div style={{ fontSize: '0.8125rem', color: 'var(--color-primary-600)', marginTop: '2px' }}>
                            {vendor.email}
                          </div>
                        )}
                        {vendor.phone && (
                          <div style={{ fontSize: '0.775rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                            {vendor.phone}
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '0.75rem', borderTop: '1px solid var(--border-subtle)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        <span>Click to view profile & assets</span>
                        {canManageAssets && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedVendorForEdit(vendor);
                              setIsVendorModalOpen(true);
                            }}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--color-primary-600)',
                              fontWeight: 600,
                              cursor: 'pointer',
                              padding: '2px 6px',
                            }}
                          >
                            Edit
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </>
      )}

      {/* Asset Creation Modal */}
      {isCreateAssetOpen && (
        <CreateAssetModal
          isOpen={isCreateAssetOpen}
          onClose={() => setIsCreateAssetOpen(false)}
          onAssetCreated={(newAsset) => {
            setIsLoading(true);
            setAssetPage(1);
            navigate(`/assets/${newAsset._id}`);
          }}
        />
      )}

      {/* Vendor Create/Edit Modal */}
      {isVendorModalOpen && (
        <VendorModal
          isOpen={isVendorModalOpen}
          onClose={() => {
            setIsVendorModalOpen(false);
            setSelectedVendorForEdit(null);
          }}
          vendor={selectedVendorForEdit}
          onVendorSaved={() => {
            setIsLoading(true);
            setVendorPage(1);
          }}
        />
      )}

      {/* Vendor Profile & Associated Assets View Modal */}
      {selectedVendorForView && (
        <VendorDetailModal
          isOpen={!!selectedVendorForView}
          onClose={() => setSelectedVendorForView(null)}
          vendor={selectedVendorForView}
          onEditVendor={(vendorToEdit) => {
            setSelectedVendorForView(null);
            setSelectedVendorForEdit(vendorToEdit);
            setIsVendorModalOpen(true);
          }}
        />
      )}
    </div>
  );
};

export default AssetListPage;
