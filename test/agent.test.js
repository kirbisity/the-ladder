import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createAgent, effectiveHours, totalBandwidth, healthTarget, motivationTarget, stepDay, clampVitals,
  onBurnoutLeave, RECOVERY,
} from '../src/sim/agent.js';
import { createRandom } from '../src/sim/random.js';
import { INDUSTRIES, CHARACTERS, MOTIVATION } from '../src/config.js';

const context = { industry: INDUSTRIES.tech, random: createRandom(1), employed: true };

function worker(fields = {}) {
  return createAgent({ iq: 130, pol: 100, health: 90, motivation: 70, ...fields });
}

function characterTraits(id) {
  return { ...CHARACTERS.find((entry) => entry.id === id).traits };
}

test('the same seed gives the same rolls', () => {
  const first = createRandom(42);
  const second = createRandom(42);
  for (let index = 0; index < 20; index += 1) assert.equal(first.next(), second.next());
});

test('an overtime hour is worth less than a standard one', () => {
  assert.equal(effectiveHours(8), 8);
  assert.ok(effectiveHours(12) - effectiveHours(8) < 4);
  assert.ok(effectiveHours(12) > effectiveHours(8));
});

test('bandwidth follows the design: IQ up, √health, burnout halves it', () => {
  const sharp = worker({ iq: 150 });
  const average = worker({ iq: 100 });
  assert.ok(totalBandwidth(sharp) > totalBandwidth(average));

  const healthy = worker({ health: 100 });
  const ill = worker({ health: 25 });
  assert.ok(Math.abs(totalBandwidth(ill) / totalBandwidth(healthy) - 0.5) < 1e-9);

  const burned = worker();
  const fresh = worker();
  burned.burnout.active = true;
  assert.ok(Math.abs(totalBandwidth(burned) / totalBandwidth(fresh) - 0.5) < 1e-9);
});

test('long hours lower the health target, rest raises it, age wears it', () => {
  const standard = worker();
  const long = worker();
  long.plan.hours = 13;
  assert.ok(healthTarget(long, context) < healthTarget(standard, context));

  const rested = worker();
  rested.plan.shares = [0.4, 0.1, 0.1, 0.4];
  assert.ok(healthTarget(rested, context) > healthTarget(standard, context));

  const older = worker({ age: 55 });
  assert.ok(healthTarget(older, context) < healthTarget(standard, context));
});

test('the Anchor shrugs off long hours that hurt everyone else', () => {
  const anchor = worker({ traits: characterTraits('david') });
  const other = worker({ traits: characterTraits('marcus') });
  anchor.plan.hours = 13;
  other.plan.hours = 13;
  other.plan.shares = anchor.plan.shares.slice();
  assert.ok(healthTarget(anchor, context) > healthTarget(other, context) + 10);
  assert.ok(motivationTarget(anchor, context) > motivationTarget(other, context));
});

test('Elena tires of desk work and Marcus of networking', () => {
  const elena = worker({ traits: characterTraits('elena') });
  const deskBound = worker({ traits: characterTraits('elena') });
  deskBound.plan.shares = [0.8, 0.05, 0.05, 0.1];
  assert.ok(motivationTarget(deskBound, context) < motivationTarget(elena, context));

  const marcus = worker({ traits: characterTraits('marcus') });
  const networking = worker({ traits: characterTraits('marcus') });
  networking.plan.shares = [0.3, 0.1, 0.5, 0.1];
  assert.ok(motivationTarget(networking, context) < motivationTarget(marcus, context) - 10);
});

test('motivation falling through the line starts a burnout', () => {
  const agent = worker({ motivation: MOTIVATION.burnoutLine + 0.01 });
  agent.plan.hours = 16;
  const notes = stepDay(agent, context);
  assert.ok(agent.burnout.active);
  assert.ok(notes.some((note) => note.kind === 'burnout'));
});

test('a one-off blow tips into burnout but never straight through it', () => {
  const agent = worker({ motivation: 25 });
  agent.motivation -= 40;
  clampVitals(agent);
  assert.ok(agent.motivation > 0);
  assert.ok(agent.burnout.active);
});

test('working on through burnout is the road to a breakdown; resting is the way out', () => {
  const resting = worker({ motivation: 15 });
  resting.burnout.active = true;
  resting.plan.hours = 8;
  resting.plan.shares = [0.35, 0.1, 0.05, 0.5];
  assert.ok(onBurnoutLeave(resting));
  const working = worker({ motivation: 15 });
  working.burnout.active = true;
  working.plan.hours = 11;
  assert.ok(!onBurnoutLeave(working));
  for (let day = 0; day < 60; day += 1) {
    stepDay(resting, context);
    stepDay(working, context);
  }
  assert.ok(resting.motivation > 15);
  assert.ok(working.motivation < 15);
  working.motivation -= 20;
  clampVitals(working);
  assert.ok(working.motivation <= 0, 'no floor for someone ignoring burnout');
  assert.equal(resting.plan.shares[RECOVERY], 0.5);
});
