import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame, chooseEventOption, finishQuarterDays, closeQuarter, quitJob, startRunning, runDay, takeFmla, fmlaStatus,
  takeHoliday, holidayStatus, fireNumber, fireReady, prepareCurrentEvent,
} from '../src/sim/game.js';
import { drawEvent, drawLifeEvent, allEvents, eventById } from '../src/sim/events.js';
import { projectSpec, projectFor, projectsOpenTo } from '../src/sim/agent.js';
import { resolveProject } from '../src/sim/org.js';
import { careerSummary } from '../src/sim/story.js';
import { playQuarter, POLICIES } from '../src/sim/bots.js';
import { INDUSTRIES, FMLA, TIME, EVENTS } from '../src/config.js';

function clearEvents(game) {
  while (game.currentEvent) chooseEventOption(game, 0);
}

function playQuarters(game, count) {
  for (let index = 0; index < count && !game.outcome; index += 1) {
    clearEvents(game);
    finishQuarterDays(game);
    closeQuarter(game);
  }
}

test('out of work, no work card is ever drawn; at work, no job-hunt card', () => {
  for (const industryId of Object.keys(INDUSTRIES)) {
    const game = createGame({ seed: 40, industryId });
    clearEvents(game);
    for (let draw = 0; draw < 200; draw += 1) {
      const atWork = drawEvent(game, game.random);
      if (atWork) assert.notEqual(atWork.scope, 'jobless', atWork.id);
      if (atWork && atWork.industry) assert.equal(atWork.industry, industryId);
    }
    quitJob(game);
    const seen = new Set();
    for (let draw = 0; draw < 200; draw += 1) {
      const atHome = drawEvent(game, game.random);
      const life = drawLifeEvent(game, game.random);
      for (const card of [atHome, life]) {
        if (!card) continue;
        assert.notEqual(card.scope, 'work', `${card.id} needs a job`);
        seen.add(card.category);
      }
    }
    assert.ok(seen.has('jobless'), 'the job hunt has its own deck');
    assert.ok(seen.has('lifestyle'), 'life goes on out of work');
  }
});

test('life events land on a random day mid-quarter and pause the clock', () => {
  let game = null;
  for (let seed = 1; seed < 40 && !game; seed += 1) {
    const candidate = createGame({ seed });
    playQuarters(candidate, 1);
    if (candidate.lifeEventDays.length) game = candidate;
  }
  assert.ok(game, 'some quarter schedules a life event');
  clearEvents(game);
  const day = Math.min(...game.lifeEventDays);
  startRunning(game);
  let stoppedOn = null;
  while (game.phase === 'running' && stoppedOn === null) {
    const { notes } = runDay(game);
    if (notes.some((note) => note.kind === 'event')) stoppedOn = game.day;
  }
  assert.equal(stoppedOn, day);
  assert.equal(game.currentEvent.event.timing, 'life');
  const before = game.day;
  runDay(game);
  assert.equal(game.day, before, 'the clock waits for an answer');
  chooseEventOption(game, 0);
  runDay(game);
  assert.equal(game.day, before + 1);
});

test('each industry has its own projects, one for every role', () => {
  const roles = ['safe', 'visible', 'special', 'big', 'repair', 'citizenship', 'risky'];
  const names = new Set();
  for (const industry of Object.values(INDUSTRIES)) {
    for (const role of roles) assert.equal(projectFor(industry, role).role, role, `${industry.id} ${role}`);
    for (const project of industry.projects) names.add(project.name);
  }
  assert.equal(names.size, Object.values(INDUSTRIES).reduce((sum, industry) => sum + industry.projects.length, 0), 'no project is shared between industries');
});

test('a landed project moves its industry meter', () => {
  const game = createGame({ seed: 41, industryId: 'tech' });
  const player = game.player;
  player.industry.techDebt = 80;
  player.quarter.projectId = 'refactor';
  player.quarter.projectProgress = 1.2;
  resolveProject(player, game.industry, game.random);
  assert.ok(player.industry.techDebt < 80 - 30);
  assert.equal(projectSpec('refactor', INDUSTRIES.consulting), null, 'tech projects stay in tech');
});

test('big and risky projects open with seniority', () => {
  const game = createGame({ seed: 42, characterId: 'simon' });
  const junior = projectsOpenTo(game.player, game.industry).map((project) => project.role);
  assert.ok(!junior.includes('risky'));
  game.player.level = 3;
  assert.ok(projectsOpenTo(game.player, game.industry).some((project) => project.role === 'risky'));
});

test('FMLA: a year in, twelve weeks unpaid, no rating, faster recovery, once a year', () => {
  const game = createGame({ seed: 43, tierLock: 'aggressive' });
  assert.equal(fmlaStatus(game).eligible, false, 'not in the first year');
  playQuarters(game, FMLA.eligibleAfterQuarters);
  assert.equal(fmlaStatus(game).eligible, true);
  clearEvents(game);
  game.player.burnout.active = true;
  game.player.motivation = 12;
  game.player.pip.active = true;
  takeFmla(game);
  assert.equal(fmlaStatus(game).eligible, false);
  const report = (finishQuarterDays(game), closeQuarter(game));
  assert.equal(report.rating, 'onLeave');
  assert.ok(!game.player.pip.active, 'no PIP on leave');
  assert.ok(report.income < game.player.salary / 4 * 0.05, 'unpaid');
  assert.ok(game.player.motivation > 30, `recovered to ${game.player.motivation.toFixed(1)}`);
  assert.ok(game.employment.employed, 'job-protected');
  playQuarters(game, 2);
  assert.equal(fmlaStatus(game).eligible, false, 'twelve weeks in any twelve months');
});

test('every career ends with a story, whatever the ending', () => {
  const told = new Map();
  for (let seed = 7000; seed < 7060 && told.size < 4; seed += 1) {
    for (const policyName of ['balanced', 'grinder', 'coaster']) {
      const game = createGame({ seed, characterId: 'joseph', industryId: 'tech' });
      while (!game.outcome) playQuarter(game, POLICIES[policyName]);
      if (told.has(game.outcome.kind)) continue;
      const story = careerSummary(game);
      const text = story.paragraphs.join(' ');
      assert.ok(story.paragraphs.length >= 4, game.outcome.kind);
      assert.ok(!text.includes('undefined') && !text.includes('NaN'), text);
      told.set(game.outcome.kind, story);
    }
  }
  assert.ok(told.has('retired') && told.has('death') && told.has('homeless'), [...told.keys()].join(', '));
  assert.match(told.get('death').paragraphs.join(' '), /hospital/);
  assert.match(told.get('homeless').paragraphs.join(' '), /savings gone/);
  assert.notEqual(told.get('retired').verdict, told.get('death').verdict);
  if (told.has('breakdown')) assert.match(told.get('breakdown').paragraphs.join(' '), /could not go on|nothing was left/);
});

test('the story names the moments the journal recorded', () => {
  const game = createGame({ seed: 44, characterId: 'chloe', industryId: 'consulting' });
  playQuarters(game, 40);
  game.outcome = { kind: 'retired', age: game.player.age, netWorth: game.savings, title: 'x' };
  const story = careerSummary(game);
  assert.ok(story.verdict.length > 0);
  assert.ok(story.paragraphs.length >= 4);
  assert.match(story.paragraphs[0], /Chloe C/);
  assert.match(story.paragraphs[0], /management consulting/);
  const promotions = game.journal.filter((entry) => entry.kind === 'promoted').length;
  const words = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
  const counted = promotions < 10 ? words[promotions] : String(promotions);
  if (promotions) assert.ok(story.paragraphs.some((paragraph) => paragraph.includes(`${counted} promotion`)), story.paragraphs.join(' | '));
  const text = story.paragraphs.join(' ');
  assert.ok(!text.includes('undefined') && !text.includes('NaN'), text);
});

test('every card in the deck has a scope, a timing and tagged choices', () => {
  for (const event of allEvents()) {
    assert.ok(['work', 'jobless', 'any'].includes(event.scope), event.id);
    assert.ok(['start', 'life'].includes(event.timing), event.id);
    if (Array.isArray(event.choices)) for (const choice of event.choices) assert.ok(choice.tag, `${event.id}: ${choice.label}`);
  }
  assert.ok(TIME.daysPerQuarter > 0);
});

test('holidays: paid days first, then unpaid; faster recovery; rated on days worked', () => {
  const game = createGame({ seed: 45 });
  clearEvents(game);
  game.player.motivation = 40;
  game.player.motivationBefore = 40;
  const before = game.savings;
  takeHoliday(game, 20);
  assert.equal(holidayStatus(game).allowed, false, 'one trip at a time');
  assert.ok(game.savings < before, 'travel costs money');
  const report = (finishQuarterDays(game), closeQuarter(game));
  assert.notEqual(report.rating, 'onLeave', 'four weeks away is still a rated quarter');
  assert.ok(report.income < game.player.salary / 4, 'days past the paid allowance are unpaid');
  assert.ok(report.income > game.player.salary / 4 * 0.85, 'but most of the pay is still there');
  const rested = createGame({ seed: 45 });
  clearEvents(rested);
  rested.player.motivation = 40;
  rested.player.motivationBefore = 40;
  finishQuarterDays(rested);
  assert.ok(game.player.motivation > rested.player.motivation, 'away recovers faster than at the desk');
});

test('FIRE: offered once net worth covers a lifetime of spending, and ends the career on yes', () => {
  const game = createGame({ seed: 46 });
  clearEvents(game);
  game.player.age = 40;
  assert.equal(fireReady(game), false);
  const age = game.player.age;
  game.player.age = 55;
  const late = fireNumber(game);
  game.player.age = 35;
  assert.ok(fireNumber(game) > late * 1.1, 'retiring younger needs a bigger pot');
  game.player.age = age;
  game.savings = fireNumber(game) * 2;
  assert.equal(fireReady(game), true);
  finishQuarterDays(game);
  closeQuarter(game);
  assert.equal(game.currentEvent?.event.id, 'fireOffer');
  chooseEventOption(game, 1);
  assert.equal(game.outcome, null, 'declining keeps you working');
  assert.equal(fireReady(game), false, 'and it will not ask again for a while');
  game.fireAskedQuarter = -99;
  clearEvents(game);
  finishQuarterDays(game);
  closeQuarter(game);
  assert.equal(game.currentEvent?.event.id, 'fireOffer');
  chooseEventOption(game, 0);
  assert.equal(game.outcome?.kind, 'fire');
  assert.ok(careerSummary(game).paragraphs.join(' ').includes('one-way ticket'));
});

function drawCareer(industryId, quarters) {
  const game = createGame({ seed: 61, industryId, tierLock: 'mid' });
  clearEvents(game);
  const draws = [];
  for (let quarter = 0; quarter < quarters; quarter += 1) {
    game.quarterIndex = quarter;
    game.player.age = 22 + quarter / 4;
    // As often as a real quarter deals them.
    const dealt = [];
    if (game.random.chance(EVENTS.chancePerQuarter)) dealt.push(drawEvent(game, game.random));
    if (game.random.chance(EVENTS.lifeEventChance)) dealt.push(drawLifeEvent(game, game.random));
    if (game.random.chance(EVENTS.secondLifeEventChance)) dealt.push(drawLifeEvent(game, game.random));
    for (const drawn of dealt) if (drawn) draws.push({ id: drawn.id, quarter, timing: drawn.timing });
  }
  return draws;
}

test('a card is almost never drawn again within a year and a half', () => {
  const gapInQuarters = 6;
  const draws = drawCareer('tech', 160);
  const lastSeen = new Map();
  let early = 0;
  for (const draw of draws) {
    const last = lastSeen.get(draw.id);
    if (last !== undefined && draw.quarter - last < gapInQuarters) early += 1;
    lastSeen.set(draw.id, draw.quarter);
  }
  assert.ok(draws.length > 150, 'the scenario: a long career of draws');
  assert.ok(early / draws.length < 0.05, `${early} of ${draws.length} came back early`);
});

test('a long career meets many different moments in every industry', () => {
  for (const industryId of Object.keys(INDUSTRIES)) {
    const distinct = new Set(drawCareer(industryId, 160).map((draw) => draw.id));
    assert.ok(distinct.size >= 45, `${industryId}: only ${distinct.size} distinct cards`);
  }
});

test('some cards only come with age, and the losses of life are in the deck', () => {
  const game = createGame({ seed: 62 });
  clearEvents(game);
  for (const id of ['midlifeQuestion', 'kneeSurgery', 'parentDies', 'youngerBoss']) {
    game.player.age = 28;
    game.player.level = 3;
    assert.equal(eventById(id).weight(game), 0, `${id} at 28`);
    game.player.age = 52;
    assert.ok(eventById(id).weight(game) > 0, `${id} at 52`);
  }
  for (const id of ['friendDies', 'grandparentDies', 'parentDies', 'highwayCrash', 'petDies', 'burglary']) assert.ok(eventById(id), id);
  assert.ok(eventById('crashAftermath'), 'the crash has a follow-up');
});

/** Put a card in front of the player. */
function openCard(game, id) {
  clearEvents(game);
  game.currentEvent = { event: eventById(id), data: {} };
  prepareCurrentEvent(game);
}

test('the car question: a purchase is remembered, costs a payment plan and lifts mood; going without saves money', () => {
  const game = createGame({ seed: 71, characterId: 'simon' });
  clearEvents(game);
  game.player.age = 30;
  assert.ok(eventById('carDecision').weight(game) > 0);
  const mood = game.player.motivation = 60;
  openCard(game, 'carDecision');
  const first = game.currentEvent.choices.findIndex((choice) => choice.label.startsWith('Buy a new sedan'));
  chooseEventOption(game, first);
  assert.equal(game.flags.car, 'new');
  assert.ok(game.paymentPlans.length > 0, 'a loan to pay');
  assert.ok(game.player.motivation > mood);
  const carFree = createGame({ seed: 72, characterId: 'simon' });
  clearEvents(carFree);
  carFree.player.age = 30;
  const before = carFree.savings;
  openCard(carFree, 'carDecision');
  chooseEventOption(carFree, carFree.currentEvent.choices.findIndex((choice) => choice.label.startsWith('Go without')));
  assert.equal(carFree.flags.car, 'none');
  assert.ok(carFree.savings > before);
});

test('a nicer apartment raises the rent and the mood, and the penthouse needs a penthouse salary', () => {
  const game = createGame({ seed: 73, characterId: 'joseph' });
  clearEvents(game);
  game.player.age = 28;
  game.player.salary = 90000;
  openCard(game, 'betterApartment');
  const labels = game.currentEvent.choices.map((choice) => choice.label);
  assert.ok(labels.some((label) => label.startsWith('Move to the nicer')));
  assert.ok(!labels.some((label) => label.startsWith('Take the penthouse')), 'not affordable on this salary');
  const rent = game.rentPremium ?? 0;
  chooseEventOption(game, labels.findIndex((label) => label.startsWith('Move to the nicer')));
  assert.ok(game.rentPremium > rent);
  assert.equal(game.flags.apartment, 'nice');
  assert.equal(eventById('betterApartment').weight({ ...game, homeEquity: 250000, player: game.player }), 0, 'owners do not rent');
});

test('the women-focused work cards come only to the women in the cast', () => {
  const ids = ['womenNetwork', 'mentorWoman', 'payGap', 'nerves', 'flexHours'];
  for (const [characterId, shows] of [['chloe', true], ['jennifer', true], ['eve', true], ['joseph', false], ['adam', false]]) {
    const game = createGame({ seed: 74, characterId });
    clearEvents(game);
    game.player.level = 2;
    game.player.quartersAtLevel = 10;
    game.player.plan.hours = 11;
    for (const id of ids) assert.equal(eventById(id).weight(game) > 0, shows, `${id} for ${characterId}`);
  }
});
