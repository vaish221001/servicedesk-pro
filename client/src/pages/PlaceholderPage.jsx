import { Link, useLocation } from 'react-router-dom';
import Card, { CardBody } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import {
  Ticket,
  HardDrive,
  BookOpen,
  BarChart3,
  Settings,
  Construction,
  ArrowLeft,
  CheckCircle,
} from 'lucide-react';

const MODULE_CONFIG = {
  '/tickets': {
    title: 'Ticket Management Module',
    icon: Ticket,
    phase: 'Step 22',
    description:
      'Complete ticket lifecycle UI with ticket creation, filtering, conversation threads, attachments, and work-log tracking.',
    backendReady: [
      'POST /api/tickets (Create Ticket & SLA Assignment)',
      'GET /api/tickets (Filtered, Paginated, Scoped)',
      'PATCH /api/tickets/:id (Lifecycle & Status Transitions)',
      'POST /api/tickets/:id/comments (Public replies & Internal Notes)',
    ],
  },
  '/assets': {
    title: 'Asset & Vendor Inventory Module',
    icon: HardDrive,
    phase: 'Step 23',
    description:
      'Hardware and software asset tracking, vendor management, checkouts, returns, and assignment history.',
    backendReady: [
      'GET /api/assets & POST /api/assets (CRUD & Search)',
      'POST /api/assets/:id/assign & return (Lifecycle Tracking)',
      'GET /api/vendors (Vendor Directory)',
      'GET /api/assets/:id/assignments (Custody History)',
    ],
  },
  '/knowledge-base': {
    title: 'Knowledge Base & Self-Service',
    icon: BookOpen,
    phase: 'Step 24',
    description:
      'Searchable knowledge repository, article publishing workflow, category browsing, and helpfulness voting.',
    backendReady: [
      'GET /api/knowledge-base (Search & Public/Internal Filter)',
      'POST /api/knowledge-base (Authoring & Unique Slug Generation)',
      'POST /api/knowledge-base/:id/feedback (Voting)',
    ],
  },
  '/reports': {
    title: 'SLA Analytics & Performance Reporting',
    icon: BarChart3,
    phase: 'Reporting Phase',
    description:
      'Operational dashboards, SLA compliance breach rates, team resolution velocity, and export capabilities.',
    backendReady: [
      'SLA calculation engine active on backend',
      'Ticket lifecycle metrics available for aggregation',
    ],
  },
  '/admin': {
    title: 'System Administration & Settings',
    icon: Settings,
    phase: 'Admin Phase',
    description:
      'Organization multi-tenant settings, department configurations, category hierarchies, and user management.',
    backendReady: [
      'Department and Category management APIs',
      'Role-based access control engine active',
    ],
  },
};

export const PlaceholderPage = () => {
  const location = useLocation();
  const config = MODULE_CONFIG[location.pathname] || {
    title: 'Module Under Construction',
    icon: Construction,
    phase: 'Upcoming Phase',
    description: 'This feature is scheduled for an upcoming implementation step.',
    backendReady: [],
  };

  const IconComponent = config.icon;

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '1rem 0' }}>
      <Card>
        <CardBody style={{ padding: '2.5rem 2rem', textAlign: 'center' }}>
          <div
            style={{
              width: '4rem',
              height: '4rem',
              borderRadius: '50%',
              backgroundColor: 'var(--color-primary-50)',
              color: 'var(--color-primary-600)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.25rem',
            }}
          >
            <IconComponent size={32} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <Badge color="indigo">Frontend Shell</Badge>
            <Badge color="amber">Scheduled for {config.phase}</Badge>
          </div>

          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
            {config.title}
          </h2>

          <p style={{ fontSize: '0.925rem', color: 'var(--text-secondary)', maxWidth: '520px', margin: '0 auto 2rem' }}>
            {config.description}
          </p>

          {/* Backend APIs verified box */}
          {config.backendReady.length > 0 && (
            <div
              style={{
                backgroundColor: 'var(--color-slate-50)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-lg)',
                padding: '1.25rem',
                textAlign: 'left',
                marginBottom: '2rem',
              }}
            >
              <div
                style={{
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  color: 'var(--color-slate-600)',
                  letterSpacing: '0.04em',
                  marginBottom: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                }}
              >
                <CheckCircle size={15} style={{ color: 'var(--color-emerald-600)' }} />
                <span>Backend Services Verified & Ready for Connection:</span>
              </div>

              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                {config.backendReady.map((apiItem, i) => (
                  <li
                    key={i}
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.8rem',
                      color: 'var(--color-slate-700)',
                      backgroundColor: '#ffffff',
                      padding: '0.35rem 0.65rem',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    {apiItem}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <Link to="/dashboard">
            <Button variant="secondary" icon={<ArrowLeft size={16} />}>
              Back to Operations Dashboard
            </Button>
          </Link>
        </CardBody>
      </Card>
    </div>
  );
};

export default PlaceholderPage;
