import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import PublicLayout from './layouts/PublicLayout';
import AppLayout from './layouts/AppLayout';
import StaffLayout from './layouts/StaffLayout';
import AuthLayout from './layouts/AuthLayout';
import { useAuth } from './context/AuthContext';
import { getRoleHomeRoute } from './config/roleNavigation';
import LoadingSpinner from './components/common/LoadingSpinner';

// Public Pages
import LandingPage from './pages/LandingPage';
import AboutPage from './pages/AboutPage';
import FeaturesPage from './pages/FeaturesPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import VerificationPendingPage from './pages/VerificationPendingPage';
import VerifyEmailPage from './pages/VerifyEmailPage';

// Authenticated Pages
import DashboardPage from './pages/DashboardPage';
import FindTutorsPage from './pages/FindTutorsPage';
import TutorProfilePage from './pages/TutorProfilePage';
import SessionsPage from './pages/SessionsPage';
import SessionRoomPage from './pages/SessionRoomPage';
import CreditsPage from './pages/CreditsPage';
import ProfilePage from './pages/ProfilePage';

// Admin Page
import AdminOverviewPage from './pages/admin/AdminOverviewPage';
import AdminUsersPage from './pages/admin/AdminUsersPage';
import AdminSessionsPage from './pages/admin/AdminSessionsPage';
import AdminAnalyticsPage from './pages/admin/AdminAnalyticsPage';
import AdminModerationPage from './pages/admin/AdminModerationPage';
import ModeratorOverviewPage from './pages/moderator/ModeratorOverviewPage';
import ModeratorReviewsPage from './pages/moderator/ModeratorReviewsPage';

const GuestOnly = ({ children }) => {
  const { isAuthenticated, loading, user } = useAuth();
  if (loading) return <LoadingSpinner text="Checking account access..." size={34} />;
  return isAuthenticated ? <Navigate to={getRoleHomeRoute(user?.role)} replace /> : children;
};

export const App = () => {
  return (
    <Routes>
      {/* Public Marketing & Auth Routes */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/features" element={<FeaturesPage />} />
      </Route>

      <Route element={<AuthLayout />}>
        <Route path="/login" element={<GuestOnly><LoginPage /></GuestOnly>} />
        <Route path="/register" element={<GuestOnly><RegisterPage /></GuestOnly>} />
        <Route path="/verify-email/pending" element={<VerificationPendingPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
      </Route>

      {/* Student peer-learning routes */}
      <Route element={<AppLayout allowedRoles={['student']} />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/tutors" element={<FindTutorsPage />} />
        <Route path="/tutors/:id" element={<TutorProfilePage />} />
        <Route path="/sessions" element={<SessionsPage />} />
        <Route path="/sessions/:id" element={<SessionRoomPage />} />
        <Route path="/credits" element={<CreditsPage />} />
        <Route path="/profile" element={<ProfilePage />} />
      </Route>

      {/* Protected Moderator Routes */}
      <Route path="/moderator" element={<StaffLayout area="moderator" />}>
        <Route index element={<ModeratorOverviewPage />} />
        <Route path="reviews" element={<ModeratorReviewsPage />} />
      </Route>

      {/* Protected Admin Routes */}
      <Route path="/admin" element={<StaffLayout area="admin" />}>
        <Route index element={<AdminOverviewPage />} />
        <Route path="users" element={<AdminUsersPage />} />
        <Route path="sessions" element={<AdminSessionsPage />} />
        <Route path="analytics" element={<AdminAnalyticsPage />} />
        <Route path="moderation" element={<AdminModerationPage />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default App;
