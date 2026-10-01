// Plays whole careers headlessly and prints outcome tables, so balance is
// argued from measurements. Usage:
//   node tools/balance.js [careers per cell] [industry|all] [character|all]
//
// The targets the dials are tuned to (chosen before the first run):
//   grinder   — fails (death or breakdown) in most careers
//   coaster   — never reaches level 4; a real share end homeless
//   balanced  — retires in nine careers of ten, in the middle of the ladder
//   adaptive  — retires in nine of ten; reaches level 5+ in about half,
//               the top two levels rarely
//   no character is best or worst at everything

import { playCareer, POLICIES } from '../src/sim/bots.js';
import { INDUSTRIES, CHARACTERS } from '../src/config.js';

const careers = Number(process.argv[2] ?? 40);
const industryArg = process.argv[3] ?? 'tech';
const characterArg = process.argv[4] ?? 'all';
const policyArg = process.argv[5] ?? 'all';

const industries = industryArg === 'all' ? Object.keys(INDUSTRIES) : [industryArg];
const characters = characterArg === 'all' ? CHARACTERS.map((entry) => entry.id) : [characterArg];
const policies = policyArg === 'all' ? Object.keys(POLICIES) : [policyArg];

function percent(count, total) {
  return `${Math.round(100 * count / total)}%`.padStart(5);
}

function median(values) {
  const sorted = values.slice().sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

// Median age on first reaching each level, among careers that reached it,
// with the share that did in brackets.
function ladderAges(results) {
  const parts = [];
  for (let level = 1; level < 8; level += 1) {
    const ages = results.map((entry) => entry.ageAtLevel[level]).filter((age) => age !== undefined);
    if (ages.length === 0) break;
    parts.push(`L${level + 1}:${Math.round(median(ages))}(${Math.round(100 * ages.length / results.length)})`);
  }
  return parts.join(' ');
}

const started = Date.now();
for (const industryId of industries) {
  console.log(`\n=== ${INDUSTRIES[industryId].name} — ${careers} careers per cell ===`);
  console.log('policy      char     retired death  brkdwn homels  L4+   L6+  medPeak medWorth   burnQ  lostJob  unempQ  firstPromo');
  for (const policyName of policies) {
    for (const characterId of characters) {
      const results = [];
      for (let index = 0; index < careers; index += 1) {
        results.push(playCareer({ seed: 1000 + index, characterId, industryId, policyName }));
      }
      const count = (predicate) => results.filter(predicate).length;
      const firstPromos = results.map((entry) => entry.firstPromotionAge).filter((age) => age !== null);
      console.log([
        policyName.padEnd(11),
        characterId.padEnd(8),
        percent(count((entry) => entry.outcome === 'retired' || entry.outcome === 'fire'), careers),
        percent(count((entry) => entry.outcome === 'death'), careers),
        percent(count((entry) => entry.outcome === 'breakdown'), careers),
        percent(count((entry) => entry.outcome === 'homeless'), careers),
        percent(count((entry) => entry.peakLevel >= 3), careers),
        percent(count((entry) => entry.peakLevel >= 5), careers),
        String(median(results.map((entry) => entry.peakLevel + 1))).padStart(6),
        `$${(median(results.map((entry) => entry.netWorth)) / 1e6).toFixed(2)}M`.padStart(9),
        (results.reduce((sum, entry) => sum + entry.burnoutQuarters, 0) / careers).toFixed(1).padStart(7),
        (results.reduce((sum, entry) => sum + entry.lostJobs, 0) / careers).toFixed(1).padStart(7),
        (results.reduce((sum, entry) => sum + entry.unemployedQuarters, 0) / careers).toFixed(1).padStart(7),
        firstPromos.length ? median(firstPromos).toFixed(1).padStart(8) : '     n/a',
        '  ages:',
        ladderAges(results),
      ].join(' '));
    }
  }
}
console.log(`\n${((Date.now() - started) / 1000).toFixed(1)} s`);
