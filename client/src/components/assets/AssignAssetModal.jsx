import { useState } from 'react';
import Modal from '../ui/Modal';
import Input from '../ui/Input';
import Button from '../ui/Button';
import Alert from '../ui/Alert';
import assetService from '../../services/assetService.js';
import { useAuth } from '../../context/useAuth';
import { UserCheck } from 'lucide-react';

export const AssignAssetModal = ({ isOpen, onClose, asset, onAssigned }) => {
  const { user } = useAuth();
  const [targetUserId, setTargetUserId] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  if (!asset || !isOpen) return null;

  const handleSelfAssign = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await assetService.assignAsset(asset._id, {
        assignedTo: user._id,
        notes: notes ? notes.trim() : `Assigned to ${user.firstName} ${user.lastName}`,
      });
      if (res && res.success) {
        onAssigned(res.data);
        onClose();
      }
    } catch (err) {
      setError(err.message || 'Failed to assign asset');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!targetUserId.trim()) {
      setError('Please provide the Target User ID (24-character hex ID)');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const res = await assetService.assignAsset(asset._id, {
        assignedTo: targetUserId.trim(),
        notes: notes.trim() || undefined,
      });
      if (res && res.success) {
        onAssigned(res.data);
        onClose();
      }
    } catch (err) {
      setError(err.message || 'Failed to assign asset');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Check Out Asset: ${asset.name} (${asset.assetTag})`}
      maxWidth="540px"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            isLoading={isSubmitting}
            icon={<UserCheck size={16} />}
          >
            Confirm Checkout
          </Button>
        </>
      }
    >
      {error && (
        <Alert variant="error" style={{ marginBottom: '1.25rem' }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* Quick Assign to Logged-in User */}
        <div
          style={{
            padding: '1rem',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--color-primary-50)',
            border: '1px solid var(--color-primary-100)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
          }}
        >
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--color-primary-900)' }}>
              Check out to myself
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--color-primary-700)' }}>
              Assign custody to {user?.firstName} {user?.lastName} ({user?.email})
            </div>
          </div>

          <Button
            variant="primary"
            size="sm"
            onClick={handleSelfAssign}
            isLoading={isSubmitting}
          >
            Assign to Me
          </Button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-subtle)' }} />
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            OR ASSIGN TO EMPLOYEE
          </span>
          <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-subtle)' }} />
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <Input
            label="Assignee User ID (MongoDB 24-character ObjectId)"
            id="assign-user-id"
            placeholder="e.g. 60c72b2f9b1d8b0015f8a001"
            value={targetUserId}
            onChange={(e) => setTargetUserId(e.target.value)}
            helper="Enter the employee or technician account ID to transfer asset custody."
          />

          <div className="form-group" style={{ margin: 0 }}>
            <label htmlFor="assign-notes" className="form-label">
              Checkout Notes & Terms
            </label>
            <textarea
              id="assign-notes"
              rows={3}
              className="form-input"
              placeholder="e.g. Assigned for remote work setup; accessory bundle included..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{ resize: 'vertical' }}
            />
          </div>
        </form>
      </div>
    </Modal>
  );
};

export default AssignAssetModal;
