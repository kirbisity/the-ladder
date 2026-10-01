// The outcome report: every character plays whole careers at every kind of
// employer, one tier at a time (job hops stay within the tier), plus the
// natural mix, where hops cross tiers. Writes the grid as JSON for the
// report page.
// Also: each character on a fixed twelve-hour schedule (who can sustain it),
// and the unemployment spiral by age.
// Usage: node tools/report.js [careers] [industry|all|extras] [out.json]

import { writeFileSync } from 'node:fs';
import { benchCharacter } from './characters.js';
import { measureSpiral } from './spiral.js';
import { INDUSTRIES, CHARACTERS, TIER_MIX } from '../src/config.js';

const careers = Number(process.argv[2] ?? 40);
const industryArg = process.argv[3] ?? 'all';
const outPath = process.argv[4] ?? 'report.json';
const industries = industryArg === 'all' ? Object.keys(INDUSTRIES) : industryArg === 'extras' ? [] : [industryArg];

const started = Date.now();
const grid = { careers, policy: 'adaptive', industries: {} };
for (const industryId of industries) {
  const tiers = [...Object.keys(TIER_MIX[industryId]), 'mixed'];
  grid.industries[industryId] = {};
  for (const character of CHARACTERS) {
    grid.industries[industryId][character.id] = {};
    for (const tier of tiers) {
      grid.industries[industryId][character.id][tier] = benchCharacter(character.id, industryId, careers, 'adaptive', 9000, tier === 'mixed' ? null : tier);
    }
    console.log(`${industryId} ${character.id} done (${((Date.now() - started) / 1000).toFixed(0)} s)`);
  }
}
if (industryArg === 'all' || industryArg === 'extras') {
  grid.longHours = {};
  for (const character of CHARACTERS) grid.longHours[character.id] = benchCharacter(character.id, 'tech', careers, 'longHours', 9000, null);
  console.log(`long hours done (${((Date.now() - started) / 1000).toFixed(0)} s)`);
  grid.spiral = { young: measureSpiral(careers * 4, 27), established: measureSpiral(careers * 4, 35) };
  console.log(`spiral done (${((Date.now() - started) / 1000).toFixed(0)} s)`);
}
writeFileSync(outPath, JSON.stringify(grid, null, 1));
console.log(`Wrote ${outPath}`);
