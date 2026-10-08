import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import Card, { CardHeader, CardTitle, CardDescription, CardBody } from '../ui/Card';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import LoadingSpinner from '../ui/LoadingSpinner';
import Alert from '../ui/Alert';
import EmptyState from '../ui/EmptyState';
import assetService from '../../services/assetService';
import { CreateAssetModal } from '../assets/CreateAssetModal';
import {
  HardDrive,
  CheckCircle2,
  RotateCw,
  ExternalLink,
  PlusCircle,
  Truck,
  ShieldAlert,
  ShieldCheck,
  BarChart3,
  ArrowRight,
  PackageCheck,
  Wrench,
  Archive,
} from 'lucide-react';

export const AssetManagerDashboard = ({ user }) => {
  const [assets, setAssets] = useState([]);
  const [assetMeta, setAssetMeta] = useState({ total: 0 });
  const [vendors, setVendors] = useState([]);
  const [vendorMeta, setVendorMeta] = useState({ total: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Modals state
  const [isCreateAssetOpen, setIsCreateAssetOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('inventory'); // 'inventory' | 'warranty' | 'vendors'

  const handleRefresh = () => {
    setIsLoading(true);
    setRefreshTrigger((prev) => prev + 1);
  };

  useEffect(() => {
    let ignore = false;

    async function loadData() {
      try {
        const [assetsRes, vendorsRes] = await Promise.all([
          assetService.getAssets({ limit: 100, sort: '-updatedAt' }),
          assetService.getVendors({ limit: 50 }),
        ]);

        if (ignore) return;

        if (assetsRes && assetsRes.success) {
          setAssets(assetsRes.data || []);
          setAssetMeta(assetsRes.pagination || { total: assetsRes.data?.length || 0 });
        }

        if (vendorsRes && vendorsRes.success) {
          setVendors(vendorsRes.data || []);
          setVendorMeta(vendorsRes.pagination || { total: vendorsRes.data?.length || 0 });
        }
        setError(null);
      } catch (err) {
        if (!ignore) {
          console.error('Failed to load Asset Manager dashboard data:', err);
          setError(err.message || 'Failed to retrieve asset inventory and vendor records.');
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    loadData();

    return () => {
      ignore = true;
    };
  }, [refreshTrigger]);

  // Derived Metrics
  const totalAssetsCount = assetMeta.total || assets.length;
  const inStockAssets = useMemo(() => assets.filter((a) => a.status === 'IN_STOCK'), [assets]);
  const assignedAssets = useMemo(() => assets.filter((a) => a.status === 'ASSIGNED'), [assets]);
  const maintenanceAssets = useMemo(
    () => assets.filter((a) => ['IN_REPAIR', 'UNDER_MAINTENANCE'].includes(a.status)),
    [assets]
  );
  const retiredAssets = useMemo(
    () => assets.filter((a) => ['RETIRED', 'DISPOSED', 'LOST'].includes(a.status)),
    [assets]
  );

  // Warranty Analytics & Alerts
  const warrantyAnalysis = useMemo(() => {
    const now = new Date();
    const ninetyDaysFromNow = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

    const expired = [];
    const expiringSoon = [];
    const activeValid = [];
    let notSpecified = 0;

    assets.forEach((a) => {
      if (!a.warrantyExpiry) {
        notSpecified++;
        return;
      }
      const expDate = new Date(a.warrantyExpiry);
      if (expDate < now) {
        expired.push(a);
      } else if (expDate <= ninetyDaysFromNow) {
        expiringSoon.push(a);
      } else {
        activeValid.push(a);
      }
    });

    return {
      expired,
      expiringSoon,
      activeValid,
      notSpecified,
    };
  }, [assets]);

  // Asset Type Distribution
  const typeDistribution = useMemo(() => {
    const types = {
      HARDWARE: 0,
      SOFTWARE: 0,
      NETWORK: 0,
      PERIPHERAL: 0,
      OTHER: 0,
    };
    assets.forEach((a) => {
      const t = a.assetType || 'OTHER';
      if (types[t] !== undefined) {
        types[t]++;
      } else {
        types.OTHER++;
      }
    });
    return types;
  }, [assets]);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'IN_STOCK':
        return <Badge color="green">IN STOCK</Badge>;
      case 'ASSIGNED':
        return <Badge color="blue">ASSIGNED</Badge>;
      case 'IN_REPAIR':
      case 'UNDER_MAINTENANCE':
        return <Badge color="orange">IN REPAIR</Badge>;
      case 'RETIRED':
        return <Badge color="gray">RETIRED</Badge>;
      case 'LOST':
      case 'DISPOSED':
        return <Badge color="red">{status}</Badge>;
      default:
        return <Badge color="gray">{status}</Badge>;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* Asset Manager Header Banner */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          padding: '1.5rem',
          backgroundColor: '#ffffff',
          borderRadius: 'var(--radius-xl)',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-xs)',
          background: 'linear-gradient(to right, #ffffff, #ecfdf5)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Asset Lifecycle & Inventory Hub
            </h2>
            <Badge color="green">ASSET MANAGER</Badge>
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            {user?.firstName ? `Manager: ${user.firstName} ${user.lastName} • ` : ''}Oversee corporate hardware fleet, equipment deployment status, vendor contracts, and warranty lifecycles.
          </p>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem' }}>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleRefresh}
            isLoading={isLoading}
            icon={<RotateCw size={14} />}
          >
            Refresh Inventory
          </Button>
          <Link to="/assets">
            <Button variant="secondary" size="sm" icon={<ExternalLink size={14} />}>
              Inventory Directory
            </Button>
          </Link>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsCreateAssetOpen(true)}
            icon={<PlusCircle size={14} />}
          >
            Register Asset
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* KPI Stats Cards Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1.25rem',
        }}
      >
        {/* Card 1: Total Assets */}
        <Card>
          <CardBody style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                TOTAL ASSET FLEET
              </span>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-primary-50)',
                  color: 'var(--color-primary-600)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <HardDrive size={18} />
              </div>
            </div>
            <div style={{ fontSize: '1.85rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.5rem' }}>
              {isLoading ? <LoadingSpinner size="sm" /> : totalAssetsCount}
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.775rem', marginTop: '0.35rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>
                Active in company catalog
              </span>
            </div>
          </CardBody>
        </Card>

        {/* Card 2: In Stock / Available */}
        <Card>
          <CardBody style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                AVAILABLE / IN STOCK
              </span>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: '#f0fdf4',
                  color: 'var(--color-emerald-600)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <PackageCheck size={18} />
              </div>
            </div>
            <div style={{ fontSize: '1.85rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.5rem' }}>
              {isLoading ? <LoadingSpinner size="sm" /> : inStockAssets.length}
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.775rem', marginTop: '0.35rem' }}>
              <span style={{ color: 'var(--color-emerald-600)', fontWeight: 600 }}>
                Ready for user checkout
              </span>
            </div>
          </CardBody>
        </Card>

        {/* Card 3: Assigned Assets */}
        <Card>
          <CardBody style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                ASSIGNED IN USE
              </span>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-indigo-50)',
                  color: 'var(--color-indigo-600)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <CheckCircle2 size={18} />
              </div>
            </div>
            <div style={{ fontSize: '1.85rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.5rem' }}>
              {isLoading ? <LoadingSpinner size="sm" /> : assignedAssets.length}
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.775rem', marginTop: '0.35rem' }}>
              <span style={{ color: 'var(--color-indigo-600)', fontWeight: 600 }}>
                Deployed to employees
              </span>
            </div>
          </CardBody>
        </Card>

        {/* Card 4: Under Maintenance */}
        <Card>
          <CardBody style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                UNDER MAINTENANCE / REPAIR
              </span>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: '#fffbeb',
                  color: '#d97706',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Wrench size={18} />
              </div>
            </div>
            <div style={{ fontSize: '1.85rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.5rem' }}>
              {isLoading ? <LoadingSpinner size="sm" /> : maintenanceAssets.length}
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.775rem', marginTop: '0.35rem' }}>
              <span style={{ color: maintenanceAssets.length > 0 ? '#b45309' : 'var(--text-muted)', fontWeight: 600 }}>
                {maintenanceAssets.length > 0 ? 'Service intervention active' : 'No hardware in repair'}
              </span>
            </div>
          </CardBody>
        </Card>

        {/* Card 5: Retired & Decommissioned */}
        <Card>
          <CardBody style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                RETIRED & DECOMMISSIONED
              </span>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-slate-100)',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Archive size={18} />
              </div>
            </div>
            <div style={{ fontSize: '1.85rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.5rem' }}>
              {isLoading ? <LoadingSpinner size="sm" /> : retiredAssets.length}
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.775rem', marginTop: '0.35rem' }}>
              <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>
                {retiredAssets.length > 0 ? 'End-of-life catalog units' : 'Zero retired inventory'}
              </span>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* WARRANTY ALERTS BANNER / SUMMARY */}
      <Card style={{ borderLeft: warrantyAnalysis.expired.length > 0 ? '4px solid #dc2626' : '4px solid var(--color-emerald-500)' }}>
        <CardBody style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: warrantyAnalysis.expired.length > 0 ? '#fef2f2' : '#f0fdf4',
                  color: warrantyAnalysis.expired.length > 0 ? '#dc2626' : 'var(--color-emerald-600)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {warrantyAnalysis.expired.length > 0 ? <ShieldAlert size={20} /> : <ShieldCheck size={20} />}
              </div>
              <div>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Hardware Warranty Health & Compliance
                </div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                  {warrantyAnalysis.expired.length} expired • {warrantyAnalysis.expiringSoon.length} expiring in 90 days •{' '}
                  {warrantyAnalysis.activeValid.length} active warranties • {warrantyAnalysis.notSpecified} without warranty date
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <Button
                size="sm"
                variant={activeTab === 'warranty' ? 'primary' : 'secondary'}
                onClick={() => setActiveTab('warranty')}
              >
                View Warranty Alerts ({warrantyAnalysis.expired.length + warrantyAnalysis.expiringSoon.length})
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Main Tabs Navigation */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', gap: '1.5rem' }}>
        <button
          onClick={() => setActiveTab('inventory')}
          style={{
            background: 'none',
            border: 'none',
            padding: '0.75rem 0.25rem',
            fontSize: '0.95rem',
            fontWeight: 600,
            cursor: 'pointer',
            color: activeTab === 'inventory' ? 'var(--color-primary-600)' : 'var(--text-muted)',
            borderBottom: activeTab === 'inventory' ? '2px solid var(--color-primary-600)' : '2px solid transparent',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <HardDrive size={16} />
          Recent Asset Activity ({assets.length})
        </button>

        <button
          onClick={() => setActiveTab('warranty')}
          style={{
            background: 'none',
            border: 'none',
            padding: '0.75rem 0.25rem',
            fontSize: '0.95rem',
            fontWeight: 600,
            cursor: 'pointer',
            color: activeTab === 'warranty' ? '#dc2626' : 'var(--text-muted)',
            borderBottom: activeTab === 'warranty' ? '2px solid #dc2626' : '2px solid transparent',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <ShieldAlert size={16} />
          Warranty Alerts ({warrantyAnalysis.expired.length + warrantyAnalysis.expiringSoon.length})
        </button>

        <button
          onClick={() => setActiveTab('vendors')}
          style={{
            background: 'none',
            border: 'none',
            padding: '0.75rem 0.25rem',
            fontSize: '0.95rem',
            fontWeight: 600,
            cursor: 'pointer',
            color: activeTab === 'vendors' ? 'var(--color-indigo-600)' : 'var(--text-muted)',
            borderBottom: activeTab === 'vendors' ? '2px solid var(--color-indigo-600)' : '2px solid transparent',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <Truck size={16} />
          Vendor Directory ({vendorMeta.total || vendors.length})
        </button>
      </div>

      {/* TAB 1: RECENT ASSET ACTIVITY */}
      {activeTab === 'inventory' && (
        <Card>
          <CardHeader
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
            }}
          >
            <div>
              <CardTitle>Recent Asset Activity & Fleet Catalog</CardTitle>
              <CardDescription>
                Detailed overview of hardware, assigned users, and inventory status
              </CardDescription>
            </div>
            <Link to="/assets">
              <Button size="xs" variant="secondary" icon={<ExternalLink size={12} />}>
                View Full Inventory
              </Button>
            </Link>
          </CardHeader>
          <CardBody style={{ padding: 0 }}>
            {isLoading ? (
              <div style={{ padding: '3rem', display: 'flex', justifyContent: 'center' }}>
                <LoadingSpinner size="lg" />
              </div>
            ) : assets.length === 0 ? (
              <div style={{ padding: '2.5rem' }}>
                <EmptyState
                  icon={HardDrive}
                  title="No Assets Registered"
                  description="Your organization has no assets in the inventory database yet."
                  action={
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => setIsCreateAssetOpen(true)}
                      icon={<PlusCircle size={14} />}
                    >
                      Register First Asset
                    </Button>
                  }
                />
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr
                      style={{
                        backgroundColor: 'var(--color-slate-50)',
                        borderBottom: '1px solid var(--border-subtle)',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: 'var(--text-secondary)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}
                    >
                      <th style={{ padding: '0.75rem 1rem' }}>Asset Tag</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Name & Model</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Type</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Assignee / Location</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assets.slice(0, 10).map((a) => (
                      <tr
                        key={a._id}
                        style={{
                          borderBottom: '1px solid var(--border-subtle)',
                          transition: 'background-color 0.15s ease',
                        }}
                      >
                        <td style={{ padding: '0.875rem 1rem', whiteSpace: 'nowrap' }}>
                          <Link
                            to={`/assets/${a._id}`}
                            style={{
                              fontWeight: 700,
                              color: 'var(--color-primary-600)',
                              textDecoration: 'none',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                            }}
                          >
                            {a.assetTag}
                            <ExternalLink size={12} />
                          </Link>
                        </td>
                        <td style={{ padding: '0.875rem 1rem' }}>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.875rem' }}>
                            {a.name}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {a.manufacturer ? `${a.manufacturer} ` : ''}
                            {a.model || ''}
                            {a.serialNumber ? ` • S/N: ${a.serialNumber}` : ''}
                          </div>
                        </td>
                        <td style={{ padding: '0.875rem 1rem', whiteSpace: 'nowrap' }}>
                          <Badge color="gray">{a.assetType || 'HARDWARE'}</Badge>
                        </td>
                        <td style={{ padding: '0.875rem 1rem', whiteSpace: 'nowrap' }}>
                          {getStatusBadge(a.status)}
                        </td>
                        <td style={{ padding: '0.875rem 1rem', fontSize: '0.8125rem' }}>
                          {a.currentAssigneeId ? (
                            <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                              {a.currentAssigneeId.firstName} {a.currentAssigneeId.lastName}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>
                              {a.location || 'In Storage'}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '0.875rem 1rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <Link to={`/assets/${a._id}`}>
                            <Button size="xs" variant="secondary">
                              Manage
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {/* TAB 2: WARRANTY ALERTS & EXPIRATION HEALTH */}
      {activeTab === 'warranty' && (
        <Card>
          <CardHeader>
            <CardTitle>Warranty Expiration Alerts</CardTitle>
            <CardDescription>
              Assets with expired coverage or warranties expiring within 90 days
            </CardDescription>
          </CardHeader>
          <CardBody style={{ padding: 0 }}>
            {warrantyAnalysis.expired.length === 0 && warrantyAnalysis.expiringSoon.length === 0 ? (
              <div style={{ padding: '2.5rem' }}>
                <EmptyState
                  icon={ShieldCheck}
                  title="No Critical Warranty Alerts"
                  description="All assets with recorded warranty details are fully covered and valid."
                />
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr
                      style={{
                        backgroundColor: '#fef2f2',
                        borderBottom: '1px solid #fee2e2',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: '#991b1b',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}
                    >
                      <th style={{ padding: '0.75rem 1rem' }}>Asset Tag</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Name</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Warranty Status</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Expiration Date</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Assignee</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...warrantyAnalysis.expired, ...warrantyAnalysis.expiringSoon].map((a) => {
                      const isExpired = new Date(a.warrantyExpiry) < new Date();
                      return (
                        <tr
                          key={a._id}
                          style={{
                            borderBottom: '1px solid var(--border-subtle)',
                          }}
                        >
                          <td style={{ padding: '0.875rem 1rem', whiteSpace: 'nowrap' }}>
                            <Link
                              to={`/assets/${a._id}`}
                              style={{
                                fontWeight: 700,
                                color: isExpired ? '#dc2626' : '#d97706',
                                textDecoration: 'none',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.25rem',
                              }}
                            >
                              {a.assetTag}
                              <ExternalLink size={12} />
                            </Link>
                          </td>
                          <td style={{ padding: '0.875rem 1rem' }}>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.875rem' }}>
                              {a.name}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {a.manufacturer} {a.model}
                            </div>
                          </td>
                          <td style={{ padding: '0.875rem 1rem', whiteSpace: 'nowrap' }}>
                            {isExpired ? (
                              <Badge color="red">EXPIRED</Badge>
                            ) : (
                              <Badge color="yellow">EXPIRING SOON</Badge>
                            )}
                          </td>
                          <td style={{ padding: '0.875rem 1rem', whiteSpace: 'nowrap', fontSize: '0.8125rem' }}>
                            {new Date(a.warrantyExpiry).toLocaleDateString()}
                          </td>
                          <td style={{ padding: '0.875rem 1rem', fontSize: '0.8125rem' }}>
                            {a.currentAssigneeId ? (
                              `${a.currentAssigneeId.firstName} ${a.currentAssigneeId.lastName}`
                            ) : (
                              <span style={{ color: 'var(--text-muted)' }}>Unassigned</span>
                            )}
                          </td>
                          <td style={{ padding: '0.875rem 1rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                            <Link to={`/assets/${a._id}`}>
                              <Button size="xs" variant="secondary">
                                Renew / Edit
                              </Button>
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {/* TAB 3: VENDOR OVERVIEW */}
      {activeTab === 'vendors' && (
        <Card>
          <CardHeader
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
            }}
          >
            <div>
              <CardTitle>Vendor Directory & Procurement Partners</CardTitle>
              <CardDescription>Suppliers, maintenance providers, and hardware vendors</CardDescription>
            </div>
            <Link to="/assets">
              <Button size="xs" variant="secondary" icon={<ExternalLink size={12} />}>
                Manage Vendors
              </Button>
            </Link>
          </CardHeader>
          <CardBody style={{ padding: 0 }}>
            {vendors.length === 0 ? (
              <div style={{ padding: '2.5rem' }}>
                <EmptyState
                  icon={Truck}
                  title="No Vendors Registered"
                  description="No external suppliers or hardware vendors have been registered yet."
                />
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr
                      style={{
                        backgroundColor: 'var(--color-slate-50)',
                        borderBottom: '1px solid var(--border-subtle)',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: 'var(--text-secondary)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}
                    >
                      <th style={{ padding: '0.75rem 1rem' }}>Vendor Name</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Contact Person</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Email / Phone</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Website</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vendors.map((v) => (
                      <tr
                        key={v._id}
                        style={{
                          borderBottom: '1px solid var(--border-subtle)',
                        }}
                      >
                        <td style={{ padding: '0.875rem 1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {v.name}
                        </td>
                        <td style={{ padding: '0.875rem 1rem', fontSize: '0.85rem' }}>
                          {v.contactPerson || '—'}
                        </td>
                        <td style={{ padding: '0.875rem 1rem', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                          <div>{v.email || '—'}</div>
                          {v.phone && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{v.phone}</div>}
                        </td>
                        <td style={{ padding: '0.875rem 1rem', fontSize: '0.8125rem' }}>
                          {v.website ? (
                            <a
                              href={v.website.startsWith('http') ? v.website : `https://${v.website}`}
                              target="_blank"
                              rel="noreferrer"
                              style={{ color: 'var(--color-primary-600)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                            >
                              Visit <ExternalLink size={11} />
                            </a>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td style={{ padding: '0.875rem 1rem', whiteSpace: 'nowrap' }}>
                          {v.isActive !== false ? (
                            <Badge color="green">ACTIVE</Badge>
                          ) : (
                            <Badge color="gray">INACTIVE</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {/* TWO COLUMN GRID: FLEET TYPE BREAKDOWN & QUICK OPERATIONS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
        {/* Left Column: Fleet Allocation Profile */}
        <Card>
          <CardHeader>
            <CardTitle>Asset Fleet Composition</CardTitle>
            <CardDescription>Breakdown by device and equipment classifications</CardDescription>
          </CardHeader>
          <CardBody style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            {Object.entries(typeDistribution).map(([typeKey, count]) => {
              const pct = totalAssetsCount > 0 ? Math.round((count / totalAssetsCount) * 100) : 0;
              return (
                <div key={typeKey} style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{typeKey}</span>
                    <span style={{ color: 'var(--text-muted)' }}>
                      {count} units ({pct}%)
                    </span>
                  </div>
                  <div
                    style={{
                      height: '6px',
                      backgroundColor: 'var(--color-slate-100)',
                      borderRadius: 'var(--radius-full)',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${pct}%`,
                        backgroundColor: 'var(--color-emerald-500)',
                        borderRadius: 'var(--radius-full)',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </CardBody>
        </Card>

        {/* Right Column: Quick Operations Hub */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Operations & Shortcuts</CardTitle>
            <CardDescription>Rapid access to inventory controls and lifecycle procedures</CardDescription>
          </CardHeader>
          <CardBody style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <button
              onClick={() => setIsCreateAssetOpen(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.875rem 1rem',
                backgroundColor: 'var(--color-slate-50)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <PlusCircle size={18} color="var(--color-emerald-600)" />
                <div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    Register New Asset
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Catalog new hardware, serial numbers, and warranty details
                  </div>
                </div>
              </div>
              <ArrowRight size={16} color="var(--text-muted)" />
            </button>

            <Link
              to="/assets"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.875rem 1rem',
                backgroundColor: 'var(--color-slate-50)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
                textDecoration: 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <HardDrive size={18} color="var(--color-primary-600)" />
                <div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    Asset Assignments & Checkouts
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Deploy hardware to employees or process equipment returns
                  </div>
                </div>
              </div>
              <ArrowRight size={16} color="var(--text-muted)" />
            </Link>

            <Link
              to="/reports"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.875rem 1rem',
                backgroundColor: 'var(--color-slate-50)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
                textDecoration: 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <BarChart3 size={18} color="var(--color-indigo-600)" />
                <div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    Asset Reports & Export
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Generate procurement summaries, fleet depreciation, and CSV audits
                  </div>
                </div>
              </div>
              <ArrowRight size={16} color="var(--text-muted)" />
            </Link>
          </CardBody>
        </Card>
      </div>

      {/* CREATE ASSET MODAL */}
      <CreateAssetModal
        isOpen={isCreateAssetOpen}
        onClose={() => setIsCreateAssetOpen(false)}
        onAssetCreated={() => {
          setIsCreateAssetOpen(false);
          handleRefresh();
        }}
      />
    </div>
  );
};

export default AssetManagerDashboard;
