import { useState, useEffect } from 'react';
import Card, { CardHeader, CardTitle, CardBody } from '../ui/Card';
import Badge from '../ui/Badge';
import LoadingSpinner from '../ui/LoadingSpinner';
import Alert from '../ui/Alert';
import ticketService from '../../services/ticketService';
import {
  Activity,
  MessageSquare,
  ArrowRightCircle,
  UserCheck,
  Clock,
} from 'lucide-react';

export const TicketActivityFeed = ({ ticketId }) => {
  const [feed, setFeed] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let ignore = false;

    async function loadFeed() {
      try {
        const res = await ticketService.getActivityFeed(ticketId);
        if (!ignore && res && res.success) {
          setFeed(res.data || []);
        }
      } catch (err) {
        if (!ignore) {
          console.error('Failed to load activity feed:', err);
          setError(err.message || 'Failed to load ticket timeline');
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    loadFeed();

    return () => {
      ignore = true;
    };
  }, [ticketId]);

  const getEventIcon = (type) => {
    switch (type) {
      case 'comment':
        return <MessageSquare size={14} style={{ color: 'var(--color-primary-600)' }} />;
      case 'status_change':
        return <ArrowRightCircle size={14} style={{ color: 'var(--color-sky-600)' }} />;
      case 'assignment':
        return <UserCheck size={14} style={{ color: 'var(--color-purple-600)' }} />;
      case 'work_log':
        return <Clock size={14} style={{ color: 'var(--color-emerald-600)' }} />;
      default:
        return <Activity size={14} style={{ color: 'var(--color-slate-500)' }} />;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Activity size={18} style={{ color: 'var(--color-primary-600)' }} />
          <CardTitle>Timeline & History ({feed.length})</CardTitle>
        </div>
      </CardHeader>

      <CardBody>
        {error && (
          <Alert variant="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '1.5rem' }}>
            <LoadingSpinner size="sm" color="primary" />
          </div>
        ) : feed.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', padding: '1rem 0' }}>
            No history recorded yet.
          </p>
        ) : (
          <div
            style={{
              position: 'relative',
              paddingLeft: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            {/* Vertical timeline line */}
            <div
              style={{
                position: 'absolute',
                top: '0.5rem',
                bottom: '0.5rem',
                left: '7px',
                width: '2px',
                backgroundColor: 'var(--border-subtle)',
              }}
              aria-hidden="true"
            />

            {feed.map((event, idx) => {
              const actor = event.actor;
              const actorName = actor ? `${actor.firstName} ${actor.lastName}` : 'System';

              return (
                <div key={idx} style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                  {/* Timeline Node Dot */}
                  <div
                    style={{
                      position: 'absolute',
                      left: '-1.25rem',
                      top: '2px',
                      width: '16px',
                      height: '16px',
                      borderRadius: '50%',
                      backgroundColor: '#ffffff',
                      border: '2px solid var(--border-default)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--color-primary-600)' }} />
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                      {getEventIcon(event.type)}
                      <span style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--text-primary)' }}>
                        {actorName}
                      </span>
                      {actor?.role && <Badge variant="role">{actor.role}</Badge>}
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                        {event.timestamp ? new Date(event.timestamp).toLocaleString() : ''}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                      {event.summary || event.description || JSON.stringify(event.details || '')}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardBody>
    </Card>
  );
};

export default TicketActivityFeed;
