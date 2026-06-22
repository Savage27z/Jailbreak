"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { el.classList.add("visible"); obs.unobserve(el); } },
      { threshold: 0.08 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return ref;
}

function R({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useReveal();
  return (
    <div ref={ref} className={`reveal ${className}`} style={delay ? { transitionDelay: `${delay}ms` } : undefined}>
      {children}
    </div>
  );
}

const CARDS = [
  {
    id: "0117",
    tier: "rare" as const,
    moniker: "Stakecito",
    tokens: "4.2M ATOM",
    commission: "8.0%",
    reason: "Commission adjusted twice in 90 days. Operational instability or strategic repositioning — either way, watch it.",
  },
  {
    id: "0009",
    tier: "legendary" as const,
    moniker: "ghost-validator",
    tokens: "200 ATOM",
    commission: "10.0%",
    reason: "Jailed for 47 days with minimal stake. This is not dormant — this is abandoned.",
  },
];

function FlipCard({ card }: { card: typeof CARDS[0] }) {
  const [flipped, setFlipped] = useState(false);
  const tierColor = card.tier === "legendary" ? "var(--legendary)" : card.tier === "rare" ? "var(--rare)" : "var(--common)";

  return (
    <div
      className="perspective"
      style={{ width: "100%", aspectRatio: "4/5", cursor: "pointer" }}
      onClick={() => setFlipped(p => !p)}
    >
      <div className={`card-inner w-full h-full ${flipped ? "flipped" : ""}`} style={{ position: "relative" }}>
        {/* FRONT */}
        <div style={{
          position: "absolute", inset: 0, backfaceVisibility: "hidden",
          background: "var(--cream)", borderRadius: 16,
          boxShadow: "0 30px 80px rgba(0,0,0,0.5)",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          overflow: "hidden",
        }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: tierColor, borderRadius: "16px 16px 0 0" }} />
          <svg width="100" height="100" viewBox="0 0 120 120" fill="none" style={{ opacity: 0.15 }}>
            <path d="M60 0L67.5 45.3L105.3 14.7L74.7 52.5L120 60L74.7 67.5L105.3 105.3L67.5 74.7L60 120L52.5 74.7L14.7 105.3L45.3 67.5L0 60L45.3 52.5L14.7 14.7L52.5 45.3L60 0Z" fill="var(--bg)" />
          </svg>
          <p style={{ fontFamily: "var(--mono)", fontSize: "0.65rem", letterSpacing: "0.25em", textTransform: "uppercase", color: "rgba(10,14,26,0.5)", marginTop: 20 }}>
            N° {card.id}
          </p>
          <p style={{ fontFamily: "var(--mono)", fontSize: "0.5rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(10,14,26,0.35)", marginTop: 6 }}>click to flip</p>
        </div>

        {/* BACK */}
        <div style={{
          position: "absolute", inset: 0, backfaceVisibility: "hidden",
          transform: "rotateY(180deg)",
          background: "var(--cream)", borderRadius: 16,
          boxShadow: `0 30px 80px rgba(0,0,0,0.5), 0 0 0 1px ${tierColor}`,
          display: "flex", flexDirection: "column",
          padding: "clamp(24px, 4vw, 40px)",
          overflow: "hidden",
        }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: tierColor, borderRadius: "16px 16px 0 0" }} />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", paddingTop: 12 }}>
            <div>
              <span className={`badge badge-${card.tier}`}>{card.tier}</span>
              <p style={{ fontFamily: "var(--serif)", fontSize: "clamp(1.5rem, 3vw, 2.5rem)", color: "var(--bg)", lineHeight: 1.15, marginTop: 20 }}>{card.moniker}</p>
              <p style={{ fontFamily: "var(--mono)", fontSize: "0.7rem", color: "rgba(10,14,26,0.3)", marginTop: 10 }}>{card.tokens} · {card.commission}</p>
            </div>
            <div>
              <hr style={{ border: "none", height: 1, background: "rgba(10,14,26,0.08)", marginBottom: 20 }} />
              <p style={{ fontFamily: "var(--mono)", fontSize: "0.75rem", lineHeight: 1.8, color: "rgba(10,14,26,0.45)" }}>
                &ldquo;{card.reason}&rdquo;
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Landing() {
  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
      {/* NAV */}
      <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 50, padding: "20px 32px", background: "rgba(10,14,26,0.85)", backdropFilter: "blur(20px)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontFamily: "var(--serif)", fontSize: "1.5rem", color: "var(--cream)" }}>Jailbreak</span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Link href="#how" className="btn-outline hidden md:inline-flex">the mechanics</Link>
            <Link href="/play" className="btn-outline" style={{ borderColor: "var(--gold)", color: "var(--gold)" }}>enter the pool →</Link>
          </div>
        </div>
      </nav>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px" }}>

        {/* ---- HERO ---- */}
        <section style={{ paddingTop: 160, paddingBottom: 40, position: "relative" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "clamp(32px, 5vw, 64px)", alignItems: "center", width: "100%" }}>
            <div>
              <R>
                <p className="label-accent" style={{ marginBottom: 28 }}>a validator risk game · cosmos hub</p>
              </R>
              <R delay={100}>
                <h1 className="display" style={{ marginBottom: 40 }}>
                  Every validator<br />is a card you<br />haven&apos;t <em>flipped.</em>
                </h1>
              </R>
              <R delay={200}>
                <p className="body-serif" style={{ maxWidth: 480, marginBottom: 40, fontSize: "clamp(1rem, 1.4vw, 1.15rem)" }}>
                  Type the validator you&apos;re curious about. An AI strategist scores its slashing risk as a card — then reads you the verdict.
                </p>
              </R>
              <R delay={300}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <Link href="/play" className="btn-primary">pull a card →</Link>
                </div>
              </R>
            </div>
            <R delay={400}>
              <div style={{ width: "clamp(220px, 25vw, 320px)" }}>
                <FlipCard card={CARDS[1]} />
              </div>
            </R>
          </div>
          {/* hero footer */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 60, paddingTop: 0 }}>
            <span className="label">built for cosmos hackathon 2026</span>
            <span className="label">scroll ↓</span>
          </div>
        </section>

        {/* ---- MANIFESTO ---- */}
        <section style={{ padding: "clamp(80px, 12vw, 160px) 0", textAlign: "center" }}>
          <R>
            <p className="label" style={{ marginBottom: 24 }}>— our manifesto · 01 —</p>
          </R>
          <R delay={100}>
            <h2 style={{
              fontFamily: "var(--serif)",
              fontSize: "clamp(2.5rem, 7vw, 6rem)",
              fontWeight: 400,
              lineHeight: 1.05,
              color: "var(--cream)",
              maxWidth: 900,
              margin: "0 auto 40px",
            }}>
              PULLED <em style={{ fontStyle: "italic", color: "var(--orange)" }}>blind,</em><br />
              SCORED <em style={{ fontStyle: "italic", color: "var(--orange)" }}>cold,</em><br />
              STAKED <span style={{ color: "var(--fg-3)" }}>ANYWAY.</span>
            </h2>
          </R>
          <R delay={200}>
            <p className="body-serif" style={{ maxWidth: 640, margin: "0 auto", fontSize: "clamp(1rem, 1.4vw, 1.15rem)" }}>
              Every hard staking decision dies in a spreadsheet nobody re-reads. Jailbreak turns it into a card you can hold — risk tier, AI verdict, and a bet you actually have to make.
            </p>
          </R>
        </section>
      </div>

      {/* ---- HOW IT WORKS (cream, full-width) ---- */}
      <section className="section-cream" style={{ padding: "clamp(80px, 10vw, 120px) 0" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px" }}>
          <R>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 12 }}>
              <h2 style={{ fontFamily: "var(--serif)", fontSize: "clamp(2.2rem, 5vw, 4.5rem)", color: "#0a0e1a", lineHeight: 1 }}>
                How it works
              </h2>
              <span className="label" style={{ color: "rgba(10,14,26,0.3)" }}>three steps · one minute</span>
            </div>
          </R>
          <hr style={{ border: "none", height: 1, background: "rgba(10,14,26,0.12)", marginBottom: 64 }} />
          <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: "clamp(32px, 4vw, 64px)" }}>
            {[
              { n: "01", title: "Pull a card", desc: "Tap any face-down validator card. The app fetches live staking data from the Cosmos Hub and sends it to the AI." },
              { n: "02", title: "Read the verdict", desc: "The AI scores slashing risk and assigns a rarity tier: common, rare, or legendary. The card flips to reveal." },
              { n: "03", title: "Stake your call", desc: "Pick a side — stays clean or gets jailed. Enter your play-point stake, see the payout, and lock it in." },
            ].map((step, i) => (
              <R key={step.n} delay={i * 120}>
                <div>
                  <p style={{ fontFamily: "var(--serif)", fontSize: "clamp(2rem, 3.5vw, 3.5rem)", color: "var(--orange)", fontStyle: "italic", marginBottom: 16 }}>{step.n}</p>
                  <h3 style={{ fontFamily: "var(--serif)", fontSize: "clamp(1.2rem, 1.8vw, 1.6rem)", marginBottom: 16, color: "#0a0e1a" }}>{step.title}</h3>
                  <p style={{ fontFamily: "var(--mono)", fontSize: "0.72rem", lineHeight: 1.85, color: "rgba(10,14,26,0.45)" }}>{step.desc}</p>
                </div>
              </R>
            ))}
          </div>
        </div>
      </section>

      {/* ---- THE ODDS (orange, full-width) ---- */}
      <section className="section-orange" style={{ padding: "clamp(80px, 10vw, 120px) 0" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px" }}>
          <R>
            <p className="label" style={{ marginBottom: 12, color: "rgba(10,14,26,0.4)" }}>the mechanic — why this isn&apos;t luck</p>
          </R>
          <R delay={80}>
            <h2 style={{ fontFamily: "var(--serif)", fontSize: "clamp(2.5rem, 6vw, 5.5rem)", color: "#0a0e1a", lineHeight: 1.05, marginBottom: 56 }}>
              What you&apos;re <em style={{ fontStyle: "italic" }}>risking.</em>
            </h2>
          </R>
          <hr className="divider" style={{ background: "rgba(10,14,26,0.15)", marginBottom: 48 }} />
          <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: "clamp(24px, 3vw, 48px)" }}>
            {[
              { tier: "common", label: "Low risk", clean: "1.15×", jailed: "4.5×" },
              { tier: "rare", label: "Medium risk", clean: "1.8×", jailed: "2.0×" },
              { tier: "legendary", label: "High danger", clean: "3.2×", jailed: "1.3×" },
            ].map((t, i) => (
              <R key={t.tier} delay={i * 100}>
                <div style={{ borderTop: "2px solid rgba(10,14,26,0.15)", paddingTop: 24 }}>
                  <p className="label" style={{ color: "rgba(10,14,26,0.4)", marginBottom: 8 }}>{t.tier}</p>
                  <p style={{ fontFamily: "var(--serif)", fontSize: "1.15rem", color: "var(--bg)", marginBottom: 32 }}>{t.label}</p>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                    <div>
                      <p className="label" style={{ color: "rgba(10,14,26,0.3)", marginBottom: 8 }}>stays clean</p>
                      <p style={{ fontFamily: "var(--serif)", fontSize: "clamp(2rem, 4vw, 3.5rem)", color: "var(--bg)", lineHeight: 1 }}>{t.clean}</p>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <p className="label" style={{ color: "rgba(10,14,26,0.3)", marginBottom: 8 }}>gets jailed</p>
                      <p style={{ fontFamily: "var(--serif)", fontSize: "clamp(2rem, 4vw, 3.5rem)", color: "var(--bg)", lineHeight: 1 }}>{t.jailed}</p>
                    </div>
                  </div>
                </div>
              </R>
            ))}
          </div>
        </div>
      </section>

      {/* ---- CTA (dark) ---- */}
      <section style={{ padding: "clamp(80px, 10vw, 140px) 0", textAlign: "center" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px" }}>
          <R>
            <p className="label" style={{ marginBottom: 24 }}>no sign-up · no wallet · one minute</p>
          </R>
          <R delay={100}>
            <h2 style={{ fontFamily: "var(--serif)", fontSize: "clamp(2.5rem, 7vw, 6rem)", color: "var(--cream)", lineHeight: 1, marginBottom: 48 }}>
              The pool is <em style={{ fontStyle: "italic", color: "var(--gold)" }}>open.</em>
            </h2>
          </R>
          <R delay={200}>
            <Link href="/play" className="btn-primary" style={{ fontSize: "0.75rem", padding: "24px 48px" }}>enter the pool →</Link>
          </R>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ padding: "24px 32px", borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span className="label">jailbreak — live cosmos hub data, simulated stakes</span>
        <span className="label">hackathon 2026</span>
      </footer>
    </div>
  );
}
