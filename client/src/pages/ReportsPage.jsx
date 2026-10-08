import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/useAuth';
import reportService from '../services/reportService';
import Card, { CardHeader, CardTitle, CardBody } from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import Alert from '../components/ui/Alert';
import {
  BarChart3,
  Calendar,
  RotateCw,
  Download,
  Printer,
  ShieldAlert,
  Clock,
  CheckCircle2,
  Users,
  HardDrive,
  Ticket,
  FileSpreadsheet,
} from 'lucide-react';

export const ReportsPage = () => {
  const { user } = useAuth();
  const [dateRange, setDateRange] = useState('30d');
  const [metrics, setMetrics] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [exportNotice, setExportNotice] = useState(null);

  const isAuthorized = ['SYSTEM_ADMIN', 'IT_MANAGER', 'ASSET_MANAGER'].includes(user?.role);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await reportService.getReportMetrics({ dateRange });
      setMetrics(data);
    } catch (err) {
      console.error('Failed to load reporting metrics:', err);
      setError(err.message || 'Unable to retrieve reporting statistics.');
    } finally {
      setIsLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    let ignore = false;
    async function fetchMetrics() {
      setIsLoading(true);
      setError(null);
      try {
        const data = await reportService.getReportMetrics({ dateRange });
        if (!ignore) {
          setMetrics(data);
        }
      } catch (err) {
        if (!ignore) {
          console.error('Failed to load reporting metrics:', err);
          setError(err.message || 'Unable to retrieve reporting statistics.');
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
  }, [dateRange]);

  const handleExportTickets = () => {
    try {
      if (!metrics?.tickets || metrics.tickets.length === 0) {
        setExportNotice({ variant: 'warning', text: 'No ticket records available in the selected filter range to export.' });
        return;
      }
      reportService.exportTicketsCSV(metrics.tickets);
      setExportNotice({ variant: 'success', text: `Successfully exported ${metrics.tickets.length} ticket records to CSV.` });
      setTimeout(() => setExportNotice(null), 4000);
    } catch (err) {
      setExportNotice({ variant: 'error', text: err.message || 'Failed to export tickets CSV.' });
    }
  };

  const handleExportAssets = () => {
    try {
      if (!metrics?.assets || metrics.assets.length === 0) {
        setExportNotice({ variant: 'warning', text: 'No asset inventory records available to export.' });
        return;
      }
      reportService.exportAssetsCSV(metrics.assets);
      setExportNotice({ variant: 'success', text: `Successfully exported ${metrics.assets.length} asset records to CSV.` });
      setTimeout(() => setExportNotice(null), 4000);
    } catch (err) {
      setExportNotice({ variant: 'error', text: err.message || 'Failed to export assets CSV.' });
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (!isAuthorized) {
    return (
      <div style={{ maxWidth: '600px', margin: '3rem auto' }}>
        <Alert variant="error" title="Access Denied">
          You do not possess the required managerial privileges to view system reports and organizational analytics.
        </Alert>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Top Header & Actions Bar */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          padding: '1.5rem',
          backgroundColor: '#ffffff',
          borderRadius: 'var(--radius-xl)',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-xs)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <BarChart3 size={22} style={{ color: 'var(--color-primary-600)' }} />
              <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                Service Desk Analytics & Reports
              </h1>
            </div>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
              Real-time operational KPIs, resolution times, SLA performance, and fleet expenditure.
            </p>
          </div>

          {/* Action Buttons & Filter Toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', backgroundColor: 'var(--color-slate-100)', padding: '0.25rem 0.5rem', borderRadius: 'var(--radius-md)' }}>
              <Calendar size={14} style={{ color: 'var(--text-muted)' }} />
              <select
                id="report-date-range"
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                style={{
                  border: 'none',
                  backgroundColor: 'transparent',
                  fontSize: '0.85rem',
                  fontWeight: 500,
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  outline: 'none',
                }}
              >
                <option value="7d">Past 7 Days</option>
                <option value="30d">Past 30 Days</option>
                <option value="90d">Past 90 Days</option>
                <option value="all">All Time</option>
              </select>
            </div>

            <Button
              variant="secondary"
              size="sm"
              onClick={loadData}
              icon={<RotateCw size={14} />}
              title="Refresh Report Data"
            >
              Refresh
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={handlePrint}
              icon={<Printer size={14} />}
              title="Print or Save as PDF"
            >
              Print / PDF
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={handleExportTickets}
              icon={<FileSpreadsheet size={14} />}
              disabled={isLoading || !metrics?.tickets?.length}
            >
              Export Tickets
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={handleExportAssets}
              icon={<Download size={14} />}
              disabled={isLoading || !metrics?.assets?.length}
            >
              Export Assets
            </Button>
          </div>
        </div>

        {exportNotice && (
          <Alert variant={exportNotice.variant} size="sm" onClose={() => setExportNotice(null)}>
            {exportNotice.text}
          </Alert>
        )}
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '5rem 0' }}>
          <LoadingSpinner size="lg" color="primary" />
          <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>
            Calculating helpdesk metrics and aggregating audit logs...
          </p>
        </div>
      ) : error ? (
        <div style={{ maxWidth: '600px', margin: '2rem auto' }}>
          <Alert variant="error" title="Report Generation Error">
            {error}
          </Alert>
          <div style={{ marginTop: '1rem', textAlign: 'center' }}>
            <Button variant="secondary" onClick={loadData} icon={<RotateCw size={16} />}>
              Retry Aggregation
            </Button>
          </div>
        </div>
      ) : !metrics ? (
        <Alert variant="info">No reporting data returned from server.</Alert>
      ) : (
        <>
          {/* Top KPI Cards Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '1rem',
            }}
          >
            {/* Total Tickets */}
            <Card>
              <CardBody style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.25rem' }}>
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: 'var(--radius-lg)',
                    backgroundColor: 'var(--color-primary-50)',
                    color: 'var(--color-primary-600)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Ticket size={24} />
                </div>
                <div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                    Total Tickets
                  </div>
                  <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.1 }}>
                    {metrics.totalTickets}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    {metrics.activeTicketsCount} active • {metrics.resolvedTicketsCount} resolved
                  </div>
                </div>
              </CardBody>
            </Card>

            {/* SLA Compliance */}
            <Card>
              <CardBody style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.25rem' }}>
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: 'var(--radius-lg)',
                    backgroundColor: metrics.slaComplianceRate >= 90 ? 'var(--color-emerald-50)' : 'var(--color-rose-50)',
                    color: metrics.slaComplianceRate >= 90 ? 'var(--color-emerald-600)' : 'var(--color-rose-600)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {metrics.slaComplianceRate >= 90 ? <CheckCircle2 size={24} /> : <ShieldAlert size={24} />}
                </div>
                <div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                    SLA Compliance
                  </div>
                  <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.1 }}>
                    {metrics.slaComplianceRate}%
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    {metrics.breachedCount} breached • {metrics.approachingBreachCount} approaching
                  </div>
                </div>
              </CardBody>
            </Card>

            {/* Net Avg Resolution Time */}
            <Card>
              <CardBody style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.25rem' }}>
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: 'var(--radius-lg)',
                    backgroundColor: 'var(--color-indigo-50)',
                    color: 'var(--color-indigo-600)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Clock size={24} />
                </div>
                <div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                    Avg Resolution
                  </div>
                  <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.1 }}>
                    {metrics.avgResolutionHours} {metrics.avgResolutionHours !== '—' ? 'hrs' : ''}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    Excluding paused pending time
                  </div>
                </div>
              </CardBody>
            </Card>

            {/* Asset Fleet Capital Value */}
            <Card>
              <CardBody style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.25rem' }}>
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: 'var(--radius-lg)',
                    backgroundColor: 'var(--color-amber-50)',
                    color: 'var(--color-amber-600)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <HardDrive size={24} />
                </div>
                <div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                    Asset Fleet Value
                  </div>
                  <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.1 }}>
                    ${metrics.assetStats.totalProcurementCost.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    {metrics.assetStats.total} total • {metrics.assetStats.assigned} in active use
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>

          {/* Section 1: Distribution Breakdowns (2 Columns) */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
              gap: '1.5rem',
            }}
          >
            {/* Ticket Status Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Ticket Status Distribution</CardTitle>
              </CardHeader>
              <CardBody>
                {metrics.totalTickets === 0 ? (
                  <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 0' }}>
                    No tickets found in the selected time range.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {Object.entries(metrics.statusCounts).map(([st, count]) => {
                      const pct = metrics.totalTickets > 0 ? Math.round((count / metrics.totalTickets) * 100) : 0;
                      let barColor = 'var(--color-slate-400)';
                      if (st === 'OPEN') barColor = 'var(--color-blue-500)';
                      if (st === 'ASSIGNED') barColor = 'var(--color-indigo-500)';
                      if (st === 'IN_PROGRESS') barColor = 'var(--color-purple-500)';
                      if (st === 'PENDING') barColor = 'var(--color-amber-500)';
                      if (st === 'RESOLVED') barColor = 'var(--color-emerald-500)';
                      if (st === 'CLOSED') barColor = 'var(--color-slate-600)';

                      return (
                        <div key={st}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.3rem' }}>
                            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{st}</span>
                            <span style={{ color: 'var(--text-secondary)' }}>
                              {count} tickets ({pct}%)
                            </span>
                          </div>
                          <div style={{ height: '8px', backgroundColor: 'var(--color-slate-100)', borderRadius: '999px', overflow: 'hidden' }}>
                            <div
                              style={{
                                width: `${pct}%`,
                                height: '100%',
                                backgroundColor: barColor,
                                borderRadius: '999px',
                                transition: 'width 0.4s ease',
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

            {/* Priority Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Priority Distribution</CardTitle>
              </CardHeader>
              <CardBody>
                {metrics.totalTickets === 0 ? (
                  <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 0' }}>
                    No tickets found in the selected time range.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {Object.entries(metrics.priorityCounts).map(([pr, count]) => {
                      const pct = metrics.totalTickets > 0 ? Math.round((count / metrics.totalTickets) * 100) : 0;
                      let barColor = 'var(--color-slate-400)';
                      if (pr === 'CRITICAL') barColor = 'var(--color-rose-600)';
                      if (pr === 'HIGH') barColor = 'var(--color-amber-500)';
                      if (pr === 'MEDIUM') barColor = 'var(--color-blue-500)';
                      if (pr === 'LOW') barColor = 'var(--color-slate-500)';

                      return (
                        <div key={pr}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.3rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <Badge variant="priority">{pr}</Badge>
                            </div>
                            <span style={{ color: 'var(--text-secondary)' }}>
                              {count} tickets ({pct}%)
                            </span>
                          </div>
                          <div style={{ height: '8px', backgroundColor: 'var(--color-slate-100)', borderRadius: '999px', overflow: 'hidden' }}>
                            <div
                              style={{
                                width: `${pct}%`,
                                height: '100%',
                                backgroundColor: barColor,
                                borderRadius: '999px',
                                transition: 'width 0.4s ease',
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
          </div>

          {/* Section 2: Technician Workload & Asset Inventory (2 Columns) */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr)))',
              gap: '1.5rem',
            }}
          >
            {/* Technician Workload */}
            <Card>
              <CardHeader>
                <CardTitle style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Users size={18} style={{ color: 'var(--color-primary-600)' }} />
                  Technician Active Workload
                </CardTitle>
              </CardHeader>
              <CardBody>
                {Object.keys(metrics.technicianWorkload).length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 0' }}>
                    No active tickets currently in technician queues.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                    {Object.entries(metrics.technicianWorkload).map(([tech, count]) => {
                      const maxActive = Math.max(...Object.values(metrics.technicianWorkload), 1);
                      const barPct = Math.min(100, Math.round((count / maxActive) * 100));

                      return (
                        <div key={tech}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', marginBottom: '0.3rem' }}>
                            <span style={{ fontWeight: 600, color: tech === 'Unassigned Queue' ? 'var(--color-rose-600)' : 'var(--text-primary)' }}>
                              {tech}
                            </span>
                            <Badge color={tech === 'Unassigned Queue' ? 'red' : 'blue'}>
                              {count} active
                            </Badge>
                          </div>
                          <div style={{ height: '6px', backgroundColor: 'var(--color-slate-100)', borderRadius: '999px', overflow: 'hidden' }}>
                            <div
                              style={{
                                width: `${barPct}%`,
                                height: '100%',
                                backgroundColor: tech === 'Unassigned Queue' ? 'var(--color-rose-500)' : 'var(--color-primary-600)',
                                borderRadius: '999px',
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

            {/* Asset Fleet Status & Categories */}
            <Card>
              <CardHeader>
                <CardTitle style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <HardDrive size={18} style={{ color: 'var(--color-amber-600)' }} />
                  Asset Inventory Fleet Health
                </CardTitle>
              </CardHeader>
              <CardBody>
                {metrics.assetStats.total === 0 ? (
                  <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 0' }}>
                    No hardware or software assets registered.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    {/* Status Badges Row */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', textAlign: 'center' }}>
                      <div style={{ padding: '0.75rem', backgroundColor: 'var(--color-emerald-50)', borderRadius: 'var(--radius-md)' }}>
                        <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-emerald-700)' }}>
                          {metrics.assetStats.assigned}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--color-emerald-800)', fontWeight: 600, textTransform: 'uppercase' }}>
                          Assigned
                        </div>
                      </div>

                      <div style={{ padding: '0.75rem', backgroundColor: 'var(--color-blue-50)', borderRadius: 'var(--radius-md)' }}>
                        <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-blue-700)' }}>
                          {metrics.assetStats.inStock}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--color-blue-800)', fontWeight: 600, textTransform: 'uppercase' }}>
                          In Stock
                        </div>
                      </div>

                      <div style={{ padding: '0.75rem', backgroundColor: 'var(--color-amber-50)', borderRadius: 'var(--radius-md)' }}>
                        <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-amber-700)' }}>
                          {metrics.assetStats.inRepair}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--color-amber-800)', fontWeight: 600, textTransform: 'uppercase' }}>
                          In Repair
                        </div>
                      </div>

                      <div style={{ padding: '0.75rem', backgroundColor: 'var(--color-slate-100)', borderRadius: 'var(--radius-md)' }}>
                        <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-slate-700)' }}>
                          {metrics.assetStats.retired}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--color-slate-800)', fontWeight: 600, textTransform: 'uppercase' }}>
                          Retired
                        </div>
                      </div>
                    </div>

                    {/* Breakdown by Type */}
                    <div>
                      <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                        Equipment Type Breakdown
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {Object.entries(metrics.assetStats.typeDistribution).map(([type, count]) => {
                          const typePct = Math.round((count / metrics.assetStats.total) * 100);
                          return (
                            <div key={type} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                              <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{type}</span>
                              <span style={{ color: 'var(--text-secondary)' }}>
                                {count} units ({typePct}%)
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </CardBody>
            </Card>
          </div>
        </>
      )}
    </div>
  );
};

export default ReportsPage;
