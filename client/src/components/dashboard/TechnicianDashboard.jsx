import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import Card, { CardHeader, CardTitle, CardDescription, CardBody } from '../ui/Card';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import LoadingSpinner from '../ui/LoadingSpinner';
import Alert from '../ui/Alert';
import EmptyState from '../ui/EmptyState';
import Modal from '../ui/Modal';
import Input from '../ui/Input';
import ticketService from '../../services/ticketService';
import knowledgeService from '../../services/knowledgeService';
import { ChangeStatusModal } from '../tickets/ChangeStatusModal';
import { CreateTicketModal } from '../tickets/CreateTicketModal';
import {
  Ticket,
  Clock,
  AlertTriangle,
  RotateCw,
  ExternalLink,
  CheckCircle2,
  BookOpen,
  PlusCircle,
  Timer,
  Layers,
  Search,
  ArrowRight,
  Flame,
  CheckCircle,
  FileText,
} from 'lucide-react';

export const TechnicianDashboard = ({ user }) => {
  const [tickets, setTickets] = useState([]);
  const [kbArticles, setKbArticles] = useState([]);
  const [workLogs, setWorkLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isKbLoading, setIsKbLoading] = useState(false);
  const [error, setError] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Filters & Tabs
  const [activeTab, setActiveTab] = useState('workbench'); // 'workbench' | 'high_priority' | 'breakdown'
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [kbSearch, setKbSearch] = useState('');

  // Modals state
  const [statusModalTicket, setStatusModalTicket] = useState(null);
  const [isCreateTicketOpen, setIsCreateTicketOpen] = useState(false);
  const [isLogWorkOpen, setIsLogWorkOpen] = useState(false);
  const [selectedTicketForWorkLog, setSelectedTicketForWorkLog] = useState('');
  const [workLogMinutes, setWorkLogMinutes] = useState(30);
  const [workLogDescription, setWorkLogDescription] = useState('');
  const [workLogDate, setWorkLogDate] = useState(new Date().toISOString().split('T')[0]);
  const [isSubmittingWorkLog, setIsSubmittingWorkLog] = useState(false);
  const [workLogSuccessMsg, setWorkLogSuccessMsg] = useState(null);

  const handleRefresh = () => {
    setIsLoading(true);
    setRefreshTrigger((prev) => prev + 1);
  };

  useEffect(() => {
    let ignore = false;

    async function loadData() {
      try {
        // 1. Fetch tickets accessible to technician (scoped by backend)
        const res = await ticketService.getTickets({ limit: 100, sort: '-createdAt' });
        if (ignore) return;
        const ticketList = res?.data || [];
        setTickets(ticketList);

        // 2. Fetch recent work logs across assigned tickets
        const assignedTickets = ticketList.filter(
          (t) => (t.assignedTo?._id || t.assignedTo) === user?._id
        );

        // Fetch work logs for the top 5 recently active assigned tickets
        const logsAccumulator = [];
        const ticketsToCheck = assignedTickets.slice(0, 6);
        
        await Promise.all(
          ticketsToCheck.map(async (t) => {
            try {
              const logsRes = await ticketService.getWorkLogs(t._id);
              if (logsRes && logsRes.success && Array.isArray(logsRes.data)) {
                logsRes.data.forEach((log) => {
                  logsAccumulator.push({
                    ...log,
                    ticketId: t._id,
                    ticketNumber: t.ticketNumber,
                    ticketTitle: t.title,
                  });
                });
              }
            } catch {
              // Silently ignore individual ticket log fetch errors
            }
          })
        );

        if (!ignore) {
          logsAccumulator.sort((a, b) => new Date(b.createdAt || b.workDate) - new Date(a.createdAt || a.workDate));
          setWorkLogs(logsAccumulator);
        }

        // 3. Fetch Knowledge Base articles
        setIsKbLoading(true);
        try {
          const kbRes = await knowledgeService.getArticles({ status: 'PUBLISHED', limit: 8 });
          if (!ignore && kbRes && kbRes.success) {
            setKbArticles(kbRes.data || []);
          }
        } catch {
          // KB fallback
        } finally {
          if (!ignore) {
            setIsKbLoading(false);
          }
        }
        if (!ignore) {
          setError(null);
        }
      } catch (err) {
        if (!ignore) {
          console.error('Failed to load technician dashboard data:', err);
          setError(err.message || 'Failed to retrieve technician workbench data.');
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
  }, [user?._id, refreshTrigger]);

  // Derived datasets
  const myAssignedTickets = useMemo(() => {
    return tickets.filter((t) => (t.assignedTo?._id || t.assignedTo) === user?._id);
  }, [tickets, user?._id]);

  const activeAssignedTickets = useMemo(() => {
    return myAssignedTickets.filter((t) => ['ASSIGNED', 'IN_PROGRESS', 'PENDING'].includes(t.status));
  }, [myAssignedTickets]);

  const highPriorityTickets = useMemo(() => {
    return tickets.filter(
      (t) =>
        ['HIGH', 'CRITICAL'].includes(t.priority) &&
        !['RESOLVED', 'CLOSED'].includes(t.status)
    );
  }, [tickets]);

  const overdueTickets = useMemo(() => {
    const now = new Date();
    return tickets.filter(
      (t) =>
        !['RESOLVED', 'CLOSED'].includes(t.status) &&
        (t.isResponseBreached ||
          t.isResolutionBreached ||
          (t.resolutionDue && new Date(t.resolutionDue) < now))
    );
  }, [tickets]);

  // Status & Priority groupings
  const statusGrouping = useMemo(() => {
    const groups = {
      ASSIGNED: [],
      IN_PROGRESS: [],
      PENDING: [],
      RESOLVED: [],
      CLOSED: [],
    };
    myAssignedTickets.forEach((t) => {
      if (groups[t.status]) {
        groups[t.status].push(t);
      }
    });
    return groups;
  }, [myAssignedTickets]);

  const priorityGrouping = useMemo(() => {
    const groups = {
      CRITICAL: [],
      HIGH: [],
      MEDIUM: [],
      LOW: [],
    };
    myAssignedTickets.forEach((t) => {
      if (groups[t.priority]) {
        groups[t.priority].push(t);
      }
    });
    return groups;
  }, [myAssignedTickets]);

  // Filtered workbench list
  const filteredWorkbenchTickets = useMemo(() => {
    if (statusFilter === 'ALL') return myAssignedTickets;
    if (statusFilter === 'ACTIVE') {
      return myAssignedTickets.filter((t) => ['ASSIGNED', 'IN_PROGRESS', 'PENDING'].includes(t.status));
    }
    return myAssignedTickets.filter((t) => t.status === statusFilter);
  }, [myAssignedTickets, statusFilter]);

  // Filtered KB articles
  const filteredKbArticles = useMemo(() => {
    if (!kbSearch.trim()) return kbArticles;
    const q = kbSearch.toLowerCase();
    return kbArticles.filter(
      (a) =>
        a.title?.toLowerCase().includes(q) ||
        a.summary?.toLowerCase().includes(q) ||
        a.category?.name?.toLowerCase().includes(q) ||
        a.tags?.some((tag) => tag.toLowerCase().includes(q))
    );
  }, [kbArticles, kbSearch]);

  // Handle Quick Work Log submit
  const handleLogWorkSubmit = async (e) => {
    e.preventDefault();
    if (!selectedTicketForWorkLog) {
      alert('Please select a ticket to log work on.');
      return;
    }
    if (!workLogDescription.trim()) {
      alert('Please provide a description of the work performed.');
      return;
    }
    setIsSubmittingWorkLog(true);
    try {
      await ticketService.createWorkLog(selectedTicketForWorkLog, {
        timeSpentMinutes: Number(workLogMinutes),
        description: workLogDescription.trim(),
        workDate: workLogDate,
      });
      setIsLogWorkOpen(false);
      setWorkLogDescription('');
      setWorkLogMinutes(30);
      setWorkLogSuccessMsg('Work log successfully recorded!');
      setTimeout(() => setWorkLogSuccessMsg(null), 4000);
      handleRefresh();
    } catch (err) {
      alert(err.message || 'Failed to record work log');
    } finally {
      setIsSubmittingWorkLog(false);
    }
  };

  const getPriorityBadge = (priority) => {
    switch (priority) {
      case 'CRITICAL':
        return <Badge color="red">CRITICAL</Badge>;
      case 'HIGH':
        return <Badge color="orange">HIGH</Badge>;
      case 'MEDIUM':
        return <Badge color="blue">MEDIUM</Badge>;
      case 'LOW':
      default:
        return <Badge color="gray">LOW</Badge>;
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'OPEN':
        return <Badge color="gray">OPEN</Badge>;
      case 'ASSIGNED':
        return <Badge color="blue">ASSIGNED</Badge>;
      case 'IN_PROGRESS':
        return <Badge color="purple">IN PROGRESS</Badge>;
      case 'PENDING':
        return <Badge color="yellow">PENDING</Badge>;
      case 'RESOLVED':
        return <Badge color="green">RESOLVED</Badge>;
      case 'CLOSED':
        return <Badge color="gray">CLOSED</Badge>;
      default:
        return <Badge color="gray">{status}</Badge>;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* Technician Header Banner */}
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
              Technician Operational Workbench
            </h2>
            <Badge color="green">TECHNICIAN</Badge>
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Manage your assigned tasks, meet resolution SLAs, log hands-on engineering hours, and resolve incident queues.
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
            Refresh Queue
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              if (activeAssignedTickets.length > 0) {
                setSelectedTicketForWorkLog(activeAssignedTickets[0]._id);
              }
              setIsLogWorkOpen(true);
            }}
            icon={<Timer size={14} />}
          >
            Log Work
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsCreateTicketOpen(true)}
            icon={<PlusCircle size={14} />}
          >
            Create Ticket
          </Button>
        </div>
      </div>

      {workLogSuccessMsg && (
        <Alert variant="success" onClose={() => setWorkLogSuccessMsg(null)}>
          {workLogSuccessMsg}
        </Alert>
      )}

      {error && (
        <Alert variant="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* KPI Cards Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1.25rem',
        }}
      >
        {/* Card 1: My Assigned Tickets */}
        <Card>
          <CardBody style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                MY ASSIGNED TICKETS
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
                <Ticket size={18} />
              </div>
            </div>
            <div style={{ fontSize: '1.85rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.5rem' }}>
              {isLoading ? <LoadingSpinner size="sm" /> : myAssignedTickets.length}
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.775rem', marginTop: '0.35rem' }}>
              <span style={{ color: 'var(--color-primary-600)', fontWeight: 600 }}>
                {activeAssignedTickets.length} Active in Flight
              </span>
            </div>
          </CardBody>
        </Card>

        {/* Card 2: High & Critical Priority */}
        <Card>
          <CardBody style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                HIGH & CRITICAL ESCALATIONS
              </span>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: '#fef2f2',
                  color: '#dc2626',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Flame size={18} />
              </div>
            </div>
            <div style={{ fontSize: '1.85rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.5rem' }}>
              {isLoading ? <LoadingSpinner size="sm" /> : highPriorityTickets.length}
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.775rem', marginTop: '0.35rem' }}>
              <span style={{ color: highPriorityTickets.length > 0 ? '#dc2626' : 'var(--text-muted)', fontWeight: 600 }}>
                Requires immediate handling
              </span>
            </div>
          </CardBody>
        </Card>

        {/* Card 3: Overdue & SLA Breached */}
        <Card>
          <CardBody style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                SLA OVERDUE / BREACHED
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
                <AlertTriangle size={18} />
              </div>
            </div>
            <div style={{ fontSize: '1.85rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.5rem' }}>
              {isLoading ? <LoadingSpinner size="sm" /> : overdueTickets.length}
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.775rem', marginTop: '0.35rem' }}>
              <span style={{ color: overdueTickets.length > 0 ? '#b45309' : 'var(--color-emerald-600)', fontWeight: 600 }}>
                {overdueTickets.length > 0 ? 'Resolution target passed' : '100% SLA compliance'}
              </span>
            </div>
          </CardBody>
        </Card>

        {/* Card 4: Recent Work Logs Recorded */}
        <Card>
          <CardBody style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                LOGGED WORK ENTRIES
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
                <Clock size={18} />
              </div>
            </div>
            <div style={{ fontSize: '1.85rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.5rem' }}>
              {isLoading ? <LoadingSpinner size="sm" /> : workLogs.length}
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.775rem', marginTop: '0.35rem' }}>
              <span style={{ color: 'var(--color-indigo-600)', fontWeight: 600 }}>
                {workLogs.reduce((acc, curr) => acc + (curr.timeSpentMinutes || 0), 0)} min logged across tasks
              </span>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Main Workbench Navigation Tabs */}
      <div
        style={{
          display: 'flex',
          borderBottom: '1px solid var(--border-subtle)',
          gap: '1.5rem',
        }}
      >
        <button
          onClick={() => setActiveTab('workbench')}
          style={{
            background: 'none',
            border: 'none',
            padding: '0.75rem 0.25rem',
            fontSize: '0.95rem',
            fontWeight: 600,
            cursor: 'pointer',
            color: activeTab === 'workbench' ? 'var(--color-primary-600)' : 'var(--text-muted)',
            borderBottom: activeTab === 'workbench' ? '2px solid var(--color-primary-600)' : '2px solid transparent',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <Ticket size={16} />
          My Assigned Workbench ({myAssignedTickets.length})
        </button>

        <button
          onClick={() => setActiveTab('high_priority')}
          style={{
            background: 'none',
            border: 'none',
            padding: '0.75rem 0.25rem',
            fontSize: '0.95rem',
            fontWeight: 600,
            cursor: 'pointer',
            color: activeTab === 'high_priority' ? '#dc2626' : 'var(--text-muted)',
            borderBottom: activeTab === 'high_priority' ? '2px solid #dc2626' : '2px solid transparent',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <Flame size={16} />
          High-Priority & Overdue ({highPriorityTickets.length + overdueTickets.length})
        </button>

        <button
          onClick={() => setActiveTab('breakdown')}
          style={{
            background: 'none',
            border: 'none',
            padding: '0.75rem 0.25rem',
            fontSize: '0.95rem',
            fontWeight: 600,
            cursor: 'pointer',
            color: activeTab === 'breakdown' ? 'var(--color-indigo-600)' : 'var(--text-muted)',
            borderBottom: activeTab === 'breakdown' ? '2px solid var(--color-indigo-600)' : '2px solid transparent',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <Layers size={16} />
          Status & Priority Grouping
        </button>
      </div>

      {/* TAB CONTENT 1: MY ASSIGNED WORKBENCH */}
      {activeTab === 'workbench' && (
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
              <CardTitle>My Active Assigned Tickets</CardTitle>
              <CardDescription>
                Directly open, manage lifecycle status, and record operational updates.
              </CardDescription>
            </div>

            {/* Sub-filters for Workbench */}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {['ALL', 'ACTIVE', 'IN_PROGRESS', 'PENDING', 'RESOLVED'].map((filterVal) => (
                <button
                  key={filterVal}
                  onClick={() => setStatusFilter(filterVal)}
                  style={{
                    padding: '0.35rem 0.75rem',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    borderRadius: 'var(--radius-full)',
                    border: '1px solid',
                    borderColor: statusFilter === filterVal ? 'var(--color-primary-600)' : 'var(--border-subtle)',
                    backgroundColor: statusFilter === filterVal ? 'var(--color-primary-50)' : '#ffffff',
                    color: statusFilter === filterVal ? 'var(--color-primary-700)' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {filterVal.replace('_', ' ')}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardBody style={{ padding: 0 }}>
            {isLoading ? (
              <div style={{ padding: '3rem', display: 'flex', justifyContent: 'center' }}>
                <LoadingSpinner size="lg" />
              </div>
            ) : filteredWorkbenchTickets.length === 0 ? (
              <div style={{ padding: '2rem' }}>
                <EmptyState
                  icon={CheckCircle2}
                  title="No assigned tickets in this filter"
                  description={
                    statusFilter === 'ALL'
                      ? "You currently have no tickets assigned directly to your account. Great job clearing the queue!"
                      : `No assigned tickets currently matching status: ${statusFilter}.`
                  }
                  action={
                    <Link to="/tickets">
                      <Button variant="secondary" size="sm">
                        View Team Queue
                      </Button>
                    </Link>
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
                      <th style={{ padding: '0.75rem 1rem' }}>Ticket Number</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Subject & Requester</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Priority</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                      <th style={{ padding: '0.75rem 1rem' }}>SLA Target</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredWorkbenchTickets.map((t) => {
                      const isOverdue =
                        t.isResponseBreached ||
                        t.isResolutionBreached ||
                        (t.resolutionDue && new Date(t.resolutionDue) < new Date() && !['RESOLVED', 'CLOSED'].includes(t.status));

                      return (
                        <tr
                          key={t._id}
                          style={{
                            borderBottom: '1px solid var(--border-subtle)',
                            transition: 'background-color 0.15s ease',
                          }}
                        >
                          <td style={{ padding: '0.875rem 1rem', whiteSpace: 'nowrap' }}>
                            <Link
                              to={`/tickets/${t._id}`}
                              style={{
                                fontWeight: 700,
                                color: 'var(--color-primary-600)',
                                textDecoration: 'none',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.25rem',
                              }}
                            >
                              {t.ticketNumber}
                              <ExternalLink size={12} />
                            </Link>
                          </td>
                          <td style={{ padding: '0.875rem 1rem' }}>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.875rem' }}>
                              {t.title}
                            </div>
                            <div style={{ fontSize: '0.775rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                              Requester: {t.requesterId?.firstName} {t.requesterId?.lastName}
                              {t.departmentId?.name ? ` • ${t.departmentId.name}` : ''}
                            </div>
                          </td>
                          <td style={{ padding: '0.875rem 1rem', whiteSpace: 'nowrap' }}>
                            {getPriorityBadge(t.priority)}
                          </td>
                          <td style={{ padding: '0.875rem 1rem', whiteSpace: 'nowrap' }}>
                            {getStatusBadge(t.status)}
                          </td>
                          <td style={{ padding: '0.875rem 1rem', whiteSpace: 'nowrap', fontSize: '0.8125rem' }}>
                            {isOverdue ? (
                              <span style={{ color: '#dc2626', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                <AlertTriangle size={13} /> SLA Breached
                              </span>
                            ) : t.resolutionDue ? (
                              <span style={{ color: 'var(--text-secondary)' }}>
                                {new Date(t.resolutionDue).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })},{' '}
                                {new Date(t.resolutionDue).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                              </span>
                            ) : (
                              <span style={{ color: 'var(--text-muted)' }}>Standard</span>
                            )}
                          </td>
                          <td style={{ padding: '0.875rem 1rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                              <Button
                                size="xs"
                                variant="secondary"
                                onClick={() => setStatusModalTicket(t)}
                              >
                                Update Status
                              </Button>
                              <Link to={`/tickets/${t._id}`}>
                                <Button size="xs" variant="primary">
                                  Open
                                </Button>
                              </Link>
                            </div>
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

      {/* TAB CONTENT 2: HIGH-PRIORITY & OVERDUE TASKS */}
      {activeTab === 'high_priority' && (
        <Card>
          <CardHeader>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Flame size={20} color="#dc2626" />
              <div>
                <CardTitle>High-Priority Escalations & SLA Breaches</CardTitle>
                <CardDescription>
                  Urgent tickets requiring prompt incident intervention across your scope.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardBody style={{ padding: 0 }}>
            {highPriorityTickets.length === 0 && overdueTickets.length === 0 ? (
              <div style={{ padding: '2rem' }}>
                <EmptyState
                  icon={CheckCircle}
                  title="No Escalated Tickets"
                  description="All high-priority tickets are resolved and no SLAs are currently breached."
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
                      <th style={{ padding: '0.75rem 1rem' }}>Ticket</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Subject</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Priority</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Assignee</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Combine unique tickets from high priority & overdue */}
                    {Array.from(new Set([...highPriorityTickets, ...overdueTickets])).map((t) => (
                      <tr
                        key={t._id}
                        style={{
                          borderBottom: '1px solid var(--border-subtle)',
                        }}
                      >
                        <td style={{ padding: '0.875rem 1rem', whiteSpace: 'nowrap' }}>
                          <Link
                            to={`/tickets/${t._id}`}
                            style={{
                              fontWeight: 700,
                              color: '#dc2626',
                              textDecoration: 'none',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                            }}
                          >
                            {t.ticketNumber}
                            <ExternalLink size={12} />
                          </Link>
                        </td>
                        <td style={{ padding: '0.875rem 1rem' }}>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.875rem' }}>
                            {t.title}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            Requester: {t.requesterId?.firstName} {t.requesterId?.lastName}
                          </div>
                        </td>
                        <td style={{ padding: '0.875rem 1rem' }}>{getPriorityBadge(t.priority)}</td>
                        <td style={{ padding: '0.875rem 1rem' }}>{getStatusBadge(t.status)}</td>
                        <td style={{ padding: '0.875rem 1rem', fontSize: '0.8125rem' }}>
                          {t.assignedTo ? `${t.assignedTo.firstName} ${t.assignedTo.lastName}` : (
                            <Badge color="orange">UNASSIGNED</Badge>
                          )}
                        </td>
                        <td style={{ padding: '0.875rem 1rem', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                            <Button
                              size="xs"
                              variant="secondary"
                              onClick={() => setStatusModalTicket(t)}
                            >
                              Update Status
                            </Button>
                            <Link to={`/tickets/${t._id}`}>
                              <Button size="xs" variant="primary">
                                Open Ticket
                              </Button>
                            </Link>
                          </div>
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

      {/* TAB CONTENT 3: STATUS & PRIORITY GROUPINGS */}
      {activeTab === 'breakdown' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
          {/* Status Breakdown Card */}
          <Card>
            <CardHeader>
              <CardTitle>My Tickets by Status</CardTitle>
              <CardDescription>Lifecycle distribution of your current workload</CardDescription>
            </CardHeader>
            <CardBody style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              {Object.entries(statusGrouping).map(([statusKey, items]) => (
                <div
                  key={statusKey}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.75rem 1rem',
                    backgroundColor: 'var(--color-slate-50)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {getStatusBadge(statusKey)}
                    <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {statusKey.replace('_', ' ')}
                    </span>
                  </div>
                  <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {items.length}
                  </span>
                </div>
              ))}
            </CardBody>
          </Card>

          {/* Priority Breakdown Card */}
          <Card>
            <CardHeader>
              <CardTitle>My Tickets by Priority</CardTitle>
              <CardDescription>Severity profile of your assigned responsibilities</CardDescription>
            </CardHeader>
            <CardBody style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              {Object.entries(priorityGrouping).map(([priorityKey, items]) => (
                <div
                  key={priorityKey}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.75rem 1rem',
                    backgroundColor: 'var(--color-slate-50)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {getPriorityBadge(priorityKey)}
                    <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {priorityKey}
                    </span>
                  </div>
                  <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {items.length}
                  </span>
                </div>
              ))}
            </CardBody>
          </Card>
        </div>
      )}

      {/* Two Column Grid: Recent Work Logs & Quick KB Access */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.25rem' }}>
        {/* Left Column: Recent Work Logs */}
        <Card>
          <CardHeader
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <CardTitle>Recent Work Logs</CardTitle>
              <CardDescription>Logged technical labor and hours spent across tickets</CardDescription>
            </div>
            <Button
              size="xs"
              variant="secondary"
              onClick={() => {
                if (activeAssignedTickets.length > 0) {
                  setSelectedTicketForWorkLog(activeAssignedTickets[0]._id);
                }
                setIsLogWorkOpen(true);
              }}
              icon={<Timer size={13} />}
            >
              Log Work
            </Button>
          </CardHeader>
          <CardBody style={{ padding: 0 }}>
            {workLogs.length === 0 ? (
              <div style={{ padding: '2rem' }}>
                <EmptyState
                  icon={Clock}
                  title="No Recent Work Logs"
                  description="You haven't logged any time on your assigned tickets yet. Keep your time tracking updated!"
                  action={
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => setIsLogWorkOpen(true)}
                    >
                      Record First Work Log
                    </Button>
                  }
                />
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {workLogs.slice(0, 5).map((log, index) => (
                  <div
                    key={log._id || index}
                    style={{
                      padding: '1rem 1.25rem',
                      borderBottom: '1px solid var(--border-subtle)',
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: '0.75rem',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Link
                          to={`/tickets/${log.ticketId}`}
                          style={{
                            fontWeight: 700,
                            fontSize: '0.85rem',
                            color: 'var(--color-primary-600)',
                            textDecoration: 'none',
                          }}
                        >
                          {log.ticketNumber}
                        </Link>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          • {new Date(log.workDate || log.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                        {log.description}
                      </div>
                    </div>
                    <Badge color="purple">
                      {log.timeSpentMinutes} mins
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        {/* Right Column: Quick KB Access */}
        <Card>
          <CardHeader>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
              <div>
                <CardTitle>Technical Runbooks & Knowledge</CardTitle>
                <CardDescription>Instant reference for troubleshooting SOPs and procedures</CardDescription>
              </div>
              <Link to="/knowledge">
                <Button size="xs" variant="secondary" icon={<ExternalLink size={12} />}>
                  Full KB
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardBody style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Search Input */}
            <div style={{ position: 'relative' }}>
              <Input
                placeholder="Search runbooks, SOPs, and technical solutions..."
                value={kbSearch}
                onChange={(e) => setKbSearch(e.target.value)}
                style={{ paddingLeft: '2.25rem' }}
              />
              <Search
                size={16}
                style={{
                  position: 'absolute',
                  left: '0.75rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                }}
              />
            </div>

            {/* Articles List */}
            {isKbLoading ? (
              <div style={{ padding: '2rem', display: 'flex', justifyContent: 'center' }}>
                <LoadingSpinner size="md" />
              </div>
            ) : filteredKbArticles.length === 0 ? (
              <EmptyState
                icon={BookOpen}
                title="No Articles Found"
                description={
                  kbSearch
                    ? `No documentation matching "${kbSearch}".`
                    : 'No published technical runbooks found.'
                }
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                {filteredKbArticles.slice(0, 5).map((article) => (
                  <Link
                    key={article._id}
                    to={`/knowledge/${article._id || article.slug}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.75rem 1rem',
                      backgroundColor: 'var(--color-slate-50)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-subtle)',
                      textDecoration: 'none',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                      <FileText size={16} color="var(--color-primary-600)" />
                      <div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {article.title}
                        </div>
                        {article.category?.name && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {article.category.name}
                          </div>
                        )}
                      </div>
                    </div>
                    <ArrowRight size={14} color="var(--text-muted)" />
                  </Link>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* QUICK LOG WORK MODAL */}
      <Modal
        isOpen={isLogWorkOpen}
        onClose={() => setIsLogWorkOpen(false)}
        title="Record Technical Work Log"
      >
        <form onSubmit={handleLogWorkSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.35rem' }}>
              Select Active Assigned Ticket
            </label>
            <select
              value={selectedTicketForWorkLog}
              onChange={(e) => setSelectedTicketForWorkLog(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '0.625rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
                fontSize: '0.875rem',
              }}
            >
              <option value="">-- Choose Ticket --</option>
              {activeAssignedTickets.map((t) => (
                <option key={t._id} value={t._id}>
                  {t.ticketNumber}: {t.title} ({t.status})
                </option>
              ))}
            </select>
            {activeAssignedTickets.length === 0 && (
              <p style={{ fontSize: '0.775rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                Note: You have no active assigned tickets. Open any ticket from the team queue to assign it to yourself first.
              </p>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                Time Spent (Minutes)
              </label>
              <Input
                type="number"
                min="1"
                max="1440"
                value={workLogMinutes}
                onChange={(e) => setWorkLogMinutes(e.target.value)}
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                Work Date
              </label>
              <Input
                type="date"
                value={workLogDate}
                onChange={(e) => setWorkLogDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.35rem' }}>
              Description of Work Performed
            </label>
            <textarea
              rows={3}
              value={workLogDescription}
              onChange={(e) => setWorkLogDescription(e.target.value)}
              placeholder="e.g. Tested network adapter, reseated RAM, validated DHCP leases..."
              required
              style={{
                width: '100%',
                padding: '0.625rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
                fontSize: '0.875rem',
                fontFamily: 'inherit',
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsLogWorkOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={isSubmittingWorkLog}
              disabled={!selectedTicketForWorkLog || !workLogDescription.trim()}
            >
              Save Work Log
            </Button>
          </div>
        </form>
      </Modal>

      {/* TICKET STATUS MODAL */}
      {statusModalTicket && (
        <ChangeStatusModal
          isOpen={!!statusModalTicket}
          onClose={() => setStatusModalTicket(null)}
          ticket={statusModalTicket}
          onStatusChanged={() => {
            setStatusModalTicket(null);
            handleRefresh();
          }}
        />
      )}

      {/* CREATE TICKET MODAL */}
      <CreateTicketModal
        isOpen={isCreateTicketOpen}
        onClose={() => setIsCreateTicketOpen(false)}
        onTicketCreated={() => {
          setIsCreateTicketOpen(false);
          handleRefresh();
        }}
      />
    </div>
  );
};

export default TechnicianDashboard;
