"use client";

export interface LeaderboardEntry {
  name: string;
  score: number;
  bets: number;
  wins: number;
  bestStreak: number;
  date: string;
}

const STORAGE_KEY = "jailbreak_leaderboard";
const MAX_ENTRIES = 10;

export function getLeaderboard(): LeaderboardEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, MAX_ENTRIES);
  } catch {
    return [];
  }
}

export function addToLeaderboard(entry: Omit<LeaderboardEntry, "date">): LeaderboardEntry[] {
  const board = getLeaderboard();
  const full: LeaderboardEntry = { ...entry, date: new Date().toISOString().slice(0, 10) };
  board.push(full);
  board.sort((a, b) => b.score - a.score);
  const trimmed = board.slice(0, MAX_ENTRIES);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch { /* storage full */ }
  return trimmed;
}

export function isHighScore(score: number): boolean {
  const board = getLeaderboard();
  if (board.length < MAX_ENTRIES) return true;
  return score > (board[board.length - 1]?.score ?? 0);
}
