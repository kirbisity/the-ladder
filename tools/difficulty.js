// How hard each character's climb is, from simulation. The index (0 easy, 1
// brutal) folds how rarely they reach Director or VP, how high they peak,
// how late they could retire early, the strain they take, and how often they
// end in breakdown or homelessness when played at a fixed pace (see
// DIFFICULTY in the config, and tools/sweep-report.js for the formula).
// Usage: node tools/difficulty.js [careers] [character|all]

import { CHARACTERS, DIFFICULTY } from '../src/config.js';
import { sweepCharacter } from './sweep-one.js';
import { indexFrom, fitFrom } from './sweep-report.js';

/** 1 (easiest) to 5 (hardest). */
export function difficultyRating(index) {
  return 1 + DIFFICULTY.bands.filter((band) => index > band).length;
}

export function measureCharacter(characterId, careers = 30) {
  const results = sweepCharacter(characterId, careers);
  const { index, parts } = indexFrom(results);
  return { index, parts, fit: fitFrom(results), results };
}

if (process.argv[1]?.endsWith('difficulty.js')) {
  const careers = Number(process.argv[2] ?? 30);
  const only = process.argv[3] && process.argv[3] !== 'all' ? [process.argv[3]] : CHARACTERS.map((character) => character.id);
  for (const id of only) {
    const { index, fit } = measureCharacter(id, careers);
    console.log(`${id.padEnd(10)} index ${index.toFixed(2)}  rating ${difficultyRating(index)}  best ladder ${fit.track}, field ${fit.bestIndustry}`);
  }
}
