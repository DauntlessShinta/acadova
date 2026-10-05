import React from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import StudentNavigation from '../components/common/StudentNavigation';
import Footer from '../components/common/Footer';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { getRoleHomeRoute } from '../config/roleNavigation';
import { needsProfileSetup } from '../utils/profileSetup';

export const AppLayout = ({ allowedRoles = null, requireProfileSetup = true }) => {
  const { user, isAuthenticated, loading } = useAuth();
  const { pathname } = useLocation();

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <LoadingSpinner text="Checking authentication session..." size={36} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    return <Navigate to={getRoleHomeRoute(user?.role)} replace />;
  }
  if (requireProfileSetup && needsProfileSetup(user) && pathname.replace(/\/$/, '') !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }

  return (
    <div className={`app-shell app-shell-${user?.role || 'student'}`}>
      <StudentNavigation />
      <main className="app-main" id="main-content" tabIndex={-1}>
        <div className="container">
          <Outlet />
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default AppLayout;
