import { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import Input from '../ui/Input';
import Button from '../ui/Button';
import Alert from '../ui/Alert';
import knowledgeService from '../../services/knowledgeService.js';
import { BookOpen, Save } from 'lucide-react';

export const ArticleEditorModal = ({ isOpen, onClose, article = null, onArticleSaved }) => {
  const [prevId, setPrevId] = useState(null);
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [summary, setSummary] = useState('');
  const [content, setContent] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [visibility, setVisibility] = useState('PUBLIC');
  const [status, setStatus] = useState('DRAFT');

  const [categories, setCategories] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Sync state with article prop
  if (article && isOpen && article._id !== prevId) {
    setPrevId(article._id);
    setTitle(article.title || '');
    setSlug(article.slug || '');
    setCategoryId(article.categoryId?._id || article.categoryId || '');
    setSummary(article.summary || '');
    setContent(article.content || '');
    setTagsInput(Array.isArray(article.tags) ? article.tags.join(', ') : '');
    setVisibility(article.visibility || 'PUBLIC');
    setStatus(article.status || 'DRAFT');
    setError(null);
  } else if (!article && isOpen && prevId !== null) {
    setPrevId(null);
    setTitle('');
    setSlug('');
    setCategoryId('');
    setSummary('');
    setContent('');
    setTagsInput('');
    setVisibility('PUBLIC');
    setStatus('DRAFT');
    setError(null);
  }

  // Load categories
  useEffect(() => {
    let ignore = false;
    async function loadCategories() {
      try {
        const res = await knowledgeService.getCategories({ isActive: true });
        if (!ignore && res) {
          const list = Array.isArray(res) ? res : res.data || [];
          setCategories(list);
          if (!categoryId && list.length > 0) {
            setCategoryId(list[0]._id);
          }
        }
      } catch (err) {
        console.error('Failed to load categories for article editor:', err);
      }
    }
    if (isOpen) {
      loadCategories();
    }
    return () => {
      ignore = true;
    };
  }, [isOpen, categoryId]);

  if (!isOpen) return null;

  const isEditing = !!article;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Article title is required');
      return;
    }
    if (!categoryId) {
      setError('Please select a category');
      return;
    }
    if (!content.trim()) {
      setError('Article content cannot be empty');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const payload = {
        title: title.trim(),
        slug: slug.trim() || undefined,
        categoryId,
        summary: summary.trim() || undefined,
        content: content.trim(),
        tags: tagsInput ? tagsInput.split(',').map((t) => t.trim()).filter(Boolean) : [],
        visibility,
        status,
      };

      let res;
      if (isEditing) {
        res = await knowledgeService.updateArticle(article._id, payload);
      } else {
        res = await knowledgeService.createArticle(payload);
      }

      if (res && res.success) {
        onArticleSaved(res.data);
        onClose();
      }
    } catch (err) {
      setError(err.message || 'Failed to save knowledge article');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? `Edit Article: ${article.title}` : 'Author New Knowledge Base Article'}
      maxWidth="720px"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            isLoading={isSubmitting}
            icon={isEditing ? <Save size={16} /> : <BookOpen size={16} />}
          >
            {isEditing ? 'Update Article' : status === 'PUBLISHED' ? 'Publish Article' : 'Save Draft'}
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
          label="Article Title"
          id="kb-title"
          placeholder="e.g. How to Configure Company VPN on Windows & macOS"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label htmlFor="kb-category" className="form-label">
              Category <span style={{ color: 'var(--color-rose-600)' }}>*</span>
            </label>
            <select
              id="kb-category"
              className="form-input"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              required
            >
              <option value="">Select a category...</option>
              {categories.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label htmlFor="kb-visibility" className="form-label">
              Audience Visibility <span style={{ color: 'var(--color-rose-600)' }}>*</span>
            </label>
            <select
              id="kb-visibility"
              className="form-input"
              value={visibility}
              onChange={(e) => setVisibility(e.target.value)}
              required
            >
              <option value="PUBLIC">Public — All Employees & Staff</option>
              <option value="INTERNAL_ONLY">Internal Only — Technicians & IT Staff</option>
            </select>
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label htmlFor="kb-status" className="form-label">
              Publication Status <span style={{ color: 'var(--color-rose-600)' }}>*</span>
            </label>
            <select
              id="kb-status"
              className="form-input"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              required
            >
              <option value="DRAFT">Draft (Unpublished)</option>
              <option value="PUBLISHED">Published (Live)</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </div>
        </div>

        <Input
          label="Summary / Abstract"
          id="kb-summary"
          placeholder="Brief 1-2 sentence overview visible in article cards and search results..."
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
        />

        <div className="form-group" style={{ margin: 0 }}>
          <label htmlFor="kb-content" className="form-label">
            Article Content <span style={{ color: 'var(--color-rose-600)' }}>*</span>
          </label>
          <textarea
            id="kb-content"
            rows={8}
            className="form-input"
            placeholder="Write clear, step-by-step instructions or documentation..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            required
            style={{ resize: 'vertical', fontFamily: 'inherit' }}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
          <Input
            label="Tags (Comma separated)"
            id="kb-tags"
            placeholder="e.g. vpn, network, macos, windows"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
          />

          <Input
            label="Custom URL Slug (Optional)"
            id="kb-slug"
            placeholder="leave blank to auto-generate"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            helper="URL-friendly identifier. Auto-generated from title if left blank."
          />
        </div>
      </form>
    </Modal>
  );
};

export default ArticleEditorModal;
