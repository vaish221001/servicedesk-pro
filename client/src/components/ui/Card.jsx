export const Card = ({ children, className = '', hover = false, style = {}, ...props }) => {
  return (
    <div
      className={`card ${hover ? 'card-hover' : ''} ${className}`}
      style={{
        ...(hover
          ? {
              cursor: 'pointer',
              transition: 'transform var(--transition-base), box-shadow var(--transition-base)',
            }
          : {}),
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardHeader = ({ children, className = '', action = null }) => {
  return (
    <div className={`card-header ${className}`}>
      <div style={{ minWidth: 0, flex: 1 }}>{children}</div>
      {action && <div>{action}</div>}
    </div>
  );
};

export const CardTitle = ({ children, className = '', style = {} }) => {
  return (
    <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)', ...style }} className={className}>
      {children}
    </h3>
  );
};

export const CardDescription = ({ children, className = '', style = {} }) => {
  return (
    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.2rem', ...style }} className={className}>
      {children}
    </p>
  );
};

export const CardBody = ({ children, className = '', style = {} }) => {
  return (
    <div className={`card-body ${className}`} style={style}>
      {children}
    </div>
  );
};

export const CardFooter = ({ children, className = '', style = {} }) => {
  return (
    <div className={`card-footer ${className}`} style={style}>
      {children}
    </div>
  );
};

export default Card;
