// Motion curves for the archive scene.
// Adapted from RhineLabUI (src/motion.ts), Copyright (c) 2026 LBEILC, MIT License.
// https://github.com/LBEILC/RhineLabUI

/** Quintic smoothstep: zero velocity and acceleration at both ends. */
export const smooth = (t: number) => {
  t = Math.max(0, Math.min(1, t));
  return t * t * t * (10 + t * (-15 + 6 * t));
};

export const bell = (x: number, width: number) => Math.exp(-0.5 * (x / width) ** 2);

/** Quiet idle drift, neighbouring files slightly out of phase (the "breathing"). */
export function idleWave(row: number, lane: number, time: number) {
  return (
    0.075 * Math.sin((time * Math.PI * 2) / 8 + row * 0.3 - lane * 0.45) +
    0.027 * Math.sin((time * Math.PI * 2) / 13 - row * 0.17 + lane * 0.3)
  );
}

/** Signed ripple travelling outward from a newly selected file. */
export function selectionWave(distance: number, age: number) {
  if (age < 0 || age > 3.2) return 0;
  return (
    0.8 *
    smooth(age / 0.2) *
    Math.exp(-age * 1.15) *
    Math.cos((distance - age * 8) * 0.58) *
    bell(distance - age * 8, 3.4)
  );
}

/** One travelling packet with a trailing trough: used when the whole archive is swapped. */
export function swapWave(phase: number, age: number) {
  if (age <= 0 || age >= 2.4) return 0;
  const front = -4 + age * 26;
  const d = phase - front;
  return smooth(age / 0.25) * (1 - smooth((age - 1.6) / 0.8)) * (2.2 * bell(d, 3.2) - 0.55 * bell(d - 6, 3.4));
}

export interface Spring {
  value: number;
  velocity: number;
}

/** Critically damped spring step. */
export function damp(s: Spring, target: number, rate: number, dt: number) {
  const delta = s.value - target;
  const impulse = s.velocity + rate * delta;
  const decay = Math.exp(-rate * dt);
  s.value = target + (delta + impulse * dt) * decay;
  s.velocity = (s.velocity - rate * impulse * dt) * decay;
}

export const spring = (value = 0): Spring => ({ value, velocity: 0 });
