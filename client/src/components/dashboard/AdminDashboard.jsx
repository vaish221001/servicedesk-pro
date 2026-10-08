import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Card, { CardHeader, CardTitle, CardDescription, CardBody } from '../ui/Card';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import LoadingSpinner from '../ui/LoadingSpinner';
import Alert from '../ui/Alert';
import EmptyState from '../ui/EmptyState';
import userService from '../../services/userService';
import ticketService from '../../services/ticketService';
import assetService from '../../services/assetService';
import {
  Users,
  Ticket,
  HardDrive,
  BarChart3,
  ShieldCheck,
  RotateCw,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  UserPlus,
  ArrowRight,
  Server,
  Activity,
} from 'lucide-react';

export const AdminDashboard = ({ user }) => {
  const [userData, setUserData] = useState({ users: [], total: 0, active: 0, inactive: 0 });
  const [ticketData, setTicketData] = useState({ tickets: [], total: 0, open: 0, inProgress: 0, resolved: 0, breached: 0 });
  const [assetData, setAssetData] = useState({ assets: [], total: 0, inStock: 0, assigned: 0, maintenance: 0, retired: 0 });
  const [recentActivities, setRecentActivities] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleRefresh = () => {
    setIsLoading(true);
    setRefreshTrigger((prev) => prev + 1);
  };

  useEffect(() => {
    let ignore = false;

    async function fetchMetrics() {
      try {
        const [usersRes, ticketsRes, assetsRes] = await Promise.all([
          userService.getUsers({ limit: 100 }),
          ticketService.getTickets({ limit: 100, sort: '-createdAt' }),
          assetService.getAssets({ limit: 100 }),
        ]);

        if (ignore) return;

        // 1. Process Users
        const userList = usersRes?.users || usersRes?.data || [];
        const userTotal = usersRes?.pagination?.total || userList.length;
        const activeCount = userList.filter((u) => u.isActive).length;
        setUserData({
          users: userList,
          total: userTotal,
          active: activeCount,
          inactive: userTotal - activeCount,
        });

        // 2. Process Tickets
        const ticketList = ticketsRes?.tickets || ticketsRes?.data || [];
        const ticketTotal = ticketsRes?.pagination?.total || ticketList.length;
        const openCount = ticketList.filter((t) => ['OPEN', 'ASSIGNED'].includes(t.status)).length;
        const progCount = ticketList.filter((t) => ['IN_PROGRESS', 'PENDING'].includes(t.status)).length;
        const resCount = ticketList.filter((t) => ['RESOLVED', 'CLOSED'].includes(t.status)).length;
        const breachCount = ticketList.filter((t) => t.isResponseBreached || t.isResolutionBreached).length;
        setTicketData({
          tickets: ticketList,
          total: ticketTotal,
          open: openCount,
          inProgress: progCount,
          resolved: resCount,
          breached: breachCount,
        });

        // 3. Process Assets
        const assetList = assetsRes?.assets || assetsRes?.data || [];
        const assetTotal = assetsRes?.pagination?.total || assetList.length;
        const inStockCount = assetList.filter((a) => a.status === 'IN_STOCK').length;
        const assignedCount = assetList.filter((a) => a.status === 'ASSIGNED').length;
        const maintCount = assetList.filter((a) => ['UNDER_MAINTENANCE', 'IN_REPAIR'].includes(a.status)).length;
        const retiredCount = assetList.filter((a) => ['RETIRED', 'DISPOSED', 'LOST'].includes(a.status)).length;
        setAssetData({
          assets: assetList,
          total: assetTotal,
          inStock: inStockCount,
          assigned: assignedCount,
          maintenance: maintCount,
          retired: retiredCount,
        });

        // 4. Synthesize System Activity Stream
        const activities = [];

        ticketList.slice(0, 4).forEach((t) => {
          activities.push({
            id: `t-${t._id}`,
            type: 'TICKET',
            title: `Ticket ${t.ticketNumber}: ${t.title}`,
            subtitle: `Created by ${t.requesterId?.firstName || 'Requester'} • Priority: ${t.priority}`,
            date: t.createdAt,
            link: `/tickets/${t._id}`,
            status: t.status,
            icon: Ticket,
            color: 'var(--color-primary-600)',
          });
        });

        userList.slice(0, 3).forEach((u) => {
          activities.push({
            id: `u-${u._id}`,
            type: 'USER',
            title: `User Account: ${u.firstName} ${u.lastName}`,
            subtitle: `Role: ${u.role} • ${u.departmentId?.name || 'General Dept'}`,
            date: u.createdAt,
            link: '/admin',
            status: u.isActive ? 'ACTIVE' : 'INACTIVE',
            icon: Users,
            color: 'var(--color-indigo-600)',
          });
        });

        assetList.slice(0, 3).forEach((a) => {
          activities.push({
            id: `a-${a._id}`,
            type: 'ASSET',
            title: `Asset ${a.assetTag}: ${a.name}`,
            subtitle: `Type: ${a.assetType} • Status: ${a.status}`,
            date: a.createdAt,
            link: `/assets/${a._id}`,
            status: a.status,
            icon: HardDrive,
            color: 'var(--color-emerald-600)',
          });
        });

        activities.sort((a, b) => new Date(b.date) - new Date(a.date));
        setRecentActivities(activities.slice(0, 8));
        setError(null);
      } catch (err) {
        if (!ignore) {
          console.error('Failed to load system admin metrics:', err);
          setError(err.message || 'Failed to retrieve administrative records.');
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    fetchMetrics();

    return () => {
      ignore = true;
    };
  }, [refreshTrigger]);

  // SLA calculations
  const totalTicketsWithSla = ticketData.total || 0;
  const compliantTickets = Math.max(0, totalTicketsWithSla - ticketData.breached);
  const slaCompliancePct = totalTicketsWithSla > 0
    ? Math.round((compliantTickets / totalTicketsWithSla) * 100)
    : 100;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* Header Banner */}
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
          background: 'linear-gradient(to right, #ffffff, #f8fafc)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              System Administration Console
            </h2>
            <Badge color="purple">SYSTEM ADMIN</Badge>
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            {user?.firstName ? `Administrator: ${user.firstName} ${user.lastName} • ` : ''}Overall operational health, tenant statistics, user directories, and multi-tenant security enforcement.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleRefresh}
            isLoading={isLoading}
            icon={<RotateCw size={14} />}
          >
            Refresh System Status
          </Button>
          <Link to="/admin">
            <Button variant="primary" size="sm" icon={<UserPlus size={14} />}>
              Manage Users
            </Button>
          </Link>
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
          gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
          gap: '1.25rem',
        }}
      >
        {/* User Accounts Stat */}
        <Card>
          <CardBody style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                TOTAL DIRECTORY USERS
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
                <Users size={18} />
              </div>
            </div>
            <div style={{ fontSize: '1.85rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.5rem' }}>
              {isLoading ? <LoadingSpinner size="sm" /> : userData.total}
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.775rem', marginTop: '0.35rem' }}>
              <span style={{ color: 'var(--color-emerald-600)', fontWeight: 600 }}>
                {userData.active} Active
              </span>
              <span style={{ color: 'var(--text-muted)' }}>•</span>
              <span style={{ color: 'var(--text-secondary)' }}>
                {userData.inactive} Deactivated
              </span>
            </div>
          </CardBody>
        </Card>

        {/* Global Tickets Stat */}
        <Card>
          <CardBody style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                GLOBAL TICKETS
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
                <Ticket size={18} />
              </div>
            </div>
            <div style={{ fontSize: '1.85rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.5rem' }}>
              {isLoading ? <LoadingSpinner size="sm" /> : ticketData.total}
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.775rem', marginTop: '0.35rem' }}>
              <span style={{ color: 'var(--color-amber-600)', fontWeight: 600 }}>
                {ticketData.open} Open
              </span>
              <span style={{ color: 'var(--text-muted)' }}>•</span>
              <span style={{ color: 'var(--color-emerald-600)' }}>
                {ticketData.resolved} Resolved
              </span>
            </div>
          </CardBody>
        </Card>

        {/* Total Assets Stat */}
        <Card>
          <CardBody style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                ASSET INVENTORY
              </span>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-emerald-50)',
                  color: 'var(--color-emerald-600)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <HardDrive size={18} />
              </div>
            </div>
            <div style={{ fontSize: '1.85rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.5rem' }}>
              {isLoading ? <LoadingSpinner size="sm" /> : assetData.total}
            </div>
            <div style={{ display: 'flex', gap: '0.625rem', fontSize: '0.775rem', marginTop: '0.35rem', flexWrap: 'wrap' }}>
              <span style={{ color: 'var(--color-primary-600)', fontWeight: 600 }}>
                {assetData.assigned} Assigned
              </span>
              <span style={{ color: 'var(--text-muted)' }}>•</span>
              <span style={{ color: 'var(--color-emerald-600)' }}>
                {assetData.inStock} In Stock
              </span>
              <span style={{ color: 'var(--text-muted)' }}>•</span>
              <span style={{ color: 'var(--color-amber-600)' }}>
                {assetData.maintenance} In Repair
              </span>
              {assetData.retired > 0 && (
                <>
                  <span style={{ color: 'var(--text-muted)' }}>•</span>
                  <span style={{ color: 'var(--text-muted)' }}>
                    {assetData.retired} Retired
                  </span>
                </>
              )}
            </div>
          </CardBody>
        </Card>

        {/* SLA Performance Stat */}
        <Card>
          <CardBody style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                SLA COMPLIANCE
              </span>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: ticketData.breached > 0 ? 'var(--color-rose-50)' : 'var(--color-emerald-50)',
                  color: ticketData.breached > 0 ? 'var(--color-rose-600)' : 'var(--color-emerald-600)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {ticketData.breached > 0 ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
              </div>
            </div>
            <div
              style={{
                fontSize: '1.85rem',
                fontWeight: 700,
                color: slaCompliancePct >= 90 ? 'var(--color-emerald-600)' : 'var(--color-amber-600)',
                marginTop: '0.5rem',
              }}
            >
              {isLoading ? <LoadingSpinner size="sm" /> : `${slaCompliancePct}%`}
            </div>
            <div style={{ fontSize: '0.775rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
              {ticketData.breached} SLA breach{ticketData.breached === 1 ? '' : 'es'} recorded
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Main Content Layout */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)',
          gap: '1.5rem',
        }}
        className="dashboard-columns"
      >
        {/* Left Column: Recent System Activity Feed */}
        <Card>
          <CardHeader
            action={
              <Link to="/tickets">
                <Button variant="ghost" size="sm" icon={<ExternalLink size={14} />}>
                  View All
                </Button>
              </Link>
            }
          >
            <CardTitle style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Activity size={18} style={{ color: 'var(--color-primary-600)' }} />
              Live System Activity Stream
            </CardTitle>
            <CardDescription>
              Real-time cross-module audit trail spanning tickets, assets, and user authorizations
            </CardDescription>
          </CardHeader>

          <CardBody style={{ padding: 0 }}>
            {isLoading ? (
              <div style={{ padding: '3.5rem', textAlign: 'center' }}>
                <LoadingSpinner size="md" color="primary" />
                <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Aggregating system stream...
                </p>
              </div>
            ) : recentActivities.length === 0 ? (
              <div style={{ padding: '2rem' }}>
                <EmptyState
                  icon={Activity}
                  title="No system activity recorded"
                  description="All services are online and awaiting tenant transactions."
                />
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {recentActivities.map((item, idx) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.id || idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '1rem 1.25rem',
                        borderBottom: idx !== recentActivities.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                        transition: 'background-color var(--transition-fast)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                        <div
                          style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: 'var(--radius-md)',
                            backgroundColor: 'var(--color-slate-100)',
                            color: item.color,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <Icon size={18} />
                        </div>
                        <div>
                          <Link
                            to={item.link}
                            style={{
                              fontWeight: 600,
                              fontSize: '0.875rem',
                              color: 'var(--text-primary)',
                              textDecoration: 'none',
                            }}
                          >
                            {item.title}
                          </Link>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                            {item.subtitle}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <Badge variant="status">{item.status}</Badge>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                          {item.date ? new Date(item.date).toLocaleDateString() : '—'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardBody>
        </Card>

        {/* Right Column: Quick Command Hub & System Diagnostics */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Quick Command Hub */}
          <Card>
            <CardHeader>
              <CardTitle>Administrative Command Hub</CardTitle>
              <CardDescription>Rapid administrative navigation</CardDescription>
            </CardHeader>
            <CardBody style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1rem 1.25rem' }}>
              <Link to="/admin" style={{ textDecoration: 'none' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.75rem 1rem',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--border-subtle)',
                    backgroundColor: 'var(--color-slate-50)',
                    transition: 'all var(--transition-fast)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <Users size={18} style={{ color: 'var(--color-primary-600)' }} />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                        User Management
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Accounts, roles, departments
                      </div>
                    </div>
                  </div>
                  <ArrowRight size={16} style={{ color: 'var(--text-muted)' }} />
                </div>
              </Link>

              <Link to="/tickets" style={{ textDecoration: 'none' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.75rem 1rem',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--border-subtle)',
                    backgroundColor: 'var(--color-slate-50)',
                    transition: 'all var(--transition-fast)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <Ticket size={18} style={{ color: 'var(--color-indigo-600)' }} />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                        Global Tickets
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Incident queues & SLA metrics
                      </div>
                    </div>
                  </div>
                  <ArrowRight size={16} style={{ color: 'var(--text-muted)' }} />
                </div>
              </Link>

              <Link to="/assets" style={{ textDecoration: 'none' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.75rem 1rem',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--border-subtle)',
                    backgroundColor: 'var(--color-slate-50)',
                    transition: 'all var(--transition-fast)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <HardDrive size={18} style={{ color: 'var(--color-emerald-600)' }} />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                        Asset Inventory
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Hardware, software, vendors
                      </div>
                    </div>
                  </div>
                  <ArrowRight size={16} style={{ color: 'var(--text-muted)' }} />
                </div>
              </Link>

              <Link to="/reports" style={{ textDecoration: 'none' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.75rem 1rem',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--border-subtle)',
                    backgroundColor: 'var(--color-slate-50)',
                    transition: 'all var(--transition-fast)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <BarChart3 size={18} style={{ color: 'var(--color-amber-600)' }} />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                        Analytics & Reports
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        SLA trends & CSV data exports
                      </div>
                    </div>
                  </div>
                  <ArrowRight size={16} style={{ color: 'var(--text-muted)' }} />
                </div>
              </Link>
            </CardBody>
          </Card>

          {/* System Security & Tenant Boundaries Status */}
          <Card>
            <CardHeader>
              <CardTitle>Security & Infrastructure</CardTitle>
            </CardHeader>
            <CardBody style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--color-emerald-50)',
                    color: 'var(--color-emerald-600)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <ShieldCheck size={16} />
                </div>
                <div>
                  <div style={{ fontWeight: 600 }}>Multi-Tenant Isolation</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Strict organizationId boundary active
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--color-indigo-50)',
                    color: 'var(--color-indigo-600)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Server size={16} />
                </div>
                <div>
                  <div style={{ fontWeight: 600 }}>RBAC Authorization Engine</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Authoritative server-side middleware
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
