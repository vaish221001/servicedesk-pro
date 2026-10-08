import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Card, { CardHeader, CardTitle, CardDescription, CardBody } from '../ui/Card';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import LoadingSpinner from '../ui/LoadingSpinner';
import Alert from '../ui/Alert';
import EmptyState from '../ui/EmptyState';
import ticketService from '../../services/ticketService';
import {
  Ticket,
  Users,
  Clock,
  AlertTriangle,
  RotateCw,
  ExternalLink,
  CheckCircle2,
  BarChart3,
  Layers,
  ArrowRight,
  TrendingUp,
  Building2,
  BookOpen,
} from 'lucide-react';

export const ManagerDashboard = ({ user }) => {
  const [tickets, setTickets] = useState([]);
  const [ticketMeta, setTicketMeta] = useState({ total: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleRefresh = () => {
    setIsLoading(true);
    setRefreshTrigger((prev) => prev + 1);
  };

  useEffect(() => {
    let ignore = false;

    async function loadData() {
      try {
        const res = await ticketService.getTickets({ limit: 200, sort: '-createdAt' });
        if (ignore) return;
        if (res && res.success) {
          setTickets(res.data || []);
          setTicketMeta(res.pagination || { total: res.data?.length || 0 });
          setError(null);
        }
      } catch (err) {
        if (!ignore) {
          console.error('Failed to load IT Manager dashboard tickets:', err);
          setError(err.message || 'Failed to retrieve departmental ticket queues.');
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
  const statusCounts = {
    OPEN: 0,
    ASSIGNED: 0,
    IN_PROGRESS: 0,
    PENDING: 0,
    RESOLVED: 0,
    CLOSED: 0,
  };

  const technicianWorkload = {};
  const departmentStats = {};
  const highPriorityTickets = [];
  let breachedCount = 0;
  let unassignedCount = 0;

  const now = new Date();

  tickets.forEach((t) => {
    if (statusCounts[t.status] !== undefined) {
      statusCounts[t.status]++;
    }

    // Overdue or SLA Breached
    const isOverdue =
      t.isResponseBreached ||
      t.isResolutionBreached ||
      (t.resolutionDue && new Date(t.resolutionDue) < now && !['RESOLVED', 'CLOSED'].includes(t.status));

    if (isOverdue) {
      breachedCount++;
    }

    // High Priority Active Tickets
    if (['HIGH', 'CRITICAL'].includes(t.priority) && !['RESOLVED', 'CLOSED'].includes(t.status)) {
      highPriorityTickets.push(t);
    }

    // Technician Workload
    if (t.assignedTo) {
      const techKey = t.assignedTo._id || t.assignedTo;
      const techName = t.assignedTo.firstName
        ? `${t.assignedTo.firstName} ${t.assignedTo.lastName}`
        : 'Assigned Tech';

      if (!technicianWorkload[techKey]) {
        technicianWorkload[techKey] = {
          id: techKey,
          name: techName,
          email: t.assignedTo.email || '',
          total: 0,
          active: 0,
          resolved: 0,
        };
      }
      technicianWorkload[techKey].total++;
      if (['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'PENDING'].includes(t.status)) {
        technicianWorkload[techKey].active++;
      } else {
        technicianWorkload[techKey].resolved++;
      }
    } else if (!['RESOLVED', 'CLOSED'].includes(t.status)) {
      unassignedCount++;
    }

    // Department Distribution
    const deptName = t.departmentId?.name || 'General Operations';
    departmentStats[deptName] = (departmentStats[deptName] || 0) + 1;
  });

  const totalTickets = ticketMeta.total || tickets.length;
  const activeQueueCount = statusCounts.OPEN + statusCounts.ASSIGNED + statusCounts.IN_PROGRESS + statusCounts.PENDING;
  const resolvedCount = statusCounts.RESOLVED + statusCounts.CLOSED;
  const slaCompliancePct = totalTickets > 0
    ? Math.max(0, Math.round(((totalTickets - breachedCount) / totalTickets) * 100))
    : 100;

  const technicianList = Object.values(technicianWorkload).sort((a, b) => b.active - a.active);
  const departmentEntries = Object.entries(departmentStats).sort((a, b) => b[1] - a[1]);

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
          background: 'linear-gradient(to right, #ffffff, #f0fdf4)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              IT Operations Command
            </h2>
            <Badge color="blue">IT MANAGER</Badge>
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            {user?.firstName ? `Manager: ${user.firstName} ${user.lastName} • ` : ''}Service level tracking, technician workload balancing, high-priority escalations, and department dispatch.
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
            Refresh Workload
          </Button>
          <Link to="/reports">
            <Button variant="primary" size="sm" icon={<BarChart3 size={14} />}>
              Analytics & SLA
            </Button>
          </Link>
        </div>
      </div>

      {error && (
        <Alert variant="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* KPI Stats Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '1.25rem',
        }}
      >
        {/* Total Active Queue */}
        <Card>
          <CardBody style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                ACTIVE WORK QUEUE
              </span>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-primary-50)',
                  color: 'var(--color-primary-600)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Layers size={18} />
              </div>
            </div>
            <div style={{ fontSize: '1.85rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.5rem' }}>
              {isLoading ? <LoadingSpinner size="sm" /> : activeQueueCount}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              {unassignedCount > 0 ? (
                <span style={{ color: 'var(--color-amber-600)', fontWeight: 600 }}>
                  ⚠️ {unassignedCount} unassigned ticket{unassignedCount === 1 ? '' : 's'}
                </span>
              ) : (
                'All tickets assigned to team'
              )}
            </div>
          </CardBody>
        </Card>

        {/* High Priority Criticals */}
        <Card>
          <CardBody style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                HIGH & CRITICAL
              </span>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-rose-50)',
                  color: 'var(--color-rose-600)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <AlertTriangle size={18} />
              </div>
            </div>
            <div style={{ fontSize: '1.85rem', fontWeight: 700, color: 'var(--color-rose-600)', marginTop: '0.5rem' }}>
              {isLoading ? <LoadingSpinner size="sm" /> : highPriorityTickets.length}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              Immediate managerial oversight
            </div>
          </CardBody>
        </Card>

        {/* SLA Compliance % */}
        <Card>
          <CardBody style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                SLA COMPLIANCE
              </span>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: breachedCount > 0 ? 'var(--color-amber-50)' : 'var(--color-emerald-50)',
                  color: breachedCount > 0 ? 'var(--color-amber-600)' : 'var(--color-emerald-600)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {breachedCount > 0 ? <Clock size={18} /> : <CheckCircle2 size={18} />}
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
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              {breachedCount} breached / overdue ticket{breachedCount === 1 ? '' : 's'}
            </div>
          </CardBody>
        </Card>

        {/* Resolved Total */}
        <Card>
          <CardBody style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                RESOLVED INCIDENTS
              </span>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-emerald-50)',
                  color: 'var(--color-emerald-600)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <CheckCircle2 size={18} />
              </div>
            </div>
            <div style={{ fontSize: '1.85rem', fontWeight: 700, color: 'var(--color-emerald-600)', marginTop: '0.5rem' }}>
              {isLoading ? <LoadingSpinner size="sm" /> : resolvedCount}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              Out of {totalTickets} total recorded
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Main Layout: High-Priority Queue + Team Workload & Department Stats */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)',
          gap: '1.5rem',
        }}
        className="dashboard-columns"
      >
        {/* Left: High-Priority & Escalated Tickets */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <Card>
            <CardHeader
              action={
                <Link to="/tickets">
                  <Button variant="ghost" size="sm" icon={<ExternalLink size={14} />}>
                    View Queue
                  </Button>
                </Link>
              }
            >
              <CardTitle style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertTriangle size={18} style={{ color: 'var(--color-rose-600)' }} />
                Priority Escalation Queue (High & Critical)
              </CardTitle>
              <CardDescription>
                Incidents requiring urgent technical resolution and SLA enforcement
              </CardDescription>
            </CardHeader>

            <CardBody style={{ padding: 0 }}>
              {isLoading ? (
                <div style={{ padding: '3rem', textAlign: 'center' }}>
                  <LoadingSpinner size="md" color="primary" />
                  <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Loading priority queue...
                  </p>
                </div>
              ) : highPriorityTickets.length === 0 ? (
                <div style={{ padding: '2rem' }}>
                  <EmptyState
                    icon={CheckCircle2}
                    title="No high-priority escalations"
                    description="All critical and high-priority tickets have been resolved or are within standard SLA limits."
                  />
                </div>
              ) : (
                <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Ticket #</th>
                        <th>Subject</th>
                        <th>Department</th>
                        <th>Priority</th>
                        <th>Status</th>
                        <th>Assignee</th>
                      </tr>
                    </thead>
                    <tbody>
                      {highPriorityTickets.slice(0, 6).map((t) => (
                        <tr key={t._id}>
                          <td style={{ fontWeight: 600 }}>
                            <Link
                              to={`/tickets/${t._id}`}
                              style={{
                                color: 'var(--color-primary-600)',
                                textDecoration: 'none',
                                fontFamily: 'var(--font-mono)',
                              }}
                            >
                              {t.ticketNumber}
                            </Link>
                          </td>
                          <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <Link
                              to={`/tickets/${t._id}`}
                              style={{
                                color: 'var(--text-primary)',
                                textDecoration: 'none',
                                fontWeight: 500,
                              }}
                            >
                              {t.title}
                            </Link>
                          </td>
                          <td style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                            {t.departmentId?.name || 'General'}
                          </td>
                          <td>
                            <Badge variant="priority">{t.priority}</Badge>
                          </td>
                          <td>
                            <Badge variant="status">{t.status}</Badge>
                          </td>
                          <td style={{ fontSize: '0.8125rem' }}>
                            {t.assignedTo ? (
                              <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                                {t.assignedTo.firstName} {t.assignedTo.lastName}
                              </span>
                            ) : (
                              <span style={{ color: 'var(--color-amber-600)', fontWeight: 600 }}>
                                Unassigned
                              </span>
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

          {/* Ticket Status Breakdown Card */}
          <Card>
            <CardHeader>
              <CardTitle>Ticket Lifecycle Breakdown</CardTitle>
              <CardDescription>Real-time distribution across processing stages</CardDescription>
            </CardHeader>
            <CardBody style={{ padding: '1.25rem' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                  gap: '0.75rem',
                }}
              >
                <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-slate-50)', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>OPEN</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
                    {statusCounts.OPEN}
                  </div>
                </div>

                <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-blue-50)', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-blue-700)', fontWeight: 600 }}>ASSIGNED</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--color-blue-600)', marginTop: '2px' }}>
                    {statusCounts.ASSIGNED}
                  </div>
                </div>

                <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-sky-50)', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-sky-700)', fontWeight: 600 }}>IN PROGRESS</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--color-sky-600)', marginTop: '2px' }}>
                    {statusCounts.IN_PROGRESS}
                  </div>
                </div>

                <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-amber-50)', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-amber-700)', fontWeight: 600 }}>PENDING</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--color-amber-600)', marginTop: '2px' }}>
                    {statusCounts.PENDING}
                  </div>
                </div>

                <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-emerald-50)', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-emerald-700)', fontWeight: 600 }}>RESOLVED</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--color-emerald-600)', marginTop: '2px' }}>
                    {statusCounts.RESOLVED}
                  </div>
                </div>

                <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-slate-100)', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-slate-600)', fontWeight: 600 }}>CLOSED</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--color-slate-700)', marginTop: '2px' }}>
                    {statusCounts.CLOSED}
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Right: Team Workload & Department Statistics */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Team Workload Card */}
          <Card>
            <CardHeader>
              <CardTitle style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Users size={18} style={{ color: 'var(--color-primary-600)' }} />
                Technician Workload Balance
              </CardTitle>
              <CardDescription>Active ticket allocation across support staff</CardDescription>
            </CardHeader>

            <CardBody style={{ padding: '0.75rem 1.25rem' }}>
              {isLoading ? (
                <div style={{ padding: '1.5rem', textAlign: 'center' }}>
                  <LoadingSpinner size="sm" color="primary" />
                </div>
              ) : technicianList.length === 0 ? (
                <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  No technicians currently assigned to active tickets.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  {technicianList.map((tech) => (
                    <div
                      key={tech.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingBottom: '0.75rem',
                        borderBottom: '1px solid var(--border-subtle)',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                          {tech.name}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {tech.resolved} resolved to date
                        </div>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '0.2rem 0.6rem',
                            borderRadius: 'var(--radius-full)',
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            backgroundColor: tech.active > 5 ? 'var(--color-amber-100)' : 'var(--color-primary-50)',
                            color: tech.active > 5 ? 'var(--color-amber-800)' : 'var(--color-primary-700)',
                          }}
                        >
                          {tech.active} active
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>

          {/* Department Statistics */}
          <Card>
            <CardHeader>
              <CardTitle style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Building2 size={18} style={{ color: 'var(--color-indigo-600)' }} />
                Department Ticket Distribution
              </CardTitle>
            </CardHeader>
            <CardBody style={{ padding: '1rem 1.25rem' }}>
              {isLoading ? (
                <div style={{ padding: '1.5rem', textAlign: 'center' }}>
                  <LoadingSpinner size="sm" color="primary" />
                </div>
              ) : departmentEntries.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  No departmental records found.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {departmentEntries.map(([deptName, count]) => {
                    const pct = totalTickets > 0 ? Math.round((count / totalTickets) * 100) : 0;
                    return (
                      <div key={deptName}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', marginBottom: '0.25rem' }}>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{deptName}</span>
                          <span style={{ color: 'var(--text-muted)' }}>{count} ({pct}%)</span>
                        </div>
                        <div style={{ height: '6px', borderRadius: 'var(--radius-full)', backgroundColor: 'var(--color-slate-100)', overflow: 'hidden' }}>
                          <div
                            style={{
                              height: '100%',
                              width: `${pct}%`,
                              backgroundColor: 'var(--color-indigo-500)',
                              borderRadius: 'var(--radius-full)',
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardBody>
          </Card>

          {/* Quick Links Card */}
          <Card>
            <CardHeader>
              <CardTitle>Manager Shortcuts</CardTitle>
            </CardHeader>
            <CardBody style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '1rem 1.25rem' }}>
              <Link to="/tickets" style={{ textDecoration: 'none' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.65rem 0.85rem',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--color-slate-50)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Ticket size={16} style={{ color: 'var(--color-primary-600)' }} />
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      All ServiceDesk Tickets
                    </span>
                  </div>
                  <ArrowRight size={14} style={{ color: 'var(--text-muted)' }} />
                </div>
              </Link>

              <Link to="/reports" style={{ textDecoration: 'none' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.65rem 0.85rem',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--color-slate-50)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <TrendingUp size={16} style={{ color: 'var(--color-emerald-600)' }} />
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      Analytics & Performance Export
                    </span>
                  </div>
                  <ArrowRight size={14} style={{ color: 'var(--text-muted)' }} />
                </div>
              </Link>

              <Link to="/knowledge-base" style={{ textDecoration: 'none' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.65rem 0.85rem',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--color-slate-50)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <BookOpen size={16} style={{ color: 'var(--color-sky-600)' }} />
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      Knowledge Base Documentation
                    </span>
                  </div>
                  <ArrowRight size={14} style={{ color: 'var(--text-muted)' }} />
                </div>
              </Link>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ManagerDashboard;
