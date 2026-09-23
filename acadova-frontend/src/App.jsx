import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import PublicLayout from './layouts/PublicLayout';
import AppLayout from './layouts/AppLayout';

// Public Pages
import LandingPage from './pages/LandingPage';
import AboutPage from './pages/AboutPage';
import FeaturesPage from './pages/FeaturesPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';

// Authenticated Pages
import DashboardPage from './pages/DashboardPage';
import FindTutorsPage from './pages/FindTutorsPage';
import TutorProfilePage from './pages/TutorProfilePage';
import SessionsPage from './pages/SessionsPage';
import CreditsPage from './pages/CreditsPage';
import ProfilePage from './pages/ProfilePage';

// Admin Page
import AdminDashboardPage from './pages/AdminDashboardPage';

export const App = () => {
  return (
    <Routes>
      {/* Public Marketing & Auth Routes */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/features" element={<FeaturesPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>

      {/* Authenticated Student / Learner / Tutor Routes */}
      <Route element={<AppLayout />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/tutors" element={<FindTutorsPage />} />
        <Route path="/tutors/:id" element={<TutorProfilePage />} />
        <Route path="/sessions" element={<SessionsPage />} />
        <Route path="/credits" element={<CreditsPage />} />
        <Route path="/profile" element={<ProfilePage />} />
      </Route>

      {/* Protected Admin Routes */}
      <Route element={<AppLayout adminOnly />}>
        <Route path="/admin" element={<AdminDashboardPage />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default App;
