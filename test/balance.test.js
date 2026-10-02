// Whole careers played by policy bots. These pin the balance targets as
// relationships between play styles, not as tuning numbers, so retuning a
// dial cannot quietly make grinding safe or careful play fatal.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { playCareer } from '../src/sim/bots.js';

const CAREERS = 12;

function sweep(policyName, characterId = 'simon', industryId = 'tech') {
  const results = [];
  for (let index = 0; index < CAREERS; index += 1) {
    results.push(playCareer({ seed: 5000 + index, characterId, industryId, policyName }));
  }
  const share = (predicate) => results.filter(predicate).length / results.length;
  return { results, share };
}

const grinder = sweep('grinder');
const balanced = sweep('balanced');
const minimal = sweep('minimal');
const adaptive = sweep('adaptive');

test('grinding sixteen-hour-ish weeks ends most careers in death or breakdown', () => {
  const failed = grinder.share((entry) => entry.outcome === 'death' || entry.outcome === 'breakdown');
  assert.ok(failed >= 0.6, `grinder failed ${failed}`);
});

test('steady, balanced play survives to retirement in nearly every career', () => {
  const retires = (entry) => entry.outcome === 'retired' || entry.outcome === 'fire';
  assert.ok(balanced.share(retires) >= 0.8);
  assert.ok(adaptive.share(retires) >= 0.8);
});

test('minimal effort survives but stays near the bottom of the ladder', () => {
  assert.ok(minimal.share((entry) => entry.outcome === 'retired' || entry.outcome === 'fire') >= 0.5);
  // The strongest characters (Adam, Chaitravi) can now reach the director chairs even on minimal effort, once in a dozen careers.
  assert.ok(minimal.share((entry) => entry.peakLevel >= 5) <= 0.1);
});

test('the top chair is rare even for careful, adaptive play', () => {
  assert.ok(adaptive.share((entry) => entry.peakLevel >= 3) >= 0.8, 'the middle is reachable');
  assert.ok(adaptive.share((entry) => entry.peakLevel === 7) <= 0.25, 'the top is not');
});

test('effort pays: balanced play out-climbs minimal play', () => {
  const median = (sample) => sample.results.map((entry) => entry.peakLevel).sort((a, b) => a - b)[CAREERS >> 1];
  assert.ok(median(balanced) > median(minimal));
});

test('Simon lasts years longer than Chloe on the same grind', () => {
  const chloe = sweep('grinder', 'chloe');
  const medianEnd = (sample) => sample.results.map((entry) => entry.age).sort((a, b) => a - b)[CAREERS >> 1];
  assert.ok(medianEnd(grinder) > medianEnd(chloe) + 3, `${medianEnd(grinder)} vs ${medianEnd(chloe)}`);
});

test('every defeat state is reachable by some style of play', () => {
  const erratic = sweep('random');
  assert.ok(grinder.share((entry) => entry.outcome === 'death') > 0, 'death');
  assert.ok(grinder.share((entry) => entry.outcome === 'breakdown') > 0, 'breakdown');
  assert.ok(erratic.share((entry) => entry.outcome === 'homeless') > 0, 'homelessness');
});
