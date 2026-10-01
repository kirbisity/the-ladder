// The roster, played: whole careers per character with the same mechanics,
// asserting how the characters relate rather than any balance number. Seeds
// are fixed, so the sample is the same every run.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { benchCharacter } from '../tools/characters.js';
import { CHARACTERS } from '../src/config.js';

const CAREERS = 10;
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
  assert.ok(Math.abs(tech.simon.director - tech.richard.director) <= 0.3);
  assert.ok(tech.richard.politicsShare > tech.simon.politicsShare + 0.2);
  assert.ok(tech.simon.director > tech.joseph.director && tech.richard.director > tech.joseph.director);
});

test('Chris out-produces everyone but is no likelier a manager than Simon or Richard', () => {
  for (const character of CHARACTERS) {
    if (character.id !== 'chris') assert.ok(tech.chris.topRatings >= tech[character.id].topRatings);
  }
  assert.ok(tech.chris.management <= Math.max(tech.simon.management, tech.richard.management));
});

test('twelve-hour weeks: Chris sustains them, Simon strains, Chloe and Eve break', () => {
  const long = Object.fromEntries(['chris', 'simon', 'chloe', 'eve'].map((id) => [id, benchCharacter(id, 'tech', CAREERS, 'longHours')]));
  assert.ok(long.chris.retired >= 0.9 && long.chris.burnouts < 0.2);
  assert.ok(long.simon.retired >= 0.8 && long.simon.lowHealth > long.chris.lowHealth);
  assert.ok(long.chloe.retired < 0.5 && long.eve.retired < 0.5);
});

test('Chloe does best in academia; Eve trails Joseph', () => {
  const chloeAcademia = benchCharacter('chloe', 'academia', CAREERS, 'adaptive');
  assert.ok(chloeAcademia.director > tech.chloe.director);
  assert.ok(tech.eve.management <= tech.joseph.management);
  assert.ok(tech.eve.director <= tech.joseph.director);
});
