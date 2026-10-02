// Reads the JSON from tools/sweep-all.sh and prints, for each character, the
// reach (Director + VP share) and ruin (breakdown + homeless share) by industry
// and track, then the difficulty index, best track and best industry.
// Usage: node tools/sweep-report.js [dir]

import fs from 'node:fs';
import { CHARACTERS, INDUSTRIES, DIFFICULTY } from '../src/config.js';

const clamp = (value) => Math.max(0, Math.min(1, value));
const mean = (values) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0);

export const reach = (row) => row.director + row.vp;
export const ruin = (row) => row.breakdown + row.homeless;

/** Difficulty index (0 easy, 1 brutal) from a character's auto-track results across industries. */
export function indexFrom(results) {
  const rows = Object.values(results).map((industry) => industry.auto);
  const w = DIFFICULTY.weights;
  const fireAges = rows.map((row) => row.fireAge).filter(Boolean);
  const parts = {
    climb: 1 - clamp(mean(rows.map(reach)) / DIFFICULTY.easyReach),
    peak: 1 - clamp((mean(rows.map((row) => row.peak)) - DIFFICULTY.lowPeak) / DIFFICULTY.peakSpan),
    freedom: clamp((mean(fireAges) - DIFFICULTY.earlyFire) / DIFFICULTY.fireSpan),
    strain: clamp(mean(rows.map((row) => row.burnouts * 5 + row.lowHealth / 5 + row.lostJobs / 2)) / DIFFICULTY.strainSpan),
    ruin: clamp(mean(Object.values(results).map((industry) => ruin(industry.careless ?? industry.auto))) / DIFFICULTY.ruinSpan),
  };
  const index = w.climb * parts.climb + w.peak * parts.peak + w.freedom * parts.freedom + w.strain * parts.strain + w.ruin * parts.ruin;
  return { index, parts };
}

export const ratingOf = (index) => 1 + DIFFICULTY.bands.filter((band) => index > band).length;

/** The track and field that suit them: management, expert, or both when they are close. */
export function fitFrom(results) {
  const score = (key) => mean(Object.values(results).map((industry) => reach(industry[key]) - 2 * ruin(industry[key])));
  const management = score('management');
  const expert = score('expert');
  const best = Math.max(management, expert);
  // Either ladder: when neither climbs far (a steady life on any), when they are level, or when both are strong.
  const either = best < 0.15 || Math.abs(management - expert) <= 0.08 || Math.min(management, expert) >= 0.9;
  const track = either ? 'hybrid' : management > expert ? 'management' : 'expert';
  const byIndustry = Object.entries(results).map(([id, industry]) => ({ id, value: reach(industry.auto) - 2 * ruin(industry.auto) + industry.auto.peak * 0.02 }))
    .sort((a, b) => b.value - a.value);
  return { track, management, expert, bestIndustry: byIndustry[0].id, worstIndustry: byIndustry[byIndustry.length - 1].id, byIndustry };
}

if (process.argv[1]?.endsWith('sweep-report.js')) {
  const dir = process.argv[2] ?? '/tmp/ladder-sweep';
  const pct = (value) => `${Math.round(value * 100)}%`.padStart(4);
  for (const character of CHARACTERS) {
    const file = `${dir}/${character.id}.json`;
    if (!fs.existsSync(file)) continue;
    let results;
    try { results = JSON.parse(fs.readFileSync(file, 'utf8')).results; } catch { continue; }
    const { index, parts } = indexFrom(results);
    const fit = fitFrom(results);
    console.log(`\n${character.id.padEnd(10)} target ${character.difficulty}  index ${index.toFixed(2)} → ${ratingOf(index)}   track ${fit.track} (mgmt ${fit.management.toFixed(2)} / expert ${fit.expert.toFixed(2)})  best ${fit.bestIndustry}, worst ${fit.worstIndustry}`);
    console.log(`   parts ${Object.entries(parts).map(([k, v]) => `${k} ${v.toFixed(2)}`).join('  ')}`);
    for (const industry of Object.keys(INDUSTRIES)) {
      const r = results[industry];
      console.log(`   ${industry.padEnd(14)} reach auto ${pct(reach(r.auto))} mgmt ${pct(reach(r.management))} exp ${pct(reach(r.expert))} | ruin careless ${pct(ruin(r.careless ?? r.auto))} auto ${pct(ruin(r.auto))} | peak ${r.auto.peak} fire ${pct(r.auto.fire)} fireAge ${r.auto.fireAge ?? '-'} burn ${r.auto.burnouts.toFixed(1)}`);
    }
  }
}
