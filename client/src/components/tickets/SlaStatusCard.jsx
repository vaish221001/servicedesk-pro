import Card, { CardHeader, CardTitle, CardBody } from '../ui/Card';
import Badge from '../ui/Badge';
import { PauseCircle } from 'lucide-react';

const ESCALATION_CONFIG = {
  0: { label: 'Normal SLA', color: 'emerald' },
  1: { label: 'Approaching Breach', color: 'amber' },
  2: { label: 'Breached', color: 'rose' },
  3: { label: 'Severe Escalation', color: 'purple' },
};

export const SlaStatusCard = ({ ticket }) => {
  if (!ticket) return null;

  const isPaused = ticket.status === 'PENDING';
  const escalation = ESCALATION_CONFIG[ticket.escalationLevel] || ESCALATION_CONFIG[0];

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  return (
    <Card>
      <CardHeader>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <CardTitle>SLA Target Deadlines</CardTitle>
          <Badge color={escalation.color}>{escalation.label}</Badge>
        </div>
      </CardHeader>

      <CardBody style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* SLA Paused Warning Banner */}
        {isPaused && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.625rem',
              padding: '0.625rem 0.875rem',
              backgroundColor: 'var(--color-purple-50)',
              border: '1px solid var(--color-purple-100)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--color-purple-700)',
              fontSize: '0.8125rem',
            }}
          >
            <PauseCircle size={18} />
            <div>
              <strong>SLA Clock Paused:</strong> Ticket is in PENDING status.
              {ticket.totalSlaPausedMinutes > 0 && ` Total paused: ${ticket.totalSlaPausedMinutes}m.`}
            </div>
          </div>
        )}

        {/* First Response Target */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              First Response Target
            </div>
            <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)', marginTop: '2px' }}>
              {formatDate(ticket.responseDue)}
            </div>
            {ticket.firstRespondedAt && (
              <div style={{ fontSize: '0.75rem', color: 'var(--color-emerald-600)', marginTop: '2px' }}>
                Responded: {formatDate(ticket.firstRespondedAt)}
              </div>
            )}
          </div>

          <div>
            {ticket.isResponseBreached ? (
              <Badge color="rose">Breached</Badge>
            ) : ticket.firstRespondedAt ? (
              <Badge color="emerald">Met</Badge>
            ) : (
              <Badge color="blue">Pending</Badge>
            )}
          </div>
        </div>

        <div style={{ height: '1px', backgroundColor: 'var(--border-subtle)' }} />

        {/* Resolution Target */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Resolution Target
            </div>
            <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)', marginTop: '2px' }}>
              {formatDate(ticket.resolutionDue)}
            </div>
            {ticket.resolvedAt && (
              <div style={{ fontSize: '0.75rem', color: 'var(--color-emerald-600)', marginTop: '2px' }}>
                Resolved: {formatDate(ticket.resolvedAt)}
              </div>
            )}
          </div>

          <div>
            {ticket.isResolutionBreached ? (
              <Badge color="rose">Breached</Badge>
            ) : ticket.resolvedAt ? (
              <Badge color="emerald">Met</Badge>
            ) : (
              <Badge color="blue">Active</Badge>
            )}
          </div>
        </div>

        {ticket.slaPolicyId && (
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', paddingTop: '0.5rem', borderTop: '1px dashed var(--border-subtle)' }}>
            Policy: {ticket.slaPolicyId.name || 'Organization Default SLA'}
          </div>
        )}
      </CardBody>
    </Card>
  );
};

export default SlaStatusCard;
