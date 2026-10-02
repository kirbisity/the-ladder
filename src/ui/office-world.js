// The office, as a whole floor of rooms rather than one room: an open plan,
// meeting rooms, a pantry, a lounge, and whatever the industry adds (a
// boardroom and partners' offices in finance, labs and a library at a
// university). The camera follows the player, so the picture never runs out
// of floor; the floor is a grid the player can walk across: click a spot and
// they stand up, cross the office (round the furniture, through the doors)
// and, at a colleague, the pantry, the meeting room or the lounge, spend a
// moment that the game turns into a small effect.
//
// Everything is drawn in code, in the same 2:1 isometric projection as before
// (x runs right-down, y left-down), as a depth-sorted list of boxes, glass
// walls, props and people.

import { drawSeatedWorker, drawPerson, peerLook } from './figures.js';
import { THEMES } from './office-themes.js';
import { lightAt, mixColor } from './office.js';

const TILE_W = 64;
const TILE_H = 32;
const WALL_H = 250;
const WINDOW_TOP = 128;
const PARTITION_H = 78;
// The rooms of an industry's floor plan sit inside a larger building: wings of lobby, huddle rooms and corridors surround
// them, so the camera, which follows the player, always has floor under it and a wall behind it.
const WORLD = { width: 46, depth: 36 };
const OFFSET = { x: 10, y: 9 };
const WALK_SPEED = 3.4;
const IDLE_RETURN_SECONDS = 7;

const shade = (color, amount) => (amount >= 0 ? mixColor(color, '#ffffff', amount) : mixColor(color, '#000000', -amount));

const GENRES = { startup: 'tech', growth: 'tech', established: 'tech', steady: 'tech', consulting: 'consulting', equity: 'equity', academia: 'academia', academiaNew: 'academia' };

// ── Layout: rooms, walls, furniture, points of interest ────────────────

/**
 * The floor plan for an industry's setting and the player's seniority.
 *
 * Returns:
 *   { rooms, walls, items, desks, pois, player: { desk, seat }, blocked }
 */
export function buildLayout(themeId, rank) {
  const theme = THEMES[themeId] ?? THEMES.established;
  const genre = GENRES[themeId] ?? 'tech';
  const rooms = [];
  const walls = [];
  const items = [];
  const desks = [];
  const pois = [];
  const room = (x0, y0, x1, y1, kind, floor) => rooms.push({ x0, y0, x1, y1, kind, floor: floor ?? theme.floorColor });
  // A wall along y (at a fixed x), or along x (at a fixed y), with doorway gaps.
  const wallAtX = (x, y0, y1, { gaps = [], glass = false, color = null } = {}) => walls.push({ axis: 'x', at: x, from: y0, to: y1, gaps, glass, color });
  const wallAtY = (y, x0, x1, { gaps = [], glass = false, color = null } = {}) => walls.push({ axis: 'y', at: y, from: x0, to: x1, gaps, glass, color });
  const item = (kind, x, y, options = {}) => items.push({ kind, x, y, ...options });
  const desk = (x, y, options = {}) => {
    desks.push({ x, y, ...options });
    item('desk', x, y, options);
  };
  const poi = (id, x, y, label, extra = {}) => pois.push({ id, x, y, label, ...extra });
  const W = WORLD.width;
  const D = WORLD.depth;

  // The player's own place, by seniority: an open-plan desk, a window desk, a private office or a corner suite.
  const isPrivate = rank === 'office' || rank === 'suite';

  if (genre === 'tech') {
    room(0, 0, 19.5, 14.5, 'work');
    room(19.5, 0, 29.5, 10.5, 'meeting', shade(theme.floorColor, -0.06));
    room(29.5, 0, W, 10.5, 'pantry', shade(theme.floorColor, 0.1));
    room(0, 14.5, 14, D, 'lounge', shade(theme.floorColor, -0.04));
    room(14, 14.5, 22.5, D, 'booths');
    room(22.5, 10.5, W, D, 'collab', shade(theme.floorColor, 0.05));
    room(19.5, 10.5, 22.5, 14.5, 'work');
    wallAtX(19.5, 0, 10.5, { glass: true, gaps: [[5.5, 8]] });
    wallAtX(29.5, 0, 10.5, { glass: true, gaps: [[4, 6.5]] });
    wallAtY(10.5, 19.5, W, { glass: true, gaps: [[22, 25]] });
    wallAtY(14.5, 0, 22.5, { gaps: [[7, 11.5], [16, 20]], color: shade(theme.wall, -0.04) });
    wallAtX(22.5, 10.5, D, { glass: true, gaps: [[14.5, 17.5]] });
    wallAtX(14, 14.5, D, { glass: true, gaps: [[19, 21.5]] });
    // Open plan: clusters of desks; the player's place first.
    const cluster = [[3, 3], [3, 6.2], [9, 3], [9, 6.2], [13.4, 3], [13.4, 6.2], [3, 10], [9, 10]];
    const spots = isPrivate ? cluster.slice(1) : cluster;
    if (isPrivate) {
      wallAtX(8, 0, 9.5, { glass: theme.desks !== 'wood', gaps: [[4, 6]] });
      wallAtY(9.5, 0, 8, { glass: theme.desks !== 'wood', gaps: [[2, 4]] });
      room(0, 0, 8, 9.5, 'office', rank === 'suite' ? '#a9b3c4' : '#b8c4d4');
      desk(2.4, 3.2, { player: true });
      item('couch', 5.2, 7.2, { w: 2.6, color: rank === 'suite' ? '#5a3d2b' : '#46607f' });
      item('rug', 1.5, 2, { w: 5.5, d: 5, color: rank === 'suite' ? '#3d4f7a' : '#4f6896' });
      item('plant', 0.6, 8.4, { size: 1.2 });
      item('bookshelf', 0.3, 0.3, { w: 3, d: 0.8 });
    } else {
      const player = rank === 'window' ? [1.4, 6.8] : cluster[0];
      desk(player[0], player[1], { player: true });
    }
    spots.slice(rank === 'window' ? 0 : isPrivate ? 0 : 1).forEach(([x, y]) => desk(x, y, { peer: true }));
    // Meeting room: a long table, chairs, a whiteboard and a screen.
    item('table', 22, 3.6, { w: 5.2, d: 2.4, color: '#e7eef4' });
    for (let seat = 0; seat < 4; seat += 1) {
      item('chair', 22.6 + seat * 1.2, 2.9, { color: '#4a4f6a' });
      item('chair', 22.6 + seat * 1.2, 6.3, { color: '#4a4f6a' });
    }
    item('whiteboard', 22, 0.2, { w: 4.5, onWall: 'y' });
    item('screenwall', 27.2, 0.2, { w: 2, onWall: 'y' });
    poi('meeting', 24.6, 8.4, 'Whiteboard session', { kind: 'meeting' });
    // Pantry: counter, coffee machine, fridge, high tables with stools.
    item('counter', 31, 0.4, { w: 4.4, d: 1.1 });
    item('coffee', 32, 0.5);
    item('fridge', 34.4, 0.5);
    item('table', 31.4, 5.2, { w: 1.4, d: 1.4, color: '#d9dde2', high: true });
    item('table', 33.4, 7.4, { w: 1.4, d: 1.4, color: '#d9dde2', high: true });
    item('plant', 29.9, 9.2, { size: 1 });
    poi('pantry', 32.6, 2.6, 'Coffee chat', { kind: 'pantry' });
    // Lounge: couches, beanbags, games; booths; the collab zone.
    item('couch', 2, 17, { w: 3, color: '#7b8fa6' });
    item('couch', 2, 22, { w: 3, color: '#7b8fa6' });
    item('table', 5.4, 18.6, { w: 1.8, d: 1.4, color: '#b48a5a', low: true });
    if (theme.props.includes('pingpong')) item('pingpong', 8, 19);
    if (theme.props.includes('beanbag')) {
      item('beanbag', 11, 17.5, { color: '#ff8a5c' });
      item('beanbag', 12.2, 21.5, { color: '#4aa3d9' });
    }
    item('plant', 12.8, 15.6, { size: 1.2 });
    poi('lounge', 6.2, 20.4, 'Take a breather', { kind: 'lounge' });
    for (let booth = 0; booth < 3; booth += 1) item('booth', 15 + booth * 2.4, 16 + (booth % 2) * 4, { color: theme.accent ?? '#4a90e2' });
    item('table', 24, 19, { w: 3, d: 1.4, color: '#c9a672' });
    item('whiteboard', 26, 11, { w: 4, onWall: 'y' });
    for (let seat = 0; seat < 3; seat += 1) desk(24 + seat * 3.4, 22.3, { peer: true, standing: true });
    item('couch', 29.5, 14.4, { w: 3, color: '#46607f' });
    item('cooler', 34.6, 11.5);
    // The company's own dressing, from its setting: neon and a bike in a startup, a logo wall in a growth company,
    // posters, a clock and a printer in an established one, filing in a steady one.
    if (theme.props.includes('neon')) item('neon', 5, 0.2, { w: 3.6, onWall: 'y' });
    if (theme.props.includes('bike')) item('bike', 11, 0.2, { w: 1.8, onWall: 'y' });
    if (theme.props.includes('logo')) item('logo', 6, 0.2, { w: 2.8, onWall: 'y', color: theme.accent ?? '#ff6b4a' });
    if (theme.props.includes('poster')) item('poster', 3, 0.2, { w: 1.4, onWall: 'y' });
    if (theme.props.includes('clock')) item('clock', 10, 0.2, { w: 1, onWall: 'y' });
    if (theme.props.includes('printer')) item('printer', 14.8, 0.5);
    if (theme.props.includes('filing')) item('filing', 14.4, 0.4, { w: 2.4 });
    if (theme.props.includes('bin')) item('bin', 17.6, 0.6);
    if (theme.props.includes('snackwall')) item('counter', 14.6, 0.5, { w: 3.6, d: 1 });
  } else if (genre === 'consulting') {
    room(0, 0, 15.5, 12.5, 'work');
    room(15.5, 0, 29.5, 11, 'boardroom', '#8e99a8');
    room(29.5, 0, W, 11, 'warroom', shade(theme.floorColor, 0.06));
    room(0, 12.5, 11, D, 'pantry', shade(theme.floorColor, 0.1));
    room(11, 12.5, W, D, 'offices', shade(theme.floorColor, -0.03));
    wallAtX(15.5, 0, 11, { glass: true, gaps: [[4.5, 7]] });
    wallAtX(29.5, 0, 11, { glass: true, gaps: [[4, 6.5]] });
    wallAtY(11, 15.5, W, { glass: true, gaps: [[21, 24.5]] });
    wallAtY(12.5, 0, 11, { gaps: [[4, 8]], color: shade(theme.wall, -0.04) });
    wallAtX(11, 12.5, D, { gaps: [[17, 21]], color: shade(theme.wall, -0.04) });
    // Hot desks in rows, the player's among them.
    const rows = [[2, 3], [2, 6.2], [2, 9.2], [7.8, 3], [7.8, 6.2], [7.8, 9.2], [12.6, 5]];
    if (isPrivate) {
      wallAtX(8, 0, 9.5, { glass: true, gaps: [[4, 6]] });
      wallAtY(9.5, 0, 8, { glass: true, gaps: [[2, 4]] });
      room(0, 0, 8, 9.5, 'office', '#7e8a9a');
      desk(2.4, 3.2, { player: true });
      item('couch', 5.2, 7.2, { w: 2.6, color: '#46607f' });
    } else {
      desk(rows[0][0], rows[0][1], { player: true });
    }
    rows.slice(isPrivate ? 3 : 1).forEach(([x, y]) => desk(x, y, { peer: true }));
    // Boardroom: a long table with a screen wall and flipcharts.
    item('table', 18.2, 3.4, { w: 8.4, d: 3, color: '#c8d4de' });
    for (let seat = 0; seat < 6; seat += 1) {
      item('chair', 18.8 + seat * 1.3, 2.7, { color: '#3b4a5e' });
      item('chair', 18.8 + seat * 1.3, 6.9, { color: '#3b4a5e' });
    }
    item('screenwall', 18, 0.2, { w: 7, onWall: 'y' });
    item('flipchart', 27.4, 9.4);
    poi('meeting', 22.4, 8.8, 'Case team debrief', { kind: 'meeting' });
    // War rooms.
    item('table', 31, 4, { w: 3.4, d: 1.6, color: '#d9dde2' });
    item('whiteboard', 30.6, 0.2, { w: 4.4, onWall: 'y' });
    // Pantry and client lounge.
    item('counter', 0.3, 20, { w: 1.1, d: 4.6, vertical: true });
    item('coffee', 0.6, 21.5);
    item('table', 5, 17, { w: 1.4, d: 1.4, color: '#d9dde2', high: true });
    item('couch', 4, 22.4, { w: 3, color: '#46607f' });
    item('plant', 9, 14, { size: 1.2 });
    poi('pantry', 2.6, 21.6, 'Coffee chat', { kind: 'pantry' });
    poi('lounge', 5.5, 21.2, 'Take a breather', { kind: 'lounge' });
    // Partners' offices along the back, each with a desk and a couch.
    for (const x of [12.5, 19.5, 26.5]) {
      wallAtY(18.5, x, x + 6.5, { glass: true, gaps: [[x + 2.5, x + 4]] });
      wallAtX(x + 6.5, 18.5, D, { glass: true });
      item('couch', x + 3.2, 24.2, { w: 2.6, color: '#46607f' });
      item('plant', x + 0.4, 24.4, { size: 1 });
      desk(x + 1.4, 20, { peer: true });
    }
    item('bag', 3.4, 12.8);
  } else if (genre === 'equity') {
    room(0, 0, 10, 8.5, 'reception', '#6b4a2e');
    room(10, 0, W, 9.5, 'offices', theme.floorColor);
    room(0, 8.5, 14, D, 'boardroom', '#6b2a2a');
    room(14, 9.5, 26, D, 'bar', '#5a3820');
    room(26, 9.5, W, D, 'den', '#5a3820');
    wallAtY(8.5, 0, 14, { gaps: [[6, 9]], color: '#5b3d2b' });
    wallAtY(9.5, 10, W, { gaps: [[16, 19], [28, 31]], color: '#5b3d2b' });
    wallAtX(14, 8.5, D, { gaps: [[13, 16.5]], color: '#5b3d2b' });
    wallAtX(26, 9.5, D, { gaps: [[15, 18]], color: '#5b3d2b' });
    wallAtX(10, 0, 8.5, { gaps: [[3, 5.5]], color: '#5b3d2b' });
    // The player's office is the first of the partners' offices; juniors sit with the assistants.
    if (isPrivate) {
      room(10, 0, 18, 9.5, 'office', '#7a4f2f');
      wallAtX(18, 0, 9.5, { gaps: [[3, 5.5]], color: '#5b3d2b' });
      desk(12.4, 3.4, { player: true });
      item('couch', 14.6, 7.0, { w: 2.6, color: rank === 'suite' ? '#2a1d14' : '#46607f' });
      item('globe', 16.8, 1.4);
    } else {
      desk(2.4, 2.6, { player: true });
    }
    for (const [x, y] of isPrivate ? [[21, 3.4], [29, 3.4]] : [[12.4, 3.2], [19.4, 3.2], [27, 3.2]]) {
      if (!isPrivate) wallAtX(x + 5, 0, 9.5, { gaps: [[3, 5.5]], color: '#5b3d2b' });
      desk(x, y, { peer: true });
    }
    if (!isPrivate) desk(2.4, 5.6, { peer: true });
    item('tombstones', 2, 0.2, { w: 6, onWall: 'y' });
    // Boardroom with a long table and a rug.
    item('rug', 2.5, 12, { w: 9, d: 9, color: '#8a3a36' });
    item('table', 3.4, 14.2, { w: 6.8, d: 3.4, color: '#3a2216' });
    for (let seat = 0; seat < 5; seat += 1) {
      item('chair', 3.8 + seat * 1.3, 13.4, { color: '#2a1d14' });
      item('chair', 3.8 + seat * 1.3, 17.9, { color: '#2a1d14' });
    }
    item('portrait', 5, 8.7, { w: 2.6, onWall: 'y' });
    poi('meeting', 6.6, 20.8, 'Deal review', { kind: 'meeting' });
    // The bar and the den.
    item('bar', 14.6, 9.8, { w: 5, d: 1.2 });
    item('couch', 16, 21.6, { w: 3.2, color: '#2a1d14' });
    item('couch', 22.4, 18, { w: 2.8, color: '#2a1d14' });
    item('lamp', 24.6, 22.4);
    item('globe', 33, 11);
    item('bookshelf', 26.4, 25, { w: 8, d: 0.8, onWall: 'back' });
    item('couch', 29, 19, { w: 3.4, color: '#4a2f1d' });
    item('rug', 28, 16, { w: 6, d: 6, color: '#6b2a2a' });
    poi('pantry', 17.2, 12.2, 'A drink and a word', { kind: 'pantry' });
    poi('lounge', 30.4, 17.6, 'Take a breather', { kind: 'lounge' });
    item('plant', 25, 10.4, { size: 1.2 });
  } else {
    // academia
    room(0, 0, 14, 11, 'lab', '#d9dee2');
    room(14, 0, 26, 12, 'library', theme.floorColor);
    room(26, 0, W, 10.5, 'seminar', shade(theme.floorColor, -0.05));
    room(0, 11, 13, D, 'common', shade(theme.floorColor, 0.08));
    room(13, 12, W, D, 'offices', shade(theme.floorColor, -0.02));
    wallAtX(14, 0, 11, { glass: true, gaps: [[4.5, 7]] });
    wallAtX(26, 0, 12, { glass: true, gaps: [[5, 7.5]] });
    wallAtY(11, 0, 13, { glass: true, gaps: [[5, 9]] });
    wallAtY(12, 13, W, { gaps: [[19, 22], [29, 32]], color: shade(theme.wall, -0.05) });
    wallAtX(13, 11, D, { gaps: [[16, 19]], color: shade(theme.wall, -0.05) });
    // The lab: benches with equipment; the player's desk at the window end.
    if (isPrivate) {
      wallAtX(8, 0, 9.5, { glass: true, gaps: [[4, 6]] });
      wallAtY(9.5, 0, 8, { glass: true, gaps: [[2, 4]] });
      room(0, 0, 8, 9.5, 'office', '#b88a56');
      desk(2.4, 3.2, { player: true });
      item('couch', 5.2, 7.2, { w: 2.6, color: '#46607f' });
      item('bookshelf', 0.3, 0.3, { w: 4, d: 0.8 });
    } else {
      desk(2.4, 3.2, { player: true });
    }
    for (const [x, y] of isPrivate ? [[9.4, 3], [9.4, 6.4]] : [[9, 3.2], [9, 6.6]]) desk(x, y, { peer: true });
    for (const [x, y] of [[4.5, 9.7], [9.4, 9.7]]) item('labbench', x, y, { w: 4, d: 1.4 });
    // The library: tall stacks, reading tables and a ladder.
    for (let stack = 0; stack < 4; stack += 1) item('bookshelf', 15 + stack * 2.8, 0.3, { w: 2.4, d: 0.9, onWall: 'y' });
    item('table', 16, 5.2, { w: 5, d: 1.8, color: '#7a4f2f' });
    item('table', 16, 8.6, { w: 5, d: 1.8, color: '#7a4f2f' });
    item('lamp', 22.6, 5.2);
    poi('meeting', 18.4, 7.4, 'Reading group', { kind: 'meeting' });
    // The seminar room: rows of chairs, a screen.
    item('screenwall', 28, 0.2, { w: 5.4, onWall: 'y' });
    for (let row = 0; row < 3; row += 1) for (let seat = 0; seat < 4; seat += 1) item('chair', 27.8 + seat * 1.7, 4 + row * 1.8, { color: '#6b46c1' });
    // The common room: a coffee bar, sofas, a noticeboard.
    item('counter', 0.4, 20, { w: 1.1, d: 5, vertical: true });
    item('coffee', 0.7, 21.5);
    item('couch', 4, 15, { w: 3, color: '#7b6a8a' });
    item('couch', 8.4, 22, { w: 3, color: '#7b6a8a' });
    item('table', 5.4, 18.2, { w: 2, d: 1.4, color: '#b48a5a', low: true });
    item('plant', 11.4, 12, { size: 1.3 });
    poi('pantry', 2.8, 21.4, 'Coffee chat', { kind: 'pantry' });
    poi('lounge', 6, 19.8, 'Take a breather', { kind: 'lounge' });
    // Professors' offices.
    for (const x of [14.5, 21.5, 28.5]) {
      wallAtY(19, x, x + 6.5, { glass: true, gaps: [[x + 2.5, x + 4]] });
      wallAtX(x + 6.5, 19, D, { glass: true });
      item('bookshelf', x + 0.4, 25, { w: 4, d: 0.8, onWall: 'back' });
      desk(x + 1.6, 21.4, { peer: true });
    }
    item('chalkboard', 13.4, 12.4, { w: 4, onWall: 'y' });
  }

  // Colleagues' desks are points of interest too.
  desks.filter((entry) => entry.peer).forEach((entry, index) => poi(`peer${index}`, entry.x + 0.6, entry.y + 2.1, 'Pair up', { kind: 'peer', desk: entry }));
  // Move the floor plan into the building, then add the wings around it.
  const move = (entry, keys) => keys.forEach(([key, shift]) => { if (entry[key] !== undefined) entry[key] += shift; });
  rooms.forEach((entry) => move(entry, [['x0', OFFSET.x], ['x1', OFFSET.x], ['y0', OFFSET.y], ['y1', OFFSET.y]]));
  walls.forEach((entry) => {
    const along = entry.axis === 'x' ? OFFSET.y : OFFSET.x;
    entry.at += entry.axis === 'x' ? OFFSET.x : OFFSET.y;
    entry.from += along;
    entry.to += along;
    entry.gaps = entry.gaps.map(([a, b]) => [a + along, b + along]);
  });
  [items, desks, pois].forEach((list) => list.forEach((entry) => move(entry, [['x', OFFSET.x], ['y', OFFSET.y]])));
  addWings({ theme, rooms, walls, items, pois, W: WORLD.width, D: WORLD.depth });
  // The player's desk is the one the player sits at.
  const playerDesk = desks.find((entry) => entry.player);
  const player = { desk: playerDesk, seat: { x: playerDesk.x + 1.65, y: playerDesk.y + 0.8 } };
  return { theme, genre, rooms, walls, items, desks, pois, player, width: WORLD.width, depth: WORLD.depth };
}

/** The rest of the building: a lobby along the left, and a row of huddle rooms along the back. */
function addWings({ theme, rooms, walls, items, pois, W, D }) {
  const wall = theme.wall;
  rooms.push({ x0: 0, y0: 0, x1: OFFSET.x, y1: D, kind: 'lobby', floor: shade(theme.floorColor, 0.12) });
  rooms.push({ x0: OFFSET.x, y0: 0, x1: W, y1: OFFSET.y, kind: 'huddles', floor: shade(theme.floorColor, -0.05) });
  // Filler beyond the floor plan's far edges, in the same colour, so the building is bigger than the rooms.
  rooms.push({ x0: OFFSET.x + 36, y0: OFFSET.y, x1: W, y1: D, kind: 'annex', floor: shade(theme.floorColor, 0.04) });
  rooms.push({ x0: OFFSET.x, y0: OFFSET.y + 26, x1: OFFSET.x + 36, y1: D, kind: 'annex', floor: shade(theme.floorColor, 0.04) });
  walls.push({ axis: 'x', at: OFFSET.x, from: 0, to: D, gaps: [[OFFSET.y + 4, OFFSET.y + 7.5], [OFFSET.y + 17, OFFSET.y + 20.5]], glass: false, color: shade(wall, -0.04) });
  walls.push({ axis: 'y', at: OFFSET.y, from: OFFSET.x, to: W, gaps: [[OFFSET.x + 6, OFFSET.x + 9], [OFFSET.x + 17, OFFSET.x + 20], [OFFSET.x + 26, OFFSET.x + 29]], glass: false, color: shade(wall, -0.04) });
  for (let huddle = 0; huddle < 3; huddle += 1) {
    const x = OFFSET.x + 4 + huddle * 13;
    walls.push({ axis: 'x', at: x + 9, from: 0, to: OFFSET.y, gaps: [], glass: true, color: null });
    items.push({ kind: 'table', x: x + 1.2, y: 2.4, w: 3.6, d: 1.8, color: '#e7eef4' });
    for (let seat = 0; seat < 3; seat += 1) {
      items.push({ kind: 'chair', x: x + 1.7 + seat * 1.1, y: 1.8, color: '#4a4f6a' });
      items.push({ kind: 'chair', x: x + 1.7 + seat * 1.1, y: 4.8, color: '#4a4f6a' });
    }
    items.push({ kind: 'whiteboard', x: x + 1, y: 0.2, w: 4, onWall: 'y' });
    items.push({ kind: 'plant', x: x + 7.4, y: 6.2, size: 1 });
  }
  // The lobby: a reception desk, sofas, plants, a coffee table.
  items.push({ kind: 'counter', x: 1, y: 3, w: 5, d: 1.4 });
  items.push({ kind: 'couch', x: 1.4, y: 11, w: 3.2, color: '#7b8fa6' });
  items.push({ kind: 'couch', x: 1.4, y: 17, w: 3.2, color: '#7b8fa6' });
  items.push({ kind: 'table', x: 5.6, y: 13.4, w: 1.8, d: 1.6, color: '#b48a5a', low: true });
  items.push({ kind: 'rug', x: 1, y: 10, w: 7, d: 9, color: shade(theme.floorColor, -0.18) });
  for (const y of [8, 22, 30]) items.push({ kind: 'plant', x: 7.8, y, size: 1.3 });
  items.push({ kind: 'plant', x: 0.6, y: 26, size: 1.3 });
  items.push({ kind: 'couch', x: 1.4, y: 29, w: 3.2, color: '#7b8fa6' });
  // The annexes: more desks and a plant or two, so the far rooms are not empty floor.
  for (const [x, y] of [[OFFSET.x + 38, OFFSET.y + 2], [OFFSET.x + 38, OFFSET.y + 6], [OFFSET.x + 38, OFFSET.y + 12]]) items.push({ kind: 'table', x, y, w: 3, d: 1.4, color: '#d9dde2' });
  items.push({ kind: 'plant', x: OFFSET.x + 42, y: OFFSET.y + 20, size: 1.2 });
  items.push({ kind: 'plant', x: OFFSET.x + 20, y: OFFSET.y + 29, size: 1.2 });
  items.push({ kind: 'bookshelf', x: OFFSET.x + 6, y: D - 1, w: 8, d: 0.8, onWall: 'back' });
  void pois;
}

// ── Navigation grid ────────────────────────────────────────────────────

const FOOTPRINT = {
  desk: (item) => [item.x - 0.1, item.y - 0.1, 2.7, 1.5],
  chair: (item) => [item.x - 0.3, item.y - 0.3, 0.9, 0.9],
  table: (item) => [item.x, item.y, item.w, item.d],
  counter: (item) => [item.x, item.y, item.w, item.d],
  couch: (item) => [item.x, item.y, item.w, 1.2],
  bookshelf: (item) => (item.onWall ? [0, 0, 0, 0] : [item.x, item.y, item.w, item.d]),
  labbench: (item) => [item.x, item.y, item.w, item.d],
  bar: (item) => [item.x, item.y, item.w, item.d],
  fridge: (item) => [item.x, item.y, 0.8, 0.8],
  coffee: (item) => [item.x, item.y, 0.7, 0.6],
  pingpong: (item) => [item.x, item.y, 3.2, 1.8],
  booth: (item) => [item.x, item.y, 2, 2],
  plant: (item) => [item.x, item.y, 0.8 * (item.size ?? 1), 0.8 * (item.size ?? 1)],
  beanbag: (item) => [item.x - 0.5, item.y - 0.5, 1.2, 1.2],
  cooler: (item) => [item.x, item.y, 0.6, 0.6],
  lamp: (item) => [item.x, item.y, 0.6, 0.6],
  globe: (item) => [item.x, item.y, 0.7, 0.7],
  flipchart: (item) => [item.x, item.y, 0.9, 0.9],
  bag: (item) => [item.x, item.y, 0.8, 0.5],
  printer: (item) => [item.x, item.y, 1.1, 0.8],
  filing: (item) => [item.x, item.y, item.w, 0.7],
  bin: (item) => [item.x, item.y, 0.4, 0.4],
};

/** A grid of cells that can be walked: furniture and wall lines block, doorways do not. */
export function buildWalkGrid(layout) {
  const { width, depth } = layout;
  const grid = Array.from({ length: depth }, () => Array.from({ length: width }, () => true));
  const block = (x, y, w, d) => {
    for (let cy = Math.floor(y); cy < Math.ceil(y + d); cy += 1) for (let cx = Math.floor(x); cx < Math.ceil(x + w); cx += 1) if (grid[cy]?.[cx] !== undefined) grid[cy][cx] = false;
  };
  for (const entry of layout.items) {
    const footprint = FOOTPRINT[entry.kind];
    if (!footprint || entry.low) continue;
    const [x, y, w, d] = footprint(entry);
    if (w > 0) block(x + 0.15, y + 0.15, Math.max(0.2, w - 0.3), Math.max(0.2, d - 0.3));
  }
  for (const wall of layout.walls) {
    for (let at = Math.floor(wall.from); at < Math.ceil(wall.to); at += 1) {
      if (wall.gaps.some(([a, b]) => at + 0.5 >= a && at + 0.5 <= b)) continue;
      if (wall.axis === 'x') block(wall.at - 0.2, at, 0.4, 1);
      else block(at, wall.at - 0.2, 1, 0.4);
    }
  }
  // The person at a desk keeps their chair clear.
  for (const desk of layout.desks) {
    const cx = Math.floor(desk.x + 1.65);
    const cy = Math.floor(desk.y + 0.8);
    for (const [dx, dy] of [[0, 0], [0, 1], [1, 0], [1, 1]]) if (grid[cy + dy]?.[cx + dx] !== undefined) grid[cy + dy][cx + dx] = true;
  }
  return grid;
}

/** Shortest walk between two cells (eight directions, no corner-cutting), or null. */
export function findPath(grid, from, to) {
  const rows = grid.length;
  const columns = grid[0].length;
  const key = (x, y) => y * columns + x;
  const start = { x: Math.floor(from.x), y: Math.floor(from.y) };
  const goal = { x: Math.floor(to.x), y: Math.floor(to.y) };
  if (!grid[goal.y]?.[goal.x]) return null;
  const previous = new Map([[key(start.x, start.y), null]]);
  const costs = new Map([[key(start.x, start.y), 0]]);
  const open = [{ ...start, f: 0 }];
  while (open.length) {
    open.sort((a, b) => a.f - b.f);
    const current = open.shift();
    if (current.x === goal.x && current.y === goal.y) {
      const path = [];
      let at = key(current.x, current.y);
      while (at !== null && at !== undefined) {
        path.unshift({ x: (at % columns) + 0.5, y: Math.floor(at / columns) + 0.5 });
        at = previous.get(at);
      }
      return path;
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const nx = current.x + dx;
      const ny = current.y + dy;
      if (nx < 0 || ny < 0 || nx >= columns || ny >= rows || !grid[ny][nx]) continue;
      if (dx !== 0 && dy !== 0 && (!grid[current.y][nx] || !grid[ny][current.x])) continue;
      const cost = costs.get(key(current.x, current.y)) + (dx !== 0 && dy !== 0 ? 1.41 : 1);
      if (cost < (costs.get(key(nx, ny)) ?? Infinity)) {
        costs.set(key(nx, ny), cost);
        previous.set(key(nx, ny), key(current.x, current.y));
        open.push({ x: nx, y: ny, f: cost + Math.hypot(goal.x - nx, goal.y - ny) });
      }
    }
  }
  return null;
}

/** The cell the player can actually walk to that is nearest a point: flood-filled from where they stand. */
export function reachableNear(grid, from, point) {
  const rows = grid.length;
  const columns = grid[0].length;
  const seen = new Set();
  const queue = [{ x: Math.floor(from.x), y: Math.floor(from.y) }];
  seen.add(queue[0].y * columns + queue[0].x);
  let best = null;
  let bestDistance = Infinity;
  while (queue.length) {
    const cell = queue.shift();
    const distance = Math.hypot(cell.x + 0.5 - point.x, cell.y + 0.5 - point.y);
    if (grid[cell.y][cell.x] && distance < bestDistance) {
      best = { x: cell.x + 0.5, y: cell.y + 0.5 };
      bestDistance = distance;
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cell.x + dx;
      const ny = cell.y + dy;
      if (nx < 0 || ny < 0 || nx >= columns || ny >= rows || !grid[ny][nx] || seen.has(ny * columns + nx)) continue;
      seen.add(ny * columns + nx);
      queue.push({ x: nx, y: ny });
    }
  }
  return best && bestDistance <= 10 ? best : null;
}

/** The nearest walkable cell to a point, by rings. */
export function nearestWalkable(grid, point) {
  const cx = Math.floor(point.x);
  const cy = Math.floor(point.y);
  for (let ring = 0; ring < 6; ring += 1) {
    for (let dy = -ring; dy <= ring; dy += 1) {
      for (let dx = -ring; dx <= ring; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
        if (grid[cy + dy]?.[cx + dx]) return { x: cx + dx + 0.5, y: cy + dy + 0.5 };
      }
    }
  }
  return null;
}

// ── The renderer ───────────────────────────────────────────────────────

/** Create the office on a canvas. */
export function createOfficeWorld(canvas) {
  const ctx = canvas.getContext('2d');
  let cssWidth = 0;
  let cssHeight = 0;
  let scale = 1;
  let layout = null;
  let layoutKey = '';
  let grid = null;
  let lastNow = null;
  const focus = { x: 6, y: 6 };
  // mode: seated | walking | chat (a conversation is open) | idle (standing or sitting somewhere) | returning (to the desk)
  const state = { mode: 'seated', x: 0, y: 0, path: [], target: null, idleTime: 0, facing: 1, sit: null };
  const npcs = [];
  let ambient = [];
  let seed = 11;
  const random = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  const hooks = { onInteract: null, onCancel: null };

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    cssWidth = rect.width;
    cssHeight = rect.height;
    canvas.width = Math.round(rect.width * ratio);
    canvas.height = Math.round(rect.height * ratio);
    scale = Math.max(0.6, Math.min(1.2, cssHeight / 440));
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  const centre = () => ({ x: cssWidth / 2, y: cssHeight * 0.58 });
  function iso(x, y, z = 0) {
    const c = centre();
    return { x: c.x + ((x - focus.x) - (y - focus.y)) * TILE_W / 2 * scale, y: c.y + ((x - focus.x) + (y - focus.y)) * TILE_H / 2 * scale - z * scale };
  }

  /** The floor point under a screen position. */
  function worldAt(screenX, screenY) {
    const c = centre();
    const u = (screenX - c.x) / (TILE_W / 2 * scale);
    const v = (screenY - c.y) / (TILE_H / 2 * scale);
    return { x: focus.x + (u + v) / 2, y: focus.y + (v - u) / 2 };
  }

  /** The part of the floor that can be on screen, in world tiles, with a margin for tall things. */
  function visibleBounds() {
    const corners = [worldAt(-120, -260), worldAt(cssWidth + 120, -260), worldAt(-120, cssHeight + 120), worldAt(cssWidth + 120, cssHeight + 120)];
    return {
      x0: Math.min(...corners.map((c) => c.x)) - 3, x1: Math.max(...corners.map((c) => c.x)) + 3,
      y0: Math.min(...corners.map((c) => c.y)) - 3, y1: Math.max(...corners.map((c) => c.y)) + 3,
    };
  }

  function clampFocus() {
    // Only the front edges of the building (x = width, y = depth) have nothing beyond them; the back walls are tall.
    const halfU = cssWidth / 2 / (TILE_W / 2 * scale);
    const halfV = cssHeight * 0.58 / (TILE_H / 2 * scale);
    const margin = (halfU + halfV) / 2;
    focus.x = Math.max(margin - 9, Math.min(layout.width - margin, focus.x));
    focus.y = Math.max(margin - 9, Math.min(layout.depth - margin, focus.y));
  }

  // ── Drawing primitives ─────────────────────────────────────────────

  function poly(points, fill, stroke = null) {
    ctx.beginPath();
    points.forEach((point, index) => (index === 0 ? ctx.moveTo(point.x, point.y) : ctx.lineTo(point.x, point.y)));
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = Math.max(0.5, scale * 0.8);
      ctx.stroke();
    }
  }
  const seg = (a, b, color, width = 1) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(0.6, width * scale);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  };
  const dot = (point, radius, color) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(point.x, point.y, Math.max(0.5, radius * scale), 0, Math.PI * 2);
    ctx.fill();
  };
  function box(x, y, z, w, d, h, color) {
    poly([iso(x, y + d, z), iso(x + w, y + d, z), iso(x + w, y + d, z + h), iso(x, y + d, z + h)], shade(color, -0.12));
    poly([iso(x + w, y, z), iso(x + w, y + d, z), iso(x + w, y + d, z + h), iso(x + w, y, z + h)], shade(color, -0.25));
    poly([iso(x, y, z + h), iso(x + w, y, z + h), iso(x + w, y + d, z + h), iso(x, y + d, z + h)], shade(color, 0.08));
  }
  const flat = (x0, y0, x1, y1, color, z = 0) => poly([iso(x0, y0, z), iso(x1, y0, z), iso(x1, y1, z), iso(x0, y1, z)], color);

  // ── Furniture ──────────────────────────────────────────────────────

  function drawDesk(entry, scene, theme, index) {
    const { x, y } = entry;
    const kind = theme.desks;
    const top = { standing: '#f0f2f4', bench: '#c9a672', dividers: '#f4f4f2', cubicle: '#d9d4c2', hot: '#e8edf2', wood: '#7a4f2f' }[kind] ?? '#f4f4f2';
    const legs = kind === 'wood' ? '#4a2f1d' : '#9aa3ad';
    const height = entry.standing || kind === 'standing' ? 40 : 28;
    box(x, y, 0, 2.4, 1.2, height - 4, legs);
    box(x, y, height - 4, 2.4, 1.2, 4, top);
    if (kind === 'cubicle') {
      box(x - 0.1, y - 0.1, 0, 0.12, 1.5, 46, '#9b9a8a');
      box(x - 0.1, y - 0.1, 0, 2.6, 0.12, 46, '#a8a796');
    }
    if (kind === 'dividers') box(x - 0.1, y - 0.1, height, 0.1, 1.4, 14, '#c3cad4');
    box(x + 0.5, y + 0.05, height, 0.12, 0.9, 26, '#1f2329');
    const glow = entry.player ? (scene.productivity ?? 0.6) : 0.5;
    poly([iso(x + 0.44, y + 0.12, height + 3), iso(x + 0.44, y + 0.88, height + 3), iso(x + 0.44, y + 0.88, height + 23), iso(x + 0.44, y + 0.12, height + 23)], mixColor('#0d1117', theme.screen, 0.35 + 0.5 * glow));
    box(x + 1.1, y + 0.25, height, 0.35, 0.7, 2, '#d9dde2');
    box(x + 1.7, y + 0.2, height, 0.3, 0.3, 4, '#f4f1e6');
    // The chair, pushed in when its person is away.
    const away = entry.player && state.mode !== 'seated';
    const cx = x + (away ? 1.9 : 1.65);
    const cy = y + (away ? 1.3 : 0.8);
    const color = theme.desks === 'wood' ? '#3b2a20' : '#3b3f5c';
    box(cx - 0.05, cy - 0.1, 0, 0.2, 0.2, 16, '#3a3f47');
    box(cx - 0.35, cy - 0.45, 16, 0.8, 0.9, 5, color);
    box(cx + 0.3, cy - 0.45, 21, 0.18, 0.9, 28, shade(color, -0.1));
  }

  function drawChair(entry) {
    const color = entry.color ?? '#4a4f6a';
    box(entry.x - 0.05, entry.y + 0.2, 0, 0.2, 0.2, 14, '#3a3f47');
    box(entry.x - 0.3, entry.y - 0.15, 14, 0.7, 0.8, 4, color);
    box(entry.x - 0.3, entry.y - 0.15, 18, 0.7, 0.12, 22, shade(color, -0.1));
  }

  function drawTable(entry) {
    const high = entry.high ? 36 : entry.low ? 12 : 28;
    for (const [dx, dy] of [[0.15, 0.15], [entry.w - 0.3, 0.15], [0.15, entry.d - 0.3], [entry.w - 0.3, entry.d - 0.3]]) box(entry.x + dx, entry.y + dy, 0, 0.15, 0.15, high, '#6d7683');
    box(entry.x, entry.y, high, entry.w, entry.d, 3.5, entry.color ?? '#e7eef4');
    if (!entry.low && !entry.high && entry.w > 3) {
      for (let seat = 0; seat < Math.floor(entry.w / 1.3); seat += 1) box(entry.x + 0.5 + seat * 1.2, entry.y + entry.d / 2 - 0.2, high + 3.5, 0.4, 0.3, 2, '#2b2f36');
      box(entry.x + entry.w / 2 - 0.3, entry.y + entry.d / 2 - 0.3, high + 3.5, 0.6, 0.6, 1.5, '#9aa7b3');
    }
    if (entry.high || entry.low) box(entry.x + entry.w / 2 - 0.2, entry.y + entry.d / 2 - 0.2, (entry.high ? 36 : 12) + 3.5, 0.4, 0.4, 4, '#f4f1e6');
  }

  function drawCouch(entry) {
    const color = entry.color ?? '#7b8fa6';
    box(entry.x, entry.y, 0, entry.w, 1.1, 11, color);
    box(entry.x, entry.y, 11, entry.w, 0.3, 14, shade(color, -0.08));
    box(entry.x, entry.y, 11, 0.3, 1.1, 8, shade(color, -0.04));
    box(entry.x + entry.w - 0.3, entry.y, 11, 0.3, 1.1, 8, shade(color, -0.04));
    for (let cushion = 0; cushion < Math.floor(entry.w / 1.1); cushion += 1) box(entry.x + 0.35 + cushion * 1.05, entry.y + 0.3, 11, 0.95, 0.75, 3, shade(color, 0.1));
  }

  function drawPlant(entry) {
    const size = entry.size ?? 1;
    box(entry.x, entry.y, 0, 0.6 * size, 0.6 * size, 16 * size, '#e8eaee');
    const base = iso(entry.x + 0.3 * size, entry.y + 0.3 * size, 16 * size);
    ctx.fillStyle = '#3f8f4f';
    for (let leaf = 0; leaf < 9; leaf += 1) {
      const angle = -Math.PI / 2 + (leaf - 4) * 0.34;
      const length = (22 + (leaf % 3) * 6) * size * scale;
      ctx.beginPath();
      ctx.ellipse(base.x + Math.cos(angle) * length / 2, base.y + Math.sin(angle) * length / 2, 3.4 * scale * size, length / 2, angle + Math.PI / 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawBookshelf(entry) {
    const height = 96;
    const colors = ['#8a3a36', '#2f5fae', '#d9a65a', '#3f7a46', '#6b46c1', '#c9a24a', '#556b7a'];
    box(entry.x, entry.y, 0, entry.w, entry.d, height, '#6a4a2e');
    for (let row = 0; row < 3; row += 1) {
      for (let book = 0; book < Math.floor(entry.w / 0.28); book += 1) {
        const bx = entry.x + 0.12 + book * 0.28;
        if (entry.onWall === 'back') box(bx, entry.y - 0.05, 8 + row * 30, 0.2, 0.1, 22 - ((book * 5) % 5), colors[(book * 3 + row) % colors.length]);
        else box(bx, entry.y + entry.d - 0.05, 8 + row * 30, 0.2, 0.1, 22 - ((book * 5) % 5), colors[(book * 3 + row) % colors.length]);
      }
    }
  }

  function drawCounter(entry) {
    box(entry.x, entry.y, 0, entry.w, entry.d, 30, '#d7dce3');
    box(entry.x - 0.05, entry.y - 0.05, 30, entry.w + 0.1, entry.d + 0.1, 3, '#2b2f36');
    for (let cabinet = 0; cabinet < Math.max(2, Math.floor((entry.vertical ? entry.d : entry.w) / 1.1)); cabinet += 1) {
      const cx = entry.vertical ? entry.x + entry.w : entry.x + 0.4 + cabinet * 1.1;
      const cy = entry.vertical ? entry.y + 0.4 + cabinet * 1.1 : entry.y + entry.d;
      box(entry.vertical ? cx : cx, entry.vertical ? cy : cy, 4, entry.vertical ? 0.03 : 0.8, entry.vertical ? 0.8 : 0.03, 20, '#bfc6ce');
    }
    // A fruit bowl and a kettle.
    dot(iso(entry.x + 0.6, entry.y + entry.d / 2, 40), 4, '#e9733f');
    dot(iso(entry.x + 0.9, entry.y + entry.d / 2, 40), 3.6, '#e8c43f');
  }

  function drawFridge(entry) {
    box(entry.x, entry.y, 0, 0.8, 0.8, 56, '#e8ecf0');
    box(entry.x + 0.05, entry.y + 0.8, 8, 0.7, 0.03, 20, '#bfc6ce');
    box(entry.x + 0.05, entry.y + 0.8, 34, 0.7, 0.03, 18, '#bfc6ce');
  }

  function drawCoffee(entry, scene) {
    box(entry.x, entry.y, 30, 0.7, 0.6, 14, '#2b2f36');
    dot(iso(entry.x + 0.35, entry.y + 0.65, 36), 2.2, scene.time % 2 < 1 ? '#59d37a' : '#2f8f4e');
    const steam = iso(entry.x + 0.35, entry.y + 0.3, 46);
    for (let wisp = 0; wisp < 3; wisp += 1) {
      const age = (scene.time * 0.5 + wisp / 3) % 1;
      ctx.fillStyle = `rgba(255,255,255,${0.35 * (1 - age)})`;
      ctx.beginPath();
      ctx.arc(steam.x + Math.sin(age * 5) * 2 * scale, steam.y - age * 14 * scale, (2 + age * 3) * scale, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawWhiteboard(entry, kind) {
    // On the wall along y (the far wall of its room).
    const z0 = 44;
    const z1 = 90;
    poly([iso(entry.x, entry.y, z0), iso(entry.x + entry.w, entry.y, z0), iso(entry.x + entry.w, entry.y, z1), iso(entry.x, entry.y, z1)], kind === 'screen' ? '#14181f' : kind === 'chalk' ? '#243a31' : '#f7f8fa', kind === 'chalk' ? '#7a5a38' : '#8a93a0');
    if (kind === 'screen') {
      poly([iso(entry.x + 0.2, entry.y, z0 + 4), iso(entry.x + entry.w - 0.2, entry.y, z0 + 4), iso(entry.x + entry.w - 0.2, entry.y, z1 - 4), iso(entry.x + 0.2, entry.y, z1 - 4)], '#1f3b66');
      for (let line = 0; line < 4; line += 1) seg(iso(entry.x + 0.5, entry.y, z1 - 12 - line * 7), iso(entry.x + entry.w * (0.4 + 0.1 * line), entry.y, z1 - 12 - line * 7), '#9fc4e0', 1.2);
    } else {
      for (let line = 0; line < 6; line += 1) seg(iso(entry.x + 0.3 + (line % 3) * entry.w / 3.4, entry.y, z1 - 8 - line * 6), iso(entry.x + 0.9 + (line % 3) * entry.w / 3.4, entry.y, z1 - 8 - line * 6), kind === 'chalk' ? '#e8efe8' : line % 2 ? '#e24b4b' : '#2f6bd8', 1.3);
    }
  }

  function drawBooth(entry) {
    box(entry.x, entry.y, 0, 2, 2, 4, '#4a4f58');
    box(entry.x + 0.1, entry.y + 0.1, 4, 0.1, 1.8, 66, shade(entry.color ?? '#4a90e2', -0.1));
    box(entry.x + 0.1, entry.y + 1.9, 4, 1.8, 0.1, 66, shade(entry.color ?? '#4a90e2', -0.05));
    box(entry.x + 0.3, entry.y + 0.4, 4, 0.7, 1.2, 12, '#f2f2f0');
    box(entry.x + 0.3, entry.y + 0.5, 16, 0.5, 0.9, 1.6, '#d0d4da');
    ctx.fillStyle = 'rgba(180,215,240,0.18)';
    poly([iso(entry.x + 2, entry.y, 4), iso(entry.x + 2, entry.y + 2, 4), iso(entry.x + 2, entry.y + 2, 70), iso(entry.x + 2, entry.y, 70)], 'rgba(180,215,240,0.2)', 'rgba(255,255,255,0.4)');
  }

  function drawPingpong(entry) {
    box(entry.x, entry.y, 14, 3.2, 1.8, 2, '#2d7a58');
    for (const [dx, dy] of [[0.1, 0.1], [3, 0.1], [0.1, 1.6], [3, 1.6]]) box(entry.x + dx, entry.y + dy, 0, 0.15, 0.15, 14, '#444');
    seg(iso(entry.x + 1.6, entry.y, 16), iso(entry.x + 1.6, entry.y + 1.8, 16), '#ffffff', 1.4);
  }

  function drawBeanbag(entry) {
    dot(iso(entry.x, entry.y, 7), 17, entry.color);
    dot(iso(entry.x - 0.05, entry.y - 0.1, 12), 12, shade(entry.color, 0.12));
  }

  function drawBar(entry) {
    box(entry.x, entry.y, 0, entry.w, entry.d, 36, '#3a2216');
    box(entry.x - 0.05, entry.y - 0.05, 36, entry.w + 0.1, entry.d + 0.1, 3, '#6a4a2e');
    for (let bottle = 0; bottle < Math.floor(entry.w / 0.5); bottle += 1) box(entry.x + 0.3 + bottle * 0.45, entry.y + 0.4, 39, 0.15, 0.15, 12 + (bottle % 2) * 4, ['#c9a24a', '#5aa064', '#d9a65a', '#8fb8d9'][bottle % 4]);
    for (let stool = 0; stool < 4; stool += 1) box(entry.x + 0.6 + stool * 1.1, entry.y + 1.8, 0, 0.5, 0.5, 26, '#2a1d14');
  }

  function drawGlobe(entry) {
    box(entry.x, entry.y, 0, 0.5, 0.5, 20, '#4a2f1d');
    dot(iso(entry.x + 0.25, entry.y + 0.25, 34), 11, '#3f7fb5');
    dot(iso(entry.x + 0.2, entry.y + 0.2, 36), 5, '#5aa064');
  }

  function drawLamp(entry) {
    box(entry.x, entry.y, 0, 0.35, 0.35, 12, '#2b2b2b');
    box(entry.x - 0.1, entry.y - 0.1, 12, 0.55, 0.55, 22, '#c9a24a');
    const glow = iso(entry.x + 0.2, entry.y + 0.2, 24);
    ctx.fillStyle = 'rgba(255,214,140,0.18)';
    ctx.beginPath();
    ctx.arc(glow.x, glow.y, 38 * scale, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawLabBench(entry) {
    box(entry.x, entry.y, 0, entry.w, entry.d, 30, '#bfc6ce');
    box(entry.x - 0.05, entry.y - 0.05, 30, entry.w + 0.1, entry.d + 0.1, 3, '#2b2f36');
    for (let flask = 0; flask < 4; flask += 1) {
      const p = iso(entry.x + 0.5 + flask * 0.9, entry.y + 0.6, 36);
      ctx.fillStyle = ['#7fd0ff', '#59d37a', '#e9b949', '#e24b4b'][flask];
      ctx.beginPath();
      ctx.moveTo(p.x - 2 * scale, p.y);
      ctx.lineTo(p.x + 2 * scale, p.y);
      ctx.lineTo(p.x + 5 * scale, p.y + 9 * scale);
      ctx.lineTo(p.x - 5 * scale, p.y + 9 * scale);
      ctx.fill();
    }
    box(entry.x + entry.w - 1, entry.y + 0.3, 33, 0.6, 0.5, 9, '#2b2f36');
  }

  function drawRug(entry) {
    flat(entry.x, entry.y, entry.x + entry.w, entry.y + entry.d, entry.color);
    flat(entry.x + 0.25, entry.y + 0.25, entry.x + entry.w - 0.25, entry.y + entry.d - 0.25, shade(entry.color, 0.12));
    flat(entry.x + 0.6, entry.y + 0.6, entry.x + entry.w - 0.6, entry.y + entry.d - 0.6, entry.color);
  }

  function drawTombstones(entry) {
    box(entry.x, entry.y, 40, entry.w, 0.5, 3, '#2a1d14');
    for (let stone = 0; stone < Math.floor(entry.w / 0.95); stone += 1) {
      box(entry.x + 0.2 + stone * 0.95, entry.y + 0.1, 43, 0.5, 0.3, 16 + (stone % 2) * 4, '#cfe2f4');
      poly([iso(entry.x + 0.25 + stone * 0.95, entry.y, 70), iso(entry.x + 0.65 + stone * 0.95, entry.y, 70), iso(entry.x + 0.65 + stone * 0.95, entry.y, 71), iso(entry.x + 0.25 + stone * 0.95, entry.y, 71)], '#c9a24a');
    }
  }

  function drawPortrait(entry) {
    poly([iso(entry.x, entry.y, 48), iso(entry.x + entry.w, entry.y, 48), iso(entry.x + entry.w, entry.y, 92), iso(entry.x, entry.y, 92)], '#c9a24a');
    poly([iso(entry.x + 0.15, entry.y, 54), iso(entry.x + entry.w - 0.15, entry.y, 54), iso(entry.x + entry.w - 0.15, entry.y, 86), iso(entry.x + 0.15, entry.y, 86)], '#3a3f55');
    dot(iso(entry.x + entry.w / 2, entry.y, 74), 7, '#c9a98a');
  }

  function drawSimple(entry) {
    if (entry.kind === 'cooler') {
      box(entry.x, entry.y, 0, 0.5, 0.5, 26, '#e8ecf0');
      dot(iso(entry.x + 0.25, entry.y + 0.25, 36), 8, '#8fd0ff');
    } else if (entry.kind === 'flipchart') {
      box(entry.x + 0.4, entry.y + 0.4, 0, 0.08, 0.08, 62, '#444');
      poly([iso(entry.x, entry.y + 0.3, 40), iso(entry.x + 0.8, entry.y + 0.3, 40), iso(entry.x + 0.8, entry.y + 0.3, 72), iso(entry.x, entry.y + 0.3, 72)], '#f7f8fa', '#8a93a0');
    } else if (entry.kind === 'bag') {
      box(entry.x, entry.y, 0, 0.7, 0.4, 20, '#262a30');
    }
  }

  function drawWallDecor(entry) {
    const z0 = 50;
    const panel = (w, z1, fill, stroke = null) => poly([iso(entry.x, entry.y, z0), iso(entry.x + w, entry.y, z0), iso(entry.x + w, entry.y, z1), iso(entry.x, entry.y, z1)], fill, stroke);
    if (entry.kind === 'neon') {
      panel(entry.w, 92, '#1a1a22');
      seg(iso(entry.x + 0.3, entry.y, 82), iso(entry.x + entry.w - 0.3, entry.y, 82), '#ff4fa3', 3);
      seg(iso(entry.x + 0.4, entry.y, 72), iso(entry.x + entry.w - 0.8, entry.y, 72), '#5ad1ff', 2.4);
    } else if (entry.kind === 'logo') {
      panel(entry.w, 96, entry.color ?? '#ff6b4a');
      poly([iso(entry.x + entry.w * 0.25, entry.y, 62), iso(entry.x + entry.w * 0.75, entry.y, 62), iso(entry.x + entry.w * 0.75, entry.y, 84), iso(entry.x + entry.w * 0.25, entry.y, 84)], '#ffffff');
    } else if (entry.kind === 'poster') {
      panel(entry.w, 90, '#2f5fae');
      poly([iso(entry.x + 0.15, entry.y, 58), iso(entry.x + entry.w - 0.15, entry.y, 58), iso(entry.x + entry.w - 0.15, entry.y, 82), iso(entry.x + 0.15, entry.y, 82)], '#e9b949');
    } else if (entry.kind === 'clock') {
      const c = iso(entry.x + 0.5, entry.y, 84);
      dot(c, 9, '#fff');
      ctx.strokeStyle = '#222';
      ctx.lineWidth = scale;
      ctx.beginPath();
      ctx.arc(c.x, c.y, 9 * scale, 0, Math.PI * 2);
      ctx.stroke();
      seg(c, { x: c.x + 4 * scale, y: c.y - 3 * scale }, '#222', 1);
      seg(c, { x: c.x - 1 * scale, y: c.y - 7 * scale }, '#222', 1);
    } else if (entry.kind === 'bike') {
      const c = iso(entry.x + 0.9, entry.y, 44);
      for (const dx of [-16, 16]) {
        ctx.strokeStyle = '#222';
        ctx.lineWidth = 2 * scale;
        ctx.beginPath();
        ctx.arc(c.x + dx * scale, c.y, 14 * scale, 0, Math.PI * 2);
        ctx.stroke();
      }
      seg({ x: c.x - 16 * scale, y: c.y }, { x: c.x, y: c.y - 16 * scale }, '#d9534f', 2);
      seg({ x: c.x, y: c.y - 16 * scale }, { x: c.x + 16 * scale, y: c.y }, '#d9534f', 2);
    }
  }

  function drawPrinter(entry) {
    box(entry.x, entry.y, 0, 1.1, 0.8, 24, '#dfe3e8');
    box(entry.x + 0.1, entry.y + 0.05, 24, 0.9, 0.6, 10, '#bfc6ce');
    dot(iso(entry.x + 0.9, entry.y + 0.8, 18), 1.6, '#59d37a');
  }

  function drawFiling(entry) {
    for (let cabinet = 0; cabinet < Math.floor(entry.w / 0.8); cabinet += 1) {
      box(entry.x + cabinet * 0.8, entry.y, 0, 0.7, 0.7, 44, '#8f9aa3');
      for (let drawer = 0; drawer < 3; drawer += 1) box(entry.x + 0.08 + cabinet * 0.8, entry.y + 0.7, 4 + drawer * 14, 0.54, 0.03, 9, '#a9b3bb');
    }
  }

  const DRAWERS = {
    neon: drawWallDecor, logo: drawWallDecor, poster: drawWallDecor, clock: drawWallDecor, bike: drawWallDecor,
    printer: drawPrinter, filing: drawFiling,
    bin: (entry) => box(entry.x, entry.y, 0, 0.35, 0.35, 12, '#595f69'),
    chair: drawChair, table: drawTable, couch: drawCouch, plant: drawPlant, bookshelf: drawBookshelf, counter: drawCounter, fridge: drawFridge,
    booth: drawBooth, pingpong: drawPingpong, beanbag: drawBeanbag, bar: drawBar, globe: drawGlobe, lamp: drawLamp, labbench: drawLabBench,
    rug: drawRug, tombstones: drawTombstones, portrait: drawPortrait, cooler: drawSimple, flipchart: drawSimple, bag: drawSimple,
  };

  // ── Walls and floors ───────────────────────────────────────────────

  function drawFloors(theme, light, view) {
    for (const room of layout.rooms) {
      if (room.x1 < view.x0 || room.x0 > view.x1 || room.y1 < view.y0 || room.y0 > view.y1) continue;
      flat(room.x0, room.y0, room.x1, room.y1, room.floor);
      const x0 = Math.max(room.x0, view.x0);
      const x1 = Math.min(room.x1, view.x1);
      const y0 = Math.max(room.y0, view.y0);
      const y1 = Math.min(room.y1, view.y1);
      const wood = theme.floor === 'wood' || theme.floor === 'parquet' || room.kind === 'library';
      const step = wood ? 0.5 : 1;
      ctx.lineWidth = Math.max(0.5, scale * 0.6);
      for (let x = Math.ceil(x0 / step) * step; x < x1; x += step) seg(iso(x, y0), iso(x, y1), shade(room.floor, wood ? -0.08 : -0.06), 0.6);
      if (!wood || theme.floor === 'parquet') for (let y = Math.ceil(y0); y < y1; y += 1) seg(iso(x0, y), iso(x1, y), shade(room.floor, -0.06), 0.6);
      if (room.kind === 'lab') {
        for (let x = Math.ceil(x0); x < x1; x += 2) for (let y = Math.ceil(y0); y < y1; y += 2) if ((x + y) % 4 === 0) flat(x, y, x + 1, y + 1, shade(room.floor, -0.05));
      }
    }
    void light;
  }

  function drawOuterWalls(theme, light, time) {
    const wallColor = theme.wall;
    // The left wall (x = 0) with windows, the back wall (y = 0) too.
    poly([iso(0, 0), iso(0, layout.depth), iso(0, layout.depth, WALL_H), iso(0, 0, WALL_H)], shade(wallColor, -0.1));
    poly([iso(0, 0), iso(layout.width, 0), iso(layout.width, 0, WALL_H), iso(0, 0, WALL_H)], theme.wallRight ?? shade(wallColor, 0.04));
    const windowSpan = (axis, start, end) => {
      const z0 = theme.window === 'strip' ? 60 : theme.window === 'skyline' ? 14 : 24;
      const z1 = theme.window === 'strip' ? 96 : WINDOW_TOP;
      const p = (u, z) => (axis === 'x' ? iso(0, u, z) : iso(u, 0, z));
      const corners = [p(start, z0), p(end, z0), p(end, z1), p(start, z1)];
      ctx.save();
      ctx.beginPath();
      corners.forEach((point, index) => (index === 0 ? ctx.moveTo(point.x, point.y) : ctx.lineTo(point.x, point.y)));
      ctx.closePath();
      ctx.clip();
      const gradient = ctx.createLinearGradient(0, corners[3].y, 0, corners[0].y);
      gradient.addColorStop(0, light.sky[0]);
      gradient.addColorStop(1, light.sky[1]);
      ctx.fillStyle = gradient;
      ctx.fillRect(Math.min(corners[0].x, corners[3].x) - 4, corners[3].y - 60, Math.abs(corners[1].x - corners[0].x) + 8, corners[0].y - corners[3].y + 120);
      // The skyline beyond.
      for (let tower = 0; tower < (end - start) * 2.4; tower += 1) {
        const u = start + tower * 0.42;
        const base = p(u, z0);
        const towerHeight = (26 + ((tower * 37) % 54)) * scale;
        ctx.fillStyle = mixColor('#7c93ad', '#1b2338', light.night);
        ctx.fillRect(base.x - 7 * scale, base.y - towerHeight - 14 * scale, 14 * scale, towerHeight + 60 * scale);
        if (light.night > 0.3) {
          ctx.fillStyle = `rgba(255,220,140,${0.35 + 0.5 * light.night})`;
          for (let lit = 0; lit < 4; lit += 1) if ((Math.floor(time / 3 + tower * 3 + lit) % 4) !== 0) ctx.fillRect(base.x - 4 * scale + (lit % 2) * 5 * scale, base.y - towerHeight - 8 * scale + lit * 9 * scale, 3 * scale, 4 * scale);
        }
      }
      ctx.restore();
      poly(corners, 'rgba(255,255,255,0.05)', shade(wallColor, -0.45));
      for (let mullion = start + (end - start) / 3; mullion < end - 0.1; mullion += (end - start) / 3) seg(p(mullion, z0), p(mullion, z1), shade(wallColor, -0.4), 1.2);
    };
    const panesX = theme.window === 'strip' ? [[0.8, layout.depth - 0.8]] : [[0.8, 7], [8, 14.4], [15.4, 21.6], [22.6, layout.depth - 0.8]];
    const panesY = theme.window === 'strip' ? [[0.8, layout.width - 0.8]] : [[0.8, 8], [9.2, 17], [18.2, 26], [27.2, layout.width - 0.8]];
    if (theme.window !== 'trees' || true) for (const [a, b] of panesX) windowSpan('x', a, b);
    for (const [a, b] of panesY) windowSpan('y', a, b);
    // Skirting along both walls.
    poly([iso(0, 0), iso(0, layout.depth), iso(0, layout.depth, 5), iso(0, 0, 5)], shade(wallColor, -0.28));
    poly([iso(0, 0), iso(layout.width, 0), iso(layout.width, 0, 5), iso(0, 0, 5)], shade(wallColor, -0.18));
  }

  /** The solid stretches of a wall, between its doorway gaps. */
  function wallSpans(wall) {
    const spans = [];
    let cursor = wall.from;
    for (const [a, b] of [...wall.gaps].sort((p, q) => p[0] - q[0])) {
      if (a > cursor) spans.push([cursor, a]);
      cursor = b;
    }
    if (cursor < wall.to) spans.push([cursor, wall.to]);
    return spans;
  }

  /** One stretch of partition wall; glass is translucent with a frame, solid wall has a skirting and a cap. */
  function drawWallSpan(wall, from, to, theme) {
    const color = wall.color ?? theme.wall;
    const point = (u, z, side = 0) => (wall.axis === 'x' ? iso(wall.at + side, u, z) : iso(u, wall.at + side, z));
    if (wall.glass) {
      poly([point(from, 0), point(to, 0), point(to, PARTITION_H), point(from, PARTITION_H)], 'rgba(185,220,240,0.22)', 'rgba(255,255,255,0.45)');
      poly([point(from, 0), point(to, 0), point(to, 6), point(from, 6)], shade(color, -0.3));
      seg(point(from, PARTITION_H), point(to, PARTITION_H), shade(color, -0.4), 1.6);
      seg(point(from, 0), point(from, PARTITION_H), 'rgba(255,255,255,0.55)', 1);
    } else {
      poly([point(from, 0, -0.2), point(to, 0, -0.2), point(to, PARTITION_H, -0.2), point(from, PARTITION_H, -0.2)], shade(color, wall.axis === 'x' ? -0.08 : 0.02));
      poly([point(from, 0, 0.2), point(to, 0, 0.2), point(to, PARTITION_H, 0.2), point(from, PARTITION_H, 0.2)], shade(color, -0.16));
      poly([point(from, PARTITION_H, -0.2), point(to, PARTITION_H, -0.2), point(to, PARTITION_H, 0.2), point(from, PARTITION_H, 0.2)], shade(color, 0.12));
      poly([point(from, 0, -0.2), point(to, 0, -0.2), point(to, 5, -0.2), point(from, 5, -0.2)], shade(color, -0.3));
    }
  }

  // ── People ─────────────────────────────────────────────────────────

  function standingFigure(look, x, y, pose, time, facing, z = 0) {
    const p = iso(x, y, z);
    drawPerson(ctx, p.x, p.y, 8.4 * scale, look, { pose, expression: 'happy', time, facing });
  }

  function seated(look, seat, time, typingRate, posture) {
    const p = iso(seat.x, seat.y + 0.3, 21);
    drawSeatedWorker(ctx, p.x, p.y, 10 * scale, look, { time, typingRate, posture });
  }

  function bubble(x, y, text) {
    const p = iso(x, y, 78);
    ctx.font = `600 ${Math.max(10, 11 * scale)}px Barlow, sans-serif`;
    const width = ctx.measureText(text).width + 14 * scale;
    const height = 18 * scale;
    ctx.fillStyle = 'rgba(255,255,255,0.96)';
    ctx.strokeStyle = 'rgba(30,40,60,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(p.x - width / 2, p.y - height - 6 * scale, width, height, 8 * scale);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(p.x - 4 * scale, p.y - 6 * scale);
    ctx.lineTo(p.x, p.y);
    ctx.lineTo(p.x + 4 * scale, p.y - 6 * scale);
    ctx.fill();
    ctx.fillStyle = '#1b2433';
    ctx.textAlign = 'center';
    ctx.fillText(text, p.x, p.y - 6 * scale - height / 2 + 4 * scale);
  }

  // ── Layout lifecycle ───────────────────────────────────────────────

  function ensureLayout(scene) {
    const key = `${scene.themeId ?? 'established'}|${scene.tier}`;
    if (key === layoutKey) return;
    layoutKey = key;
    layout = buildLayout(scene.themeId ?? 'established', scene.tier);
    grid = buildWalkGrid(layout);
    state.mode = 'seated';
    state.path = [];
    state.x = layout.player.seat.x;
    state.y = layout.player.seat.y;
    focus.x = layout.player.seat.x;
    focus.y = layout.player.seat.y;
    // A few colleagues who are not peers in the game: other floors of the same company.
    ambient = layout.desks.filter((entry) => entry.peer).map((entry, index) => ({ desk: entry, look: peerLook(300 + index * 17), typingRate: 0.6 + (index % 3) * 0.2 }));
    npcs.length = 0;
    for (let index = 0; index < 3; index += 1) {
      const home = layout.pois[index % layout.pois.length];
      npcs.push({ look: peerLook(900 + index * 31), x: home.x, y: home.y, path: [], pause: 1 + index, facing: 1, poi: null });
    }
  }

  /** The sofa within reach of a spot, if any: its seat is where a player who stops there sits. */
  function couchNear(x, y) {
    for (const entry of layout.items) {
      if (entry.kind !== 'couch') continue;
      if (x >= entry.x - 0.8 && x <= entry.x + entry.w + 0.8 && y >= entry.y - 0.8 && y <= entry.y + 2.4) {
        return { entry, seat: { x: Math.max(entry.x + 0.6, Math.min(entry.x + entry.w - 0.6, x)), y: entry.y + 0.55 } };
      }
    }
    return null;
  }

  /** Whether anyone is close enough to wave to or talk to. */
  function peopleNear(x, y) {
    const near = (px, py) => Math.hypot(px - x, py - y) < 3.4;
    return npcs.some((npc) => near(npc.x, npc.y)) || layout.desks.some((desk) => !desk.player && near(desk.x + 1.6, desk.y + 0.8));
  }

  function arrive() {
    if (state.mode === 'returning') {
      state.mode = 'seated';
      state.x = layout.player.seat.x;
      state.y = layout.player.seat.y;
      state.sit = null;
      return;
    }
    if (state.target?.kind) {
      state.mode = 'chat';
      if (hooks.onInteract) hooks.onInteract(state.target);
      return;
    }
    state.mode = 'idle';
    state.idleTime = 0;
    const couch = couchNear(state.x, state.y);
    if (couch) {
      state.sit = couch;
      state.x = couch.seat.x;
      state.y = couch.seat.y;
    }
  }

  /** The conversation is over: stay where you are, or head back to the desk. */
  function endChat(returnToDesk = false) {
    if (state.mode !== 'chat') return;
    state.mode = 'idle';
    state.idleTime = 0;
    state.target = null;
    const couch = couchNear(state.x, state.y);
    if (couch && !state.sit) {
      state.sit = couch;
      state.x = couch.seat.x;
      state.y = couch.seat.y;
    }
    if (returnToDesk) goToDesk();
  }

  function goToDesk() {
    if (state.mode === 'seated') return;
    state.sit = null;
    const path = findPath(grid, state, layout.player.seat);
    state.path = path ? path.slice(1) : [];
    state.target = null;
    state.mode = state.path.length ? 'returning' : 'seated';
    if (state.mode === 'seated') {
      state.x = layout.player.seat.x;
      state.y = layout.player.seat.y;
    }
  }

  function step(dt, scene) {
    // The player.
    if (state.mode === 'walking' || state.mode === 'returning') {
      let budget = WALK_SPEED * dt;
      while (budget > 0 && state.path.length) {
        const next = state.path[0];
        const dx = next.x - state.x;
        const dy = next.y - state.y;
        const distance = Math.hypot(dx, dy);
        if (distance <= budget) {
          state.x = next.x;
          state.y = next.y;
          state.path.shift();
          budget -= distance;
        } else {
          state.x += dx / distance * budget;
          state.y += dy / distance * budget;
          budget = 0;
        }
        state.facing = dx - dy >= 0 ? 1 : -1;
      }
      if (state.path.length === 0) arrive();
    } else if (state.mode === 'idle') {
      state.idleTime += dt;
      // Back to work: the quarter is running and the player has been standing about.
      if (scene.running && state.idleTime > IDLE_RETURN_SECONDS) goToDesk();
    }
    // Colleagues wandering to the pantry and back.
    for (const npc of npcs) {
      if (npc.path.length) {
        let budget = WALK_SPEED * 0.8 * dt;
        while (budget > 0 && npc.path.length) {
          const next = npc.path[0];
          const dx = next.x - npc.x;
          const dy = next.y - npc.y;
          const distance = Math.hypot(dx, dy);
          if (distance <= budget) {
            npc.x = next.x;
            npc.y = next.y;
            npc.path.shift();
            budget -= distance;
          } else {
            npc.x += dx / distance * budget;
            npc.y += dy / distance * budget;
            budget = 0;
          }
          npc.facing = dx - dy >= 0 ? 1 : -1;
        }
        if (npc.path.length === 0) npc.pause = 2 + random() * 4;
      } else {
        npc.pause -= dt;
        if (npc.pause <= 0) {
          const target = layout.pois[Math.floor(random() * layout.pois.length)];
          const goal = reachableNear(grid, npc, target);
          const path = goal ? findPath(grid, npc, goal) : null;
          npc.path = path ? path.slice(1) : [];
          if (!npc.path.length) npc.pause = 3;
        }
      }
    }
    void scene;
  }

  // ── Frame ──────────────────────────────────────────────────────────

  function draw(scene) {
    if (!cssWidth) resize();
    ensureLayout(scene);
    const now = performance.now() / 1000;
    const dt = lastNow === null ? 0 : Math.min(0.1, now - lastNow);
    lastNow = now;
    step(dt, scene);
    const theme = THEMES[scene.themeId] ?? THEMES.established;
    const light = lightAt(scene.hour);
    // The camera follows the player, easing in.
    const follow = state.mode === 'seated' ? { x: layout.player.seat.x + 3, y: layout.player.seat.y + 1 } : state;
    scene.running = Boolean(scene.running);
    focus.x += (follow.x - focus.x) * Math.min(1, dt * 3.2 + 0.02);
    focus.y += (follow.y - focus.y) * Math.min(1, dt * 3.2 + 0.02);
    clampFocus();

    ctx.clearRect(0, 0, cssWidth, cssHeight);
    ctx.fillStyle = shade(light.sky[1], -0.35);
    ctx.fillRect(0, 0, cssWidth, cssHeight);
    const view = visibleBounds();
    drawFloors(theme, light, view);
    drawOuterWalls(theme, light, scene.time);

    // Everything standing on the floor, drawn back to front.
    const drawables = [];
    const add = (key, draw, x = null, y = null) => {
      if (x !== null && (x < view.x0 || x > view.x1 || y < view.y0 || y > view.y1)) return;
      drawables.push({ key, draw });
    };
    for (const entry of layout.items) {
      const footprint = FOOTPRINT[entry.kind]?.(entry) ?? [entry.x, entry.y, entry.w ?? 1, entry.d ?? 1];
      const key = entry.kind === 'rug' ? -1 : entry.x + footprint[2] + entry.y + footprint[3];
      if (entry.kind === 'desk') {
        const owner = entry.player;
        add(key, () => drawDesk(entry, scene, theme), entry.x, entry.y);
        const seatKey = key + 0.2;
        if (owner) {
          if (state.mode === 'seated') add(seatKey, () => seated(scene.player.look, layout.player.seat, scene.time, scene.player.typingRate, scene.player.posture), entry.x, entry.y);
        } else {
          const index = layout.desks.filter((candidate) => candidate.peer).findIndex((candidate) => candidate.x === entry.x && candidate.y === entry.y);
          const peer = scene.peers?.[index] ?? ambient[index];
          if (peer) add(seatKey, () => seated(peer.look, { x: entry.x + 1.65, y: entry.y + 0.8 }, scene.time + index, peer.typingRate, peer.posture ?? 'upright'), entry.x, entry.y);
        }
      } else if (entry.onWall && (entry.kind === 'whiteboard' || entry.kind === 'screenwall' || entry.kind === 'chalkboard')) {
        add(-0.5, () => drawWhiteboard({ x: entry.x, y: entry.y, w: entry.w }, entry.kind === 'screenwall' ? 'screen' : entry.kind === 'chalkboard' ? 'chalk' : 'white'), entry.x, entry.y);
      } else if (entry.kind === 'coffee') add(key + 0.1, () => drawCoffee(entry, scene), entry.x, entry.y);
      else if (DRAWERS[entry.kind]) add(key, () => DRAWERS[entry.kind](entry), entry.x + (entry.w ?? 0) / 2, entry.y + (entry.d ?? 0) / 2);
    }
    for (const wall of layout.walls) {
      for (const [from, to] of wallSpans(wall)) {
        // A wall is drawn a tile at a time, so furniture on either side sorts correctly against it.
        for (let u = from; u < to; u += 1) {
          const end = Math.min(to, u + 1);
          add(wall.at + (u + end) / 2 + 0.02, () => drawWallSpan(wall, u, end, theme), wall.axis === 'x' ? wall.at : (u + end) / 2, wall.axis === 'x' ? (u + end) / 2 : wall.at);
        }
      }
    }
    // People who move.
    for (const npc of npcs) add(npc.x + npc.y, () => standingFigure(npc.look, npc.x, npc.y, npc.path.length ? 'walking' : 'standing', scene.time * 2, npc.facing));
    if (state.mode !== 'seated') {
      const sitting = state.mode === 'idle' && state.sit;
      const key = sitting ? state.sit.entry.x + (state.sit.entry.w ?? 2.6) + state.sit.entry.y + 1.2 : state.x + state.y + 0.05;
      add(key, () => {
        const moving = state.mode === 'walking' || state.mode === 'returning';
        const wave = state.mode === 'chat' && peopleNear(state.x, state.y);
        standingFigure(scene.player.look, state.x, state.y, moving ? 'walking' : sitting ? 'sitting' : wave ? 'waving' : 'standing', scene.time * 2.4, state.facing, sitting ? 10 : 0);
      });
    }
    drawables.sort((a, b) => a.key - b.key);
    for (const drawable of drawables) drawable.draw();

    // Light tint, fluorescent hum.
    if (light.tintAlpha > 0) {
      ctx.fillStyle = light.tint;
      ctx.globalAlpha = light.tintAlpha;
      ctx.fillRect(0, 0, cssWidth, cssHeight);
      ctx.globalAlpha = 1;
    }
    if (light.fluorescent) {
      const flicker = 0.06 + 0.02 * Math.sin(scene.time * 50) * (Math.sin(scene.time * 3) > 0.95 ? 1 : 0);
      ctx.fillStyle = `rgba(220,255,235,${flicker + light.night * 0.08})`;
      ctx.fillRect(0, 0, cssWidth, cssHeight);
    }
  }

  /** Set off for a goal from wherever the player is now (standing up from the desk, or turning round mid-walk). */
  function setOff(goalPoint, target) {
    const from = state.mode === 'seated' ? { x: layout.player.seat.x + 0.1, y: layout.player.seat.y + 0.4 } : { x: state.x, y: state.y };
    const goal = reachableNear(grid, from, goalPoint);
    if (!goal) return false;
    const path = findPath(grid, from, goal);
    if (!path) return false;
    if (state.mode === 'chat' && hooks.onCancel) hooks.onCancel();
    state.x = from.x;
    state.y = from.y;
    state.sit = null;
    state.path = path.slice(1);
    state.target = target;
    state.idleTime = 0;
    state.mode = state.path.length ? 'walking' : 'idle';
    if (!state.path.length) arrive();
    return true;
  }

  /**
   * A click at a canvas position: the player heads there, at once, from wherever they are (a second click
   * simply changes the destination). A colleague, the pantry, the meeting room or the lounge close to the click
   * becomes a conversation on arrival; a sofa becomes a seat; the desk sends them back to work.
   */
  function click(canvasX, canvasY) {
    if (!layout) return { status: 'none' };
    const at = worldAt(canvasX, canvasY);
    if (at.x < 0.5 || at.y < 0.5 || at.x > layout.width - 0.5 || at.y > layout.depth - 0.5) return { status: 'outside' };
    const seat = layout.player.seat;
    if (Math.hypot(seat.x + 0.6 - at.x, seat.y - at.y) < 1.8) {
      if (state.mode === 'chat' && hooks.onCancel) hooks.onCancel();
      if (state.mode === 'seated') return { status: 'seated' };
      goToDesk();
      return { status: 'returning' };
    }
    let target = null;
    let best = 1.6;
    for (const poiEntry of layout.pois) {
      const distance = Math.hypot(poiEntry.x - at.x, poiEntry.y - at.y);
      if (distance < best) {
        best = distance;
        target = poiEntry;
      }
    }
    const couch = !target && layout.items.find((entry) => entry.kind === 'couch' && at.x >= entry.x - 0.3 && at.x <= entry.x + entry.w + 0.3 && at.y >= entry.y - 0.3 && at.y <= entry.y + 1.5);
    const ok = couch ? setOff({ x: Math.max(couch.x + 0.6, Math.min(couch.x + couch.w - 0.6, at.x)), y: couch.y + 1.7 }, null) && (state.target = null, true)
      : setOff(target ? { x: target.x, y: target.y } : at, target);
    return ok ? { status: 'walking', poi: target } : { status: 'blocked' };
  }

  /** Walk to a named point of interest (the tests use this; clicks go through `click`). */
  function walkTo(id) {
    const target = layout?.pois.find((entry) => entry.id === id);
    return Boolean(target) && setOff({ x: target.x, y: target.y }, target);
  }

  function screenPoint(x, y, z = 0) {
    if (!cssWidth) resize();
    return iso(x, y, z);
  }

  /** Where the player's desk is, for the live labels. */
  function deskAnchor() {
    return layout ? { x: layout.player.desk.x, y: layout.player.desk.y } : { x: 3, y: 3 };
  }

  return {
    draw, resize, screenPoint, click, deskAnchor, walkTo,
    mode: () => state.mode,
    setInteractHook: (hook) => { hooks.onInteract = hook; },
    isAway: () => state.mode !== 'seated',
    endChat, goToDesk, sitting: () => Boolean(state.sit),
    setCancelHook: (hook) => { hooks.onCancel = hook; },
    peerPoi: (index) => layout?.pois.find((entry) => entry.id === `peer${index}`) ?? null,
    layoutFor: () => layout,
  };
}
