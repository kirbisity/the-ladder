import { drawSeatedWorker } from './figures.js';

// The animated workplace: an isometric office drawn in code. The room
// upgrades as the player climbs, the light runs from morning to night on
// each condensed workday (later the longer the hours), peers sit at their
// own desks, and burnout drains the colour (done by the page, in CSS).

const TILE_WIDTH = 64;
const TILE_HEIGHT = 32;
const WALL_HEIGHT = 120;
const ROOM = { width: 10, depth: 8 };

// Office tiers by level: open plan, window desk, private office, suite.
export function officeTier(level, employed) {
  if (!employed) return 'home';
  if (level <= 2) return 'open';
  if (level <= 4) return 'window';
  if (level <= 6) return 'office';
  return 'suite';
}

/**
 * Colour of the light for an hour of the day, 6 to 24.
 *
 * Returns:
 *   { sky: [top, bottom], tint, tintAlpha, night, fluorescent }
 */
export function lightAt(hour) {
  const keys = [
    { hour: 6, top: '#f6c48e', bottom: '#fde6c4', tint: '#ffcf8a', alpha: 0.12, night: 0 },
    { hour: 9, top: '#7fb7ea', bottom: '#cfe6f8', tint: '#ffffff', alpha: 0, night: 0 },
    { hour: 15, top: '#6aa9e3', bottom: '#cde4f7', tint: '#ffffff', alpha: 0, night: 0 },
    { hour: 18, top: '#e98a5a', bottom: '#f8c58e', tint: '#ff9b52', alpha: 0.16, night: 0.15 },
    { hour: 20, top: '#3b3f6b', bottom: '#8a6a8a', tint: '#3a3f75', alpha: 0.32, night: 0.6 },
    { hour: 24, top: '#0b1024', bottom: '#1c2340', tint: '#141a3a', alpha: 0.45, night: 1 },
  ];
  let before = keys[0];
  let after = keys[keys.length - 1];
  for (let index = 0; index < keys.length - 1; index += 1) {
    if (hour >= keys[index].hour && hour <= keys[index + 1].hour) {
      before = keys[index];
      after = keys[index + 1];
      break;
    }
  }
  const span = Math.max(1e-6, after.hour - before.hour);
  const mix = Math.min(1, Math.max(0, (hour - before.hour) / span));
  return {
    sky: [mixColor(before.top, after.top, mix), mixColor(before.bottom, after.bottom, mix)],
    tint: mixColor(before.tint, after.tint, mix),
    tintAlpha: before.alpha + (after.alpha - before.alpha) * mix,
    night: before.night + (after.night - before.night) * mix,
    fluorescent: hour >= 19,
  };
}

export function mixColor(first, second, mix) {
  const a = parseInt(first.slice(1), 16);
  const b = parseInt(second.slice(1), 16);
  const channel = (shift) => Math.round(((a >> shift) & 255) * (1 - mix) + ((b >> shift) & 255) * mix);
  return `#${((channel(16) << 16) | (channel(8) << 8) | channel(0)).toString(16).padStart(6, '0')}`;
}

function shade(color, amount) {
  return amount >= 0 ? mixColor(color, '#ffffff', amount) : mixColor(color, '#000000', -amount);
}

/** Create the office renderer on a canvas. */
export function createOffice(canvas) {
  const context = canvas.getContext('2d');
  let scale = 1;
  let originX = 0;
  let originY = 0;
  let cssWidth = 0;
  let cssHeight = 0;
  const skyline = buildSkyline();

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    cssWidth = rect.width;
    cssHeight = rect.height;
    canvas.width = Math.round(rect.width * ratio);
    canvas.height = Math.round(rect.height * ratio);
    const sceneWidth = (ROOM.width + ROOM.depth) * TILE_WIDTH / 2;
    const sceneHeight = (ROOM.width + ROOM.depth) * TILE_HEIGHT / 2 + WALL_HEIGHT;
    scale = Math.min(rect.width / (sceneWidth * 1.04), rect.height / (sceneHeight * 1.02));
    originX = rect.width / 2 + (ROOM.depth - ROOM.width) * TILE_WIDTH / 4 * scale;
    originY = (rect.height - sceneHeight * scale) / 2 + WALL_HEIGHT * scale;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  function iso(x, y, z = 0) {
    return {
      x: originX + (x - y) * TILE_WIDTH / 2 * scale,
      y: originY + (x + y) * TILE_HEIGHT / 2 * scale - z * scale,
    };
  }

  function polygon(points, fill, stroke = null) {
    context.beginPath();
    points.forEach((point, index) => (index === 0 ? context.moveTo(point.x, point.y) : context.lineTo(point.x, point.y)));
    context.closePath();
    context.fillStyle = fill;
    context.fill();
    if (stroke) {
      context.strokeStyle = stroke;
      context.lineWidth = Math.max(0.5, scale);
      context.stroke();
    }
  }

  /** An isometric box: top, left and right faces, lit from the upper left. */
  function box(x, y, z, width, depth, height, color) {
    const top = [iso(x, y, z + height), iso(x + width, y, z + height), iso(x + width, y + depth, z + height), iso(x, y + depth, z + height)];
    const left = [iso(x, y + depth, z), iso(x + width, y + depth, z), iso(x + width, y + depth, z + height), iso(x, y + depth, z + height)];
    const right = [iso(x + width, y, z), iso(x + width, y + depth, z), iso(x + width, y + depth, z + height), iso(x + width, y, z + height)];
    polygon(left, shade(color, -0.12));
    polygon(right, shade(color, -0.25));
    polygon(top, shade(color, 0.08));
  }

  // ── Room ────────────────────────────────────────────────────────────

  function drawFloor(tier) {
    const carpet = { open: '#c9d4e0', window: '#c3cfdd', office: '#b8c4d4', suite: '#a9b3c4', home: '#d9c7a8' }[tier];
    polygon([iso(0, 0), iso(ROOM.width, 0), iso(ROOM.width, ROOM.depth), iso(0, ROOM.depth)], carpet);
    context.strokeStyle = shade(carpet, -0.06);
    context.lineWidth = Math.max(0.5, scale * 0.8);
    for (let index = 1; index < ROOM.width; index += 1) line(iso(index, 0), iso(index, ROOM.depth));
    for (let index = 1; index < ROOM.depth; index += 1) line(iso(0, index), iso(ROOM.width, index));
    if (tier === 'office' || tier === 'suite') {
      polygon([iso(3, 2.5), iso(8.5, 2.5), iso(8.5, 7), iso(3, 7)], tier === 'suite' ? '#3d4f7a' : '#4f6896');
    }
    if (tier === 'home') polygon([iso(3, 3), iso(7, 3), iso(7, 6.5), iso(3, 6.5)], '#b5705a');
  }

  function line(from, to) {
    context.beginPath();
    context.moveTo(from.x, from.y);
    context.lineTo(to.x, to.y);
    context.stroke();
  }

  function drawWindowWall(light, time, tier) {
    const wall = tier === 'home' ? '#efe3cf' : '#e6ebf2';
    polygon([iso(0, 0), iso(0, ROOM.depth), iso(0, ROOM.depth, WALL_HEIGHT), iso(0, 0, WALL_HEIGHT)], shade(wall, -0.1));
    const panes = tier === 'suite' ? [[0.3, 7.7]] : tier === 'home' ? [[2.5, 5]] : [[0.4, 2.6], [2.9, 5.1], [5.4, 7.6]];
    for (const [start, end] of panes) {
      const bottom = tier === 'suite' ? 8 : 26;
      const top = WALL_HEIGHT - 10;
      const corners = [iso(0, start, bottom), iso(0, end, bottom), iso(0, end, top), iso(0, start, top)];
      context.save();
      context.beginPath();
      corners.forEach((point, index) => (index === 0 ? context.moveTo(point.x, point.y) : context.lineTo(point.x, point.y)));
      context.closePath();
      context.clip();
      const gradient = context.createLinearGradient(0, corners[3].y, 0, corners[0].y);
      gradient.addColorStop(0, light.sky[0]);
      gradient.addColorStop(1, light.sky[1]);
      context.fillStyle = gradient;
      context.fillRect(Math.min(corners[0].x, corners[1].x) - 2, corners[3].y - 40, Math.abs(corners[1].x - corners[0].x) + 4, corners[0].y - corners[3].y + 80);
      drawSkyline(start, end, bottom, light, time);
      context.restore();
      polygon(corners, 'rgba(255,255,255,0.06)', shade(wall, -0.35));
    }
  }

  function drawSkyline(start, end, bottom, light, time) {
    for (const building of skyline) {
      if (building.at < start - 0.4 || building.at > end + 0.4) continue;
      const base = iso(0, building.at, bottom);
      const width = building.width * TILE_WIDTH / 2 * scale;
      const height = building.height * scale;
      const slant = width / 2;
      const body = mixColor('#7c93ad', '#1b2338', light.night);
      context.fillStyle = body;
      context.beginPath();
      context.moveTo(base.x - width / 2, base.y + slant / 2);
      context.lineTo(base.x + width / 2, base.y - slant / 2);
      context.lineTo(base.x + width / 2, base.y - slant / 2 - height);
      context.lineTo(base.x - width / 2, base.y + slant / 2 - height);
      context.closePath();
      context.fill();
      if (light.night > 0.3) {
        context.fillStyle = `rgba(255, 220, 140, ${0.35 + 0.5 * light.night})`;
        for (const lit of building.windows) {
          if ((Math.floor(time / 3 + lit.seed * 7) % 5) === 0) continue;
          const wx = base.x - width / 2 + lit.u * width;
          const wy = base.y + slant / 2 - lit.u * slant - lit.v * height;
          context.fillRect(wx, wy, Math.max(1, 2 * scale), Math.max(1, 2.5 * scale));
        }
      }
    }
  }

  function drawShelfWall(tier) {
    const wall = tier === 'home' ? '#f3e9d8' : '#f1f4f8';
    polygon([iso(0, 0), iso(ROOM.width, 0), iso(ROOM.width, 0, WALL_HEIGHT), iso(0, 0, WALL_HEIGHT)], wall);
    if (tier === 'home') {
      polygon([iso(1.5, 0, 50), iso(3.5, 0, 50), iso(3.5, 0, 90), iso(1.5, 0, 90)], '#c9a46a', '#8b6b3a');
      return;
    }
    // Shelving with coloured binders, as in the mock-up.
    box(5.2, 0.1, 0, 4.2, 0.9, 100, '#eef1f5');
    const binderColors = ['#e9b949', '#d9534f', '#3f7fd9', '#2f5fae', '#3f7fd9', '#4a90e2', '#e9b949', '#3f7fd9'];
    for (let row = 0; row < 2; row += 1) {
      for (let index = 0; index < 14; index += 1) {
        const x = 5.35 + index * 0.27;
        const z = 58 + row * 30;
        box(x, 0.2, z, 0.18, 0.55, 24, binderColors[(index + row * 3) % binderColors.length]);
      }
    }
    for (let index = 0; index < 4; index += 1) box(5.4 + index * 1, 0.25, 4, 0.85, 0.65, 26, '#e8c17f');
    if (tier !== 'open') {
      const frame = tier === 'suite' ? '#c9a24a' : '#5b6b80';
      polygon([iso(1.2, 0, 52), iso(3.8, 0, 52), iso(3.8, 0, 92), iso(1.2, 0, 92)], frame);
      polygon([iso(1.35, 0, 55), iso(3.65, 0, 55), iso(3.65, 0, 89), iso(1.35, 0, 89)], tier === 'suite' ? '#2c3e66' : '#9fb6cf');
    }
  }

  // ── Furniture and people ───────────────────────────────────────────

  function drawDesk(x, y, wide, industryId, screenGlow) {
    const top = wide ? '#f4f4f2' : '#f7f7f5';
    box(x, y, 0, wide ? 3 : 2.2, 1.2, 2, '#9aa3ad');
    box(x, y, 28, wide ? 3 : 2.2, 1.2, 4, top);
    box(x + 0.1, y + 0.1, 0, 0.15, 1, 28, '#c2c8cf');
    box(x + (wide ? 2.75 : 1.95), y + 0.1, 0, 0.15, 1, 28, '#c2c8cf');
    box(x + 0.7, y + 0.15, 32, 0.2, 0.2, 10, '#2b2f36');
    box(x + 0.45, y + 0.05, 42, 0.12, 0.9, 26, '#1f2329');
    const corners = [iso(x + 0.44, y + 0.12, 45), iso(x + 0.44, y + 0.88, 45), iso(x + 0.44, y + 0.88, 65), iso(x + 0.44, y + 0.12, 65)];
    const screen = { tech: '#2b6cb0', consulting: '#2f855a', privateEquity: '#276749', academia: '#6b46c1' }[industryId] ?? '#2b6cb0';
    polygon(corners, mixColor('#0d1117', screen, 0.35 + 0.5 * screenGlow));
    context.fillStyle = 'rgba(255,255,255,0.55)';
    for (let row = 0; row < 4; row += 1) {
      const left = iso(x + 0.44, y + 0.2 + (row % 2) * 0.1, 61 - row * 4);
      context.fillRect(left.x - 6 * scale, left.y, 6 * scale * (0.4 + ((row * 37) % 5) / 8), Math.max(1, 1.2 * scale));
    }
    box(x + 1.1, y + 0.25, 32, 0.35, 0.7, 2, '#d9dde2');
  }

  function drawChair(x, y, color) {
    box(x - 0.05, y + 0.2, 0, 0.2, 0.2, 16, '#3a3f47');
    box(x - 0.35, y - 0.15, 16, 0.8, 0.9, 5, color);
    box(x + 0.35, y - 0.15, 21, 0.18, 0.9, 30, shade(color, -0.1));
  }

  /** A seated worker facing the monitor, arms moving at the typing rate. */
  function drawPerson(x, y, look, time, typingRate, posture) {
    const seat = iso(x, y + 0.3, 21);
    drawSeatedWorker(context, seat.x, seat.y, 10 * scale, look, { time, typingRate, posture });
  }

  function circle(x, y, radius) {
    context.beginPath();
    context.arc(x, y, Math.max(0.5, radius), 0, Math.PI * 2);
    context.fill();
  }

  function drawPlant(x, y, size = 1) {
    box(x, y, 0, 0.6 * size, 0.6 * size, 18 * size, '#e8eaee');
    const base = iso(x + 0.3 * size, y + 0.3 * size, 18 * size);
    context.fillStyle = '#3f8f4f';
    for (let leaf = 0; leaf < 7; leaf += 1) {
      const angle = -Math.PI / 2 + (leaf - 3) * 0.38;
      const length = (24 + (leaf % 3) * 6) * size * scale;
      context.beginPath();
      context.ellipse(base.x + Math.cos(angle) * length / 2, base.y + Math.sin(angle) * length / 2, 3.5 * scale * size, length / 2, angle + Math.PI / 2, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawCouch(x, y, color) {
    box(x, y, 0, 2.6, 1, 12, color);
    box(x, y, 12, 2.6, 0.3, 14, shade(color, -0.08));
    box(x, y, 12, 0.3, 1, 8, shade(color, -0.04));
    box(x + 2.3, y, 12, 0.3, 1, 8, shade(color, -0.04));
  }

  // ── Frame ──────────────────────────────────────────────────────────

  /**
   * Draw one frame.
   *
   * Args:
   *   scene: { tier, hour, time, player: {look, typingRate, posture}, peers: [{look, typingRate, posture}],
   *            industryId, productivity }
   */
  function draw(scene) {
    if (!cssWidth) resize();
    const light = lightAt(scene.hour);
    context.clearRect(0, 0, cssWidth, cssHeight);
    const backdrop = context.createLinearGradient(0, 0, 0, cssHeight);
    backdrop.addColorStop(0, shade(light.sky[0], -0.2));
    backdrop.addColorStop(1, shade(light.sky[1], -0.35));
    context.fillStyle = backdrop;
    context.fillRect(0, 0, cssWidth, cssHeight);

    const tier = scene.tier;
    drawFloor(tier);
    drawWindowWall(light, scene.time, tier);
    drawShelfWall(tier);

    const peerSpots = tier === 'open'
      ? [[6.6, 2.6], [6.6, 5.4], [3.4, 1.4]]
      : tier === 'window' ? [[6.6, 4.8]] : [];
    if (tier === 'home') {
      drawCouch(5.6, 5.8, '#7b8fa6');
      box(3.2, 3.6, 0, 1.6, 1.1, 26, '#b48a5a');
      drawPlant(8.6, 1.4, 0.9);
    } else {
      drawPlant(9, 1.5, tier === 'suite' ? 1.3 : 1);
      if (tier === 'office' || tier === 'suite') drawCouch(6.4, 6.4, tier === 'suite' ? '#5a3d2b' : '#46607f');
    }
    scene.peers.slice(0, peerSpots.length).forEach((peer, index) => {
      const [x, y] = peerSpots[index];
      drawDesk(x - 0.9, y - 0.6, false, scene.industryId, 0.5);
      drawChair(x + 0.35, y, '#4a4f6a');
      drawPerson(x + 0.35, y - 0.1, peer.look, scene.time + index, peer.typingRate, peer.posture);
    });
    const deskX = tier === 'home' ? 2.9 : tier === 'open' ? 2.3 : 2.2;
    const deskY = tier === 'home' ? 3.3 : 3.6;
    if (tier !== 'home') drawDesk(deskX, deskY, tier !== 'open', scene.industryId, scene.productivity);
    else box(deskX + 0.35, deskY + 0.3, 28, 0.5, 0.6, 2, '#2d3748');
    drawChair(deskX + 1.65, deskY + 0.6, tier === 'suite' ? '#3b2a20' : '#3b3f5c');
    drawPerson(deskX + 1.65, deskY + 0.5, scene.player.look, scene.time, scene.player.typingRate, scene.player.posture);

    if (light.tintAlpha > 0) {
      context.fillStyle = light.tint;
      context.globalAlpha = light.tintAlpha;
      context.fillRect(0, 0, cssWidth, cssHeight);
      context.globalAlpha = 1;
    }
    if (light.fluorescent && tier !== 'home') {
      const flicker = 0.06 + 0.02 * Math.sin(scene.time * 50) * (Math.sin(scene.time * 3) > 0.95 ? 1 : 0);
      context.fillStyle = `rgba(220, 255, 235, ${flicker + light.night * 0.08})`;
      context.fillRect(0, 0, cssWidth, cssHeight);
    }
  }

  /** Where a world point lands on screen, for floating labels. */
  function screenPoint(x, y, z = 0) {
    if (!cssWidth) resize();
    return iso(x, y, z);
  }

  return { draw, resize, screenPoint };
}

function buildSkyline() {
  const buildings = [];
  let seed = 7;
  const next = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  for (let at = 0.2; at < 8; at += 0.45 + next() * 0.3) {
    const windows = [];
    for (let index = 0; index < 10; index += 1) windows.push({ u: 0.15 + next() * 0.7, v: 0.1 + next() * 0.8, seed: next() });
    buildings.push({ at, width: 0.5 + next() * 0.4, height: 30 + next() * 70, windows });
  }
  return buildings;
}
