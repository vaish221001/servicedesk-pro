const STATUS_COLOR_MAP = {
  OPEN: 'amber',
  ASSIGNED: 'blue',
  IN_PROGRESS: 'indigo',
  PENDING: 'purple',
  RESOLVED: 'emerald',
  CLOSED: 'slate',
};

const PRIORITY_COLOR_MAP = {
  LOW: 'slate',
  MEDIUM: 'blue',
  HIGH: 'amber',
  CRITICAL: 'rose',
};

const ROLE_COLOR_MAP = {
  SYSTEM_ADMIN: 'purple',
  IT_MANAGER: 'indigo',
  TECHNICIAN: 'blue',
  EMPLOYEE: 'slate',
  ASSET_MANAGER: 'emerald',
};

export const Badge = ({
  children,
  variant = 'default',
  color = null,
  withDot = true,
  className = '',
  style = {},
}) => {
  let resolvedColor = color;

  if (!resolvedColor) {
    if (variant === 'status' && STATUS_COLOR_MAP[children]) {
      resolvedColor = STATUS_COLOR_MAP[children];
    } else if (variant === 'priority' && PRIORITY_COLOR_MAP[children]) {
      resolvedColor = PRIORITY_COLOR_MAP[children];
    } else if (variant === 'role' && ROLE_COLOR_MAP[children]) {
      resolvedColor = ROLE_COLOR_MAP[children];
    } else {
      resolvedColor = 'slate';
    }
  }

  // Format label for display if it's an enum
  const displayLabel = typeof children === 'string' ? children.replace(/_/g, ' ') : children;

  return (
    <span className={`badge badge-${resolvedColor} ${className}`} style={style}>
      {withDot && <span className="badge-dot" aria-hidden="true" />}
      <span>{displayLabel}</span>
    </span>
  );
};

export default Badge;
