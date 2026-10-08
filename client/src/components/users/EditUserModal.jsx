import { useState } from 'react';
import Modal from '../ui/Modal';
import Input from '../ui/Input';
import Button from '../ui/Button';
import Alert from '../ui/Alert';
import userService from '../../services/userService';
import { Save, KeyRound, Eye, EyeOff } from 'lucide-react';

export const EditUserModal = ({
  isOpen,
  onClose,
  user,
  onUserUpdated,
  departments = [],
  currentAdminId,
}) => {
  const [prevId, setPrevId] = useState(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('EMPLOYEE');
  const [departmentId, setDepartmentId] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [phone, setPhone] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Sync state when selected user changes
  if (user && isOpen && user._id !== prevId) {
    setPrevId(user._id);
    setFirstName(user.firstName || '');
    setLastName(user.lastName || '');
    setEmail(user.email || '');
    setRole(user.role || 'EMPLOYEE');
    setDepartmentId(user.departmentId?._id || user.departmentId || '');
    setJobTitle(user.jobTitle || '');
    setPhone(user.phone || '');
    setNewPassword('');
    setShowPassword(false);
    setError(null);
  }

  if (!isOpen || !user) return null;

  const isSelf = user._id === currentAdminId;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!firstName.trim()) {
      setError('First name cannot be empty');
      return;
    }
    if (!lastName.trim()) {
      setError('Last name cannot be empty');
      return;
    }
    if (!email.trim()) {
      setError('Email address cannot be empty');
      return;
    }
    const emailRegex = /^\S+@\S+\.\S+$/;
    if (!emailRegex.test(email.trim())) {
      setError('Please provide a valid email address');
      return;
    }
    if (!departmentId) {
      setError('Primary department is required');
      return;
    }
    if (newPassword && newPassword.length < 8) {
      setError('Reset password must be at least 8 characters');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim().toLowerCase(),
        role,
        departmentId,
        jobTitle: jobTitle.trim() || undefined,
        phone: phone.trim() || undefined,
      };

      if (newPassword.trim()) {
        payload.password = newPassword.trim();
      }

      const res = await userService.updateUser(user._id, payload);
      if (res && res.success) {
        onUserUpdated(res.data);
        onClose();
      }
    } catch (err) {
      setError(err.message || 'Failed to update user profile');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Edit User: ${user.firstName} ${user.lastName}`}
      maxWidth="600px"
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
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {error && (
          <Alert variant="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {isSelf && (
          <Alert variant="info">
            You are editing your own administrator account. Privileges cannot be changed to lock yourself out.
          </Alert>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <Input
            label="First Name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
          />
          <Input
            label="Last Name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
          />
        </div>

        <Input
          label="Email Address"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.35rem', color: 'var(--text-secondary)' }}>
              System Authorization Role <span style={{ color: 'var(--color-rose-500)' }}>*</span>
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="select-input"
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
                backgroundColor: '#ffffff',
                fontSize: '0.9rem',
              }}
              required
            >
              <option value="EMPLOYEE">EMPLOYEE (Standard Requester)</option>
              <option value="TECHNICIAN">TECHNICIAN (Support Engineer)</option>
              <option value="ASSET_MANAGER">ASSET_MANAGER (Inventory Admin)</option>
              <option value="IT_MANAGER">IT_MANAGER (Department Head)</option>
              <option value="SYSTEM_ADMIN">SYSTEM_ADMIN (Full Administrator)</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.35rem', color: 'var(--text-secondary)' }}>
              Primary Department <span style={{ color: 'var(--color-rose-500)' }}>*</span>
            </label>
            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              className="select-input"
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
                backgroundColor: '#ffffff',
                fontSize: '0.9rem',
              }}
              required
            >
              <option value="">Select Primary Department...</option>
              {departments.map((dept) => (
                <option key={dept._id} value={dept._id}>
                  {dept.name} ({dept.code})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <Input
            label="Job Title"
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            placeholder="e.g. Senior Network Specialist"
          />
          <Input
            label="Phone Number"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="e.g. +1 555-0144"
          />
        </div>

        <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
            <KeyRound size={16} style={{ color: 'var(--color-primary-600)' }} />
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              Reset Password (Optional)
            </span>
          </div>
          <div style={{ position: 'relative' }}>
            <Input
              type={showPassword ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Leave blank to preserve current password"
            />
            {newPassword && (
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '10px',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                }}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            )}
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            If provided, user will be required to log in with this new password. Min 8 characters.
          </p>
        </div>
      </form>
    </Modal>
  );
};

export default EditUserModal;
