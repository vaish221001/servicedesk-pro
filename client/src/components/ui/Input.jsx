import { forwardRef } from 'react';

export const Input = forwardRef(
  (
    {
      label,
      id,
      name,
      type = 'text',
      error = null,
      helperText = null,
      required = false,
      disabled = false,
      placeholder = '',
      value,
      onChange,
      prefixIcon = null,
      suffixIcon = null,
      className = '',
      ...props
    },
    ref
  ) => {
    const inputId = id || name || `input-${Math.random().toString(36).substring(2, 9)}`;
    const errorId = error ? `${inputId}-error` : undefined;
    const helperId = helperText ? `${inputId}-helper` : undefined;

    return (
      <div className={`form-group ${className}`}>
        {label && (
          <label htmlFor={inputId} className="form-label">
            {label}
            {required && <span style={{ color: 'var(--color-rose-600)', marginLeft: '4px' }}>*</span>}
          </label>
        )}

        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          {prefixIcon && (
            <div
              style={{
                position: 'absolute',
                left: '0.75rem',
                display: 'flex',
                alignItems: 'center',
                color: 'var(--color-slate-400)',
                pointerEvents: 'none',
              }}
            >
              {prefixIcon}
            </div>
          )}

          <input
            ref={ref}
            id={inputId}
            name={name}
            type={type}
            value={value}
            onChange={onChange}
            disabled={disabled}
            placeholder={placeholder}
            required={required}
            aria-invalid={!!error}
            aria-describedby={error ? errorId : helperText ? helperId : undefined}
            className={`form-input ${error ? 'error' : ''}`}
            style={{
              paddingLeft: prefixIcon ? '2.5rem' : undefined,
              paddingRight: suffixIcon ? '2.5rem' : undefined,
            }}
            {...props}
          />

          {suffixIcon && (
            <div
              style={{
                position: 'absolute',
                right: '0.75rem',
                display: 'flex',
                alignItems: 'center',
                color: 'var(--color-slate-400)',
              }}
            >
              {suffixIcon}
            </div>
          )}
        </div>

        {error && (
          <span id={errorId} className="form-error-msg" role="alert">
            {error}
          </span>
        )}

        {helperText && !error && (
          <span id={helperId} className="form-helper">
            {helperText}
          </span>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;
