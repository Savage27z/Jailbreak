"use client";

let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

function play(setup: (ac: AudioContext, t: number) => void) {
  try {
    const ac = getCtx();
    if (ac.state === "suspended") ac.resume();
    setup(ac, ac.currentTime);
  } catch { /* audio not available */ }
}

export function playFlip() {
  play((ac, t) => {
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(800, t);
    o.frequency.exponentialRampToValueAtTime(1200, t + 0.06);
    g.gain.setValueAtTime(0.08, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    o.connect(g).connect(ac.destination);
    o.start(t);
    o.stop(t + 0.12);
  });
}

export function playWin() {
  play((ac, t) => {
    [523, 659, 784].forEach((freq, i) => {
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = "sine";
      o.frequency.value = freq;
      g.gain.setValueAtTime(0, t + i * 0.1);
      g.gain.linearRampToValueAtTime(0.1, t + i * 0.1 + 0.03);
      g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.1 + 0.25);
      o.connect(g).connect(ac.destination);
      o.start(t + i * 0.1);
      o.stop(t + i * 0.1 + 0.25);
    });
  });
}

export function playLoss() {
  play((ac, t) => {
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(300, t);
    o.frequency.exponentialRampToValueAtTime(120, t + 0.3);
    g.gain.setValueAtTime(0.06, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    o.connect(g).connect(ac.destination);
    o.start(t);
    o.stop(t + 0.35);
  });
}

export function playLockIn() {
  play((ac, t) => {
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = "triangle";
    o.frequency.setValueAtTime(440, t);
    o.frequency.setValueAtTime(440, t + 0.05);
    o.frequency.setValueAtTime(550, t + 0.1);
    g.gain.setValueAtTime(0.07, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    o.connect(g).connect(ac.destination);
    o.start(t);
    o.stop(t + 0.2);
  });
}
