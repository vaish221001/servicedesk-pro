import { useAuth } from '../context/useAuth';
import AdminDashboard from '../components/dashboard/AdminDashboard';
import ManagerDashboard from '../components/dashboard/ManagerDashboard';
import TechnicianDashboard from '../components/dashboard/TechnicianDashboard';
import EmployeeDashboard from '../components/dashboard/EmployeeDashboard';
import AssetManagerDashboard from '../components/dashboard/AssetManagerDashboard';

/**
 * ServiceDesk Pro — Role-Based Dashboard Page
 * Automatically delivers a tailored, authorized operational dashboard matching the authenticated user's role:
 *  - SYSTEM_ADMIN: Multi-tenant health, directory users, tickets & asset stats, audit activity stream.
 *  - IT_MANAGER: Departmental queues, team workload distribution, SLA compliance, high-priority queues.
 *  - TECHNICIAN: Personal assigned workbench, status/priority groupings, work logs tracking, KB runbooks.
 *  - EMPLOYEE: Self-service request portal, prominent ticket creation, assigned equipment, help articles.
 *  - ASSET_MANAGER: Fleet inventory lifecycle, warranty expiration alerts, vendor directory, hardware checkouts.
 */
export const DashboardPage = () => {
  const { user } = useAuth();
  const role = user?.role || 'EMPLOYEE';

  switch (role) {
    case 'SYSTEM_ADMIN':
      return <AdminDashboard user={user} />;
    case 'IT_MANAGER':
      return <ManagerDashboard user={user} />;
    case 'TECHNICIAN':
      return <TechnicianDashboard user={user} />;
    case 'ASSET_MANAGER':
      return <AssetManagerDashboard user={user} />;
    case 'EMPLOYEE':
    default:
      return <EmployeeDashboard user={user} />;
  }
};

export default DashboardPage;
