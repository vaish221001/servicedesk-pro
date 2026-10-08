import { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import Input from '../ui/Input';
import Button from '../ui/Button';
import Alert from '../ui/Alert';
import assetService from '../../services/assetService.js';
import { PlusCircle } from 'lucide-react';

export const CreateAssetModal = ({ isOpen, onClose, onAssetCreated }) => {
  const [assetTag, setAssetTag] = useState('');
  const [name, setName] = useState('');
  const [assetType, setAssetType] = useState('HARDWARE');
  const [category, setCategory] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [model, setModel] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [vendorId, setVendorId] = useState('');
  const [status, setStatus] = useState('IN_STOCK');
  const [location, setLocation] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [purchaseCost, setPurchaseCost] = useState('');
  const [warrantyExpiry, setWarrantyExpiry] = useState('');
  const [notes, setNotes] = useState('');

  const [vendors, setVendors] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Load active vendors for dropdown
  useEffect(() => {
    let ignore = false;
    async function loadVendors() {
      try {
        const res = await assetService.getVendors({ isActive: true, limit: 100 });
        if (!ignore && res && res.success) {
          setVendors(res.data || []);
        }
      } catch (err) {
        console.error('Failed to load vendors:', err);
      }
    }
    if (isOpen) {
      loadVendors();
    }
    return () => {
      ignore = true;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!assetTag.trim()) {
      setError('Asset Tag is required (e.g. AST-1001)');
      return;
    }
    if (!name.trim()) {
      setError('Asset Name is required');
      return;
    }
    if (!assetType) {
      setError('Asset Type is required');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const payload = {
        assetTag: assetTag.trim().toUpperCase(),
        name: name.trim(),
        assetType,
        category: category.trim() || undefined,
        manufacturer: manufacturer.trim() || undefined,
        model: model.trim() || undefined,
        serialNumber: serialNumber.trim() || undefined,
        vendorId: vendorId || null,
        status,
        location: location.trim() || undefined,
        purchaseDate: purchaseDate || null,
        purchaseCost: purchaseCost ? Number(purchaseCost) : null,
        warrantyExpiry: warrantyExpiry || null,
        notes: notes.trim() || undefined,
      };

      const res = await assetService.createAsset(payload);
      if (res && res.success) {
        onAssetCreated(res.data);
        onClose();
      }
    } catch (err) {
      setError(err.message || 'Failed to register asset in inventory');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Register New Inventory Asset"
      maxWidth="680px"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            isLoading={isSubmitting}
            icon={<PlusCircle size={16} />}
          >
            Create Asset
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
          <Input
            label="Asset Tag"
            id="asset-tag"
            placeholder="e.g. AST-2026-001"
            value={assetTag}
            onChange={(e) => setAssetTag(e.target.value)}
            required
          />

          <Input
            label="Asset Name"
            id="asset-name"
            placeholder="e.g. Dell XPS 15 9530"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label htmlFor="asset-type" className="form-label">
              Asset Type <span style={{ color: 'var(--color-rose-600)' }}>*</span>
            </label>
            <select
              id="asset-type"
              className="form-input"
              value={assetType}
              onChange={(e) => setAssetType(e.target.value)}
              required
            >
              <option value="HARDWARE">Hardware</option>
              <option value="SOFTWARE">Software License</option>
              <option value="NETWORK">Networking Equipment</option>
              <option value="PERIPHERAL">Peripheral</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label htmlFor="asset-status" className="form-label">
              Initial Status <span style={{ color: 'var(--color-rose-600)' }}>*</span>
            </label>
            <select
              id="asset-status"
              className="form-input"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              required
            >
              <option value="IN_STOCK">In Stock (Available)</option>
              <option value="IN_REPAIR">In Repair</option>
              <option value="RETIRED">Retired</option>
              <option value="LOST">Lost</option>
              <option value="DISPOSED">Disposed</option>
            </select>
          </div>

          <Input
            label="Category"
            id="asset-category"
            placeholder="e.g. Laptop, Monitor"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <Input
            label="Manufacturer"
            id="asset-mfg"
            placeholder="e.g. Dell, Apple, Cisco"
            value={manufacturer}
            onChange={(e) => setManufacturer(e.target.value)}
          />

          <Input
            label="Model"
            id="asset-model"
            placeholder="e.g. XPS 15"
            value={model}
            onChange={(e) => setModel(e.target.value)}
          />

          <Input
            label="Serial Number"
            id="asset-sn"
            placeholder="e.g. SN-89472894"
            value={serialNumber}
            onChange={(e) => setSerialNumber(e.target.value)}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label htmlFor="asset-vendor" className="form-label">
              Vendor / Supplier
            </label>
            <select
              id="asset-vendor"
              className="form-input"
              value={vendorId}
              onChange={(e) => setVendorId(e.target.value)}
            >
              <option value="">No Vendor Linked</option>
              {vendors.map((v) => (
                <option key={v._id} value={v._id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>

          <Input
            label="Location"
            id="asset-location"
            placeholder="e.g. IT Storage Room A, Desk 4B"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />

          <Input
            label="Purchase Cost ($)"
            id="asset-cost"
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={purchaseCost}
            onChange={(e) => setPurchaseCost(e.target.value)}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <Input
            label="Purchase Date"
            id="asset-pdate"
            type="date"
            value={purchaseDate}
            onChange={(e) => setPurchaseDate(e.target.value)}
          />

          <Input
            label="Warranty Expiry Date"
            id="asset-wdate"
            type="date"
            value={warrantyExpiry}
            onChange={(e) => setWarrantyExpiry(e.target.value)}
          />
        </div>

        <div className="form-group" style={{ margin: 0 }}>
          <label htmlFor="asset-notes" className="form-label">
            Internal Notes
          </label>
          <textarea
            id="asset-notes"
            rows={3}
            className="form-input"
            placeholder="Asset condition, configuration notes, or license keys..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            style={{ resize: 'vertical' }}
          />
        </div>
      </form>
    </Modal>
  );
};

export default CreateAssetModal;
