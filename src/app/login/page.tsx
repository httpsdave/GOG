'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';

export default function LoginPage() {
  const { user, signInWithGoogle, signInWithEmail, mfaResolver, resolveMfa, mfaError } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (user) {
    router.push('/play');
    return null;
  }

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signInWithEmail(email, password);
      router.push('/play');
    } catch (err: unknown) {
      const firebaseErr = err as { code?: string };
      if (firebaseErr.code === 'auth/multi-factor-auth-required') return;
      setError('Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    // signInWithRedirect navigates the page away to Google;
    // on return, getRedirectResult in AuthProvider handles the result
    // and onAuthStateChanged will fire, which redirects to /play via the user check above.
    await signInWithGoogle();
  };

  const handleMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaResolver) return;
    setLoading(true);
    try {
      await resolveMfa(mfaResolver, mfaCode);
      router.push('/play');
    } catch {
      setError('Invalid 2FA code');
    } finally {
      setLoading(false);
    }
  };

  if (mfaResolver) {
    return (
      <div className="min-h-screen bg-[#080c14] flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-[#0d1520] border border-[#1a2535] rounded-xl p-8">
          <h1 className="font-display text-2xl text-white mb-2 text-center">Two-Factor Authentication</h1>
          <p className="text-[#8a9ab5] text-sm text-center mb-6">{mfaError || 'Enter your authenticator code'}</p>
          <form onSubmit={handleMfa} className="space-y-4">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={mfaCode}
              onChange={e => setMfaCode(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              className="w-full px-4 py-3 bg-[#111927] border border-[#1a2535] rounded-lg text-white text-center text-2xl tracking-[0.5em] focus:border-[#c8a951] focus:outline-none"
              autoFocus
            />
            {error && <p className="text-red-400 text-sm text-center">{error}</p>}
            <button
              type="submit"
              disabled={loading || mfaCode.length !== 6}
              className="w-full py-3 bg-[#c8a951] text-[#0a0f1a] rounded-lg font-bold hover:bg-[#d4b85c] transition-colors disabled:opacity-50"
            >
              {loading ? 'Verifying...' : 'Verify'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080c14] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-block">
            <h1 className="font-display text-3xl text-white">GAME OF THE <span className="text-[#c8a951]">GENERALS</span></h1>
          </Link>
          <p className="text-[#8a9ab5] text-sm mt-2">Sign in to play ranked matches</p>
        </div>

        <div className="bg-[#0d1520] border border-[#1a2535] rounded-xl p-8 space-y-6">
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full py-3 bg-white text-gray-800 rounded-lg font-semibold hover:bg-gray-100 transition-colors flex items-center justify-center gap-3 disabled:opacity-50"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-[#1a2535]" />
            <span className="text-[#5a6a7d] text-xs uppercase tracking-wider">or</span>
            <div className="h-px flex-1 bg-[#1a2535]" />
          </div>

          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div>
              <label className="block text-[#8a9ab5] text-sm mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 bg-[#111927] border border-[#1a2535] rounded-lg text-white focus:border-[#c8a951] focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-[#8a9ab5] text-sm mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 bg-[#111927] border border-[#1a2535] rounded-lg text-white focus:border-[#c8a951] focus:outline-none"
                required
              />
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[#c8a951] text-[#0a0f1a] rounded-lg font-bold hover:bg-[#d4b85c] transition-colors disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-[#5a6a7d] text-sm">
            {"Don't have an account? "}
            <Link href="/signup" className="text-[#c8a951] hover:text-[#d4b85c]">Sign up</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
