import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import knowledgeService from '../services/knowledgeService.js';
import Card, { CardBody } from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import Alert from '../components/ui/Alert';

import ArticleEditorModal from '../components/knowledge/ArticleEditorModal';

import {
  ArrowLeft,
  ThumbsUp,
  ThumbsDown,
  Eye,
  Edit,
  Trash2,
  CheckCircle,
  Archive,
  Lock,
  Tag,
  Share2,
} from 'lucide-react';

export const KnowledgeArticleDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isEmployee = user?.role === 'EMPLOYEE';
  const isTechnician = user?.role === 'TECHNICIAN';
  const canManage = ['SYSTEM_ADMIN', 'IT_MANAGER'].includes(user?.role);

  const [article, setArticle] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Voting feedback state
  const [hasVoted, setHasVoted] = useState(false);
  const [voteMessage, setVoteMessage] = useState(null);
  const [isVoting, setIsVoting] = useState(false);

  // Management Modal
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [actionSuccess, setActionSuccess] = useState(null);

  useEffect(() => {
    let ignore = false;
    async function loadArticle() {
      try {
        const res = await knowledgeService.getArticle(id);
        if (!ignore && res && res.success) {
          setArticle(res.data);
        }
      } catch (err) {
        if (!ignore) {
          console.error('Failed to load knowledge article:', err);
          setError(err.message || 'Article not found or you do not have permission to view it.');
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    loadArticle();
    return () => {
      ignore = true;
    };
  }, [id]);

  const handleVote = async (isHelpful) => {
    if (hasVoted || isVoting) return;
    setIsVoting(true);
    try {
      const res = await knowledgeService.voteFeedback(article._id, isHelpful);
      if (res && res.success) {
        setHasVoted(true);
        setVoteMessage(isHelpful ? 'Thank you! Glad this article was helpful.' : 'Thank you for your feedback. We will work to improve this guide.');
        setArticle((prev) => ({
          ...prev,
          helpfulVotes: res.helpfulVotes ?? prev.helpfulVotes,
          notHelpfulVotes: res.notHelpfulVotes ?? prev.notHelpfulVotes,
        }));
      }
    } catch (err) {
      console.error('Vote feedback error:', err);
    } finally {
      setIsVoting(false);
    }
  };

  const handlePublish = async () => {
    try {
      const res = await knowledgeService.publishArticle(article._id);
      if (res && res.success) {
        setArticle(res.data);
        setActionSuccess('Article has been published successfully.');
      }
    } catch (err) {
      setError(err.message || 'Failed to publish article');
    }
  };

  const handleArchive = async () => {
    if (!window.confirm('Are you sure you want to archive this article? It will be hidden from public view.')) {
      return;
    }
    try {
      const res = await knowledgeService.archiveArticle(article._id);
      if (res && res.success) {
        setArticle(res.data);
        setActionSuccess('Article has been archived.');
      }
    } catch (err) {
      setError(err.message || 'Failed to archive article');
    }
  };

  const handleReview = async () => {
    try {
      const res = await knowledgeService.reviewArticle(article._id);
      if (res && res.success) {
        setArticle(res.data);
        setActionSuccess('Marked article as reviewed today.');
      }
    } catch (err) {
      setError(err.message || 'Failed to record review');
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Permanently delete article "${article.title}"? This action is irreversible.`)) {
      return;
    }
    try {
      await knowledgeService.deleteArticle(article._id);
      navigate('/knowledge-base');
    } catch (err) {
      setError(err.message || 'Failed to delete article');
    }
  };

  const handleShare = () => {
    navigator.clipboard?.writeText(window.location.href);
    setActionSuccess('Article link copied to clipboard!');
  };

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '5rem 0' }}>
        <LoadingSpinner size="lg" color="primary" />
        <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>
          Retrieving documentation...
        </p>
      </div>
    );
  }

  if (error || !article) {
    return (
      <div style={{ maxWidth: '600px', margin: '3rem auto' }}>
        <Alert variant="error" title="Knowledge Base Notice">
          {error || 'This article could not be found, has been archived, or requires elevated authorization.'}
        </Alert>
        <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
          <Button variant="secondary" onClick={() => navigate('/knowledge-base')} icon={<ArrowLeft size={16} />}>
            Back to Knowledge Base
          </Button>
        </div>
      </div>
    );
  }

  const author = article.authorId;
  const authorName = author ? `${author.firstName} ${author.lastName}` : 'IT Operations Team';
  const reviewer = article.reviewedBy;
  const reviewerName = reviewer ? `${reviewer.firstName} ${reviewer.lastName}` : null;

  // Check if technician is author or admin/manager
  const canEdit = canManage || (isTechnician && author?._id === user?._id);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '1000px', margin: '0 auto' }}>
      {/* Top Breadcrumb & Action Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          padding: '1.25rem 1.5rem',
          backgroundColor: '#ffffff',
          borderRadius: 'var(--radius-xl)',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-xs)',
        }}
      >
        <Link
          to="/knowledge-base"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            color: 'var(--text-secondary)',
            fontSize: '0.875rem',
            fontWeight: 500,
          }}
        >
          <ArrowLeft size={16} />
          Knowledge Base Directory
        </Link>

        {/* Action Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <Button variant="secondary" size="sm" onClick={handleShare} icon={<Share2 size={14} />}>
            Share
          </Button>

          {canEdit && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsEditOpen(true)}
              icon={<Edit size={14} />}
            >
              Edit Guide
            </Button>
          )}

          {!isEmployee && canEdit && (
            <>
              {article.status !== 'PUBLISHED' ? (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handlePublish}
                  icon={<CheckCircle size={14} />}
                >
                  Publish Live
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleArchive}
                  icon={<Archive size={14} />}
                >
                  Archive
                </Button>
              )}

              <Button
                variant="secondary"
                size="sm"
                onClick={handleReview}
              >
                Mark Reviewed
              </Button>
            </>
          )}

          {canManage && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              icon={<Trash2 size={14} style={{ color: 'var(--color-rose-600)' }} />}
            >
              Delete
            </Button>
          )}
        </div>
      </div>

      {actionSuccess && (
        <Alert variant="success" onClose={() => setActionSuccess(null)}>
          {actionSuccess}
        </Alert>
      )}

      {/* Main Article Document Card */}
      <Card>
        <CardBody style={{ padding: '2rem' }}>
          {/* Article Header & Badges */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
            <Badge color="indigo">{article.categoryId?.name || 'Help Topic'}</Badge>
            <Badge variant="status">{article.status}</Badge>
            {article.visibility === 'INTERNAL_ONLY' && (
              <Badge color="amber">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                  <Lock size={12} /> Internal IT Guide
                </span>
              </Badge>
            )}
          </div>

          {/* Title */}
          <h1 style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.3, marginBottom: '0.75rem' }}>
            {article.title}
          </h1>

          {/* Meta Bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '1rem',
              paddingBottom: '1.25rem',
              marginBottom: '1.75rem',
              borderBottom: '1px solid var(--border-subtle)',
              fontSize: '0.8125rem',
              color: 'var(--text-muted)',
            }}
          >
            <div>
              Authored by <strong>{authorName}</strong> on {new Date(article.createdAt).toLocaleDateString()}
              {article.lastReviewedAt && (
                <span> • Last reviewed {new Date(article.lastReviewedAt).toLocaleDateString()}{reviewerName ? ` by ${reviewerName}` : ''}</span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Eye size={14} /> {article.viewCount || 0} views
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--color-emerald-600)' }}>
                <ThumbsUp size={14} /> {article.helpfulVotes || 0} found helpful
              </span>
            </div>
          </div>

          {/* Summary Callout Banner (if present) */}
          {article.summary && (
            <div
              style={{
                padding: '1rem 1.25rem',
                backgroundColor: 'var(--color-slate-50)',
                borderRadius: 'var(--radius-lg)',
                borderLeft: '4px solid var(--color-primary-600)',
                fontSize: '0.95rem',
                color: 'var(--text-secondary)',
                lineHeight: 1.6,
                marginBottom: '1.75rem',
              }}
            >
              {article.summary}
            </div>
          )}

          {/* Formatted Article Body */}
          <div
            style={{
              fontSize: '0.975rem',
              lineHeight: 1.8,
              color: 'var(--text-primary)',
              whiteSpace: 'pre-wrap',
              marginBottom: '2rem',
            }}
          >
            {article.content}
          </div>

          {/* Tags */}
          {article.tags && article.tags.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', paddingTop: '1.25rem', borderTop: '1px solid var(--border-subtle)' }}>
              <Tag size={14} style={{ color: 'var(--color-slate-400)' }} />
              {article.tags.map((tag, idx) => (
                <span
                  key={idx}
                  style={{
                    backgroundColor: 'var(--color-slate-100)',
                    color: 'var(--color-slate-700)',
                    fontSize: '0.775rem',
                    padding: '0.2rem 0.6rem',
                    borderRadius: 'var(--radius-sm)',
                    fontWeight: 500,
                  }}
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Helpful Feedback Voting Card */}
      <Card style={{ backgroundColor: 'var(--color-slate-50)', borderColor: 'var(--border-subtle)' }}>
        <CardBody style={{ textAlign: 'center', padding: '1.75rem 1rem' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
            Was this article helpful?
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            Your feedback helps us continuously improve IT support documentation.
          </p>

          {hasVoted ? (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                color: 'var(--color-emerald-700)',
                backgroundColor: 'var(--color-emerald-50)',
                padding: '0.5rem 1.25rem',
                borderRadius: 'var(--radius-full)',
                fontWeight: 600,
                fontSize: '0.875rem',
              }}
            >
              <CheckCircle size={16} />
              {voteMessage}
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
              <Button
                variant="secondary"
                onClick={() => handleVote(true)}
                isLoading={isVoting}
                icon={<ThumbsUp size={16} style={{ color: 'var(--color-emerald-600)' }} />}
              >
                Yes, it helped
              </Button>
              <Button
                variant="secondary"
                onClick={() => handleVote(false)}
                isLoading={isVoting}
                icon={<ThumbsDown size={16} style={{ color: 'var(--color-rose-600)' }} />}
              >
                No, needs improvement
              </Button>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Article Edit Modal */}
      {isEditOpen && (
        <ArticleEditorModal
          isOpen={isEditOpen}
          onClose={() => setIsEditOpen(false)}
          article={article}
          onArticleSaved={(updated) => setArticle(updated)}
        />
      )}
    </div>
  );
};

export default KnowledgeArticleDetailPage;
