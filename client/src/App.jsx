import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import AppLayout from './components/layout/AppLayout';

import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import TicketListPage from './pages/TicketListPage';
import TicketDetailPage from './pages/TicketDetailPage';
import AssetListPage from './pages/AssetListPage';
import AssetDetailPage from './pages/AssetDetailPage';
import KnowledgeBasePage from './pages/KnowledgeBasePage';
import KnowledgeArticleDetailPage from './pages/KnowledgeArticleDetailPage';
import ReportsPage from './pages/ReportsPage';
import UserManagementPage from './pages/UserManagementPage';
import NotFoundPage from './pages/NotFoundPage';

import './App.css';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public Login Route */}
          <Route path="/login" element={<LoginPage />} />

          {/* Root Redirect to Dashboard */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          {/* Protected Application Layout Shell */}
          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            {/* Dashboard Shell */}
            <Route path="/dashboard" element={<DashboardPage />} />

            {/* Ticket Management (Step 22) */}
            <Route path="/tickets" element={<TicketListPage />} />
            <Route path="/tickets/:id" element={<TicketDetailPage />} />

            {/* Asset Management (Step 23) */}
            <Route path="/assets" element={<AssetListPage />} />
            <Route path="/assets/:id" element={<AssetDetailPage />} />
            <Route path="/vendors" element={<Navigate to="/assets" replace />} />

            {/* Knowledge Base (Step 23) */}
            <Route path="/knowledge-base" element={<KnowledgeBasePage />} />
            <Route path="/knowledge-base/:id" element={<KnowledgeArticleDetailPage />} />
            <Route path="/knowledge" element={<Navigate to="/knowledge-base" replace />} />

            {/* Role-Restricted Modules */}
            <Route
              path="/reports"
              element={
                <ProtectedRoute allowedRoles={['SYSTEM_ADMIN', 'IT_MANAGER', 'ASSET_MANAGER']}>
                  <ReportsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedRoles={['SYSTEM_ADMIN']}>
                  <UserManagementPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/users"
              element={<Navigate to="/admin" replace />}
            />
          </Route>

          {/* 404 Catch-All */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
