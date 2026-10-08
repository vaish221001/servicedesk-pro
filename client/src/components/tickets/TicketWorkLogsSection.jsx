import { useState, useEffect, useCallback } from 'react';
import Card, { CardHeader, CardTitle, CardBody } from '../ui/Card';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import Alert from '../ui/Alert';
import LoadingSpinner from '../ui/LoadingSpinner';
import ticketService from '../../services/ticketService';
import { useAuth } from '../../context/useAuth';
import { Clock, Plus, Trash2 } from 'lucide-react';

export const TicketWorkLogsSection = ({ ticketId }) => {
  const { user } = useAuth();
  const canAccessWorkLogs = ['TECHNICIAN', 'IT_MANAGER', 'SYSTEM_ADMIN'].includes(user?.role);

  const [workLogs, setWorkLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(canAccessWorkLogs);
  const [error, setError] = useState(null);

  // Form State
  const [showAddForm, setShowAddForm] = useState(false);
  const [timeSpentMinutes, setTimeSpentMinutes] = useState(30);
  const [description, setDescription] = useState('');
  const [isBillable, setIsBillable] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchWorkLogs = useCallback(async () => {
    try {
      const res = await ticketService.getWorkLogs(ticketId);
      if (res && res.success) {
        setWorkLogs(res.data || []);
      }
    } catch (err) {
      console.error('Failed to load work logs:', err);
      setError(err.message || 'Failed to load technician work logs');
    }
  }, [ticketId]);

  useEffect(() => {
    if (!canAccessWorkLogs) return;
    let ignore = false;

    async function load() {
      try {
        const res = await ticketService.getWorkLogs(ticketId);
        if (!ignore && res && res.success) {
          setWorkLogs(res.data || []);
        }
      } catch (err) {
        if (!ignore) {
          console.error('Failed to load work logs:', err);
          setError(err.message || 'Failed to load technician work logs');
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
  }, [ticketId, canAccessWorkLogs]);

  if (!canAccessWorkLogs) return null; // Never exposed to non-technical roles

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!description.trim()) {
      setError('Work log description is required');
      return;
    }
    if (timeSpentMinutes <= 0) {
      setError('Time spent must be greater than 0 minutes');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const res = await ticketService.createWorkLog(ticketId, {
        timeSpentMinutes: Number(timeSpentMinutes),
        description: description.trim(),
        isBillable,
      });

      if (res && res.success) {
        setDescription('');
        setTimeSpentMinutes(30);
        setIsBillable(false);
        setShowAddForm(false);
        await fetchWorkLogs();
      }
    } catch (err) {
      setError(err.message || 'Failed to log work time');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (workLogId) => {
    if (!window.confirm('Are you sure you want to delete this work log?')) return;
    try {
      await ticketService.deleteWorkLog(ticketId, workLogId);
      await fetchWorkLogs();
    } catch (err) {
      setError(err.message || 'Failed to delete work log');
    }
  };

  const formatDuration = (mins) => {
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    if (hours > 0 && remainingMins > 0) return `${hours}h ${remainingMins}m`;
    if (hours > 0) return `${hours}h`;
    return `${remainingMins}m`;
  };

  const totalMinutes = workLogs.reduce((sum, log) => sum + (log.timeSpentMinutes || 0), 0);

  return (
    <Card>
      <CardHeader
        action={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowAddForm((prev) => !prev)}
            icon={<Plus size={14} />}
          >
            {showAddForm ? 'Cancel' : 'Log Time'}
          </Button>
        }
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Clock size={18} style={{ color: 'var(--color-primary-600)' }} />
          <CardTitle>Technician Work Logs ({workLogs.length})</CardTitle>
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
            Total: <strong>{formatDuration(totalMinutes)}</strong>
          </span>
        </div>
      </CardHeader>

      <CardBody style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {error && (
          <Alert variant="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Add Work Log Form */}
        {showAddForm && (
          <form
            onSubmit={handleSubmit}
            style={{
              padding: '1rem',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--color-slate-50)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '0.75rem' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label htmlFor="log-duration" className="form-label">
                  Duration (Mins)
                </label>
                <input
                  id="log-duration"
                  type="number"
                  min="1"
                  step="5"
                  className="form-input"
                  value={timeSpentMinutes}
                  onChange={(e) => setTimeSpentMinutes(e.target.value)}
                  required
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label htmlFor="log-desc" className="form-label">
                  Work Description
                </label>
                <input
                  id="log-desc"
                  type="text"
                  className="form-input"
                  placeholder="e.g. Diagnosed DNS lookup failure on gateway..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8125rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={isBillable}
                  onChange={(e) => setIsBillable(e.target.checked)}
                />
                <span>Billable Time</span>
              </label>

              <Button type="submit" variant="primary" size="sm" isLoading={isSubmitting}>
                Save Work Log
              </Button>
            </div>
          </form>
        )}

        {/* Work Logs List */}
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '1.5rem' }}>
            <LoadingSpinner size="sm" color="primary" />
          </div>
        ) : workLogs.length === 0 ? (
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem 0' }}>
            No work logs recorded yet.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {workLogs.map((log) => {
              const author = log.userId;
              const authorName = author ? `${author.firstName} ${author.lastName}` : 'Technician';

              return (
                <div
                  key={log._id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.75rem 1rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)',
                    backgroundColor: '#ffffff',
                    fontSize: '0.85rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <Badge color="blue">{formatDuration(log.timeSpentMinutes)}</Badge>
                    <div>
                      <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                        {log.description}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Logged by {authorName} on {new Date(log.loggedAt || log.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {log.isBillable && <Badge color="emerald">Billable</Badge>}
                    <button
                      type="button"
                      onClick={() => handleDelete(log._id)}
                      aria-label="Delete work log"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--color-slate-400)',
                        cursor: 'pointer',
                        padding: '4px',
                        display: 'flex',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-rose-600)')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-slate-400)')}
                    >
                      <Trash2 size={15} />
                    </button>
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

export default TicketWorkLogsSection;
