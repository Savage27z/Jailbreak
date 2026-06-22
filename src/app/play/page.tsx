"use client";

import Link from "next/link";
import { useState } from "react";
import { useGame, ODDS, STARTING_BALANCE } from "./use-game";
import type { ScoredValidator } from "./use-game";
import type { LeaderboardEntry } from "./leaderboard";

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

export default function PlayPage() {
  const g = useGame();
  const effectiveStake = Math.min(g.stake, g.balance);
  const payout = g.sv ? (effectiveStake * ODDS[g.sv.tier][g.betSide]).toFixed(0) : "0";

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
            {g.streak > 0 && (
              <span style={{ fontFamily: "var(--mono)", fontSize: "0.7rem", color: "var(--common)" }}>
                {g.streak} streak
              </span>
            )}
            <button
              onClick={() => g.setShowLeaderboard(!g.showLeaderboard)}
              style={{
                fontFamily: "var(--mono)", fontSize: "0.65rem", letterSpacing: "0.15em",
                textTransform: "uppercase", color: g.showLeaderboard ? "var(--gold)" : "var(--fg-3)",
                background: "transparent", border: "none", cursor: "pointer", padding: "4px 8px",
              }}
            >
              top 10
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="label" style={{ color: "var(--fg-3)" }}>bal</span>
              <span style={{
                fontFamily: "var(--mono)", fontSize: "0.85rem", fontWeight: 600,
                color: g.balance > STARTING_BALANCE ? "var(--common)" : g.balance < STARTING_BALANCE * 0.3 ? "var(--legendary)" : "var(--gold)",
              }}>
                {g.balance.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </nav>

      {g.showLeaderboard && <LeaderboardPanel entries={g.leaderboard} onClose={() => g.setShowLeaderboard(false)} />}

      <main style={{ flex: 1, maxWidth: 1400, margin: "0 auto", width: "100%", padding: "120px 24px 64px" }}>
        {/* heading + stats */}
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

          {g.totalBets > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 24, padding: "20px 24px", border: "1px solid var(--border)", background: "var(--surface)" }}>
              {[
                { value: `${g.totalWins}/${g.totalBets}`, label: "record", color: "var(--cream)" },
                { value: `${g.winRate}%`, label: "win rate", color: "var(--cream)" },
                { value: `${g.bestStreak}`, label: "best streak", color: "var(--gold)" },
                { value: g.highScore.toLocaleString(), label: "peak bal", color: "var(--common)" },
              ].map(s => (
                <div key={s.label} style={{ textAlign: "center", minWidth: 60 }}>
                  <p style={{ fontFamily: "var(--serif)", fontSize: "1.5rem", color: s.color, lineHeight: 1 }}>{s.value}</p>
                  <p className="label" style={{ marginTop: 6 }}>{s.label}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {g.fetchError && (
          <div style={{ marginBottom: 32, padding: 24, border: "1px solid rgba(212,168,67,0.2)", background: "rgba(212,168,67,0.04)" }}>
            <p className="label-accent" style={{ marginBottom: 8 }}>connection error</p>
            <p style={{ fontFamily: "var(--mono)", fontSize: "0.8rem", color: "var(--fg-2)" }}>{g.fetchError}</p>
          </div>
        )}

        {/* card grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5" style={{ gap: "clamp(12px, 2vw, 20px)", marginBottom: 80 }}>
          {g.validators.map(v => (
            <ValidatorCard
              key={v.operator_address}
              addr={v.operator_address}
              isFlipped={g.flipped.has(v.operator_address)}
              isLoading={g.loading.has(v.operator_address)}
              score={g.scored.get(v.operator_address)}
              isSelected={g.selected === v.operator_address}
              disabled={g.betPhase === "resolving" || g.betPhase === "locked"}
              onFlip={g.handleFlip}
              onSelect={(addr) => { g.setSelected(addr); g.setBetPhase("picking"); g.setBetResult(null); }}
            />
          ))}

          {g.validators.length === 0 && !g.fetchError && (
            <div className="col-span-full" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "120px 0", gap: 16 }}>
              <div className="spinner" />
              <span className="label">loading validators from cosmos hub</span>
            </div>
          )}
        </div>

        {/* betting panel */}
        {g.sv && (
          <BettingPanel game={g} effectiveStake={effectiveStake} payout={payout} />
        )}
      </main>

      <footer style={{ padding: "24px 32px", borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <span className="label">live cosmos hub data · simulated stakes</span>
        <span className="label">no wallet · no real funds</span>
      </footer>
    </div>
  );
}

function ValidatorCard({ addr, isFlipped, isLoading, score, isSelected, disabled, onFlip, onSelect }: {
  addr: string;
  isFlipped: boolean;
  isLoading: boolean;
  score: ScoredValidator | undefined;
  isSelected: boolean;
  disabled: boolean;
  onFlip: (addr: string) => void;
  onSelect: (addr: string) => void;
}) {
  const tierColor = score ? TIER_COLOR[score.tier] : "transparent";

  return (
    <div
      className="perspective"
      style={{ aspectRatio: "3/4", cursor: "pointer" }}
      onClick={() => {
        if (disabled) return;
        if (isFlipped && score) onSelect(addr);
        else onFlip(addr);
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
            boxShadow: isSelected ? "0 8px 32px rgba(0,0,0,0.4), 0 0 0 2px var(--gold)" : "0 6px 24px rgba(0,0,0,0.3)",
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
}

function SaveScoreForm({ onSave }: { onSave: (name: string) => void }) {
  const [name, setName] = useState("");
  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
      <input
        type="text"
        placeholder="your name"
        maxLength={16}
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter" && name.trim()) onSave(name.trim()); }}
        style={{
          flex: 1, padding: "10px 12px", fontFamily: "var(--mono)", fontSize: "0.75rem",
          background: "transparent", border: "1px solid var(--border)", color: "var(--cream)", outline: "none",
        }}
      />
      <button
        onClick={() => { if (name.trim()) onSave(name.trim()); }}
        disabled={!name.trim()}
        style={{
          padding: "10px 16px", fontFamily: "var(--mono)", fontSize: "0.65rem", letterSpacing: "0.1em",
          textTransform: "uppercase", background: name.trim() ? "var(--gold)" : "var(--border)",
          color: name.trim() ? "var(--bg)" : "var(--fg-3)", border: "none", cursor: name.trim() ? "pointer" : "default",
        }}
      >
        save
      </button>
    </div>
  );
}

function LeaderboardPanel({ entries, onClose }: { entries: LeaderboardEntry[]; onClose: () => void }) {
  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 100,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "rgba(10,14,26,0.85)", backdropFilter: "blur(10px)",
    }} onClick={onClose}>
      <div
        style={{ width: "100%", maxWidth: 520, maxHeight: "80vh", overflow: "auto", margin: "0 24px", padding: 32, background: "var(--surface)", border: "1px solid var(--border)" }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <p style={{ fontFamily: "var(--serif)", fontSize: "1.5rem", color: "var(--gold)" }}>Top 10</p>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--fg-3)", cursor: "pointer", fontFamily: "var(--mono)", fontSize: "1rem" }}>&times;</button>
        </div>
        {entries.length === 0 ? (
          <p style={{ fontFamily: "var(--mono)", fontSize: "0.7rem", color: "var(--fg-3)", textAlign: "center", padding: "40px 0" }}>
            no scores yet &mdash; go bust first
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {entries.map((e, i) => (
              <div
                key={`${e.name}-${e.date}-${i}`}
                style={{
                  display: "grid", gridTemplateColumns: "28px 1fr auto", gap: 12, alignItems: "center",
                  padding: "12px 0", borderBottom: i < entries.length - 1 ? "1px solid var(--border)" : "none",
                }}
              >
                <span style={{
                  fontFamily: "var(--serif)", fontSize: i < 3 ? "1.1rem" : "0.85rem",
                  color: i === 0 ? "var(--gold)" : i === 1 ? "var(--fg-2)" : i === 2 ? "#cd7f32" : "var(--fg-3)",
                }}>{i + 1}</span>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontFamily: "var(--mono)", fontSize: "0.75rem", color: "var(--cream)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.name}</p>
                  <p style={{ fontFamily: "var(--mono)", fontSize: "0.55rem", color: "var(--fg-3)" }}>
                    {e.wins}/{e.bets} wins &middot; {e.bestStreak} streak &middot; {e.date}
                  </p>
                </div>
                <span style={{ fontFamily: "var(--serif)", fontSize: "1.1rem", color: i === 0 ? "var(--gold)" : "var(--cream)" }}>
                  {e.score.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function BettingPanel({ game: g, effectiveStake, payout }: {
  game: ReturnType<typeof useGame>;
  effectiveStake: number;
  payout: string;
}) {
  return (
    <div style={{ maxWidth: 480, margin: "0 auto" }}>
      <p className="label" style={{ marginBottom: 16 }}>stake your call</p>
      <div style={{ padding: 32, border: "1px solid var(--border)", background: "var(--surface)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 32 }}>
          <span className={`badge badge-${g.sv!.tier}`}>{g.sv!.tier}</span>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontFamily: "var(--serif)", fontSize: "1.3rem", color: "var(--cream)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.sv!.moniker}</p>
            <p style={{ fontFamily: "var(--mono)", fontSize: "0.6rem", color: "var(--fg-3)" }}>{formatAtom(g.sv!.tokens)} ATOM</p>
          </div>
        </div>

        {/* PHASE: resolved */}
        {g.betPhase === "resolved" && g.betResult ? (
          <div style={{ textAlign: "center", padding: "32px 0" }}>
            <div style={{
              width: 64, height: 64, borderRadius: "50%", margin: "0 auto 20px",
              display: "flex", alignItems: "center", justifyContent: "center",
              background: g.betResult.won ? "rgba(94,184,138,0.12)" : "rgba(232,93,58,0.12)",
              border: `2px solid ${g.betResult.won ? "var(--common)" : "var(--legendary)"}`,
            }}>
              <span style={{ fontSize: "1.5rem" }}>{g.betResult.won ? "✓" : "✗"}</span>
            </div>
            <p style={{
              fontFamily: "var(--serif)", fontSize: "2rem",
              color: g.betResult.won ? "var(--common)" : "var(--legendary)",
              marginBottom: 8,
            }}>
              {g.betResult.won ? "You won." : "You lost."}
            </p>
            <p style={{ fontFamily: "var(--mono)", fontSize: "0.7rem", color: "var(--fg-3)", marginBottom: 6 }}>
              Validator {g.betResult.outcome === "jailed" ? "got jailed" : "stayed clean"}
            </p>
            <p style={{
              fontFamily: "var(--serif)", fontSize: "1.5rem",
              color: g.betResult.won ? "var(--common)" : "var(--legendary)",
              marginBottom: 12,
            }}>
              {g.betResult.won ? `+${g.betResult.payout.toLocaleString()} pts` : `-${g.betResult.staked} pts`}
            </p>
            {g.streak > 1 && g.betResult.won && (
              <p style={{ fontFamily: "var(--mono)", fontSize: "0.7rem", color: "var(--gold)", marginBottom: 12 }}>
                {g.streak} win streak!
              </p>
            )}
            <p style={{ fontFamily: "var(--mono)", fontSize: "0.65rem", color: "var(--fg-3)", marginBottom: 24 }}>
              balance: <span style={{ color: "var(--gold)" }}>{g.balance.toLocaleString()} pts</span>
            </p>
            <button onClick={g.handleNewRound} className="btn-primary" style={{ width: "100%", justifyContent: "center" }}>
              next round &rarr;
            </button>
          </div>
        ) : g.betPhase === "resolving" || g.betPhase === "locked" ? (
          <div style={{ textAlign: "center", padding: "48px 0" }}>
            <div className="spinner" style={{ width: 24, height: 24, margin: "0 auto 20px", borderWidth: 2 }} />
            <p style={{ fontFamily: "var(--serif)", fontSize: "1.4rem", color: "var(--cream)", marginBottom: 8 }}>
              {g.betPhase === "locked" ? "Locking in..." : "Monitoring chain..."}
            </p>
            <p style={{ fontFamily: "var(--mono)", fontSize: "0.65rem", color: "var(--fg-3)" }}>
              {g.betPhase === "resolving" ? "checking validator status on cosmos hub" : "submitting your stake"}
            </p>
          </div>
        ) : (
          /* PHASE: picking */
          <>
            {g.balance <= 0 ? (
              <div style={{ textAlign: "center", padding: "32px 0" }}>
                <p style={{ fontFamily: "var(--serif)", fontSize: "1.5rem", color: "var(--legendary)", marginBottom: 12 }}>Busted.</p>
                <p style={{ fontFamily: "var(--mono)", fontSize: "0.7rem", color: "var(--fg-3)", marginBottom: 8 }}>You&apos;re out of play points.</p>
                {g.totalBets > 0 && (
                  <p style={{ fontFamily: "var(--mono)", fontSize: "0.65rem", color: "var(--fg-3)", marginBottom: 24 }}>
                    Final record: {g.totalWins}/{g.totalBets} ({g.winRate}%) &middot; best streak: {g.bestStreak} &middot; peak: {g.highScore.toLocaleString()} pts
                  </p>
                )}
                {!g.savedScore && g.totalBets > 0 && (
                  <SaveScoreForm onSave={g.handleSaveScore} />
                )}
                {g.savedScore && (
                  <p style={{ fontFamily: "var(--mono)", fontSize: "0.65rem", color: "var(--common)", marginBottom: 16 }}>
                    score saved to leaderboard!
                  </p>
                )}
                <button onClick={g.handleRestart} className="btn-primary" style={{ width: "100%", justifyContent: "center" }}>
                  restart &mdash; 1,000 pts
                </button>
              </div>
            ) : (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 32 }}>
                  {(["clean", "jailed"] as const).map(side => (
                    <button
                      key={side}
                      onClick={() => g.setBetSide(side)}
                      style={{
                        padding: "16px 0",
                        fontFamily: "var(--mono)",
                        fontSize: "0.6rem",
                        letterSpacing: "0.15em",
                        textTransform: "uppercase",
                        cursor: "pointer",
                        transition: "all 0.2s",
                        border: g.betSide === side
                          ? `1px solid ${side === "clean" ? "var(--common)" : "var(--legendary)"}`
                          : "1px solid var(--border)",
                        background: g.betSide === side
                          ? side === "clean" ? "var(--common-bg)" : "var(--legendary-bg)"
                          : "transparent",
                        color: g.betSide === side
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
                    min={1} max={g.balance}
                    value={g.stake}
                    onChange={e => g.setStake(Math.max(1, Math.min(g.balance, Number(e.target.value))))}
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
                  <span style={{ fontFamily: "var(--mono)", fontSize: "0.75rem", color: "var(--fg-3)" }}>{ODDS[g.sv!.tier][g.betSide]}&times;</span>
                  <span style={{ fontFamily: "var(--serif)", fontSize: "1.8rem", color: "var(--cream)" }}>{payout} pts</span>
                </div>

                <button
                  onClick={g.handleLockIn}
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
  );
}
