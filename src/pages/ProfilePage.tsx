import React, { useState } from 'react';
import {
  deleteUser,
  EmailAuthProvider,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  updatePassword,
  updateProfile,
} from 'firebase/auth';
import { deleteDoc, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { Camera, CheckCircle2, KeyRound, Trash2 } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { apiFetch } from '../lib/api';
import { db, googleProvider, handleFirestoreError, OperationType, storage } from '../lib/firebase';
import { BLUEPRINT_LIMITS, clampString, USER_TYPES } from '../lib/validation';
import type { UserTypeOption } from '../types';

export const ProfilePage: React.FC = () => {
  const { firebaseUser, profile, refreshProfile, createNotification } = useApp();

  const [form, setForm] = useState({
    fullName: profile?.fullName || '',
    username: profile?.username || '',
    mobileNumber: profile?.mobileNumber || '',
    country: profile?.country || '',
    state: profile?.state || '',
    institution: profile?.institution || '',
    department: profile?.department || '',
    researchField: profile?.researchField || '',
    userType: (profile?.userType || 'Research Scholar') as UserTypeOption,
  });

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [pwMsg, setPwMsg] = useState('');
  const [pwErr, setPwErr] = useState('');

  // Account deletion confirmation
  const [confirmDeleteText, setConfirmDeleteText] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [showDeleteBox, setShowDeleteBox] = useState(false);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) return;
    setMsg('');
    setErr('');
    setSaving(true);
    try {
      const fullName = clampString(form.fullName, BLUEPRINT_LIMITS.FULL_NAME_MAX);
      await updateProfile(firebaseUser, { displayName: fullName });
      try {
        await updateDoc(doc(db, 'users', firebaseUser.uid), {
          fullName,
          username: clampString(form.username, BLUEPRINT_LIMITS.USERNAME_MAX),
          mobileNumber: clampString(form.mobileNumber, BLUEPRINT_LIMITS.MOBILE_MAX),
          country: clampString(form.country, BLUEPRINT_LIMITS.COUNTRY_MAX),
          state: clampString(form.state, BLUEPRINT_LIMITS.STATE_MAX),
          institution: clampString(form.institution, BLUEPRINT_LIMITS.INSTITUTION_MAX),
          department: clampString(form.department, BLUEPRINT_LIMITS.DEPARTMENT_MAX),
          researchField: clampString(form.researchField, BLUEPRINT_LIMITS.RESEARCH_FIELD_MAX),
          userType: form.userType,
          updatedAt: serverTimestamp(),
        });
      } catch (fsErr) {
        handleFirestoreError(fsErr, OperationType.UPDATE, `users/${firebaseUser.uid}`);
      }
      await refreshProfile();
      await createNotification({
        type: 'account',
        title: 'Profile Updated',
        message: 'Your personal and institutional profile information has been saved.',
        linkView: 'profile',
      });
      setMsg('Profile updated successfully.');
    } catch (eObj) {
      setErr(eObj instanceof Error ? eObj.message : 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !firebaseUser) return;
    if (file.size > 5 * 1024 * 1024) {
      setErr('Profile image must be under 5 MB.');
      return;
    }
    setErr('');
    setMsg('');
    try {
      const storageRef = ref(storage, `users/${firebaseUser.uid}/avatar_${Date.now()}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      await updateProfile(firebaseUser, { photoURL: url });
      await updateDoc(doc(db, 'users', firebaseUser.uid), {
        photoUrl: clampString(url, BLUEPRINT_LIMITS.PHOTO_URL_MAX),
        updatedAt: serverTimestamp(),
      });
      await refreshProfile();
      setMsg('Profile picture updated.');
    } catch (uploadErr) {
      setErr(uploadErr instanceof Error ? uploadErr.message : 'Profile picture upload failed.');
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser || !firebaseUser.email) return;
    setPwErr('');
    setPwMsg('');
    if (newPassword.length < 8) {
      setPwErr('New password must be at least 8 characters.');
      return;
    }
    try {
      const cred = EmailAuthProvider.credential(firebaseUser.email, currentPassword);
      await reauthenticateWithCredential(firebaseUser, cred);
      await updatePassword(firebaseUser, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setPwMsg('Password updated successfully.');
    } catch (pwError) {
      setPwErr(pwError instanceof Error ? pwError.message : 'Password update failed. Check your current password.');
    }
  };

  const handleDeleteAccount = async () => {
    if (!firebaseUser) return;
    if (confirmDeleteText !== 'DELETE') {
      setErr('Type DELETE to confirm permanent account deletion.');
      return;
    }
    setDeleting(true);
    setErr('');
    try {
      const usesPassword = firebaseUser.providerData.some((p) => p.providerId === 'password');
      if (usesPassword && firebaseUser.email) {
        if (!deletePassword) {
          setErr('Please enter your current password to verify account deletion.');
          setDeleting(false);
          return;
        }
        const cred = EmailAuthProvider.credential(firebaseUser.email, deletePassword);
        await reauthenticateWithCredential(firebaseUser, cred);
      } else {
        await reauthenticateWithPopup(firebaseUser, googleProvider);
      }

      await apiFetch('/api/account/cleanup', { method: 'DELETE' });
      try {
        await deleteDoc(doc(db, 'user_preferences', firebaseUser.uid));
        await deleteDoc(doc(db, 'users', firebaseUser.uid));
      } catch {
        // continue to auth deletion
      }
      await deleteUser(firebaseUser);
    } catch (delErr) {
      setErr(delErr instanceof Error ? delErr.message : 'Unable to delete account.');
      setDeleting(false);
    }
  };

  const createdDate = firebaseUser?.metadata?.creationTime
    ? new Date(firebaseUser.metadata.creationTime).toLocaleDateString()
    : 'N/A';

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">My Profile</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Manage your researcher profile, institutional affiliation, credentials, and account lifecycle.
        </p>
      </div>

      {/* Avatar & Account Metadata */}
      <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {profile?.photoUrl ? (
            <img
              src={profile.photoUrl}
              alt={profile.fullName}
              referrerPolicy="no-referrer"
              className="w-16 h-16 rounded-xl object-cover border border-slate-200 dark:border-slate-700"
            />
          ) : (
            <div className="w-16 h-16 rounded-xl bg-emerald-800 text-white text-xl font-bold flex items-center justify-center">
              {(profile?.fullName || 'R').slice(0, 1).toUpperCase()}
            </div>
          )}
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">{profile?.fullName}</h3>
            <p className="text-xs text-slate-500">
              {profile?.email} · {profile?.userType}
            </p>
            <p className="text-xs font-mono text-slate-400 mt-1">
              Member since: {createdDate} · Verified: {firebaseUser?.emailVerified ? 'Yes' : 'Pending'}
            </p>
          </div>
        </div>

        <label className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
          <Camera className="w-4 h-4" />
          Upload Photo
          <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
        </label>
      </div>

      {err && <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700">{err}</div>}
      {msg && (
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          {msg}
        </div>
      )}

      {/* Personal & Institution Form */}
      <form
        onSubmit={handleSaveProfile}
        className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-4"
      >
        <h3 className="sm:col-span-2 text-sm font-semibold">Personal & Institutional Details</h3>
        <div>
          <label className="block text-xs font-medium mb-1">Full Name</label>
          <input
            type="text"
            required
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Username</label>
          <input
            type="text"
            required
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Mobile Number</label>
          <input
            type="tel"
            value={form.mobileNumber}
            onChange={(e) => setForm({ ...form, mobileNumber: e.target.value })}
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">User Type</label>
          <select
            value={form.userType}
            onChange={(e) => setForm({ ...form, userType: e.target.value as UserTypeOption })}
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
          <label className="block text-xs font-medium mb-1">Country</label>
          <input
            type="text"
            value={form.country}
            onChange={(e) => setForm({ ...form, country: e.target.value })}
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">State / Province</label>
          <input
            type="text"
            value={form.state}
            onChange={(e) => setForm({ ...form, state: e.target.value })}
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Institution / University</label>
          <input
            type="text"
            value={form.institution}
            onChange={(e) => setForm({ ...form, institution: e.target.value })}
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Department</label>
          <input
            type="text"
            value={form.department}
            onChange={(e) => setForm({ ...form, department: e.target.value })}
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium mb-1">Research Field</label>
          <input
            type="text"
            value={form.researchField}
            onChange={(e) => setForm({ ...form, researchField: e.target.value })}
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
          />
        </div>
        <div className="sm:col-span-2 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2 text-xs font-semibold text-white bg-emerald-800 hover:bg-emerald-900 rounded-lg"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>

      {/* Change Password */}
      {firebaseUser?.providerData.some((p) => p.providerId === 'password') && (
        <form
          onSubmit={handlePasswordChange}
          className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4"
        >
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-emerald-700" />
            <h3 className="text-sm font-semibold">Change Password</h3>
          </div>
          {pwErr && <p className="text-xs text-rose-600">{pwErr}</p>}
          {pwMsg && <p className="text-xs text-emerald-700">{pwMsg}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Current Password"
              className="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
            />
            <input
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New Password (min 8 characters)"
              className="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
            />
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Update Password
            </button>
          </div>
        </form>
      )}

      {/* Safe Account Deletion */}
      <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/60 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-rose-700 dark:text-rose-400">Delete Account</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Permanently remove your researcher profile, uploaded datasets, taxonomy results, and authentication credentials.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowDeleteBox(!showDeleteBox)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-rose-700 border border-rose-300 dark:border-rose-800 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 whitespace-nowrap"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete Account
          </button>
        </div>

        {showDeleteBox && (
          <div className="pt-3 border-t border-rose-100 dark:border-rose-900/50 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                value={confirmDeleteText}
                onChange={(e) => setConfirmDeleteText(e.target.value)}
                placeholder='Type "DELETE" to confirm'
                className="px-3 py-2 text-xs rounded-lg border border-rose-300 dark:border-rose-800 bg-white dark:bg-slate-950"
              />
              {firebaseUser?.providerData.some((p) => p.providerId === 'password') && (
                <input
                  type="password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  placeholder="Enter password to verify"
                  className="px-3 py-2 text-xs rounded-lg border border-rose-300 dark:border-rose-800 bg-white dark:bg-slate-950"
                />
              )}
            </div>
            <button
              type="button"
              disabled={deleting}
              onClick={handleDeleteAccount}
              className="px-4 py-2 text-xs font-semibold text-white bg-rose-700 hover:bg-rose-800 rounded-lg"
            >
              {deleting ? 'Deleting Account...' : 'Permanently Delete My Account'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
