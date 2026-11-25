import React, { useState } from 'react';
import { DashboardLayout } from './components/DashboardLayout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AppProvider, useApp } from './contexts/AppContext';
import { AnalysisHistoryPage } from './pages/AnalysisHistoryPage';
import { AuthPages } from './pages/AuthPages';
import { BiodiversityPage } from './pages/BiodiversityPage';
import { ControlCenterPage } from './pages/ControlCenterPage';
import { DatasetDetailsPage } from './pages/DatasetDetailsPage';
import { DatasetsPage } from './pages/DatasetsPage';
import { HelpDocsPage } from './pages/HelpDocsPage';
import { LandingPage } from './pages/LandingPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { OverviewPage } from './pages/OverviewPage';
import { ProfilePage } from './pages/ProfilePage';
import { ProjectsPage } from './pages/ProjectsPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';
import { SpeciesExplorerPage } from './pages/SpeciesExplorerPage';
import { TaxonomyPage } from './pages/TaxonomyPage';
import { UploadDatasetPage } from './pages/UploadDatasetPage';
import type { DashboardView, PublicView } from './types';

function AppRouter() {
  const { firebaseUser, authReady, profile } = useApp();
  const [isControlCenter, setIsControlCenter] = useState(
    () => window.location.pathname === '/control-center',
  );
  const [publicView, setPublicView] = useState<PublicView>('landing');
  const [dashboardView, setDashboardView] = useState<DashboardView>('overview');
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>('');

  if (isControlCenter) {
    return (
      <ControlCenterPage
        onExit={() => {
          window.history.pushState({}, '', '/');
          setIsControlCenter(false);
        }}
      />
    );
  }

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-slate-950 text-sm text-slate-500">
        Initializing eDNA BioScan workspace...
      </div>
    );
  }

  // Unauthenticated public views
  if (!firebaseUser) {
    if (publicView === 'landing') {
      return <LandingPage onNavigate={(v) => setPublicView(v)} />;
    }
    return (
      <AuthPages
        view={publicView === 'control-center' ? 'login' : publicView}
        onNavigate={(v) => setPublicView(v)}
      />
    );
  }

  // Account suspended / deactivated check
  if (profile && profile.status !== 'active') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6">
        <div className="max-w-md w-full p-6 rounded-xl bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-800 space-y-3 text-center">
          <h2 className="text-lg font-bold text-rose-700 dark:text-rose-400">
            Account {profile.status}
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Your researcher account is currently {profile.status}. Please contact your institutional administrator.
          </p>
        </div>
      </div>
    );
  }

  // Email verification gate for unverified email/password signups
  const usesPassword = firebaseUser.providerData.some((p) => p.providerId === 'password');
  if (usesPassword && !firebaseUser.emailVerified) {
    return <AuthPages view="verify-email" onNavigate={(v) => setPublicView(v)} />;
  }

  const openDataset = (id: string) => {
    setSelectedDatasetId(id);
    setDashboardView('dataset-detail');
  };

  return (
    <DashboardLayout activeView={dashboardView} onSelectView={setDashboardView}>
      {dashboardView === 'overview' && (
        <OverviewPage onNavigate={setDashboardView} onOpenDataset={openDataset} />
      )}
      {dashboardView === 'upload' && (
        <UploadDatasetPage onUploadComplete={openDataset} />
      )}
      {dashboardView === 'datasets' && (
        <DatasetsPage onOpenDataset={openDataset} onNavigate={setDashboardView} />
      )}
      {dashboardView === 'dataset-detail' && (
        <DatasetDetailsPage
          datasetId={selectedDatasetId}
          onBack={() => setDashboardView('datasets')}
        />
      )}
      {dashboardView === 'taxonomy' && <TaxonomyPage />}
      {dashboardView === 'biodiversity' && <BiodiversityPage />}
      {dashboardView === 'history' && <AnalysisHistoryPage onOpenDataset={openDataset} />}
      {dashboardView === 'species' && <SpeciesExplorerPage />}
      {dashboardView === 'projects' && <ProjectsPage />}
      {dashboardView === 'reports' && <ReportsPage />}
      {dashboardView === 'notifications' && <NotificationsPage onNavigate={setDashboardView} />}
      {dashboardView === 'profile' && <ProfilePage />}
      {dashboardView === 'settings' && <SettingsPage />}
      {dashboardView === 'help' && <HelpDocsPage />}
    </DashboardLayout>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <AppRouter />
      </AppProvider>
    </ErrorBoundary>
  );
}
