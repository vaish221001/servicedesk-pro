import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import knowledgeService from '../services/knowledgeService.js';
import Card, { CardBody } from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import EmptyState from '../components/ui/EmptyState';
import Alert from '../components/ui/Alert';

import ArticleEditorModal from '../components/knowledge/ArticleEditorModal';

import {
  BookOpen,
  Search,
  PlusCircle,
  ThumbsUp,
  Eye,
  Lock,
  ChevronLeft,
  ChevronRight,
  FolderOpen,
} from 'lucide-react';

export const KnowledgeBasePage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isEmployee = user?.role === 'EMPLOYEE';
  const canAuthor = ['TECHNICIAN', 'IT_MANAGER', 'SYSTEM_ADMIN'].includes(user?.role);

  const [articles, setArticles] = useState([]);
  const [categories, setCategories] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 12, total: 0, totalPages: 1 });

  // Filters
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [visibilityFilter, setVisibilityFilter] = useState('');

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  // Load categories
  useEffect(() => {
    let ignore = false;
    async function loadCategories() {
      try {
        const res = await knowledgeService.getCategories({ isActive: true });
        if (!ignore && res) {
          const list = Array.isArray(res) ? res : res.data || [];
          setCategories(list);
        }
      } catch (err) {
        console.error('Failed to load categories:', err);
      }
    }
    loadCategories();
    return () => {
      ignore = true;
    };
  }, []);

  // Fetch articles
  useEffect(() => {
    let ignore = false;
    async function loadArticles() {
      try {
        const params = {
          page,
          limit: 12,
        };
        if (activeSearch.trim()) params.search = activeSearch.trim();
        if (selectedCategory) params.categoryId = selectedCategory;
        if (statusFilter && !isEmployee) params.status = statusFilter;
        if (visibilityFilter && !isEmployee) params.visibility = visibilityFilter;

        const res = await knowledgeService.getArticles(params);
        if (!ignore && res && res.success) {
          setArticles(res.data || []);
          setPagination(
            res.pagination || { page, limit: 12, total: res.data?.length || 0, totalPages: 1 }
          );
        }
      } catch (err) {
        if (!ignore) {
          console.error('Failed to load knowledge articles:', err);
          setError(err.message || 'Failed to load knowledge articles');
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    loadArticles();
    return () => {
      ignore = true;
    };
  }, [page, activeSearch, selectedCategory, statusFilter, visibilityFilter, isEmployee]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setIsLoading(true);
    setActiveSearch(searchTerm);
    setPage(1);
  };

  const handleCategoryClick = (catId) => {
    setIsLoading(true);
    setSelectedCategory((prev) => (prev === catId ? '' : catId));
    setPage(1);
  };

  const handleResetFilters = () => {
    setIsLoading(true);
    setSearchTerm('');
    setActiveSearch('');
    setSelectedCategory('');
    setStatusFilter('');
    setVisibilityFilter('');
    setPage(1);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header Banner */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          padding: '1.5rem',
          backgroundColor: '#ffffff',
          borderRadius: 'var(--radius-xl)',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-xs)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <BookOpen size={24} style={{ color: 'var(--color-primary-600)' }} />
            <h2 style={{ fontSize: '1.45rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Knowledge Base & Self-Service
            </h2>
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Find answers, troubleshooting walkthroughs, IT policies, and setup manuals.
          </p>
        </div>

        {canAuthor && (
          <Button
            variant="primary"
            onClick={() => setIsEditorOpen(true)}
            icon={<PlusCircle size={16} />}
          >
            Author Article
          </Button>
        )}
      </div>

      {/* Hero Search Bar Card */}
      <Card>
        <CardBody style={{ padding: '1.25rem' }}>
          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 300px', position: 'relative' }}>
              <Search
                size={18}
                style={{
                  position: 'absolute',
                  left: '0.875rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--color-slate-400)',
                }}
              />
              <input
                type="text"
                className="form-input"
                placeholder="Search troubleshooting guides, keywords, setup documentation..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ paddingLeft: '2.5rem', fontSize: '0.95rem', height: '42px' }}
              />
            </div>

            <Button type="submit" variant="primary" style={{ height: '42px', padding: '0 1.25rem' }}>
              Search Articles
            </Button>
            {(activeSearch || selectedCategory || statusFilter || visibilityFilter) && (
              <Button type="button" variant="ghost" onClick={handleResetFilters} style={{ height: '42px' }}>
                Clear Filters
              </Button>
            )}
          </form>

          {/* Category Filter Pills */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              flexWrap: 'wrap',
              marginTop: '1rem',
              paddingTop: '0.875rem',
              borderTop: '1px solid var(--border-subtle)',
            }}
          >
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Categories:
            </span>

            <button
              type="button"
              onClick={() => handleCategoryClick('')}
              style={{
                border: 'none',
                cursor: 'pointer',
                borderRadius: 'var(--radius-full)',
                padding: '0.25rem 0.75rem',
                fontSize: '0.775rem',
                fontWeight: 600,
                backgroundColor: !selectedCategory ? 'var(--color-primary-600)' : 'var(--color-slate-100)',
                color: !selectedCategory ? '#ffffff' : 'var(--text-secondary)',
                transition: 'all var(--transition-fast)',
              }}
            >
              All Topics
            </button>

            {categories.map((cat) => (
              <button
                key={cat._id}
                type="button"
                onClick={() => handleCategoryClick(cat._id)}
                style={{
                  border: 'none',
                  cursor: 'pointer',
                  borderRadius: 'var(--radius-full)',
                  padding: '0.25rem 0.75rem',
                  fontSize: '0.775rem',
                  fontWeight: 600,
                  backgroundColor: selectedCategory === cat._id ? 'var(--color-primary-600)' : 'var(--color-slate-100)',
                  color: selectedCategory === cat._id ? '#ffffff' : 'var(--text-secondary)',
                  transition: 'all var(--transition-fast)',
                }}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {/* Staff Status & Visibility Filter row */}
          {!isEmployee && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                flexWrap: 'wrap',
                marginTop: '0.75rem',
                paddingTop: '0.75rem',
                borderTop: '1px solid var(--border-subtle)',
                fontSize: '0.8125rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Status:</span>
                <select
                  className="form-input"
                  value={statusFilter}
                  onChange={(e) => {
                    setIsLoading(true);
                    setStatusFilter(e.target.value);
                    setPage(1);
                  }}
                  style={{ height: '32px', padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                >
                  <option value="">All Statuses</option>
                  <option value="PUBLISHED">Published</option>
                  <option value="DRAFT">Draft</option>
                  <option value="ARCHIVED">Archived</option>
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Visibility:</span>
                <select
                  className="form-input"
                  value={visibilityFilter}
                  onChange={(e) => {
                    setIsLoading(true);
                    setVisibilityFilter(e.target.value);
                    setPage(1);
                  }}
                  style={{ height: '32px', padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                >
                  <option value="">All Visibility</option>
                  <option value="PUBLIC">Public</option>
                  <option value="INTERNAL_ONLY">Internal Only</option>
                </select>
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Main Articles Grid / List */}
      <div>
        {error && (
          <div style={{ marginBottom: '1.25rem' }}>
            <Alert variant="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          </div>
        )}

        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '4rem 0' }}>
            <LoadingSpinner size="md" color="primary" />
            <p style={{ marginTop: '0.75rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              Searching knowledge repository...
            </p>
          </div>
        ) : articles.length === 0 ? (
          <Card>
            <CardBody>
              <EmptyState
                icon={<FolderOpen size={48} />}
                title="No articles found"
                description={
                  activeSearch || selectedCategory || statusFilter || visibilityFilter
                    ? 'No documentation matched your query. Try broadening your search or resetting filters.'
                    : 'The knowledge base is currently being populated.'
                }
                action={
                  activeSearch || selectedCategory || statusFilter || visibilityFilter ? (
                    <Button variant="secondary" size="sm" onClick={handleResetFilters}>
                      Reset Filters
                    </Button>
                  ) : canAuthor ? (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => setIsEditorOpen(true)}
                      icon={<PlusCircle size={14} />}
                    >
                      Write First Guide
                    </Button>
                  ) : null
                }
              />
            </CardBody>
          </Card>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: '1.25rem',
            }}
          >
            {articles.map((article) => {
              const authorName = article.authorId
                ? `${article.authorId.firstName} ${article.authorId.lastName}`
                : 'IT Team';

              return (
                <div
                  key={article._id}
                  onClick={() => navigate(`/knowledge-base/${article.slug || article._id}`)}
                  style={{
                    backgroundColor: '#ffffff',
                    borderRadius: 'var(--radius-xl)',
                    border: '1px solid var(--border-subtle)',
                    padding: '1.25rem',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '1rem',
                    boxShadow: 'var(--shadow-xs)',
                    transition: 'box-shadow var(--transition-fast), border-color var(--transition-fast), transform var(--transition-fast)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--color-primary-300)';
                    e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-subtle)';
                    e.currentTarget.style.boxShadow = 'var(--shadow-xs)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  <div>
                    {/* Header Badges */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.75rem' }}>
                      <Badge color="indigo">{article.categoryId?.name || 'Knowledge'}</Badge>
                      <div style={{ display: 'flex', gap: '0.35rem' }}>
                        {article.visibility === 'INTERNAL_ONLY' && (
                          <Badge color="amber">
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                              <Lock size={10} /> Internal
                            </span>
                          </Badge>
                        )}
                        {article.status !== 'PUBLISHED' && (
                          <Badge color="slate">{article.status}</Badge>
                        )}
                      </div>
                    </div>

                    {/* Title */}
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.4, margin: '0 0 0.5rem 0' }}>
                      {article.title}
                    </h3>

                    {/* Summary Snippet */}
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                      {article.summary || 'Click to view complete step-by-step documentation and instructions.'}
                    </p>

                    {/* Tags */}
                    {article.tags && article.tags.length > 0 && (
                      <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
                        {article.tags.slice(0, 3).map((tag, idx) => (
                          <span
                            key={idx}
                            style={{
                              backgroundColor: 'var(--color-slate-100)',
                              color: 'var(--color-slate-600)',
                              fontSize: '0.7rem',
                              padding: '0.1rem 0.35rem',
                              borderRadius: 'var(--radius-sm)',
                            }}
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Card Footer */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingTop: '0.75rem',
                      borderTop: '1px solid var(--border-subtle)',
                      fontSize: '0.75rem',
                      color: 'var(--text-muted)',
                    }}
                  >
                    <div>
                      By {authorName} • {new Date(article.updatedAt || article.createdAt).toLocaleDateString()}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Eye size={12} /> {article.viewCount || 0}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--color-emerald-600)' }}>
                        <ThumbsUp size={12} /> {article.helpfulVotes || 0}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination Footer */}
        {pagination.totalPages > 1 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '1rem',
              marginTop: '1.5rem',
              backgroundColor: '#ffffff',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-subtle)',
              fontSize: '0.8125rem',
              color: 'var(--text-secondary)',
            }}
          >
            <div>
              Page {pagination.page} of {pagination.totalPages} ({pagination.total} articles)
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <Button
                variant="secondary"
                size="sm"
                disabled={pagination.page <= 1 || isLoading}
                onClick={() => {
                  setIsLoading(true);
                  setPage((p) => p - 1);
                }}
                icon={<ChevronLeft size={14} />}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={pagination.page >= pagination.totalPages || isLoading}
                onClick={() => {
                  setIsLoading(true);
                  setPage((p) => p + 1);
                }}
                icon={<ChevronRight size={14} />}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Article Creation Modal */}
      {isEditorOpen && (
        <ArticleEditorModal
          isOpen={isEditorOpen}
          onClose={() => setIsEditorOpen(false)}
          onArticleSaved={(newArticle) => {
            setIsLoading(true);
            setPage(1);
            navigate(`/knowledge-base/${newArticle.slug || newArticle._id}`);
          }}
        />
      )}
    </div>
  );
};

export default KnowledgeBasePage;
