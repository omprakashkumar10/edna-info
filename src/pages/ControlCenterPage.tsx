import React, { useEffect, useMemo, useState } from 'react';
import { signInWithPopup } from 'firebase/auth';
import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { Lock, ShieldCheck } from 'lucide-react';
import { BioScanLogo } from '../components/BioScanLogo';
import { useApp } from '../contexts/AppContext';
import { apiFetch } from '../lib/api';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from '../lib/firebase';
import { BLUEPRINT_LIMITS, clampString } from '../lib/validation';
import type {
  AnalysisJobRecord,
  AuditLogEntry,
  DatasetRecord,
  ResearchProject,
  SystemStatus,
  TaxonomyRefRecord,
  UserProfile,
} from '../types';

type AdminTab = 'dashboard' | 'users' | 'datasets' | 'settings' | 'audit';

export const ControlCenterPage: React.FC<{ onExit: () => void }> = ({ onExit }) => {
  const { firebaseUser, authReady, appSettings, systemStatus } = useApp();

  const [authStatus, setAuthStatus] = useState<{
    checked: boolean;
    isAdmin: boolean;
    adminPasscodeConfigured: boolean;
    adminPasscodeSource: string;
  }>({ checked: false, isAdmin: false, adminPasscodeConfigured: false, adminPasscodeSource: 'unclaimed' });

  const [passcodeVerified, setPasscodeVerified] = useState(false);
  const [passcodeInput, setPasscodeInput] = useState('');
  const [claimPasscode, setClaimPasscode] = useState('');
  const [gateError, setGateError] = useState('');
  const [tab, setTab] = useState<AdminTab>('dashboard');

  // Admin data states
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [userStatusFilter, setUserStatusFilter] = useState('All');

  const [overview, setOverview] = useState<{
    stats: {
      totalDatasets: number;
      totalAnalyses: number;
      completedAnalyses: number;
      failedAnalyses: number;
      totalProjects: number;
      storageBytes: number;
    };
    datasets: DatasetRecord[];
    jobs: AnalysisJobRecord[];
    projects: ResearchProject[];
    references: TaxonomyRefRecord[];
  } | null>(null);

  const [sysForm, setSysForm] = useState({
    applicationName: appSettings?.applicationName || 'eDNA BioScan',
    tagline: appSettings?.tagline || 'Discover. Analyze. Conserve.',
    maintenanceMode: appSettings?.maintenanceMode ?? false,
    maxUploadSizeMb: appSettings?.maxUploadSizeMb ?? 25,
    allowedFormats: (appSettings?.allowedFormats || ['CSV', 'FASTA', 'FASTQ', 'TSV', 'TXT']).join(', '),
    notificationsEnabled: appSettings?.notificationsEnabled ?? true,
  });
  const [sysMsg, setSysMsg] = useState('');

  useEffect(() => {
    if (!authReady || !firebaseUser) {
      setAuthStatus({ checked: true, isAdmin: false, adminPasscodeConfigured: false, adminPasscodeSource: 'unclaimed' });
      return;
    }
    apiFetch<{
      isAdmin: boolean;
      adminPasscodeConfigured: boolean;
      adminPasscodeSource: string;
    }>('/api/auth/me')
      .then((res) => setAuthStatus({ checked: true, ...res }))
      .catch(() =>
        setAuthStatus({ checked: true, isAdmin: false, adminPasscodeConfigured: false, adminPasscodeSource: 'unclaimed' }),
      );
  }, [authReady, firebaseUser]);

  const writeAuditLog = async (action: string, targetType: string, targetId: string, details: string) => {
    if (!firebaseUser) return;
    const id = `audit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    try {
      await setDoc(doc(db, 'audit_logs', id), {
        id,
        actorUid: firebaseUser.uid,
        actorEmail: clampString(firebaseUser.email || '', BLUEPRINT_LIMITS.EMAIL_MAX),
        action: clampString(action, 120),
        targetType: clampString(targetType, 80),
        targetId: clampString(targetId, 128),
        details: clampString(details, BLUEPRINT_LIMITS.AUDIT_DETAILS_MAX),
        createdAt: serverTimestamp(),
      });
    } catch {
      // ignore non-fatal audit write failure
    }
  };

  const loadAdminData = async () => {
    try {
      const [ov, usersSnap, auditSnap] = await Promise.all([
        apiFetch<typeof overview>('/api/admin/overview'),
        getDocs(collection(db, 'users')),
        getDocs(query(collection(db, 'audit_logs'), orderBy('createdAt', 'desc'))),
      ]);
      setOverview(ov);
      setUsers(usersSnap.docs.map((d) => d.data() as UserProfile));
      setAuditLogs(auditSnap.docs.map((d) => d.data() as AuditLogEntry));
    } catch (err) {
      setGateError(err instanceof Error ? err.message : 'Failed to load administrative records.');
    }
  };

  const handleClaimPasscode = async (e: React.FormEvent) => {
    e.preventDefault();
    setGateError('');
    try {
      await apiFetch('/api/admin/claim-passcode', {
        method: 'POST',
        body: JSON.stringify({ passcode: claimPasscode }),
      });
      setPasscodeVerified(true);
      await writeAuditLog('ADMIN_PASSCODE_CLAIMED', 'system', 'control-center', 'Initial admin passcode claimed.');
      await loadAdminData();
    } catch (err) {
      setGateError(err instanceof Error ? err.message : 'Unable to claim passcode');
    }
  };

  const handleVerifyPasscode = async (e: React.FormEvent) => {
    e.preventDefault();
    setGateError('');
    try {
      await apiFetch('/api/admin/verify-passcode', {
        method: 'POST',
        body: JSON.stringify({ passcode: passcodeInput }),
      });
      setPasscodeVerified(true);
      await writeAuditLog('ADMIN_LOGIN', 'auth', firebaseUser?.uid || '', 'Verified Control Center access.');
      await loadAdminData();
    } catch (err) {
      setGateError(err instanceof Error ? err.message : 'Passcode verification failed');
    }
  };

  const handleUpdateUserStatus = async (u: UserProfile, status: 'active' | 'deactivated' | 'suspended') => {
    try {
      await updateDoc(doc(db, 'users', u.uid), {
        status,
        updatedAt: serverTimestamp(),
      });
      setUsers((prev) => prev.map((x) => (x.uid === u.uid ? { ...x, status } : x)));
      await writeAuditLog('USER_STATUS_UPDATED', 'user', u.uid, `Set ${u.email} status to ${status}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${u.uid}`);
    }
  };

  const handleUpdateUserRole = async (u: UserProfile, role: 'user' | 'admin') => {
    try {
      await updateDoc(doc(db, 'users', u.uid), {
        role,
        updatedAt: serverTimestamp(),
      });
      if (role === 'admin') {
        await setDoc(doc(db, 'admins', u.uid), {
          uid: u.uid,
          email: clampString(u.email, BLUEPRINT_LIMITS.EMAIL_MAX),
          grantedBy: firebaseUser?.uid || 'admin',
          createdAt: serverTimestamp(),
        });
      }
      setUsers((prev) => prev.map((x) => (x.uid === u.uid ? { ...x, role } : x)));
      await writeAuditLog('USER_ROLE_UPDATED', 'user', u.uid, `Assigned role ${role} to ${u.email}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${u.uid}`);
    }
  };

  const handleSaveSystemSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) return;
    setSysMsg('');
    const formats = sysForm.allowedFormats
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean)
      .slice(0, 10);
    if (formats.length === 0) formats.push('FASTA');

    try {
      await setDoc(doc(db, 'application_settings', 'global'), {
        applicationName: clampString(sysForm.applicationName, BLUEPRINT_LIMITS.APP_NAME_MAX),
        tagline: clampString(sysForm.tagline, BLUEPRINT_LIMITS.TAGLINE_MAX),
        maintenanceMode: sysForm.maintenanceMode,
        maxUploadSizeMb: Number(sysForm.maxUploadSizeMb),
        allowedFormats: formats,
        notificationsEnabled: sysForm.notificationsEnabled,
        updatedAt: serverTimestamp(),
        updatedBy: firebaseUser.uid,
      });
      await writeAuditLog(
        'SYSTEM_SETTINGS_UPDATED',
        'application_settings',
        'global',
        `Maintenance=${sysForm.maintenanceMode}, MaxUpload=${sysForm.maxUploadSizeMb}MB`,
      );
      setSysMsg('Global application settings updated and logged.');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'application_settings/global');
    }
  };

  const filteredUsers = useMemo(() => {
    const q = userSearch.toLowerCase();
    return users.filter((u) => {
      const matchQ =
        !q ||
        u.fullName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.institution || '').toLowerCase().includes(q);
      const matchS = userStatusFilter === 'All' || u.status === userStatusFilter;
      return matchQ && matchS;
    });
  }, [userSearch, userStatusFilter, users]);

  // Step 1: Must sign in with an allowlisted verified admin account
  if (!authStatus.checked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-200 text-sm">
        Verifying administrative credentials...
      </div>
    );
  }

  if (!firebaseUser || !authStatus.isAdmin) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-900/60 border border-emerald-700 flex items-center justify-center text-emerald-400">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold">Control Center Access</h1>
              <p className="text-xs text-slate-400">Restricted to server-allowlisted administrators</p>
            </div>
          </div>

          {!firebaseUser ? (
            <>
              <p className="text-xs text-slate-300 leading-relaxed">
                Sign in with an authorized administrator account verified on the backend allowlist.
              </p>
              <button
                type="button"
                onClick={() => signInWithPopup(auth, googleProvider)}
                className="w-full py-2.5 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg"
              >
                Sign In with Administrator Google Account
              </button>
            </>
          ) : (
            <div className="p-4 rounded-lg border border-rose-800 bg-rose-950/40 text-xs text-rose-200">
              Signed in as <strong>{firebaseUser.email}</strong>, which is not authorized for Control Center access.
            </div>
          )}

          <button
            type="button"
            onClick={onExit}
            className="w-full py-2 text-xs text-slate-400 hover:text-white"
          >
            Return to Public Platform
          </button>
        </div>
      </div>
    );
  }

  // Step 2: Server-side Passcode Gate (supports first-run claim when ADMIN_PASSCODE env is unset)
  if (!passcodeVerified) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 space-y-5">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-6 h-6 text-emerald-400" />
            <div>
              <h1 className="text-lg font-bold">
                {authStatus.adminPasscodeConfigured ? 'Verify Admin Passcode' : 'Claim Control Center Passcode'}
              </h1>
              <p className="text-xs text-slate-400">Verified identity: {firebaseUser.email}</p>
            </div>
          </div>

          {gateError && (
            <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-800 text-xs text-rose-200">
              {gateError}
            </div>
          )}

          {!authStatus.adminPasscodeConfigured ? (
            <form onSubmit={handleClaimPasscode} className="space-y-4">
              <p className="text-xs text-slate-300 leading-relaxed">
                No server <code>ADMIN_PASSCODE</code> secret is configured yet. Set a one-time Control Center passcode (hashed with salted scrypt on the server) to lock administrative access.
              </p>
              <input
                type="password"
                required
                minLength={8}
                value={claimPasscode}
                onChange={(e) => setClaimPasscode(e.target.value)}
                placeholder="Create passcode (min 8 characters)"
                className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-700 bg-slate-950 text-white"
              />
              <button
                type="submit"
                className="w-full py-2.5 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg"
              >
                Claim & Unlock Control Center
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyPasscode} className="space-y-4">
              <input
                type="password"
                required
                value={passcodeInput}
                onChange={(e) => setPasscodeInput(e.target.value)}
                placeholder="Enter Control Center passcode"
                className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-700 bg-slate-950 text-white"
              />
              <button
                type="submit"
                className="w-full py-2.5 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg"
              >
                Unlock Control Center
              </button>
            </form>
          )}

          <button type="button" onClick={onExit} className="w-full py-2 text-xs text-slate-400 hover:text-white">
            Exit Control Center
          </button>
        </div>
      </div>
    );
  }

  const activeUsersCount = users.filter((u) => u.status === 'active').length;
  const storageMb = ((overview?.stats.storageBytes || 0) / (1024 * 1024)).toFixed(2);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <header className="h-16 border-b border-slate-800 px-6 flex items-center justify-between bg-slate-900">
        <div className="flex items-center gap-4">
          <BioScanLogo size={30} variant="dark-bg" />
          <span className="text-xs font-mono text-emerald-400">Control Center</span>
        </div>

        <nav className="flex items-center gap-2 overflow-x-auto">
          {(
            [
              ['dashboard', 'Admin Dashboard'],
              ['users', 'User Management'],
              ['datasets', 'Data Management'],
              ['settings', 'System Settings'],
              ['audit', 'Audit Logs'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap ${
                tab === id ? 'bg-emerald-700 text-white' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              {label}
            </button>
          ))}
        </nav>

        <button
          type="button"
          onClick={onExit}
          className="px-3 py-1.5 text-xs font-medium border border-slate-700 rounded-lg hover:bg-slate-800 whitespace-nowrap"
        >
          Exit to App
        </button>
      </header>

      <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6">
        {tab === 'dashboard' && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                ['Total Registered Users', users.length],
                ['Active Users', activeUsersCount],
                ['Total Datasets', overview?.stats.totalDatasets ?? 0],
                ['Total Analyses', overview?.stats.totalAnalyses ?? 0],
                ['Completed Analyses', overview?.stats.completedAnalyses ?? 0],
                ['Failed Analyses', overview?.stats.failedAnalyses ?? 0],
                ['Storage Usage (MB)', storageMb],
                ['Research Projects', overview?.stats.totalProjects ?? 0],
              ].map(([label, val]) => (
                <div key={String(label)} className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                  <div className="text-xs text-slate-400">{label}</div>
                  <div className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-white">{val}</div>
                </div>
              ))}
            </div>

            <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
              <h2 className="text-sm font-semibold">Recent Administrative Activities</h2>
              {auditLogs.length === 0 ? (
                <p className="text-xs text-slate-400">No audit entries recorded yet.</p>
              ) : (
                <div className="divide-y divide-slate-800 text-xs">
                  {auditLogs.slice(0, 8).map((log) => (
                    <div key={log.id} className="py-2.5 flex items-center justify-between gap-4">
                      <div>
                        <span className="font-mono text-emerald-400">{log.action}</span>
                        <span className="text-slate-400 ml-2">{log.details}</span>
                      </div>
                      <span className="text-slate-500 font-mono">{log.actorEmail}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {tab === 'users' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Search users by name, email, or institution..."
                className="flex-1 min-w-[220px] px-3 py-2 text-xs rounded-lg border border-slate-700 bg-slate-900 text-white"
              />
              <select
                value={userStatusFilter}
                onChange={(e) => setUserStatusFilter(e.target.value)}
                className="px-3 py-2 text-xs rounded-lg border border-slate-700 bg-slate-900 text-white"
              >
                {['All', 'active', 'deactivated', 'suspended'].map((s) => (
                  <option key={s} value={s}>
                    Status: {s}
                  </option>
                ))}
              </select>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-left text-slate-400">
                    <th className="py-3 px-4">Researcher</th>
                    <th className="py-3 px-4">Institution / Type</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredUsers.map((u) => (
                    <tr key={u.uid}>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-white">{u.fullName}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{u.email}</div>
                      </td>
                      <td className="py-3 px-4 text-slate-300">
                        {u.institution || 'Unspecified'} · {u.userType}
                      </td>
                      <td className="py-3 px-4">
                        <select
                          value={u.role}
                          onChange={(e) => handleUpdateUserRole(u, e.target.value as 'user' | 'admin')}
                          className="px-2 py-1 text-xs rounded border border-slate-700 bg-slate-950"
                        >
                          <option value="user">user</option>
                          <option value="admin">admin</option>
                        </select>
                      </td>
                      <td className="py-3 px-4 font-mono">{u.status}</td>
                      <td className="py-3 px-4 text-right space-x-1.5">
                        <button
                          type="button"
                          onClick={() => handleUpdateUserStatus(u, 'active')}
                          className="px-2 py-1 rounded border border-emerald-700 text-emerald-400 hover:bg-emerald-950"
                        >
                          Activate
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdateUserStatus(u, 'deactivated')}
                          className="px-2 py-1 rounded border border-amber-700 text-amber-400 hover:bg-amber-950"
                        >
                          Deactivate
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdateUserStatus(u, 'suspended')}
                          className="px-2 py-1 rounded border border-rose-700 text-rose-400 hover:bg-rose-950"
                        >
                          Suspend
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'datasets' && overview && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-x-auto">
              <div className="px-4 py-3 border-b border-slate-800 text-sm font-semibold">
                All Uploaded Datasets ({overview.datasets.length})
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-left text-slate-400">
                    <th className="py-2.5 px-4">Dataset</th>
                    <th className="py-2.5 px-4">Format</th>
                    <th className="py-2.5 px-4">Owner UID</th>
                    <th className="py-2.5 px-4 text-right">Sequences</th>
                    <th className="py-2.5 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {overview.datasets.map((d) => (
                    <tr key={d.id}>
                      <td className="py-2.5 px-4 font-medium text-white">{d.dataset_name}</td>
                      <td className="py-2.5 px-4 font-mono">{d.file_format}</td>
                      <td className="py-2.5 px-4 font-mono text-slate-400">{d.owner_uid.slice(0, 12)}...</td>
                      <td className="py-2.5 px-4 text-right font-mono">{d.sequence_count}</td>
                      <td className="py-2.5 px-4">{d.processing_status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-x-auto">
              <div className="px-4 py-3 border-b border-slate-800 text-sm font-semibold">
                Taxonomy Reference Metadata ({overview.references.length})
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-left text-slate-400">
                    <th className="py-2.5 px-4">Database</th>
                    <th className="py-2.5 px-4">Version</th>
                    <th className="py-2.5 px-4">Marker Genes</th>
                    <th className="py-2.5 px-4">Endpoint</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {overview.references.map((r) => (
                    <tr key={r.id}>
                      <td className="py-2.5 px-4 font-semibold text-emerald-400">{r.database_name}</td>
                      <td className="py-2.5 px-4 font-mono">{r.version_tag}</td>
                      <td className="py-2.5 px-4">{r.marker_gene}</td>
                      <td className="py-2.5 px-4 font-mono text-slate-400">{r.api_endpoint}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'settings' && (
          <form onSubmit={handleSaveSystemSettings} className="max-w-2xl p-6 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
            <h2 className="text-base font-semibold">System Configuration</h2>
            {sysMsg && <div className="p-3 rounded-lg bg-emerald-950/60 border border-emerald-700 text-xs text-emerald-300">{sysMsg}</div>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Application Name</label>
                <input
                  type="text"
                  value={sysForm.applicationName}
                  onChange={(e) => setSysForm({ ...sysForm, applicationName: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-700 bg-slate-950"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Tagline</label>
                <input
                  type="text"
                  value={sysForm.tagline}
                  onChange={(e) => setSysForm({ ...sysForm, tagline: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-700 bg-slate-950"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Max Upload Limit (MB)</label>
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={sysForm.maxUploadSizeMb}
                  onChange={(e) => setSysForm({ ...sysForm, maxUploadSizeMb: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-700 bg-slate-950"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Allowed Formats (comma-separated)</label>
                <input
                  type="text"
                  value={sysForm.allowedFormats}
                  onChange={(e) => setSysForm({ ...sysForm, allowedFormats: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-700 bg-slate-950 font-mono"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={sysForm.maintenanceMode}
                onChange={(e) => setSysForm({ ...sysForm, maintenanceMode: e.target.checked })}
              />
              Enable Maintenance Mode Banner
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={sysForm.notificationsEnabled}
                onChange={(e) => setSysForm({ ...sysForm, notificationsEnabled: e.target.checked })}
              />
              Enable Platform Notifications
            </label>
            <div className="pt-2 border-t border-slate-800 text-xs text-slate-400 space-y-1">
              <div>Supabase Status: {(systemStatus as SystemStatus)?.supabaseConfigured ? 'Connected' : 'Local SQLite Workspace'}</div>
              <div>Gemini API Status: {(systemStatus as SystemStatus)?.geminiConfigured ? 'Configured' : 'Missing Key'}</div>
            </div>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg"
            >
              Save System Settings
            </button>
          </form>
        )}

        {tab === 'audit' && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-x-auto">
            <div className="px-4 py-3 border-b border-slate-800 text-sm font-semibold">
              Protected Administrative Audit Logs ({auditLogs.length})
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-left text-slate-400">
                  <th className="py-2.5 px-4">Action</th>
                  <th className="py-2.5 px-4">Actor</th>
                  <th className="py-2.5 px-4">Target</th>
                  <th className="py-2.5 px-4">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {auditLogs.map((l) => (
                  <tr key={l.id}>
                    <td className="py-2.5 px-4 font-mono text-emerald-400">{l.action}</td>
                    <td className="py-2.5 px-4 font-mono">{l.actorEmail}</td>
                    <td className="py-2.5 px-4 font-mono text-slate-400">
                      {l.targetType}:{l.targetId.slice(0, 12)}
                    </td>
                    <td className="py-2.5 px-4 text-slate-300">{l.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
};
