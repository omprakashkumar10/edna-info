import React, { useState } from 'react';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { CheckCircle2 } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';

export const SettingsPage: React.FC = () => {
  const { firebaseUser, preferences, setThemeMode, systemStatus } = useApp();
  const [themePref, setThemePref] = useState<'light' | 'dark' | 'system'>(preferences?.theme || 'light');
  const [emailNotifications, setEmailNotifications] = useState(preferences?.emailNotifications ?? true);
  const [analysisAlerts, setAnalysisAlerts] = useState(preferences?.analysisAlerts ?? true);
  const [defaultDb, setDefaultDb] = useState(preferences?.defaultReferenceDb || 'NCBI BLAST');
  const [threshold, setThreshold] = useState(preferences?.defaultConfidenceThreshold ?? 80);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) return;
    setSaving(true);
    setSavedMsg('');
    try {
      await setThemeMode(themePref);
      await setDoc(doc(db, 'user_preferences', firebaseUser.uid), {
        userId: firebaseUser.uid,
        theme: themePref,
        emailNotifications,
        analysisAlerts,
        defaultReferenceDb: defaultDb,
        defaultConfidenceThreshold: Number(threshold),
        updatedAt: serverTimestamp(),
      });
      setSavedMsg('Preferences saved to Firestore.');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `user_preferences/${firebaseUser.uid}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Settings</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Configure appearance, notification preferences, default bioinformatics pipeline parameters, and backend status.
        </p>
      </div>

      {savedMsg && (
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          {savedMsg}
        </div>
      )}

      <form
        onSubmit={handleSave}
        className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-5"
      >
        <div>
          <label className="block text-xs font-medium mb-2">Interface Theme</label>
          <div className="inline-flex p-1 rounded-lg bg-slate-100 dark:bg-slate-800 gap-1">
            {(['light', 'dark', 'system'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => {
                  setThemePref(mode);
                  setThemeMode(mode);
                }}
                className={`px-3.5 py-1.5 text-xs font-medium rounded-md capitalize ${
                  themePref === mode
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium mb-1">Default Reference Database</label>
            <select
              value={defaultDb}
              onChange={(e) => setDefaultDb(e.target.value as typeof defaultDb)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
            >
              {['NCBI BLAST', 'NCBI Taxonomy', 'SILVA', 'BOLD Systems', 'UNITE'].map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">
              Minimum Confidence Threshold ({threshold}%)
            </label>
            <input
              type="range"
              min={50}
              max={99}
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="w-full accent-emerald-700 mt-2"
            />
          </div>
        </div>

        <div className="space-y-2 text-xs">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={emailNotifications}
              onChange={(e) => setEmailNotifications(e.target.checked)}
              className="rounded border-slate-300 text-emerald-700"
            />
            Receive email updates for completed eDNA batch analyses
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={analysisAlerts}
              onChange={(e) => setAnalysisAlerts(e.target.checked)}
              className="rounded border-slate-300 text-emerald-700"
            />
            Display in-app alerts on pipeline completion or failure
          </label>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2 text-xs font-semibold text-white bg-emerald-800 hover:bg-emerald-900 rounded-lg"
          >
            {saving ? 'Saving...' : 'Save Preferences'}
          </button>
        </div>
      </form>

      {/* External Service & Database Configuration Status */}
      <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
        <h3 className="text-sm font-semibold">Platform Service Connections</h3>
        <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
          <div className="py-2.5 flex items-center justify-between">
            <span className="font-medium">Firebase Authentication & Firestore</span>
            <span className="font-mono text-emerald-700 dark:text-emerald-400">Connected</span>
          </div>
          <div className="py-2.5 flex items-center justify-between">
            <span className="font-medium">Scientific Relational Database</span>
            <span className="font-mono text-slate-700 dark:text-slate-300">
              {systemStatus?.supabaseConfigured ? 'Supabase PostgreSQL Connected' : 'Local SQLite Workspace (Set SUPABASE_URL & SUPABASE_SERVICE_ROLE_KEY)'}
            </span>
          </div>
          <div className="py-2.5 flex items-center justify-between">
            <span className="font-medium">Gemini Ecological Interpretation API</span>
            <span className={`font-mono ${systemStatus?.geminiConfigured ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-600'}`}>
              {systemStatus?.geminiConfigured ? 'Configured Server-Side' : 'Set GEMINI_API_KEY in Secrets'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
