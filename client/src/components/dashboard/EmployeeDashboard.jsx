import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import Card, { CardHeader, CardTitle, CardDescription, CardBody } from '../ui/Card';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import LoadingSpinner from '../ui/LoadingSpinner';
import Alert from '../ui/Alert';
import EmptyState from '../ui/EmptyState';
import Input from '../ui/Input';
import ticketService from '../../services/ticketService';
import assetService from '../../services/assetService';
import knowledgeService from '../../services/knowledgeService';
import { CreateTicketModal } from '../tickets/CreateTicketModal';
import {
  Ticket,
  CheckCircle2,
  AlertCircle,
  PlusCircle,
  Laptop,
  BookOpen,
  Search,
  ExternalLink,
  RotateCw,
  ArrowRight,
  FileQuestion,
  Headphones,
} from 'lucide-react';

export const EmployeeDashboard = ({ user }) => {
  const [tickets, setTickets] = useState([]);
  const [assignedAssets, setAssignedAssets] = useState([]);
  const [kbArticles, setKbArticles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Filter & Search states
  const [ticketFilter, setTicketFilter] = useState('ALL'); // 'ALL' | 'OPEN' | 'PENDING' | 'RESOLVED'
  const [kbSearch, setKbSearch] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const handleRefresh = () => {
    setIsLoading(true);
    setRefreshTrigger((prev) => prev + 1);
  };

  useEffect(() => {
    let ignore = false;

    async function loadData() {
      try {
        // 1. Fetch tickets (backend automatically scopes to requesterId === user._id for EMPLOYEE)
        const [ticketRes, assetRes, kbRes] = await Promise.all([
          ticketService.getTickets({ limit: 100, sort: '-createdAt' }),
          assetService.getAssets({ limit: 50 }),
          knowledgeService.getArticles({ status: 'PUBLISHED', visibility: 'PUBLIC', limit: 8 }),
        ]);

        if (ignore) return;
        setTickets(ticketRes?.data || []);
        setAssignedAssets(assetRes?.data || []);
        setKbArticles(kbRes?.data || []);
        setError(null);
      } catch (err) {
        if (!ignore) {
          console.error('Failed to load employee dashboard data:', err);
          setError(err.message || 'Failed to retrieve your tickets and assigned equipment.');
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
  const openTickets = useMemo(() => {
    return tickets.filter((t) => ['OPEN', 'ASSIGNED', 'IN_PROGRESS'].includes(t.status));
  }, [tickets]);

  const awaitingResponseTickets = useMemo(() => {
    return tickets.filter((t) => t.status === 'PENDING');
  }, [tickets]);

  const resolvedTickets = useMemo(() => {
    return tickets.filter((t) => ['RESOLVED', 'CLOSED'].includes(t.status));
  }, [tickets]);

  // Filtered Tickets Table
  const filteredTickets = useMemo(() => {
    switch (ticketFilter) {
      case 'OPEN':
        return openTickets;
      case 'PENDING':
        return awaitingResponseTickets;
      case 'RESOLVED':
        return resolvedTickets;
      case 'ALL':
      default:
        return tickets;
    }
  }, [tickets, ticketFilter, openTickets, awaitingResponseTickets, resolvedTickets]);

  // Filtered Knowledge Base Articles
  const filteredKb = useMemo(() => {
    if (!kbSearch.trim()) return kbArticles;
    const q = kbSearch.toLowerCase();
    return kbArticles.filter(
      (a) =>
        a.title?.toLowerCase().includes(q) ||
        a.summary?.toLowerCase().includes(q) ||
        a.category?.name?.toLowerCase().includes(q)
    );
  }, [kbArticles, kbSearch]);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'OPEN':
        return <Badge color="gray">OPEN</Badge>;
      case 'ASSIGNED':
        return <Badge color="blue">IN QUEUE</Badge>;
      case 'IN_PROGRESS':
        return <Badge color="purple">IN PROGRESS</Badge>;
      case 'PENDING':
        return <Badge color="yellow">AWAITING YOUR RESPONSE</Badge>;
      case 'RESOLVED':
        return <Badge color="green">RESOLVED</Badge>;
      case 'CLOSED':
        return <Badge color="gray">CLOSED</Badge>;
      default:
        return <Badge color="gray">{status}</Badge>;
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* Employee Hero / Welcome Banner */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1.25rem',
          padding: '2rem',
          backgroundColor: '#ffffff',
          borderRadius: 'var(--radius-xl)',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-sm)',
          background: 'linear-gradient(135deg, #eff6ff 0%, #ffffff 50%, #f0fdf4 100%)',
        }}
      >
        <div style={{ maxWidth: '600px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.5rem' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '32px',
                height: '32px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'var(--color-primary-600)',
                color: '#ffffff',
              }}
            >
              <Headphones size={18} />
            </span>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              Welcome, {user?.firstName || 'Colleague'}!
            </h1>
          </div>
          <p style={{ fontSize: '0.925rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
            Welcome to the ServiceDesk Help Portal. Need help with hardware, software, or account access? Submit a ticket below or explore our quick self-service guides.
          </p>
        </div>

        {/* PROMINENT CREATE TICKET BUTTON */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <Button
            variant="secondary"
            size="md"
            onClick={handleRefresh}
            isLoading={isLoading}
            icon={<RotateCw size={15} />}
          >
            Refresh
          </Button>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            id="employee-create-ticket-cta"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.625rem',
              padding: '0.75rem 1.5rem',
              fontSize: '1rem',
              fontWeight: 700,
              color: '#ffffff',
              backgroundColor: 'var(--color-primary-600)',
              border: 'none',
              borderRadius: 'var(--radius-lg)',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
              transition: 'transform 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-primary-700)';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-primary-600)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <PlusCircle size={20} />
            Create Ticket / Request Help
          </button>
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
        {/* Metric 1: My Open Tickets */}
        <Card>
          <CardBody style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                MY OPEN TICKETS
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
              {isLoading ? <LoadingSpinner size="sm" /> : openTickets.length}
            </div>
            <div style={{ fontSize: '0.775rem', color: 'var(--color-primary-600)', fontWeight: 600, marginTop: '0.35rem' }}>
              Currently in progress with IT
            </div>
          </CardBody>
        </Card>

        {/* Metric 2: Tickets Awaiting My Response */}
        <Card>
          <CardBody style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                AWAITING MY RESPONSE
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
                <AlertCircle size={18} />
              </div>
            </div>
            <div style={{ fontSize: '1.85rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.5rem' }}>
              {isLoading ? <LoadingSpinner size="sm" /> : awaitingResponseTickets.length}
            </div>
            <div style={{ fontSize: '0.775rem', color: awaitingResponseTickets.length > 0 ? '#b45309' : 'var(--text-muted)', fontWeight: 600, marginTop: '0.35rem' }}>
              {awaitingResponseTickets.length > 0 ? 'IT technician needs info' : 'No pending user actions'}
            </div>
          </CardBody>
        </Card>

        {/* Metric 3: Resolved Tickets */}
        <Card>
          <CardBody style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                RESOLVED TICKETS
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
                <CheckCircle2 size={18} />
              </div>
            </div>
            <div style={{ fontSize: '1.85rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.5rem' }}>
              {isLoading ? <LoadingSpinner size="sm" /> : resolvedTickets.length}
            </div>
            <div style={{ fontSize: '0.775rem', color: 'var(--color-emerald-600)', fontWeight: 600, marginTop: '0.35rem' }}>
              Successfully closed requests
            </div>
          </CardBody>
        </Card>

        {/* Metric 4: Assigned Equipment */}
        <Card>
          <CardBody style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                ASSIGNED EQUIPMENT
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
                <Laptop size={18} />
              </div>
            </div>
            <div style={{ fontSize: '1.85rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.5rem' }}>
              {isLoading ? <LoadingSpinner size="sm" /> : assignedAssets.length}
            </div>
            <div style={{ fontSize: '0.775rem', color: 'var(--color-indigo-600)', fontWeight: 600, marginTop: '0.35rem' }}>
              Active company hardware
            </div>
          </CardBody>
        </Card>
      </div>

      {/* SECTION 1: TICKET HISTORY & STATUS */}
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
            <CardTitle>My Ticket History</CardTitle>
            <CardDescription>Track status and technician updates on your requests</CardDescription>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {[
              { label: 'All Requests', val: 'ALL' },
              { label: `Open (${openTickets.length})`, val: 'OPEN' },
              { label: `Awaiting My Response (${awaitingResponseTickets.length})`, val: 'PENDING' },
              { label: `Resolved (${resolvedTickets.length})`, val: 'RESOLVED' },
            ].map((f) => (
              <button
                key={f.val}
                onClick={() => setTicketFilter(f.val)}
                style={{
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  borderRadius: 'var(--radius-full)',
                  border: '1px solid',
                  borderColor: ticketFilter === f.val ? 'var(--color-primary-600)' : 'var(--border-subtle)',
                  backgroundColor: ticketFilter === f.val ? 'var(--color-primary-50)' : '#ffffff',
                  color: ticketFilter === f.val ? 'var(--color-primary-700)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardBody style={{ padding: 0 }}>
          {isLoading ? (
            <div style={{ padding: '3rem', display: 'flex', justifyContent: 'center' }}>
              <LoadingSpinner size="lg" />
            </div>
          ) : filteredTickets.length === 0 ? (
            <div style={{ padding: '2.5rem' }}>
              <EmptyState
                icon={FileQuestion}
                title="No tickets in this view"
                description={
                  ticketFilter === 'ALL'
                    ? "You haven't submitted any IT tickets yet. Whenever you experience technical difficulties, we're here to help."
                    : `No tickets matching filter: ${ticketFilter}.`
                }
                action={
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setIsCreateModalOpen(true)}
                    icon={<PlusCircle size={14} />}
                  >
                    Submit a Ticket Now
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
                    <th style={{ padding: '0.75rem 1rem' }}>Ticket #</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Subject</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Priority</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Date Created</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTickets.map((t) => (
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
                        {t.category?.name && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            Category: {t.category.name}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '0.875rem 1rem', whiteSpace: 'nowrap' }}>
                        {getStatusBadge(t.status)}
                      </td>
                      <td style={{ padding: '0.875rem 1rem', whiteSpace: 'nowrap' }}>
                        {getPriorityBadge(t.priority)}
                      </td>
                      <td style={{ padding: '0.875rem 1rem', whiteSpace: 'nowrap', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                        {new Date(t.createdAt).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '0.875rem 1rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <Link to={`/tickets/${t._id}`}>
                          <Button size="xs" variant="secondary">
                            View Ticket
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

      {/* TWO COLUMN GRID: ASSIGNED EQUIPMENT & PUBLISHED KNOWLEDGE BASE */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.25rem' }}>
        {/* Left Column: My Assigned Equipment */}
        <Card>
          <CardHeader>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
              <div>
                <CardTitle>My Assigned Equipment</CardTitle>
                <CardDescription>Hardware and IT assets checked out to your profile</CardDescription>
              </div>
              <Link to="/assets">
                <Button size="xs" variant="secondary" icon={<ExternalLink size={12} />}>
                  View All
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardBody style={{ padding: 0 }}>
            {assignedAssets.length === 0 ? (
              <div style={{ padding: '2rem' }}>
                <EmptyState
                  icon={Laptop}
                  title="No Assigned Equipment"
                  description="You currently have no hardware devices or IT assets registered to your account."
                />
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {assignedAssets.map((asset) => (
                  <div
                    key={asset._id}
                    style={{
                      padding: '1rem 1.25rem',
                      borderBottom: '1px solid var(--border-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '0.75rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
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
                        <Laptop size={18} />
                      </div>
                      <div>
                        <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {asset.name}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          Tag: <span style={{ fontFamily: 'monospace' }}>{asset.assetTag}</span>
                          {asset.model ? ` • Model: ${asset.model}` : ''}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Badge color="green">ASSIGNED</Badge>
                      <Link to={`/assets/${asset._id}`}>
                        <Button size="xs" variant="secondary">
                          Details
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        {/* Right Column: Knowledge Base Articles */}
        <Card>
          <CardHeader>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
              <div>
                <CardTitle>Self-Service Help Center</CardTitle>
                <CardDescription>Step-by-step solutions to common IT questions</CardDescription>
              </div>
              <Link to="/knowledge">
                <Button size="xs" variant="secondary" icon={<ExternalLink size={12} />}>
                  Browse All
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardBody style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ position: 'relative' }}>
              <Input
                placeholder="Search troubleshooting guides and articles..."
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

            {filteredKb.length === 0 ? (
              <EmptyState
                icon={BookOpen}
                title="No Articles Found"
                description={
                  kbSearch
                    ? `No help guides matching "${kbSearch}".`
                    : 'No published self-service articles available at this time.'
                }
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                {filteredKb.slice(0, 5).map((article) => (
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
                    <div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {article.title}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                        {article.summary
                          ? article.summary.slice(0, 65) + (article.summary.length > 65 ? '...' : '')
                          : 'Click to read full troubleshooting instructions.'}
                      </div>
                    </div>
                    <ArrowRight size={14} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                  </Link>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* CREATE TICKET MODAL */}
      <CreateTicketModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onTicketCreated={() => {
          setIsCreateModalOpen(false);
          handleRefresh();
        }}
      />
    </div>
  );
};

export default EmployeeDashboard;
