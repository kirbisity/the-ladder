import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, chooseEventOption, finishQuarterDays, closeQuarter, setPlan, vitalsBreakdown } from '../src/sim/game.js';
import { sirQuarter, sirWave, sirLayoffShare, sirPipFactor, payFactor, calendarYear, startYearOf, clampBirthYear } from '../src/sim/era.js';
import { totalBandwidth } from '../src/sim/agent.js';
import { MUSIC_FOR_SCENE } from '../src/ui/music.js';
import { ERA, TIME, MOTIVATION, HEALTH } from '../src/config.js';
import { serializeGame, deserializeGame } from '../src/sim/save.js';

function clearEvents(game) {
  while (game.currentEvent) {
    const id = game.currentEvent.event.id;
    // Keep careers going through the offer at fifty and the revolution's own card.
    const keep = id === 'retireOffer' ? 1 : 0;
    chooseEventOption(game, keep);
  }
}

function playQuarters(game, count) {
  for (let index = 0; index < count && !game.outcome; index += 1) {
    clearEvents(game);
    finishQuarterDays(game);
    closeQuarter(game);
  }
}

test('the birth year sets the calendar and the starting pay: later is a little better paid', () => {
  assert.equal(startYearOf(1980), 2002);
  assert.equal(startYearOf(2010), 2032);
  assert.equal(clampBirthYear(1970), 1980);
  assert.equal(clampBirthYear(2020), 2010);
  assert.ok(payFactor(2010) > payFactor(1995) && payFactor(1995) > payFactor(1980));
  assert.ok(payFactor(2010) < 1.2 && payFactor(1980) > 0.8, 'a bit, not a lot');
  const early = createGame({ seed: 1, birthYear: 1985 });
  const late = createGame({ seed: 1, birthYear: 2008 });
  assert.equal(early.startYear, 2007);
  assert.equal(calendarYear(early), 2007);
  assert.ok(late.player.salary > early.player.salary);
  for (let quarter = 0; quarter < 4; quarter += 1) {
    clearEvents(early);
    finishQuarterDays(early);
    closeQuarter(early);
  }
  assert.equal(calendarYear(early), 2008, 'a year of quarters is a calendar year');
});

test("the revolution arrives at the field's year, or two quarters in for anyone who starts after it", () => {
  const early = createGame({ seed: 2, industryId: 'tech', birthYear: 1990 });
  assert.equal(sirQuarter(early), (ERA.sirYear.tech - 2012) * 4);
  const late = createGame({ seed: 2, industryId: 'tech', birthYear: 2010 });
  assert.equal(sirQuarter(late), ERA.lateStarterDelayQuarters);
  const academia = createGame({ seed: 2, industryId: 'academia', birthYear: 2010 });
  assert.equal(sirQuarter(academia), (ERA.sirYear.academia - 2032) * 4, 'academia waits until 2038');
  assert.ok(ERA.sirYear.tech < ERA.sirYear.consulting && ERA.sirYear.consulting < ERA.sirYear.privateEquity && ERA.sirYear.privateEquity < ERA.sirYear.academia);
  playQuarters(late, 1);
  assert.equal(late.sir, null, 'not in the first quarters');
  playQuarters(late, 1);
  assert.ok(late.sir, 'and then, two quarters in, it happens');
  assert.equal(late.sir.quarter, ERA.lateStarterDelayQuarters);
  assert.ok(late.journal.some((entry) => entry.kind === 'sir'));
});

test('after the revolution: yearly layoff rounds that hit the bottom hardest and intensify every five years', () => {
  for (const wave of [1, 2, 3]) {
    assert.ok(sirLayoffShare(wave, 0) > sirLayoffShare(wave, ERA.middleLevel), 'the bottom is cut more than the middle');
    assert.ok(sirLayoffShare(wave, ERA.middleLevel) > sirLayoffShare(wave, 7), 'and the middle more than the top');
    assert.ok(sirLayoffShare(wave + 1, 1) > sirLayoffShare(wave, 1), 'each wave cuts deeper');
    assert.ok(sirPipFactor(wave, 1) > sirPipFactor(wave, 6), 'the PIP bar rises faster at the bottom');
  }
  assert.equal(sirPipFactor(0, 1), 1, 'no change before the revolution');
  const game = createGame({ seed: 3, industryId: 'tech', birthYear: 2010 });
  playQuarters(game, 4);
  assert.equal(sirWave(game), 1);
  game.quarterIndex = game.sir.quarter + 4 * ERA.waveYears;
  assert.equal(sirWave(game), 2, 'five years on, the second wave');
});

test('after the revolution most work cards are its own: demos, workshops, pilots', async () => {
  const { drawEvent } = await import('../src/sim/events.js');
  const game = createGame({ seed: 4, industryId: 'tech', birthYear: 2010 });
  playQuarters(game, 3);
  assert.ok(game.sir);
  let era = 0;
  for (let draw = 0; draw < 200; draw += 1) {
    game.eventLast = {};
    if (drawEvent(game, game.random)?.category === 'era') era += 1;
  }
  assert.ok(era > 200 * 0.4, `era cards come up often (${era}/200)`);
});

test('fifty brings an offer of ordinary retirement; yes ends the career as a retirement, no carries on to sixty', () => {
  assert.equal(TIME.retirementAge, 60);
  const game = createGame({ seed: 5, birthYear: 1990 });
  while (game.currentEvent) chooseEventOption(game, 0);
  game.player.age = 50;
  finishQuarterDays(game);
  closeQuarter(game);
  assert.equal(game.currentEvent?.event.id === 'retireOffer' || game.eventQueue.some((entry) => entry.event.id === 'retireOffer'), true);
  while (game.currentEvent && game.currentEvent.event.id !== 'retireOffer') chooseEventOption(game, 0);
  const index = game.currentEvent.choices.findIndex((choice) => choice.label === 'Retire now');
  chooseEventOption(game, index);
  assert.equal(game.outcome?.kind, 'retired', 'an ordinary retirement, not FIRE');
  assert.ok(game.outcome.early);
  const stays = createGame({ seed: 6, birthYear: 1990 });
  while (stays.currentEvent) chooseEventOption(stays, 0);
  stays.player.age = 50;
  finishQuarterDays(stays);
  closeQuarter(stays);
  while (stays.currentEvent && stays.currentEvent.event.id !== 'retireOffer') chooseEventOption(stays, 0);
  chooseEventOption(stays, stays.currentEvent.choices.findIndex((choice) => choice.label.startsWith('Keep going')));
  assert.equal(stays.outcome, null);
  stays.player.age = 59.9;
  playQuarters(stays, 2);
  assert.equal(stays.outcome?.kind, 'retired', 'retirement at sixty');
});

test('working weekends: more output than the weekday ceiling, and a heavier toll than any weekday', () => {
  const game = createGame({ seed: 7, characterId: 'joseph' });
  while (game.currentEvent) chooseEventOption(game, 0);
  setPlan(game, { hours: 10 });
  const weekday = { output: totalBandwidth(game.player), health: vitalsBreakdown(game).health.target, mood: vitalsBreakdown(game).motivation.target };
  setPlan(game, { hours: 16 });
  const longest = { health: vitalsBreakdown(game).health.target, mood: vitalsBreakdown(game).motivation.target };
  setPlan(game, { hours: 10, weekends: true });
  const weekend = { output: totalBandwidth(game.player), health: vitalsBreakdown(game).health.target, mood: vitalsBreakdown(game).motivation.target };
  assert.ok(weekend.output > weekday.output * 1.25, 'weekends add output');
  assert.ok(weekend.health < weekday.health - 10 && weekend.mood < weekday.mood - 15, 'and cost far more than ten-hour weekdays');
  setPlan(game, { hours: 12, weekends: true });
  assert.ok(vitalsBreakdown(game).motivation.target < longest.mood + 10, 'twelve-hour weeks with weekends cost about what sixteen-hour days do');
  const christopher = createGame({ seed: 7, characterId: 'christian' });
  while (christopher.currentEvent) chooseEventOption(christopher, 0);
  setPlan(christopher, { hours: 12, weekends: true });
  const carried = vitalsBreakdown(christopher);
  assert.ok(carried.motivation.target > MOTIVATION.burnoutLine + 10 && carried.health.target > HEALTH.dangerLine + 10, 'Christopher carries it, well clear of burnout');
  const joe = createGame({ seed: 7, characterId: 'joseph' });
  while (joe.currentEvent) chooseEventOption(joe, 0);
  setPlan(joe, { hours: 12, weekends: true });
  assert.ok(vitalsBreakdown(joe).motivation.target < MOTIVATION.burnoutLine, 'Joseph does not');
});

test('music is mapped to the big moments, and the files exist', async () => {
  const fs = await import('node:fs');
  for (const name of new Set(Object.values(MUSIC_FOR_SCENE))) assert.ok(fs.existsSync(`audio/music/${name}.mp3`), name);
  assert.equal(MUSIC_FOR_SCENE.sir, 'agi');
  assert.equal(MUSIC_FOR_SCENE.fire, 'good_ending');
  assert.equal(MUSIC_FOR_SCENE.retiredWealthy, 'good_ending');
  assert.equal(MUSIC_FOR_SCENE.breakdown, 'bad_ending');
  assert.equal(MUSIC_FOR_SCENE.burnout, 'bad_ending');
  assert.equal(MUSIC_FOR_SCENE.promoted, 'big_moment');
  assert.equal(MUSIC_FOR_SCENE.married, 'life');
});

test('a saved career keeps its birth year, calendar and revolution', () => {
  const game = createGame({ seed: 8, birthYear: 2009 });
  playQuarters(game, 4);
  const restored = deserializeGame(serializeGame(game));
  assert.equal(restored.birthYear, 2009);
  assert.equal(calendarYear(restored), calendarYear(game));
  assert.deepEqual(restored.sir, game.sir);
  assert.equal(restored.industry.salaries[0], game.industry.salaries[0], 'pay stays in the money of the start year');
});
