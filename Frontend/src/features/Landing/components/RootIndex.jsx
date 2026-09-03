import React from 'react';
import { useAuth } from '../../Auth/hooks/useAuth';
import LandingPage from '../pages/LandingPage';
import Layout from '../../Layout';
import Home from '../../Interview/pages/Home';
import PageLoading from '../../Shared/components/PageLoading';

const RootIndex = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <main>
        <PageLoading title="Loading KIVI-AI..." subtitle="Preparing your career intelligence environment..." />
      </main>
    );
  }

  if (user) {
    return (
      <Layout>
        <Home />
      </Layout>
    );
  }

  return <LandingPage />;
};

export default RootIndex;
