import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
  type User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase';

export interface AuthUserMetadata {
  full_name?: string;
  phone?: string;
  role?: 'user' | 'admin';
}

/**
 * App-facing user shape. Mirrors the previous backend's user model
 * (`id` + `email` + `user_metadata`) so consuming components
 * (Header, AdminLayout, App router) keep working unchanged.
 */
export interface AuthUser {
  id: string;
  email: string;
  user_metadata: AuthUserMetadata;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName: string, phone: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
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
  'auth/weak-password': 'Password should be at least 6 characters.',
  'auth/user-not-found': 'No account found with this email.',
  'auth/wrong-password': 'Incorrect email or password.',
  'auth/invalid-credential': 'Incorrect email or password.',
  'auth/too-many-requests': 'Too many attempts. Please try again later.',
  'auth/network-request-failed': 'Network error. Please check your connection.',
};

function friendlyError(err: unknown): string {
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
      metadata.full_name = (d.full_name as string) || metadata.full_name;
      metadata.phone = (d.phone as string) || metadata.phone;
      metadata.role = ((d.role as AuthUserMetadata['role']) || 'user');
    }
  } catch {
    // profile lookup failed — fall back to auth-provider metadata only
  }
  return { id: fbUser.uid, email: fbUser.email || '', user_metadata: metadata };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) {
        if (active) {
          setUser(null);
          setLoading(false);
        }
        return;
      }
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

  const signUp = async (email: string, password: string, fullName: string, phone: string) => {
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName: fullName });
      // Persist profile; non-fatal so a rules/network issue doesn't block signup.
      try {
        await setDoc(doc(db, 'users', cred.user.uid), {
          full_name: fullName,
          email,
          phone,
          role: 'user',
          status: 'Active',
          created_at: new Date().toISOString(),
        });
      } catch (profileErr) {
        console.warn('Profile document write failed:', profileErr);
      }
      setUser({ id: cred.user.uid, email, user_metadata: { full_name: fullName, phone, role: 'user' } });
      return { error: null };
    } catch (err) {
      return { error: friendlyError(err) };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      return { error: null };
    } catch (err) {
      return { error: friendlyError(err) };
    }
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
  };

  const resetPassword = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
      return { error: null };
    } catch (err) {
      return { error: friendlyError(err) };
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signUp, signIn, signOut, resetPassword }}>
      {children}
    </AuthContext.Provider>
  );
}
