// The Super Intelligence Revolution, measured: whole careers by birth year and
// industry. Prints how often careers reach Director+, are laid off, end out of
// work, and where the player sits when the revolution arrives.
// Usage: node tools/era-report.js [careers] [industry|all] [character]

import { playCareer } from '../src/sim/bots.js';
import { INDUSTRIES } from '../src/config.js';

const careers = Number(process.argv[2] ?? 20);
const industries = (process.argv[3] ?? 'all') === 'all' ? Object.keys(INDUSTRIES) : [process.argv[3]];
const characters = process.argv[4] ? [process.argv[4]] : ['joseph', 'simon', 'adam', 'eve'];
const years = [1980, 1990, 2000, 2004, 2010];
const pct = (value) => `${Math.round(value * 100)}%`.padStart(5);

for (const industryId of industries) {
  console.log(`\n=== ${INDUSTRIES[industryId].name} ===`);
  console.log('born  retired fire  dir+  lostJob/career  homeless+brk  peak');
  for (const birthYear of years) {
    const rows = [];
    for (const characterId of characters) for (let index = 0; index < careers; index += 1) rows.push(playCareer({ seed: 7700 + index, characterId, industryId, policyName: 'adaptive', birthYear }));
    const share = (test) => rows.filter(test).length / rows.length;
    const mean = (pick) => rows.reduce((sum, row) => sum + pick(row), 0) / rows.length;
    console.log(`${birthYear}  ${pct(share((r) => r.outcome === 'retired'))} ${pct(share((r) => r.outcome === 'fire'))} ${pct(share((r) => r.peakLevel >= 5))}  ${mean((r) => r.lostJobs).toFixed(2).padStart(6)}        ${pct(share((r) => r.outcome === 'homeless' || r.outcome === 'breakdown'))}   ${mean((r) => r.peakLevel + 1).toFixed(1)}`);
  }
}
