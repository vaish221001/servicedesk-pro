import { useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Alert from '../ui/Alert';
import Badge from '../ui/Badge';
import ticketService from '../../services/ticketService';
import { useAuth } from '../../context/useAuth';

export const ChangeStatusModal = ({ isOpen, onClose, ticket, onStatusChanged }) => {
  const { user } = useAuth();
  const isEmployee = user?.role === 'EMPLOYEE';

  const [selectedStatus, setSelectedStatus] = useState('');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [rootCause, setRootCause] = useState('');
  const [reopenReason, setReopenReason] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [validationError, setValidationError] = useState('');

  if (!ticket) return null;

  // Allowed transitions map based on ALLOWED_TRANSITIONS
  const transitionsMap = {
    OPEN: isEmployee ? ['CLOSED'] : ['ASSIGNED', 'CLOSED'],
    ASSIGNED: ['IN_PROGRESS', 'PENDING', 'OPEN'],
    IN_PROGRESS: ['PENDING', 'RESOLVED'],
    PENDING: ['IN_PROGRESS', 'RESOLVED'],
    RESOLVED: isEmployee ? ['IN_PROGRESS'] : ['CLOSED', 'IN_PROGRESS'],
    CLOSED: ['IN_PROGRESS'],
  };

  const allowedNextStates = transitionsMap[ticket.status] || [];

  const handleStatusSelect = (status) => {
    setSelectedStatus(status);
    setValidationError('');
    setError(null);
  };

  const isReopening =
    ['RESOLVED', 'CLOSED'].includes(ticket.status) && selectedStatus === 'IN_PROGRESS';
  const isResolving = selectedStatus === 'RESOLVED';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setValidationError('');

    if (!selectedStatus) {
      setValidationError('Please select a target status');
      return;
    }

    if (isResolving && !resolutionNotes.trim()) {
      setValidationError('Resolution notes are mandatory when marking a ticket as RESOLVED');
      return;
    }

    if (isReopening && !reopenReason.trim()) {
      setValidationError('A reopen reason is required to reopen this ticket');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        status: selectedStatus,
        resolutionNotes: isResolving ? resolutionNotes.trim() : undefined,
        rootCause: isResolving && rootCause ? rootCause.trim() : undefined,
        reopenReason: isReopening ? reopenReason.trim() : undefined,
      };

      const res = await ticketService.changeTicketStatus(ticket._id, payload);
      if (res && res.success) {
        onStatusChanged(res.data);
        onClose();
      }
    } catch (err) {
      console.error('Failed to change status:', err);
      setError(err.message || 'Status transition failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Transition Ticket Status (${ticket.ticketNumber})`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            isLoading={isSubmitting}
            disabled={!selectedStatus}
          >
            Confirm Status Change
          </Button>
        </>
      }
    >
      {error && (
        <Alert variant="error" style={{ marginBottom: '1.25rem' }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {validationError && (
        <Alert variant="warning" style={{ marginBottom: '1.25rem' }} onClose={() => setValidationError('')}>
          {validationError}
        </Alert>
      )}

      <div style={{ marginBottom: '1.25rem' }}>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
          Current Status: <Badge variant="status">{ticket.status}</Badge>
        </div>

        <label className="form-label" style={{ marginBottom: '0.5rem', display: 'block' }}>
          Select Next Lifecycle State:
        </label>

        {allowedNextStates.length === 0 ? (
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            No status transitions are currently available for your role from <strong>{ticket.status}</strong>.
          </p>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {allowedNextStates.map((state) => (
              <button
                key={state}
                type="button"
                onClick={() => handleStatusSelect(state)}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  border:
                    selectedStatus === state
                      ? '2px solid var(--color-primary-600)'
                      : '1px solid var(--border-default)',
                  backgroundColor: selectedStatus === state ? 'var(--color-primary-50)' : '#ffffff',
                  fontWeight: selectedStatus === state ? 600 : 500,
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)',
                }}
              >
                {state.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Conditional: Resolution Notes */}
      {isResolving && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label htmlFor="res-notes" className="form-label">
              Resolution Notes <span style={{ color: 'var(--color-rose-600)' }}>*</span>
            </label>
            <textarea
              id="res-notes"
              rows={3}
              required
              className="form-input"
              placeholder="Explain how the issue was diagnosed and resolved..."
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
            />
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label htmlFor="root-cause" className="form-label">
              Root Cause Summary (Optional)
            </label>
            <input
              id="root-cause"
              type="text"
              className="form-input"
              placeholder="e.g. Expired SSL certificate on proxy"
              value={rootCause}
              onChange={(e) => setRootCause(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* Conditional: Reopening Reason */}
      {isReopening && (
        <div style={{ marginTop: '1rem' }}>
          <div className="form-group">
            <label htmlFor="reopen-reason" className="form-label">
              Reason for Reopening <span style={{ color: 'var(--color-rose-600)' }}>*</span>
            </label>
            <textarea
              id="reopen-reason"
              rows={3}
              required
              className="form-input"
              placeholder="State why the previous resolution was incomplete or recurred..."
              value={reopenReason}
              onChange={(e) => setReopenReason(e.target.value)}
            />
          </div>
          {isEmployee && (
            <p style={{ fontSize: '0.775rem', color: 'var(--text-muted)' }}>
              Note: Requester ticket reopening is permitted within 72 hours of resolution.
            </p>
          )}
        </div>
      )}
    </Modal>
  );
};

export default ChangeStatusModal;
