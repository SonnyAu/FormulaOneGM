import { DriverProfile } from "@/lib/sim/raceweekend/raceTypes";
import { DriverSeasonInfo } from "@/types/sim";

export const AGE_YOUNG_MAX = 26;
export const AGE_PRIME_MIN = 27;
export const AGE_PRIME_MAX = 34;
export const AGE_VETERAN_MIN = 35;

export const RETIREMENT_OVERALL_THRESHOLD = 72;
export const RETIREMENT_TRAIT_FLOOR = 68;

const TRAIT_KEYS: Array<keyof Omit<DriverProfile, "id" | "name" | "overall">> = [
  "qualifying",
  "racePace",
  "tireManagement",
  "overtaking",
  "defending",
  "consistency",
  "wetWeather",
  "braking",
  "traction",
  "lowSpeed",
  "highSpeed",
  "adaptability",
];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function cloneProfile(profile: DriverProfile): DriverProfile {
  return { ...profile };
}

function recomputeOverall(profile: DriverProfile): number {
  const sum = TRAIT_KEYS.reduce((acc, key) => acc + profile[key], 0);
  return clamp(Math.round(sum / TRAIT_KEYS.length), 40, 99);
}

function lerpTrait(current: number, target: number, delta: number): number {
  if (current < target) return clamp(current + delta, 40, 99);
  if (current > target) return clamp(current - delta, 40, 99);
  return current;
}

function applyTraitDelta(profile: DriverProfile, peak: DriverProfile, delta: number, towardPeak: boolean): void {
  for (const key of TRAIT_KEYS) {
    const target = peak[key];
    profile[key] = towardPeak ? lerpTrait(profile[key], target, delta) : lerpTrait(profile[key], target - 8, delta);
  }
  profile.overall = recomputeOverall(profile);
  profile.overall = clamp(profile.overall, 40, peak.overall);
}

/** Young drivers improve faster when further below peak. */
function youngImprovementRate(driver: DriverSeasonInfo): number {
  const gap = driver.peakProfile.overall - driver.profile.overall;
  if (gap <= 0) return 0.5;
  if (gap > 12) return 3;
  if (gap > 6) return 2;
  return 1;
}

/** Veterans regress faster as they age. */
function veteranRegressionRate(age: number): number {
  const yearsPastPrime = Math.max(0, age - AGE_VETERAN_MIN);
  return 1 + yearsPastPrime * 0.5;
}

/** Prime-age drivers get small random fluctuation. */
function primeJitter(): number {
  return Math.random() < 0.5 ? 0 : Math.random() < 0.5 ? 1 : -1;
}

/**
 * Apply one season of age-based progression/regression. Call after incrementing age.
 */
export function applyDriverCareerTick(driver: DriverSeasonInfo): void {
  const peak = driver.peakProfile;
  const profile = driver.profile;

  if (driver.age <= AGE_YOUNG_MAX) {
    const rate = youngImprovementRate(driver);
    applyTraitDelta(profile, peak, rate, true);
    return;
  }

  if (driver.age >= AGE_PRIME_MIN && driver.age <= AGE_PRIME_MAX) {
    const jitter = primeJitter();
    if (jitter !== 0) {
      for (const key of TRAIT_KEYS) {
        profile[key] = clamp(profile[key] + jitter, 40, peak[key]);
      }
    }
    profile.overall = clamp(recomputeOverall(profile), 40, peak.overall);
    return;
  }

  if (driver.age >= AGE_VETERAN_MIN) {
    const rate = veteranRegressionRate(driver.age);
    applyTraitDelta(profile, peak, rate, false);
  }
}

export function shouldRetire(driver: DriverSeasonInfo): boolean {
  if (!driver.active) return false;
  const { profile } = driver;
  if (profile.overall < RETIREMENT_OVERALL_THRESHOLD) return true;
  if (profile.qualifying < RETIREMENT_TRAIT_FLOOR) return true;
  if (profile.racePace < RETIREMENT_TRAIT_FLOOR) return true;
  if (profile.consistency < RETIREMENT_TRAIT_FLOOR) return true;
  return false;
}

/** Build initial live profile from peak based on starting age. */
export function initialProfileFromPeak(peak: DriverProfile, age: number): DriverProfile {
  const profile = cloneProfile(peak);
  if (age <= AGE_YOUNG_MAX) {
    const deficit = Math.min(8, Math.max(2, AGE_YOUNG_MAX - age));
    for (const key of TRAIT_KEYS) {
      profile[key] = clamp(peak[key] - deficit, 40, 99);
    }
  } else if (age >= AGE_VETERAN_MIN) {
    const decline = Math.min(12, (age - AGE_VETERAN_MIN) * 1.2);
    for (const key of TRAIT_KEYS) {
      profile[key] = clamp(peak[key] - decline, 40, 99);
    }
  }
  profile.overall = recomputeOverall(profile);
  return profile;
}

export function isLikelyRetirement(driver: DriverSeasonInfo): boolean {
  if (!driver.active || driver.age < AGE_VETERAN_MIN) return false;
  const margin = driver.profile.overall - RETIREMENT_OVERALL_THRESHOLD;
  return margin <= 5;
}
