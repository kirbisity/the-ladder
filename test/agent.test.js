import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createAgent, effectiveHours, totalBandwidth, healthTarget, motivationTarget, stepDay, clampVitals,
  onBurnoutLeave, RECOVERY, blowResilience,
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

test('Simon and Jennifer take long hours well, Chloe badly, Joseph in between', () => {
  const at13 = (id) => {
    const agent = worker({ traits: characterTraits(id) });
    agent.plan.hours = 13;
    return { health: healthTarget(agent, context), motivation: motivationTarget(agent, context) };
  };
  const [simon, jennifer, chloe, joseph] = ['simon', 'jennifer', 'chloe', 'joseph'].map(at13);
  assert.ok(simon.health > joseph.health + 10 && jennifer.health > joseph.health + 10);
  assert.ok(chloe.health < joseph.health - 10);
  assert.ok(simon.motivation > joseph.motivation && chloe.motivation < joseph.motivation);
  assert.equal(characterTraits('joseph').strainResistance, undefined, 'an average Joe on long hours');
});

test('Jennifer tires of desk work and Simon of networking', () => {
  const jennifer = worker({ traits: characterTraits('jennifer') });
  const deskBound = worker({ traits: characterTraits('jennifer') });
  deskBound.plan.shares = [0.8, 0.05, 0.05, 0.1];
  assert.ok(motivationTarget(deskBound, context) < motivationTarget(jennifer, context));

  const simon = worker({ traits: characterTraits('simon') });
  const networking = worker({ traits: characterTraits('simon') });
  networking.plan.shares = [0.3, 0.1, 0.5, 0.1];
  assert.ok(motivationTarget(networking, context) < motivationTarget(simon, context) - 10);
});

test('motivation falling through the line starts a burnout', () => {
  const agent = worker({ motivation: MOTIVATION.burnoutLine + 0.01 });
  agent.plan.hours = 16;
  const notes = stepDay(agent, context);
  assert.ok(agent.burnout.active);
  assert.ok(notes.some((note) => note.kind === 'burnout'));
});

test('a one-off blow tips into burnout, and the last 10% resists it', () => {
  const agent = worker({ motivation: 25 });
  agent.motivation -= 40;
  clampVitals(agent);
  assert.ok(agent.burnout.active);
  assert.ok(agent.motivation > 0, 'a single blow does not reach zero from 25');
  assert.ok(agent.motivation < MOTIVATION.breakdownBuffer);
  const deep = agent.motivation;
  agent.motivation -= 2;
  clampVitals(agent);
  assert.ok(Math.abs((deep - agent.motivation) - 2 * MOTIVATION.bufferResistance) < 1e-9, 'inside the buffer a blow counts at a fraction');
});

test('rest lifts burnout; only a long unrested grind slides into a breakdown', () => {
  const resting = worker({ motivation: 15 });
  resting.burnout.active = true;
  resting.plan.hours = 9;
  resting.plan.shares = [0.35, 0.1, 0.05, 0.5];
  assert.ok(onBurnoutLeave(resting));
  const fullRest = worker({ motivation: 15 });
  fullRest.burnout.active = true;
  fullRest.plan.hours = 8;
  fullRest.plan.shares = [0.1, 0, 0, 0.9];
  const grinding = worker({ motivation: 15 });
  grinding.burnout.active = true;
  grinding.plan.hours = 14;
  grinding.plan.shares = [0.8, 0.05, 0.1, 0.05];
  assert.ok(!onBurnoutLeave(grinding));
  for (let day = 0; day < 60; day += 1) {
    stepDay(resting, context);
    stepDay(fullRest, context);
    stepDay(grinding, context);
  }
  assert.ok(resting.motivation > 15);
  assert.ok(fullRest.motivation > resting.motivation, 'more rest, faster recovery');
  assert.ok(grinding.motivation < 15);
  let days = 60;
  while (grinding.motivation > 0 && days < 60 * 20) {
    stepDay(grinding, context);
    days += 1;
  }
  assert.ok(grinding.motivation <= 0, 'a breakdown is reachable');
  assert.ok(days > 60 * 3, `but it takes a long time: ${days} days`);
  assert.equal(resting.plan.shares[RECOVERY], 0.5);
});

test('with age, long hours cost more health and mood, and enthusiasm mellows', () => {
  const costOfLongDays = (age, target, sensitivity = 1) => {
    const ctx = { ...context, ageSensitivity: sensitivity };
    const standard = worker({ age });
    const long = worker({ age });
    long.plan.hours = 12;
    return target(standard, ctx) - target(long, ctx);
  };
  assert.ok(costOfLongDays(52, healthTarget) > costOfLongDays(30, healthTarget) * 1.3, 'the same hours hurt the body more');
  assert.ok(costOfLongDays(52, motivationTarget) > costOfLongDays(30, motivationTarget) * 1.3, 'and the mood');
  const calm = (age) => motivationTarget(worker({ age }), { ...context, ageSensitivity: 1 });
  assert.ok(calm(55) < calm(30) - 5, 'the mood a person settles at falls with age');
  assert.equal(calm(30), calm(25), 'nothing changes before the line');
});

test('where the culture is gentler on age, age bites less', () => {
  const aged = worker({ age: 55 });
  const at = (sensitivity) => ({ health: healthTarget(aged, { ...context, ageSensitivity: sensitivity }), mood: motivationTarget(aged, { ...context, ageSensitivity: sensitivity }) });
  assert.ok(at(0.5).health > at(1).health && at(1).health > at(1.3).health);
  assert.ok(at(0.5).mood > at(1).mood && at(1).mood > at(1.3).mood);
});

test('the target is the sum of the terms the vitals popup lists', () => {
  const aged = worker({ age: 48 });
  aged.plan.hours = 11;
  const healthTerms = [];
  const moodTerms = [];
  const ctx = { ...context, ageSensitivity: 1 };
  assert.ok(Math.abs(healthTarget(aged, ctx, healthTerms) - healthTerms.reduce((sum, term) => sum + term.value, 0)) < 1e-9);
  assert.ok(Math.abs(motivationTarget(aged, ctx, moodTerms) - moodTerms.reduce((sum, term) => sum + term.value, 0)) < 1e-9);
  assert.ok(healthTerms.some((term) => /age/i.test(term.label)) && moodTerms.some((term) => /age/i.test(term.label)));
});

test('bad news lands softer with age, down to a floor', () => {
  assert.equal(blowResilience(25), 1);
  assert.ok(blowResilience(45) < 1 && blowResilience(60) < blowResilience(45));
  assert.ok(blowResilience(120) >= 0.5);
});
