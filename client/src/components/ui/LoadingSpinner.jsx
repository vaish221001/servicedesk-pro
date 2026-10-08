export const LoadingSpinner = ({ size = 'md', color = 'primary', className = '' }) => {
  const sizeMap = {
    sm: '0.875rem',
    md: '1.25rem',
    lg: '2rem',
    xl: '3rem',
  };

  const currentSize = sizeMap[size] || sizeMap.md;

  return (
    <div
      role="status"
      aria-label="Loading"
      className={`spinner ${color === 'primary' ? 'spinner-primary' : ''} ${className}`}
      style={{
        width: currentSize,
        height: currentSize,
        borderWidth: size === 'lg' || size === 'xl' ? '3px' : '2px',
      }}
    />
  );
};

export default LoadingSpinner;
