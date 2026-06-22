# jailbreak

Gacha-style Cosmos Hub validator slashing-risk game. Pull validator cards, reveal AI-scored danger tiers, and stake simulated play points on whether they get jailed.

## Setup

```bash
npm install
cp .env.example .env.local
# Add your Anthropic API key to .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## How it works

### Data source
Live validator data is fetched from the Cosmos Hub public REST API (`/cosmos/staking/v1beta1/validators`). The app tries multiple endpoints (Lavender Five, Ecostake, PublicNode) for redundancy. Only bonded validators are shown, sorted by voting power, capped at 20.

### AI risk scoring
Each validator's stats (stake size, commission rate, jailed status, bonded status) are sent to the Claude API (claude-sonnet-4-6). The AI returns a strict JSON response with a rarity tier (`common` / `rare` / `legendary`) and a one-sentence risk assessment. Results are cached in-memory so repeat views don't re-call the API.

### Betting (simulated)
After revealing a card, players can stake play points on whether the validator "gets jailed within 7 days" or "stays clean." Payouts are calculated from fixed tier-based odds:
- Common: 1.15x (stays clean) / 4.5x (gets jailed)
- Rare: 1.8x / 2.0x
- Legendary: 3.2x / 1.3x

**All stakes use simulated play points. No wallet connection, no real funds, no blockchain transactions.**

## Stack
- Next.js 16 (App Router) + TypeScript + Tailwind CSS v4
- Anthropic Claude API for risk analysis
- Cosmos Hub REST API for live validator data
