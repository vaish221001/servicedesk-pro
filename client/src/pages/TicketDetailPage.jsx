import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import ticketService from '../services/ticketService';
import Card, { CardHeader, CardTitle, CardBody } from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import Alert from '../components/ui/Alert';

import SlaStatusCard from '../components/tickets/SlaStatusCard';
import TicketCommentsSection from '../components/tickets/TicketCommentsSection';
import TicketWorkLogsSection from '../components/tickets/TicketWorkLogsSection';
import TicketActivityFeed from '../components/tickets/TicketActivityFeed';
import EditTicketModal from '../components/tickets/EditTicketModal';
import ChangeStatusModal from '../components/tickets/ChangeStatusModal';
import AssignTicketModal from '../components/tickets/AssignTicketModal';
import LinkAssetModal from '../components/tickets/LinkAssetModal';

import {
  ArrowLeft,
  Tag,
  Edit,
  RotateCw,
  UserCheck,
  HardDrive,
  CheckCircle,
  Sparkles,
  BookOpen,
  ExternalLink,
  BrainCircuit,
} from 'lucide-react';
import { classifyTicket, getRecommendedArticles } from '../utils/aiAssistant';

export const TicketDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isEmployee = user?.role === 'EMPLOYEE';

  const [ticket, setTicket] = useState(null);
  const [comments, setComments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal triggers
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [isAssetOpen, setIsAssetOpen] = useState(false);

  // AI & Knowledge Base recommendations state
  const [recommendedArticles, setRecommendedArticles] = useState([]);
  const [isApplyingAi, setIsApplyingAi] = useState(false);
  const [aiSuccessMsg, setAiSuccessMsg] = useState(null);

  const loadTicketData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [ticketRes, commentsRes] = await Promise.all([
        ticketService.getTicketById(id),
        ticketService.getComments(id),
      ]);

      if (ticketRes && ticketRes.success) {
        setTicket(ticketRes.data);
      }
      if (commentsRes && commentsRes.success) {
        setComments(commentsRes.data || []);
      }
    } catch (err) {
      console.error('Failed to load ticket:', err);
      setError(err.message || 'Failed to load ticket details.');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    let ignore = false;

    async function load() {
      try {
        const [ticketRes, commentsRes] = await Promise.all([
          ticketService.getTicketById(id),
          ticketService.getComments(id),
        ]);

        if (!ignore) {
          if (ticketRes && ticketRes.success) {
            setTicket(ticketRes.data);
          }
          if (commentsRes && commentsRes.success) {
            setComments(commentsRes.data || []);
          }
        }
      } catch (err) {
        if (!ignore) {
          console.error('Failed to load ticket:', err);
          setError(err.message || 'Failed to load ticket details.');
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    load();

    return () => {
      ignore = true;
    };
  }, [id]);

  useEffect(() => {
    let ignore = false;
    if (ticket?.title) {
      getRecommendedArticles(`${ticket.title} ${ticket.description || ''}`, 3)
        .then((articles) => {
          if (!ignore) {
            setRecommendedArticles(articles || []);
          }
        })
        .catch(() => {
          if (!ignore) setRecommendedArticles([]);
        });
    }
    return () => {
      ignore = true;
    };
  }, [ticket?.title, ticket?.description]);

  const handleApplyAiPriority = async (newPriority) => {
    if (!ticket || !newPriority || newPriority === ticket.priority) return;
    setIsApplyingAi(true);
    setAiSuccessMsg(null);
    try {
      const res = await ticketService.updateTicket(ticket._id, { priority: newPriority });
      if (res && res.success) {
        setTicket(res.data);
        setAiSuccessMsg(`Priority successfully updated to ${newPriority}`);
        setTimeout(() => setAiSuccessMsg(null), 4000);
      }
    } catch (err) {
      console.error('Failed to apply AI priority:', err);
    } finally {
      setIsApplyingAi(false);
    }
  };

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '5rem 0' }}>
        <LoadingSpinner size="lg" color="primary" />
        <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>
          Retrieving ticket records...
        </p>
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div style={{ maxWidth: '600px', margin: '3rem auto' }}>
        <Alert variant="error" title="Ticket Error">
          {error || 'The requested ticket could not be found or you do not have permission to access it.'}
        </Alert>
        <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
          <Button variant="secondary" onClick={() => navigate('/tickets')} icon={<ArrowLeft size={16} />}>
            Return to Ticket Directory
          </Button>
        </div>
      </div>
    );
  }

  const requester = ticket.createdBy;
  const assignee = ticket.assignedTo;
  const asset = ticket.relatedAssetId;

  // Permissions
  const canEdit = !['RESOLVED', 'CLOSED'].includes(ticket.status) && (
    !isEmployee || (ticket.status === 'OPEN' && ticket.createdBy?._id === user?._id)
  );
  const canAssign = ['TECHNICIAN', 'IT_MANAGER', 'SYSTEM_ADMIN'].includes(user?.role);

  const aiDiagnostics = ticket
    ? {
        priority: ticket.aiMetadata?.predictedPriority || classifyTicket(ticket.title, ticket.description, []).priority,
        confidence: ticket.aiMetadata?.confidence || classifyTicket(ticket.title, ticket.description, []).confidence,
        probableIssue: ticket.aiMetadata?.probableIssue || classifyTicket(ticket.title, ticket.description, []).probableIssue,
        categoryName: ticket.aiMetadata?.predictedCategory || (classifyTicket(ticket.title, ticket.description, [ticket.categoryId].filter(Boolean)).suggestedCategory?.name),
      }
    : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Top Breadcrumb & Action Header */}
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <Link
            to="/tickets"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              color: 'var(--text-secondary)',
              fontSize: '0.875rem',
              fontWeight: 500,
            }}
          >
            <ArrowLeft size={16} />
            Back to Tickets
          </Link>

          {/* Action Toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <Button
              variant="secondary"
              size="sm"
              onClick={loadTicketData}
              icon={<RotateCw size={14} />}
            >
              Refresh
            </Button>

            {canEdit && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsEditOpen(true)}
                icon={<Edit size={14} />}
              >
                Edit
              </Button>
            )}

            {canAssign && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsAssignOpen(true)}
                icon={<UserCheck size={14} />}
              >
                {ticket.assignedTo ? 'Reassign' : 'Assign'}
              </Button>
            )}

            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsAssetOpen(true)}
              icon={<HardDrive size={14} />}
            >
              {ticket.relatedAssetId ? 'Asset Linked' : 'Link Asset'}
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsStatusOpen(true)}
            >
              Update Status
            </Button>
          </div>
        </div>

        {/* Title & Metadata Badges */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-primary-600)', fontFamily: 'var(--font-mono)' }}>
              {ticket.ticketNumber}
            </span>
            <Badge variant="status">{ticket.status}</Badge>
            <Badge variant="priority">{ticket.priority}</Badge>
            {ticket.departmentId && (
              <Badge color="slate">{ticket.departmentId.name || 'Department'}</Badge>
            )}
            {ticket.categoryId && (
              <Badge color="indigo">{ticket.categoryId.name || 'Category'}</Badge>
            )}
            {ticket.subcategoryId && (
              <Badge color="purple">{ticket.subcategoryId.name || 'Subcategory'}</Badge>
            )}
          </div>

          <h2 style={{ fontSize: '1.45rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3 }}>
            {ticket.title}
          </h2>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)',
          gap: '1.5rem',
        }}
        className="dashboard-columns"
      >
        {/* Left Column (Content, Comments, WorkLogs, Timeline) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Issue Description Card */}
          <Card>
            <CardHeader>
              <CardTitle>Issue Description</CardTitle>
            </CardHeader>
            <CardBody>
              <div
                style={{
                  fontSize: '0.925rem',
                  lineHeight: 1.6,
                  color: 'var(--text-primary)',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {ticket.description}
              </div>

              {/* Tags */}
              {ticket.tags && ticket.tags.length > 0 && (
                <div style={{ marginTop: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                  <Tag size={14} style={{ color: 'var(--color-slate-400)' }} />
                  {ticket.tags.map((tag, idx) => (
                    <span
                      key={idx}
                      style={{
                        backgroundColor: 'var(--color-slate-100)',
                        color: 'var(--color-slate-700)',
                        fontSize: '0.75rem',
                        padding: '0.2rem 0.5rem',
                        borderRadius: 'var(--radius-sm)',
                      }}
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>

          {/* Resolution Notes Banner (if RESOLVED or CLOSED) */}
          {['RESOLVED', 'CLOSED'].includes(ticket.status) && ticket.resolutionNotes && (
            <Card style={{ backgroundColor: 'var(--color-emerald-50)', borderColor: 'var(--color-emerald-100)' }}>
              <CardBody>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-emerald-800)', fontWeight: 600, marginBottom: '0.5rem' }}>
                  <CheckCircle size={18} />
                  <span>Resolution Summary</span>
                </div>
                <p style={{ fontSize: '0.875rem', color: 'var(--color-emerald-900)', lineHeight: 1.5 }}>
                  {ticket.resolutionNotes}
                </p>
                {ticket.rootCause && (
                  <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--color-emerald-800)' }}>
                    <strong>Root Cause:</strong> {ticket.rootCause}
                  </div>
                )}
                {ticket.resolvedBy && (
                  <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--color-emerald-700)' }}>
                    Resolved by {ticket.resolvedBy.firstName} {ticket.resolvedBy.lastName} on {ticket.resolvedAt ? new Date(ticket.resolvedAt).toLocaleString() : ''}
                  </div>
                )}
              </CardBody>
            </Card>
          )}

          {/* Comments & Conversation Thread */}
          <TicketCommentsSection
            ticketId={ticket._id}
            comments={comments}
            onCommentAdded={(newComment) => setComments((prev) => [...prev, newComment])}
          />

          {/* Technician Work Logs */}
          <TicketWorkLogsSection ticketId={ticket._id} />

          {/* Timeline & Audit Feed */}
          <TicketActivityFeed ticketId={ticket._id} />
        </div>

        {/* Right Column (SLA, People, Linked Asset) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* SLA Status Card */}
          <SlaStatusCard ticket={ticket} />

          {/* People & Ownership Details Card */}
          <Card>
            <CardHeader>
              <CardTitle>Ticket Context</CardTitle>
            </CardHeader>
            <CardBody style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.85rem' }}>
              {/* Requester */}
              <div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.775rem', textTransform: 'uppercase', fontWeight: 600 }}>
                  Requester
                </div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>
                  {requester ? `${requester.firstName} ${requester.lastName}` : 'Unknown'}
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.775rem' }}>
                  {requester?.email}
                </div>
              </div>

              <div style={{ height: '1px', backgroundColor: 'var(--border-subtle)' }} />

              {/* Assignee */}
              <div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.775rem', textTransform: 'uppercase', fontWeight: 600 }}>
                  Assigned Technician
                </div>
                <div style={{ fontWeight: 600, color: assignee ? 'var(--text-primary)' : 'var(--color-amber-600)', marginTop: '2px' }}>
                  {assignee ? `${assignee.firstName} ${assignee.lastName}` : 'Unassigned'}
                </div>
                {assignee?.email && (
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.775rem' }}>
                    {assignee.email}
                  </div>
                )}
              </div>

              <div style={{ height: '1px', backgroundColor: 'var(--border-subtle)' }} />

              {/* Timestamps */}
              <div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.775rem', textTransform: 'uppercase', fontWeight: 600 }}>
                  Created Date
                </div>
                <div style={{ color: 'var(--text-primary)', marginTop: '2px' }}>
                  {new Date(ticket.createdAt).toLocaleString()}
                </div>
              </div>

              {ticket.updatedAt && (
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.775rem', textTransform: 'uppercase', fontWeight: 600 }}>
                    Last Updated
                  </div>
                  <div style={{ color: 'var(--text-primary)', marginTop: '2px' }}>
                    {new Date(ticket.updatedAt).toLocaleString()}
                  </div>
                </div>
              )}
            </CardBody>
          </Card>

          {/* Linked Hardware Asset Card */}
          <Card>
            <CardHeader
              action={
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsAssetOpen(true)}
                >
                  {asset ? 'Change' : 'Link'}
                </Button>
              }
            >
              <CardTitle>Linked Hardware / Asset</CardTitle>
            </CardHeader>
            <CardBody>
              {asset ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 700, color: 'var(--color-primary-600)', fontFamily: 'var(--font-mono)' }}>
                      {asset.assetTag}
                    </span>
                    <Badge color="blue">{asset.status}</Badge>
                  </div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                    {asset.name}
                  </div>
                  {(asset.manufacturer || asset.model) && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {asset.manufacturer} {asset.model}
                    </div>
                  )}
                </div>
              ) : (
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center', padding: '0.5rem 0' }}>
                  No hardware or asset currently linked.
                </p>
              )}
            </CardBody>
          </Card>

          {/* AI Triage & Intelligence Diagnostic Card */}
          <Card>
            <CardHeader
              action={
                <Badge color="purple" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                  <Sparkles size={12} />
                  {aiDiagnostics?.confidence || 80}% Confidence
                </Badge>
              }
            >
              <CardTitle style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <BrainCircuit size={18} style={{ color: 'var(--color-primary-600)' }} />
                AI Triage Diagnostic
              </CardTitle>
            </CardHeader>
            <CardBody style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem', fontSize: '0.85rem' }}>
              {aiSuccessMsg && (
                <Alert variant="success" size="sm">
                  {aiSuccessMsg}
                </Alert>
              )}

              <div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>
                  Predicted Priority
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.25rem' }}>
                  <Badge variant="priority">{aiDiagnostics?.priority || 'MEDIUM'}</Badge>
                  {canEdit && !isEmployee && ticket.priority !== aiDiagnostics?.priority && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleApplyAiPriority(aiDiagnostics.priority)}
                      isLoading={isApplyingAi}
                      style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                    >
                      Apply Suggestion
                    </Button>
                  )}
                </div>
              </div>

              {aiDiagnostics?.categoryName && (
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>
                    Predicted Category
                  </div>
                  <div style={{ marginTop: '0.25rem' }}>
                    <Badge color="indigo">{aiDiagnostics.categoryName}</Badge>
                  </div>
                </div>
              )}

              {aiDiagnostics?.probableIssue && (
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>
                    Diagnosis Analysis
                  </div>
                  <p style={{ marginTop: '0.25rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                    {aiDiagnostics.probableIssue}
                  </p>
                </div>
              )}

              <div style={{ paddingTop: '0.5rem', borderTop: '1px solid var(--border-subtle)', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                AI classifications are advisory heuristics and do not overwrite ticket parameters without user review.
              </div>
            </CardBody>
          </Card>

          {/* Suggested Knowledge Base Solutions Card */}
          <Card>
            <CardHeader>
              <CardTitle style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <BookOpen size={18} style={{ color: 'var(--color-indigo-600)' }} />
                Suggested KB Solutions
              </CardTitle>
            </CardHeader>
            <CardBody>
              {recommendedArticles && recommendedArticles.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {recommendedArticles.map((art) => (
                    <div
                      key={art._id}
                      style={{
                        padding: '0.75rem',
                        backgroundColor: 'var(--color-slate-50)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-subtle)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.25rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
                        <Link
                          to={`/knowledge-base/${art._id}`}
                          style={{
                            fontWeight: 600,
                            fontSize: '0.875rem',
                            color: 'var(--color-primary-600)',
                            lineHeight: 1.3,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                          }}
                        >
                          {art.title}
                          <ExternalLink size={12} />
                        </Link>
                      </div>
                      {art.category && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          Category: {art.category}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '1rem 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  No published knowledge articles directly match this issue yet.
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Modal Dialogs */}
      {isEditOpen && (
        <EditTicketModal
          isOpen={isEditOpen}
          onClose={() => setIsEditOpen(false)}
          ticket={ticket}
          onTicketUpdated={(updated) => setTicket(updated)}
        />
      )}

      {isStatusOpen && (
        <ChangeStatusModal
          isOpen={isStatusOpen}
          onClose={() => setIsStatusOpen(false)}
          ticket={ticket}
          onStatusChanged={(updated) => setTicket(updated)}
        />
      )}

      {isAssignOpen && (
        <AssignTicketModal
          isOpen={isAssignOpen}
          onClose={() => setIsAssignOpen(false)}
          ticket={ticket}
          onAssigned={(updated) => setTicket(updated)}
        />
      )}

      {isAssetOpen && (
        <LinkAssetModal
          isOpen={isAssetOpen}
          onClose={() => setIsAssetOpen(false)}
          ticket={ticket}
          onAssetLinked={(updated) => setTicket(updated)}
        />
      )}
    </div>
  );
};

export default TicketDetailPage;
