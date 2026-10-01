// Cut scenes: short animated vignettes drawn in the office's isometric 3D
// style, with the player's own face and body. Endings run about twelve
// seconds; interim scenes for big moments about four. Every scene can be
// skipped, and all of them can be replayed from the developer menu.

import { drawPerson, drawHead, peerLook } from './figures.js';
import { drawCar, drawHouse, drawApartment, drawUmbrella } from './props3d.js';
import { mixColor } from './office.js';
import { lifeScenes } from './scenes-life.js';
import { drawWorldTour, worldRoute, WORLD_STOPS, WORLD_STOP_SECONDS, WORLD_INTRO_SECONDS } from './scenes-world.js';

export const END_SCENES = {
  death: 'The funeral',
  homeless: 'The alley',
  breakdown: 'The ward',
  retiredModest: 'Retirement: getting by',
  retiredComfortable: 'Retirement: comfortable',
  retiredWealthy: 'Retirement: well off',
  retiredLuxury: 'Retirement: luxury',
  fire: 'FIRE: see the world',
};

export const INTERIM_SCENES = {
  promoted: 'Promotion',
  lostJob: 'Packing the box',
  newJob: 'First day',
  dating: 'First date',
  married: 'Wedding',
  newborn: 'Newborn',
  child: 'A new baby',
  breakup: 'Breakup',
  divorce: 'Divorce',
  house: 'The keys',
  burnout: 'Burnout',
  healthScare: 'The ambulance',
  holiday: 'Holiday',
  fmla: 'Leave',
  startupWin: 'The exit',
};

// Journal moments that earn a short scene.
export const JOURNAL_SCENES = {
  promoted: 'promoted', lostJob: 'lostJob', rehired: 'newJob', joined: 'newJob', dating: 'dating', married: 'married', child: 'child', parentalLeave: 'newborn', breakup: 'breakup', divorce: 'divorce', house: 'house',
  burnout: 'burnout', healthScare: 'healthScare', holiday: 'holiday', fmla: 'fmla', startupWin: 'startupWin',
};

/** The ending scene for an outcome; retirement depends on the money. */
export function endingSceneFor(outcome) {
  if (!outcome) return null;
  if (outcome.kind !== 'retired') return outcome.kind;
  const worth = outcome.netWorth;
  if (worth >= 10e6) return 'retiredLuxury';
  if (worth >= 2e6) return 'retiredWealthy';
  if (worth >= 300e3) return 'retiredComfortable';
  return 'retiredModest';
}

// ── Drawing kit ────────────────────────────────────────────────────────

function kit(context, width, height, unit, originX, originY) {
  const iso = (x, y, z = 0) => ({ x: originX + (x - y) * unit, y: originY + (x + y) * unit * 0.5 - z * unit });
  const polygon = (points, fill) => {
    context.beginPath();
    points.forEach((point, index) => (index ? context.lineTo(point.x, point.y) : context.moveTo(point.x, point.y)));
    context.closePath();
    context.fillStyle = fill;
    context.fill();
  };
  const box = (x, y, z, w, d, h, color) => {
    polygon([iso(x, y + d, z), iso(x + w, y + d, z), iso(x + w, y + d, z + h), iso(x, y + d, z + h)], mixColor(color, '#000000', 0.12));
    polygon([iso(x + w, y, z), iso(x + w, y + d, z), iso(x + w, y + d, z + h), iso(x + w, y, z + h)], mixColor(color, '#000000', 0.26));
    polygon([iso(x, y, z + h), iso(x + w, y, z + h), iso(x + w, y + d, z + h), iso(x, y + d, z + h)], mixColor(color, '#ffffff', 0.08));
  };
  // A pitched roof over a box footprint, ridge along x.
  const roof = (x, y, z, w, d, h, color) => {
    polygon([iso(x, y, z), iso(x + w, y, z), iso(x + w, y + d / 2, z + h), iso(x, y + d / 2, z + h)], mixColor(color, '#ffffff', 0.05));
    polygon([iso(x, y + d, z), iso(x + w, y + d, z), iso(x + w, y + d / 2, z + h), iso(x, y + d / 2, z + h)], mixColor(color, '#000000', 0.18));
    polygon([iso(x + w, y, z), iso(x + w, y + d, z), iso(x + w, y + d / 2, z + h)], mixColor(color, '#000000', 0.3));
  };
  const ground = (x0, y0, x1, y1, color) => polygon([iso(x0, y0), iso(x1, y0), iso(x1, y1), iso(x0, y1)], color);
  const person = (x, y, look, options) => {
    const point = iso(x, y, options.z ?? 0);
    drawPerson(context, point.x, point.y, unit * (options.size ?? 0.22), look, options);
  };
  return { iso, polygon, box, roof, ground, person, unit };
}

function sky(context, width, height, top, bottom) {
  const gradient = context.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, top);
  gradient.addColorStop(1, bottom);
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
}

function rain(context, width, height, time, { count = 220, speed = 900, color = 'rgba(180, 200, 230, 0.45)', slant = 0.25 } = {}) {
  context.strokeStyle = color;
  context.lineWidth = 1.2;
  context.beginPath();
  for (let index = 0; index < count; index += 1) {
    const x = (index * 97.13 + time * speed * slant) % (width + 100) - 50;
    const y = (index * 53.71 + time * speed) % (height + 40) - 20;
    context.moveTo(x, y);
    context.lineTo(x - 14 * slant, y - 14);
  }
  context.stroke();
}

function falling(context, width, height, time, colors, { count = 60, speed = 90, size = 4 } = {}) {
  for (let index = 0; index < count; index += 1) {
    const x = (index * 131.7 + Math.sin(time + index) * 30) % width;
    const y = (index * 77.3 + time * speed * (0.6 + (index % 5) / 6)) % height;
    context.save();
    context.translate(x, y);
    context.rotate(time * 3 + index);
    context.fillStyle = colors[index % colors.length];
    context.fillRect(-size / 2, -size / 4, size, size / 2);
    context.restore();
  }
}

function tree(k, context, x, y, { height = 3, crown = '#3f7a46', trunk = '#5b4030', bare = false, palm = false } = {}) {
  k.box(x - 0.08, y - 0.08, 0, 0.16, 0.16, height * 0.55, trunk);
  const top = k.iso(x, y, height * 0.6);
  if (palm) {
    context.strokeStyle = crown;
    context.lineWidth = k.unit * 0.12;
    for (let leaf = 0; leaf < 6; leaf += 1) {
      const angle = Math.PI + leaf * Math.PI / 5;
      context.beginPath();
      context.moveTo(top.x, top.y);
      context.quadraticCurveTo(top.x + Math.cos(angle) * k.unit * 0.8, top.y - k.unit * 0.5, top.x + Math.cos(angle) * k.unit * 1.2, top.y + Math.abs(Math.sin(angle)) * k.unit * 0.3);
      context.stroke();
    }
    return;
  }
  if (bare) {
    context.strokeStyle = trunk;
    context.lineWidth = k.unit * 0.06;
    for (let branch = 0; branch < 6; branch += 1) {
      const angle = -Math.PI / 2 + (branch - 2.5) * 0.4;
      context.beginPath();
      context.moveTo(top.x, top.y + k.unit * 0.3);
      context.lineTo(top.x + Math.cos(angle) * k.unit * 0.9, top.y + Math.sin(angle) * k.unit * 0.9);
      context.stroke();
    }
    return;
  }
  context.fillStyle = crown;
  context.beginPath();
  context.ellipse(top.x, top.y - k.unit * 0.3, k.unit * 0.75, k.unit * 0.9, 0, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = mixColor(crown, '#ffffff', 0.12);
  context.beginPath();
  context.ellipse(top.x - k.unit * 0.25, top.y - k.unit * 0.55, k.unit * 0.35, k.unit * 0.4, 0, 0, Math.PI * 2);
  context.fill();
}

/** A car, as a 3D model centred on a ground point, its nose along `heading` (0 faces +x, π/2 faces +y). */
function car(k, context, x, y, kind, heading = Math.PI / 2) {
  drawCar(context, k, x, y, kind, 0, undefined, heading);
}

// ── Scenes ─────────────────────────────────────────────────────────────

function mourners(seed) {
  return [0, 1, 2, 3, 4].map((index) => peerLook(seed * 7 + index * 13 + 3));
}

/** The funeral: a rainy churchyard with a chapel, fence, varied stones, an open grave, wreaths, a hearse and umbrellas. */
function drawFuneral(context, width, height, time, data) {
  sky(context, width, height, '#4d5660', '#8f99a2');
  // Distant tree line and chapel, in haze.
  for (let i = 0; i < 18; i += 1) {
    const x = (i / 17) * width;
    const h = height * (0.1 + ((i * 37) % 7) / 60);
    context.fillStyle = mixColor('#3a4a44', '#8f99a2', 0.55);
    context.beginPath();
    context.ellipse(x, height * 0.3, width / 30, h, 0, 0, Math.PI * 2);
    context.fill();
  }
  const pan = Math.min(1, time / 10) * width * 0.04;
  const k = kit(context, width, height, Math.min(width, height * 1.7) / 17, width / 2 - pan, height * 0.34);
  const u = k.unit;
  k.ground(-16, -16, 18, 18, '#4a6445');
  // Mown stripes and a gravel path with puddles.
  for (let i = -16; i < 18; i += 2) k.ground(i, -16, i + 1, 18, 'rgba(255,255,255,0.025)');
  k.ground(-1, -16, 0.2, 18, '#77736a');
  for (const [px, py] of [[-0.6, -2], [-0.4, 1.2], [-0.5, 3.4]]) {
    const p = k.iso(px, py);
    context.fillStyle = 'rgba(150,170,190,0.55)';
    context.beginPath();
    context.ellipse(p.x, p.y, u * 0.5, u * 0.16, 0, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = 'rgba(255,255,255,0.35)';
    context.beginPath();
    context.ellipse(p.x, p.y, u * (0.12 + (((time * 0.5 + px) % 0.4) + 0.4) % 0.4), u * 0.04, 0, 0, Math.PI * 2);
    context.stroke();
  }
  // The chapel at the back: stone, a slate roof, a door and a stained window.
  k.box(-7.5, -3.5, 0, 4.2, 3, 2.4, '#b8b2a6');
  k.roof(-7.7, -3.7, 2.4, 4.6, 3.4, 1.6, '#4a4f58');
  k.box(-5.6, -0.5, 0, 0.9, 0.08, 1.6, '#4b3a2a');
  const rose = k.iso(-5.6, -0.45, 2.1);
  context.fillStyle = '#8f3a4f';
  context.beginPath();
  context.arc(rose.x, rose.y, u * 0.22, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = '#e9b949';
  context.beginPath();
  context.arc(rose.x, rose.y, u * 0.08, 0, Math.PI * 2);
  context.fill();
  k.box(-4.2, -3.4, 2.4, 0.5, 0.5, 2.0, '#9a948a');
  // Trees in layers.
  tree(k, context, -4.5, -3.5, { height: 4, bare: true, trunk: '#3b3330' });
  tree(k, context, 6.5, -2, { height: 4.4, crown: '#35603d' });
  tree(k, context, -8, 2, { height: 5, bare: true, trunk: '#33302c' });
  // Iron fence along the left edge.
  for (let y = -3; y <= 9; y += 0.7) {
    k.box(-8.5, y, 0, 0.06, 0.06, 1.3, '#23262b');
    const tip = k.iso(-8.5, y, 1.3);
    context.fillStyle = '#23262b';
    context.beginPath();
    context.moveTo(tip.x, tip.y - u * 0.18);
    context.lineTo(tip.x - 2, tip.y);
    context.lineTo(tip.x + 2, tip.y);
    context.fill();
  }
  k.box(-8.5, -3, 1.0, 0.04, 12, 0.06, '#23262b');
  // Headstones: arches, crosses, obelisks, an angel, some leaning, with moss.
  const kinds = ['arch', 'cross', 'slab', 'obelisk', 'arch', 'slab', 'cross', 'angel'];
  let n = 0;
  for (let row = -4; row <= 5; row += 3) {
    for (let column = -6; column <= 7; column += 2.4) {
      if (Math.abs(column - 2.2) < 1.6 && Math.abs(row - 2) < 2.1) continue;
      const kind = kinds[(n += 1) % kinds.length];
      const lean = ((n * 7) % 5 - 2) * 0.02;
      const color = mixColor('#8f9396', '#6f7a6a', ((n * 13) % 4) / 8);
      if (kind === 'cross') { k.box(column + 0.28, row, 0, 0.14, 0.14, 1.1, color); k.box(column + 0.1, row, 0.7, 0.5, 0.14, 0.14, color); }
      else if (kind === 'obelisk') { k.box(column + 0.1, row, 0, 0.5, 0.5, 0.25, color); k.box(column + 0.2, row + 0.1, 0.25, 0.3, 0.3, 1.5, color); }
      else if (kind === 'angel') { k.box(column, row, 0, 0.6, 0.4, 0.35, color); k.box(column + 0.2, row + 0.1, 0.35, 0.2, 0.2, 0.7, mixColor(color, '#ffffff', 0.2)); const head = k.iso(column + 0.3, row + 0.2, 1.15); context.fillStyle = mixColor(color, '#ffffff', 0.25); context.beginPath(); context.arc(head.x, head.y, u * 0.1, 0, Math.PI * 2); context.fill(); for (const s of [-1, 1]) { context.beginPath(); context.ellipse(head.x + s * u * 0.2, head.y + u * 0.2, u * 0.16, u * 0.08, s * 0.7, 0, Math.PI * 2); context.fill(); } }
      else { k.box(column + lean * 4, row, 0, 0.7, 0.18, 0.9 + (n % 3) * 0.2, color); if (kind === 'arch') { const top = k.iso(column + 0.35 + lean * 4, row, 1.0 + (n % 3) * 0.2); context.fillStyle = mixColor(color, '#ffffff', 0.08); context.beginPath(); context.arc(top.x, top.y, u * 0.35, Math.PI, 0); context.fill(); } }
      const moss = k.iso(column + 0.2, row + 0.2, 0.05);
      context.fillStyle = 'rgba(70,110,60,0.45)';
      context.beginPath();
      context.ellipse(moss.x, moss.y, u * 0.3, u * 0.1, 0, 0, Math.PI * 2);
      context.fill();
    }
  }
  // Fallen leaves and grass tufts.
  for (let i = 0; i < 70; i += 1) {
    const p = k.iso(-8 + (i * 2.7) % 17, -5 + (i * 1.9) % 12);
    context.fillStyle = i % 3 ? '#8a6a3a' : '#a85a2a';
    context.fillRect(p.x, p.y, 3, 2);
  }
  // The open grave: dug earth, coffin on straps, spade, a heap of soil.
  k.box(1.6, 2.1, 0, 1.5, 2.3, 0.04, '#2b2118');
  k.box(1.75, 2.3, 0, 1.2, 1.9, 0.02, '#14100c');
  k.box(1.9, 2.5, 0.0, 0.9, 1.5, 0.35, '#6b4a2e');
  k.box(1.95, 2.55, 0.35, 0.8, 1.4, 0.04, '#7a5636');
  k.box(3.2, 2.2, 0, 0.9, 1.1, 0.5, '#4e3a28');
  k.box(3.6, 3.5, 0, 0.06, 0.06, 0.9, '#6b5a40');
  k.box(1.6, 1.7, 0, 1.4, 0.3, 1.5, '#a7aaad');
  const stone = k.iso(2.3, 1.85, 1.15);
  context.fillStyle = '#3b3e42';
  context.font = `600 ${Math.max(9, u * 0.22)}px Barlow Condensed, sans-serif`;
  context.textAlign = 'center';
  context.fillText(data.name.toUpperCase(), stone.x - u * 0.3, stone.y);
  context.fillText(`${data.born}–${data.died}`, stone.x - u * 0.3, stone.y + u * 0.3);
  // Wreaths on stands, with ribbons.
  for (const [x, y, c] of [[0.3, 2.0, '#d9534f'], [4.2, 2.6, '#f2f2f2'], [0.5, 3.4, '#f2c5d0']]) {
    k.box(x, y, 0, 0.06, 0.06, 1.0, '#6b5a40');
    const p = k.iso(x + 0.03, y + 0.03, 1.15);
    context.strokeStyle = '#3f6f45';
    context.lineWidth = u * 0.14;
    context.beginPath();
    context.arc(p.x, p.y, u * 0.34, 0, Math.PI * 2);
    context.stroke();
    context.fillStyle = c;
    for (let f = 0; f < 8; f += 1) { context.beginPath(); context.arc(p.x + Math.cos(f) * u * 0.34, p.y + Math.sin(f) * u * 0.34, u * 0.07, 0, Math.PI * 2); context.fill(); }
    context.fillStyle = '#1a1a1a';
    context.fillRect(p.x - 2, p.y + u * 0.34, 4, u * 0.3);
  }
  // The portrait on its easel.
  k.box(3.5, 1.1, 0, 0.08, 0.08, 1.3, '#4a3828');
  const frame = k.iso(3.55, 1.15, 1.6);
  context.fillStyle = '#2b2018';
  context.fillRect(frame.x - u * 0.42, frame.y - u * 0.5, u * 0.84, u * 0.95);
  context.fillStyle = '#d9cdb8';
  context.fillRect(frame.x - u * 0.36, frame.y - u * 0.44, u * 0.72, u * 0.83);
  drawHead(context, frame.x, frame.y, u * 0.24, data.look, { time });
  // A hearse at the path's far end.
  k.box(-2.4, -5.2, 0.18, 1.0, 3.2, 0.9, '#15171a');
  k.box(-2.35, -5.1, 1.08, 0.9, 2.2, 0.55, '#9fb4c4');
  k.box(-2.4, -5.2, 0.18, 1.0, 0.8, 0.05, '#c9a24a');
  // Crows on the stones.
  for (const [x, y] of [[-3.2, -1.2], [5.0, 2.2]]) {
    const p = k.iso(x, y, 1.1);
    const hop = Math.max(0, Math.sin(time * 1.3 + x)) * u * 0.12;
    context.fillStyle = '#0c0c0e';
    context.beginPath();
    context.ellipse(p.x, p.y - hop, u * 0.15, u * 0.09, 0, 0, Math.PI * 2);
    context.fill();
    context.fillRect(p.x + u * 0.1, p.y - hop - u * 0.06, u * 0.1, u * 0.03);
  }
  // The priest at the head of the grave and the mourners, some under umbrellas.
  drawPerson(context, k.iso(2.4, 1.2).x, k.iso(2.4, 1.2).y, u * 0.22, { skin: '#e2b893', hair: '#bdbdbd', suit: '#2a2a2f', shirt: '#ffffff', face: 'soft', hairStyle: 'cleanShort', brows: 'soft', eyes: 'innerDouble', nose: 'soft', mouth: 'composed', faceStyle: 'anime' }, { pose: 'standing', outfit: { top: '#1c1c20', bottom: '#1c1c20', shirt: '#ffffff' }, expression: 'blank', time });
  const black = { top: '#1a1b1e', bottom: '#111214', shirt: '#2b2c30' };
  mourners(data.seed).forEach((look, index) => {
    const spots = [[0.3, 4.6], [1.2, 5.2], [2.4, 5.4], [3.6, 5.1], [4.6, 4.4]];
    const [x, y] = spots[index];
    k.person(x, y, look, { pose: 'mourning', expression: 'crying', outfit: black, time: time + index });
    if (index === 0 || index === 4) drawUmbrella(context, k, x + 0.55, y - 0.3, 0, ['#111111', '#1d2a44', '#7a1d1d'][index % 3], index === 4 ? '#2f4268' : null);
  });
  // Fog in front, rain, splashes, and a dim wash.
  const fog = context.createLinearGradient(0, height * 0.2, 0, height * 0.65);
  fog.addColorStop(0, 'rgba(190,200,210,0.0)');
  fog.addColorStop(0.5, 'rgba(190,200,210,0.16)');
  fog.addColorStop(1, 'rgba(190,200,210,0.0)');
  context.fillStyle = fog;
  context.fillRect(0, height * 0.2, width, height * 0.45);
  rain(context, width, height, time, { count: 170, speed: 700, color: 'rgba(200, 210, 225, 0.38)', slant: 0.1 });
  context.strokeStyle = 'rgba(210,220,235,0.4)';
  for (let i = 0; i < 28; i += 1) {
    const x = (i * 131) % width;
    const y = height * 0.45 + ((i * 71) % (height * 0.45));
    const r = ((time * 3 + i * 0.37) % 1) * 7;
    context.beginPath();
    context.ellipse(x, y, r, r * 0.35, 0, 0, Math.PI * 2);
    context.stroke();
  }
  context.fillStyle = 'rgba(30, 35, 45, 0.14)';
  context.fillRect(0, 0, width, height);
  const vignette = context.createRadialGradient(width / 2, height / 2, height * 0.4, width / 2, height / 2, height * 0.95);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.35)');
  context.fillStyle = vignette;
  context.fillRect(0, 0, width, height);
}

const SCENES = {
  death: {
    duration: 13,
    captions: (data) => [
      `${data.name}, ${data.born} – ${data.died}.`,
      `${data.title}. The work could always wait. It never did.`,
      'They came in black, in the rain, and said kind things about the hours.',
    ],
    draw(context, width, height, time, data) {
      drawFuneral(context, width, height, time, data);
    },
  },

  homeless: {
    duration: 12,
    captions: (data) => [
      `Night. ${data.firstName}, ${data.age}, once a ${data.title}.`,
      'The savings ran out before the job search did.',
      'Cardboard keeps out the cold, a little. Nothing keeps out the rain.',
    ],
    draw(context, width, height, time, data) {
      sky(context, width, height, '#070a14', '#151b2b');
      const k = kit(context, width, height, Math.min(width, height * 1.6) / 13, width / 2, height * 0.2);
      // A dead-end alley: two brick walls meeting at the back, wet asphalt.
      k.ground(0, 0, 8, 8, '#1d2129');
      k.polygon([k.iso(0, 0), k.iso(0, 8), k.iso(0, 8, 6), k.iso(0, 0, 6)], '#3e231e');
      k.polygon([k.iso(0, 0), k.iso(8, 0), k.iso(8, 0, 6), k.iso(0, 0, 6)], '#4a2a24');
      context.strokeStyle = 'rgba(0, 0, 0, 0.35)';
      context.lineWidth = 1;
      for (let course = 0.35; course < 6; course += 0.35) {
        for (const [from, to] of [[k.iso(0, 0, course), k.iso(0, 8, course)], [k.iso(0, 0, course), k.iso(8, 0, course)]]) {
          context.beginPath();
          context.moveTo(from.x, from.y);
          context.lineTo(to.x, to.y);
          context.stroke();
        }
      }
      // A fire escape and a dark window on the back wall.
      k.polygon([k.iso(3, 0, 3.2), k.iso(4.4, 0, 3.2), k.iso(4.4, 0, 4.6), k.iso(3, 0, 4.6)], '#10141c');
      k.box(2.7, 0.05, 3, 2, 0.6, 0.08, '#2a2d33');
      // Dumpster against the side wall.
      k.box(0.1, 1.2, 0, 1.3, 2.2, 1.3, '#2f4a3a');
      k.box(0.05, 1.15, 1.3, 1.4, 2.3, 0.12, '#253c2f');
      // Streetlamp at the alley mouth, flickering.
      const flicker = Math.sin(time * 23) > 0.92 ? 0.25 : 1;
      k.box(7.2, 6.6, 0, 0.12, 0.12, 4.4, '#3a3d42');
      const lamp = k.iso(7.1, 6.5, 4.4);
      context.fillStyle = `rgba(255, 220, 140, ${flicker})`;
      context.beginPath();
      context.arc(lamp.x, lamp.y, k.unit * 0.15, 0, Math.PI * 2);
      context.fill();
      const glow = context.createRadialGradient(lamp.x, lamp.y, 2, lamp.x, lamp.y + k.unit * 2.5, k.unit * 6);
      glow.addColorStop(0, `rgba(255, 205, 120, ${0.45 * flicker})`);
      glow.addColorStop(1, 'rgba(255, 205, 120, 0)');
      context.fillStyle = glow;
      context.fillRect(0, 0, width, height);
      for (const [x, y, size] of [[4.6, 5.6, 0.9], [2.4, 6.2, 0.6], [5.8, 2.8, 0.7]]) {
        const point = k.iso(x, y);
        context.fillStyle = `rgba(150, 160, 190, ${0.3 + 0.1 * Math.sin(time * 4 + x)})`;
        context.beginPath();
        context.ellipse(point.x, point.y, k.unit * size, k.unit * size * 0.45, 0, 0, Math.PI * 2);
        context.fill();
      }
      // Cardboard, the sleeper, a thin blanket.
      k.box(2.0, 3.2, 0, 1.2, 2.6, 0.06, '#8a6a42');
      const sleeper = k.iso(2.6, 3.6, 0.06);
      context.save();
      context.translate(sleeper.x, sleeper.y);
      context.rotate(0.46);
      drawPerson(context, 0, 0, k.unit * 0.2, data.look, { pose: 'lying', expression: 'sleep', outfit: { top: '#4a4d52', bottom: '#33363a' }, time });
      context.restore();
      k.box(2.15, 4.0, 0.08, 0.95, 1.6, 0.22, '#5d6168');
      // A car passing the end of the alley now and then.
      const sweep = (time % 6) / 6;
      if (sweep > 0.65) {
        context.fillStyle = `rgba(255, 250, 220, ${0.12 * Math.sin((sweep - 0.65) / 0.35 * Math.PI)})`;
        context.fillRect(0, 0, width, height);
      }
      rain(context, width, height, time, { count: 320, speed: 1100, slant: 0.3 });
    },
  },

  breakdown: {
    duration: 12,
    captions: (data) => [
      `${data.firstName} stopped. Not slowed down: stopped.`,
      'The ward is quiet. The nurses are kind. The days are long and empty.',
      'Getting better starts here, slowly. (If you are struggling for real: call or text 988 in the US, or see findahelpline.com.)',
    ],
    draw(context, width, height, time, data) {
      sky(context, width, height, '#cfd8d2', '#e6ece8');
      const k = kit(context, width, height, Math.min(width, height * 1.6) / 12, width / 2.2, height * 0.24);
      k.ground(0, 0, 8, 7, '#c9cfc6');
      k.polygon([k.iso(0, 0), k.iso(0, 7), k.iso(0, 7, 5), k.iso(0, 0, 5)], '#b9cbbf');
      k.polygon([k.iso(0, 0), k.iso(8, 0), k.iso(8, 0, 5), k.iso(0, 0, 5)], '#d6e2d9');
      // High window with mesh, a pale square of daylight on the floor.
      k.polygon([k.iso(0, 2.2, 2.8), k.iso(0, 4.6, 2.8), k.iso(0, 4.6, 4.3), k.iso(0, 2.2, 4.3)], '#eef6ff');
      context.strokeStyle = 'rgba(80, 90, 90, 0.5)';
      context.lineWidth = 1;
      for (let bar = 2.5; bar < 4.6; bar += 0.3) {
        const from = k.iso(0, bar, 2.8);
        const to = k.iso(0, bar, 4.3);
        context.beginPath();
        context.moveTo(from.x, from.y);
        context.lineTo(to.x, to.y);
        context.stroke();
      }
      k.polygon([k.iso(1.5, 2.6), k.iso(3.6, 2.6), k.iso(3.6, 5), k.iso(1.5, 5)], 'rgba(255, 255, 240, 0.35)');
      // Wall clock, its second hand the only thing moving fast.
      const clock = k.iso(4.5, 0, 3.7);
      context.fillStyle = '#ffffff';
      context.beginPath();
      context.arc(clock.x, clock.y, k.unit * 0.42, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = '#333';
      context.lineWidth = 2;
      context.stroke();
      const hand = (angle, length) => {
        context.beginPath();
        context.moveTo(clock.x, clock.y);
        context.lineTo(clock.x + Math.cos(angle) * length, clock.y + Math.sin(angle) * length);
        context.stroke();
      };
      hand(-Math.PI / 2 + time * 0.6, k.unit * 0.36);
      hand(-Math.PI / 2 + 2.1, k.unit * 0.24);
      // Bed and patient.
      k.box(4.5, 2.4, 0, 2.8, 1.5, 0.6, '#d0d4d8');
      k.box(4.5, 2.4, 0.6, 2.8, 1.5, 0.18, '#ffffff');
      k.box(6.7, 2.55, 0.78, 0.5, 1.2, 0.2, '#f4f4f4');
      k.person(4.8, 3.6, data.look, { pose: 'sitting', expression: 'blank', outfit: { top: '#a9c6dc', bottom: '#a9c6dc', shirt: '#a9c6dc' }, time, z: 0.78, facing: -1 });
      // A nurse comes in after a while.
      const enter = Math.min(1, Math.max(0, (time - 5) / 3));
      if (enter > 0) {
        k.person(7.5 - enter * 2.2, 5.6, peerLook(data.seed + 99), {
          pose: enter < 1 ? 'walking' : 'standing', outfit: { top: '#f4f6f8', bottom: '#dfe6ec', shirt: '#8fb3d6' }, time, facing: -1,
        });
      }
    },
  },

  retiredModest: retirementScene(0),
  retiredComfortable: retirementScene(1),
  retiredWealthy: retirementScene(2),
  retiredLuxury: retirementScene(3),

  // ── Interim ──
  promoted: interim(3.8, (data) => [`Promoted: ${data.title}.`], (context, width, height, time, data, k) => {
    sky(context, width, height, '#cfe0f2', '#eef4fa');
    k.ground(-4, -2, 5, 6, '#c3cfdd');
    k.box(-1, -0.5, 0, 3, 0.25, 3.4, '#e6ebf2');
    const open = Math.min(1, time / 1.5);
    k.box(0.1, -0.3, 0, 1.2 * (1 - open * 0.8), 0.12, 2.6, '#7a5a3a');
    const plate = k.iso(0.7, -0.6, 2.95);
    context.fillStyle = '#c9a24a';
    context.fillRect(plate.x - k.unit * 0.9, plate.y - k.unit * 0.18, k.unit * 1.8, k.unit * 0.36);
    context.fillStyle = '#1d1d1d';
    context.font = `700 ${Math.max(9, k.unit * 0.2)}px Barlow Condensed, sans-serif`;
    context.textAlign = 'center';
    context.fillText(data.title.toUpperCase(), plate.x, plate.y + k.unit * 0.08);
    k.person(1.2, 2.2, data.look, { pose: 'waving', expression: 'happy', time });
    falling(context, width, height, time, ['#f4c542', '#46b96b', '#3b82f6', '#e5484d'], { count: 80, speed: 160 });
  }),
  lostJob: interim(4, (data) => [`${data.firstName} carries a box out of ${data.company}.`], (context, width, height, time, data, k) => {
    sky(context, width, height, '#7c8794', '#a9b3bd');
    k.ground(-4, -2, 6, 6, '#8d949b');
    k.box(-3, -2, 0, 4, 1.2, 4.5, '#5f6f84');
    k.box(-1.6, -0.85, 0, 1.2, 0.1, 2.2, '#9fb6cf');
    k.person(-0.8 + time * 0.6, 1.8, data.look, { pose: 'carrying', expression: 'sad', time });
    rain(context, width, height, time, { count: 90, speed: 600, slant: 0.05 });
  }),
  newJob: interim(3.8, (data) => [`First day at ${data.company}.`], (context, width, height, time, data, k) => {
    sky(context, width, height, '#9ec8ef', '#e6f2fc');
    k.ground(-4, -2, 6, 6, '#c9ced4');
    k.box(-3, -3, 0, 5, 1.5, 5.5, '#3e5f86');
    for (let floor = 0.6; floor < 5.4; floor += 0.9) k.box(-2.9, -1.55, floor, 4.8, 0.05, 0.4, '#a9d0f0');
    const sign = k.iso(-0.5, -1.4, 5.8);
    context.fillStyle = '#ffffff';
    context.font = `700 ${Math.max(10, k.unit * 0.3)}px Barlow Condensed, sans-serif`;
    context.textAlign = 'center';
    context.fillText(data.company.toUpperCase(), sign.x, sign.y);
    k.person(2.5 - time * 0.7, 1.6, data.look, { pose: 'walking', expression: 'happy', time, facing: -1 });
  }),
  child: interim(4, () => ['A new person in the house. Nobody sleeps.'], (context, width, height, time, data, k) => {
    sky(context, width, height, '#2a3550', '#41507a');
    k.ground(-3, -2, 5, 5, '#d9c7a8');
    k.box(1, 0.5, 0, 1.4, 0.9, 0.9, '#f2e6d2');
    k.box(1.05, 0.55, 0.9, 1.3, 0.8, 0.08, '#ffffff');
    const mobile = k.iso(1.7, 0.95, 2.1);
    for (let star = 0; star < 4; star += 1) {
      const angle = time * 0.8 + star * Math.PI / 2;
      context.fillStyle = ['#f4c542', '#a8c8ff', '#f7c6d4', '#ffffff'][star];
      context.beginPath();
      context.arc(mobile.x + Math.cos(angle) * k.unit * 0.5, mobile.y + Math.sin(angle) * k.unit * 0.12, k.unit * 0.1, 0, Math.PI * 2);
      context.fill();
    }
    k.person(0, 1.4, data.look, { pose: 'standing', expression: 'happy', time });
  }),
  house: interim(3.8, () => ['The keys are yours.'], (context, width, height, time, data, k) => {
    sky(context, width, height, '#8ec5ec', '#e2f1fb');
    k.ground(-4, -3, 6, 6, '#7fb06a');
    drawHouse(context, k, -2.5, -3, 'modest');
    k.box(2.2, 1.2, 0, 0.08, 0.08, 1.4, '#6b5038');
    const sign = k.iso(2.25, 1.2, 1.45);
    context.fillStyle = '#ffffff';
    context.fillRect(sign.x - k.unit * 0.6, sign.y - k.unit * 0.4, k.unit * 1.2, k.unit * 0.5);
    context.fillStyle = '#c8102e';
    context.font = `700 ${Math.max(9, k.unit * 0.3)}px Barlow Condensed, sans-serif`;
    context.textAlign = 'center';
    context.fillText('SOLD', sign.x, sign.y - k.unit * 0.04);
    k.person(0.8, 2.4, data.look, { pose: 'waving', expression: 'happy', time });
  }),
  burnout: interim(4, () => ['Something gives.'], (context, width, height, time, data, k) => {
    sky(context, width, height, '#141a2e', '#232c48');
    k.ground(-3, -2, 5, 5, '#5b6577');
    k.box(-0.6, 0, 0, 2.2, 1.2, 1.4, '#9aa3ad');
    k.box(0.0, 0.1, 1.4, 0.15, 0.9, 0.9, '#1f2329');
    const seat = k.iso(0.6, 1.6, 0.9);
    drawPerson(context, seat.x, seat.y + k.unit * 0.9, k.unit * 0.22, data.look, { pose: 'sitting', expression: 'sad', time });
    context.fillStyle = `rgba(128, 128, 128, ${Math.min(0.7, time / 4)})`;
    context.globalCompositeOperation = 'saturation';
    context.fillRect(0, 0, width, height);
    context.globalCompositeOperation = 'source-over';
  }),
  fmla: interim(4, () => ['Twelve weeks. The laptop stays closed.'], (context, width, height, time, data, k) => {
    sky(context, width, height, '#7d8fa6', '#b4c2d2');
    k.ground(-3, -2, 5, 5, '#d9c7a8');
    k.polygon([k.iso(-3, -2), k.iso(-3, 5), k.iso(-3, 5, 4), k.iso(-3, -2, 4)], '#efe3cf');
    k.polygon([k.iso(-3, 0.5, 1.5), k.iso(-3, 3, 1.5), k.iso(-3, 3, 3.3), k.iso(-3, 0.5, 3.3)], '#9fb6cf');
    rain(context, width, height * 0.5, time, { count: 40, speed: 300, slant: 0.05 });
    k.box(-1, 1, 0, 2.6, 1, 0.6, '#7b8fa6');
    k.box(-1, 1, 0.6, 2.6, 0.3, 0.7, '#6d8098');
    k.person(0.2, 1.7, data.look, { pose: 'sitting', expression: null, outfit: { top: '#8a9a7b', bottom: '#5a6470', shirt: '#8a9a7b' }, time, z: 0.6 });
  }),
  startupWin: interim(3.8, () => ['The startup sold. Your $20,000 is now $200,000.'], (context, width, height, time, data, k) => {
    sky(context, width, height, '#f7d774', '#fff4cf');
    k.ground(-3, -2, 5, 5, '#e8d8a8');
    k.person(0.5, 1.6, data.look, { pose: 'waving', expression: 'happy', time });
    falling(context, width, height, time, ['#2f8f50', '#46b96b', '#f4c542'], { count: 70, speed: 140, size: 8 });
  }),
};

// The FIRE ending tours a shuffled route of places (see scenes-world.js); the
// big personal moments are drawn in scenes-life.js.
Object.assign(SCENES, lifeScenes({ interim, sky, rain, falling, tree, mixColor, peerLook, umbrella: drawUmbrella }), {
  fire: {
    duration: WORLD_INTRO_SECONDS + WORLD_STOPS * WORLD_STOP_SECONDS,
    captions: (data) => [`At ${data.age}, ${data.firstName} decided the money was enough.`, ...worldRoute(data.seed ?? 1).map((place) => place.line)],
    captionAt: (time, data) => {
      const route = worldRoute(data.seed ?? 1);
      if (time < WORLD_INTRO_SECONDS) return `At ${data.age}, ${data.firstName} decided the money was enough.`;
      return route[Math.min(route.length - 1, Math.floor((time - WORLD_INTRO_SECONDS) / WORLD_STOP_SECONDS))].line;
    },
    draw(context, width, height, time, data) {
      drawWorldTour(context, width, height, time, data, { kit, sky, tree, falling, mixColor, peerLook, umbrella: drawUmbrella });
    },
  },
});

/**
 * An interim scene. `zoom` shrinks the kit's unit for crowded sets (a wedding
 * needs more ground than an office doorway), and `originY` slides the ground
 * point the scene is drawn around.
 */
function interim(duration, captions, draw, { zoom = 1, originY = 0.52 } = {}) {
  return {
    duration,
    captions,
    draw(context, width, height, time, data) {
      const k = kit(context, width, height, Math.min(width, height * 1.6) / 13 * zoom, width / 2, height * originY);
      draw(context, width, height, time, data, k);
    },
  };
}

/** Retirement by wealth tier: the home, the street and the car say it all. */
function retirementScene(tier) {
  const captions = [
    (data) => [`At ${data.age}, ${data.firstName} retires on what there is.`, 'A small flat, an old hatchback, coupons on the fridge.', 'The view from the balcony is of the car park. The coffee is good, though.'],
    (data) => [`At ${data.age}, ${data.firstName} retires to a quiet street.`, 'A paid-off house, a reliable sedan, tomatoes in the garden.', 'Mornings without meetings. It turns out that was all anyone wanted.'],
    (data) => [`At ${data.age}, ${data.firstName} retires well.`, 'A big house on a leafy street, an SUV for the grandchildren, the dog.', 'Forty years of hours, turned into all the hours in the world.'],
    (data) => [`At ${data.age}, ${data.firstName} retires very, very well.`, 'A villa with a pool, palms, a red sports car, a boat on the horizon.', 'The ladder had a top after all, and the view from it is extraordinary.'],
  ][tier];
  return {
    duration: 12,
    captions,
    draw(context, width, height, time, data) {
      const evening = Math.min(1, time / 12);
      sky(context, width, height, mixColor('#7fb7ea', '#e98a5a', evening * 0.8), mixColor('#cfe6f8', '#f8c58e', evening * 0.8));
      const k = kit(context, width, height, Math.min(width, height * 1.6) / 30, width / 2 + width * 0.05, height * 0.58);
      const lawn = ['#9aa092', '#7fb06a', '#6aa85a', '#76b35f'][tier];
      k.ground(-40, -40, 40, 40, lawn);
      k.ground(4.5, -40, 6, 40, '#6d7178');
      const arrive = Math.min(1, time / 3.5);
      if (tier === 0) {
        // A worn apartment block with a balcony.
        drawApartment(context, k, -4, -3, data.home === 'nice' || data.home === 'luxury' ? 'nice' : 'worn');
        k.person(-1.85, 0.3, data.look, { pose: 'sitting', expression: null, outfit: { top: '#7b7568', bottom: '#4b4740', shirt: '#7b7568' }, time, z: 2.1, size: 0.17 });
        car(k, context, 5.25, 4.5 - (1 - arrive) * 4, data.car ?? 'hatchback');
      } else if (tier === 1) {
        drawHouse(context, k, -3.5, -2.5, 'modest');
        tree(k, context, 2.5, -2, { height: 3 });
        k.person(-0.6, 2.2, data.look, { pose: 'standing', expression: 'happy', outfit: { top: '#5b7f9a', bottom: '#c9b48a', shirt: '#ffffff' }, time });
        car(k, context, 5.25, 4 - (1 - arrive) * 4, data.car ?? 'sedan');
      } else if (tier === 2) {
        drawHouse(context, k, -6.4, -3.5, 'family');
        for (let index = 0; index < 4; index += 1) tree(k, context, -5 + index * 3.3, 5.5, { height: 3.2, crown: '#3f8f4f' });
        tree(k, context, 3, -2.5, { height: 3.5 });
        k.person(-0.2, 2.6, data.look, { pose: 'waving', expression: 'happy', outfit: { top: '#9a4a5a', bottom: '#2f3a4a', shirt: '#ffffff' }, time });
        k.person(0.9, 2.9, peerLook(data.seed + 21), { pose: 'waving', expression: 'happy', time, size: 0.15 });
        const dog = k.iso(1.7, 3.2, 0);
        context.fillStyle = '#b07a3a';
        context.beginPath();
        context.ellipse(dog.x, dog.y - k.unit * 0.25, k.unit * 0.35, k.unit * 0.18, 0, 0, Math.PI * 2);
        context.fill();
        context.beginPath();
        context.arc(dog.x + k.unit * 0.35, dog.y - k.unit * 0.42 + Math.sin(time * 8) * 2, k.unit * 0.14, 0, Math.PI * 2);
        context.fill();
        car(k, context, 5.25, 3.8 - (1 - arrive) * 4, data.car ?? 'suv');
      } else {
        // A villa: white cubes, a pool, palms, the sea and a boat.
        k.ground(-40, -40, 40, -5, '#2a8fc7');
        const boat = k.iso(-3 + Math.sin(time * 0.2) * 2, -9);
        context.fillStyle = '#ffffff';
        context.beginPath();
        context.moveTo(boat.x - 30, boat.y);
        context.lineTo(boat.x + 30, boat.y);
        context.lineTo(boat.x + 20, boat.y + 8);
        context.lineTo(boat.x - 22, boat.y + 8);
        context.fill();
        drawHouse(context, k, -5, -3.5, 'villa');
        const shimmer = k.iso(-1 + Math.sin(time) * 1.5, 2.3, 0);
        context.fillStyle = 'rgba(255, 255, 255, 0.35)';
        context.fillRect(shimmer.x - 20, shimmer.y - 2, 40, 3);
        for (const [x, y] of [[2.5, -3], [3, 3.5], [-5.5, 2.5]]) tree(k, context, x, y, { palm: true, crown: '#2f7d3b', trunk: '#8a6a42', height: 4 });
        k.box(-0.4, 3.7, 0, 1.6, 0.6, 0.25, '#ffffff');
        k.person(0.3, 4.0, data.look, { pose: 'sitting', expression: 'happy', outfit: { top: '#ffffff', bottom: '#d9c7a8', shirt: '#ffffff' }, time, z: 0.25 });
        car(k, context, 5.25, 3.6 - (1 - arrive) * 4, data.car ?? 'sports');
      }
      // Birds in the evening sky.
      context.strokeStyle = 'rgba(40, 40, 50, 0.6)';
      context.lineWidth = 1.5;
      for (let bird = 0; bird < 4; bird += 1) {
        const x = (time * 40 + bird * 90) % (width + 60) - 30;
        const y = height * 0.12 + bird * 9 + Math.sin(time * 3 + bird) * 4;
        const flap = Math.sin(time * 10 + bird) * 4;
        context.beginPath();
        context.moveTo(x - 7, y - flap);
        context.lineTo(x, y);
        context.lineTo(x + 7, y - flap);
        context.stroke();
      }
    },
  };
}

// ── Player ─────────────────────────────────────────────────────────────

/**
 * Create the cut-scene player on its overlay.
 *
 * Args:
 *   overlay: element holding a canvas, a caption and a skip button
 */
/** The caption for a moment: scenes with their own timing say so, the rest split evenly. */
function captionFor(current, time) {
  if (current.scene.captionAt) return current.scene.captionAt(time, current.data);
  const line = Math.min(current.lines.length - 1, Math.floor(time / current.scene.duration * current.lines.length));
  return current.lines[line];
}

export function createCutscenePlayer(overlay) {
  const canvas = overlay.querySelector('canvas');
  const caption = overlay.querySelector('.cutscene-caption');
  const context = canvas.getContext('2d');
  let current = null;
  let frame = 0;

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.round(rect.width * ratio);
    canvas.height = Math.round(rect.height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  function play(id, data, onDone) {
    const scene = SCENES[id];
    if (!scene) {
      if (onDone) onDone();
      return;
    }
    stop();
    overlay.hidden = false;
    resize();
    current = { id, scene, data, onDone, started: performance.now(), lines: scene.captions(data).filter(Boolean), elapsed: 0 };
    render(performance.now());
  }

  function render(now) {
    if (!current) return;
    const rect = canvas.getBoundingClientRect();
    const time = (now - current.started) / 1000;
    current.elapsed = time;
    context.clearRect(0, 0, rect.width, rect.height);
    current.scene.draw(context, rect.width, rect.height, time, current.data);
    const text = captionFor(current, time);
    if (caption.textContent !== text) caption.textContent = text;
    if (time >= current.scene.duration) {
      finish();
      return;
    }
    frame = requestAnimationFrame(render);
  }

  /** Draw a chosen moment of the current scene: hidden tabs never animate. */
  function seek(seconds) {
    if (!current) return;
    current.started = performance.now() - seconds * 1000;
    const rect = canvas.getBoundingClientRect();
    context.clearRect(0, 0, rect.width, rect.height);
    current.scene.draw(context, rect.width, rect.height, seconds, current.data);
    caption.textContent = captionFor(current, seconds);
  }

  function stop() {
    cancelAnimationFrame(frame);
    current = null;
  }

  function finish() {
    const done = current?.onDone;
    stop();
    overlay.hidden = true;
    if (done) done();
  }

  return { play, skip: finish, seek, resize, isPlaying: () => Boolean(current), current: () => current };
}

/** What a scene needs to know about the player. */
// What the player drove, by the car they chose in life (see the car event).
const CAR_KINDS = { old: 'hatchback', new: 'sedan', family: 'suv', luxury: 'sports' };

export function sceneData(game) {
  const player = game.player;
  const born = new Date().getFullYear() - 22;
  const peak = Math.max(game.peakLevel ?? 0, player.level);
  return {
    look: player.look,
    name: player.name,
    firstName: player.name.split(' ')[0],
    age: Math.floor(player.age),
    born,
    died: born + Math.floor(player.age),
    title: game.industry.titles[peak],
    company: game.org?.companyName ?? game.lastOrg?.companyName ?? 'the company',
    seed: game.seed ?? 1,
    netWorth: game.outcome?.netWorth ?? 0,
    gender: game.character?.gender ?? 'male',
    partnerLook: (game.partner ?? game.exPartner)?.look ?? null,
    partnerFirstName: (game.partner ?? game.exPartner)?.name.split(' ')[0] ?? null,
    car: CAR_KINDS[game.flags.car] ?? null,
    home: game.flags.apartment ?? null,
  };
}

/**
 * A still of a scene at a chosen moment, as a PNG data URL, drawn offscreen:
 * the picture the shareable page carries. Null for an unknown scene.
 */
export function snapshotScene(id, data, width = 640, height = 360, atShare = 0.7) {
  const scene = SCENES[id];
  if (!scene) return null;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  scene.draw(context, width, height, scene.duration * atShare, data);
  return canvas.toDataURL('image/png');
}

export { drawHead, kit, sky, rain, tree, mourners };
