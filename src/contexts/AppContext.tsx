import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { apiFetch } from '../lib/api';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { BLUEPRINT_LIMITS, clampString } from '../lib/validation';
import type {
  AppNotification,
  ApplicationSettings,
  SystemStatus,
  UserPreferences,
  UserProfile,
} from '../types';

interface AppContextValue {
  firebaseUser: User | null;
  authReady: boolean;
  profile: UserProfile | null;
  preferences: UserPreferences | null;
  notifications: AppNotification[];
  unreadCount: number;
  isAdmin: boolean;
  systemStatus: SystemStatus | null;
  appSettings: ApplicationSettings | null;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  setThemeMode: (mode: 'light' | 'dark' | 'system') => Promise<void>;
  refreshProfile: () => Promise<void>;
  createNotification: (payload: {
    type: AppNotification['type'];
    title: string;
    message: string;
    linkView?: string;
  }) => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  logout: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [appSettings, setAppSettings] = useState<ApplicationSettings | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('edna_bioscan_theme');
    return saved === 'dark' ? 'dark' : 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('edna_bioscan_theme', theme);
  }, [theme]);

  // Load public system status & global settings
  useEffect(() => {
    fetch('/api/system/status')
      .then((r) => r.json())
      .then((data: SystemStatus) => setSystemStatus(data))
      .catch(() => {});

    getDoc(doc(db, 'application_settings', 'global'))
      .then((snap) => {
        if (snap.exists()) {
          setAppSettings(snap.data() as ApplicationSettings);
        }
      })
      .catch(() => {});
  }, []);

  const loadUserProfile = useCallback(async (user: User) => {
    try {
      const userRef = doc(db, 'users', user.uid);
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        const data = snap.data() as UserProfile;
        setProfile(data);
        // Sync emailVerified flag if user verified their email
        if (user.emailVerified && !data.emailVerified) {
          try {
            await updateDoc(userRef, {
              emailVerified: true,
              updatedAt: serverTimestamp(),
            });
            setProfile({ ...data, emailVerified: true });
          } catch {
            // Non-blocking sync
          }
        }
      } else if (user.email) {
        // Ensure Google Sign-In users automatically get a complete profile document
        const username = clampString(
          (user.email.split('@')[0] || 'researcher').replace(/[^a-zA-Z0-9_.-]/g, '_'),
          BLUEPRINT_LIMITS.USERNAME_MAX,
        );
        const newProfile = {
          uid: user.uid,
          fullName: clampString(user.displayName || username, BLUEPRINT_LIMITS.FULL_NAME_MAX),
          username: username.length >= 2 ? username : `user_${user.uid.slice(0, 6)}`,
          email: clampString(user.email, BLUEPRINT_LIMITS.EMAIL_MAX),
          mobileNumber: '',
          country: '',
          state: '',
          institution: '',
          department: '',
          researchField: '',
          userType: 'Environmental Researcher' as const,
          role: 'user' as const,
          status: 'active' as const,
          emailVerified: user.emailVerified,
          photoUrl: clampString(user.photoURL || '', BLUEPRINT_LIMITS.PHOTO_URL_MAX),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        await setDoc(userRef, newProfile);
        setProfile({ ...newProfile, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, `users/${user.uid}`);
    }
  }, []);

  const loadPreferences = useCallback(async (user: User) => {
    try {
      const prefRef = doc(db, 'user_preferences', user.uid);
      const snap = await getDoc(prefRef);
      if (snap.exists()) {
        const pref = snap.data() as UserPreferences;
        setPreferences(pref);
        if (pref.theme === 'dark' || pref.theme === 'light') {
          setTheme(pref.theme);
        }
      } else {
        const defaultPref = {
          userId: user.uid,
          theme: 'light' as const,
          emailNotifications: true,
          analysisAlerts: true,
          defaultReferenceDb: 'NCBI BLAST' as const,
          defaultConfidenceThreshold: 80,
          updatedAt: serverTimestamp(),
        };
        await setDoc(prefRef, defaultPref);
        setPreferences({ ...defaultPref, updatedAt: new Date().toISOString() });
      }
    } catch {
      // Non-fatal if user not yet verified or offline
    }
  }, []);

  const verifyBackendRole = useCallback(async () => {
    try {
      const me = await apiFetch<{ isAdmin: boolean }>('/api/auth/me');
      setIsAdmin(Boolean(me.isAdmin));
    } catch {
      setIsAdmin(false);
    }
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        await Promise.all([loadUserProfile(user), loadPreferences(user), verifyBackendRole()]);
      } else {
        setProfile(null);
        setPreferences(null);
        setNotifications([]);
        setIsAdmin(false);
      }
      setAuthReady(true);
    });
    return () => unsub();
  }, [loadPreferences, loadUserProfile, verifyBackendRole]);

  // Attach Firestore notification listener strictly when authReady && firebaseUser
  useEffect(() => {
    if (!authReady || !firebaseUser) {
      setNotifications([]);
      return;
    }

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', firebaseUser.uid),
      orderBy('createdAt', 'desc'),
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const items = snap.docs.map((d) => d.data() as AppNotification);
        setNotifications(items);
      },
      (error) => {
        // Fallback if composite index is still building or handle permission errors cleanly
        if (error.message.toLowerCase().includes('index')) {
          const simpleQ = query(collection(db, 'notifications'), where('userId', '==', firebaseUser.uid));
          onSnapshot(
            simpleQ,
            (s) => {
              const list = s.docs.map((d) => d.data() as AppNotification);
              setNotifications(list);
            },
            (err) => handleFirestoreError(err, OperationType.LIST, 'notifications'),
          );
        } else {
          handleFirestoreError(error, OperationType.LIST, 'notifications');
        }
      },
    );

    return () => unsub();
  }, [authReady, firebaseUser]);

  const createNotification = useCallback(
    async (payload: {
      type: AppNotification['type'];
      title: string;
      message: string;
      linkView?: string;
    }) => {
      if (!firebaseUser) return;
      const id = `notif_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const path = `notifications/${id}`;
      try {
        await setDoc(doc(db, 'notifications', id), {
          id,
          userId: firebaseUser.uid,
          type: payload.type,
          title: clampString(payload.title, BLUEPRINT_LIMITS.NOTIFICATION_TITLE_MAX),
          message: clampString(payload.message, BLUEPRINT_LIMITS.NOTIFICATION_MESSAGE_MAX),
          read: false,
          linkView: clampString(payload.linkView || 'overview', 100),
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, path);
      }
    },
    [firebaseUser],
  );

  const markNotificationRead = useCallback(async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `notifications/${id}`);
    }
  }, []);

  const markAllNotificationsRead = useCallback(async () => {
    const unread = notifications.filter((n) => !n.read);
    await Promise.all(unread.map((n) => markNotificationRead(n.id)));
  }, [markNotificationRead, notifications]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  const setThemeMode = useCallback(
    async (mode: 'light' | 'dark' | 'system') => {
      const resolved =
        mode === 'system'
          ? window.matchMedia('(prefers-color-scheme: dark)').matches
            ? 'dark'
            : 'light'
          : mode;
      setTheme(resolved);
      if (firebaseUser) {
        try {
          await updateDoc(doc(db, 'user_preferences', firebaseUser.uid), {
            theme: mode,
            updatedAt: serverTimestamp(),
          });
          setPreferences((prev) => (prev ? { ...prev, theme: mode } : prev));
        } catch {
          // ignore if pref doc missing
        }
      }
    },
    [firebaseUser],
  );

  const refreshProfile = useCallback(async () => {
    if (firebaseUser) {
      await firebaseUser.reload();
      await loadUserProfile(firebaseUser);
      await verifyBackendRole();
    }
  }, [firebaseUser, loadUserProfile, verifyBackendRole]);

  const logout = useCallback(async () => {
    await signOut(auth);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <AppContext.Provider
      value={{
        firebaseUser,
        authReady,
        profile,
        preferences,
        notifications,
        unreadCount,
        isAdmin,
        systemStatus,
        appSettings,
        theme,
        toggleTheme,
        setThemeMode,
        refreshProfile,
        createNotification,
        markNotificationRead,
        markAllNotificationsRead,
        logout,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
