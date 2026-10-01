import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame, chooseEventOption, finishQuarterDays, closeQuarter, prepareCurrentEvent, setPlan, fireNumber, quarterlyExpenses,
  vitalsBreakdown, netWorth,
} from '../src/sim/game.js';
import { eventById } from '../src/sim/events.js';
import { serializeGame, deserializeGame } from '../src/sim/save.js';
import {
  socialGain, socialEquilibrium, socialNeed, lifeMoodTerms, makeCandidate, startDating, marry, familyTarget, kidsAtHome, childCostPerYear,
  partnerIncome, dateNight, isDating, closeLifeQuarter,
} from '../src/sim/family.js';
import { SOCIAL, FAMILY } from '../src/config.js';
import { pickRemembered } from '../src/sim/autopilot.js';

function clearEvents(game) {
  while (game.currentEvent) chooseEventOption(game, 0);
}

function openCard(game, id) {
  clearEvents(game);
  const event = eventById(id);
  game.currentEvent = { event, data: event.onDraw ? event.onDraw(game, game.random) : {} };
  prepareCurrentEvent(game);
}

function choose(game, startsWith) {
  const index = game.currentEvent.choices.findIndex((choice) => choice.label.startsWith(startsWith));
  assert.ok(index >= 0, `a choice starting "${startsWith}" in ${game.currentEvent.choices.map((choice) => choice.label).join(' | ')}`);
  return chooseEventOption(game, index);
}

function playQuarters(game, count) {
  for (let index = 0; index < count && !game.outcome; index += 1) {
    clearEvents(game);
    finishQuarterDays(game);
    closeQuarter(game);
  }
}

/** A player who has a partner of a chosen temperament, married or dating. */
function coupled(seed, { married = true, tolerance = 9, warmth = 0.5 } = {}) {
  const game = createGame({ seed, characterId: 'joseph' });
  clearEvents(game);
  game.player.age = 30;
  const candidate = { ...makeCandidate(game, game.random), workTolerance: tolerance, warmth, divorceLine: Math.round(36 - warmth * 22) };
  startDating(game, candidate);
  if (married) marry(game);
  return game;
}

test('the social circle accumulates from time spent with people, fades when neglected, and long days eat it', () => {
  const game = createGame({ seed: 301, characterId: 'jennifer' });
  clearEvents(game);
  const balanced = socialGain(game).total;
  setPlan(game, { shares: [0.3, 0.1, 0.5, 0.1] });
  assert.ok(socialGain(game).total > balanced, 'networking builds the circle');
  setPlan(game, { hours: 14 });
  assert.ok(socialGain(game).evenings < 1, 'long days leave fewer evenings');
  game.social = 90;
  const report = { notes: [] };
  for (let quarter = 0; quarter < 30; quarter += 1) closeLifeQuarter(game, report);
  assert.ok(game.social < 90, 'it fades toward what the plan can hold');
  assert.ok(Math.abs(socialEquilibrium(game) - game.social) < 1, 'and settles at the equilibrium the panel reports');
  game.social = 0;
  for (let quarter = 0; quarter < 30; quarter += 1) closeLifeQuarter(game, report);
  assert.ok(game.social > 5, 'and builds from nothing');
});

test('extroverts need a bigger circle: the same circle is worth less mood to them', () => {
  const extrovert = createGame({ seed: 302, characterId: 'jennifer' });
  const introvert = createGame({ seed: 302, characterId: 'simon' });
  assert.ok(socialNeed(extrovert.player) > socialNeed(introvert.player));
  for (const game of [extrovert, introvert]) game.social = 40;
  const social = (game) => lifeMoodTerms(game).find((term) => term.label.startsWith('Social')).value;
  assert.ok(social(extrovert) < social(introvert), 'at 40, the extrovert is short of friends and the introvert is not');
  extrovert.social = 95;
  assert.ok(social(extrovert) > 0, 'a big circle lifts an extrovert');
  assert.ok(vitalsBreakdown(extrovert).motivation.terms.some((term) => term.label.startsWith('Social circle')), 'and the mood popup lists it');
});

test('a bigger circle meets someone sooner, and the player decides whether to ask them out', () => {
  const game = createGame({ seed: 303, characterId: 'joseph' });
  clearEvents(game);
  game.player.age = 28;
  const card = eventById('meetSomeone');
  game.social = 10;
  const small = card.weight(game);
  game.social = 90;
  assert.ok(card.weight(game) > small * 2, 'more friends, more introductions');
  game.partner = {};
  assert.equal(card.weight(game), 0, 'nobody is introduced to someone already taken');
  game.partner = null;
  openCard(game, 'meetSomeone');
  assert.equal(game.currentEvent.choices.length, 3);
  choose(game, 'Not now');
  assert.equal(game.partner, null, 'declining starts nothing');
  let asked = 0;
  let dating = 0;
  for (let seed = 0; seed < 60; seed += 1) {
    const trial = createGame({ seed: 400 + seed, characterId: 'joseph' });
    clearEvents(trial);
    trial.player.age = 28;
    trial.social = 80;
    openCard(trial, 'meetSomeone');
    choose(trial, 'Ask ');
    asked += 1;
    if (trial.partner) dating += 1;
  }
  assert.ok(dating > asked * 0.4 && dating < asked, `asking succeeds often but not always (${dating}/${asked})`);
});

test('the partner is the opposite gender, simulated, and the relationship may or may not become a marriage', () => {
  const woman = createGame({ seed: 304, characterId: 'jennifer' });
  const man = createGame({ seed: 305, characterId: 'joseph' });
  assert.equal(makeCandidate(woman, woman.random).gender, 'male');
  assert.equal(makeCandidate(man, man.random).gender, 'female');
  const game = coupled(306, { married: false });
  assert.ok(isDating(game));
  const dated = game.partner.bond;
  playQuarters(game, 6);
  assert.ok(game.partner.age > 30.5, 'they age with you');
  assert.ok(game.partner.bond !== dated, 'the bond moves on its own');
  // Putting the question off wears on them; saying it can be refused.
  const proposal = eventById('proposal');
  game.quarterIndex = game.partner.since + FAMILY.proposalAfterQuarters;
  game.partner.bond = 80;
  assert.ok(proposal.weight(game) > 0);
  openCard(game, 'proposal');
  choose(game, 'Not yet');
  assert.equal(game.married, false);
  assert.equal(game.partner.waited, 1);
  let wed = 0;
  let refused = 0;
  for (let seed = 0; seed < 80; seed += 1) {
    const trial = coupled(500 + seed, { married: false });
    trial.partner.bond = 56;
    openCard(trial, 'proposal');
    choose(trial, 'Propose, and head to the courthouse');
    if (trial.married) wed += 1;
    else refused += 1;
  }
  assert.ok(wed > 0 && refused > 0, `a proposal can go either way (${wed} yes, ${refused} not yet)`);
});

test('marriage: the partner earns, shares the costs, and the FIRE number and net worth are the household\'s', () => {
  const single = createGame({ seed: 307, characterId: 'joseph' });
  clearEvents(single);
  single.player.age = 40;
  const alone = { spending: quarterlyExpenses(single) * 4, fire: fireNumber(single) };
  const game = coupled(307);
  game.player.age = 40;
  assert.ok(game.married && game.partner.stage === 'married');
  assert.ok(partnerIncome(game) > 0);
  assert.ok(quarterlyExpenses(game) * 4 > alone.spending, 'two people cost more to keep');
  assert.ok(fireNumber(game) !== alone.fire, 'the FIRE number is recomputed for the household');
  const worth = netWorth(game);
  playQuarters(game, 4);
  const withPartner = netWorth(game) - worth;
  const soloGame = createGame({ seed: 307, characterId: 'joseph' });
  clearEvents(soloGame);
  soloGame.player.age = 30;
  const soloWorth = netWorth(soloGame);
  playQuarters(soloGame, 4);
  assert.ok(withPartner > netWorth(soloGame) - soloWorth, 'a second income saves faster than a second person spends');
  game.partner.laidOffQuarters = 2;
  assert.equal(partnerIncome(game), 0, 'their job loss is the household\'s too');
});

test('the family bar: work-life balance is the marriage, and each partner has a different line', () => {
  const patient = coupled(308, { warmth: 0.95, tolerance: 11 });
  const strict = coupled(309, { warmth: 0.05, tolerance: 8.5 });
  assert.ok(patient.partner.divorceLine < strict.partner.divorceLine, 'a patient partner leaves later');
  setPlan(strict, { hours: 9 });
  const normal = familyTarget(strict).target;
  setPlan(strict, { hours: 14 });
  const grinding = familyTarget(strict).target;
  assert.ok(grinding < normal - 20, `long days sink the target (${normal.toFixed(0)} → ${grinding.toFixed(0)})`);
  setPlan(patient, { hours: 14 });
  assert.ok(familyTarget(patient).target > grinding, 'the same hours cost less with a patient partner');
  assert.ok(lifeMoodTerms(strict).some((term) => term.label === 'Family life'), 'the family bar feeds mood');
});

test('a marriage under the line for two quarters ends: the bar warns first, then half the money goes, mood drops, the circle shrinks', () => {
  const game = coupled(310, { warmth: 0.1, tolerance: 8.5 });
  game.savings = 200000;
  game.player.motivation = 80;
  const circle = game.social;
  let warned = false;
  let divorced = false;
  for (let quarter = 0; quarter < 30 && !divorced && !game.outcome; quarter += 1) {
    clearEvents(game);
    setPlan(game, { hours: 15 });
    finishQuarterDays(game);
    const report = closeQuarter(game);
    if (game.currentEvent?.event.id === 'coupleTalk') warned = true;
    divorced = Boolean(report?.divorced);
  }
  assert.ok(warned, 'the first quarter near the line brings a "we need to talk"');
  assert.ok(divorced, 'fifteen-hour days end the marriage');
  assert.equal(game.married, false);
  assert.equal(game.partner, null);
  assert.equal(game.family, null, 'the bar becomes the social bar again');
  assert.ok(game.journal.some((entry) => entry.kind === 'divorce' && entry.reason === 'strain'));
  assert.ok(game.social < circle, 'friends take sides');
  assert.ok(lifeMoodTerms(game).some((term) => term.label.startsWith('After')), 'and a shadow lingers on the mood');
});

test('the couple talk can save a marriage: counselling lifts the bar, brushing it off sinks it', () => {
  const game = coupled(311, { warmth: 0.3, tolerance: 9 });
  game.family.quality = 30;
  game.savings = 50000;
  openCard(game, 'coupleTalk');
  const before = game.savings;
  choose(game, 'Book couples counselling');
  assert.ok(game.family.quality > 45);
  assert.ok(game.savings < before);
  const careless = coupled(312, { warmth: 0.3 });
  careless.family.quality = 50;
  openCard(careless, 'coupleTalk');
  choose(careless, 'Brush it off');
  assert.ok(careless.family.quality < 50);
});

test('date night costs a little and lifts the bond or the marriage, once a quarter', () => {
  const dating = coupled(313, { married: false });
  const bond = dating.partner.bond;
  const money = dating.savings;
  dateNight(dating);
  assert.ok(dating.partner.bond > bond && dating.savings < money);
  const again = dating.partner.bond;
  dateNight(dating);
  assert.equal(dating.partner.bond, again, 'not twice in a quarter');
  const wed = coupled(314);
  wed.family.quality = 50;
  dateNight(wed);
  assert.ok(wed.family.quality > 50);
});

test('kids are the player\'s choice: asked occasionally, they cost a great deal and lift mood for as long as they are home', () => {
  const game = coupled(315);
  game.player.age = 31;
  game.family.quality = 70;
  const ask = eventById('considerKids');
  assert.ok(ask.weight(game) > 0);
  openCard(game, 'considerKids');
  choose(game, 'No: we have decided');
  assert.equal(ask.weight(game), 0, 'a no stays a no');
  const wanting = coupled(316);
  wanting.player.age = 31;
  wanting.family.quality = 70;
  openCard(wanting, 'considerKids');
  choose(wanting, 'Yes');
  assert.ok(wanting.flags.scheduled.some((entry) => entry.id === 'baby'), 'the baby arrives a few quarters later');
  const spending = quarterlyExpenses(wanting) * 4;
  const mood = lifeMoodTerms(wanting).reduce((sum, term) => sum + term.value, 0);
  wanting.flags.scheduled = [];
  openCard(wanting, 'baby');
  wanting.currentEvent.data = { girl: true };
  prepareCurrentEvent(wanting);
  choose(wanting, 'Back at your desk');
  assert.equal(kidsAtHome(wanting).length, 1);
  assert.equal(wanting.dependents, 1);
  assert.ok(childCostPerYear(wanting) >= FAMILY.childCostUnderFive);
  assert.ok(quarterlyExpenses(wanting) * 4 > spending + 20000, 'a child is a large, constant cost');
  const after = lifeMoodTerms(wanting);
  assert.ok(after.some((term) => term.label === 'Kids at home' && term.value >= FAMILY.kidMotivation), 'and a constant lift to mood');
  assert.ok(after.reduce((sum, term) => sum + term.value, 0) > mood - 5);
  // They grow up and leave: the cost and the lift go.
  wanting.quarterIndex += FAMILY.childLeavesHomeAge * 4 + 1;
  assert.equal(kidsAtHome(wanting).length, 0);
  assert.ok(!lifeMoodTerms(wanting).some((term) => term.label === 'Kids at home'));
});

test('parental leave: twelve weeks for a woman, six for a man, job-protected and unpaid', () => {
  for (const [characterId, expected] of [['jennifer', FAMILY.leaveDays.female], ['joseph', FAMILY.leaveDays.male]]) {
    const game = createGame({ seed: 317, characterId });
    clearEvents(game);
    game.player.age = 31;
    startDating(game, makeCandidate(game, game.random));
    marry(game);
    openCard(game, 'baby');
    game.currentEvent.data = { girl: false };
    prepareCurrentEvent(game);
    const labels = game.currentEvent.choices.map((choice) => choice.label);
    assert.ok(labels.some((label) => label.includes(characterId === 'jennifer' ? 'maternity' : 'paternity')));
    choose(game, 'Take ');
    assert.equal(game.fmla.daysLeft, expected);
    assert.equal(game.fmla.kind, 'parental');
    assert.ok(game.journal.some((entry) => entry.kind === 'parentalLeave'));
    finishQuarterDays(game);
    assert.ok(game.player.quarter.unpaidDays > 0, 'the leave is unpaid');
  }
});

test('a divorce with children keeps the children as a cost, at a share, and costs a lot of mood', () => {
  const game = coupled(318);
  game.player.age = 35;
  game.player.motivation = 90;
  game.savings = 100000;
  openCard(game, 'baby');
  choose(game, 'Back at your desk');
  const married = childCostPerYear(game);
  assert.ok(married > 0);
  closeQuarterWithStrain(game);
  assert.equal(game.married, false);
  assert.ok(game.player.motivation < 90 - 10);
  assert.ok(childCostPerYear(game) < married, 'support replaces the household budget');
  assert.ok(childCostPerYear(game) > 0, 'but the children are still a cost');
});

function closeQuarterWithStrain(game) {
  clearEvents(game);
  finishQuarterDays(game);
  game.family.quality = 0;
  game.family.below = FAMILY.divorceQuarters;
  closeQuarter(game);
}

test('autopilot never answers the big romance and family questions for the player', () => {
  const memory = { proposal: { label: 'Propose, and plan a big wedding', tag: 'kind', index: 0 }, meetSomeone: { label: 'Ask X out', tag: 'kind', index: 0 }, anniversary: { label: 'A nice dinner', tag: 'safe', index: 1 } };
  const choices = [{ label: 'Propose, and plan a big wedding', tag: 'kind' }];
  assert.equal(pickRemembered(memory, 'proposal', choices), null);
  assert.equal(pickRemembered(memory, 'meetSomeone', [{ label: 'Ask X out', tag: 'kind' }]), null);
  assert.equal(pickRemembered(memory, 'anniversary', [{ label: 'A nice dinner', tag: 'safe' }]), 0, 'smaller moments repeat');
});

test('a saved career keeps its circle, partner, marriage and children', () => {
  const game = coupled(319);
  game.player.age = 33;
  openCard(game, 'baby');
  choose(game, 'Back at your desk');
  clearEvents(game);
  const restored = deserializeGame(serializeGame(game));
  assert.equal(restored.partner.name, game.partner.name);
  assert.equal(restored.family.quality, game.family.quality);
  assert.equal(restored.children.length, 1);
  assert.equal(restored.social, game.social);
});

test('the social bar costs nothing in a typical career: the circle settles near what each temperament needs', () => {
  for (const [characterId, label] of [['jennifer', 'extrovert'], ['simon', 'introvert']]) {
    const game = createGame({ seed: 320, characterId });
    clearEvents(game);
    game.social = SOCIAL.start;
    playQuarters(game, 40);
    const term = lifeMoodTerms(game).find((entry) => entry.label.startsWith('Social')).value;
    assert.ok(Math.abs(term) < 8, `${label}: a settled circle is within a few points of the need (${term.toFixed(1)})`);
  }
});
