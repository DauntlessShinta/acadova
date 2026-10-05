import React from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from '../components/common/Navbar';
import { useAuth } from '../context/AuthContext';
import AppLayout from './AppLayout';
import Footer from '../components/common/Footer';

export const PublicLayout = () => {
  const { user } = useAuth();
  if (user?.role === 'student') return <AppLayout requireProfileSetup={false} />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Navbar />
      <main style={{ flex: 1 }}>
        <Outlet />
      </main>
      <Footer />
    </div>
  );
};

export default PublicLayout;
