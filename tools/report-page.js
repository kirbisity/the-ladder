// Builds the outcome report page from the JSON that tools/report.js writes:
// one file per industry plus extras.json (long hours and the spiral).
// Usage: node tools/report-page.js <dir with the json files> <out.html>

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { CHARACTERS, INDUSTRIES, COMPANY_TIERS } from '../src/config.js';

const dir = process.argv[2] ?? '.';
const outPath = process.argv[3] ?? 'report.html';

const data = { industries: {}, careers: 0 };
for (const industryId of Object.keys(INDUSTRIES)) {
  const path = join(dir, `${industryId}.json`);
  if (!existsSync(path)) continue;
  const grid = JSON.parse(readFileSync(path, 'utf8'));
  data.careers = grid.careers;
  data.industries[industryId] = grid.industries[industryId];
}
const extras = JSON.parse(readFileSync(join(dir, 'extras.json'), 'utf8'));
data.longHours = extras.longHours;
data.spiral = extras.spiral;
data.characters = CHARACTERS.map((character) => ({ id: character.id, name: character.name, archetype: character.archetype, iq: character.iq, pol: character.pol }));
data.industryNames = Object.fromEntries(Object.entries(INDUSTRIES).map(([id, industry]) => [id, industry.name]));
data.tiers = Object.fromEntries(Object.entries(COMPANY_TIERS).map(([id, tier]) => [id, { name: tier.name, blurb: tier.blurb }]));
data.tiers.mixed = { name: 'Real mix', blurb: 'Employers drawn from the industry\'s mix; hops cross tiers.' };

const page = readFileSync(new URL('./report-template.html', import.meta.url), 'utf8')
  .replace('/*DATA*/null', JSON.stringify(data));
writeFileSync(outPath, page);
console.log(`Wrote ${outPath}`);
