'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithRedirect,
  getRedirectResult,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signOut,
  multiFactor,
  TotpMultiFactorGenerator,
  TotpSecret,
  getMultiFactorResolver,
  MultiFactorResolver,
  MultiFactorError,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, googleProvider } from '@/lib/firebase';

interface UserProfile {
  uid: string;
  username: string;
  email: string;
  elo: number;
  wins: number;
  losses: number;
  draws: number;
  createdAt: unknown;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, username: string) => Promise<void>;
  logout: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
  authError: string | null;
  // 2FA
  enrollTotp: () => Promise<TotpSecret | null>;
  verifyTotpEnrollment: (secret: TotpSecret, code: string) => Promise<boolean>;
  resolveMfa: (resolver: MultiFactorResolver, code: string) => Promise<void>;
  mfaResolver: MultiFactorResolver | null;
  mfaError: string | null;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

async function ensureUserProfile(user: User, username?: string): Promise<UserProfile> {
  const ref = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return snap.data() as UserProfile;

  const profile: UserProfile = {
    uid: user.uid,
    username: username || user.displayName || user.email?.split('@')[0] || 'Player',
    email: user.email || '',
    elo: 1200,
    wins: 0,
    losses: 0,
    draws: 0,
    createdAt: serverTimestamp(),
  };
  await setDoc(ref, profile);
  return profile;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [mfaResolver, setMfaResolver] = useState<MultiFactorResolver | null>(null);
  const [mfaError, setMfaError] = useState<string | null>(null);

  const handleMfaError = (err: unknown) => {
    const error = err as MultiFactorError;
    if (error.code === 'auth/multi-factor-auth-required') {
      const resolver = getMultiFactorResolver(auth, error);
      setMfaResolver(resolver);
      setMfaError('Please enter your 2FA code');
      return true;
    }
    return false;
  };

  useEffect(() => {
    // Handle redirect result from Google sign-in on return from Google's OAuth page
    getRedirectResult(auth)
      .then(async (result) => {
        if (result?.user) {
          setAuthError(null);
          try {
            await ensureUserProfile(result.user);
          } catch (err: unknown) {
            const e = err as { message?: string };
            setAuthError(e.message ? `Signed in, but profile setup failed: ${e.message}` : 'Signed in, but profile setup failed');
          }
        }
      })
      .catch((err: unknown) => {
        if (!handleMfaError(err)) {
          const e = err as { code?: string; message?: string };
          setAuthError(e.code ? `${e.code}: ${e.message || ''}`.trim() : 'Google sign-in redirect failed');
        }
      });

    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        try {
          setAuthError(null);
          const p = await ensureUserProfile(u);
          setProfile(p);
        } catch (err: unknown) {
          // Keep auth state usable even if Firestore profile reads/writes fail.
          setProfile(null);
          const e = err as { message?: string };
          setAuthError(e.message ? `Signed in, but profile load failed: ${e.message}` : 'Signed in, but profile load failed');
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsub;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signInWithGoogle = async () => {
    setAuthError(null);
    await signInWithRedirect(auth, googleProvider);
    // Page will navigate away; result is handled in useEffect via getRedirectResult
  };

  const signInWithEmail = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      if (!handleMfaError(err)) throw err;
    }
  };

  const signUpWithEmail = async (email: string, password: string, username: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await sendEmailVerification(cred.user);
    await ensureUserProfile(cred.user, username);
  };

  const logout = async () => {
    await signOut(auth);
    setProfile(null);
    setAuthError(null);
    setMfaResolver(null);
    setMfaError(null);
  };

  const getIdToken = async () => {
    if (!user) return null;
    return user.getIdToken();
  };

  const enrollTotp = async (): Promise<TotpSecret | null> => {
    if (!user) return null;
    const session = await multiFactor(user).getSession();
    const secret = await TotpMultiFactorGenerator.generateSecret(session);
    return secret;
  };

  const verifyTotpEnrollment = async (secret: TotpSecret, code: string): Promise<boolean> => {
    if (!user) return false;
    try {
      const assertion = TotpMultiFactorGenerator.assertionForEnrollment(secret, code);
      await multiFactor(user).enroll(assertion, 'TOTP 2FA');
      return true;
    } catch {
      return false;
    }
  };

  const resolveMfa = async (resolver: MultiFactorResolver, code: string) => {
    const hint = resolver.hints.find(h => h.factorId === TotpMultiFactorGenerator.FACTOR_ID);
    if (!hint) throw new Error('No TOTP hint found');
    const assertion = TotpMultiFactorGenerator.assertionForSignIn(hint.uid, code);
    await resolver.resolveSignIn(assertion);
    setMfaResolver(null);
    setMfaError(null);
  };

  return (
    <AuthContext.Provider value={{
      user, profile, loading,
      authError,
      signInWithGoogle, signInWithEmail, signUpWithEmail, logout, getIdToken,
      enrollTotp, verifyTotpEnrollment, resolveMfa,
      mfaResolver, mfaError,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
