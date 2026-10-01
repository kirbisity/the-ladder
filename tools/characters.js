// The character bench: every character plays whole careers in every
// industry with the same thoughtful (adaptive) policy, which learns a
// sustainable pace from the bars and networks in line with the political
// skill on the character card. Prints what each character's life tends to
// look like, against the design targets:
//   Joseph  — retires 90%+, senior (L3+) 85%+, little drama, Director+ ≤ 20%
//   Simon, Jennifer — more Director+ than Joseph; more health/motivation trouble
//   Chloe   — best in academia; corporate only with rest
//   Richard — climbs like Simon; more readiness from networking
//   Chris   — no burnout at long hours; management no higher than Simon/Richard
//   Adam    — the highest leadership rate
//   Eve     — like Joseph at sane hours; worse when pushed
// Usage: node tools/characters.js [careers] [industry|all] [policy]

import { playCareer } from '../src/sim/bots.js';
import { INDUSTRIES, CHARACTERS } from '../src/config.js';

const careers = Number(process.argv[2] ?? 30);
const industryArg = process.argv[3] ?? 'all';
const policyName = process.argv[4] ?? 'adaptive';
const tierArg = process.argv[5] ?? null;
const industries = industryArg === 'all' ? Object.keys(INDUSTRIES) : [industryArg];

const pct = (value) => `${Math.round(value * 100)}%`.padStart(5);
const median = (values) => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[sorted.length >> 1];
};
const avg = (list, pick) => list.reduce((sum, entry) => sum + pick(entry), 0) / list.length;

export function benchCharacter(characterId, industryId, count = careers, policy = policyName, seedBase = 9000, tierLock = tierArg) {
  const results = [];
  for (let index = 0; index < count; index += 1) results.push(playCareer({ seed: seedBase + index, characterId, industryId, policyName: policy, tierLock }));
  const share = (predicate) => results.filter(predicate).length / results.length;
  const sorted = results.map((entry) => entry.peakLevel).sort((a, b) => a - b);
  return {
    retired: share((entry) => entry.outcome === 'retired' || entry.outcome === 'fire'),
    fire: share((entry) => entry.outcome === 'fire'),
    fireAge: median(results.filter((entry) => entry.outcome === 'fire').map((entry) => entry.age)),
    fireBy50: share((entry) => entry.outcome === 'fire' && entry.age < 50),
    exitAge: median(results.filter((entry) => entry.outcome === 'fire' || entry.outcome === 'retired').map((entry) => entry.age)),
    divorced: share((entry) => entry.divorced),
    everJobless: share((entry) => entry.lostJobs > 0),
    death: share((entry) => entry.outcome === 'death'),
    breakdown: share((entry) => entry.outcome === 'breakdown'),
    homeless: share((entry) => entry.outcome === 'homeless'),
    senior: share((entry) => entry.peakLevel >= 2),
    management: share((entry) => entry.peakLevel >= 4 && entry.track !== 'expert'),
    expert: share((entry) => entry.track === 'expert'),
    director: share((entry) => entry.peakLevel >= 5),
    vp: share((entry) => entry.peakLevel >= 6),
    medianPeak: sorted[sorted.length >> 1] + 1,
    burnouts: avg(results, (entry) => entry.burnouts),
    lowHealth: avg(results, (entry) => entry.lowHealthQuarters),
    lowMotivation: avg(results, (entry) => entry.lowMotivationQuarters),
    lostJobs: avg(results, (entry) => entry.lostJobs),
    hours: avg(results, (entry) => (entry.workedQuarters ? entry.hoursSum / entry.workedQuarters : 0)),
    topRatings: avg(results, (entry) => (entry.ratedQuarters ? entry.topRatings / entry.ratedQuarters : 0)),
    politicsShare: avg(results, (entry) => (entry.readinessGained ? entry.readinessFromPolitics / entry.readinessGained : 0)),
    worth: median(results.map((entry) => entry.netWorth)),
    worthLow: results.map((entry) => entry.netWorth).sort((a, b) => a - b)[Math.floor(results.length * 0.1)],
    worthHigh: results.map((entry) => entry.netWorth).sort((a, b) => a - b)[Math.floor(results.length * 0.9)],
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const started = Date.now();
  for (const industryId of industries) {
    console.log(`\n=== ${INDUSTRIES[industryId].name}: ${careers} careers each, policy ${policyName}${tierArg ? `, ${tierArg} employers only` : ''} ===`);
    console.log('character  retire death brkdn homls senior  mgmt  dir+   vp+ expt peak burnouts lowH lowM lost hours  top% pol%   worth');
    for (const character of CHARACTERS) {
      const row = benchCharacter(character.id, industryId);
      console.log([
        character.id.padEnd(10),
        pct(row.retired), pct(row.death), pct(row.breakdown), pct(row.homeless),
        pct(row.senior), pct(row.management), pct(row.director), pct(row.vp), pct(row.expert),
        String(row.medianPeak).padStart(4),
        row.burnouts.toFixed(1).padStart(8), row.lowHealth.toFixed(1).padStart(4), row.lowMotivation.toFixed(1).padStart(4),
        row.lostJobs.toFixed(1).padStart(4), row.hours.toFixed(1).padStart(5), pct(row.topRatings), pct(row.politicsShare),
        `$${(row.worth / 1e6).toFixed(1)}M`.padStart(7),
      ].join(' '));
    }
  }
  console.log(`\n${((Date.now() - started) / 1000).toFixed(1)} s`);
}
