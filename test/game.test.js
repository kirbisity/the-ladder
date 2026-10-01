import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame, startRunning, runDay, closeQuarter, chooseEventOption, setPlan, rebalanceShares,
  finishQuarterDays, quitJob, careerScore, makeOffer, acceptOffer, divorce, divorceChance,
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
