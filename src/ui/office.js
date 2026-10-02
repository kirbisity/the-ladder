import { createOfficeWorld } from './office-world.js';

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

/** Create the office: a whole floor of rooms the player can walk across (see office-world.js). */
export function createOffice(canvas) {
  return createOfficeWorld(canvas);
}
