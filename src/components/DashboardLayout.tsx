import React, { useState } from 'react';
import {
  Activity,
  BarChart3,
  Bell,
  BookOpen,
  Database,
  Dna,
  FileText,
  FolderKanban,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Settings,
  Sun,
  Upload,
  User,
  X,
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import type { DashboardView } from '../types';
import { BioScanLogo } from './BioScanLogo';

interface LayoutProps {
  activeView: DashboardView;
  onSelectView: (view: DashboardView) => void;
  children: React.ReactNode;
}

const NAV_ITEMS: { id: DashboardView; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'upload', label: 'Upload eDNA Dataset', icon: Upload },
  { id: 'datasets', label: 'My Datasets', icon: Database },
  { id: 'taxonomy', label: 'Taxonomy Identification', icon: Dna },
  { id: 'biodiversity', label: 'Biodiversity Assessment', icon: BarChart3 },
  { id: 'history', label: 'Analysis History', icon: Activity },
  { id: 'species', label: 'Species Explorer', icon: BookOpen },
  { id: 'projects', label: 'Research Projects', icon: FolderKanban },
  { id: 'reports', label: 'Reports', icon: FileText },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'profile', label: 'My Profile', icon: User },
  { id: 'settings', label: 'Settings', icon: Settings },
  { id: 'help', label: 'Help and Documentation', icon: HelpCircle },
];

export const DashboardLayout: React.FC<LayoutProps> = ({ activeView, onSelectView, children }) => {
  const { profile, unreadCount, theme, toggleTheme, systemStatus, appSettings, logout } = useApp();
  const [mobileOpen, setMobileOpen] = useState(false);

  const currentLabel =
    activeView === 'dataset-detail'
      ? 'Dataset Details'
      : NAV_ITEMS.find((i) => i.id === activeView)?.label || 'Overview';

  const handleNav = (id: DashboardView) => {
    onSelectView(id);
    setMobileOpen(false);
  };

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Mobile Sidebar Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Dark Forest-Green Sidebar */}
      <aside
        className={`fixed lg:sticky top-0 left-0 z-50 h-screen w-64 shrink-0 bg-[#0B291E] text-emerald-50 flex flex-col border-r border-emerald-950 transition-transform duration-200 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="h-16 px-4 flex items-center justify-between border-b border-emerald-900/70">
          <BioScanLogo size={30} variant="dark-bg" showTagline />
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="lg:hidden p-1.5 rounded-lg text-emerald-200 hover:bg-emerald-900"
            aria-label="Close sidebar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-2.5 space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active =
              activeView === item.id || (activeView === 'dataset-detail' && item.id === 'datasets');
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNav(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-emerald-700/80 text-white'
                    : 'text-emerald-100/80 hover:bg-emerald-900/60 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-2.5 truncate">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </span>
                {item.id === 'notifications' && unreadCount > 0 && (
                  <span className="ml-2 px-1.5 py-0.5 text-[10px] font-mono font-semibold bg-emerald-400 text-emerald-950 rounded">
                    {unreadCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-2.5 border-t border-emerald-900/70">
          <button
            type="button"
            onClick={logout}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium text-emerald-100/85 hover:bg-rose-950/60 hover:text-rose-200 transition-colors whitespace-nowrap"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content Shell */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 h-16 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300"
              aria-label="Open navigation menu"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2 text-sm truncate">
              <span className="text-slate-400 hidden sm:inline">Workspace</span>
              <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">/</span>
              <h1 className="font-semibold text-slate-900 dark:text-white truncate">{currentLabel}</h1>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle light or dark mode"
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={() => handleNav('notifications')}
              aria-label="Open notifications"
              className="relative p-2 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 text-[10px] font-mono font-bold bg-emerald-600 text-white rounded flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => handleNav('profile')}
              className="flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              {profile?.photoUrl ? (
                <img
                  src={profile.photoUrl}
                  alt={profile.fullName}
                  referrerPolicy="no-referrer"
                  className="w-6 h-6 rounded object-cover"
                />
              ) : (
                <div className="w-6 h-6 rounded bg-emerald-800 text-white text-xs font-semibold flex items-center justify-center">
                  {(profile?.fullName || 'R').slice(0, 1).toUpperCase()}
                </div>
              )}
              <span className="hidden sm:inline text-xs font-medium text-slate-700 dark:text-slate-200 max-w-[140px] truncate">
                {profile?.fullName || 'Researcher'}
              </span>
            </button>
          </div>
        </header>

        {appSettings?.maintenanceMode && (
          <div className="bg-amber-50 dark:bg-amber-950/50 border-b border-amber-200 dark:border-amber-800 px-6 py-2.5 text-xs text-amber-900 dark:text-amber-200">
            Maintenance notice: Scheduled bioinformatics server maintenance is active. Uploads may experience brief queuing delays.
          </div>
        )}

        {systemStatus && !systemStatus.supabaseConfigured && (
          <div className="bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-2 text-xs text-slate-700 dark:text-slate-300 flex flex-wrap items-center justify-between gap-2">
            <span>
              Scientific Storage Mode: <strong>{systemStatus.storageMode}</strong>. Connect Supabase PostgreSQL in environment secrets for cloud relational persistence.
            </span>
            <button
              type="button"
              onClick={() => handleNav('help')}
              className="font-semibold text-emerald-800 dark:text-emerald-400 hover:underline whitespace-nowrap"
            >
              View Supabase Setup Guide
            </button>
          </div>
        )}

        <main className="flex-1 p-4 sm:p-6 max-w-[1400px] w-full mx-auto">{children}</main>
      </div>
    </div>
  );
};
