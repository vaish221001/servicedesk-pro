import { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import Input from '../ui/Input';
import Button from '../ui/Button';
import Alert from '../ui/Alert';
import assetService from '../../services/assetService.js';
import { Save } from 'lucide-react';

export const EditAssetModal = ({ isOpen, onClose, asset, onAssetUpdated }) => {
  const [prevId, setPrevId] = useState(null);
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

  // Sync state with asset prop when asset changes
  if (asset && isOpen && asset._id !== prevId) {
    setPrevId(asset._id);
    setAssetTag(asset.assetTag || '');
    setName(asset.name || '');
    setAssetType(asset.assetType || 'HARDWARE');
    setCategory(asset.category || '');
    setManufacturer(asset.manufacturer || '');
    setModel(asset.model || '');
    setSerialNumber(asset.serialNumber || '');
    setVendorId(asset.vendorId?._id || asset.vendorId || '');
    setStatus(asset.status || 'IN_STOCK');
    setLocation(asset.location || '');
    setPurchaseDate(asset.purchaseDate ? asset.purchaseDate.substring(0, 10) : '');
    setPurchaseCost(asset.purchaseCost !== null && asset.purchaseCost !== undefined ? String(asset.purchaseCost) : '');
    setWarrantyExpiry(asset.warrantyExpiry ? asset.warrantyExpiry.substring(0, 10) : '');
    setNotes(asset.notes || '');
    setError(null);
  }

  // Load active vendors
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

  if (!asset || !isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!assetTag.trim()) {
      setError('Asset Tag is required');
      return;
    }
    if (!name.trim()) {
      setError('Asset Name is required');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const payload = {
        assetTag: assetTag.trim().toUpperCase(),
        name: name.trim(),
        assetType,
        category: category.trim() || null,
        manufacturer: manufacturer.trim() || null,
        model: model.trim() || null,
        serialNumber: serialNumber.trim() || null,
        vendorId: vendorId || null,
        status,
        location: location.trim() || null,
        purchaseDate: purchaseDate || null,
        purchaseCost: purchaseCost ? Number(purchaseCost) : null,
        warrantyExpiry: warrantyExpiry || null,
        notes: notes.trim() || null,
      };

      const res = await assetService.updateAsset(asset._id, payload);
      if (res && res.success) {
        onAssetUpdated(res.data);
        onClose();
      }
    } catch (err) {
      setError(err.message || 'Failed to update asset');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Edit Asset (${asset.assetTag})`}
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
            icon={<Save size={16} />}
          >
            Save Changes
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
            id="edit-asset-tag"
            value={assetTag}
            onChange={(e) => setAssetTag(e.target.value)}
            required
          />

          <Input
            label="Asset Name"
            id="edit-asset-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label htmlFor="edit-asset-type" className="form-label">
              Asset Type
            </label>
            <select
              id="edit-asset-type"
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
            <label htmlFor="edit-asset-status" className="form-label">
              Status
            </label>
            <select
              id="edit-asset-status"
              className="form-input"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              required
              disabled={asset.status === 'ASSIGNED'}
            >
              <option value="IN_STOCK">In Stock (Available)</option>
              <option value="ASSIGNED" disabled>Assigned (Use Return to change)</option>
              <option value="IN_REPAIR">In Repair</option>
              <option value="RETIRED">Retired</option>
              <option value="LOST">Lost</option>
              <option value="DISPOSED">Disposed</option>
            </select>
          </div>

          <Input
            label="Category"
            id="edit-asset-cat"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <Input
            label="Manufacturer"
            id="edit-asset-mfg"
            value={manufacturer}
            onChange={(e) => setManufacturer(e.target.value)}
          />

          <Input
            label="Model"
            id="edit-asset-model"
            value={model}
            onChange={(e) => setModel(e.target.value)}
          />

          <Input
            label="Serial Number"
            id="edit-asset-sn"
            value={serialNumber}
            onChange={(e) => setSerialNumber(e.target.value)}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label htmlFor="edit-asset-vendor" className="form-label">
              Vendor / Supplier
            </label>
            <select
              id="edit-asset-vendor"
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
            id="edit-asset-loc"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />

          <Input
            label="Purchase Cost ($)"
            id="edit-asset-cost"
            type="number"
            min="0"
            step="0.01"
            value={purchaseCost}
            onChange={(e) => setPurchaseCost(e.target.value)}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <Input
            label="Purchase Date"
            id="edit-asset-pdate"
            type="date"
            value={purchaseDate}
            onChange={(e) => setPurchaseDate(e.target.value)}
          />

          <Input
            label="Warranty Expiry Date"
            id="edit-asset-wdate"
            type="date"
            value={warrantyExpiry}
            onChange={(e) => setWarrantyExpiry(e.target.value)}
          />
        </div>

        <div className="form-group" style={{ margin: 0 }}>
          <label htmlFor="edit-asset-notes" className="form-label">
            Internal Notes
          </label>
          <textarea
            id="edit-asset-notes"
            rows={3}
            className="form-input"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            style={{ resize: 'vertical' }}
          />
        </div>
      </form>
    </Modal>
  );
};

export default EditAssetModal;
