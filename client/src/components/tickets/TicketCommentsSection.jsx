import { useState, useRef } from 'react';
import Card, { CardHeader, CardTitle, CardBody } from '../ui/Card';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import Alert from '../ui/Alert';
import LoadingSpinner from '../ui/LoadingSpinner';
import ticketService from '../../services/ticketService';
import { useAuth } from '../../context/useAuth';
import {
  MessageSquare,
  Lock,
  Paperclip,
  Send,
  X,
  FileText,
} from 'lucide-react';

export const TicketCommentsSection = ({ ticketId, comments = [], onCommentAdded }) => {
  const { user } = useAuth();
  const canCreateInternalNotes = ['TECHNICIAN', 'IT_MANAGER', 'SYSTEM_ADMIN'].includes(user?.role);

  const [content, setContent] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [downloadingFile, setDownloadingFile] = useState(null);

  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (selectedFiles.length + files.length > 5) {
      setError('You can attach a maximum of 5 files per comment');
      return;
    }
    setSelectedFiles((prev) => [...prev, ...files]);
    setError(null);
  };

  const removeFile = (index) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim() && selectedFiles.length === 0) {
      setError('Please provide a message or attach a file');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('content', content.trim() || 'Attached files');
      formData.append('isInternal', isInternal ? 'true' : 'false');

      selectedFiles.forEach((file) => {
        formData.append('attachments', file);
      });

      const res = await ticketService.addComment(ticketId, formData);
      if (res && res.success) {
        setContent('');
        setIsInternal(false);
        setSelectedFiles([]);
        if (fileInputRef.current) fileInputRef.current.value = '';
        onCommentAdded(res.data);
      }
    } catch (err) {
      console.error('Failed to post comment:', err);
      setError(err.message || 'Failed to submit comment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownload = async (filename, originalName) => {
    setDownloadingFile(filename);
    try {
      await ticketService.downloadAttachment(ticketId, filename, originalName);
    } catch (err) {
      setError(err.message || 'Failed to download attachment');
    } finally {
      setDownloadingFile(null);
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Card>
      <CardHeader>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <MessageSquare size={18} style={{ color: 'var(--color-primary-600)' }} />
          <CardTitle>Conversation & Activity Thread ({comments.length})</CardTitle>
        </div>
      </CardHeader>

      <CardBody style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {error && (
          <Alert variant="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Existing Comments Feed */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {comments.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1.5rem 0', fontSize: '0.875rem' }}>
              No messages posted yet. Start the conversation below.
            </p>
          ) : (
            comments.map((comment) => {
              const author = comment.authorId;
              const authorName = author
                ? `${author.firstName} ${author.lastName}`
                : 'System / Unknown';
              const isStaff = ['TECHNICIAN', 'IT_MANAGER', 'SYSTEM_ADMIN'].includes(author?.role);

              return (
                <div
                  key={comment._id}
                  style={{
                    padding: '1rem 1.25rem',
                    borderRadius: 'var(--radius-lg)',
                    border: comment.isInternal
                      ? '1px solid var(--color-amber-200)'
                      : '1px solid var(--border-subtle)',
                    backgroundColor: comment.isInternal
                      ? 'var(--color-amber-50)'
                      : isStaff
                      ? 'var(--color-slate-50)'
                      : '#ffffff',
                    transition: 'box-shadow var(--transition-fast)',
                  }}
                >
                  {/* Header: Author + Role + Date + Internal Tag */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '0.5rem',
                      flexWrap: 'wrap',
                      gap: '0.5rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                        {authorName}
                      </span>
                      {author?.role && <Badge variant="role">{author.role}</Badge>}
                      {comment.isInternal && (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            backgroundColor: 'var(--color-amber-100)',
                            color: 'var(--color-amber-800)',
                            fontSize: '0.725rem',
                            fontWeight: 600,
                            padding: '0.2rem 0.5rem',
                            borderRadius: 'var(--radius-sm)',
                          }}
                        >
                          <Lock size={12} />
                          INTERNAL NOTE (STAFF ONLY)
                        </span>
                      )}
                    </div>

                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {comment.createdAt ? new Date(comment.createdAt).toLocaleString() : ''}
                    </span>
                  </div>

                  {/* Body Content */}
                  <div
                    style={{
                      fontSize: '0.875rem',
                      color: 'var(--text-primary)',
                      lineHeight: 1.5,
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {comment.content}
                  </div>

                  {/* Attachments List */}
                  {comment.attachments && comment.attachments.length > 0 && (
                    <div
                      style={{
                        marginTop: '0.75rem',
                        paddingTop: '0.5rem',
                        borderTop: '1px dashed var(--border-subtle)',
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '0.5rem',
                      }}
                    >
                      {comment.attachments.map((att, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleDownload(att.filename, att.originalName)}
                          disabled={downloadingFile === att.filename}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            padding: '0.35rem 0.65rem',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--border-default)',
                            backgroundColor: '#ffffff',
                            color: 'var(--color-primary-700)',
                            fontSize: '0.775rem',
                            cursor: 'pointer',
                          }}
                        >
                          {downloadingFile === att.filename ? (
                            <LoadingSpinner size="sm" />
                          ) : (
                            <Paperclip size={13} />
                          )}
                          <span>{att.originalName}</span>
                          <span style={{ color: 'var(--text-muted)' }}>
                            ({formatFileSize(att.size)})
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Add Comment Form */}
        <form
          onSubmit={handleSubmit}
          style={{
            borderTop: '1px solid var(--border-subtle)',
            paddingTop: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.875rem',
          }}
        >
          <div className="form-group" style={{ margin: 0 }}>
            <label htmlFor="new-comment" className="form-label">
              Add a Message or Reply:
            </label>
            <textarea
              id="new-comment"
              rows={3}
              className="form-input"
              placeholder={
                isInternal
                  ? 'Type internal note for technicians only (hidden from requester)...'
                  : 'Type public reply to ticket requester...'
              }
              value={content}
              onChange={(e) => setContent(e.target.value)}
              style={{
                borderColor: isInternal ? 'var(--color-amber-400)' : undefined,
                backgroundColor: isInternal ? 'var(--color-amber-50)' : undefined,
              }}
            />
          </div>

          {/* Attachments preview */}
          {selectedFiles.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {selectedFiles.map((file, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: '0.25rem 0.5rem',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--color-slate-100)',
                    fontSize: '0.775rem',
                  }}
                >
                  <FileText size={14} style={{ color: 'var(--color-slate-500)' }} />
                  <span>{file.name}</span>
                  <button
                    type="button"
                    onClick={() => removeFile(i)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 0,
                      display: 'flex',
                    }}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Action Row: Attachment Picker, Internal Toggle, Submit */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '0.75rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              {/* File Attachment Trigger */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                style={{ display: 'none' }}
                onChange={handleFileChange}
                accept=".jpg,.jpeg,.png,.gif,.pdf,.txt,.doc,.docx,.xls,.xlsx,.zip"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current && fileInputRef.current.click()}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  background: 'transparent',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '0.4rem 0.75rem',
                  fontSize: '0.8125rem',
                  color: 'var(--color-slate-700)',
                  cursor: 'pointer',
                }}
              >
                <Paperclip size={15} />
                <span>Attach Files ({selectedFiles.length}/5)</span>
              </button>

              {/* Internal Note Toggle for Technical Staff Only */}
              {canCreateInternalNotes && (
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    fontSize: '0.8125rem',
                    color: isInternal ? 'var(--color-amber-800)' : 'var(--text-secondary)',
                    fontWeight: isInternal ? 600 : 500,
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isInternal}
                    onChange={(e) => setIsInternal(e.target.checked)}
                  />
                  <Lock size={14} style={{ color: isInternal ? 'var(--color-amber-600)' : 'inherit' }} />
                  <span>Internal Note (Staff Only)</span>
                </label>
              )}
            </div>

            <Button
              type="submit"
              variant={isInternal ? 'primary' : 'primary'}
              isLoading={isSubmitting}
              icon={<Send size={15} />}
            >
              {isInternal ? 'Post Internal Note' : 'Post Reply'}
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
};

export default TicketCommentsSection;
