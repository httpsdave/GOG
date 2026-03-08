'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';

export default function SignupPage() {
  const { user, loading: authLoading, signUpWithEmail, signInWithGoogle } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      router.push('/play');
    }
  }, [user, router]);

  if (authLoading || user) {
    return (
      <div className="min-h-screen bg-[#080c14] flex items-center justify-center">
        <div className="text-[#c8a951] text-lg animate-pulse">Loading...</div>
      </div>
    );
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    const sanitized = username.replace(/[^a-zA-Z0-9_-]/g, '');
    if (sanitized.length < 3 || sanitized.length > 20) {
      setError('Username must be 3-20 characters (letters, numbers, _ -)');
      return;
    }

    setLoading(true);
    try {
      await signUpWithEmail(email, password, sanitized);
      setSuccess('Account created! Please check your email for verification, then sign in.');
    } catch (err: unknown) {
      const firebaseErr = err as { code?: string };
      if (firebaseErr.code === 'auth/email-already-in-use') {
        setError('Email already in use');
      } else if (firebaseErr.code === 'auth/weak-password') {
        setError('Password is too weak');
      } else {
        setError('Failed to create account');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    setError('');
    setLoading(true);
    try {
      await signInWithGoogle();
      router.push('/play');
    } catch {
      setError('Google sign-in failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#080c14] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-block">
            <h1 className="font-display text-3xl text-white">GAME OF THE <span className="text-[#c8a951]">GENERALS</span></h1>
          </Link>
          <p className="text-[#8a9ab5] text-sm mt-2">Create an account to play ranked matches</p>
        </div>

        <div className="bg-[#0d1520] border border-[#1a2535] rounded-xl p-8 space-y-6">
          <button
            onClick={handleGoogleSignup}
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

          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <label className="block text-[#8a9ab5] text-sm mb-1.5">Username</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="w-full px-4 py-2.5 bg-[#111927] border border-[#1a2535] rounded-lg text-white focus:border-[#c8a951] focus:outline-none"
                placeholder="3-20 characters"
                required
              />
            </div>
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
                placeholder="At least 8 characters"
                required
              />
            </div>
            <div>
              <label className="block text-[#8a9ab5] text-sm mb-1.5">Confirm password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-2.5 bg-[#111927] border border-[#1a2535] rounded-lg text-white focus:border-[#c8a951] focus:outline-none"
                required
              />
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            {success && <p className="text-green-400 text-sm">{success}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[#c8a951] text-[#0a0f1a] rounded-lg font-bold hover:bg-[#d4b85c] transition-colors disabled:opacity-50"
            >
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          <p className="text-center text-[#5a6a7d] text-sm">
            Already have an account?{' '}
            <Link href="/login" className="text-[#c8a951] hover:text-[#d4b85c]">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
