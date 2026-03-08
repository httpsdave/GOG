'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { connectSocket, disconnectSocket } from '@/lib/socket';

interface LeaderboardEntry {
  uid: string;
  username: string;
  elo: number;
  wins: number;
  losses: number;
  draws: number;
}

export default function LeaderboardPage() {
  const { user, profile } = useAuth();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const s = connectSocket();
    s.emit('getLeaderboard' as never, { limit: 50, offset: 0 } as never);

    s.on('leaderboard' as never, ((data: { players: LeaderboardEntry[] }) => {
      setEntries(data.players);
      setLoading(false);
    }) as never);

    return () => {
      disconnectSocket();
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#080c14] flex flex-col">
      <div className="fixed inset-0 opacity-[0.03] pointer-events-none" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
      }} />

      <header className="relative border-b border-[#111b2e]">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/play" className="text-[#8a9ab5] hover:text-[#c8a951] transition-colors text-sm font-medium flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            Back
          </Link>
          <div className="flex items-center gap-4">
            {user && (
              <Link href="/profile" className="text-[#8a9ab5] hover:text-[#c8a951] transition-colors text-sm font-medium">Profile</Link>
            )}
          </div>
        </div>
      </header>

      <main className="relative flex-1 max-w-2xl mx-auto w-full px-4 py-8">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-4 mb-4">
            <div className="h-px w-12 bg-gradient-to-r from-transparent to-[#c8a951]/60" />
            <span className="text-[#c8a951]/80 text-xs tracking-[0.3em] uppercase font-medium">Rankings</span>
            <div className="h-px w-12 bg-gradient-to-l from-transparent to-[#c8a951]/60" />
          </div>
          <h2 className="text-3xl font-bold text-white font-display mb-2">Leaderboard</h2>
          <p className="text-[#6b7e9a] text-sm">Top ranked players</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 rounded-full border-2 border-transparent border-t-[#c8a951] animate-spin" />
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-[#6b7e9a] text-lg">No players ranked yet</p>
            <p className="text-[#4a5a72] text-sm mt-1">Play a ranked match to appear here!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {entries.map((entry, i) => {
              const isMe = user?.uid === entry.uid;
              const totalGames = entry.wins + entry.losses + entry.draws;
              const winRate = totalGames > 0 ? Math.round((entry.wins / totalGames) * 100) : 0;

              return (
                <div
                  key={entry.uid}
                  className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${
                    isMe
                      ? 'bg-[#c8a951]/10 border-[#c8a951]/30'
                      : 'bg-[#0d1520]/80 border-[#1a2744] hover:border-[#2a3a5c]'
                  }`}
                >
                  {/* Rank */}
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold ${
                    i === 0 ? 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-black' :
                    i === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-500 text-black' :
                    i === 2 ? 'bg-gradient-to-br from-orange-400 to-orange-600 text-black' :
                    'bg-[#111b2e] text-[#6b7e9a]'
                  }`}>
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                  </div>

                  {/* Name */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`font-bold truncate ${isMe ? 'text-[#c8a951]' : 'text-white'}`}>{entry.username}</span>
                      {isMe && <span className="text-[10px] bg-[#c8a951]/20 text-[#c8a951] px-1.5 py-0.5 rounded-full uppercase tracking-wider">You</span>}
                    </div>
                    <div className="text-[#6b7e9a] text-xs mt-0.5">
                      {entry.wins}W {entry.losses}L {entry.draws}D &bull; {winRate}% win rate
                    </div>
                  </div>

                  {/* ELO */}
                  <div className="text-right">
                    <div className="text-white font-bold text-lg">{entry.elo}</div>
                    <div className="text-[#6b7e9a] text-[10px] uppercase tracking-wider">ELO</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Current user rank if not in top list */}
        {user && profile && !entries.find(e => e.uid === user.uid) && (
          <div className="mt-6 p-4 bg-[#c8a951]/10 border border-[#c8a951]/30 rounded-xl">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-[#111b2e] flex items-center justify-center text-[#6b7e9a] text-sm font-bold">—</div>
              <div className="flex-1">
                <span className="text-[#c8a951] font-bold">{profile.username}</span>
                <span className="text-[10px] bg-[#c8a951]/20 text-[#c8a951] px-1.5 py-0.5 rounded-full uppercase tracking-wider ml-2">You</span>
                <div className="text-[#6b7e9a] text-xs mt-0.5">{profile.wins ?? 0}W {profile.losses ?? 0}L {profile.draws ?? 0}D</div>
              </div>
              <div className="text-right">
                <div className="text-white font-bold text-lg">{profile.elo}</div>
                <div className="text-[#6b7e9a] text-[10px] uppercase tracking-wider">ELO</div>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="relative text-center py-6 border-t border-[#111b2e]">
        <p className="text-[#2a3a5c] text-sm">Game of the Generals — Salpakan</p>
      </footer>
    </div>
  );
}
