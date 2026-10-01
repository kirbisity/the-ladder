import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame, startRunning, runDay, closeQuarter, chooseEventOption, setPlan, rebalanceShares,
  finishQuarterDays, quitJob, careerScore, makeOffer, acceptOffer, divorce, divorceChance, vitalsBreakdown,
} from '../src/sim/game.js';
import { playCareer } from '../src/sim/bots.js';
import { agentsAtLevel } from '../src/sim/org.js';
import { allEvents, eventById, lifeWeight } from '../src/sim/events.js';
import { TIME, INDUSTRIES, CHARACTERS, MOTIVATION, MONEY, ORG, JOBLESS } from '../src/config.js';

function clearEvents(game) {
  while (game.currentEvent) chooseEventOption(game, 0);
}

test('a quarter is 60 days in three phases, and ages the player a quarter-year', () => {
  const game = createGame({ seed: 11, tierLock: 'aggressive' });
  clearEvents(game);
  assert.equal(game.phase, 'plan');
  assert.ok(startRunning(game));
  let days = 0;
  while (game.phase === 'running') {
    runDay(game);
    days += 1;
  }
  assert.equal(days, TIME.daysPerQuarter);
  assert.equal(game.phase, 'review');
  const report = closeQuarter(game);
  assert.ok(report.rating);
  assert.equal(game.quarterIndex, 1);
  assert.equal(game.player.age, TIME.startAge + 0.25);
  assert.equal(game.phase, 'plan');
});

test('the first quarter is quiet, and later runs wait for events to be answered', () => {
  const game = createGame({ seed: 1 });
  assert.equal(game.currentEvent, null, 'a new hire finds their desk before the first crisis');
  let quarters = 0;
  while (!game.currentEvent && quarters < 40) {
    finishQuarterDays(game);
    closeQuarter(game);
    quarters += 1;
  }
  assert.ok(game.currentEvent);
  assert.equal(startRunning(game), false);
  clearEvents(game);
  assert.equal(startRunning(game), true);
});

test('the same seed and choices replay the same career', () => {
  const first = playCareer({ seed: 77, characterId: 'jennifer', industryId: 'tech', policyName: 'balanced' });
  const second = playCareer({ seed: 77, characterId: 'jennifer', industryId: 'tech', policyName: 'balanced' });
  assert.deepEqual(first, second);
});

test('moving one bandwidth bucket spreads the rest in proportion and keeps 100%', () => {
  const shares = rebalanceShares([0.5, 0.25, 0.15, 0.1], 3, 0.4);
  assert.equal(shares[3], 0.4);
  assert.ok(Math.abs(shares.reduce((sum, share) => sum + share, 0) - 1) < 1e-9);
  assert.ok(Math.abs(shares[0] / shares[1] - 2) < 1e-9);
});

test('an event can hold the hours up, and the slider cannot go under it', () => {
  const game = createGame({ seed: 12 });
  clearEvents(game);
  game.flags.minHours = 12;
  game.flags.minHoursQuarters = 2;
  setPlan(game, { hours: 8 });
  assert.equal(game.player.plan.hours, 12);
});

test('health at zero ends the career on the day it happens', () => {
  const game = createGame({ seed: 13, characterId: 'joseph' });
  clearEvents(game);
  game.player.health = 0.01;
  setPlan(game, { hours: 16, shares: [0.9, 0.05, 0.05, 0] });
  startRunning(game);
  runDay(game);
  assert.equal(game.outcome?.kind, 'death');
  assert.equal(game.phase, 'over');
});

test('out of work, a little debt is survivable; past the cushion it is homelessness', () => {
  const game = createGame({ seed: 14 });
  clearEvents(game);
  quitJob(game);
  game.employment.benefitQuartersLeft = 0;
  setPlan(game, { openness: 0 });
  game.savings = -MONEY.debtCushion / 4;
  finishQuarterDays(game);
  closeQuarter(game);
  assert.ok(game.savings < 0, 'the scenario: the quarter closes in debt');
  assert.equal(game.outcome, null, 'living on credit, not yet on the street');
  game.savings = -MONEY.debtCushion - 100;
  while (game.currentEvent) {
    const declineOffer = game.currentEvent.event.id === 'jobOffer';
    chooseEventOption(game, declineOffer ? game.currentEvent.choices.length - 1 : 0);
  }
  assert.equal(game.employment.employed, false, 'the scenario: still out of work');
  finishQuarterDays(game);
  closeQuarter(game);
  assert.equal(game.outcome?.kind, 'homeless');
});

test('a long search strains a marriage: no risk at first, rising to a cap; divorce halves the assets', () => {
  const game = createGame({ seed: 15 });
  clearEvents(game);
  game.married = true;
  quitJob(game);
  game.employment.unemployedQuarters = JOBLESS.divorceFromQuarter - 1;
  assert.equal(divorceChance(game), 0);
  game.employment.unemployedQuarters = JOBLESS.divorceFromQuarter;
  const early = divorceChance(game);
  game.employment.unemployedQuarters = 4;
  const atYear = divorceChance(game);
  game.employment.unemployedQuarters = 40;
  assert.ok(early > 0 && atYear > early && divorceChance(game) === JOBLESS.divorceCap);
  game.married = false;
  assert.equal(divorceChance(game), 0, 'no marriage, no divorce');
  game.married = true;
  game.savings = 200000;
  game.homeEquity = 300000;
  divorce(game);
  assert.equal(game.married, false);
  assert.equal(game.homeEquity, 150000);
  assert.equal(game.savings, 100000 - JOBLESS.divorceLegalFees);
  assert.ok(game.journal.some((entry) => entry.kind === 'divorce'));
});

test('a long search makes medical cards likelier', () => {
  const game = createGame({ seed: 16 });
  clearEvents(game);
  const er = eventById('erVisit');
  const atWork = lifeWeight(game, er);
  quitJob(game);
  game.employment.unemployedQuarters = 6;
  assert.ok(lifeWeight(game, er) > atWork * 2);
  assert.equal(lifeWeight(game, eventById('carTrouble')), eventById('carTrouble').weight ? eventById('carTrouble').weight(game) : 1, 'non-medical cards unchanged');
});

test('the career ends in retirement at the retirement age', () => {
  const game = createGame({ seed: 15 });
  clearEvents(game);
  game.player.age = TIME.retirementAge - 0.25;
  finishQuarterDays(game);
  closeQuarter(game);
  assert.equal(game.outcome?.kind, 'retired');
  assert.ok(careerScore(game) > 0);
});

test('a leapfrog is someone junior jumping past you, and stings once', () => {
  const game = createGame({ seed: 16, tierLock: 'aggressive' });
  clearEvents(game);
  const player = game.player;
  player.readiness = 120;
  player.quartersAtLevel = 10;
  player.lastRating = 'meetSome';
  const savedSearch = ORG.externalSearchChance[1];
  ORG.externalSearchChance[1] = 0;
  for (const peer of agentsAtLevel(game.org, 0)) {
    if (peer === player) continue;
    peer.standing = 0.9;
    peer.readiness = 125;
    peer.quartersAtLevel = 2;
    peer.lastRating = 'greatlyExceeds';
  }
  for (const chair of agentsAtLevel(game.org, 1).slice(0, 3)) chair.departed = 'quit';
  finishQuarterDays(game);
  player.motivation = 80;
  const before = player.motivation;
  const report = closeQuarter(game);
  ORG.externalSearchChance[1] = savedSearch;
  if (report.promoted) return;
  assert.ok(report.leapfrogged, 'a junior colleague took a chair');
  const leapNotes = report.notes.filter((note) => note.startsWith('Leapfrogged'));
  assert.equal(leapNotes.length, 1);
  assert.ok(player.motivation < before);
});

test('every event in the deck can be answered every way, in every industry', () => {
  for (const industryId of Object.keys(INDUSTRIES)) {
    for (const event of allEvents()) {
      if (event.industry && event.industry !== industryId) continue;
      const choiceCount = (typeof event.choices === 'function' ? 2 : event.choices.length);
      for (let choice = 0; choice < choiceCount; choice += 1) {
        const game = createGame({ seed: 20 + choice, industryId, characterId: CHARACTERS[choice % 4].id });
        clearEvents(game);
        const data = event.onDraw ? event.onDraw(game, game.random) ?? {} : { peerId: game.org.agents[0].id, win: true };
        game.eventQueue.push({ event, data });
        chooseEventOption(game, 99);
        chooseEventOption(game, choice);
        assert.ok(Number.isFinite(game.player.health) && Number.isFinite(game.savings), `${event.id} #${choice}`);
      }
    }
  }
});

test('arc stages exist for every event that schedules one', () => {
  for (const id of ['sponsorPayoff', 'familyRecovery', 'startupOutcome', 'overhaulVerdict']) {
    assert.ok(eventById(id), id);
  }
});

test('one-off blows to motivation cannot end a career that is resting', () => {
  const game = createGame({ seed: 17 });
  clearEvents(game);
  game.player.motivation = MOTIVATION.burnoutLine + 1;
  finishQuarterDays(game);
  game.player.motivation = 3;
  game.player.quarter.terminated = null;
  closeQuarter(game);
  assert.notEqual(game.outcome?.kind, 'breakdown');
});

test('pay stays inside its level band however many offers are taken', () => {
  const game = createGame({ seed: 18, industryId: 'consulting' });
  clearEvents(game);
  for (let hop = 0; hop < 12; hop += 1) {
    const offer = makeOffer(game, game.player.level, 1.3, 'headhunter');
    acceptOffer(game, offer);
  }
  const base = game.industry.salaries[game.player.level];
  assert.ok(game.player.salary <= base * MONEY.bandTop + 1);
  assert.ok(game.player.salary >= base);
});

test('an event that holds the hours up gives way to burnout', () => {
  const game = createGame({ seed: 19 });
  clearEvents(game);
  game.flags.minHours = 13;
  game.flags.minHoursQuarters = 2;
  game.player.burnout.active = true;
  setPlan(game, { hours: 8 });
  assert.equal(game.player.plan.hours, 8);
});

test('the player can choose the kind of first employer; invalid choices fall back to the industry mix', () => {
  for (const tier of ['aggressive', 'mid', 'stable']) {
    const game = createGame({ seed: 81, industryId: 'consulting', startTier: tier });
    assert.equal(game.org.tier, tier);
    assert.equal(game.startTier, tier);
    assert.equal(game.tierLock, null, 'a start choice does not pin later job hops');
  }
  const startup = createGame({ seed: 82, industryId: 'tech', startTier: 'startup' });
  assert.equal(startup.org.tier, 'startup');
  const academic = createGame({ seed: 83, industryId: 'academia', startTier: 'startup' });
  assert.equal(academic.startTier, null, 'academia has no startups');
  assert.ok(academic.org.tier in { aggressive: 1, mid: 1, stable: 1 });
  const lowPay = createGame({ seed: 84, industryId: 'tech', startTier: 'stable' }).player.salary;
  const highPay = createGame({ seed: 84, industryId: 'tech', startTier: 'aggressive' }).player.salary;
  assert.ok(highPay > lowPay, 'a high-growth employer pays more to start');
  const pick = createGame({ seed: 85, industryId: 'tech', startTier: 'startup' });
  assert.equal(pick.player.salary, pick.org.industry.salaries[0], 'the salary is the band base the picker advertises');
});

function injectBlow(game, age) {
  clearEvents(game);
  game.player.age = age;
  game.player.motivation = 80;
  game.currentEvent = {
    event: { id: 'testBlow', title: 'A bad day', category: 'interpersonal' },
    data: {},
    text: 'A bad day.',
    choices: [{ label: 'Take it', tag: 'safe', apply: (innerGame) => { innerGame.player.motivation -= 20; return 'Ouch.'; } }],
  };
  chooseEventOption(game, 0);
  return 80 - game.player.motivation;
}

test('the same blow to mood lands softer on an older player, and is remembered for the popup', () => {
  const young = createGame({ seed: 91 });
  const old = createGame({ seed: 91 });
  const youngLoss = injectBlow(young, 26);
  const oldLoss = injectBlow(old, 58);
  assert.ok(youngLoss > 19 && oldLoss < youngLoss * 0.8, `young ${youngLoss}, old ${oldLoss}`);
  const breakdown = vitalsBreakdown(old);
  assert.equal(breakdown.log[0].label, 'A bad day');
  assert.ok(breakdown.log[0].motivation <= -10);
  assert.ok(breakdown.resilience < 1);
});

test('the vitals breakdown explains the target, and the age cost grows with age', () => {
  const game = createGame({ seed: 92, industryId: 'tech', tierLock: 'aggressive' });
  clearEvents(game);
  game.player.age = 30;
  const youngCost = vitalsBreakdown(game).health.ageCost;
  game.player.age = 52;
  const breakdown = vitalsBreakdown(game);
  const sum = breakdown.health.terms.reduce((total, term) => total + term.value, 0);
  assert.ok(Math.abs(sum - breakdown.health.target) < 1e-6);
  assert.ok(breakdown.health.ageCost > youngCost && breakdown.health.ageCost > 3);
  assert.ok(breakdown.motivation.ageCost > 3);
  assert.ok(breakdown.comfortableHours < 12, 'an older body cannot sustain twelve-hour days');
});

test('a university is gentler on age than a high-growth tech company', () => {
  const university = createGame({ seed: 93, industryId: 'academia', tierLock: 'mid' });
  const grind = createGame({ seed: 93, industryId: 'tech', tierLock: 'aggressive' });
  for (const game of [university, grind]) { clearEvents(game); game.player.age = 55; }
  assert.ok(vitalsBreakdown(university).health.ageCost < vitalsBreakdown(grind).health.ageCost / 2);
  assert.ok(vitalsBreakdown(university).comfortableHours > vitalsBreakdown(grind).comfortableHours);
});

test('autopilot repeats the last answer for a kind of event, and asks about anything new', async () => {
  const { rememberAnswer, pickRemembered } = await import('../src/sim/autopilot.js');
  const memory = {};
  const choices = [{ label: 'Take it', tag: 'safe' }, { label: 'Fight it', tag: 'bold' }];
  assert.equal(pickRemembered(memory, 'layoffRumor', choices), null, 'a new kind of event is the player\'s to answer');
  rememberAnswer(memory, 'layoffRumor', choices[1], 1);
  assert.equal(pickRemembered(memory, 'layoffRumor', choices), 1);
  assert.equal(pickRemembered(memory, 'reorg', choices), null, 'another kind of event is still new');
  const changed = [{ label: 'Accept: Director at $400k', tag: 'bold' }, { label: 'Decline', tag: 'safe' }];
  assert.equal(pickRemembered(memory, 'layoffRumor', changed), 0, 'the same tag stands in when a label carries new details');
  rememberAnswer(memory, 'fireOffer', choices[0], 0);
  assert.equal(pickRemembered(memory, 'fireOffer', choices), null, 'retiring is never decided for you');
  assert.equal(pickRemembered(memory, 'layoffRumor', [{ label: 'Other', tag: 'rest' }]), null, 'an old answer that is gone is a new question');
});
