import { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import LoadingSpinner from '../ui/LoadingSpinner';
import assetService from '../../services/assetService.js';
import { Building2, Mail, Phone, Globe, MapPin, Edit, HardDrive } from 'lucide-react';

export const VendorDetailModal = ({ isOpen, onClose, vendor, onEditVendor }) => {
  const [assets, setAssets] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let ignore = false;
    async function loadVendorAssets() {
      if (!vendor?._id) return;
      setIsLoading(true);
      try {
        const res = await assetService.getVendorAssets(vendor._id);
        if (!ignore && res && res.success) {
          setAssets(res.data || []);
        }
      } catch (err) {
        console.error('Failed to load vendor assets:', err);
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    if (isOpen && vendor?._id) {
      loadVendorAssets();
    }

    return () => {
      ignore = true;
    };
  }, [isOpen, vendor?._id]);

  if (!vendor || !isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Vendor Profile: ${vendor.name}`}
      maxWidth="680px"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          {onEditVendor && (
            <Button
              variant="primary"
              onClick={() => {
                onClose();
                onEditVendor(vendor);
              }}
              icon={<Edit size={16} />}
            >
              Edit Vendor
            </Button>
          )}
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* Vendor Contact Information Header Card */}
        <div
          style={{
            padding: '1.25rem',
            backgroundColor: 'var(--color-slate-50)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Building2 size={20} style={{ color: 'var(--color-primary-600)' }} />
              <span style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-primary)' }}>
                {vendor.name}
              </span>
            </div>
            <Badge color={vendor.isActive ? 'emerald' : 'slate'}>
              {vendor.isActive ? 'Active Supplier' : 'Inactive'}
            </Badge>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '0.75rem',
              fontSize: '0.85rem',
              marginTop: '0.25rem',
            }}
          >
            {vendor.contactPerson && (
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Contact: </span>
                <span style={{ fontWeight: 500 }}>{vendor.contactPerson}</span>
              </div>
            )}
            {vendor.email && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Mail size={14} style={{ color: 'var(--text-muted)' }} />
                <a
                  href={`mailto:${vendor.email}`}
                  style={{ color: 'var(--color-primary-600)', textDecoration: 'none' }}
                >
                  {vendor.email}
                </a>
              </div>
            )}
            {vendor.phone && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Phone size={14} style={{ color: 'var(--text-muted)' }} />
                <span>{vendor.phone}</span>
              </div>
            )}
            {vendor.website && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Globe size={14} style={{ color: 'var(--text-muted)' }} />
                <a
                  href={vendor.website.startsWith('http') ? vendor.website : `https://${vendor.website}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: 'var(--color-primary-600)', textDecoration: 'none' }}
                >
                  {vendor.website}
                </a>
              </div>
            )}
          </div>

          {vendor.address && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.35rem', fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
              <MapPin size={14} style={{ color: 'var(--text-muted)', marginTop: '2px', flexShrink: 0 }} />
              <span>{vendor.address}</span>
            </div>
          )}

          {vendor.notes && (
            <div
              style={{
                marginTop: '0.5rem',
                paddingTop: '0.5rem',
                borderTop: '1px solid var(--border-subtle)',
                fontSize: '0.8rem',
                color: 'var(--text-secondary)',
                lineHeight: 1.5,
              }}
            >
              <strong>Notes: </strong>{vendor.notes}
            </div>
          )}
        </div>

        {/* Associated Assets Section */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <HardDrive size={18} style={{ color: 'var(--color-primary-600)' }} />
            <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              Procured Assets & Licenses ({assets.length})
            </h4>
          </div>

          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '2rem 0' }}>
              <LoadingSpinner size="sm" color="primary" />
              <p style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Loading vendor asset records...
              </p>
            </div>
          ) : assets.length === 0 ? (
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1.5rem 0', backgroundColor: 'var(--color-slate-50)', borderRadius: 'var(--radius-md)' }}>
              No inventory hardware or software licenses currently linked to this vendor.
            </p>
          ) : (
            <div style={{ maxHeight: '240px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {assets.map((asset) => (
                <div
                  key={asset._id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.65rem 0.875rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)',
                    backgroundColor: '#ffffff',
                    fontSize: '0.825rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--color-primary-600)' }}>
                      {asset.assetTag}
                    </span>
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {asset.name}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {asset.assetType} {asset.model ? `• ${asset.model}` : ''}
                      </div>
                    </div>
                  </div>

                  <Badge variant="status">{asset.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default VendorDetailModal;
