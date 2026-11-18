import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
  reauthenticateWithCredential,
  verifyBeforeUpdateEmail,
  verifyPasswordResetCode,
  confirmPasswordReset,
  applyActionCode,
  EmailAuthProvider,
  type User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { getActionCodeSettings } from './authConfig';

export interface AuthUserMetadata {
  full_name?: string;
  phone?: string;
  role?: 'user' | 'admin';
}

/**
 * App-facing user shape. Exposes `emailVerified` alongside
 * `id`, `email`, and `user_metadata`.
 */
export interface AuthUser {
  id: string;
  email: string;
  emailVerified: boolean;
  user_metadata: AuthUserMetadata;
}

interface AuthContextValue {
  user: AuthUser | null;
  rawUser: FirebaseUser | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName: string, phone: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null; emailVerified?: boolean }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  sendVerificationEmail: () => Promise<{ error: string | null }>;
  reloadUser: () => Promise<{ verified: boolean }>;
  changeEmail: (newEmail: string, currentPassword: string) => Promise<{ error: string | null }>;
  verifyResetCode: (oobCode: string) => Promise<{ email: string | null; error: string | null }>;
  confirmResetPassword: (oobCode: string, newPassword: string) => Promise<{ error: string | null }>;
  applyAction: (oobCode: string) => Promise<{ error: string | null }>;
  syncEmailVerifiedToFirestore: (uid?: string, verified?: boolean) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

const errorMessages: Record<string, string> = {
  'auth/email-already-in-use': 'An account with this email already exists.',
  'auth/invalid-email': 'Please enter a valid email address.',
  'auth/weak-password': 'Password should be at least 8 characters with letters and numbers.',
  'auth/user-not-found': 'No account found with this email.',
  'auth/wrong-password': 'Incorrect password.',
  'auth/invalid-credential': 'Incorrect email or password.',
  'auth/too-many-requests': 'Too many attempts. Please wait a few moments and try again.',
  'auth/network-request-failed': 'Network error. Please check your connection.',
  'auth/requires-recent-login': 'Please sign in again before changing your email.',
  'auth/expired-action-code': 'This link has expired. Please request a new one.',
  'auth/invalid-action-code': 'This link is invalid or has already been used. Please request a new one.',
  'auth/user-disabled': 'This account has been disabled. Please contact support.',
};

export function friendlyError(err: unknown): string {
  if (err && typeof err === 'object' && 'code' in err) {
    const code = (err as { code: string }).code;
    if (errorMessages[code]) return errorMessages[code];
  }
  if (err instanceof Error && err.message) return err.message;
  return 'An unexpected error occurred. Please try again.';
}

/** Maps a Firebase user (+ its Firestore profile doc) onto the app-facing shape. */
async function loadAuthUser(fbUser: FirebaseUser): Promise<AuthUser> {
  const metadata: AuthUserMetadata = {
    full_name: fbUser.displayName || undefined,
    phone: fbUser.phoneNumber || undefined,
  };
  try {
    const snap = await getDoc(doc(db, 'users', fbUser.uid));
    if (snap.exists()) {
      const d = snap.data();
      metadata.full_name = (d.name as string) || (d.full_name as string) || metadata.full_name;
      metadata.phone = (d.phone as string) || metadata.phone;
      metadata.role = (d.role as AuthUserMetadata['role']) || 'user';
    }
  } catch {
    // profile lookup failed — fall back to auth-provider metadata only
  }

  // Treat configured admin email as admin role even if Firestore profile read is delayed
  if (fbUser.email === 'admin@lifecare.com') {
    metadata.role = 'admin';
  }

  return {
    id: fbUser.uid,
    email: fbUser.email || '',
    emailVerified: Boolean(fbUser.emailVerified),
    user_metadata: metadata,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [rawUser, setRawUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) {
        if (active) {
          setRawUser(null);
          setUser(null);
          setLoading(false);
        }
        return;
      }
      setRawUser(fbUser);
      const mapped = await loadAuthUser(fbUser);
      if (active) {
        setUser(mapped);
        setLoading(false);
      }
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const syncEmailVerifiedToFirestore = async (uid?: string, verified = true) => {
    const targetUid = uid || auth.currentUser?.uid;
    if (!targetUid) return;
    try {
      await setDoc(
        doc(db, 'users', targetUid),
        {
          emailVerified: verified,
          email: auth.currentUser?.email || undefined,
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      );
    } catch (err) {
      console.warn('[auth] Could not sync emailVerified to Firestore:', err);
    }
  };

  const signUp = async (email: string, password: string, fullName: string, phone: string) => {
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName: fullName });

      const nowIso = new Date().toISOString();
      const userDocData = {
        uid: cred.user.uid,
        name: fullName.trim(),
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        role: 'user',
        status: 'active',
        emailVerified: false,
        createdAt: nowIso,
        created_at: nowIso,
      };

      try {
        await setDoc(doc(db, 'users', cred.user.uid), userDocData, { merge: true });
      } catch (profileErr) {
        console.error('Failed to create user Firestore document on signup:', profileErr);
        try {
          await setDoc(doc(db, 'users', cred.user.uid), userDocData, { merge: true });
        } catch (retryErr) {
          console.error('Retry create user document also failed:', retryErr);
        }
      }

      // Send Firebase verification email
      try {
        await sendEmailVerification(cred.user, getActionCodeSettings('/verify-email'));
      } catch (vErr) {
        console.warn('sendEmailVerification on signup warning:', vErr);
      }

      setRawUser(cred.user);
      setUser({
        id: cred.user.uid,
        email: cred.user.email || email,
        emailVerified: false,
        user_metadata: { full_name: fullName, phone, role: 'user' },
      });
      return { error: null };
    } catch (err) {
      return { error: friendlyError(err) };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      setRawUser(cred.user);
      const mapped = await loadAuthUser(cred.user);
      setUser(mapped);

      // If user is verified in Firebase Auth, sync to Firestore
      if (cred.user.emailVerified) {
        syncEmailVerifiedToFirestore(cred.user.uid, true);
      }

      return { error: null, emailVerified: cred.user.emailVerified };
    } catch (err) {
      return { error: friendlyError(err) };
    }
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
    setRawUser(null);
    setUser(null);
  };

  const resetPassword = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email.trim(), getActionCodeSettings('/reset-password'));
      return { error: null };
    } catch (err) {
      // Account enumeration protection: never reveal whether account exists
      if (err && typeof err === 'object' && 'code' in err) {
        const code = (err as { code: string }).code;
        if (code === 'auth/user-not-found' || code === 'auth/invalid-email') {
          return { error: null };
        }
      }
      return { error: friendlyError(err) };
    }
  };

  const sendVerificationEmail = async () => {
    if (!auth.currentUser) return { error: 'No user is currently signed in.' };
    try {
      await sendEmailVerification(auth.currentUser, getActionCodeSettings('/verify-email'));
      return { error: null };
    } catch (err) {
      return { error: friendlyError(err) };
    }
  };

  const reloadUser = async () => {
    if (!auth.currentUser) return { verified: false };
    try {
      await auth.currentUser.reload();
      const refreshed = auth.currentUser;
      setRawUser(refreshed);
      const mapped = await loadAuthUser(refreshed);
      setUser(mapped);

      if (refreshed.emailVerified) {
        await syncEmailVerifiedToFirestore(refreshed.uid, true);
      }
      return { verified: Boolean(refreshed.emailVerified) };
    } catch (err) {
      console.warn('[auth] reloadUser failed:', err);
      return { verified: false };
    }
  };

  const changeEmail = async (newEmail: string, currentPassword: string) => {
    const current = auth.currentUser;
    if (!current || !current.email) {
      return { error: 'You must be signed in to change your email.' };
    }
    try {
      // 1. Reauthenticate with current credentials
      const credential = EmailAuthProvider.credential(current.email, currentPassword);
      await reauthenticateWithCredential(current, credential);

      // 2. Trigger email verification link to new email address
      await verifyBeforeUpdateEmail(
        current,
        newEmail.trim().toLowerCase(),
        getActionCodeSettings('/profile'),
      );
      return { error: null };
    } catch (err) {
      return { error: friendlyError(err) };
    }
  };

  const verifyResetCode = async (oobCode: string) => {
    try {
      const email = await verifyPasswordResetCode(auth, oobCode);
      return { email, error: null };
    } catch (err) {
      return { email: null, error: friendlyError(err) };
    }
  };

  const confirmResetPassword = async (oobCode: string, newPassword: string) => {
    try {
      await confirmPasswordReset(auth, oobCode, newPassword);
      return { error: null };
    } catch (err) {
      return { error: friendlyError(err) };
    }
  };

  const applyAction = async (oobCode: string) => {
    try {
      await applyActionCode(auth, oobCode);
      if (auth.currentUser) {
        await auth.currentUser.reload();
        setRawUser(auth.currentUser);
        const mapped = await loadAuthUser(auth.currentUser);
        setUser(mapped);
        await syncEmailVerifiedToFirestore(auth.currentUser.uid, auth.currentUser.emailVerified);
      }
      return { error: null };
    } catch (err) {
      return { error: friendlyError(err) };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        rawUser,
        loading,
        signUp,
        signIn,
        signOut,
        resetPassword,
        sendVerificationEmail,
        reloadUser,
        changeEmail,
        verifyResetCode,
        confirmResetPassword,
        applyAction,
        syncEmailVerifiedToFirestore,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
