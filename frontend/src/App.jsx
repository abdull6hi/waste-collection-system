import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext.jsx';
import ErrorBoundary    from './components/ErrorBoundary.jsx';
import ProtectedRoute  from './components/ProtectedRoute.jsx';
import Layout          from './components/Layout.jsx';

import LandingPage     from './pages/LandingPage.jsx';
import StatusPage      from './pages/StatusPage.jsx';
import LoginPage       from './pages/LoginPage.jsx';
import RegisterPage    from './pages/RegisterPage.jsx';
import DashboardPage   from './pages/DashboardPage.jsx';
import NotFoundPage    from './pages/NotFoundPage.jsx';

import CollectorsPage  from './pages/official/CollectorsPage.jsx';
import ZonesPage       from './pages/official/ZonesPage.jsx';
import SchedulesPage   from './pages/official/SchedulesPage.jsx';
import TrackingPage    from './pages/official/TrackingPage.jsx';
import ComplaintsPage  from './pages/official/ComplaintsPage.jsx';
import ReportsPage     from './pages/official/ReportsPage.jsx';
import ReportPrintPage from './pages/official/ReportPrintPage.jsx';

import MyPickupsPage   from './pages/collector/MyPickupsPage.jsx';

function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/"         element={<LandingPage />} />
      <Route path="/health"   element={<StatusPage />} />
      <Route path="/login"    element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* All authenticated roles */}
      <Route path="/dashboard" element={
        <ProtectedRoute>
          <Layout><DashboardPage /></Layout>
        </ProtectedRoute>
      } />

      {/* Official only */}
      <Route path="/collectors" element={
        <ProtectedRoute roles={['official']}>
          <Layout><CollectorsPage /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/zones" element={
        <ProtectedRoute roles={['official']}>
          <Layout><ZonesPage /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/schedules" element={
        <ProtectedRoute roles={['official']}>
          <Layout><SchedulesPage /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/tracking" element={
        <ProtectedRoute roles={['official']}>
          <Layout><TrackingPage /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/complaints" element={
        <ProtectedRoute roles={['official']}>
          <Layout><ComplaintsPage /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/reports" element={
        <ProtectedRoute roles={['official']}>
          <Layout><ReportsPage /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/reports/:id/print" element={
        <ProtectedRoute roles={['official']}>
          <ReportPrintPage />
        </ProtectedRoute>
      } />

      {/* Collector only */}
      <Route path="/my-pickups" element={
        <ProtectedRoute roles={['collector']}>
          <Layout><MyPickupsPage /></Layout>
        </ProtectedRoute>
      } />

      {/* 404 catch-all */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                fontFamily: "'Poppins', system-ui, sans-serif",
                fontSize: '0.875rem',
              },
              success: { iconTheme: { primary: '#16a34a', secondary: '#fff' } },
            }}
          />
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}
