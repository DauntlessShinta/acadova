import { AiGenerationProvider, AiGenerationTray } from './context/AiGenerationContext';
import GrowthPage from './pages/GrowthPage';
import React, { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import PublicLayout from './layouts/PublicLayout';
import AppLayout from './layouts/AppLayout';
import StaffLayout from './layouts/StaffLayout';
import AuthLayout from './layouts/AuthLayout';
import { NotificationProvider } from './context/NotificationContext';
import { useAuth } from './context/AuthContext';
import { getPageContext, getRoleHomeRoute } from './config/roleNavigation';
import LoadingSpinner from './components/common/LoadingSpinner';
import { studentReturnFromSearch } from './utils/studyNavigation';

// Public Pages
import LandingPage from './pages/LandingPage';
import AboutPage from './pages/AboutPage';
import FeaturesPage from './pages/FeaturesPage';
import LoginPage from './pages/LoginPage';
import StaffMfaPage from './pages/StaffMfaPage';
import RegisterPage from './pages/RegisterPage';
import VerificationPendingPage from './pages/VerificationPendingPage';
import VerifyEmailPage from './pages/VerifyEmailPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import { TermsPage, PrivacyPage, GuidelinesPage } from './pages/PolicyPages';
import OnboardingPage from './pages/OnboardingPage';

// Authenticated Pages
import DashboardPage from './pages/DashboardPage';
import { AcademicHomePage, MySubjectsPage, SubjectWorkspacePage } from './pages/AcademicWorkspace';
import FindTutorsPage from './pages/FindTutorsPage';
import TutorProfilePage from './pages/TutorProfilePage';
import SessionsPage from './pages/SessionsPage';
import SessionRoomPage from './pages/SessionRoomPage';
import CreditsPage from './pages/CreditsPage';
import AssessmentsPage from './pages/AssessmentsPage';
import LearningPage from './pages/LearningPage';
import ProfilePage from './pages/ProfilePage';
import StudyTogetherPage from './pages/StudyTogetherPage';
import SharedStudySetPage from './pages/SharedStudySetPage';
import ModeratorCirclesPage from './pages/moderator/ModeratorCirclesPage';
import StudySetsPage from './pages/StudySetsPage';
import AiStudyPage from './pages/AiStudyPage';
import SettingsPage from './pages/SettingsPage';

// Admin Page
import AdminOverviewPage from './pages/admin/AdminOverviewPage';
import AdminUsersPage from './pages/admin/AdminUsersPage';
import TrustActivityPage, { LegacyTrustRoute } from './pages/admin/TrustActivityPage';
import AdminSessionsPage from './pages/admin/AdminSessionsPage';
import AdminAnalyticsPage from './pages/admin/AdminAnalyticsPage';
import AdminCreditsPage from './pages/admin/AdminCreditsPage';
import AdminModerationPage from './pages/admin/AdminModerationPage';
import ModeratorStudySetsPage from './pages/moderator/ModeratorStudySetsPage';
import ModeratorOverviewPage from './pages/moderator/ModeratorOverviewPage';
import ModeratorAnalyticsPage from './pages/moderator/ModeratorAnalyticsPage';
import ModeratorReviewsPage from './pages/moderator/ModeratorReviewsPage';
import ModeratorDisputesPage from './pages/moderator/ModeratorDisputesPage';
import ModeratorAssessmentsPage from './pages/moderator/ModeratorAssessmentsPage';
import ModeratorLearningPage from './pages/moderator/ModeratorLearningPage';

const GuestOnly = ({ children }) => {
  const { isAuthenticated, loading, user } = useAuth();
  const { search } = useLocation();
  if (loading) return <LoadingSpinner text="Checking account access..." size={34} />;
  return isAuthenticated ? <Navigate to={(user?.role === 'student' && studentReturnFromSearch(search)) || getRoleHomeRoute(user?.role)} replace /> : children;
};

export const App = () => {
  const { pathname, search, hash } = useLocation();
  const { user } = useAuth();
  useEffect(() => {
    const page = getPageContext(pathname, search);
    document.title = `${page.title}${page.area ? ` | ${page.area}` : ''} | Acadova`;
  }, [pathname, search]);
  useEffect(() => {
    // Preserve page-specific hash navigation, such as the tutoring request form.
    if (!hash) window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname, hash]);
  return (
    <NotificationProvider key={user?._id || user?.id || 'guest'}><AiGenerationProvider><Routes>
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
        <Route path="/staff-verify" element={<GuestOnly><StaffMfaPage /></GuestOnly>} />
        <Route path="/register" element={<GuestOnly><RegisterPage /></GuestOnly>} />
        <Route path="/verify-email/pending" element={<VerificationPendingPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/forgot-password" element={<GuestOnly><ForgotPasswordPage /></GuestOnly>} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
      </Route>

      {/* Student peer-learning routes */}
      <Route element={<AppLayout allowedRoles={['student']} />}>
        <Route path="/dashboard" element={<AcademicHomePage />} />
        <Route path="/study-together" element={<StudyTogetherPage />} />
        <Route path="/study-share/:id" element={<SharedStudySetPage />} />
        <Route path="/dashboard/peer" element={<DashboardPage />} />
        <Route path="/subjects" element={<MySubjectsPage />} />
        <Route path="/subjects/:id" element={<SubjectWorkspacePage />} />
        <Route path="/tutors" element={<FindTutorsPage />} />
        <Route path="/tutors/:id" element={<TutorProfilePage />} />
        <Route path="/sessions" element={<SessionsPage />} />
        <Route path="/sessions/:id" element={<SessionRoomPage />} />
        <Route path="/credits" element={<CreditsPage />} />
        <Route path="/growth" element={<GrowthPage />} />
        <Route path="/assessments" element={<AssessmentsPage />} />
        <Route path="/learning" element={<LearningPage />} />
        <Route path="/study-sets" element={<StudySetsPage />} />
        <Route path="/learning/ai-study" element={<AiStudyPage />} />
        <Route path="/learning/ai-study/:id" element={<AiStudyPage />} />
        <Route path="/study-sets/:id" element={<StudySetsPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/onboarding" element={<OnboardingPage />} />
      </Route>

      {/* Protected Moderator Routes */}
      <Route path="/moderator" element={<StaffLayout area="moderator" />}>
        <Route index element={<ModeratorOverviewPage />} />
        <Route path="analytics" element={<ModeratorAnalyticsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="reviews" element={<ModeratorReviewsPage />} />
        <Route path="disputes" element={<ModeratorDisputesPage />} />
        <Route path="assessments" element={<ModeratorAssessmentsPage />} />
        <Route path="learning" element={<ModeratorLearningPage />} />
        <Route path="study-sets" element={<ModeratorStudySetsPage />} />
        <Route path="study-circles" element={<ModeratorCirclesPage />} />
      </Route>

      {/* Protected Admin Routes */}
      <Route path="/admin" element={<StaffLayout area="admin" />}>
        <Route index element={<AdminOverviewPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="users" element={<AdminUsersPage />} />
        <Route path="trust-activity" element={<TrustActivityPage />} />
        <Route path="audit-logs" element={<LegacyTrustRoute />} />
        <Route path="security" element={<LegacyTrustRoute />} />
        <Route path="sessions" element={<AdminSessionsPage />} />
        <Route path="analytics" element={<AdminAnalyticsPage />} />
        <Route path="credits" element={<AdminCreditsPage />} />
        <Route path="moderation" element={<AdminModerationPage />} />
        <Route path="disputes" element={<ModeratorDisputesPage />} />
        <Route path="assessments" element={<ModeratorAssessmentsPage />} />
        <Route path="learning" element={<ModeratorLearningPage />} />
        <Route path="study-sets" element={<ModeratorStudySetsPage />} />
        <Route path="study-circles" element={<ModeratorCirclesPage />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes><AiGenerationTray/></AiGenerationProvider></NotificationProvider>
  );
};

export default App;
