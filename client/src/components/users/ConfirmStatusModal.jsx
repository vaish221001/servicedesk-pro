import { useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Alert from '../ui/Alert';
import userService from '../../services/userService';
import { UserX, UserCheck } from 'lucide-react';

export const ConfirmStatusModal = ({
  isOpen,
  onClose,
  user,
  onStatusChanged,
  currentAdminId,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen || !user) return null;

  const isSelf = user._id === currentAdminId;
  const isDeactivating = user.isActive;

  const handleToggle = async () => {
    if (isSelf && isDeactivating) {
      setError('You cannot deactivate your own administrator account');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const res = await userService.setUserStatus(user._id, !user.isActive);
      if (res && res.success) {
        onStatusChanged(res.data);
        onClose();
      }
    } catch (err) {
      setError(err.message || 'Failed to update user account status');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isDeactivating ? 'Deactivate User Account' : 'Reactivate User Account'}
      maxWidth="480px"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant={isDeactivating ? 'danger' : 'primary'}
            onClick={handleToggle}
            isLoading={isSubmitting}
            disabled={isSelf && isDeactivating}
            icon={isDeactivating ? <UserX size={16} /> : <UserCheck size={16} />}
          >
            {isDeactivating ? 'Confirm Deactivation' : 'Confirm Reactivation'}
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {error && (
          <Alert variant="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {isSelf && isDeactivating ? (
          <Alert variant="warning" title="Operation Not Allowed">
            You cannot deactivate your own account while logged in as the active administrator.
          </Alert>
        ) : isDeactivating ? (
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.925rem', lineHeight: 1.5 }}>
            Are you sure you want to deactivate the account for{' '}
            <strong style={{ color: 'var(--text-primary)' }}>
              {user.firstName} {user.lastName} ({user.email})
            </strong>
            ?
            <div
              style={{
                marginTop: '0.75rem',
                padding: '0.75rem',
                backgroundColor: 'var(--color-rose-50)',
                color: 'var(--color-rose-700)',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.825rem',
              }}
            >
              The user will be immediately blocked from logging in or performing any actions on ServiceDesk Pro. Existing ticket and asset history will be preserved.
            </div>
          </div>
        ) : (
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.925rem', lineHeight: 1.5 }}>
            Are you sure you want to reactivate the account for{' '}
            <strong style={{ color: 'var(--text-primary)' }}>
              {user.firstName} {user.lastName} ({user.email})
            </strong>
            ?
            <div
              style={{
                marginTop: '0.75rem',
                padding: '0.75rem',
                backgroundColor: 'var(--color-emerald-50)',
                color: 'var(--color-emerald-700)',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.825rem',
              }}
            >
              The user will regain login access according to their configured system role ({user.role}).
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default ConfirmStatusModal;
