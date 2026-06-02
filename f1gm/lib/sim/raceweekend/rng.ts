import { RngState } from "@/lib/sim/raceweekend/raceTypes";

// Mulberry32: tiny, fast, deterministic PRNG with serializable numeric state.

export function createRng(seed: number): RngState {
  // Force an unsigned 32-bit integer seed.
  const normalized = seed >>> 0;
  return { seed: normalized, state: normalized };
}

/** Advances rng state in place and returns a float in [0, 1). */
export function nextFloat(rng: RngState): number {
  rng.state = (rng.state + 0x6d2b79f5) >>> 0;
  let t = rng.state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Float in [min, max). */
export function range(rng: RngState, min: number, max: number): number {
  return min + nextFloat(rng) * (max - min);
}

/** Integer in [min, max] inclusive. */
export function rangeInt(rng: RngState, min: number, max: number): number {
  return Math.floor(range(rng, min, max + 1));
}

/** Approximately normal random via central limit (mean 0, ~unit stddev). */
export function gaussian(rng: RngState): number {
  return (nextFloat(rng) + nextFloat(rng) + nextFloat(rng) + nextFloat(rng) - 2) / 0.816;
}

/** True with the given probability (0..1). */
export function chance(rng: RngState, probability: number): boolean {
  return nextFloat(rng) < probability;
}

export function pick<T>(rng: RngState, items: readonly T[]): T {
  return items[Math.min(items.length - 1, Math.floor(nextFloat(rng) * items.length))];
}

/** Derive a fresh, independent rng from an existing one (for sub-sessions). */
export function deriveRng(rng: RngState, salt: number): RngState {
  const mixed = (rng.state ^ Math.imul(salt + 1, 0x9e3779b1)) >>> 0;
  return createRng(mixed);
}
