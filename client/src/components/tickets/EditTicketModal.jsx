import { useState } from 'react';
import Modal from '../ui/Modal';
import Input from '../ui/Input';
import Button from '../ui/Button';
import Alert from '../ui/Alert';
import ticketService from '../../services/ticketService';
import { useAuth } from '../../context/useAuth';
import { classifyTicket } from '../../utils/aiAssistant';
import { Save, Sparkles } from 'lucide-react';

export const EditTicketModal = ({ isOpen, onClose, ticket, onTicketUpdated }) => {
  const { user } = useAuth();
  const isEmployee = user?.role === 'EMPLOYEE';

  const [prevId, setPrevId] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [tagsInput, setTagsInput] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  if (ticket && isOpen && ticket._id !== prevId) {
    setPrevId(ticket._id);
    setTitle(ticket.title || '');
    setDescription(ticket.description || '');
    setPriority(ticket.priority || 'MEDIUM');
    setTagsInput(Array.isArray(ticket.tags) ? ticket.tags.join(', ') : '');
    setError(null);
  }

  if (!ticket || !isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Title cannot be empty');
      return;
    }
    if (!description.trim()) {
      setError('Description cannot be empty');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim(),
      };

      if (!isEmployee) {
        payload.priority = priority;
        payload.tags = tagsInput
          ? tagsInput.split(',').map((t) => t.trim()).filter(Boolean)
          : [];
      }

      const res = await ticketService.updateTicket(ticket._id, payload);
      if (res && res.success) {
        onTicketUpdated(res.data);
        onClose();
      }
    } catch (err) {
      setError(err.message || 'Failed to update ticket');
    } finally {
      setIsSubmitting(false);
    }
  };

  const aiTriage = (title.trim().length >= 5 || description.trim().length >= 10)
    ? classifyTicket(title, description, [])
    : null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Edit Ticket (${ticket.ticketNumber})`}
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

      <form onSubmit={handleSubmit}>
        <Input
          label="Subject"
          id="edit-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />

        <div className="form-group">
          <label htmlFor="edit-desc" className="form-label">
            Description <span style={{ color: 'var(--color-rose-600)' }}>*</span>
          </label>
          <textarea
            id="edit-desc"
            rows={4}
            className="form-input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            style={{ resize: 'vertical' }}
          />
        </div>

        {!isEmployee && (
          <>
            <div className="form-group">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                <label htmlFor="edit-priority" className="form-label" style={{ margin: 0 }}>
                  Priority
                </label>
                {aiTriage && aiTriage.priority !== priority && (
                  <button
                    type="button"
                    onClick={() => setPriority(aiTriage.priority)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--color-primary-600)',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      padding: 0,
                    }}
                  >
                    <Sparkles size={12} />
                    AI Suggests: {aiTriage.priority} ({aiTriage.confidence}%) - Apply
                  </button>
                )}
              </div>
              <select
                id="edit-priority"
                className="form-input"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </div>

            <Input
              label="Tags (Comma separated)"
              id="edit-tags"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
            />
          </>
        )}
      </form>
    </Modal>
  );
};

export default EditTicketModal;
