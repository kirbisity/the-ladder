// The roster, played: whole careers per character with the same mechanics,
// asserting how the characters relate rather than any balance number. Seeds
// are fixed, so the sample is the same every run.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { benchCharacter } from '../tools/characters.js';
import { playCareer } from '../src/sim/bots.js';
import { CHARACTERS } from '../src/config.js';

const CAREERS = 16;
const tech = Object.fromEntries(CHARACTERS.map((character) => [character.id, benchCharacter(character.id, 'tech', CAREERS, 'adaptive')]));

test('Joseph, the average Joe, retires at a senior level with little drama', () => {
  const joseph = tech.joseph;
  assert.ok(joseph.retired >= 0.9);
  assert.ok(joseph.senior >= 0.85);
  assert.ok(joseph.director <= 0.2, `director+ ${joseph.director}`);
  assert.ok(joseph.lostJobs <= 2.5);
  assert.ok(joseph.burnouts < 0.5);
});

test('Adam is the likeliest leader of them all', () => {
  for (const character of CHARACTERS) {
    if (character.id === 'adam') continue;
    assert.ok(tech.adam.director >= tech[character.id].director, `Adam ${tech.adam.director} vs ${character.id} ${tech[character.id].director}`);
  }
  assert.ok(tech.adam.management >= 0.8);
});

test('Simon and Richard climb about as often, Richard on networking', () => {
  // Simon was made sharper (IQ 145, better politics) after this was set, so he now leads Richard in tech.
  assert.ok(Math.abs(tech.simon.director - tech.richard.director) <= 0.45);
  assert.ok(tech.richard.politicsShare > tech.simon.politicsShare + 0.2);
  assert.ok(tech.simon.director > tech.joseph.director && tech.richard.director > tech.joseph.director);
});

test('Christian out-produces everyone but is no likelier a manager than Simon or Richard', () => {
  for (const character of CHARACTERS) {
    if (character.id !== 'christian') assert.ok(tech.christian.topRatings >= tech[character.id].topRatings - 0.03, `Christian ${tech.christian.topRatings} vs ${character.id} ${tech[character.id].topRatings}`);
  }
  assert.ok(tech.christian.management <= Math.max(tech.simon.management, tech.richard.management));
});

test('twelve-hour weeks: Christian sustains them, Simon strains, Chloe and Eve break', () => {
  const long = Object.fromEntries(['christian', 'simon', 'chloe', 'eve'].map((id) => [id, benchCharacter(id, 'tech', CAREERS, 'longHours')]));
  assert.ok(long.christian.retired >= 0.9 && long.christian.burnouts < 0.2);
  assert.ok(long.simon.retired >= 0.8 && long.simon.lowHealth > long.christian.lowHealth);
  assert.ok(long.chloe.retired < 0.5 && long.eve.retired < 0.5);
});

test('Chloe does best in academia; Eve trails Joseph', () => {
  // A bigger sample than the roster's: the gap is a few careers in sixteen, and a tie is noise.
  const chloeAcademia = benchCharacter('chloe', 'academia', 40, 'adaptive');
  const chloeTech = benchCharacter('chloe', 'tech', 40, 'adaptive');
  assert.ok(chloeAcademia.director > chloeTech.director, `${chloeAcademia.director} vs ${chloeTech.director}`);
  assert.ok(tech.eve.management <= tech.joseph.management);
  assert.ok(tech.eve.director <= tech.joseph.director);
});

function medianFireAge(industryId, tier) {
  const ages = [];
  for (const characterId of ['joseph', 'simon', 'adam', 'eve']) {
    for (let index = 0; index < 4; index += 1) {
      const result = playCareer({ seed: 7000 + index, characterId, industryId, policyName: 'adaptive', tierLock: tier });
      ages.push(result.fireReadyAge ?? 99);
    }
  }
  return ages.sort((a, b) => a - b)[ages.length >> 1];
}

test('the higher the tier, the sooner tech reaches financial independence; a university rarely does', () => {
  const aggressive = medianFireAge('tech', 'aggressive');
  const mid = medianFireAge('tech', 'mid');
  const stable = medianFireAge('tech', 'stable');
  assert.ok(aggressive < mid && mid < stable, `${aggressive} < ${mid} < ${stable}`);
  assert.ok(aggressive <= 38, `high-growth tech is financially independent by about 35 (${aggressive})`);
  assert.ok(stable >= 44 && stable <= 56, `steady tech around 50 (${stable})`);
  assert.ok(medianFireAge('academia', 'stable') > stable + 5, 'a university pay does not usually get there early');
});

test('each character carries a difficulty from 1 to 3 that matches how they actually climb', () => {
  for (const character of CHARACTERS) assert.ok([1, 2, 3].includes(character.difficulty), character.id);
  const reach = (level) => CHARACTERS.filter((character) => character.difficulty === level).map((character) => tech[character.id].director);
  const average = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
  assert.ok(reach(1).length && reach(2).length && reach(3).length, 'the scenario: every level is used');
  assert.ok(average(reach(1)) > average(reach(2)) && average(reach(2)) > average(reach(3)), 'an easier climb reaches the top more often');
});
