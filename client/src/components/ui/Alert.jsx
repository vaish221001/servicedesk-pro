import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';

const ALERT_CONFIG = {
  error: {
    icon: AlertCircle,
    bg: 'var(--color-rose-50)',
    border: 'var(--color-rose-100)',
    text: 'var(--color-rose-700)',
    iconColor: 'var(--color-rose-500)',
  },
  warning: {
    icon: AlertTriangle,
    bg: 'var(--color-amber-50)',
    border: 'var(--color-amber-100)',
    text: 'var(--color-amber-700)',
    iconColor: 'var(--color-amber-500)',
  },
  success: {
    icon: CheckCircle2,
    bg: 'var(--color-emerald-50)',
    border: 'var(--color-emerald-100)',
    text: 'var(--color-emerald-700)',
    iconColor: 'var(--color-emerald-500)',
  },
  info: {
    icon: Info,
    bg: 'var(--color-sky-50)',
    border: 'var(--color-sky-100)',
    text: 'var(--color-sky-700)',
    iconColor: 'var(--color-sky-500)',
  },
};

export const Alert = ({
  variant = 'info',
  title = null,
  children,
  onClose = null,
  className = '',
  style = {},
}) => {
  const config = ALERT_CONFIG[variant] || ALERT_CONFIG.info;
  const IconComponent = config.icon;

  return (
    <div
      role="alert"
      className={`alert alert-${variant} ${className}`}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.75rem',
        padding: '0.875rem 1rem',
        backgroundColor: config.bg,
        border: `1px solid ${config.border}`,
        borderRadius: 'var(--radius-md)',
        color: config.text,
        fontSize: '0.875rem',
        lineHeight: 1.4,
        ...style,
      }}
    >
      <IconComponent
        size={18}
        style={{ color: config.iconColor, flexShrink: 0, marginTop: '2px' }}
        aria-hidden="true"
      />

      <div style={{ flex: 1, minWidth: 0 }}>
        {title && <div style={{ fontWeight: 600, marginBottom: '0.2rem' }}>{title}</div>}
        <div>{children}</div>
      </div>

      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Dismiss alert"
          style={{
            background: 'transparent',
            border: 'none',
            color: config.text,
            cursor: 'pointer',
            padding: '2px',
            display: 'flex',
            alignItems: 'center',
            opacity: 0.7,
            transition: 'opacity var(--transition-fast)',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.7')}
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
};

export default Alert;
