import React from 'react';
import { useAuth } from '../../Auth/hooks/useAuth';
import PublicLayout from './PublicLayout';
import Layout from '../../Layout';
import PageLoading from '../../Shared/components/PageLoading';

const AdaptiveRoute = ({ Component }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <main>
        <PageLoading title="Loading KIVI-AI..." subtitle="Preparing page content..." />
      </main>
    );
  }

  if (user) {
    return (
      <Layout>
        <Component />
      </Layout>
    );
  }

  return (
    <PublicLayout>
      <Component />
    </PublicLayout>
  );
};

export default AdaptiveRoute;
