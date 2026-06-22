import { NextResponse } from "next/server";

export interface ValidatorData {
  operator_address: string;
  moniker: string;
  jailed: boolean;
  status: string;
  tokens: string;
  commission_rate: string;
  consensus_pubkey?: string;
}

export interface ScoredValidator extends ValidatorData {
  tier: "common" | "rare" | "legendary";
  reason: string;
  narrator_clean: string;
  narrator_jailed: string;
  insight: string;
}

const COSMOS_ENDPOINTS = [
  "https://cosmoshub-api.lavenderfive.com",
  "https://rest-cosmoshub.ecostake.com",
  "https://cosmos-rest.publicnode.com",
];

const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY || "";

let validatorCache: ValidatorData[] | null = null;
let validatorCacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000;

const scoreCache = new Map<string, { tier: string; reason: string; narrator_clean: string; narrator_jailed: string; insight: string }>();

// Network-wide signing stats (real aggregate data from chain)
let networkSigningStats: { avgMissed: number; maxMissed: number; totalInfos: number; jailedCount: number } | null = null;
let networkStatsTime = 0;

async function cosmosGet(path: string): Promise<Response | null> {
  for (const base of COSMOS_ENDPOINTS) {
    try {
      const res = await fetch(`${base}${path}`, { signal: AbortSignal.timeout(10000) });
      if (res.ok) return res;
    } catch { continue; }
  }
  return null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapValidator(v: any): ValidatorData {
  return {
    operator_address: v.operator_address,
    moniker: v.description?.moniker || "Unknown",
    jailed: v.jailed,
    status: v.status,
    tokens: v.tokens,
    commission_rate: v.commission?.commission_rates?.rate || "0",
    consensus_pubkey: v.consensus_pubkey?.key || undefined,
  };
}

async function fetchNetworkSigningStats() {
  if (networkSigningStats && Date.now() - networkStatsTime < CACHE_TTL) {
    return networkSigningStats;
  }
  try {
    const res = await cosmosGet("/cosmos/slashing/v1beta1/signing_infos?pagination.limit=500");
    if (!res) return null;
    const data = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const infos: any[] = data.info || [];
    if (infos.length === 0) return null;

    const missedCounts = infos.map(i => Number(i.missed_blocks_counter || 0));
    const jailedCount = infos.filter(i => i.tombstoned === true).length;
    const sum = missedCounts.reduce((a, b) => a + b, 0);

    networkSigningStats = {
      avgMissed: Math.round(sum / missedCounts.length),
      maxMissed: Math.max(...missedCounts),
      totalInfos: infos.length,
      jailedCount,
    };
    networkStatsTime = Date.now();
    return networkSigningStats;
  } catch {
    return null;
  }
}

async function fetchValidators(): Promise<ValidatorData[]> {
  if (validatorCache && Date.now() - validatorCacheTime < CACHE_TTL) {
    return validatorCache;
  }

  const [bondedRes, unbondedRes] = await Promise.all([
    cosmosGet("/cosmos/staking/v1beta1/validators?status=BOND_STATUS_BONDED&pagination.limit=200"),
    cosmosGet("/cosmos/staking/v1beta1/validators?status=BOND_STATUS_UNBONDING&pagination.limit=50"),
  ]);

  if (!bondedRes) throw new Error("All Cosmos Hub API endpoints failed");

  const bondedData = await bondedRes.json();
  const bonded: ValidatorData[] = bondedData.validators.map(mapValidator);
  bonded.sort((a, b) => Number(BigInt(b.tokens) - BigInt(a.tokens)));

  const top = bonded.slice(0, 10);
  const mid = bonded.slice(30, 80);
  const small = bonded.filter(v => Number(v.tokens) / 1_000_000 < 500_000);

  const pick = (arr: ValidatorData[], n: number): ValidatorData[] => {
    const shuffled = [...arr].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, n);
  };

  const pool: ValidatorData[] = [
    ...pick(top, 4),
    ...pick(mid.length > 0 ? mid : bonded.slice(10, 50), 3),
    ...pick(small.length > 0 ? small : bonded.slice(-20), 1),
  ];

  if (unbondedRes) {
    try {
      const unbondedData = await unbondedRes.json();
      const unbonded: ValidatorData[] = (unbondedData.validators || []).map(mapValidator);
      const jailed = unbonded.filter(v => v.jailed);
      pool.push(...pick(jailed.length > 0 ? jailed : unbonded, 2));
    } catch { /* ignore */ }
  }

  const seen = new Set(pool.map(v => v.operator_address));
  if (pool.length < 10) {
    for (const v of bonded) {
      if (pool.length >= 10) break;
      if (!seen.has(v.operator_address)) {
        pool.push(v);
        seen.add(v.operator_address);
      }
    }
  }

  const deduped = [...new Map(pool.map(v => [v.operator_address, v])).values()];
  const validators = deduped.sort(() => Math.random() - 0.5).slice(0, 10);

  // Prefetch network signing stats in background
  fetchNetworkSigningStats().catch(() => {});

  validatorCache = validators;
  validatorCacheTime = Date.now();
  return validators;
}

type ScoreResult = { tier: "common" | "rare" | "legendary"; reason: string; narrator_clean: string; narrator_jailed: string; insight: string };

async function scoreValidator(validator: ValidatorData): Promise<ScoreResult> {
  const cached = scoreCache.get(validator.operator_address);
  if (cached) return cached as ScoreResult;

  const stats = await fetchNetworkSigningStats();

  const stakedAtom = (Number(validator.tokens) / 1_000_000).toFixed(0);
  const commissionPct = (Number(validator.commission_rate) * 100).toFixed(1);
  const networkContext = stats
    ? `Network signing stats (real on-chain): ${stats.totalInfos} active validators, avg ${stats.avgMissed} missed blocks, max ${stats.maxMissed}, ${stats.jailedCount} tombstoned`
    : "Network signing stats: unavailable";

  if (OPENROUTER_KEY) {
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENROUTER_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "meta-llama/llama-3.1-8b-instruct:free",
          max_tokens: 300,
          messages: [
            {
              role: "user",
              content: `You are a Cosmos Hub validator risk analyst AND narrator for a gacha card game about staking incentives. Analyze this validator.

Validator: ${validator.moniker}
Staked: ${stakedAtom} ATOM
Commission: ${commissionPct}%
Currently jailed: ${validator.jailed}
Status: ${validator.status}
${networkContext}

Cosmos Hub slashing parameters (real on-chain values):
- SignedBlocksWindow: 10,000 blocks
- MinSignedPerWindow: 5% (miss 9,500+ blocks in window → jailed for downtime)
- SlashFractionDowntime: 0.01% of stake slashed
- SlashFractionDoubleSign: 5% of stake + permanent tombstone
- DowntimeJailDuration: 600 seconds

Scoring rules:
- Jailed or tombstoned validators → legendary (high danger)
- High commission (>10%), low stake (<500K ATOM), or unbonding status → rare (medium risk)
- Large, reliable validators with low commission and bonded status → common (low risk)

Respond with ONLY valid JSON, no markdown:
{"tier": "common", "reason": "risk analysis, max 20 words", "narrator_clean": "dramatic short sentence if validator stays clean, reference their real traits", "narrator_jailed": "dramatic short sentence if validator gets jailed, reference their real traits", "insight": "one sentence explaining what real Cosmos incentive mechanism affects this validator most"}`,
            },
          ],
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (!res.ok) throw new Error(`OpenRouter ${res.status}`);
      const data = await res.json();
      const text = data.choices?.[0]?.message?.content || "";
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON in response");

      const parsed = JSON.parse(jsonMatch[0]);
      const tier = ["common", "rare", "legendary"].includes(parsed.tier) ? parsed.tier : "common";
      const result: ScoreResult = {
        tier: tier as "common" | "rare" | "legendary",
        reason: (parsed.reason as string) || "Standard validator.",
        narrator_clean: (parsed.narrator_clean as string) || `${validator.moniker} holds the line — no slashing today.`,
        narrator_jailed: (parsed.narrator_jailed as string) || `${validator.moniker} goes down — the chain doesn't forgive.`,
        insight: (parsed.insight as string) || "Validator behavior is shaped by the balance between commission revenue and slashing risk.",
      };
      scoreCache.set(validator.operator_address, result);
      return result;
    } catch { /* fall through to deterministic */ }
  }

  // Deterministic fallback using real chain data
  const commission = Number(validator.commission_rate);
  const stakeUatom = Number(validator.tokens);
  const stakeAtom = stakeUatom / 1_000_000;
  const name = validator.moniker;
  let tier: "common" | "rare" | "legendary" = "common";
  let reason = "Large, reliable validator with standard parameters — low slashing risk.";
  let narrator_clean = `${name} keeps signing blocks like clockwork. Delegators sleep well tonight.`;
  let narrator_jailed = `${name} misses the window — 0.01% of stake slashed, delegators scramble to redelegate.`;
  let insight = "Large validators have the most to lose from downtime — their slashing penalty scales with stake size.";

  if (validator.jailed) {
    tier = "legendary";
    reason = "Currently jailed — active slashing event, high danger.";
    narrator_clean = `Against all odds, ${name} claws back from jail. A redemption arc for the ages.`;
    narrator_jailed = `${name} stays in the hole. The 600-second jail timer resets — delegators bail.`;
    insight = "Jailed validators must submit an unjail transaction after the 600s cooldown. Delegators can't unstake during the 21-day unbonding period.";
  } else if (validator.status !== "BOND_STATUS_BONDED") {
    tier = "legendary";
    reason = "Unbonding or unbonded — unstable validator state, elevated risk.";
    narrator_clean = `${name} survives the unbonding gauntlet. 21 days of uncertainty, but they made it.`;
    narrator_jailed = `${name}'s unbonding turns to free fall — jailed mid-exit. The worst timing possible.`;
    insight = "The 21-day unbonding period is a core Cosmos security mechanism — it prevents nothing-at-stake attacks by keeping validators' skin in the game.";
  } else if (commission > 0.2) {
    tier = "rare";
    reason = `Commission at ${(commission * 100).toFixed(1)}% — unusually high, possible extraction play.`;
    narrator_clean = `${name} takes a fat cut but keeps the lights on. Delegators pay the premium.`;
    narrator_jailed = `${name}'s ${(commission * 100).toFixed(0)}% commission couldn't buy reliable infrastructure. Jailed.`;
    insight = `At ${(commission * 100).toFixed(0)}% commission, delegators lose more to fees than they'd lose in a downtime slash. The incentive to redelegate is strong.`;
  } else if (commission > 0.1) {
    tier = "rare";
    reason = `Commission at ${(commission * 100).toFixed(1)}% — above average, warrants monitoring.`;
    narrator_clean = `${name} earns its above-average fee — uptime holds steady.`;
    narrator_jailed = `${name} charges more but delivers less. The chain notices.`;
    insight = "Commission rate is a trust signal. Validators charging above 10% need to justify it with track record, or delegators will move stake.";
  } else if (stakeAtom < 100_000) {
    tier = "rare";
    reason = `Only ${Math.round(stakeAtom).toLocaleString()} ATOM staked — small operator, higher infrastructure risk.`;
    narrator_clean = `The little engine that could — ${name} punches above its weight.`;
    narrator_jailed = `${name}'s shoestring infrastructure finally gives out. Small stake, big consequences.`;
    insight = "Small validators face a bootstrapping problem: less delegation means less commission revenue to fund better infrastructure, which means more downtime risk.";
  } else if (stakeAtom < 500_000) {
    tier = "rare";
    reason = "Below-average stake suggests less infrastructure investment.";
    narrator_clean = `${name} keeps grinding. Mid-tier stake, mid-tier risk, but clean today.`;
    narrator_jailed = `${name} drops the ball — missed blocks pile up past the 9,500 threshold.`;
    insight = "The MinSignedPerWindow of 5% means a validator can miss 9,500 of 10,000 blocks before jailing — it's a very forgiving threshold, so getting jailed signals serious infrastructure failure.";
  }

  const result: ScoreResult = { tier, reason, narrator_clean, narrator_jailed, insight };
  scoreCache.set(validator.operator_address, result);
  return result;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    if (searchParams.has("refresh")) {
      validatorCache = null;
      validatorCacheTime = 0;
    }
    const validators = await fetchValidators();
    return NextResponse.json({ validators });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 502 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { operator_address } = await request.json();
    const validators = await fetchValidators();
    let validator = validators.find(
      (v) => v.operator_address === operator_address
    );

    if (!validator) {
      const res = await cosmosGet(`/cosmos/staking/v1beta1/validators/${operator_address}`);
      if (res) {
        const data = await res.json();
        if (data.validator) {
          validator = mapValidator(data.validator);
        }
      }
    }

    if (!validator) {
      return NextResponse.json(
        { error: "Validator not found" },
        { status: 404 }
      );
    }
    const score = await scoreValidator(validator);
    const { consensus_pubkey: _, ...rest } = validator;
    return NextResponse.json({ ...rest, ...score });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    );
  }
}
