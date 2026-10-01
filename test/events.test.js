import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame, chooseEventOption, finishQuarterDays, closeQuarter, quitJob, startRunning, runDay, takeFmla, fmlaStatus,
} from '../src/sim/game.js';
import { drawEvent, drawLifeEvent, allEvents } from '../src/sim/events.js';
import { projectSpec, projectFor, projectsOpenTo } from '../src/sim/agent.js';
import { resolveProject } from '../src/sim/org.js';
import { careerSummary } from '../src/sim/story.js';
import { playQuarter, POLICIES } from '../src/sim/bots.js';
import { INDUSTRIES, FMLA, TIME } from '../src/config.js';

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
  const game = createGame({ seed: 42, characterId: 'marcus' });
  const junior = projectsOpenTo(game.player, game.industry).map((project) => project.role);
  assert.ok(!junior.includes('risky'));
  game.player.level = 3;
  assert.ok(projectsOpenTo(game.player, game.industry).some((project) => project.role === 'risky'));
});

test('FMLA: a year in, twelve weeks unpaid, no rating, faster recovery, once a year', () => {
  const game = createGame({ seed: 43 });
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
      const game = createGame({ seed, characterId: 'elena', industryId: 'tech' });
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
  const game = createGame({ seed: 44, characterId: 'maya', industryId: 'consulting' });
  playQuarters(game, 40);
  game.outcome = { kind: 'retired', age: game.player.age, netWorth: game.savings, title: 'x' };
  const story = careerSummary(game);
  assert.ok(story.verdict.length > 0);
  assert.ok(story.paragraphs.length >= 4);
  assert.match(story.paragraphs[0], /Maya Lin/);
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
