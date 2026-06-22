import { NextResponse } from "next/server";

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

const COSMOS_ENDPOINTS = [
  "https://cosmoshub-api.lavenderfive.com",
  "https://rest-cosmoshub.ecostake.com",
  "https://cosmos-rest.publicnode.com",
];

const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY || "";

let validatorCache: ValidatorData[] | null = null;
let validatorCacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000;

const scoreCache = new Map<string, { tier: string; reason: string }>();

async function fetchValidators(): Promise<ValidatorData[]> {
  if (validatorCache && Date.now() - validatorCacheTime < CACHE_TTL) {
    return validatorCache;
  }

  for (const base of COSMOS_ENDPOINTS) {
    try {
      const res = await fetch(
        `${base}/cosmos/staking/v1beta1/validators?pagination.limit=200`,
        { signal: AbortSignal.timeout(10000) }
      );
      if (!res.ok) continue;
      const data = await res.json();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const validators: ValidatorData[] = data.validators
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((v: any) => v.status === "BOND_STATUS_BONDED")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((v: any) => ({
          operator_address: v.operator_address,
          moniker: v.description?.moniker || "Unknown",
          jailed: v.jailed,
          status: v.status,
          tokens: v.tokens,
          commission_rate: v.commission?.commission_rates?.rate || "0",
        }))
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

  const stakedAtom = (Number(validator.tokens) / 1_000_000).toFixed(0);
  const commissionPct = (Number(validator.commission_rate) * 100).toFixed(1);

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "meta-llama/llama-3.1-8b-instruct:free",
        max_tokens: 150,
        messages: [
          {
            role: "user",
            content: `You are a Cosmos Hub validator risk analyst for a gacha card game. Analyze this validator and assign a rarity tier based on slashing/jailing risk.

Validator: ${validator.moniker}
Staked: ${stakedAtom} ATOM
Commission: ${commissionPct}%
Currently jailed: ${validator.jailed}
Status: ${validator.status}

Cosmos slashing rules:
- Missing 50+ blocks in a 100-block window → jailed, 1% stake slashed
- Double-signing → tombstoned permanently, 5% stake slashed
- High commission (>20%) = less professional operation
- Low stake = less infrastructure investment
- Jailed validators = legendary tier (high danger)
- Mid-range normal validators = common tier (low risk)

Respond with ONLY valid JSON, no markdown, no explanation outside JSON:
{"tier": "common", "reason": "one sentence"}
or
{"tier": "rare", "reason": "one sentence"}
or
{"tier": "legendary", "reason": "one sentence"}`,
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
    const result = {
      tier: tier as "common" | "rare" | "legendary",
      reason: (parsed.reason as string) || "Standard validator.",
    };
    scoreCache.set(validator.operator_address, result);
    return result;
  } catch {
    const commission = Number(validator.commission_rate);
    const stake = Number(validator.tokens) / 1_000_000;
    let tier: "common" | "rare" | "legendary" = "common";
    let reason = "Standard validator with typical parameters.";

    if (validator.jailed) {
      tier = "legendary";
      reason = "Currently jailed — immediate slashing risk, high danger.";
    } else if (commission > 0.2 || stake < 100_000) {
      tier = "rare";
      reason = commission > 0.2
        ? `High commission at ${(commission * 100).toFixed(1)}% suggests less competitive operation.`
        : "Relatively low stake may indicate less infrastructure investment.";
    }

    const result = { tier, reason };
    scoreCache.set(validator.operator_address, result);
    return result;
  }
}

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
