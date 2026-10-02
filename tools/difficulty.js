// How hard each character's climb is, from simulation: every character plays
// whole careers in every industry with the adaptive policy, and the results
// are folded into one index (0 easy, 1 brutal) and a rating from 1 to 5.
//   climb   — how rarely they reach Director or VP (the biggest part)
//   peak    — how high the median career gets
//   freedom — how late they could retire early
//   strain  — burnouts, low-health quarters and lost jobs
// Usage: node tools/difficulty.js [careers] [character|all]

import { CHARACTERS, INDUSTRIES, DIFFICULTY } from '../src/config.js';
import { benchCharacter } from './characters.js';

const clamp = (value) => Math.max(0, Math.min(1, value));
const mean = (values) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0);

/** Fold per-industry bench results into the index and its parts. */
export function difficultyIndex(perIndustry) {
  const rows = Object.values(perIndustry);
  const reach = mean(rows.map((row) => row.director + row.vp));
  const peak = mean(rows.map((row) => row.medianPeak));
  const fireAges = rows.map((row) => row.fireAge).filter(Boolean);
  const strain = mean(rows.map((row) => row.burnouts * 5 + row.lowHealth / 5 + row.lostJobs / 2));
  const w = DIFFICULTY.weights;
  const parts = {
    climb: 1 - clamp(reach / DIFFICULTY.easyReach),
    peak: 1 - clamp((peak - DIFFICULTY.lowPeak) / DIFFICULTY.peakSpan),
    freedom: clamp((mean(fireAges) - DIFFICULTY.earlyFire) / DIFFICULTY.fireSpan),
    strain: clamp(strain / DIFFICULTY.strainSpan),
  };
  const index = w.climb * parts.climb + w.peak * parts.peak + w.freedom * parts.freedom + w.strain * parts.strain;
  return { index, parts, reach, peak, fireAge: mean(fireAges), strain };
}

/** 1 (easiest) to 5 (hardest). */
export function difficultyRating(index) {
  return 1 + DIFFICULTY.bands.filter((band) => index > band).length;
}

export function measureCharacter(characterId, careers = 40) {
  const perIndustry = {};
  for (const industry of Object.keys(INDUSTRIES)) perIndustry[industry] = benchCharacter(characterId, industry, careers, 'adaptive');
  return difficultyIndex(perIndustry);
}

if (process.argv[1]?.endsWith('difficulty.js')) {
  const careers = Number(process.argv[2] ?? 40);
  const only = process.argv[3] && process.argv[3] !== 'all' ? [process.argv[3]] : CHARACTERS.map((character) => character.id);
  for (const id of only) {
    const result = measureCharacter(id, careers);
    console.log(`${id.padEnd(10)} index ${result.index.toFixed(2)}  rating ${difficultyRating(result.index)}  reach ${result.reach.toFixed(2)}  peak ${result.peak.toFixed(1)}  fireAge ${result.fireAge.toFixed(1)}  strain ${result.strain.toFixed(2)}`);
  }
}
