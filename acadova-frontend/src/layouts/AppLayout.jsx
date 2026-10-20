import React from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import StudentNavigation from '../components/common/StudentNavigation';
import '../components/learning/studentV2.css';
import '../components/learning/studentExperience.css';
import { isUnifiedStudentPath } from '../utils/studentExperience';
import Footer from '../components/common/Footer';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { getRoleHomeRoute } from '../config/roleNavigation';
import { needsProfileSetup } from '../utils/profileSetup';
import { safeStudentReturnPath } from '../utils/studyNavigation';
import StudyTogetherNavigation from '../components/student/StudyTogetherNavigation';

export const AppLayout = ({ allowedRoles = null, requireProfileSetup = true }) => {
  const { user, isAuthenticated, loading } = useAuth();
  const { pathname, search, hash } = useLocation();
  const returnTo = safeStudentReturnPath(pathname + search + hash);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <LoadingSpinner text="Checking authentication session..." size={36} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to={returnTo ? `/login?returnTo=${encodeURIComponent(returnTo)}` : '/login'} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    return <Navigate to={getRoleHomeRoute(user?.role)} replace />;
  }
  if (requireProfileSetup && needsProfileSetup(user) && pathname.replace(/\/$/, '') !== '/onboarding') {
    return <Navigate to={returnTo ? `/onboarding?returnTo=${encodeURIComponent(returnTo)}` : '/onboarding'} replace />;
  }

  return (
    <div className={`app-shell app-shell-${user?.role || 'student'}${isUnifiedStudentPath(pathname) ? ' student-v2' : ''}`}>
      <StudentNavigation />
      <main className="app-main" id="main-content" tabIndex={-1}>
        <div className="container">
          {(pathname === '/profile' && hash === '#profile-skills-teach' || ['/tutors','/study-together','/sessions','/dashboard/peer'].some(path => pathname === path || pathname.startsWith(path + '/'))) && <StudyTogetherNavigation/>}
          <Outlet />
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default AppLayout;
