import { isValidElement } from 'react';
import { Inbox } from 'lucide-react';

export const EmptyState = ({
  icon: Icon = Inbox,
  title = 'No records found',
  description = 'There is currently no activity or data to display.',
  action = null,
  className = '',
  style = {},
}) => {
  const renderIcon = () => {
    if (isValidElement(Icon)) {
      return Icon;
    }
    if (typeof Icon === 'function' || typeof Icon === 'object') {
      const Comp = Icon || Inbox;
      return <Comp size={26} strokeWidth={1.5} />;
    }
    return <Inbox size={26} strokeWidth={1.5} />;
  };

  return (
    <div
      className={`empty-state ${className}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '3rem 1.5rem',
        borderRadius: 'var(--radius-lg)',
        border: '1px dashed var(--border-default)',
        backgroundColor: 'var(--color-slate-50)',
        ...style,
      }}
    >
      <div
        style={{
          width: '3.5rem',
          height: '3.5rem',
          borderRadius: '50%',
          backgroundColor: '#ffffff',
          boxShadow: 'var(--shadow-xs)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--color-slate-400)',
          marginBottom: '1rem',
        }}
      >
        {renderIcon()}
      </div>

      <h4 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
        {title}
      </h4>

      <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', maxWidth: '28rem', marginBottom: action ? '1.25rem' : 0 }}>
        {description}
      </p>

      {action && <div>{action}</div>}
    </div>
  );
};

export default EmptyState;
