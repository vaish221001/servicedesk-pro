import { useState, useEffect, useMemo } from 'react';
import Modal from '../ui/Modal';
import Input from '../ui/Input';
import Button from '../ui/Button';
import Alert from '../ui/Alert';
import Badge from '../ui/Badge';
import LoadingSpinner from '../ui/LoadingSpinner';
import ticketService from '../../services/ticketService.js';
import aiAssistant from '../../utils/aiAssistant.js';
import { useAuth } from '../../context/useAuth';
import { PlusCircle, Sparkles, BookOpen, ExternalLink, Check, X } from 'lucide-react';

export const CreateTicketModal = ({ isOpen, onClose, onTicketCreated }) => {
  const { user } = useAuth();
  const isEmployee = user?.role === 'EMPLOYEE';

  const [categories, setCategories] = useState([]);
  const [assets, setAssets] = useState([]);
  const [isLoadingDropdowns, setIsLoadingDropdowns] = useState(false);

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [channel, setChannel] = useState('PORTAL');
  const [relatedAssetId, setRelatedAssetId] = useState('');
  const [tagsInput, setTagsInput] = useState('');

  // AI & Recommendation States
  const [aiSuggestion, setAiSuggestion] = useState(null);
  const [isAiDismissed, setIsAiDismissed] = useState(false);
  const [recommendedArticles, setRecommendedArticles] = useState([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [clientErrors, setClientErrors] = useState({});

  // Load Categories and Assets when modal opens
  useEffect(() => {
    if (!isOpen) return;

    let ignore = false;
    async function fetchMetadata() {
      setIsLoadingDropdowns(true);
      setError(null);
      try {
        const [catRes, assetRes] = await Promise.all([
          ticketService.getCategories({ isActive: true }),
          ticketService.getAssets({ limit: 100 }),
        ]);

        if (!ignore) {
          const catList = Array.isArray(catRes) ? catRes : (catRes?.data || []);
          setCategories(catList);
          setAssets(assetRes?.data || assetRes?.assets || (Array.isArray(assetRes) ? assetRes : []));
        }
      } catch (err) {
        if (!ignore) {
          console.error('Failed to load category/asset options:', err);
          setError('Failed to load category definitions from server.');
        }
      } finally {
        if (!ignore) {
          setIsLoadingDropdowns(false);
        }
      }
    }

    fetchMetadata();

    return () => {
      ignore = true;
    };
  }, [isOpen]);

  // Derive top-level categories and subcategories
  const topCategories = useMemo(
    () => (Array.isArray(categories) ? categories.filter((c) => !c.parentId) : []),
    [categories]
  );
  const availableSubcategories = useMemo(
    () =>
      Array.isArray(categories)
        ? categories.filter(
            (c) => c.parentId && (c.parentId._id === selectedCategoryId || c.parentId === selectedCategoryId)
          )
        : [],
    [categories, selectedCategoryId]
  );

  // Trigger AI analysis and KB recommendations on title / description change
  useEffect(() => {
    if (!isOpen || isAiDismissed) return;

    const timer = setTimeout(() => {
      // 1. AI Classification
      if (topCategories.length > 0 && (title.trim().length >= 4 || description.trim().length >= 10)) {
        const result = aiAssistant.classifyTicket(title, description, topCategories);
        setAiSuggestion(result);
      } else {
        setAiSuggestion(null);
      }

      // 2. Knowledge Base Recommendation
      if (title.trim().length >= 3) {
        aiAssistant
          .getRecommendedArticles(title, 3)
          .then((articles) => {
            setRecommendedArticles(articles);
          })
          .catch(() => {
            setRecommendedArticles([]);
          });
      } else {
        setRecommendedArticles([]);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [title, description, topCategories, isOpen, isAiDismissed]);

  const handleApplyAiSuggestion = () => {
    if (!aiSuggestion) return;
    if (aiSuggestion.suggestedCategory) {
      setSelectedCategoryId(aiSuggestion.suggestedCategory._id);
    }
    if (aiSuggestion.suggestedPriority) {
      setPriority(aiSuggestion.suggestedPriority);
    }
    setIsAiDismissed(true);
  };

  const handleCategoryChange = (e) => {
    const catId = e.target.value;
    setSelectedCategoryId(catId);
    setSelectedSubcategoryId('');

    const found = categories.find((c) => c._id === catId);
    if (found && found.defaultPriority) {
      setPriority(found.defaultPriority);
    }

    if (clientErrors.categoryId) {
      setClientErrors((prev) => ({ ...prev, categoryId: null }));
    }
  };

  const validate = () => {
    const errs = {};
    if (!title.trim()) errs.title = 'Ticket title is required';
    if (!description.trim()) errs.description = 'Ticket description is required';
    if (!selectedCategoryId) errs.categoryId = 'Please select a service category';

    setClientErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!validate()) return;

    const selectedCategory = categories.find((c) => c._id === selectedCategoryId);
    if (!selectedCategory) {
      setError('Selected category is invalid.');
      return;
    }

    const departmentId =
      selectedCategory.departmentId?._id || selectedCategory.departmentId;

    if (!departmentId) {
      setError('The selected category is not linked to a valid department.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim(),
        categoryId: selectedCategoryId,
        departmentId,
        subcategoryId: selectedSubcategoryId || null,
        priority,
        channel,
        relatedAssetId: relatedAssetId || null,
        tags: tagsInput
          ? tagsInput
              .split(',')
              .map((t) => t.trim())
              .filter(Boolean)
          : [],
      };

      const res = await ticketService.createTicket(payload);
      if (res && res.success) {
        setTitle('');
        setDescription('');
        setSelectedCategoryId('');
        setSelectedSubcategoryId('');
        setPriority('MEDIUM');
        setRelatedAssetId('');
        setTagsInput('');
        setAiSuggestion(null);
        setIsAiDismissed(false);
        setRecommendedArticles([]);
        onTicketCreated(res.data);
        onClose();
      }
    } catch (err) {
      console.error('Failed to create ticket:', err);
      setError(err.message || 'Failed to submit ticket.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create New Service Ticket"
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
            Submit Ticket
          </Button>
        </>
      }
    >
      {error && (
        <Alert variant="error" style={{ marginBottom: '1.25rem' }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {isLoadingDropdowns ? (
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <LoadingSpinner size="md" color="primary" />
          <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Loading categories and department definitions...
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Title */}
          <Input
            label="Ticket Subject"
            id="ticket-title"
            name="title"
            placeholder="e.g. VPN connection timeout on remote gateway"
            required
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (clientErrors.title) setClientErrors((prev) => ({ ...prev, title: null }));
            }}
            error={clientErrors.title}
          />

          {/* Description */}
          <div className="form-group" style={{ margin: 0 }}>
            <label htmlFor="ticket-description" className="form-label">
              Description <span style={{ color: 'var(--color-rose-600)' }}>*</span>
            </label>
            <textarea
              id="ticket-description"
              name="description"
              rows={3}
              required
              className={`form-input ${clientErrors.description ? 'error' : ''}`}
              placeholder="Provide specific details about the issue, error messages, and reproduction steps..."
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                if (clientErrors.description) setClientErrors((prev) => ({ ...prev, description: null }));
              }}
              style={{ resize: 'vertical' }}
            />
            {clientErrors.description && (
              <span className="form-error-msg" role="alert">
                {clientErrors.description}
              </span>
            )}
          </div>

          {/* AI Triage Suggestion Banner */}
          {aiSuggestion && !isAiDismissed && (
            <div
              style={{
                backgroundColor: 'var(--color-sky-50)',
                border: '1px solid var(--color-sky-200)',
                borderRadius: 'var(--radius-lg)',
                padding: '0.875rem 1rem',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: '0.75rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem' }}>
                <Sparkles size={18} style={{ color: 'var(--color-sky-600)', marginTop: '2px', flexShrink: 0 }} />
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--color-sky-900)' }}>
                      AI Triage Suggestion:
                    </span>
                    {aiSuggestion.suggestedCategory && (
                      <Badge color="blue">{aiSuggestion.suggestedCategory.name}</Badge>
                    )}
                    <Badge variant="priority">{aiSuggestion.suggestedPriority}</Badge>
                    <span style={{ fontSize: '0.725rem', color: 'var(--color-sky-700)' }}>
                      ({Math.round(aiSuggestion.confidence * 100)}% confidence)
                    </span>
                  </div>
                  <div style={{ fontSize: '0.775rem', color: 'var(--color-sky-800)', marginTop: '0.2rem' }}>
                    {aiSuggestion.probableIssue}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={handleApplyAiSuggestion}
                  icon={<Check size={14} />}
                >
                  Apply
                </Button>
                <button
                  type="button"
                  onClick={() => setIsAiDismissed(true)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--color-sky-600)',
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'flex',
                  }}
                  aria-label="Dismiss AI suggestion"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          )}

          {/* Knowledge Base Instant Recommendations Banner */}
          {recommendedArticles.length > 0 && (
            <div
              style={{
                backgroundColor: 'var(--color-amber-50)',
                border: '1px solid var(--color-amber-200)',
                borderRadius: 'var(--radius-lg)',
                padding: '0.875rem 1rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--color-amber-900)', fontWeight: 600, fontSize: '0.825rem', marginBottom: '0.5rem' }}>
                <BookOpen size={16} />
                <span>Recommended Solution Guides (may solve your issue immediately):</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                {recommendedArticles.map((art) => (
                  <div
                    key={art._id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '0.8rem',
                      padding: '0.3rem 0',
                    }}
                  >
                    <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                      {art.title}
                    </span>
                    <a
                      href={`/knowledge-base/${art.slug || art._id}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.2rem',
                        color: 'var(--color-primary-600)',
                        textDecoration: 'none',
                        fontWeight: 600,
                        fontSize: '0.75rem',
                      }}
                    >
                      Read Guide <ExternalLink size={12} />
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Category & Subcategory Rows */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label htmlFor="ticket-category" className="form-label">
                Category <span style={{ color: 'var(--color-rose-600)' }}>*</span>
              </label>
              <select
                id="ticket-category"
                className={`form-input ${clientErrors.categoryId ? 'error' : ''}`}
                value={selectedCategoryId}
                onChange={handleCategoryChange}
                required
              >
                <option value="">Select Category...</option>
                {topCategories.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {clientErrors.categoryId && (
                <span className="form-error-msg" role="alert">
                  {clientErrors.categoryId}
                </span>
              )}
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label htmlFor="ticket-subcategory" className="form-label">
                Subcategory
              </label>
              <select
                id="ticket-subcategory"
                className="form-input"
                value={selectedSubcategoryId}
                onChange={(e) => setSelectedSubcategoryId(e.target.value)}
                disabled={!selectedCategoryId || availableSubcategories.length === 0}
              >
                <option value="">
                  {!selectedCategoryId
                    ? 'Select a Category First'
                    : availableSubcategories.length === 0
                    ? 'No Subcategories Available'
                    : 'Select Subcategory (Optional)'}
                </option>
                {availableSubcategories.map((sc) => (
                  <option key={sc._id} value={sc._id}>
                    {sc.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Priority & Channel */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label htmlFor="ticket-priority" className="form-label">
                Priority
              </label>
              <select
                id="ticket-priority"
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

            {!isEmployee && (
              <div className="form-group" style={{ margin: 0 }}>
                <label htmlFor="ticket-channel" className="form-label">
                  Intake Channel
                </label>
                <select
                  id="ticket-channel"
                  className="form-input"
                  value={channel}
                  onChange={(e) => setChannel(e.target.value)}
                >
                  <option value="PORTAL">Web Portal</option>
                  <option value="EMAIL">Email</option>
                  <option value="PHONE">Phone Call</option>
                  <option value="CHAT">Live Chat</option>
                </select>
              </div>
            )}
          </div>

          {/* Linked Asset */}
          <div className="form-group" style={{ margin: 0 }}>
            <label htmlFor="ticket-asset" className="form-label">
              Linked Hardware / Software Asset
            </label>
            <select
              id="ticket-asset"
              className="form-input"
              value={relatedAssetId}
              onChange={(e) => setRelatedAssetId(e.target.value)}
            >
              <option value="">No Hardware Linked</option>
              {assets.map((ast) => (
                <option key={ast._id} value={ast._id}>
                  {ast.assetTag} — {ast.name} ({ast.status})
                </option>
              ))}
            </select>
          </div>

          {/* Tags */}
          <Input
            label="Tags (Optional)"
            id="ticket-tags"
            name="tags"
            placeholder="e.g. vpn, macos, urgent (comma-separated)"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
          />
        </form>
      )}
    </Modal>
  );
};

export default CreateTicketModal;
