'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import type { TotpSecret } from 'firebase/auth';

export default function ProfilePage() {
  const { user, profile, logout, enrollTotp, verifyTotpEnrollment } = useAuth();
  const router = useRouter();
  const [totpSecret, setTotpSecret] = useState<TotpSecret | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [totpStatus, setTotpStatus] = useState<'idle' | 'enrolling' | 'success' | 'error'>('idle');
  const [totpMessage, setTotpMessage] = useState('');

  if (!user || !profile) {
    router.push('/login');
    return null;
  }

  const handleEnroll2FA = async () => {
    setTotpStatus('enrolling');
    const secret = await enrollTotp();
    if (secret) {
      setTotpSecret(secret);
    } else {
      setTotpStatus('error');
      setTotpMessage('Failed to generate 2FA secret');
    }
  };

  const handleVerify2FA = async () => {
    if (!totpSecret) return;
    const ok = await verifyTotpEnrollment(totpSecret, totpCode);
    if (ok) {
      setTotpStatus('success');
      setTotpMessage('2FA enabled successfully!');
      setTotpSecret(null);
    } else {
      setTotpStatus('error');
      setTotpMessage('Invalid code. Try again.');
    }
  };

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  const qrUrl = totpSecret
    ? totpSecret.generateQrCodeUrl(profile.email, 'Game of the Generals')
    : '';

  return (
    <div className="min-h-screen bg-[#080c14] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <Link href="/play" className="inline-block">
            <h1 className="font-display text-2xl text-white">GAME OF THE <span className="text-[#c8a951]">GENERALS</span></h1>
          </Link>
        </div>

        <div className="bg-[#0d1520] border border-[#1a2535] rounded-xl p-8 space-y-6">
          <h2 className="font-display text-xl text-white">Profile</h2>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-[#5a6a7d]">Username</span>
              <p className="text-white font-medium">{profile.username}</p>
            </div>
            <div>
              <span className="text-[#5a6a7d]">Email</span>
              <p className="text-white font-medium truncate">{profile.email}</p>
            </div>
            <div>
              <span className="text-[#5a6a7d]">Rating</span>
              <p className="text-[#c8a951] font-bold text-lg">{profile.elo}</p>
            </div>
            <div>
              <span className="text-[#5a6a7d]">Record</span>
              <p className="text-white font-medium">
                <span className="text-green-400">{profile.wins}W</span>
                {' / '}
                <span className="text-red-400">{profile.losses}L</span>
                {' / '}
                <span className="text-[#8a9ab5]">{profile.draws}D</span>
              </p>
            </div>
          </div>

          {!user.emailVerified && (
            <div className="bg-yellow-900/20 border border-yellow-600/30 rounded-lg px-4 py-3">
              <p className="text-yellow-400 text-sm">
                Email not verified. Check your inbox for a verification link.
              </p>
            </div>
          )}

          {/* 2FA Section */}
          <div className="border-t border-[#1a2535] pt-6 space-y-4">
            <h3 className="text-white font-semibold">Two-Factor Authentication</h3>

            {totpStatus === 'success' ? (
              <div className="bg-green-900/20 border border-green-600/30 rounded-lg px-4 py-3">
                <p className="text-green-400 text-sm">{totpMessage}</p>
              </div>
            ) : totpSecret ? (
              <div className="space-y-4">
                <p className="text-[#8a9ab5] text-sm">
                  Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.):
                </p>
                <div className="bg-white p-4 rounded-lg w-fit mx-auto">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrUrl)}`}
                    alt="2FA QR Code"
                    width={200}
                    height={200}
                  />
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={totpCode}
                    onChange={e => setTotpCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="Enter 6-digit code"
                    className="flex-1 px-4 py-2.5 bg-[#111927] border border-[#1a2535] rounded-lg text-white text-center tracking-wider focus:border-[#c8a951] focus:outline-none"
                  />
                  <button
                    onClick={handleVerify2FA}
                    disabled={totpCode.length !== 6}
                    className="px-6 py-2.5 bg-[#c8a951] text-[#0a0f1a] rounded-lg font-bold hover:bg-[#d4b85c] transition-colors disabled:opacity-50"
                  >
                    Verify
                  </button>
                </div>
                {totpStatus === 'error' && (
                  <p className="text-red-400 text-sm">{totpMessage}</p>
                )}
              </div>
            ) : (
              <button
                onClick={handleEnroll2FA}
                className="w-full py-2.5 bg-[#111927] border border-[#1a2535] rounded-lg text-[#8a9ab5] hover:text-white hover:border-[#c8a951]/50 transition-colors text-sm"
              >
                Enable 2FA (Authenticator App)
              </button>
            )}
          </div>

          <div className="border-t border-[#1a2535] pt-6 flex gap-3">
            <Link
              href="/play"
              className="flex-1 py-2.5 bg-[#c8a951] text-[#0a0f1a] rounded-lg font-bold hover:bg-[#d4b85c] transition-colors text-center"
            >
              Play
            </Link>
            <button
              onClick={handleLogout}
              className="flex-1 py-2.5 bg-[#111927] border border-[#1a2535] rounded-lg text-[#8a9ab5] hover:text-white transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
