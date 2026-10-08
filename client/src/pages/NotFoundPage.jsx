import { Link } from 'react-router-dom';
import Card, { CardBody } from '../components/ui/Card';
import Button from '../components/ui/Button';
import { HelpCircle, ArrowLeft } from 'lucide-react';

export const NotFoundPage = () => {
  return (
    <div
      style={{
        minHeight: '80vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
      }}
    >
      <Card style={{ maxWidth: '440px', width: '100%', textAlign: 'center' }}>
        <CardBody style={{ padding: '2.5rem 1.5rem' }}>
          <div
            style={{
              width: '4rem',
              height: '4rem',
              borderRadius: '50%',
              backgroundColor: 'var(--color-slate-100)',
              color: 'var(--color-slate-500)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.25rem',
            }}
          >
            <HelpCircle size={32} />
          </div>

          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.35rem' }}>
            404 — Page Not Found
          </h2>

          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1.75rem' }}>
            The requested view or resource does not exist in ServiceDesk Pro.
          </p>

          <Link to="/dashboard">
            <Button variant="primary" icon={<ArrowLeft size={16} />}>
              Return to Dashboard
            </Button>
          </Link>
        </CardBody>
      </Card>
    </div>
  );
};

export default NotFoundPage;
