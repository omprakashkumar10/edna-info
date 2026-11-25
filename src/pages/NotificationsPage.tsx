import React from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import type { DashboardView } from '../types';

export const NotificationsPage: React.FC<{ onNavigate: (view: DashboardView) => void }> = ({ onNavigate }) => {
  const { notifications, unreadCount, markNotificationRead, markAllNotificationsRead } = useApp();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Notifications</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Activity updates for dataset uploads, analysis pipelines, report exports, and account security.
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={markAllNotificationsRead}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-800 hover:bg-emerald-900 rounded-lg whitespace-nowrap shrink-0"
          >
            <CheckCheck className="w-4 h-4" />
            Mark All Read ({unreadCount})
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="p-8 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-2">
          <Bell className="w-8 h-8 mx-auto text-slate-400" />
          <p className="text-sm text-slate-500">No notifications yet.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-800">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                n.read ? 'opacity-75' : 'bg-emerald-50/40 dark:bg-emerald-950/20'
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-900 dark:text-white">{n.title}</span>
                  <span className="text-[11px] font-mono text-slate-400">
                    {n.type.replace('_', ' ')}
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300">{n.message}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {n.linkView && (
                  <button
                    type="button"
                    onClick={() => onNavigate(n.linkView as DashboardView)}
                    className="px-3 py-1.5 text-xs font-medium border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    Open
                  </button>
                )}
                {!n.read && (
                  <button
                    type="button"
                    onClick={() => markNotificationRead(n.id)}
                    className="px-3 py-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-400 hover:underline"
                  >
                    Mark Read
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
