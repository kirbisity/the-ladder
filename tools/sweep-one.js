// One character across every industry and both tracks, for the difficulty and
// fit ratings. Misfortune is off (playCareer), so only the career decides.
// Usage: node tools/sweep-one.js <character> [careers]  → one JSON line

import { INDUSTRIES } from '../src/config.js';
import { benchCharacter } from './characters.js';

export function summarise(row) {
  return {
    director: row.director, vp: row.vp, peak: row.medianPeak, retired: row.retired, fire: row.fire, fireAge: row.fireAge,
    breakdown: row.breakdown, homeless: row.homeless, death: row.death, burnouts: row.burnouts, lowHealth: row.lowHealth,
    lowMotivation: row.lowMotivation, lostJobs: row.lostJobs, management: row.management, expert: row.expert, worth: row.worth,
  };
}

export function sweepCharacter(characterId, careers = 40) {
  const out = {};
  for (const industry of Object.keys(INDUSTRIES)) {
    out[industry] = {
      auto: summarise(benchCharacter(characterId, industry, careers, 'adaptive', 9000, null, null)),
      management: summarise(benchCharacter(characterId, industry, careers, 'adaptive', 9000, null, 'management')),
      expert: summarise(benchCharacter(characterId, industry, careers, 'adaptive', 9000, null, 'expert')),
      careless: summarise(benchCharacter(characterId, industry, careers, 'balanced', 9000, null, null)),
    };
  }
  return out;
}

if (process.argv[1]?.endsWith('sweep-one.js')) {
  const [id, careers = '40'] = process.argv.slice(2);
  console.log(JSON.stringify({ id, results: sweepCharacter(id, Number(careers)) }));
}
