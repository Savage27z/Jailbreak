# Jailbreak

**A gacha-style validator slashing-risk game built on live Cosmos Hub data.**

Pull validator cards, read their AI-scored risk tier, then bet play points on whether they'll stay clean or get jailed. Real staking data. Simulated stakes.

> Built for the Cosmos Hackathon 2026.

---

## How it works

1. **Pull a card** — tap a face-down validator. The app fetches live staking data from Cosmos Hub LCD endpoints.
2. **Read the verdict** — an AI scores slashing risk and assigns a rarity tier (common / rare / legendary).
3. **Stake your call** — pick a side (stays clean or gets jailed), set your play-point wager, and lock it in. Weighted odds resolve after a short animation.

## What's real vs simulated

| Layer | Source | Real? |
|-------|--------|-------|
| Validator data (moniker, stake, commission, jailed status) | Cosmos Hub LCD REST API | Yes |
| Network signing stats (avg missed blocks, tombstoned count) | `/cosmos/slashing/v1beta1/signing_infos` | Yes |
| Slashing parameters in AI prompt | [docs.cosmos.network/hub](https://docs.cosmos.network/hub/latest) | Yes |
| Risk scoring | AI (Llama 3.1 8B via OpenRouter) + deterministic fallback | Hybrid |
| Bet resolution (jailed/clean outcome) | Weighted random by tier | Simulated |
| Play points balance | Client-side session state | Simulated |

No wallet connection. No real funds. No on-chain transactions.

## Tech stack

- **Next.js 16** (App Router) + React 19 + TypeScript
- **Tailwind CSS v4** for utility classes
- **Cosmos Hub LCD API** — 3-endpoint fallback (Lavender Five, Ecostake, PublicNode)
- **OpenRouter** — free Llama 3.1 8B for AI risk scoring (with deterministic fallback)
- **CSS 3D transforms** — card flip animations with `preserve-3d`
- **Instrument Serif + Geist Sans/Mono** — typography pairing

Zero external runtime dependencies beyond Next.js.

## Run locally

```bash
git clone https://github.com/Savage27z/Jailbreak.git
cd Jailbreak
npm install
cp .env.example .env.local
# Add your OpenRouter API key to .env.local (optional — deterministic scoring works without it)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Game mechanics

| Tier | Jail probability | Clean payout | Jailed payout |
|------|-----------------|--------------|---------------|
| Common (low risk) | 8% | 1.15x | 4.5x |
| Rare (medium risk) | 35% | 1.8x | 2.0x |
| Legendary (high danger) | 70% | 3.2x | 1.3x |

Start with 1,000 play points. Track your win rate, best streak, and peak balance across rounds.

## Architecture

```
src/
├── app/
│   ├── page.tsx              # Landing page with scroll animations
│   ├── globals.css           # Design system (navy + gold palette)
│   ├── layout.tsx            # Root layout with fonts
│   ├── play/
│   │   ├── page.tsx          # Game UI (card grid, betting panel)
│   │   ├── use-game.ts       # Game state hook (all logic extracted)
│   │   └── error.tsx         # Error boundary
│   └── api/
│       └── validators/
│           └── route.ts      # Backend: fetch validators, AI scoring, caching
└── ...
```

## Cosmos Hub integration

- Fetches **bonded + unbonding validators** from the staking module
- Builds a **mixed pool** each round: 4 top validators, 3 mid-range, 1 small, 2 jailed/unbonding
- Queries **real network signing statistics** (missed blocks distribution, tombstone count)
- AI prompt includes **actual slashing parameters**: SignedBlocksWindow (10,000), MinSignedPerWindow (5%), SlashFractionDowntime (0.01%), SlashFractionDoubleSign (5%)
- Deterministic fallback scores on: jailed status, bond status, commission rate, stake size

## Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/Savage27z/Jailbreak&env=OPENROUTER_API_KEY&envDescription=Optional%20OpenRouter%20API%20key%20for%20AI%20scoring)

Set `OPENROUTER_API_KEY` in environment variables (optional — the app works without it using deterministic scoring).

---

MIT License
