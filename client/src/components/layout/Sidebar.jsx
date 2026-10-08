import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/useAuth';
import {
  LayoutDashboard,
  Ticket,
  HardDrive,
  BookOpen,
  BarChart3,
  Settings,
  X,
  Sparkles,
} from 'lucide-react';

export const Sidebar = ({ isMobileOpen, onCloseMobile }) => {
  const { user } = useAuth();
  const role = user?.role || 'EMPLOYEE';

  // Navigation Items with Role-Scoping
  const navItems = [
    {
      to: '/dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      roles: ['SYSTEM_ADMIN', 'IT_MANAGER', 'TECHNICIAN', 'EMPLOYEE', 'ASSET_MANAGER'],
    },
    {
      to: '/tickets',
      label: role === 'EMPLOYEE' ? 'My Tickets' : 'Ticket Management',
      icon: Ticket,
      roles: ['SYSTEM_ADMIN', 'IT_MANAGER', 'TECHNICIAN', 'EMPLOYEE', 'ASSET_MANAGER'],
    },
    {
      to: '/assets',
      label: role === 'EMPLOYEE' ? 'My Equipment' : 'Assets & Vendors',
      icon: HardDrive,
      roles: ['SYSTEM_ADMIN', 'IT_MANAGER', 'TECHNICIAN', 'EMPLOYEE', 'ASSET_MANAGER'],
    },
    {
      to: '/knowledge-base',
      label: 'Knowledge Base',
      icon: BookOpen,
      roles: ['SYSTEM_ADMIN', 'IT_MANAGER', 'TECHNICIAN', 'EMPLOYEE', 'ASSET_MANAGER'],
    },
    {
      to: '/reports',
      label: 'Analytics & SLA',
      icon: BarChart3,
      roles: ['SYSTEM_ADMIN', 'IT_MANAGER', 'ASSET_MANAGER'],
    },
    {
      to: '/admin',
      label: 'User Management',
      icon: Settings,
      roles: ['SYSTEM_ADMIN'],
    },
  ];

  const visibleNav = navItems.filter((item) => item.roles.includes(role));

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isMobileOpen && (
        <div
          onClick={onCloseMobile}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(4px)',
            zIndex: 40,
          }}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Container */}
      <aside
        style={{
          width: '260px',
          backgroundColor: 'var(--bg-sidebar)',
          color: 'var(--text-inverse)',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
          zIndex: 45,
          transition: 'transform var(--transition-base)',
        }}
        className={`sidebar ${isMobileOpen ? 'mobile-open' : ''}`}
      >
        {/* Brand Header */}
        <div
          style={{
            height: '64px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 1.25rem',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: 'var(--radius-md)',
                background: 'linear-gradient(135deg, #6366f1, #4338ca)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '0.95rem',
                color: '#ffffff',
                boxShadow: '0 2px 8px rgba(99, 102, 241, 0.4)',
              }}
            >
              SP
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '1rem', letterSpacing: '-0.01em', lineHeight: 1.2 }}>
                ServiceDesk Pro
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--color-slate-400)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Enterprise ITSM
              </div>
            </div>
          </div>

          {/* Mobile Close Button */}
          <button
            type="button"
            onClick={onCloseMobile}
            className="mobile-close-btn"
            aria-label="Close sidebar"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--color-slate-400)',
              cursor: 'pointer',
              display: 'none', // Controlled by CSS media query
              padding: '4px',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation Section */}
        <div style={{ flex: 1, padding: '1rem 0.75rem', overflowY: 'auto' }}>
          <div
            style={{
              fontSize: '0.7rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--color-slate-400)',
              padding: '0 0.75rem 0.5rem',
            }}
          >
            Navigation
          </div>

          <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            {visibleNav.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={onCloseMobile}
                  style={({ isActive }) => ({
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.625rem 0.75rem',
                    borderRadius: 'var(--radius-md)',
                    color: isActive ? '#ffffff' : '#94a3b8',
                    backgroundColor: isActive ? 'var(--color-primary-600)' : 'transparent',
                    fontWeight: isActive ? 600 : 500,
                    fontSize: '0.875rem',
                    textDecoration: 'none',
                    transition: 'all var(--transition-fast)',
                  })}
                  className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}
                >
                  <Icon size={18} strokeWidth={2} />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* Capstone Badge / Footer Info */}
        <div
          style={{
            padding: '1rem',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            backgroundColor: 'rgba(0, 0, 0, 0.2)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.6rem 0.75rem',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'rgba(99, 102, 241, 0.12)',
              border: '1px solid rgba(99, 102, 241, 0.25)',
              color: '#c7d2fe',
              fontSize: '0.75rem',
            }}
          >
            <Sparkles size={16} style={{ color: '#818cf8', flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 600 }}>ServiceDesk Pro 2.0</div>
              <div style={{ opacity: 0.8, fontSize: '0.7rem' }}>Integrated Backend Active</div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
