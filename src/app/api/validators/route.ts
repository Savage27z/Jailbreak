import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export interface ValidatorData {
  operator_address: string;
  moniker: string;
  jailed: boolean;
  status: string;
  tokens: string;
  commission_rate: string;
}

export interface ScoredValidator extends ValidatorData {
  tier: "common" | "rare" | "legendary";
  reason: string;
}

const ENDPOINTS = [
  "https://cosmoshub-api.lavenderfive.com/cosmos/staking/v1beta1/validators?pagination.limit=200",
  "https://rest-cosmoshub.ecostake.com/cosmos/staking/v1beta1/validators?pagination.limit=200",
  "https://cosmos-rest.publicnode.com/cosmos/staking/v1beta1/validators?pagination.limit=200",
];

// In-memory caches
let validatorCache: ValidatorData[] | null = null;
let validatorCacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const scoreCache = new Map<string, { tier: string; reason: string }>();

async function fetchValidators(): Promise<ValidatorData[]> {
  if (validatorCache && Date.now() - validatorCacheTime < CACHE_TTL) {
    return validatorCache;
  }

  for (const endpoint of ENDPOINTS) {
    try {
      const res = await fetch(endpoint, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) continue;
      const data = await res.json();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const validators: ValidatorData[] = data.validators
        .filter(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (v: any) => v.status === "BOND_STATUS_BONDED"
        )
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((v: any) => ({
          operator_address: v.operator_address,
          moniker: v.description?.moniker || "Unknown",
          jailed: v.jailed,
          status: v.status,
          tokens: v.tokens,
          commission_rate: v.commission?.commission_rates?.rate || "0",
        }))
        // Sort by voting power descending, take top 10
        .sort(
          (a: ValidatorData, b: ValidatorData) =>
            Number(BigInt(b.tokens) - BigInt(a.tokens))
        )
        .slice(0, 10);

      validatorCache = validators;
      validatorCacheTime = Date.now();
      return validators;
    } catch {
      continue;
    }
  }
  throw new Error("All Cosmos Hub API endpoints failed");
}

async function scoreValidator(
  validator: ValidatorData
): Promise<{ tier: "common" | "rare" | "legendary"; reason: string }> {
  const cached = scoreCache.get(validator.operator_address);
  if (cached) return cached as { tier: "common" | "rare" | "legendary"; reason: string };

  const client = new Anthropic();
  const stakedAtom = (Number(validator.tokens) / 1_000_000).toFixed(0);
  const commissionPct = (Number(validator.commission_rate) * 100).toFixed(1);

  const msg = await client.messages.create({
    model: "claude-sonnet-4-6-20250514",
    max_tokens: 150,
    messages: [
      {
        role: "user",
        content: `You are a Cosmos Hub validator risk analyst for a gacha game. Analyze this validator and assign a rarity tier based on slashing/jailing risk.

Validator: ${validator.moniker}
Staked: ${stakedAtom} ATOM
Commission: ${commissionPct}%
Currently jailed: ${validator.jailed}
Status: ${validator.status}

Risk signals to consider:
- Jailed validators = high immediate risk (legendary)
- Very high commission (>20%) may indicate less professional operation
- Very low stake relative to top validators may indicate less infrastructure investment
- Mid-range validators with normal parameters = low risk (common)

Respond with ONLY valid JSON, no markdown:
{"tier": "common"|"rare"|"legendary", "reason": "<one sentence explaining the risk level>"}`,
      },
    ],
  });

  const text =
    msg.content[0].type === "text" ? msg.content[0].text : "";
  try {
    const parsed = JSON.parse(text);
    const result = {
      tier: parsed.tier as "common" | "rare" | "legendary",
      reason: parsed.reason as string,
    };
    scoreCache.set(validator.operator_address, result);
    return result;
  } catch {
    const fallback = { tier: "common" as const, reason: "Standard validator with typical parameters." };
    scoreCache.set(validator.operator_address, fallback);
    return fallback;
  }
}

// GET /api/validators — returns list of validators (unscored)
export async function GET() {
  try {
    const validators = await fetchValidators();
    return NextResponse.json({ validators });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 502 }
    );
  }
}

// POST /api/validators — score a specific validator
export async function POST(request: Request) {
  try {
    const { operator_address } = await request.json();
    const validators = await fetchValidators();
    const validator = validators.find(
      (v) => v.operator_address === operator_address
    );
    if (!validator) {
      return NextResponse.json(
        { error: "Validator not found" },
        { status: 404 }
      );
    }
    const score = await scoreValidator(validator);
    return NextResponse.json({ ...validator, ...score });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    );
  }
}
