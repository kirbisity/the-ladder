// When does each kind of employer make a career financially independent?
// Plays every character in one industry at every employer tier and prints,
// per tier, the share of careers that ever reach their FIRE number and the
// median age they first do (whether or not the bot then retires).
// Usage: node tools/fireage.js [careers per character] [industry]

import { playCareer } from '../src/sim/bots.js';
import { CHARACTERS, INDUSTRIES, TIER_MIX } from '../src/config.js';

const careers = Number(process.argv[2] ?? 6);
const industryId = process.argv[3] ?? 'tech';

const median = (values) => (values.length ? [...values].sort((a, b) => a - b)[values.length >> 1] : null);
const percent = (share) => `${Math.round(share * 100)}%`.padStart(4);

console.log(`${INDUSTRIES[industryId].name}: ${careers} careers x ${CHARACTERS.length} characters per tier`);
console.log('tier        ever  by35  by40  by50  median age');
for (const tier of Object.keys(TIER_MIX[industryId])) {
  const ages = [];
  let total = 0;
  for (const character of CHARACTERS) {
    for (let index = 0; index < careers; index += 1) {
      const result = playCareer({ seed: 7000 + index, characterId: character.id, industryId, policyName: 'adaptive', tierLock: tier });
      total += 1;
      if (result.fireReadyAge !== null) ages.push(result.fireReadyAge);
    }
  }
  const within = (age) => ages.filter((value) => value < age).length / total;
  console.log(`${tier.padEnd(11)} ${percent(ages.length / total)}  ${percent(within(35))}  ${percent(within(40))}  ${percent(within(50))}  ${median(ages)?.toFixed(0) ?? '-'}`);
}
