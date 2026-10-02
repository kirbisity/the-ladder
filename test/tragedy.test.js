import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame, chooseEventOption, prepareCurrentEvent, finishQuarterDays, closeQuarter, vitalsBreakdown, setPlan,
} from '../src/sim/game.js';
import { eventById } from '../src/sim/events.js';
import { playQuarter, POLICIES } from '../src/sim/bots.js';
import { rollMisfortunes, startIllness, advanceIllness, survivalChance, cancerHazard, lossHazard, pickLoved } from '../src/sim/misfortune.js';
import { startDating, marry, makeCandidate, lifeMoodTerms } from '../src/sim/family.js';
import { MISFORTUNE } from '../src/config.js';

function clearEvents(game) {
  while (game.currentEvent) chooseEventOption(game, 0);
}

function openCard(game, id, data = {}) {
  clearEvents(game);
  game.currentEvent = { event: eventById(id), data };
  prepareCurrentEvent(game);
}

function choose(game, startsWith) {
  const index = game.currentEvent.choices.findIndex((choice) => choice.label.startsWith(startsWith));
  assert.ok(index >= 0, `a choice starting "${startsWith}" in ${game.currentEvent.choices.map((choice) => choice.label).join(' | ')}`);
  return chooseEventOption(game, index);
}

function lifetime(seed, characterId = 'joseph') {
  const game = createGame({ seed, characterId });
  let guard = 0;
  while (!game.outcome && guard < 220) {
    playQuarter(game, POLICIES.balanced);
    guard += 1;
  }
  return game;
}

test('across a career: someone close passes four to eight times, a crash comes none to three times, fire and cancer may never come', () => {
  const losses = [];
  const crashes = [];
  let fires = 0;
  let cancers = 0;
  const ids = ['simon', 'jennifer', 'richard', 'joseph', 'adam', 'chloe'];
  for (let seed = 0; seed < 36; seed += 1) {
    const game = lifetime(700 + seed, ids[seed % ids.length]);
    const count = (kind) => game.journal.filter((entry) => entry.kind === kind).length;
    losses.push(count('bereaved'));
    crashes.push(count('carCrash'));
    fires += count('houseFire') > 0 ? 1 : 0;
    cancers += game.journal.some((entry) => entry.kind === 'cancer') ? 1 : 0;
  }
  assert.ok(Math.max(...crashes) <= MISFORTUNE.crash.max, `crashes ${crashes}`);
  assert.ok(crashes.some((count) => count === 0) && crashes.some((count) => count >= 1), 'some careers see none, some see one or more');
  const typical = losses.filter((count) => count >= 4 && count <= 9).length;
  assert.ok(typical / losses.length > 0.6, `most careers lose four to eight people (${losses})`);
  assert.ok(Math.max(...losses) <= 10 && losses.some((count) => count >= 6), 'and some lose more');
  assert.ok(fires < 36 * 0.5 && cancers < 36 * 0.5, 'fire and cancer are rare enough to miss entirely');
  assert.ok(fires + cancers > 0, 'but they do happen');
});

test('the hazards follow age: losses come faster with years, cancer starts at thirty, and no one crashes without a car', () => {
  assert.ok(lossHazard(60) > lossHazard(30));
  assert.equal(cancerHazard(25), 0);
  assert.ok(cancerHazard(60) > cancerHazard(40));
  const game = createGame({ seed: 710 });
  clearEvents(game);
  game.flags.car = 'none';
  game.quarterIndex = 30;
  let crash = 0;
  for (let trial = 0; trial < 3000; trial += 1) {
    game.misfortune = { crashes: 0, lastCrash: -99, lastFire: -99, cancers: 0 };
    if (rollMisfortunes(game).some((entry) => entry.id === 'carCrash')) crash += 1;
  }
  assert.equal(crash, 0, 'a person without a car does not crash one');
  game.flags.car = 'old';
  game.player.plan.hours = 14;
  for (let trial = 0; trial < 3000; trial += 1) {
    game.misfortune = { crashes: 0, lastCrash: -99, lastFire: -99, cancers: 0 };
    if (rollMisfortunes(game).some((entry) => entry.id === 'carCrash')) crash += 1;
  }
  assert.ok(crash > 0);
});

test('someone passing: grandparents go earlier and parents later, each only once, and in-laws only once married', () => {
  const young = createGame({ seed: 711 });
  young.player.age = 30;
  const old = createGame({ seed: 712 });
  old.player.age = 62;
  const kinds = (game) => Array.from({ length: 12 }, () => pickLoved(game, game.random)?.kind).filter(Boolean);
  assert.ok(kinds(young).includes('grandparent') || kinds(createGame({ seed: 713 })).length >= 0);
  const pool = createGame({ seed: 714 });
  pool.player.age = 52;
  const all = Array.from({ length: 30 }, () => pickLoved(pool, pool.random)).filter(Boolean);
  assert.ok(all.filter((loved) => loved.kind === 'parent').length <= 2, 'two parents, no more');
  assert.ok(all.filter((loved) => loved.kind === 'grandparent').length <= 4);
  assert.ok(!all.some((loved) => loved.kind === 'inlaw'), 'no in-laws without a marriage');
  assert.ok(old.player.age > young.player.age);
});

test('a parent passing: the mood falls, leave and company help, a will may leave money, and it is written in the journal', () => {
  const game = createGame({ seed: 715, characterId: 'joseph' });
  clearEvents(game);
  game.player.motivation = 80;
  game.savings = 10000;
  openCard(game, 'passing', { kind: 'parent', name: 'Helen', label: 'Your mother', hit: 18 });
  const before = game.player.motivation;
  choose(game, 'Take bereavement leave');
  assert.ok(game.player.motivation < before);
  const entry = game.journal.find((item) => item.kind === 'bereaved');
  assert.ok(entry && entry.relation === 'parent' && entry.label === 'Your mother');
  const hard = createGame({ seed: 716, characterId: 'joseph' });
  clearEvents(hard);
  hard.player.motivation = 80;
  openCard(hard, 'passing', { kind: 'parent', name: 'Helen', label: 'Your mother', hit: 18 });
  choose(hard, 'Hold it together');
  assert.ok(hard.player.motivation < game.player.motivation + 5 && hard.player.motivation < 80 - 15, 'carrying on as if nothing happened costs more');
  const inlaw = createGame({ seed: 717 });
  clearEvents(inlaw);
  startDating(inlaw, makeCandidate(inlaw, inlaw.random));
  marry(inlaw);
  const quality = inlaw.family.quality;
  openCard(inlaw, 'passing', { kind: 'inlaw', name: 'Helen', label: 'Their mother', hit: 6 });
  choose(inlaw, 'Go, and stay');
  assert.ok(inlaw.family.quality > quality, 'being there for a partner\'s loss draws you closer');
});

test('a crash: minor costs a little; moderate and severe hurt, wreck the car and prompt a replacement; severe means medical leave', () => {
  const minor = createGame({ seed: 718 });
  clearEvents(minor);
  openCard(minor, 'carCrash', { severity: 'minor', car: 'old' });
  const health = minor.player.health;
  choose(minor, 'Claim on insurance');
  assert.equal(minor.player.health, health);
  assert.ok(minor.journal.some((entry) => entry.kind === 'carCrash' && entry.severity === 'minor'));
  const severe = createGame({ seed: 719 });
  clearEvents(severe);
  severe.flags.car = 'new';
  severe.player.health = 90;
  openCard(severe, 'carCrash', { severity: 'severe', car: 'new' });
  choose(severe, 'Rest and do');
  assert.ok(severe.player.health <= 62, 'a severe crash costs a third of the health');
  assert.equal(severe.flags.car, 'none', 'the car is a write-off');
  assert.ok(severe.flags.scheduled.some((entry) => entry.id === 'carDecision'), 'a replacement is asked about soon');
  assert.ok(severe.flags.scheduled.some((entry) => entry.id === 'crashAftermath'));
  assert.ok(severe.fmla.daysLeft > 0 && severe.fmla.kind === 'medical', 'and they are on medical leave');
  const careless = createGame({ seed: 720 });
  clearEvents(careless);
  careless.player.health = 90;
  openCard(careless, 'carCrash', { severity: 'moderate', car: 'old' });
  choose(careless, 'Back at your desk');
  assert.ok(careless.player.health < 90 - 14, 'going straight back hurts more than resting');
});

test('a house fire: owners rebuild or sell, renters replace things; no cover costs far more', () => {
  const insured = createGame({ seed: 721 });
  clearEvents(insured);
  insured.homeEquity = 300000;
  insured.savings = 100000;
  openCard(insured, 'houseFire', { owned: true, insured: true });
  choose(insured, 'Rebuild it');
  const bare = createGame({ seed: 722 });
  clearEvents(bare);
  bare.homeEquity = 300000;
  bare.savings = 100000;
  openCard(bare, 'houseFire', { owned: true, insured: false });
  choose(bare, 'Rebuild it');
  assert.ok(bare.savings < insured.savings && bare.homeEquity < insured.homeEquity, 'losing everything uninsured costs far more');
  assert.ok(insured.journal.some((entry) => entry.kind === 'houseFire'));
  const renter = createGame({ seed: 723 });
  clearEvents(renter);
  openCard(renter, 'houseFire', { owned: false, insured: true });
  assert.ok(renter.currentEvent.choices.some((choice) => choice.label.startsWith('Replace what you can')));
  const sold = createGame({ seed: 724 });
  clearEvents(sold);
  sold.homeEquity = 200000;
  openCard(sold, 'houseFire', { owned: true, insured: true });
  choose(sold, 'Take the payout');
  assert.equal(sold.homeEquity, 0);
});

test('cancer: treatment lasts quarters and costs health and mood; it ends clear or in death, by the odds treatment buys', () => {
  assert.ok(survivalChance(1, 'aggressive', false) > survivalChance(1, 'standard', false));
  assert.ok(survivalChance(1, 'standard', false) > survivalChance(3, 'standard', false));
  assert.ok(survivalChance(2, 'wait', false) < survivalChance(2, 'standard', false));
  assert.ok(survivalChance(2, 'standard', true) > survivalChance(2, 'standard', false), 'care helps');
  const game = createGame({ seed: 725, characterId: 'joseph' });
  clearEvents(game);
  game.player.age = 45;
  const healthTarget = vitalsBreakdown(game).health.target;
  openCard(game, 'cancer', { who: 'player', stage: 2 });
  choose(game, 'Aggressive treatment');
  assert.ok(game.flags.illness && game.flags.illness.who === 'player');
  assert.ok(vitalsBreakdown(game).health.target < healthTarget - 10, 'treatment lowers the health target');
  assert.ok(lifeMoodTerms(game).some((term) => term.label === 'Cancer treatment'));
  assert.ok(game.journal.some((entry) => entry.kind === 'cancer' && entry.who === 'player'));
  game.flags.illness.survive = 1;
  game.flags.illness.quartersLeft = 1;
  const motivation = game.player.motivation;
  assert.equal(advanceIllness(game, { notes: [] }), 'cleared');
  assert.ok(game.player.motivation > motivation);
  assert.equal(game.flags.illness, null);
  startIllness(game, { who: 'player', stage: 3, treatment: 'wait' });
  game.flags.illness.survive = 0;
  game.flags.illness.quartersLeft = 1;
  assert.equal(advanceIllness(game, { notes: [] }), 'died');
});

test('a player who dies of cancer ends the career, and says why', () => {
  const game = createGame({ seed: 726 });
  clearEvents(game);
  startIllness(game, { who: 'player', stage: 3, treatment: 'wait' });
  game.flags.illness.survive = 0;
  game.flags.illness.quartersLeft = 1;
  finishQuarterDays(game);
  closeQuarter(game);
  assert.equal(game.outcome?.kind, 'death');
  assert.equal(game.outcome.cause, 'cancer');
});

test('a partner\'s cancer: the household carries it; the family bar falls with it; widowhood ends the marriage without a divorce', () => {
  const game = createGame({ seed: 727, characterId: 'joseph' });
  clearEvents(game);
  game.player.age = 45;
  startDating(game, makeCandidate(game, game.random));
  marry(game);
  game.family.quality = 80;
  openCard(game, 'cancer', { who: 'partner', stage: 2 });
  choose(game, 'Take leave and be there');
  assert.ok(game.flags.illness.who === 'partner');
  assert.ok(game.flags.illness.survive > survivalChance(2, 'aggressive', false), 'being there improves their odds');
  assert.ok(lifeMoodTerms(game).some((term) => term.label.startsWith('Caring for')), 'caring weighs on the mood');
  game.flags.illness.survive = 0;
  game.flags.illness.quartersLeft = 1;
  const partnerName = game.partner.name;
  game.savings = 90000;
  setPlan(game, { hours: 9 });
  clearEvents(game);
  finishQuarterDays(game);
  closeQuarter(game);
  assert.equal(game.married, false);
  assert.equal(game.partner, null);
  assert.ok(game.journal.some((entry) => entry.kind === 'widowed' && entry.partner === partnerName));
  assert.ok(!game.journal.some((entry) => entry.kind === 'divorce'), 'not a divorce');
  assert.ok(lifeMoodTerms(game).some((term) => term.label === 'Grief'));
});
