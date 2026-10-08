import { useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Alert from '../ui/Alert';
import Input from '../ui/Input';
import ticketService from '../../services/ticketService';
import { useAuth } from '../../context/useAuth';
import { UserCheck, UserX } from 'lucide-react';

export const AssignTicketModal = ({ isOpen, onClose, ticket, onAssigned }) => {
  const { user } = useAuth();
  const [targetUserId, setTargetUserId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  if (!ticket) return null;

  const handleSelfAssign = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await ticketService.assignTicket(ticket._id, user._id);
      if (res && res.success) {
        onAssigned(res.data);
        onClose();
      }
    } catch (err) {
      setError(err.message || 'Failed to self-assign ticket');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUnassign = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await ticketService.assignTicket(ticket._id, null);
      if (res && res.success) {
        onAssigned(res.data);
        onClose();
      }
    } catch (err) {
      setError(err.message || 'Failed to unassign ticket');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCustomAssign = async (e) => {
    e.preventDefault();
    if (!targetUserId.trim()) {
      setError('Please provide a technician User ID');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const res = await ticketService.assignTicket(ticket._id, targetUserId.trim());
      if (res && res.success) {
        onAssigned(res.data);
        onClose();
      }
    } catch (err) {
      setError(err.message || 'Assignment failed. Ensure user exists and has department access.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Assign Ticket (${ticket.ticketNumber})`}
      footer={
        <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
          Cancel
        </Button>
      }
    >
      {error && (
        <Alert variant="error" style={{ marginBottom: '1.25rem' }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <div style={{ marginBottom: '1.5rem' }}>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
          Current Assignee:{' '}
          <strong>
            {ticket.assignedTo
              ? `${ticket.assignedTo.firstName} ${ticket.assignedTo.lastName}`
              : 'Unassigned'}
          </strong>
        </p>

        {/* Quick Self-Assignment */}
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <Button
            variant="primary"
            onClick={handleSelfAssign}
            isLoading={isSubmitting}
            icon={<UserCheck size={16} />}
          >
            Assign to Myself ({user.firstName})
          </Button>

          {ticket.assignedTo && (
            <Button
              variant="secondary"
              onClick={handleUnassign}
              isLoading={isSubmitting}
              icon={<UserX size={16} />}
            >
              Unassign
            </Button>
          )}
        </div>

        {/* Manual Assignee ID Input */}
        <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1.25rem' }}>
          <form onSubmit={handleCustomAssign}>
            <Input
              label="Or Assign to Technician by User ID"
              id="assignee-id"
              placeholder="e.g. 64b8a1c9e2b10a39..."
              value={targetUserId}
              onChange={(e) => setTargetUserId(e.target.value)}
              helperText="Technician directory picker scheduled for Admin phase. Enter valid User ID."
            />
            <Button
              type="submit"
              variant="secondary"
              isLoading={isSubmitting}
              disabled={!targetUserId.trim()}
              style={{ marginTop: '0.5rem' }}
            >
              Assign to Technician ID
            </Button>
          </form>
        </div>
      </div>
    </Modal>
  );
};

export default AssignTicketModal;
