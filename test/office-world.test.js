import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildLayout, buildWalkGrid, findPath, reachableNear } from '../src/ui/office-world.js';
import { THEMES } from '../src/ui/office-themes.js';
import { createGame, chooseEventOption, closeQuarter, finishQuarterDays, quitJob } from '../src/sim/game.js';
import { officeVisit, officeVisitStatus } from '../src/sim/office-life.js';

const RANKS = ['open', 'window', 'office', 'suite'];

test('every industry setting and rank has a floor of rooms: a player desk, colleagues, a pantry, a meeting room and a lounge, all reachable on foot', () => {
  for (const themeId of Object.keys(THEMES)) {
    for (const rank of RANKS) {
      const layout = buildLayout(themeId, rank);
      const label = `${themeId}/${rank}`;
      assert.ok(layout.player.desk, `${label}: a desk for the player`);
      assert.ok(layout.desks.filter((desk) => desk.peer).length >= 2, `${label}: colleagues at desks`);
      for (const kind of ['pantry', 'meeting', 'lounge']) assert.ok(layout.pois.some((entry) => entry.kind === kind), `${label}: a ${kind}`);
      assert.ok(layout.rooms.length >= 8, `${label}: several rooms (${layout.rooms.length})`);
      const grid = buildWalkGrid(layout);
      const start = { x: layout.player.seat.x + 0.1, y: layout.player.seat.y + 0.4 };
      assert.ok(grid[Math.floor(start.y)][Math.floor(start.x)], `${label}: the chair is clear`);
      for (const entry of layout.pois) {
        const goal = reachableNear(grid, start, entry);
        assert.ok(goal, `${label}: ${entry.id} has floor beside it that can be reached`);
        const path = findPath(grid, start, goal);
        assert.ok(path && path.length > 0, `${label}: the way from the desk to ${entry.id}`);
        for (const step of path) assert.ok(grid[Math.floor(step.y)][Math.floor(step.x)], `${label}: ${entry.id}: every step is on floor`);
      }
    }
  }
});

test('the floor is larger than any view: no part of the building ends within the first rooms, and the walls leave doorways', () => {
  const layout = buildLayout('established', 'open');
  assert.ok(layout.width >= 40 && layout.depth >= 30);
  const grid = buildWalkGrid(layout);
  const blocked = grid.flat().filter((cell) => !cell).length;
  assert.ok(blocked > 40 && blocked < grid.flat().length * 0.4, 'furniture and walls block some cells, not most');
  // Walls separate rooms: the straight line through the meeting-room wall is blocked, the doorway is not.
  const wall = layout.walls.find((entry) => entry.axis === 'x' && entry.glass && entry.gaps.length);
  const [gapStart, gapEnd] = wall.gaps[0];
  const through = Math.floor((gapStart + gapEnd) / 2);
  assert.ok(grid[through][Math.floor(wall.at)], 'the doorway is open');
  const solid = wall.from + 0.5;
  if (!wall.gaps.some(([a, b]) => solid >= a && solid <= b)) assert.equal(grid[Math.floor(solid)][Math.floor(wall.at)], false, 'the wall is solid');
});

test('a pathfinder goes round furniture and through doors, and finds no way into a sealed cell', () => {
  const grid = Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => true));
  for (let y = 0; y < 8; y += 1) grid[y][4] = y === 6;
  const path = findPath(grid, { x: 1, y: 1 }, { x: 7, y: 1 });
  assert.ok(path && path.some((step) => Math.floor(step.x) === 4 && Math.floor(step.y) === 6), 'it uses the gap');
  grid[6][4] = false;
  assert.equal(findPath(grid, { x: 1, y: 1 }, { x: 7, y: 1 }), null);
});

test('a moment away from the desk counts once a quarter, helps a little, and needs a job', () => {
  const game = createGame({ seed: 40, characterId: 'joseph' });
  while (game.currentEvent) chooseEventOption(game, 0);
  assert.equal(officeVisitStatus(game).allowed, true);
  const motivation = game.player.motivation;
  const peer = game.org.agents.find((agent) => agent !== game.player && !agent.departed);
  const before = peer.relationship;
  const result = officeVisit(game, 'pantry', peer);
  assert.ok(result.applied && game.player.motivation > motivation && peer.relationship > before);
  assert.equal(officeVisitStatus(game).allowed, false, 'once is all this quarter allows');
  const again = officeVisit(game, 'lounge');
  assert.equal(again.applied, false);
  assert.equal(game.player.motivation, motivation + 3, 'the second visit changes nothing');
  finishQuarterDays(game);
  closeQuarter(game);
  while (game.currentEvent) chooseEventOption(game, 0);
  assert.equal(officeVisitStatus(game).allowed, true, 'a new quarter, a new chance');
  quitJob(game);
  assert.equal(officeVisitStatus(game).allowed, false, 'between jobs there is no office');
});

test('each kind of visit does its own small thing', () => {
  const run = (kind) => {
    const game = createGame({ seed: 41, characterId: 'joseph' });
    while (game.currentEvent) chooseEventOption(game, 0);
    const player = game.player;
    player.health = 70;
    player.motivation = 60;
    const snapshot = { health: player.health, motivation: player.motivation, readiness: player.readiness, skill: player.skill, bonus: player.quarter.performanceBonus ?? 0 };
    officeVisit(game, kind);
    return { player, snapshot };
  };
  const lounge = run('lounge');
  assert.ok(lounge.player.health > lounge.snapshot.health && lounge.player.motivation > lounge.snapshot.motivation);
  const pair = run('peer');
  assert.ok((pair.player.quarter.performanceBonus ?? 0) > pair.snapshot.bonus && pair.player.skill > pair.snapshot.skill);
  const meeting = run('meeting');
  assert.ok(meeting.player.readiness > meeting.snapshot.readiness);
});

test('walking is smooth: paths become a few straight legs at any angle, and walkers curve and face their way', async () => {
  const { smoothPath, stepWalker, clearLine } = await import('../src/ui/office-world.js');
  const open = Array.from({ length: 12 }, () => Array.from({ length: 12 }, () => true));
  const diagonal = findPath(open, { x: 1, y: 1 }, { x: 9, y: 6 });
  const legs = smoothPath(open, diagonal);
  assert.equal(legs.length, 2, 'open floor: one straight leg, at whatever angle');
  const walled = open.map((row) => [...row]);
  for (let y = 0; y < 9; y += 1) walled[y][5] = false;
  const around = smoothPath(walled, findPath(walled, { x: 1, y: 1 }, { x: 9, y: 1 }));
  assert.ok(around.length >= 3 && around.length < 10, 'round a wall: a few legs, not a staircase of cells');
  for (let index = 1; index < around.length; index += 1) assert.ok(clearLine(walled, around[index - 1], around[index]), 'every leg stays on the floor');
  const walker = { x: 1.5, y: 1.5, path: around.slice(1), heading: 0 };
  const headings = new Set();
  for (let frame = 0; frame < 600 && walker.path.length; frame += 1) {
    stepWalker(walker, 1 / 60, 3.4, walled);
    assert.ok(walled[Math.floor(walker.y)][Math.floor(walker.x)], 'never inside a wall');
    headings.add(Math.round(walker.heading * 10));
  }
  assert.equal(walker.path.length, 0, 'it arrives');
  assert.ok(headings.size > 6, 'the heading turns gradually, through many angles');
});
