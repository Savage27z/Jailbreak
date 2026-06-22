"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

interface Validator {
  operator_address: string;
  moniker: string;
  jailed: boolean;
  status: string;
  tokens: string;
  commission_rate: string;
}

interface ScoredValidator extends Validator {
  tier: "common" | "rare" | "legendary";
  reason: string;
}

type BetSide = "jailed" | "clean";
type BetPhase = "picking" | "locked" | "resolving" | "resolved";

interface BetResult {
  outcome: "jailed" | "clean";
  won: boolean;
  payout: number;
}

const ODDS: Record<string, { clean: number; jailed: number }> = {
  common: { clean: 1.15, jailed: 4.5 },
  rare: { clean: 1.8, jailed: 2.0 },
  legendary: { clean: 3.2, jailed: 1.3 },
};

const JAIL_PROBABILITY: Record<string, number> = {
  common: 0.08,
  rare: 0.35,
  legendary: 0.7,
};

function formatAtom(tokens: string): string {
  const n = Number(tokens) / 1_000_000;
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(0) + "K";
  return n.toFixed(0);
}

const TIER_COLOR: Record<string, string> = {
  common: "var(--common)",
  rare: "var(--rare)",
  legendary: "var(--legendary)",
};

const STARTING_BALANCE = 1000;

export default function PlayPage() {
  const [validators, setValidators] = useState<Validator[]>([]);
  const [scored, setScored] = useState<Map<string, ScoredValidator>>(new Map());
  const [flipped, setFlipped] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<string | null>(null);
  const [betSide, setBetSide] = useState<BetSide>("clean");
  const [stake, setStake] = useState(100);
  const [betPhase, setBetPhase] = useState<BetPhase>("picking");
  const [betResult, setBetResult] = useState<BetResult | null>(null);
  const [balance, setBalance] = useState(STARTING_BALANCE);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [highScore, setHighScore] = useState(STARTING_BALANCE);
  const [totalBets, setTotalBets] = useState(0);
  const [totalWins, setTotalWins] = useState(0);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/validators")
      .then(r => r.json())
      .then(data => { if (data.error) setFetchError(data.error); else setValidators(data.validators); })
      .catch(() => setFetchError("Failed to fetch validators"));
  }, []);

  const handleFlip = useCallback(async (addr: string) => {
    if (flipped.has(addr) || loading.has(addr)) return;
    setFlipped(p => new Set(p).add(addr));
    setLoading(p => new Set(p).add(addr));
    setSelected(addr);
    setBetPhase("picking");
    setBetResult(null);
    try {
      const res = await fetch("/api/validators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operator_address: addr }),
      });
      const data = await res.json();
      if (data.tier) setScored(p => new Map(p).set(addr, data));
    } finally {
      setLoading(p => { const n = new Set(p); n.delete(addr); return n; });
    }
  }, [flipped, loading]);

  const handleLockIn = useCallback(() => {
    if (!selected) return;
    const currentSv = scored.get(selected);
    if (!currentSv) return;
    const actualStake = Math.min(stake, balance);
    if (actualStake <= 0) return;

    setBalance(b => b - actualStake);
    setBetPhase("locked");
    setTotalBets(n => n + 1);

    setTimeout(() => {
      setBetPhase("resolving");
    }, 800);

    const tier = currentSv.tier;
    const side = betSide;
    setTimeout(() => {
      const jailChance = JAIL_PROBABILITY[tier];
      const outcome: "jailed" | "clean" = Math.random() < jailChance ? "jailed" : "clean";
      const won = outcome === side;
      const winPayout = won ? Math.round(actualStake * ODDS[tier][side]) : 0;

      if (won) {
        setBalance(b => {
          const newBal = b + winPayout;
          setHighScore(prev => Math.max(prev, newBal));
          return newBal;
        });
        setStreak(s => {
          const newStreak = s + 1;
          setBestStreak(prev => Math.max(prev, newStreak));
          return newStreak;
        });
        setTotalWins(n => n + 1);
      } else {
        setStreak(0);
      }

      setBetResult({ outcome, won, payout: winPayout });
      setBetPhase("resolved");
    }, 3000);
  }, [selected, scored, stake, balance, betSide]);

  const handleNewBet = useCallback(() => {
    setSelected(null);
    setBetPhase("picking");
    setBetResult(null);
    setBetSide("clean");
  }, []);

  const handleRestart = useCallback(() => {
    setBalance(STARTING_BALANCE);
    setStreak(0);
    setTotalBets(0);
    setTotalWins(0);
    handleNewBet();
  }, [handleNewBet]);

  const sv = selected ? scored.get(selected) : null;
  const effectiveStake = Math.min(stake, balance);
  const payout = sv ? (effectiveStake * ODDS[sv.tier][betSide]).toFixed(0) : "0";
  const winRate = totalBets > 0 ? Math.round((totalWins / totalBets) * 100) : 0;

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--bg)" }}>
      {/* nav */}
      <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 50, padding: "20px 32px", background: "rgba(10,14,26,0.85)", backdropFilter: "blur(20px)", borderBottom: "1px solid var(--border)" }}>
        <div style={{ maxWidth: 1400, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <Link href="/" style={{ fontFamily: "var(--serif)", fontSize: "1.5rem", color: "var(--cream)", textDecoration: "none" }}>Jailbreak</Link>
            <span className="label" style={{ marginTop: 4 }}>the pool</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            {streak > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontFamily: "var(--mono)", fontSize: "0.7rem", color: "var(--common)" }}>
                  {streak} streak
                </span>
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="label" style={{ color: "var(--fg-3)" }}>bal</span>
              <span style={{
                fontFamily: "var(--mono)", fontSize: "0.85rem", fontWeight: 600,
                color: balance > STARTING_BALANCE ? "var(--common)" : balance < STARTING_BALANCE * 0.3 ? "var(--legendary)" : "var(--gold)",
              }}>
                {balance.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </nav>

      <main style={{ flex: 1, maxWidth: 1400, margin: "0 auto", width: "100%", padding: "120px 24px 64px" }}>
        {/* heading */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 64, flexWrap: "wrap", gap: 32 }}>
          <div style={{ maxWidth: 700 }}>
            <p className="label-accent" style={{ marginBottom: 16 }}>live cosmos hub data</p>
            <h1 style={{ fontFamily: "var(--serif)", fontSize: "clamp(2.5rem, 6vw, 5rem)", color: "var(--cream)", lineHeight: 1, marginBottom: 16 }}>
              Pull a <em style={{ fontStyle: "italic", color: "var(--gold)" }}>validator.</em>
            </h1>
            <p className="body-serif">
              Tap a card to reveal its AI-scored danger tier, then stake play points on whether it stays clean or gets jailed.
            </p>
          </div>

          {/* stats panel */}
          {totalBets > 0 && (
            <div style={{ display: "flex", gap: 24, padding: "20px 24px", border: "1px solid var(--border)", background: "var(--surface)" }}>
              <div style={{ textAlign: "center" }}>
                <p style={{ fontFamily: "var(--serif)", fontSize: "1.5rem", color: "var(--cream)", lineHeight: 1 }}>{totalWins}/{totalBets}</p>
                <p className="label" style={{ marginTop: 6 }}>record</p>
              </div>
              <div style={{ width: 1, background: "var(--border)" }} />
              <div style={{ textAlign: "center" }}>
                <p style={{ fontFamily: "var(--serif)", fontSize: "1.5rem", color: "var(--cream)", lineHeight: 1 }}>{winRate}%</p>
                <p className="label" style={{ marginTop: 6 }}>win rate</p>
              </div>
              <div style={{ width: 1, background: "var(--border)" }} />
              <div style={{ textAlign: "center" }}>
                <p style={{ fontFamily: "var(--serif)", fontSize: "1.5rem", color: "var(--gold)", lineHeight: 1 }}>{bestStreak}</p>
                <p className="label" style={{ marginTop: 6 }}>best streak</p>
              </div>
              <div style={{ width: 1, background: "var(--border)" }} />
              <div style={{ textAlign: "center" }}>
                <p style={{ fontFamily: "var(--serif)", fontSize: "1.5rem", color: "var(--common)", lineHeight: 1 }}>{highScore.toLocaleString()}</p>
                <p className="label" style={{ marginTop: 6 }}>peak bal</p>
              </div>
            </div>
          )}
        </div>

        {fetchError && (
          <div style={{ marginBottom: 32, padding: 24, border: "1px solid rgba(212,168,67,0.2)", background: "rgba(212,168,67,0.04)" }}>
            <p className="label-accent" style={{ marginBottom: 8 }}>connection error</p>
            <p style={{ fontFamily: "var(--mono)", fontSize: "0.8rem", color: "var(--fg-2)" }}>{fetchError}</p>
          </div>
        )}

        {/* card grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5" style={{ gap: "clamp(12px, 2vw, 20px)", marginBottom: 80 }}>
          {validators.map(v => {
            const isFlipped = flipped.has(v.operator_address);
            const isLoading = loading.has(v.operator_address);
            const score = scored.get(v.operator_address);
            const isSel = selected === v.operator_address;
            const tierColor = score ? TIER_COLOR[score.tier] : "transparent";

            return (
              <div
                key={v.operator_address}
                className="perspective"
                style={{ aspectRatio: "3/4", cursor: "pointer" }}
                onClick={() => {
                  if (betPhase === "resolving" || betPhase === "locked") return;
                  if (isFlipped && score) { setSelected(v.operator_address); setBetPhase("picking"); setBetResult(null); }
                  else handleFlip(v.operator_address);
                }}
              >
                <div className={`card-inner w-full h-full ${isFlipped ? "flipped" : ""}`} style={{ position: "relative" }}>
                  {/* face down */}
                  <div
                    style={{
                      position: "absolute", inset: 0,
                      backfaceVisibility: "hidden",
                      background: "var(--cream)",
                      borderRadius: 10,
                      boxShadow: isSel ? "0 8px 32px rgba(0,0,0,0.4), 0 0 0 2px var(--gold)" : "0 6px 24px rgba(0,0,0,0.3)",
                      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12,
                      transition: "box-shadow 0.3s",
                    }}
                  >
                    <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "rgba(10,14,26,0.08)", borderRadius: "10px 10px 0 0" }} />
                    <div style={{ fontFamily: "var(--serif)", fontSize: "2.5rem", color: "var(--bg)", opacity: 0.06 }}>?</div>
                    <span style={{ fontFamily: "var(--mono)", fontSize: "0.5rem", letterSpacing: "0.2em", textTransform: "uppercase" as const, color: "rgba(10,14,26,0.2)" }}>pull</span>
                  </div>

                  {/* face up */}
                  <div
                    style={{
                      position: "absolute", inset: 0,
                      backfaceVisibility: "hidden",
                      transform: "rotateY(180deg)",
                      background: "var(--cream)",
                      borderRadius: 10,
                      boxShadow: score ? `0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px ${tierColor}` : "0 6px 24px rgba(0,0,0,0.3)",
                      display: "flex", flexDirection: "column",
                      padding: 16,
                      overflow: "hidden",
                    }}
                  >
                    <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: tierColor, borderRadius: "10px 10px 0 0" }} />

                    {isLoading ? (
                      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
                        <div className="spinner" />
                        <span style={{ fontFamily: "var(--mono)", fontSize: "0.5rem", letterSpacing: "0.15em", textTransform: "uppercase" as const, color: "rgba(10,14,26,0.25)" }}>analyzing</span>
                      </div>
                    ) : score ? (
                      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", paddingTop: 12 }}>
                        <div>
                          <span className={`badge badge-${score.tier}`} style={{ marginBottom: 8, display: "inline-flex" }}>{score.tier}</span>
                          <p style={{ fontFamily: "var(--serif)", fontSize: "clamp(0.85rem, 1.2vw, 1.05rem)", color: "var(--bg)", lineHeight: 1.25, marginTop: 10 }}>{score.moniker}</p>
                          <p style={{ fontFamily: "var(--mono)", fontSize: "0.55rem", color: "rgba(10,14,26,0.3)", marginTop: 4 }}>{formatAtom(score.tokens)} ATOM · {(parseFloat(score.commission_rate) * 100).toFixed(1)}%</p>
                        </div>
                        <p style={{ fontFamily: "var(--mono)", fontSize: "0.55rem", lineHeight: 1.65, color: "rgba(10,14,26,0.4)", marginTop: 8 }} className="line-clamp-3">{score.reason}</p>
                      </div>
                    ) : (
                      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <span style={{ fontFamily: "var(--mono)", fontSize: "0.55rem", color: "rgba(10,14,26,0.25)" }}>scoring failed</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {validators.length === 0 && !fetchError && (
            <div className="col-span-full" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "120px 0", gap: 16 }}>
              <div className="spinner" />
              <span className="label">loading validators from cosmos hub</span>
            </div>
          )}
        </div>

        {/* betting panel */}
        {sv && (
          <div style={{ maxWidth: 480, margin: "0 auto" }}>
            <p className="label" style={{ marginBottom: 16 }}>stake your call</p>
            <div style={{ padding: 32, border: "1px solid var(--border)", background: "var(--surface)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 32 }}>
                <span className={`badge badge-${sv.tier}`}>{sv.tier}</span>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontFamily: "var(--serif)", fontSize: "1.3rem", color: "var(--cream)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sv.moniker}</p>
                  <p style={{ fontFamily: "var(--mono)", fontSize: "0.6rem", color: "var(--fg-3)" }}>{formatAtom(sv.tokens)} ATOM</p>
                </div>
              </div>

              {/* PHASE: resolved */}
              {betPhase === "resolved" && betResult ? (
                <div style={{ textAlign: "center", padding: "32px 0" }}>
                  <div style={{
                    width: 64, height: 64, borderRadius: "50%", margin: "0 auto 20px",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: betResult.won ? "rgba(94,184,138,0.12)" : "rgba(232,93,58,0.12)",
                    border: `2px solid ${betResult.won ? "var(--common)" : "var(--legendary)"}`,
                  }}>
                    <span style={{ fontSize: "1.5rem" }}>{betResult.won ? "✓" : "✗"}</span>
                  </div>
                  <p style={{
                    fontFamily: "var(--serif)", fontSize: "2rem",
                    color: betResult.won ? "var(--common)" : "var(--legendary)",
                    marginBottom: 8,
                  }}>
                    {betResult.won ? "You won." : "You lost."}
                  </p>
                  <p style={{ fontFamily: "var(--mono)", fontSize: "0.7rem", color: "var(--fg-3)", marginBottom: 6 }}>
                    Validator {betResult.outcome === "jailed" ? "got jailed" : "stayed clean"}
                  </p>
                  <p style={{
                    fontFamily: "var(--serif)", fontSize: "1.5rem",
                    color: betResult.won ? "var(--common)" : "var(--legendary)",
                    marginBottom: 12,
                  }}>
                    {betResult.won ? `+${betResult.payout.toLocaleString()} pts` : `-${effectiveStake} pts`}
                  </p>
                  {streak > 1 && betResult.won && (
                    <p style={{ fontFamily: "var(--mono)", fontSize: "0.7rem", color: "var(--gold)", marginBottom: 12 }}>
                      {streak} win streak!
                    </p>
                  )}
                  <p style={{ fontFamily: "var(--mono)", fontSize: "0.65rem", color: "var(--fg-3)", marginBottom: 24 }}>
                    balance: <span style={{ color: "var(--gold)" }}>{balance.toLocaleString()} pts</span>
                  </p>
                  <button onClick={handleNewBet} className="btn-primary" style={{ width: "100%", justifyContent: "center" }}>
                    next card →
                  </button>
                </div>
              ) : betPhase === "resolving" || betPhase === "locked" ? (
                /* PHASE: resolving */
                <div style={{ textAlign: "center", padding: "48px 0" }}>
                  <div className="spinner" style={{ width: 24, height: 24, margin: "0 auto 20px", borderWidth: 2 }} />
                  <p style={{ fontFamily: "var(--serif)", fontSize: "1.4rem", color: "var(--cream)", marginBottom: 8 }}>
                    {betPhase === "locked" ? "Locking in..." : "Monitoring chain..."}
                  </p>
                  <p style={{ fontFamily: "var(--mono)", fontSize: "0.65rem", color: "var(--fg-3)" }}>
                    {betPhase === "resolving" ? "checking validator status on cosmos hub" : "submitting your stake"}
                  </p>
                </div>
              ) : (
                /* PHASE: picking */
                <>
                  {balance <= 0 ? (
                    <div style={{ textAlign: "center", padding: "32px 0" }}>
                      <p style={{ fontFamily: "var(--serif)", fontSize: "1.5rem", color: "var(--legendary)", marginBottom: 12 }}>Busted.</p>
                      <p style={{ fontFamily: "var(--mono)", fontSize: "0.7rem", color: "var(--fg-3)", marginBottom: 8 }}>You&apos;re out of play points.</p>
                      {totalBets > 0 && (
                        <p style={{ fontFamily: "var(--mono)", fontSize: "0.65rem", color: "var(--fg-3)", marginBottom: 24 }}>
                          Final record: {totalWins}/{totalBets} ({winRate}%) · best streak: {bestStreak} · peak: {highScore.toLocaleString()} pts
                        </p>
                      )}
                      <button onClick={handleRestart} className="btn-primary" style={{ width: "100%", justifyContent: "center" }}>
                        restart — 1,000 pts
                      </button>
                    </div>
                  ) : (
                    <>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 32 }}>
                        {(["clean", "jailed"] as const).map(side => (
                          <button
                            key={side}
                            onClick={() => setBetSide(side)}
                            style={{
                              padding: "16px 0",
                              fontFamily: "var(--mono)",
                              fontSize: "0.6rem",
                              letterSpacing: "0.15em",
                              textTransform: "uppercase",
                              cursor: "pointer",
                              transition: "all 0.2s",
                              border: betSide === side
                                ? `1px solid ${side === "clean" ? "var(--common)" : "var(--legendary)"}`
                                : "1px solid var(--border)",
                              background: betSide === side
                                ? side === "clean" ? "var(--common-bg)" : "var(--legendary-bg)"
                                : "transparent",
                              color: betSide === side
                                ? side === "clean" ? "var(--common)" : "var(--legendary)"
                                : "var(--fg-3)",
                            }}
                          >
                            {side === "clean" ? "stays clean" : "gets jailed"}
                          </button>
                        ))}
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 32 }}>
                        <span className="label" style={{ flexShrink: 0 }}>stake</span>
                        <input
                          type="number"
                          min={1} max={balance}
                          value={stake}
                          onChange={e => setStake(Math.max(1, Math.min(balance, Number(e.target.value))))}
                          style={{
                            flex: 1,
                            padding: "14px 16px",
                            fontFamily: "var(--mono)",
                            fontSize: "0.85rem",
                            background: "transparent",
                            border: "1px solid var(--border)",
                            color: "var(--cream)",
                            outline: "none",
                          }}
                        />
                        <span className="label" style={{ flexShrink: 0 }}>pts</span>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32, borderTop: "1px solid var(--border)", paddingTop: 20 }}>
                        <span style={{ fontFamily: "var(--mono)", fontSize: "0.75rem", color: "var(--fg-3)" }}>{ODDS[sv.tier][betSide]}×</span>
                        <span style={{ fontFamily: "var(--serif)", fontSize: "1.8rem", color: "var(--cream)" }}>{payout} pts</span>
                      </div>

                      <button
                        onClick={handleLockIn}
                        className="btn-primary"
                        style={{ width: "100%", justifyContent: "center" }}
                      >
                        lock it in
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </main>

      <footer style={{ padding: "24px 32px", borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span className="label">live cosmos hub data · simulated stakes</span>
        <span className="label">no wallet · no real funds</span>
      </footer>
    </div>
  );
}
