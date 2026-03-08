# Game of the Generals  Salpakan

> *"A game born from the battlefield, designed to outlast it."*

---

## What It Is

**Game of the Generals** (locally known as *Salpakan*) is a two-player Philippine strategy board game invented by **Sofronio Pasola Jr.** in 1970. It is played on a 98 grid with 21 pieces per side, each bearing a military rank  from the humble Private to the five-star General, with two Spies and the Flag.

The defining mechanic is **hidden information**: your opponent cannot see your pieces' ranks. When two pieces meet in combat, only a neutral third party  the *Arbiter*  decides the outcome in secret. Neither player ever learns what rank the surviving piece holds. Bluffing, misdirection, and psychological warfare are not just valid tactics  they are the core of the game.

---

## Why It Matters

Salpakan is one of the few **homegrown Filipino board games** to achieve genuine national recognition. It was officially endorsed by the Philippine government, introduced into schools during the 1970s80s, and remains a meaningful artifact of Philippine intellectual heritage.

Yet outside the Philippines, it is almost entirely unknown. Even within the country, the physical board game has quietly faded  displaced by video games and the internet, rarely found in stores, and never given a polished digital form worthy of its depth.

This project exists to change that.

---

## What This Project Does

A faithful, fully playable digital adaptation of Salpakan  built for the web with modern tooling. No accounts, no installs. Just open a browser and play.

- **vs Computer**  A fully functional AI opponent using rank-aware evaluation
- **Hidden information preserved**  The Arbiter resolves every challenge; neither player sees the losing piece's rank
- **Flag mechanics**  Both capture-the-flag and back-rank infiltration win conditions
- **21 pieces, 15 ranks**  Complete piece hierarchy including Spy inversion rules
- **Drag-and-drop setup**  Deploy your forces before battle begins
- **Move history & eliminated pieces**  Full game record per session
- **Board themes**  Old Map, Modern, Jungle Ops, Night Ops
- **Online multiplayer** *(in development)*  ELO ratings, matchmaking, arbiter mode

---

## The Pieces

| Rank | Count | Special Rule |
|---|---|---|
| 5-Star General | 1 | Eliminated only by the Spy |
| 4-Star  2nd Lt | 9 | Higher rank always wins |
| Sergeant | 1 |  |
| Private | 6 | Eliminates the Spy |
| Spy | 2 | Eliminates any officer; loses to Private |
| Flag | 1 | Losing it loses the game |

---

## Running Locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

---

## Tech Stack

- **Next.js 16** + **React 19** + **TypeScript**
- **Tailwind CSS v4**
- **Socket.io** (multiplayer server, `server/`)

---

*GOG  a Filipino classic, reimagined for the digital battlefield.*
