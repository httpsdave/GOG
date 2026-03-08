import Link from 'next/link';

const PIECE_DATA = [
  { name: '5-Star General', icon: '/icons/5star.jpg', count: 1, power: 14, desc: 'Highest-ranking officer. Eliminates all except the Spy.' },
  { name: '4-Star General', icon: '/icons/4star.png', count: 1, power: 13, desc: 'Second highest rank. Vulnerable to Spy.' },
  { name: '3-Star General', icon: '/icons/3star.png', count: 1, power: 12, desc: 'Senior general.' },
  { name: '2-Star General', icon: '/icons/2star.png', count: 1, power: 11, desc: 'Mid-level general.' },
  { name: '1-Star General', icon: '/icons/1star.png', count: 1, power: 10, desc: 'Junior general.' },
  { name: 'Colonel', icon: '/icons/colonel.png', count: 1, power: 9, desc: 'Senior field officer.' },
  { name: 'Lt. Colonel', icon: '/icons/ltcolonel.png', count: 1, power: 8, desc: 'Field officer.' },
  { name: 'Major', icon: '/icons/major.png', count: 1, power: 7, desc: 'Field officer.' },
  { name: 'Captain', icon: '/icons/captain.png', count: 1, power: 6, desc: 'Company commander.' },
  { name: '1st Lieutenant', icon: '/icons/1stlieutenant.png', count: 1, power: 5, desc: 'Junior officer.' },
  { name: '2nd Lieutenant', icon: '/icons/2ndlieutenant.png', count: 1, power: 4, desc: 'Lowest-ranking officer.' },
  { name: 'Sergeant', icon: '/icons/sargeant.png', count: 1, power: 3, desc: 'Senior enlisted.' },
  { name: 'Private', icon: '/icons/private.png', count: 6, power: 2, desc: 'Basic soldier. Can eliminate the Spy!' },
  { name: 'Spy', icon: '/icons/spy.png', count: 2, power: '★', desc: 'Eliminates any officer. Eliminated by Private.' },
  { name: 'Flag', icon: '/icons/flag.png', count: 1, power: 0, desc: 'Your most important piece. Lose it and you lose.' },
];

export default function RulesPage() {
  return (
    <div className="min-h-screen bg-[#080c14]">
      {/* Header */}
      <header className="border-b border-[#111b2e]">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-[#8a9ab5] hover:text-[#c8a951] transition-colors text-sm font-medium flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            Back to Home
          </Link>
          <Link href="/play" className="px-4 py-2 bg-[#c8a951] text-[#0a0f1a] rounded-lg text-sm font-bold hover:bg-[#d4b85c] transition-colors">
            Play Now
          </Link>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Title */}
        <h1 className="font-display text-4xl sm:text-5xl font-bold text-[#c8a951] mb-2">
          Rules &amp; Strategy
        </h1>
        <p className="text-[#6b7e9a] text-lg mb-12">
          Master the Game of the Generals (Salpakan)
        </p>

        {/* Objective */}
        <Section title="Objective">
          <p className="text-[#b0bdd0] leading-relaxed mb-3">
            The Game of the Generals is a two-player strategy board game invented in the Philippines. The goal is to:
          </p>
          <ul className="space-y-2 text-[#b0bdd0]">
            <li className="flex items-start gap-2">
              <span className="text-[#c8a951] mt-1">▸</span>
              <span><strong className="text-white">Capture the opponent&apos;s Flag</strong> — Move any of your pieces onto the square occupied by the enemy Flag.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#c8a951] mt-1">▸</span>
              <span><strong className="text-white">Maneuver your Flag to the enemy&apos;s back rank</strong> — Move your Flag to the row closest to them without being challenged by an adjacent enemy.</span>
            </li>
          </ul>
        </Section>

        {/* The Board */}
        <Section title="The Board">
          <p className="text-[#b0bdd0] leading-relaxed mb-3">
            The board is a grid of <strong className="text-white">9 columns (A–I) × 8 rows</strong>. Each player occupies one side.
          </p>
          <p className="text-[#b0bdd0] leading-relaxed">
            During setup, each player arranges their 21 pieces in the <strong className="text-white">3 rows closest to them</strong> (27 available squares).
            Arrangement is done secretly — the opponent cannot see how your pieces are positioned.
          </p>
        </Section>

        {/* The Arbiter */}
        <Section title="The Arbiter">
          <div className="bg-[#0d1520] border border-[#1a2744] rounded-xl p-6 mb-4">
            <div className="flex items-start gap-4">
              <div className="text-3xl flex-shrink-0">⚖️</div>
              <div>
                <h3 className="text-white font-bold text-lg mb-2">The Neutral Judge</h3>
                <p className="text-[#b0bdd0] leading-relaxed mb-3">
                  In the traditional board game, a <strong className="text-white">third person acts as the Arbiter</strong> — 
                  sitting at the end of the board. When two pieces meet in combat, both players reveal their piece 
                  <em> only to the Arbiter</em>. The Arbiter then determines the winner based on rank, removes the 
                  losing piece, and the game continues — neither player knows the rank of the other&apos;s surviving pieces.
                </p>
                <p className="text-[#b0bdd0] leading-relaxed">
                  In this digital version, the <strong className="text-white">computer acts as the Arbiter</strong>, 
                  automatically resolving all challenges fairly and invisibly. This preserves the hidden information 
                  that makes the game so strategic.
                </p>
              </div>
            </div>
          </div>
        </Section>

        {/* Pieces */}
        <Section title="The Pieces (Rank Hierarchy)">
          <p className="text-[#b0bdd0] leading-relaxed mb-6">
            Each player has <strong className="text-white">21 pieces</strong> of <strong className="text-white">15 different ranks</strong>. 
            Higher-ranked pieces eliminate lower-ranked ones in combat, with special exceptions for the Spy.
          </p>

          <div className="space-y-2">
            {PIECE_DATA.map((piece, i) => (
              <div key={i} className="flex items-center gap-4 bg-[#0d1520]/60 border border-[#141e32] rounded-lg px-4 py-3 hover:border-[#1e2d4a] transition-colors">
                <div className="w-10 flex-shrink-0 text-center">
                  <span className="text-[#c8a951] font-mono font-bold text-sm">
                    {typeof piece.power === 'number' ? `#${piece.power}` : piece.power}
                  </span>
                </div>
                <div
                  className="w-12 h-9 flex-shrink-0 rounded border border-[#2a3a5c] overflow-hidden"
                  style={{
                    backgroundImage: `url(${piece.icon})`,
                    backgroundSize: '200% 100%',
                    backgroundPosition: '100% 0',
                    backgroundRepeat: 'no-repeat',
                  }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-semibold text-sm">{piece.name}</span>
                    <span className="text-[#4a5a72] text-xs">×{piece.count}</span>
                  </div>
                  <p className="text-[#6b7e9a] text-xs mt-0.5">{piece.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* Movement */}
        <Section title="Movement">
          <ul className="space-y-2 text-[#b0bdd0]">
            <li className="flex items-start gap-2">
              <span className="text-[#c8a951] mt-1">▸</span>
              <span>Pieces move <strong className="text-white">one square at a time</strong> — up, down, left, or right (no diagonal movement).</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#c8a951] mt-1">▸</span>
              <span>You <strong className="text-white">cannot move onto a square occupied by your own piece</strong>.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#c8a951] mt-1">▸</span>
              <span>Moving onto a square occupied by an <strong className="text-white">enemy piece triggers a challenge</strong> (combat).</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#c8a951] mt-1">▸</span>
              <span>Players <strong className="text-white">alternate turns</strong>. White moves first.</span>
            </li>
          </ul>
        </Section>

        {/* Challenges */}
        <Section title="Challenges (Combat)">
          <p className="text-[#b0bdd0] leading-relaxed mb-4">
            When a piece moves onto a square with an enemy piece, the Arbiter compares ranks:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <RuleCard title="Higher Rank Wins" color="#c8a951">
              The lower-ranked piece is removed. The winner stays on the square.
            </RuleCard>
            <RuleCard title="Equal Ranks" color="#6b7e9a">
              Both pieces are removed from the board.
            </RuleCard>
            <RuleCard title="Spy vs Officers" color="#e06050">
              The Spy eliminates any officer (from 2nd Lieutenant up to 5-Star General).
              But the <strong>Private eliminates the Spy</strong>.
            </RuleCard>
            <RuleCard title="Flag Captured" color="#50b060">
              Any piece that challenges the Flag captures it — the capturing player wins the game immediately.
            </RuleCard>
          </div>
        </Section>

        {/* Winning */}
        <Section title="How to Win">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-[#0d1520] border border-[#1a2744] rounded-xl p-5">
              <h3 className="text-[#c8a951] font-bold mb-2 flex items-center gap-2">
                <span>🏴</span> Capture the Flag
              </h3>
              <p className="text-[#b0bdd0] text-sm leading-relaxed">
                Move any of your pieces onto the enemy&apos;s Flag. This immediately ends the game.
              </p>
            </div>
            <div className="bg-[#0d1520] border border-[#1a2744] rounded-xl p-5">
              <h3 className="text-[#c8a951] font-bold mb-2 flex items-center gap-2">
                <span>🚩</span> Flag to Back Rank
              </h3>
              <p className="text-[#b0bdd0] text-sm leading-relaxed">
                Maneuver your Flag to the opponent&apos;s back row. If no adjacent enemy piece can challenge it, you win.
                If an enemy is adjacent, your Flag must survive one full turn.
              </p>
            </div>
          </div>
        </Section>

        {/* Strategy Tips */}
        <Section title="Strategy Tips">
          <ul className="space-y-2 text-[#b0bdd0]">
            <li className="flex items-start gap-2">
              <span className="text-[#c8a951] mt-1">▸</span>
              <span><strong className="text-white">Protect your Flag</strong> — Surround it with strong pieces, but don&apos;t make its position obvious.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#c8a951] mt-1">▸</span>
              <span><strong className="text-white">Use Spies wisely</strong> — They can eliminate any general, but are vulnerable to Privates.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#c8a951] mt-1">▸</span>
              <span><strong className="text-white">Bluff aggressively</strong> — Move low-ranked pieces forward confidently to deceive your opponent.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#c8a951] mt-1">▸</span>
              <span><strong className="text-white">Control the flanks</strong> — The edges of the board can provide safe passage for your Flag.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#c8a951] mt-1">▸</span>
              <span><strong className="text-white">Track eliminated pieces</strong> — If you know the opponent&apos;s Spy is gone, your generals can move freely.</span>
            </li>
          </ul>
        </Section>

        {/* Back to play */}
        <div className="mt-16 text-center">
          <Link href="/play" className="inline-flex items-center gap-2 px-8 py-4 bg-[#c8a951] text-[#0a0f1a] rounded-lg font-bold text-lg hover:bg-[#d4b85c] transition-all shadow-lg shadow-[#c8a951]/20">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><polygon points="5,3 19,10 5,17" /></svg>
            Ready to Play
          </Link>
        </div>
      </div>

      {/* Footer */}
      <footer className="text-center py-8 border-t border-[#111b2e]">
        <p className="text-[#2a3a5c] text-sm">Game of the Generals — Salpakan</p>
      </footer>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-12">
      <h2 className="text-2xl font-bold text-white mb-4 pb-2 border-b border-[#141e32] flex items-center gap-3">
        <div className="w-1 h-6 bg-[#c8a951] rounded-full" />
        {title}
      </h2>
      {children}
    </section>
  );
}

function RuleCard({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#0d1520]/60 border border-[#141e32] rounded-lg p-4">
      <h4 className="font-bold text-sm mb-1" style={{ color }}>{title}</h4>
      <p className="text-[#8a9ab5] text-sm leading-relaxed">{children}</p>
    </div>
  );
}
