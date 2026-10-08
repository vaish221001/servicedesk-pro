import { useState } from 'react';
import Modal from '../ui/Modal';
import Input from '../ui/Input';
import Button from '../ui/Button';
import Alert from '../ui/Alert';
import assetService from '../../services/assetService.js';
import { Building2, Save } from 'lucide-react';

export const VendorModal = ({ isOpen, onClose, vendor = null, onVendorSaved }) => {
  const [prevId, setPrevId] = useState(null);
  const [name, setName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  if (vendor && isOpen && vendor._id !== prevId) {
    setPrevId(vendor._id);
    setName(vendor.name || '');
    setContactPerson(vendor.contactPerson || '');
    setEmail(vendor.email || '');
    setPhone(vendor.phone || '');
    setWebsite(vendor.website || '');
    setAddress(vendor.address || '');
    setNotes(vendor.notes || '');
    setError(null);
  } else if (!vendor && isOpen && prevId !== null) {
    setPrevId(null);
    setName('');
    setContactPerson('');
    setEmail('');
    setPhone('');
    setWebsite('');
    setAddress('');
    setNotes('');
    setError(null);
  }

  if (!isOpen) return null;

  const isEditing = !!vendor;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Vendor name is required');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const payload = {
        name: name.trim(),
        contactPerson: contactPerson.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        website: website.trim() || null,
        address: address.trim() || null,
        notes: notes.trim() || null,
      };

      let res;
      if (isEditing) {
        res = await assetService.updateVendor(vendor._id, payload);
      } else {
        res = await assetService.createVendor(payload);
      }

      if (res && res.success) {
        onVendorSaved(res.data);
        onClose();
      }
    } catch (err) {
      setError(err.message || 'Failed to save vendor');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? `Edit Vendor: ${vendor.name}` : 'Add New Hardware/Software Vendor'}
      maxWidth="580px"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            isLoading={isSubmitting}
            icon={isEditing ? <Save size={16} /> : <Building2 size={16} />}
          >
            {isEditing ? 'Save Changes' : 'Create Vendor'}
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
        <Input
          label="Vendor Company Name"
          id="vendor-name"
          placeholder="e.g. Dell Enterprise Direct"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
          <Input
            label="Contact Person / Account Executive"
            id="vendor-contact"
            placeholder="e.g. Jane Doe"
            value={contactPerson}
            onChange={(e) => setContactPerson(e.target.value)}
          />

          <Input
            label="Contact Email"
            id="vendor-email"
            type="email"
            placeholder="support@dell.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
          <Input
            label="Support Phone"
            id="vendor-phone"
            placeholder="e.g. +1 (800) 555-0199"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />

          <Input
            label="Website URL"
            id="vendor-web"
            placeholder="e.g. https://www.dell.com"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </div>

        <Input
          label="Physical Address / Billing Office"
          id="vendor-address"
          placeholder="e.g. One Dell Way, Round Rock, TX 78682"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />

        <div className="form-group" style={{ margin: 0 }}>
          <label htmlFor="vendor-notes" className="form-label">
            Account / SLA Notes
          </label>
          <textarea
            id="vendor-notes"
            rows={3}
            className="form-input"
            placeholder="SLA response guarantees, client account number, procurement contract terms..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            style={{ resize: 'vertical' }}
          />
        </div>
      </form>
    </Modal>
  );
};

export default VendorModal;
