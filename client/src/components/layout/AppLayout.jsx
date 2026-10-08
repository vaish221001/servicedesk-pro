import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

const TITLE_MAP = {
  '/dashboard': 'Operations Dashboard',
  '/tickets': 'Ticket Management',
  '/assets': 'Asset & Hardware Inventory',
  '/knowledge-base': 'Knowledge Base & FAQs',
  '/reports': 'SLA Analytics & Performance',
  '/admin': 'System Administration',
};

export const AppLayout = () => {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const location = useLocation();

  const currentTitle = TITLE_MAP[location.pathname] || 'ServiceDesk Pro';

  return (
    <div className="app-container">
      <Sidebar
        isMobileOpen={isMobileOpen}
        onCloseMobile={() => setIsMobileOpen(false)}
      />

      <div className="main-content">
        <Header
          onOpenMobile={() => setIsMobileOpen(true)}
          pageTitle={currentTitle}
        />

        <main className="page-body">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
