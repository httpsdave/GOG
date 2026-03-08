import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-[#080c14] flex flex-col">
      {/* Subtle background pattern */}
      <div className="fixed inset-0 opacity-[0.03]" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
      }} />

      <main className="relative flex-1 flex items-center justify-center px-4 py-12">
        <div className="text-center max-w-3xl mx-auto">
          {/* Decorative top element */}
          <div className="mb-6">
            <div className="flex items-center justify-center gap-4 mb-4">
              <div className="h-px w-16 bg-gradient-to-r from-transparent to-[#c8a951]/60" />
              <span className="text-[#c8a951]/80 text-xs tracking-[0.4em] uppercase font-medium">
                The Classic Filipino Strategy Game
              </span>
              <div className="h-px w-16 bg-gradient-to-l from-transparent to-[#c8a951]/60" />
            </div>
          </div>

          {/* Title */}
          <h1 className="font-display text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold text-white mb-3 tracking-tight leading-[1.1]">
            GAME OF THE
            <br />
            <span className="text-[#c8a951]">GENERALS</span>
          </h1>

          <p className="text-[#c8a951]/60 text-lg sm:text-xl tracking-[0.25em] uppercase font-medium mb-8">
            ━━━ Salpakan ━━━
          </p>

          <p className="text-[#8a9ab5] text-base sm:text-lg mb-12 max-w-lg mx-auto leading-relaxed">
            A game of hidden ranks, tactical deception, and battlefield supremacy.
            Outwit your opponent — capture the flag or infiltrate the back rank.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Link
              href="/play"
              className="group relative px-10 py-4 bg-[#c8a951] text-[#0a0f1a] rounded-lg font-bold text-lg hover:bg-[#d4b85c] transition-all shadow-lg shadow-[#c8a951]/20 hover:shadow-[#c8a951]/30 hover:scale-[1.02] active:scale-[0.98]"
            >
              <span className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><polygon points="5,3 19,10 5,17" /></svg>
                Play Now
              </span>
            </Link>
            <Link
              href="/rules"
              className="px-10 py-4 border-2 border-[#1e2d4a] text-[#8a9ab5] rounded-lg font-semibold text-lg hover:border-[#c8a951]/50 hover:text-[#c8a951] transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              Rules &amp; Strategy
            </Link>
          </div>

          {/* Feature Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-3xl mx-auto">
            <div className="bg-[#0d1520]/80 border border-[#1a2744] rounded-xl p-6 text-left hover:border-[#c8a951]/30 transition-colors">
              <div className="text-[#c8a951] text-2xl mb-3">🎭</div>
              <h3 className="text-white font-bold text-base mb-2">Hidden Information</h3>
              <p className="text-[#6b7e9a] text-sm leading-relaxed">
                Your opponent cannot see your pieces. Use bluffs, deception, and superior positioning to gain the edge.
              </p>
            </div>

            <div className="bg-[#0d1520]/80 border border-[#1a2744] rounded-xl p-6 text-left hover:border-[#c8a951]/30 transition-colors">
              <div className="text-[#c8a951] text-2xl mb-3">⚖️</div>
              <h3 className="text-white font-bold text-base mb-2">The Arbiter</h3>
              <p className="text-[#6b7e9a] text-sm leading-relaxed">
                A neutral judge resolves every battle. Ranks are revealed only in combat — keeping both players in the dark.
              </p>
            </div>

            <div className="bg-[#0d1520]/80 border border-[#1a2744] rounded-xl p-6 text-left hover:border-[#c8a951]/30 transition-colors">
              <div className="text-[#c8a951] text-2xl mb-3">⚔️</div>
              <h3 className="text-white font-bold text-base mb-2">21 Pieces, 15 Ranks</h3>
              <p className="text-[#6b7e9a] text-sm leading-relaxed">
                From the 5-Star General to the humble Private. Special Spy rules, flag mechanics, and elimination create deep strategy.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative text-center py-8 border-t border-[#111b2e]">
        <p className="text-[#2a3a5c] text-sm">
          A Filipino classic, reimagined for the digital battlefield.
        </p>
      </footer>
    </div>
  );
}

