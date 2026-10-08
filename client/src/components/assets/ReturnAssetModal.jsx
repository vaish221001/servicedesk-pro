import { useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Alert from '../ui/Alert';
import assetService from '../../services/assetService.js';
import { RotateCcw } from 'lucide-react';

export const ReturnAssetModal = ({ isOpen, onClose, asset, onReturned }) => {
  const [returnCondition, setReturnCondition] = useState('GOOD');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  if (!asset || !isOpen) return null;

  const currentAssigneeName = asset.currentAssigneeId
    ? `${asset.currentAssigneeId.firstName} ${asset.currentAssigneeId.lastName}`
    : 'Unknown User';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await assetService.returnAsset(asset._id, {
        returnCondition,
        notes: notes.trim() || undefined,
      });
      if (res && res.success) {
        onReturned(res.data);
        onClose();
      }
    } catch (err) {
      setError(err.message || 'Failed to process asset return');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Check In / Return Asset: ${asset.assetTag}`}
      maxWidth="520px"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            isLoading={isSubmitting}
            icon={<RotateCcw size={16} />}
          >
            Confirm Return to Inventory
          </Button>
        </>
      }
    >
      {error && (
        <Alert variant="error" style={{ marginBottom: '1.25rem' }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div
          style={{
            padding: '0.875rem 1rem',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--color-slate-50)',
            border: '1px solid var(--border-subtle)',
            fontSize: '0.85rem',
          }}
        >
          <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>
            Returning From Custody Of
          </div>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>
            {currentAssigneeName}
          </div>
          {asset.currentAssigneeId?.email && (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.775rem' }}>
              {asset.currentAssigneeId.email}
            </div>
          )}
        </div>

        <div className="form-group" style={{ margin: 0 }}>
          <label htmlFor="return-condition" className="form-label">
            Return Inspection Condition <span style={{ color: 'var(--color-rose-600)' }}>*</span>
          </label>
          <select
            id="return-condition"
            className="form-input"
            value={returnCondition}
            onChange={(e) => setReturnCondition(e.target.value)}
            required
          >
            <option value="GOOD">Good — Full working condition, clean</option>
            <option value="FAIR">Fair — Normal wear & tear, operational</option>
            <option value="POOR">Poor — Functional but heavily worn</option>
            <option value="DAMAGED">Damaged — Needs repair or component replacement</option>
          </select>
        </div>

        <div className="form-group" style={{ margin: 0 }}>
          <label htmlFor="return-notes" className="form-label">
            Check-In Notes
          </label>
          <textarea
            id="return-notes"
            rows={3}
            className="form-input"
            placeholder="Inspection observations, returned peripherals (chargers, cables), cosmetic notes..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            style={{ resize: 'vertical' }}
          />
        </div>
      </form>
    </Modal>
  );
};

export default ReturnAssetModal;
