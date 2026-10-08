import { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Alert from '../ui/Alert';
import LoadingSpinner from '../ui/LoadingSpinner';
import ticketService from '../../services/ticketService';
import { HardDrive, Unlink } from 'lucide-react';

export const LinkAssetModal = ({ isOpen, onClose, ticket, onAssetLinked }) => {
  const [assets, setAssets] = useState([]);
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen || !ticket) return;

    let ignore = false;
    async function loadAssets() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await ticketService.getAssets({ limit: 100 });
        if (!ignore) {
          const list = res?.data || res?.assets || [];
          setAssets(list);
          setSelectedAssetId(ticket.relatedAssetId?._id || ticket.relatedAssetId || '');
        }
      } catch (err) {
        if (!ignore) {
          setError(err.message || 'Failed to load organization assets');
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    loadAssets();

    return () => {
      ignore = true;
    };
  }, [isOpen, ticket]);

  if (!ticket) return null;

  const handleLink = async (assetId) => {
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await ticketService.linkAsset(ticket._id, assetId || null);
      if (res && res.success) {
        onAssetLinked(res.data);
        onClose();
      }
    } catch (err) {
      setError(err.message || 'Failed to link asset to ticket');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Link Asset to Ticket (${ticket.ticketNumber})`}
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

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <LoadingSpinner size="md" color="primary" />
          <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Loading authorized assets...
          </p>
        </div>
      ) : (
        <div>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            Select an authorized asset to associate with this ticket for diagnostic and hardware history tracking.
          </p>

          <div className="form-group">
            <label htmlFor="link-asset-select" className="form-label">
              Choose Asset
            </label>
            <select
              id="link-asset-select"
              className="form-input"
              value={selectedAssetId}
              onChange={(e) => setSelectedAssetId(e.target.value)}
            >
              <option value="">None / Unlinked</option>
              {assets.map((asset) => (
                <option key={asset._id} value={asset._id}>
                  {asset.assetTag} — {asset.name} ({asset.status})
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
            <Button
              variant="primary"
              onClick={() => handleLink(selectedAssetId)}
              isLoading={isSubmitting}
              icon={<HardDrive size={16} />}
              disabled={!selectedAssetId && !ticket.relatedAssetId}
            >
              Save Linked Asset
            </Button>

            {ticket.relatedAssetId && (
              <Button
                variant="secondary"
                onClick={() => handleLink(null)}
                isLoading={isSubmitting}
                icon={<Unlink size={16} />}
              >
                Unlink Current Asset
              </Button>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
};

export default LinkAssetModal;
