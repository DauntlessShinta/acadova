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
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import { TermsPage, PrivacyPage, GuidelinesPage } from './pages/PolicyPages';
import OnboardingPage from './pages/OnboardingPage';

// Authenticated Pages
import DashboardPage from './pages/DashboardPage';
import FindTutorsPage from './pages/FindTutorsPage';
import TutorProfilePage from './pages/TutorProfilePage';
import SessionsPage from './pages/SessionsPage';
import SessionRoomPage from './pages/SessionRoomPage';
import CreditsPage from './pages/CreditsPage';
import AssessmentsPage from './pages/AssessmentsPage';
import LearningPage from './pages/LearningPage';
import ProfilePage from './pages/ProfilePage';

// Admin Page
import AdminOverviewPage from './pages/admin/AdminOverviewPage';
import AdminUsersPage from './pages/admin/AdminUsersPage';
import AdminAuditLogsPage from './pages/admin/AdminAuditLogsPage';
import AdminSecurityPage from './pages/admin/AdminSecurityPage';
import AdminSessionsPage from './pages/admin/AdminSessionsPage';
import AdminAnalyticsPage from './pages/admin/AdminAnalyticsPage';
import AdminCreditsPage from './pages/admin/AdminCreditsPage';
import AdminModerationPage from './pages/admin/AdminModerationPage';
import ModeratorOverviewPage from './pages/moderator/ModeratorOverviewPage';
import ModeratorReviewsPage from './pages/moderator/ModeratorReviewsPage';
import ModeratorDisputesPage from './pages/moderator/ModeratorDisputesPage';
import ModeratorAssessmentsPage from './pages/moderator/ModeratorAssessmentsPage';
import ModeratorLearningPage from './pages/moderator/ModeratorLearningPage';

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
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/community-guidelines" element={<GuidelinesPage />} />
      </Route>

      <Route element={<AuthLayout />}>
        <Route path="/login" element={<GuestOnly><LoginPage /></GuestOnly>} />
        <Route path="/register" element={<GuestOnly><RegisterPage /></GuestOnly>} />
        <Route path="/verify-email/pending" element={<VerificationPendingPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/forgot-password" element={<GuestOnly><ForgotPasswordPage /></GuestOnly>} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
      </Route>

      {/* Student peer-learning routes */}
      <Route element={<AppLayout allowedRoles={['student']} />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/tutors" element={<FindTutorsPage />} />
        <Route path="/tutors/:id" element={<TutorProfilePage />} />
        <Route path="/sessions" element={<SessionsPage />} />
        <Route path="/sessions/:id" element={<SessionRoomPage />} />
        <Route path="/credits" element={<CreditsPage />} />
        <Route path="/assessments" element={<AssessmentsPage />} />
        <Route path="/learning" element={<LearningPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/onboarding" element={<OnboardingPage />} />
      </Route>

      {/* Protected Moderator Routes */}
      <Route path="/moderator" element={<StaffLayout area="moderator" />}>
        <Route index element={<ModeratorOverviewPage />} />
        <Route path="reviews" element={<ModeratorReviewsPage />} />
        <Route path="disputes" element={<ModeratorDisputesPage />} />
        <Route path="assessments" element={<ModeratorAssessmentsPage />} />
        <Route path="learning" element={<ModeratorLearningPage />} />
      </Route>

      {/* Protected Admin Routes */}
      <Route path="/admin" element={<StaffLayout area="admin" />}>
        <Route index element={<AdminOverviewPage />} />
        <Route path="users" element={<AdminUsersPage />} />
        <Route path="audit-logs" element={<AdminAuditLogsPage />} />
        <Route path="security" element={<AdminSecurityPage />} />
        <Route path="sessions" element={<AdminSessionsPage />} />
        <Route path="analytics" element={<AdminAnalyticsPage />} />
        <Route path="credits" element={<AdminCreditsPage />} />
        <Route path="moderation" element={<AdminModerationPage />} />
        <Route path="assessments" element={<ModeratorAssessmentsPage />} />
        <Route path="learning" element={<ModeratorLearningPage />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default App;
