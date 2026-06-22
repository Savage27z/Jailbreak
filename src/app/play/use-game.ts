"use client";

import { useEffect, useState, useCallback } from "react";
import { playFlip, playWin, playLoss, playLockIn } from "./sounds";
import { getLeaderboard, addToLeaderboard, isHighScore } from "./leaderboard";
import type { LeaderboardEntry } from "./leaderboard";

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
  narrator_clean: string;
  narrator_jailed: string;
  insight: string;
}

type BetSide = "jailed" | "clean";
type BetPhase = "picking" | "locked" | "resolving" | "resolved";

interface BetResult {
  outcome: "jailed" | "clean";
  won: boolean;
  payout: number;
  staked: number;
  narrator: string;
  insight: string;
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

const STARTING_BALANCE = 1000;

export type { Validator, ScoredValidator, BetSide, BetPhase, BetResult };
export { ODDS, JAIL_PROBABILITY, STARTING_BALANCE };

export function useGame() {
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
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [savedScore, setSavedScore] = useState(false);

  useEffect(() => {
    fetch("/api/validators")
      .then(r => r.json())
      .then(data => { if (data.error) setFetchError(data.error); else setValidators(data.validators); })
      .catch(() => setFetchError("Failed to fetch validators"));
    setLeaderboard(getLeaderboard());
  }, []);

  const handleFlip = useCallback(async (addr: string) => {
    if (flipped.has(addr) || loading.has(addr)) return;
    playFlip();
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

    playLockIn();
    setBalance(b => b - actualStake);
    setBetPhase("locked");
    setTotalBets(n => n + 1);

    setTimeout(() => {
      setBetPhase("resolving");
    }, 800);

    const tier = currentSv.tier;
    const side = betSide;
    const lockedStake = actualStake;
    const narratorClean = currentSv.narrator_clean;
    const narratorJailed = currentSv.narrator_jailed;
    const svInsight = currentSv.insight;
    setTimeout(() => {
      const jailChance = JAIL_PROBABILITY[tier];
      const outcome: "jailed" | "clean" = Math.random() < jailChance ? "jailed" : "clean";
      const won = outcome === side;
      const winPayout = won ? Math.round(lockedStake * ODDS[tier][side]) : 0;
      const narrator = outcome === "jailed" ? narratorJailed : narratorClean;

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

      if (won) playWin(); else playLoss();
      setBetResult({ outcome, won, payout: winPayout, staked: lockedStake, narrator, insight: svInsight });
      setBetPhase("resolved");
    }, 3000);
  }, [selected, scored, stake, balance, betSide]);

  const handleNewRound = useCallback(() => {
    setSelected(null);
    setBetPhase("picking");
    setBetResult(null);
    setBetSide("clean");
    setFlipped(new Set());
    setScored(new Map());
    setLoading(new Set());
    fetch("/api/validators?refresh=1")
      .then(r => r.json())
      .then(data => { if (!data.error) setValidators(data.validators); })
      .catch(() => {});
  }, []);

  const handleSaveScore = useCallback((name: string) => {
    const board = addToLeaderboard({
      name,
      score: highScore,
      bets: totalBets,
      wins: totalWins,
      bestStreak,
    });
    setLeaderboard(board);
    setSavedScore(true);
  }, [highScore, totalBets, totalWins, bestStreak]);

  const handleRestart = useCallback(() => {
    setBalance(STARTING_BALANCE);
    setStreak(0);
    setBestStreak(0);
    setHighScore(STARTING_BALANCE);
    setTotalBets(0);
    setTotalWins(0);
    setSavedScore(false);
    handleNewRound();
  }, [handleNewRound]);

  const sv = selected ? scored.get(selected) : null;
  const winRate = totalBets > 0 ? Math.round((totalWins / totalBets) * 100) : 0;

  return {
    validators, scored, flipped, loading, selected, setSelected,
    betSide, setBetSide, stake, setStake, betPhase, setBetPhase,
    betResult, setBetResult, balance, streak, bestStreak, highScore,
    totalBets, totalWins, winRate, fetchError, sv,
    leaderboard, showLeaderboard, setShowLeaderboard, savedScore,
    handleFlip, handleLockIn, handleNewRound, handleRestart, handleSaveScore,
  };
}
