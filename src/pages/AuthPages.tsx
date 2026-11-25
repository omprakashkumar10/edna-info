import React, { useState } from 'react';
import {
  browserLocalPersistence,
  browserSessionPersistence,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
} from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { ArrowLeft, CheckCircle2, Eye, EyeOff, MailCheck, RefreshCw, ShieldAlert } from 'lucide-react';
import { BioScanLogo } from '../components/BioScanLogo';
import { useApp } from '../contexts/AppContext';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from '../lib/firebase';
import { BLUEPRINT_LIMITS, clampString, evaluatePasswordStrength, USER_TYPES } from '../lib/validation';
import type { PublicView, UserTypeOption } from '../types';

interface AuthPagesProps {
  view: 'login' | 'register' | 'forgot-password' | 'verify-email';
  onNavigate: (view: PublicView) => void;
}

export const AuthPages: React.FC<AuthPagesProps> = ({ view, onNavigate }) => {
  const { firebaseUser, refreshProfile, logout } = useApp();

  // Login state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Registration state (12 required fields)
  const [regForm, setRegForm] = useState({
    fullName: '',
    username: '',
    email: '',
    mobileNumber: '',
    country: '',
    state: '',
    institution: '',
    department: '',
    researchField: '',
    userType: 'Research Scholar' as UserTypeOption,
    password: '',
    confirmPassword: '',
  });
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);

  // Forgot password state
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);

  // Feedback state
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [verifyMessage, setVerifyMessage] = useState('');

  const passwordStrength = evaluatePasswordStrength(regForm.password);

  const mapAuthError = (err: unknown): string => {
    const code = (err as { code?: string })?.code || '';
    const msg = err instanceof Error ? err.message : String(err);
    if (code === 'auth/operation-not-allowed') {
      return 'Email/Password sign-in is not yet enabled in Firebase Console (Authentication -> Sign-in method -> Email/Password). You can enable it there or use Google Sign-In below.';
    }
    if (code === 'auth/email-already-in-use') {
      return 'An account with this email address already exists. Please sign in or reset your password.';
    }
    if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
      return 'Invalid email address or password. Please verify your credentials.';
    }
    if (code === 'auth/too-many-requests') {
      return 'Too many repeated attempts. Please wait a few minutes before trying again.';
    }
    if (code === 'auth/popup-closed-by-user') {
      return 'Google Sign-In window was closed before completing authentication.';
    }
    return msg;
  };

  const handleGoogleAuth = async () => {
    setErrorMsg('');
    setLoading(true);
    try {
      await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setErrorMsg(mapAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    if (!loginEmail.trim() || !loginPassword) {
      setErrorMsg('Please enter both your email address and password.');
      return;
    }

    setLoading(true);
    try {
      // Check server-side rate-limit / lockout
      const guardRes = await fetch('/api/auth/login-guard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'check', email: loginEmail }),
      });
      const guard = (await guardRes.json()) as { allowed: boolean; retryAfterSec: number };
      if (!guard.allowed) {
        setErrorMsg(`Account temporarily locked due to repeated failed attempts. Try again in ${Math.ceil(guard.retryAfterSec / 60)} minute(s).`);
        setLoading(false);
        return;
      }

      await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
      await signInWithEmailAndPassword(auth, loginEmail.trim(), loginPassword);

      await fetch('/api/auth/login-guard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'success', email: loginEmail }),
      });
    } catch (err) {
      const failRes = await fetch('/api/auth/login-guard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'fail', email: loginEmail }),
      }).then((r) => r.json()).catch(() => null);

      const base = mapAuthError(err);
      if (failRes && failRes.locked) {
        setErrorMsg('Maximum login attempts exceeded. Account locked for 15 minutes.');
      } else if (failRes && typeof failRes.remainingAttempts === 'number') {
        setErrorMsg(`${base} (${failRes.remainingAttempts} attempts remaining before lockout)`);
      } else {
        setErrorMsg(base);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (regForm.fullName.trim().length < BLUEPRINT_LIMITS.FULL_NAME_MIN) {
      setErrorMsg('Full Name must be at least 2 characters.');
      return;
    }
    if (!BLUEPRINT_LIMITS.USERNAME_PATTERN.test(regForm.username.trim())) {
      setErrorMsg('Username may only contain letters, numbers, underscores, dots, or hyphens.');
      return;
    }
    if (regForm.password.length < 8 || passwordStrength.score < 3) {
      setErrorMsg('Please choose a stronger password (at least 8 characters with mixed case, numbers, or symbols).');
      return;
    }
    if (regForm.password !== regForm.confirmPassword) {
      setErrorMsg('Password and Confirm Password do not match.');
      return;
    }
    if (!acceptTerms || !acceptPrivacy) {
      setErrorMsg('Please accept both the Terms & Conditions and Privacy Policy to continue.');
      return;
    }

    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, regForm.email.trim(), regForm.password);
      await updateProfile(cred.user, { displayName: clampString(regForm.fullName, BLUEPRINT_LIMITS.FULL_NAME_MAX) });

      try {
        await setDoc(doc(db, 'users', cred.user.uid), {
          uid: cred.user.uid,
          fullName: clampString(regForm.fullName, BLUEPRINT_LIMITS.FULL_NAME_MAX),
          username: clampString(regForm.username, BLUEPRINT_LIMITS.USERNAME_MAX),
          email: clampString(regForm.email, BLUEPRINT_LIMITS.EMAIL_MAX),
          mobileNumber: clampString(regForm.mobileNumber, BLUEPRINT_LIMITS.MOBILE_MAX),
          country: clampString(regForm.country, BLUEPRINT_LIMITS.COUNTRY_MAX),
          state: clampString(regForm.state, BLUEPRINT_LIMITS.STATE_MAX),
          institution: clampString(regForm.institution, BLUEPRINT_LIMITS.INSTITUTION_MAX),
          department: clampString(regForm.department, BLUEPRINT_LIMITS.DEPARTMENT_MAX),
          researchField: clampString(regForm.researchField, BLUEPRINT_LIMITS.RESEARCH_FIELD_MAX),
          userType: regForm.userType,
          role: 'user',
          status: 'active',
          emailVerified: false,
          photoUrl: '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (fsErr) {
        handleFirestoreError(fsErr, OperationType.CREATE, `users/${cred.user.uid}`);
      }

      const notifId = `notif_reg_${Date.now()}`;
      try {
        await setDoc(doc(db, 'notifications', notifId), {
          id: notifId,
          userId: cred.user.uid,
          type: 'registration',
          title: 'Welcome to eDNA BioScan',
          message: 'Your researcher account was created successfully. Please verify your email address to unlock all scientific workflows.',
          read: false,
          linkView: 'overview',
          createdAt: serverTimestamp(),
        });
      } catch {
        // non-blocking
      }

      await sendEmailVerification(cred.user);
      setSuccessMsg('Registration successful! A verification link has been sent to your email address.');
    } catch (err) {
      setErrorMsg(mapAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!resetEmail.trim()) {
      setErrorMsg('Enter your registered email address.');
      return;
    }
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, resetEmail.trim());
      setResetSent(true);
    } catch (err) {
      setErrorMsg(mapAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!firebaseUser) return;
    setVerifyMessage('');
    setErrorMsg('');
    setLoading(true);
    try {
      await sendEmailVerification(firebaseUser);
      setVerifyMessage('Verification email re-sent. Please check your inbox and spam folder.');
    } catch (err) {
      setErrorMsg(mapAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-between py-8 px-4 sm:px-6">
      <div className="max-w-7xl w-full mx-auto flex items-center justify-between">
        <button
          type="button"
          onClick={() => onNavigate('landing')}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-emerald-800 dark:hover:text-emerald-400"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </button>
        <BioScanLogo size={32} showTagline />
      </div>

      <div className="my-8 mx-auto w-full max-w-2xl">
        {view === 'login' && (
          <div className="max-w-md mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Researcher Sign In</h1>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                Access your eDNA datasets, taxonomy analyses, and biodiversity dashboards.
              </p>
            </div>

            {errorMsg && (
              <div className="p-3.5 rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/50 text-xs text-rose-800 dark:text-rose-200 flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <button
              type="button"
              disabled={loading}
              onClick={handleGoogleAuth}
              className="w-full py-2.5 px-4 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-medium text-slate-800 dark:text-slate-100 flex items-center justify-center gap-2 transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z" />
                <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z" />
                <path fill="#FBBC05" d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z" />
                <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.91 6.72-4.91Z" />
              </svg>
              Continue with Google
            </button>

            <div className="relative flex items-center">
              <div className="flex-grow border-t border-slate-200 dark:border-slate-800" />
              <span className="px-3 text-xs text-slate-400">or sign in with email</span>
              <div className="flex-grow border-t border-slate-200 dark:border-slate-800" />
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  placeholder="researcher@institution.org"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 pr-10 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                    placeholder="Enter password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label="Toggle password visibility"
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs">
                <label className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
                  />
                  Remember me
                </label>
                <button
                  type="button"
                  onClick={() => onNavigate('forgot-password')}
                  className="font-medium text-emerald-800 dark:text-emerald-400 hover:underline"
                >
                  Forgot password?
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-emerald-800 hover:bg-emerald-900 disabled:opacity-60 rounded-lg transition-colors"
              >
                {loading ? 'Signing In...' : 'Sign In'}
              </button>
            </form>

            <p className="text-center text-xs text-slate-600 dark:text-slate-400">
              New to eDNA BioScan?{' '}
              <button
                type="button"
                onClick={() => onNavigate('register')}
                className="font-semibold text-emerald-800 dark:text-emerald-400 hover:underline"
              >
                Create Researcher Account
              </button>
            </p>
          </div>
        )}

        {view === 'register' && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Researcher Registration</h1>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  Register your institutional profile to upload and analyze environmental DNA datasets.
                </p>
              </div>
              <button
                type="button"
                onClick={handleGoogleAuth}
                disabled={loading}
                className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 whitespace-nowrap shrink-0"
              >
                Quick Register with Google
              </button>
            </div>

            {errorMsg && (
              <div className="p-3.5 rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/50 text-xs text-rose-800 dark:text-rose-200">
                {errorMsg}
              </div>
            )}
            {successMsg && (
              <div className="p-3.5 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/50 text-xs text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            <form onSubmit={handleRegister} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={regForm.fullName}
                  onChange={(e) => setRegForm({ ...regForm, fullName: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                  placeholder="Dr. Aarav Sharma"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Username *</label>
                <input
                  type="text"
                  required
                  value={regForm.username}
                  onChange={(e) => setRegForm({ ...regForm, username: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                  placeholder="aarav_ecogenomics"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  value={regForm.email}
                  onChange={(e) => setRegForm({ ...regForm, email: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                  placeholder="aarav@university.edu"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Mobile Number</label>
                <input
                  type="tel"
                  value={regForm.mobileNumber}
                  onChange={(e) => setRegForm({ ...regForm, mobileNumber: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                  placeholder="+1 555 014 8820"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Country *</label>
                <input
                  type="text"
                  required
                  value={regForm.country}
                  onChange={(e) => setRegForm({ ...regForm, country: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                  placeholder="United States"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">State / Province</label>
                <input
                  type="text"
                  value={regForm.state}
                  onChange={(e) => setRegForm({ ...regForm, state: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                  placeholder="California"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Institution / University *</label>
                <input
                  type="text"
                  required
                  value={regForm.institution}
                  onChange={(e) => setRegForm({ ...regForm, institution: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                  placeholder="Scripps Institution of Oceanography"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Department</label>
                <input
                  type="text"
                  value={regForm.department}
                  onChange={(e) => setRegForm({ ...regForm, department: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                  placeholder="Marine Biology & Genomics"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Research Field *</label>
                <input
                  type="text"
                  required
                  value={regForm.researchField}
                  onChange={(e) => setRegForm({ ...regForm, researchField: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                  placeholder="Aquatic eDNA Metabarcoding"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">User Type *</label>
                <select
                  value={regForm.userType}
                  onChange={(e) => setRegForm({ ...regForm, userType: e.target.value as UserTypeOption })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                >
                  {USER_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Password *</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={regForm.password}
                    onChange={(e) => setRegForm({ ...regForm, password: e.target.value })}
                    className="w-full px-3 py-2 pr-9 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                    placeholder="Minimum 8 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-2.5 text-slate-400"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {regForm.password && (
                  <div className="mt-1.5 space-y-1">
                    <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-800 rounded overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          passwordStrength.score <= 2
                            ? 'bg-rose-500 w-1/3'
                            : passwordStrength.score === 3
                              ? 'bg-amber-500 w-2/3'
                              : 'bg-emerald-600 w-full'
                        }`}
                      />
                    </div>
                    <p className="text-[11px] text-slate-500">Strength: {passwordStrength.label}</p>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Confirm Password *</label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={regForm.confirmPassword}
                    onChange={(e) => setRegForm({ ...regForm, confirmPassword: e.target.value })}
                    className="w-full px-3 py-2 pr-9 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                    placeholder="Re-enter password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-2.5 top-2.5 text-slate-400"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="sm:col-span-2 space-y-2 pt-2 text-xs text-slate-600 dark:text-slate-400">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={acceptTerms}
                    onChange={(e) => setAcceptTerms(e.target.checked)}
                    className="rounded border-slate-300 text-emerald-700"
                  />
                  I accept the eDNA BioScan Scientific Research Terms & Conditions.
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={acceptPrivacy}
                    onChange={(e) => setAcceptPrivacy(e.target.checked)}
                    className="rounded border-slate-300 text-emerald-700"
                  />
                  I agree to the Data Governance and Privacy Policy.
                </label>
              </div>

              <div className="sm:col-span-2 pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-emerald-800 hover:bg-emerald-900 disabled:opacity-60 rounded-lg transition-colors"
                >
                  {loading ? 'Creating Account...' : 'Register Researcher Account'}
                </button>
              </div>
            </form>

            <p className="text-center text-xs text-slate-600 dark:text-slate-400">
              Already registered?{' '}
              <button
                type="button"
                onClick={() => onNavigate('login')}
                className="font-semibold text-emerald-800 dark:text-emerald-400 hover:underline"
              >
                Sign In
              </button>
            </p>
          </div>
        )}

        {view === 'forgot-password' && (
          <div className="max-w-md mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Reset Password</h1>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                Enter your email address to receive a secure Firebase password reset link.
              </p>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-lg border border-rose-200 bg-rose-50 text-xs text-rose-800">
                {errorMsg}
              </div>
            )}

            {resetSent ? (
              <div className="space-y-4">
                <div className="p-4 rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/50 text-sm text-emerald-900 dark:text-emerald-200">
                  Password reset instructions have been sent to <strong>{resetEmail}</strong>. Follow the link in your inbox to choose a new password.
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('login')}
                  className="w-full py-2.5 text-sm font-semibold text-white bg-emerald-800 hover:bg-emerald-900 rounded-lg"
                >
                  Return to Login
                </button>
              </div>
            ) : (
              <form onSubmit={handlePasswordReset} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Registered Email</label>
                  <input
                    type="email"
                    required
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                    placeholder="researcher@institution.org"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 text-sm font-semibold text-white bg-emerald-800 hover:bg-emerald-900 rounded-lg"
                >
                  {loading ? 'Sending Link...' : 'Send Reset Link'}
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('login')}
                  className="w-full py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:underline"
                >
                  Back to Login
                </button>
              </form>
            )}
          </div>
        )}

        {view === 'verify-email' && (
          <div className="max-w-md mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 space-y-5 text-center">
            <div className="w-12 h-12 mx-auto rounded-xl bg-emerald-50 dark:bg-emerald-950 flex items-center justify-center text-emerald-700 dark:text-emerald-400">
              <MailCheck className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Verify Your Email Address</h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              We sent a verification link to <strong className="text-slate-900 dark:text-slate-200">{firebaseUser?.email}</strong>. Verify your email before accessing scientific pipelines.
            </p>
            {verifyMessage && (
              <div className="p-3 rounded-lg border border-emerald-200 bg-emerald-50 text-xs text-emerald-800">
                {verifyMessage}
              </div>
            )}
            {errorMsg && (
              <div className="p-3 rounded-lg border border-rose-200 bg-rose-50 text-xs text-rose-800">
                {errorMsg}
              </div>
            )}
            <div className="space-y-3 pt-2">
              <button
                type="button"
                onClick={refreshProfile}
                className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-emerald-800 hover:bg-emerald-900 rounded-lg inline-flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                I Have Verified My Email
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={handleResendVerification}
                className="w-full py-2.5 px-4 text-sm font-medium border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Resend Verification Email
              </button>
              <button
                type="button"
                onClick={logout}
                className="w-full py-2 text-xs text-slate-500 hover:underline"
              >
                Sign out and switch account
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="text-center text-xs text-slate-500">
        eDNA BioScan · Scientific Environmental Genomics Platform
      </div>
    </div>
  );
};
