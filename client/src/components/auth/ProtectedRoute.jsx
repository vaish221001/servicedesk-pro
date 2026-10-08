import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/useAuth';
import LoadingSpinner from '../ui/LoadingSpinner';
import Card, { CardBody } from '../ui/Card';
import Button from '../ui/Button';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

export const ProtectedRoute = ({ children, allowedRoles = null }) => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          backgroundColor: 'var(--bg-app)',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: 'var(--radius-md)',
              background: 'linear-gradient(135deg, var(--color-primary-600), var(--color-primary-700))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: '1.1rem',
            }}
          >
            SP
          </div>
          <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            ServiceDesk Pro
          </span>
        </div>
        <LoadingSpinner size="lg" color="primary" />
        <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          Authenticating secure session...
        </span>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Save intended destination for post-login redirect
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Role-Based Access Guard
  if (allowedRoles && Array.isArray(allowedRoles) && !allowedRoles.includes(user.role)) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          padding: '1.5rem',
          backgroundColor: 'var(--bg-app)',
        }}
      >
        <Card style={{ maxWidth: '480px', width: '100%', textAlign: 'center' }}>
          <CardBody style={{ padding: '2.5rem 1.5rem' }}>
            <div
              style={{
                width: '4rem',
                height: '4rem',
                borderRadius: '50%',
                backgroundColor: 'var(--color-rose-50)',
                color: 'var(--color-rose-600)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1.25rem',
              }}
            >
              <ShieldAlert size={32} />
            </div>

            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>
              Access Restricted
            </h2>

            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
              Your current role (<strong>{user.role}</strong>) does not have authorization to view this
              module. Backend authorization remains authoritative.
            </p>

            <Button
              variant="secondary"
              onClick={() => window.history.back()}
              icon={<ArrowLeft size={16} />}
            >
              Go Back
            </Button>
          </CardBody>
        </Card>
      </div>
    );
  }

  return children;
};

export default ProtectedRoute;
