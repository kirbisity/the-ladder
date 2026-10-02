// The FIRE ending: the whole world, one place at a time. Each place is a
// complete little scene (sky, far landscape, mid-ground buildings, a
// foreground with life in it) drawn with the same iso kit as every other
// cut scene, plus layered silhouettes for the far distance. The ending
// shuffles the places by the career's seed, so no two retirements travel
// the same route.

const TAU = Math.PI * 2;

// A steady pseudo-random number from an integer, so details stay put frame to frame.
export const hash = (n) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

export function fillPolygon(context, points, fill) {
  context.beginPath();
  points.forEach(([x, y], index) => (index ? context.lineTo(x, y) : context.moveTo(x, y)));
  context.closePath();
  context.fillStyle = fill;
  context.fill();
}

export function line(context, x1, y1, x2, y2, color, size = 1) {
  context.strokeStyle = color;
  context.lineWidth = size;
  context.beginPath();
  context.moveTo(x1, y1);
  context.lineTo(x2, y2);
  context.stroke();
}

export function glow(context, x, y, radius, color) {
  const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = gradient;
  context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}

export function band(context, width, top, bottom, colorTop, colorBottom) {
  const gradient = context.createLinearGradient(0, top, 0, bottom);
  gradient.addColorStop(0, colorTop);
  gradient.addColorStop(1, colorBottom);
  context.fillStyle = gradient;
  context.fillRect(0, top, width, bottom - top);
}

export function cloud(context, x, y, size, color = 'rgba(255,255,255,0.85)') {
  context.fillStyle = color;
  for (const [dx, dy, r] of [[0, 0, 1], [0.9, 0.15, 0.8], [-0.9, 0.2, 0.75], [0.3, -0.35, 0.8], [-0.4, -0.25, 0.65]]) {
    context.beginPath();
    context.ellipse(x + dx * size, y + dy * size * 0.5, size * r * 0.85, size * r * 0.42, 0, 0, TAU);
    context.fill();
  }
}

/**
 * A mountain range as lit and shaded faces with jagged snow caps. Each
 * peak is [x (0..1), height (0..1 of room), half-width (0..1)].
 */
export function mountains(context, width, baseY, room, peaks, { rock, lit, shade, snow = '#ffffff', snowLine = 0.62, seed = 1 }, { sunSide = -1 } = {}) {
  for (const [px, ph, pw] of peaks) {
    const x = px * width;
    const top = baseY - ph * room;
    const half = pw * width;
    const rim = hash(seed + px * 31);
    const leftFace = [[x - half, baseY], [x, top], [x + half * (0.1 + rim * 0.2), baseY]];
    const rightFace = [[x, top], [x + half, baseY], [x + half * (0.1 + rim * 0.2), baseY]];
    fillPolygon(context, sunSide < 0 ? leftFace : rightFace, lit ?? rock);
    fillPolygon(context, sunSide < 0 ? rightFace : leftFace, shade ?? rock);
    if (snow) {
      const lineY = top + (baseY - top) * (1 - snowLine) * 1.0;
      const spread = (lineY - top) / (baseY - top);
      context.fillStyle = snow;
      context.beginPath();
      context.moveTo(x, top);
      const steps = 7;
      for (let step = 0; step <= steps; step += 1) {
        const t = step / steps;
        const edgeX = x - half * spread * (1 - t) + half * spread * t;
        const drop = (hash(seed + step * 7 + px * 13) - 0.3) * (lineY - top) * 0.45;
        context.lineTo(edgeX, lineY + drop * (step % 2 ? 1 : 0.3));
      }
      context.closePath();
      context.fill();
    }
  }
}

export function pine(context, x, y, size, color = '#2c5a3a', snowy = false) {
  for (let tier = 0; tier < 4; tier += 1) {
    const w = size * (0.55 - tier * 0.1);
    const top = y - size * (0.55 + tier * 0.42);
    const bottom = y - size * (0.1 + tier * 0.4);
    fillPolygon(context, [[x, top], [x + w, bottom], [x - w, bottom]], color);
    if (snowy) fillPolygon(context, [[x, top], [x + w * 0.55, top + (bottom - top) * 0.55], [x - w * 0.55, top + (bottom - top) * 0.55]], 'rgba(255,255,255,0.85)');
  }
  context.fillStyle = '#4a3526';
  context.fillRect(x - size * 0.05, y - size * 0.12, size * 0.1, size * 0.14);
}

export function waterShine(context, width, top, bottom, time, color = 'rgba(255,255,255,0.35)', count = 26) {
  context.strokeStyle = color;
  context.lineWidth = 1.4;
  for (let index = 0; index < count; index += 1) {
    const depth = hash(index * 3.7);
    const y = top + (bottom - top) * depth;
    const x = hash(index * 9.1) * width;
    const length = 14 + depth * 46;
    context.beginPath();
    context.moveTo(x - length / 2 + Math.sin(time * 1.2 + index) * 6, y);
    context.lineTo(x + length / 2 + Math.sin(time * 1.2 + index) * 6, y);
    context.stroke();
  }
}

export function birds(context, width, height, time, count, color = 'rgba(30,30,40,0.7)') {
  context.strokeStyle = color;
  context.lineWidth = 1.5;
  for (let bird = 0; bird < count; bird += 1) {
    const x = (time * (28 + bird * 3) + bird * 120) % (width + 80) - 40;
    const y = height * (0.12 + hash(bird) * 0.18) + Math.sin(time * 2 + bird) * 5;
    const flap = Math.sin(time * 9 + bird * 2) * 4;
    context.beginPath();
    context.moveTo(x - 8, y - flap);
    context.quadraticCurveTo(x - 3, y - 4, x, y);
    context.quadraticCurveTo(x + 3, y - 4, x + 8, y - flap);
    context.stroke();
  }
}

/** The traveller: the player, in a travel jacket, with a daypack's strap and a camera. */
const TRAVEL = { top: '#d97706', bottom: '#3f5a73', shirt: '#fff4dc' };

function placeTraveller(k, data, x, y, pose, time, extra = {}) {
  k.person(x, y, data.look, { pose, expression: 'happy', outfit: TRAVEL, time, ...extra });
}

// ── The places ─────────────────────────────────────────────────────────

/** A cream stone Haussmann block: window rows with balconies and a slate mansard. */
function haussmann(k, x, y, w, d, floors, tools) {
  const { mixColor } = tools;
  k.ground(x - 0.6, y - 0.6, x + w + 0.6, y + d + 0.6, '#bfae92');
  const floorHeight = 0.62;
  const height = floors * floorHeight;
  k.box(x, y, 0, w, d, height, '#e4d6b8');
  k.box(x - 0.05, y - 0.05, height, w + 0.1, d + 0.1, 0.08, '#cdbd9c');
  // The mansard roof, with dormers.
  k.roof(x - 0.05, y - 0.05, height + 0.08, w + 0.1, d + 0.1, 0.9, '#4a5a6e');
  for (let floor = 0; floor < floors; floor += 1) {
    const z = floor * floorHeight + 0.18;
    for (let column = 0; column < Math.max(2, Math.floor(w / 0.75)); column += 1) {
      const wx = x + 0.28 + column * 0.75;
      if (wx + 0.3 > x + w) break;
      // Windows on the face toward the viewer (+y side) and the right (+x side).
      const a = k.iso(wx, y + d, z);
      const b = k.iso(wx + 0.3, y + d, z);
      const c = k.iso(wx + 0.3, y + d, z + 0.38);
      const e = k.iso(wx, y + d, z + 0.38);
      k.polygon([a, b, c, e], hash(floor * 7 + column) > 0.8 ? '#ffd98a' : '#5d7a99');
      if (floor === 1) k.box(wx - 0.04, y + d, z - 0.02, 0.38, 0.06, 0.05, '#2a2a2e');
    }
    for (let row = 0; row < Math.max(1, Math.floor(d / 0.75)); row += 1) {
      const wy = y + 0.28 + row * 0.75;
      if (wy + 0.3 > y + d) break;
      const a = k.iso(x + w, wy, z);
      const b = k.iso(x + w, wy + 0.3, z);
      const c = k.iso(x + w, wy + 0.3, z + 0.38);
      const e = k.iso(x + w, wy, z + 0.38);
      k.polygon([a, b, c, e], mixColor('#5d7a99', '#000000', 0.25));
    }
  }
}

function eiffel(context, base, towerHeight, towerWidth, time) {
  // The silhouette: wide legs sweeping up to a slim spire.
  const halfAt = (u) => towerWidth * (0.12 + 0.88 * Math.pow(1 - u, 2.4)) / 2;
  const points = [];
  const steps = 40;
  for (let step = 0; step <= steps; step += 1) {
    const u = step / steps;
    points.push([base.x - halfAt(u), base.y - towerHeight * u]);
  }
  for (let step = steps; step >= 0; step -= 1) {
    const u = step / steps;
    points.push([base.x + halfAt(u), base.y - towerHeight * u]);
  }
  fillPolygon(context, points, 'rgba(76,60,48,0.55)');
  // The great arch at the foot, cut out.
  context.fillStyle = 'rgba(244,196,140,0.9)';
  context.beginPath();
  context.ellipse(base.x, base.y, towerWidth * 0.22, towerHeight * 0.14, 0, Math.PI, TAU);
  context.fill();
  // Lattice: zig-zag braces between the two edges.
  context.strokeStyle = '#3a2e26';
  context.lineWidth = 1.2;
  context.beginPath();
  const braces = 26;
  for (let step = 0; step < braces; step += 1) {
    const u0 = step / braces * 0.95;
    const u1 = (step + 1) / braces * 0.95;
    const flip = step % 2 ? 1 : -1;
    context.moveTo(base.x + flip * halfAt(u0), base.y - towerHeight * u0);
    context.lineTo(base.x - flip * halfAt(u1), base.y - towerHeight * u1);
    context.moveTo(base.x - halfAt(u0), base.y - towerHeight * u0);
    context.lineTo(base.x - halfAt(u1), base.y - towerHeight * u1);
    context.moveTo(base.x + halfAt(u0), base.y - towerHeight * u0);
    context.lineTo(base.x + halfAt(u1), base.y - towerHeight * u1);
  }
  context.stroke();
  // Platforms.
  context.fillStyle = '#2f251e';
  for (const u of [0.27, 0.56, 0.84]) {
    context.fillRect(base.x - halfAt(u) - 4, base.y - towerHeight * u - 3, halfAt(u) * 2 + 8, 6);
  }
  context.strokeStyle = '#2f251e';
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(base.x, base.y - towerHeight * 0.95);
  context.lineTo(base.x, base.y - towerHeight * 1.12);
  context.stroke();
  // The hourly sparkle.
  for (let index = 0; index < 18; index += 1) {
    const u = hash(index) * 0.9;
    if (Math.sin(time * 6 + index * 2.3) > 0.7) {
      context.fillStyle = '#fff6c4';
      context.beginPath();
      context.arc(base.x + (hash(index + 4) - 0.5) * 2 * halfAt(u), base.y - towerHeight * u, 2.2, 0, TAU);
      context.fill();
    }
  }
}

function paris(context, width, height, time, data, tools) {
  const { kit, sky, tree, mixColor } = tools;
  sky(context, width, height, '#f2a773', '#fde7c2');
  glow(context, width * 0.8, height * 0.32, height * 0.5, 'rgba(255,214,150,0.9)');
  cloud(context, width * 0.2 + Math.sin(time * 0.2) * 20, height * 0.17, 60, 'rgba(255,230,210,0.8)');
  cloud(context, width * 0.55 + Math.sin(time * 0.15) * 20, height * 0.1, 46, 'rgba(255,236,220,0.7)');
  const k = kit(context, width, height, Math.min(width, height * 1.6) / 24, width / 2, height * 0.62);
  // Far skyline.
  context.fillStyle = 'rgba(180,140,120,0.5)';
  for (let index = 0; index < 22; index += 1) context.fillRect(index * width / 22, height * 0.5 - hash(index) * height * 0.08, width / 22 + 1, height * 0.2);
  eiffel(context, { x: width * 0.52, y: height * 0.6 }, height * 0.5, width * 0.2, time);
  // The plaza and the river.
  context.fillStyle = '#c9b79b';
  context.fillRect(0, height * 0.6, width, height * 0.4);
  band(context, width, height * 0.6, height * 0.66, '#7fa2b9', '#6a8ea6');
  waterShine(context, width, height * 0.6, height * 0.66, time, 'rgba(255,240,210,0.5)', 14);
  // A tour boat gliding along.
  const boatX = ((time * 38) % (width + 160)) - 80;
  context.fillStyle = '#f2efe6';
  context.fillRect(boatX, height * 0.625, 70, 11);
  context.fillStyle = '#3a526b';
  for (let window = 0; window < 6; window += 1) context.fillRect(boatX + 6 + window * 10, height * 0.628, 6, 4);
  fillPolygon(context, [[boatX - 6, height * 0.635], [boatX + 76, height * 0.635], [boatX + 66, height * 0.65], [boatX + 6, height * 0.65]], '#2f4258');
  // Cobbles.
  for (let row = 0; row < 12; row += 1) {
    context.fillStyle = row % 2 ? 'rgba(120,100,80,0.18)' : 'rgba(255,255,255,0.12)';
    context.fillRect(0, height * (0.67 + row * 0.028), width, 2);
  }
  // Haussmann blocks framing both sides, with a plane tree each.
  haussmann(k, -9, -4, 3, 2.2, 5, tools);
  haussmann(k, -9, -0.5, 3.4, 2.4, 5, tools);
  haussmann(k, 6, -3.5, 3, 2.2, 5, tools);
  tree(k, context, -4.2, 1.8, { height: 3.6, crown: '#5f8a49' });
  tree(k, context, 4.8, 2.4, { height: 3.4, crown: '#6e944d' });
  // The café: tables, 3D umbrellas, a couple.
  const umbrellas = [['#c8352f', '#f6e8d4'], ['#2f5f9a', '#f6e8d4'], ['#c8352f', '#f6e8d4']];
  const tables = [[-3.2, 4.2], [-1.2, 5.2], [1.2, 4.4]];
  tables.forEach(([x, y], index) => {
    k.box(x - 0.45, y - 0.45, 0.7, 0.9, 0.9, 0.05, '#2a2a2e');
    k.box(x - 0.04, y - 0.04, 0, 0.08, 0.08, 0.7, '#2a2a2e');
    tools.umbrella(context, k, x - 0.8, y - 0.8, 0, umbrellas[index][0], umbrellas[index][1]);
    k.box(x - 0.9, y + 0.3, 0.3, 0.3, 0.3, 0.05, '#5a3d28');
    k.box(x + 0.6, y - 0.1, 0.3, 0.3, 0.3, 0.05, '#5a3d28');
  });
  k.person(-3.5, 4.5, tools.peerLook(data.seed + 41), { pose: 'sitting', expression: 'happy', time, z: 0.3, size: 0.2, outfit: { top: '#6a2e35', bottom: '#2a2a2e', shirt: '#f6efe4' } });
  // The lamp posts, then the traveller crossing, camera up.
  for (const x of [-5.5, 0.2, 5.5]) {
    k.box(x - 0.04, 6.8, 0, 0.08, 0.08, 2.4, '#2a3a2e');
    const lamp = k.iso(x, 6.8, 2.5);
    glow(context, lamp.x, lamp.y, 28, 'rgba(255,230,160,0.7)');
  }
  placeTraveller(k, data, 2.2 - Math.sin(time * 0.5) * 1.2, 6.4, 'walking', time);
  // Pigeons.
  context.fillStyle = '#8a8f98';
  for (let bird = 0; bird < 7; bird += 1) {
    const x = width * (0.3 + hash(bird) * 0.4) + Math.sin(time * 2 + bird) * 4;
    context.beginPath();
    context.ellipse(x, height * (0.9 + hash(bird + 9) * 0.07), 5, 3, 0, 0, TAU);
    context.fill();
  }
  birds(context, width, height, time, 6, 'rgba(60,40,40,0.55)');
  context.fillStyle = mixColor('#f2a773', '#ffffff', 0.5);
  context.globalAlpha = 0.08;
  context.fillRect(0, 0, width, height);
  context.globalAlpha = 1;
}

function pagoda(context, k, x, y, tiers, tools) {
  const { mixColor } = tools;
  for (let tier = 0; tier < tiers; tier += 1) {
    const size = 2.1 - tier * 0.28;
    const z = tier * 1.05;
    k.box(x + (2.1 - size) / 2, y + (2.1 - size) / 2, z, size, size, 0.6, tier % 2 ? '#e9ddc6' : '#f1e7d2');
    // Red railings under the eaves.
    k.box(x + (2.1 - size) / 2 - 0.02, y + (2.1 - size) / 2 + size - 0.03, z + 0.1, size + 0.04, 0.06, 0.06, '#b02a24');
    // The roof: a wide, gently up-turned eave.
    const overhang = 0.4;
    k.roof(x + (2.1 - size) / 2 - overhang, y + (2.1 - size) / 2 - overhang, z + 0.6, size + overhang * 2, size + overhang * 2, 0.34, mixColor('#3d4650', '#000000', tier * 0.04));
  }
  const spire = k.iso(x + 1.05, y + 1.05, tiers * 1.05 + 0.3);
  line(context, spire.x, spire.y, spire.x, spire.y - k.unit * 0.9, '#c9a24a', 3);
}

function torii(k, context, x, y) {
  for (const dy of [0, 1.7]) k.box(x, y + dy, 0, 0.16, 0.16, 2.1, '#c8352f');
  k.box(x - 0.25, y - 0.1, 2.0, 0.55, 2.1, 0.12, '#1f1f24');
  k.box(x - 0.05, y, 1.7, 0.14, 1.9, 0.1, '#c8352f');
}

function kyoto(context, width, height, time, data, tools) {
  const { kit, sky, falling, mixColor } = tools;
  sky(context, width, height, '#c9dff2', '#fbe8ec');
  cloud(context, width * 0.25 + Math.sin(time * 0.2) * 14, height * 0.18, 56, 'rgba(255,255,255,0.8)');
  // Mount Fuji, snow-capped, with a band of cloud across its waist.
  mountains(context, width, height * 0.56, height * 0.46, [[0.62, 1, 0.34]], { rock: '#5a6b8c', lit: '#6e7fa3', shade: '#4a5878', snowLine: 0.45, seed: 4 });
  context.fillStyle = 'rgba(255,255,255,0.55)';
  context.fillRect(0, height * 0.46, width, 7);
  context.fillStyle = 'rgba(255,255,255,0.35)';
  context.fillRect(width * 0.1, height * 0.5, width * 0.6, 5);
  // The lake and Fuji's reflection.
  band(context, width, height * 0.56, height * 0.72, '#8fb4d4', '#6e97b8');
  context.save();
  context.globalAlpha = 0.25;
  context.translate(0, height * 1.12);
  context.scale(1, -1);
  mountains(context, width, height * 0.56, height * 0.2, [[0.62, 1, 0.34]], { rock: '#5a6b8c', lit: '#6e7fa3', shade: '#4a5878', snowLine: 0.45, seed: 4 });
  context.restore();
  waterShine(context, width, height * 0.57, height * 0.71, time, 'rgba(255,255,255,0.35)', 16);
  context.fillStyle = '#7fa65f';
  context.fillRect(0, height * 0.7, width, height * 0.3);
  const k = kit(context, width, height, Math.min(width, height * 1.6) / 24, width / 2, height * 0.62);
  // A stone path and a stream.
  k.ground(-14, 3, 14, 4.4, '#d9ccb4');
  k.ground(-14, 4.4, 14, 5.4, '#7fb6c9');
  // The wooden bridge.
  k.box(-1.8, 4.3, 0.1, 3.6, 1.2, 0.12, '#8a5a36');
  k.box(-1.8, 4.3, 0.22, 3.6, 0.06, 0.4, '#b02a24');
  k.box(-1.8, 5.44, 0.22, 3.6, 0.06, 0.4, '#b02a24');
  pagoda(context, k, 3.4, -4.6, 5, tools);
  torii(k, context, -4.8, 0.2);
  torii(k, context, -6.4, 0.2);
  // Cherry trees in bloom: clouds of pink, with petals on the ground.
  const blossomTrees = [[-8, -2, 4.2], [-3, -4, 3.6], [1, -3, 4], [7.5, 0, 4.4], [-7.5, 5, 3.4], [6.5, 6, 3.6]];
  for (const [x, y, size] of blossomTrees) {
    k.box(x - 0.1, y - 0.1, 0, 0.2, 0.2, size * 0.5, '#4a3328');
    const top = k.iso(x, y, size * 0.55);
    for (let puff = 0; puff < 9; puff += 1) {
      const angle = puff / 9 * TAU;
      context.fillStyle = puff % 2 ? '#f6bfd0' : '#f9d3de';
      context.beginPath();
      context.arc(top.x + Math.cos(angle) * k.unit * 0.8, top.y - k.unit * 0.5 + Math.sin(angle) * k.unit * 0.45, k.unit * 0.55, 0, TAU);
      context.fill();
    }
    context.fillStyle = '#fbe0e8';
    context.beginPath();
    context.arc(top.x, top.y - k.unit * 0.55, k.unit * 0.65, 0, TAU);
    context.fill();
  }
  // A stone lantern.
  k.box(2.1, 2, 0, 0.35, 0.35, 0.2, '#9a9a94');
  k.box(2.15, 2.05, 0.2, 0.25, 0.25, 0.5, '#aeaea6');
  k.box(2.05, 1.95, 0.7, 0.45, 0.45, 0.14, '#8a8a84');
  const lantern = k.iso(2.3, 2.25, 0.5);
  glow(context, lantern.x, lantern.y, 18, 'rgba(255,220,150,0.65)');
  placeTraveller(k, data, -1.2 + Math.min(2.4, time * 0.5), 4.9, 'walking', time, { z: 0.22 });
  falling(context, width, height, time, ['#f9d3de', '#ffffff', '#f6bfd0'], { count: 70, speed: 45, size: 6 });
  context.fillStyle = mixColor('#fbe8ec', '#ffffff', 0.4);
  context.globalAlpha = 0.07;
  context.fillRect(0, 0, width, height);
  context.globalAlpha = 1;
}

function chalet(k, x, y, tools) {
  const { mixColor } = tools;
  k.box(x, y, 0, 2.4, 1.8, 0.9, '#d8c4a0');
  k.box(x, y, 0.9, 2.4, 1.8, 0.8, '#8a5a36');
  k.roof(x - 0.35, y - 0.3, 1.7, 3.1, 2.4, 1.0, '#6b3a2a');
  // Balcony with flower boxes.
  k.box(x - 0.02, y + 1.8, 0.95, 2.44, 0.08, 0.3, '#6b4529');
  k.box(x + 0.3, y + 1.78, 1.2, 0.5, 0.12, 0.12, '#d6336c');
  k.box(x + 1.5, y + 1.78, 1.2, 0.5, 0.12, 0.12, '#f08c00');
  for (let window = 0; window < 2; window += 1) {
    const a = k.iso(x + 0.4 + window * 1.2, y + 1.8, 0.2);
    const b = k.iso(x + 0.95 + window * 1.2, y + 1.8, 0.2);
    const c = k.iso(x + 0.95 + window * 1.2, y + 1.8, 0.7);
    const d = k.iso(x + 0.4 + window * 1.2, y + 1.8, 0.7);
    k.polygon([a, b, c, d], mixColor('#ffd98a', '#ffffff', 0.1));
  }
  k.box(x + 2.0, y + 0.1, 1.6, 0.3, 0.3, 0.6, '#7a4a38');
}

function alps(context, width, height, time, data, tools) {
  const { kit, sky } = tools;
  sky(context, width, height, '#5aa7e6', '#cfe8fb');
  cloud(context, width * 0.3 + time * 6 % 40, height * 0.16, 60);
  cloud(context, width * 0.7 - time * 4 % 40, height * 0.1, 44);
  // Three ranges, each paler with distance, the near one with a glacier.
  mountains(context, width, height * 0.62, height * 0.5, [[0.18, 0.9, 0.24], [0.45, 1, 0.3], [0.78, 0.82, 0.26]], { rock: '#7d8fa8', lit: '#93a4bb', shade: '#677a95', snowLine: 0.6, seed: 2 });
  mountains(context, width, height * 0.68, height * 0.34, [[0.05, 0.9, 0.25], [0.34, 0.7, 0.22], [0.62, 1, 0.28], [0.95, 0.75, 0.22]], { rock: '#566a86', lit: '#6b7f9b', shade: '#46586f', snowLine: 0.5, seed: 8 });
  // The lake.
  band(context, width, height * 0.66, height * 0.78, '#4aa8c4', '#2a7f9f');
  waterShine(context, width, height * 0.67, height * 0.77, time, 'rgba(255,255,255,0.4)', 18);
  // Forest on the far shore.
  for (let tree = 0; tree < 46; tree += 1) pine(context, tree * width / 46 + hash(tree) * 14, height * 0.68 + hash(tree + 3) * 6, 20 + hash(tree + 5) * 12, hash(tree) > 0.5 ? '#2c5a3a' : '#264f33');
  // The meadow.
  band(context, width, height * 0.76, height, '#76b05b', '#4f8c3f');
  // The cable car: a cable up to a station, a gondola riding it.
  const start = { x: width * 0.08, y: height * 0.74 };
  const end = { x: width * 0.62, y: height * 0.2 };
  line(context, start.x, start.y, end.x, end.y, '#2a2a2e', 1.5);
  const progress = (Math.sin(time * 0.5) + 1) / 2;
  const gx = start.x + (end.x - start.x) * progress;
  const gy = start.y + (end.y - start.y) * progress;
  line(context, gx, gy, gx, gy + 12, '#2a2a2e', 1.5);
  fillPolygon(context, [[gx - 14, gy + 12], [gx + 14, gy + 12], [gx + 12, gy + 30], [gx - 12, gy + 30]], '#c8352f');
  context.fillStyle = '#bfe0f4';
  context.fillRect(gx - 10, gy + 16, 20, 9);
  const k = kit(context, width, height, Math.min(width, height * 1.6) / 24, width / 2, height * 0.74);
  chalet(k, -6.4, -0.6, tools);
  chalet(k, 4.6, -1.2, tools);
  // A pine wood and a rail fence.
  for (let index = 0; index < 8; index += 1) {
    const p = k.iso(-3 + index * 0.7, -2 + hash(index) * 0.6);
    pine(context, p.x, p.y, k.unit * (1.3 + hash(index + 2) * 0.6), '#2a5836', true);
  }
  for (let post = 0; post < 14; post += 1) k.box(-3.2 + post * 0.5, 3.4, 0, 0.07, 0.07, 0.5, '#7a5a3c');
  k.box(-3.2, 3.42, 0.2, 6.9, 0.04, 0.05, '#8a6a4a');
  k.box(-3.2, 3.42, 0.38, 6.9, 0.04, 0.05, '#8a6a4a');
  // Wildflowers and cows.
  for (let flower = 0; flower < 40; flower += 1) {
    const p = k.iso(-8 + hash(flower) * 16, 2 + hash(flower + 6) * 5);
    context.fillStyle = ['#ffffff', '#f6d54a', '#d6336c', '#7aa7ff'][flower % 4];
    context.beginPath();
    context.arc(p.x, p.y, 2, 0, TAU);
    context.fill();
  }
  for (const [x, y] of [[-4.5, 4.5], [5, 5.4]]) {
    const cow = k.iso(x, y);
    context.fillStyle = '#f4f1ea';
    context.fillRect(cow.x - 14, cow.y - 18, 28, 13);
    context.fillStyle = '#2a2a2e';
    context.fillRect(cow.x - 6, cow.y - 17, 8, 7);
    context.fillRect(cow.x + 10, cow.y - 22, 8, 8);
    context.fillRect(cow.x - 11, cow.y - 6, 3, 7);
    context.fillRect(cow.x + 7, cow.y - 6, 3, 7);
  }
  // A paraglider, high up.
  const glider = { x: width * 0.78 + Math.sin(time * 0.5) * 30, y: height * 0.3 + Math.cos(time * 0.4) * 8 };
  context.fillStyle = '#e5484d';
  context.beginPath();
  context.ellipse(glider.x, glider.y, 24, 7, -0.1, 0, TAU);
  context.fill();
  line(context, glider.x - 14, glider.y + 4, glider.x, glider.y + 22, '#2a2a2e', 1);
  line(context, glider.x + 14, glider.y + 4, glider.x, glider.y + 22, '#2a2a2e', 1);
  placeTraveller(k, data, -0.8 + time * 0.35, 4.2, 'walking', time);
}

function pyramid(context, x, baseY, half, rise, colors) {
  const top = [x, baseY - rise];
  fillPolygon(context, [[x - half, baseY], top, [x + half * 0.15, baseY]], colors.lit);
  fillPolygon(context, [top, [x + half, baseY], [x + half * 0.15, baseY]], colors.shade);
  context.strokeStyle = 'rgba(90,60,30,0.28)';
  context.lineWidth = 1;
  for (let course = 1; course < 14; course += 1) {
    const y = baseY - rise * course / 14;
    const spread = half * (1 - course / 14);
    context.beginPath();
    context.moveTo(x - spread, y);
    context.lineTo(x + spread * 0.15 + 0, y);
    context.stroke();
  }
}

function camel(context, x, y, size, time, phase) {
  const step = Math.sin(time * 3 + phase);
  context.fillStyle = '#b98a54';
  context.beginPath();
  context.ellipse(x, y - size * 0.7, size * 0.55, size * 0.28, 0, 0, TAU);
  context.fill();
  context.beginPath();
  context.ellipse(x - size * 0.12, y - size * 1.0, size * 0.18, size * 0.2, 0, 0, TAU);
  context.fill();
  context.lineWidth = size * 0.14;
  context.strokeStyle = '#b98a54';
  context.lineCap = 'round';
  context.beginPath();
  context.moveTo(x + size * 0.45, y - size * 0.8);
  context.quadraticCurveTo(x + size * 0.7, y - size * 1.2, x + size * 0.78, y - size * 1.45);
  context.stroke();
  context.beginPath();
  context.ellipse(x + size * 0.86, y - size * 1.46, size * 0.15, size * 0.1, 0.3, 0, TAU);
  context.fill();
  context.lineWidth = size * 0.09;
  for (const [dx, swing] of [[-0.35, step], [-0.15, -step], [0.2, -step], [0.4, step]]) {
    context.beginPath();
    context.moveTo(x + dx * size, y - size * 0.55);
    context.lineTo(x + dx * size + swing * size * 0.2, y);
    context.stroke();
  }
  context.lineCap = 'butt';
  // A rider in white.
  context.fillStyle = '#f6f2ea';
  context.fillRect(x - size * 0.1, y - size * 1.35, size * 0.2, size * 0.4);
  context.fillStyle = '#d9a67a';
  context.beginPath();
  context.arc(x, y - size * 1.42, size * 0.1, 0, TAU);
  context.fill();
}

function egypt(context, width, height, time, data, tools) {
  const { kit, sky, tree } = tools;
  sky(context, width, height, '#f0b779', '#fbe6b8');
  glow(context, width * 0.2, height * 0.26, height * 0.6, 'rgba(255,236,170,0.9)');
  context.fillStyle = '#fff3c4';
  context.beginPath();
  context.arc(width * 0.2, height * 0.26, height * 0.07, 0, TAU);
  context.fill();
  // Distant dunes, then the three pyramids.
  const duneLayer = (baseY, amp, color, seed, speed = 0) => {
    context.fillStyle = color;
    context.beginPath();
    context.moveTo(0, height);
    for (let x = 0; x <= width + 10; x += 10) context.lineTo(x, baseY + Math.sin(x / width * 5 + seed) * amp + Math.sin(x / width * 13 + seed * 2 + time * speed) * amp * 0.25);
    context.lineTo(width, height);
    context.fill();
  };
  duneLayer(height * 0.58, 10, '#e6bf86', 1);
  const colors = { lit: '#e9c58a', shade: '#b98a54' };
  pyramid(context, width * 0.62, height * 0.62, width * 0.19, height * 0.34, colors);
  pyramid(context, width * 0.82, height * 0.62, width * 0.13, height * 0.23, colors);
  pyramid(context, width * 0.44, height * 0.62, width * 0.08, height * 0.14, colors);
  duneLayer(height * 0.66, 14, '#ddb277', 3, 0.05);
  // The Sphinx, side on.
  const sx = width * 0.3;
  const sy = height * 0.72;
  fillPolygon(context, [[sx - 70, sy], [sx - 66, sy - 22], [sx - 20, sy - 30], [sx + 8, sy - 26], [sx + 30, sy - 10], [sx + 34, sy]], '#c99a5e');
  fillPolygon(context, [[sx + 12, sy - 26], [sx + 26, sy - 52], [sx + 44, sy - 52], [sx + 52, sy - 26], [sx + 40, sy - 16], [sx + 24, sy - 18]], '#d6a96a');
  fillPolygon(context, [[sx + 22, sy - 52], [sx + 34, sy - 60], [sx + 48, sy - 52], [sx + 40, sy - 26], [sx + 16, sy - 26]], '#b98a54');
  context.fillStyle = '#7a4a2a';
  context.fillRect(sx + 41, sy - 41, 3, 3);
  context.fillStyle = '#c99a5e';
  context.fillRect(sx + 28, sy - 4, 52, 6);
  duneLayer(height * 0.78, 12, '#d4a566', 6, 0.08);
  const k = kit(context, width, height, Math.min(width, height * 1.6) / 24, width / 2, height * 0.8);
  // The caravan crossing, camel after camel.
  for (let index = 0; index < 3; index += 1) {
    const x = ((time * 26 + index * 150) % (width + 300)) - 150;
    camel(context, x, height * 0.76 + index * 3, 38 - index * 4, time, index);
  }
  // An oasis: water, palms, a tent.
  const pond = k.iso(5.4, 1.6);
  context.fillStyle = '#4fb3c8';
  context.beginPath();
  context.ellipse(pond.x, pond.y, k.unit * 1.9, k.unit * 0.8, 0, 0, TAU);
  context.fill();
  waterShine(context, width, pond.y - 8, pond.y + 8, time, 'rgba(255,255,255,0.5)', 5);
  for (const [x, y] of [[4.2, 0.4], [6.4, 0.6], [6.8, 2.2], [3.8, 2.4]]) tree(k, context, x, y, { palm: true, crown: '#3a7a35', trunk: '#8a6a42', height: 3.4 });
  k.box(-6.8, 1.6, 0, 1.8, 1.4, 0.7, '#f2e6cc');
  k.roof(-6.9, 1.5, 0.7, 2.0, 1.6, 0.7, '#e6d2a8');
  placeTraveller(k, data, -2 + Math.min(3, time * 0.6), 3.4, 'walking', time, { outfit: { top: '#f4efe4', bottom: '#b98a54', shirt: '#f4efe4' } });
  // Wind-blown sand.
  context.fillStyle = 'rgba(240,210,150,0.35)';
  for (let grain = 0; grain < 50; grain += 1) context.fillRect((hash(grain) * width + time * 120 * (0.5 + hash(grain + 3))) % width, height * (0.7 + hash(grain + 8) * 0.28), 6, 1.4);
  birds(context, width, height, time, 3, 'rgba(60,40,30,0.6)');
}

function bungalow(k, x, y, tools) {
  const { mixColor } = tools;
  for (const [dx, dy] of [[0.1, 0.1], [2.3, 0.1], [0.1, 1.9], [2.3, 1.9]]) k.box(x + dx, y + dy, -0.7, 0.12, 0.12, 0.8, '#6a4c30');
  k.box(x - 0.2, y - 0.2, 0.1, 3.0, 2.6, 0.12, '#9a7650');
  k.box(x + 0.3, y + 0.2, 0.22, 1.9, 1.6, 0.8, '#efe2c6');
  const a = k.iso(x + 0.6, y + 1.8, 0.38);
  const b = k.iso(x + 1.5, y + 1.8, 0.38);
  const c = k.iso(x + 1.5, y + 1.8, 0.85);
  const d = k.iso(x + 0.6, y + 1.8, 0.85);
  k.polygon([a, b, c, d], '#ffd98a');
  // The thatched pyramid roof.
  const peak = k.iso(x + 1.25, y + 1.0, 1.9);
  k.polygon([k.iso(x + 0.1, y + 2.0, 1.0), k.iso(x + 2.4, y + 2.0, 1.0), peak], mixColor('#b78a4a', '#ffffff', 0.05));
  k.polygon([k.iso(x + 2.4, y + 0.0, 1.0), k.iso(x + 2.4, y + 2.0, 1.0), peak], mixColor('#8a6532', '#000000', 0.12));
  k.polygon([k.iso(x + 0.1, y + 0.0, 1.0), k.iso(x + 0.1, y + 2.0, 1.0), peak], mixColor('#a07a40', '#000000', 0.05));
  // A little deck with loungers.
  k.box(x + 0.4, y + 2.0, 0.22, 0.9, 0.35, 0.1, '#e6d9bf');
}

function island(context, width, height, time, data, tools) {
  const { kit, tree } = tools;
  // A sky on the turn: orange horizon, violet above.
  const sky = context.createLinearGradient(0, 0, 0, height * 0.55);
  sky.addColorStop(0, '#5a4a9a');
  sky.addColorStop(0.55, '#e0708a');
  sky.addColorStop(1, '#ffc98a');
  context.fillStyle = sky;
  context.fillRect(0, 0, width, height);
  glow(context, width * 0.7, height * 0.48, height * 0.45, 'rgba(255,214,140,0.9)');
  context.fillStyle = '#fff1c4';
  context.beginPath();
  context.arc(width * 0.7, height * 0.5, height * 0.06, 0, TAU);
  context.fill();
  cloud(context, width * 0.25, height * 0.2, 60, 'rgba(255,170,150,0.6)');
  cloud(context, width * 0.55, height * 0.3, 44, 'rgba(255,190,160,0.55)');
  // The lagoon: turquoise near, deep further out, the sun's road on it.
  band(context, width, height * 0.52, height, '#3ec5c0', '#0e7f9a');
  band(context, width, height * 0.52, height * 0.62, '#ffb48a', 'rgba(255,180,140,0)');
  context.fillStyle = 'rgba(255,230,170,0.45)';
  for (let glint = 0; glint < 14; glint += 1) {
    const y = height * (0.53 + glint * 0.016);
    const w = 10 + glint * 9 + Math.sin(time * 2 + glint) * 5;
    context.fillRect(width * 0.7 - w / 2, y, w, 2);
  }
  waterShine(context, width, height * 0.6, height * 0.98, time, 'rgba(255,255,255,0.3)', 30);
  // Coral shallows.
  for (let patch = 0; patch < 6; patch += 1) {
    context.fillStyle = 'rgba(120,230,210,0.32)';
    context.beginPath();
    context.ellipse(width * (0.1 + patch * 0.16), height * (0.78 + hash(patch) * 0.1), 60 + hash(patch + 2) * 40, 12, 0, 0, TAU);
    context.fill();
  }
  // A sailboat on the horizon.
  const sail = { x: width * 0.38 + Math.sin(time * 0.3) * 20, y: height * 0.55 };
  fillPolygon(context, [[sail.x - 18, sail.y], [sail.x + 18, sail.y], [sail.x + 12, sail.y + 6], [sail.x - 12, sail.y + 6]], '#f6efe4');
  fillPolygon(context, [[sail.x, sail.y - 36], [sail.x, sail.y - 2], [sail.x + 18, sail.y - 4]], '#ffffff');
  fillPolygon(context, [[sail.x - 2, sail.y - 28], [sail.x - 2, sail.y - 3], [sail.x - 14, sail.y - 4]], '#ffd9c0');
  // Dolphins arcing out of the swell.
  for (let dolphin = 0; dolphin < 2; dolphin += 1) {
    const phase = (time * 0.35 + dolphin * 0.5) % 1;
    const x = width * (0.18 + dolphin * 0.2) + phase * 80;
    const y = height * 0.66 - Math.sin(phase * Math.PI) * 38;
    if (phase < 0.6) {
      context.save();
      context.translate(x, y);
      context.rotate(Math.cos(phase / 0.6 * Math.PI) * -0.9);
      context.fillStyle = '#6f8ca6';
      context.beginPath();
      context.ellipse(0, 0, 18, 6, 0, 0, TAU);
      context.fill();
      fillPolygon(context, [[-14, 0], [-24, -8], [-22, 4]], '#6f8ca6');
      context.restore();
    }
  }
  const k = kit(context, width, height, Math.min(width, height * 1.6) / 24, width / 2, height * 0.72);
  // The boardwalk out over the water, and the bungalows along it.
  k.box(-9, 2.3, 0.05, 18, 1.0, 0.14, '#a8825a');
  for (let post = 0; post < 18; post += 1) k.box(-9 + post, 2.25, -0.4, 0.1, 0.1, 0.5, '#6a4c30');
  for (let plank = 0; plank < 36; plank += 1) k.box(-9 + plank * 0.5, 2.3, 0.19, 0.04, 1.0, 0.01, '#8a6a46');
  k.box(-9, 2.28, 0.2, 18, 0.05, 0.5, '#e6d9bf');
  bungalow(k, -8, -0.6, tools);
  bungalow(k, -4.2, -1.8, tools);
  bungalow(k, 2.2, -1.9, tools);
  bungalow(k, 6, -0.7, tools);
  for (const x of [-7, -3, 3, 7]) {
    const lamp = k.iso(x, 2.35, 0.9);
    glow(context, lamp.x, lamp.y, 18, 'rgba(255,214,150,0.75)');
  }
  // Palms leaning in from the left.
  tree(k, context, -9.5, 2.9, { palm: true, crown: '#2f7d3b', trunk: '#8a6a42', height: 4.6 });
  tree(k, context, -8.6, 3.4, { palm: true, crown: '#3a8a45', trunk: '#8a6a42', height: 3.8 });
  placeTraveller(k, data, -1 + Math.min(4, time * 0.9), 2.7, 'walking', time, { z: 0.2 });
  birds(context, width, height, time, 5, 'rgba(70,40,60,0.7)');
  // The first stars.
  context.fillStyle = 'rgba(255,255,255,0.8)';
  for (let star = 0; star < 24; star += 1) {
    if (Math.sin(time * 2 + star) > -0.2) context.fillRect(hash(star) * width, hash(star + 5) * height * 0.22, 2, 2);
  }
}

function santorini(context, width, height, time, data, tools) {
  const { kit, sky, mixColor } = tools;
  sky(context, width, height, '#3b8fe0', '#cbe6fb');
  cloud(context, width * 0.22, height * 0.15, 54, 'rgba(255,255,255,0.9)');
  cloud(context, width * 0.7 + Math.sin(time * 0.2) * 14, height * 0.22, 40, 'rgba(255,255,255,0.8)');
  // The Aegean and a small island out in it.
  band(context, width, height * 0.42, height, '#1c6fb5', '#0a4a8a');
  waterShine(context, width, height * 0.43, height * 0.69, time, 'rgba(255,255,255,0.4)', 24);
  fillPolygon(context, [[width * 0.62, height * 0.42], [width * 0.7, height * 0.37], [width * 0.8, height * 0.42]], '#9a8f7e');
  // A white sailing boat.
  const boatX = (time * 18) % (width + 120) - 60;
  fillPolygon(context, [[boatX - 20, height * 0.52], [boatX + 22, height * 0.52], [boatX + 14, height * 0.545], [boatX - 14, height * 0.545]], '#f6efe4');
  fillPolygon(context, [[boatX + 2, height * 0.52 - 40], [boatX + 2, height * 0.52 - 2], [boatX + 22, height * 0.52 - 4]], '#ffffff');
  // The cliff and the whitewashed town climbing it.
  fillPolygon(context, [[0, height * 0.52], [width * 0.18, height * 0.5], [width * 0.4, height * 0.62], [width * 0.6, height], [0, height]], '#8a6a52');
  const k = kit(context, width, height, Math.min(width, height * 1.6) / 23, width * 0.46, height * 0.72);
  const blocks = [
    [-7, -4, 2.2, 2, 1.5], [-5, -3.2, 2.4, 1.8, 1.2], [-2.6, -2.4, 2.2, 1.8, 1.7], [-4.5, -0.8, 2.6, 1.8, 1.1],
    [-1.6, -0.2, 2.4, 2, 1.3], [0.6, 0.4, 2.6, 1.8, 1.0], [-6.4, 1.4, 2, 1.6, 0.9],
  ];
  for (const [x, y, w, d, h] of blocks) {
    k.box(x, y, 0, w, d, h, '#f7f4ec');
    k.box(x - 0.04, y - 0.04, h, w + 0.08, d + 0.08, 0.1, '#e8e2d2');
    for (let window = 0; window < 2; window += 1) {
      const a = k.iso(x + 0.3 + window * 0.9, y + d, 0.3);
      const b = k.iso(x + 0.7 + window * 0.9, y + d, 0.3);
      const c = k.iso(x + 0.7 + window * 0.9, y + d, 0.8);
      const e = k.iso(x + 0.3 + window * 0.9, y + d, 0.8);
      k.polygon([a, b, c, e], '#2c6fb0');
    }
  }
  // Blue domes and the bell tower.
  for (const [x, y, size, roof] of [[-1.6, -0.2, 1.1, 1.3], [-5, -3.2, 0.9, 1.2], [0.6, 0.4, 0.8, 1.0]]) {
    const c = k.iso(x + 1.1, y + 0.9, roof + 0.1);
    context.fillStyle = '#1f6fc4';
    context.beginPath();
    context.arc(c.x, c.y, k.unit * size * 0.55, Math.PI, 0);
    context.fill();
    context.fillStyle = mixColor('#1f6fc4', '#ffffff', 0.3);
    context.beginPath();
    context.arc(c.x - k.unit * size * 0.15, c.y - k.unit * size * 0.15, k.unit * size * 0.2, Math.PI, 1.6 * Math.PI);
    context.fill();
    context.strokeStyle = '#ffffff';
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(c.x, c.y - k.unit * size * 0.55);
    context.lineTo(c.x, c.y - k.unit * size * 0.8);
    context.moveTo(c.x - 4, c.y - k.unit * size * 0.68);
    context.lineTo(c.x + 4, c.y - k.unit * size * 0.68);
    context.stroke();
  }
  k.box(-7.2, -4.4, 1.5, 0.9, 0.9, 1.6, '#f7f4ec');
  const bell = k.iso(-6.75, -3.95, 3.1);
  context.fillStyle = '#1f6fc4';
  context.beginPath();
  context.arc(bell.x, bell.y, k.unit * 0.5, Math.PI, 0);
  context.fill();
  // Bougainvillea spilling over the walls.
  for (let cluster = 0; cluster < 26; cluster += 1) {
    const p = k.iso(-7 + hash(cluster) * 9, -3 + hash(cluster + 4) * 4.5, 0.5 + hash(cluster + 9) * 1.2);
    context.fillStyle = cluster % 3 ? '#d6336c' : '#f06595';
    context.beginPath();
    context.arc(p.x, p.y, 4 + hash(cluster + 2) * 4, 0, TAU);
    context.fill();
  }
  // A terrace with a table, and the traveller at it, with the view.
  k.ground(1.2, 2.4, 6.5, 6, '#e8e0cf');
  k.box(3.2, 3.8, 0, 0.9, 0.9, 0.72, '#f7f4ec');
  k.box(3.1, 3.7, 0.72, 1.1, 1.1, 0.05, '#2a5a8c');
  tools.umbrella(context, k, 3.8, 3.2, 0, '#ffffff', '#1f6fc4');
  placeTraveller(k, data, 2.6, 4.9, 'sitting', time, { z: 0.3, outfit: { top: '#ffffff', bottom: '#2a5a8c', shirt: '#ffffff' } });
  // Steps down to the sea, and a windmill.
  for (let step = 0; step < 8; step += 1) k.box(5.4 + step * 0.3, 0.2 + step * 0.2, -step * 0.12, 1.0, 0.4, 0.12, '#e8e0cf');
  birds(context, width, height, time, 4, 'rgba(255,255,255,0.8)');
  context.fillStyle = 'rgba(255,200,120,0.1)';
  context.fillRect(0, 0, width, height);
}

function aurora(context, width, height, time, data, tools) {
  const { kit } = tools;
  const night = context.createLinearGradient(0, 0, 0, height * 0.72);
  night.addColorStop(0, '#050a1e');
  night.addColorStop(1, '#14284a');
  context.fillStyle = night;
  context.fillRect(0, 0, width, height);
  // Stars, a few twinkling.
  for (let star = 0; star < 120; star += 1) {
    const twinkle = 0.5 + 0.5 * Math.sin(time * (1 + hash(star)) + star);
    context.fillStyle = `rgba(255,255,255,${0.35 + 0.55 * twinkle})`;
    context.fillRect(hash(star) * width, hash(star + 7) * height * 0.55, 1 + hash(star + 2) * 1.6, 1 + hash(star + 2) * 1.6);
  }
  // The aurora: curtains of green and violet, rippling.
  for (let curtain = 0; curtain < 3; curtain += 1) {
    const colors = [['rgba(80,255,170,0.0)', 'rgba(80,255,170,0.55)', 'rgba(60,200,255,0.0)'], ['rgba(120,255,200,0.0)', 'rgba(150,255,120,0.45)', 'rgba(255,255,255,0)'], ['rgba(180,120,255,0.0)', 'rgba(200,120,255,0.4)', 'rgba(255,255,255,0)']][curtain];
    const baseY = height * (0.34 + curtain * 0.04);
    for (let x = 0; x < width; x += 6) {
      const wave = Math.sin(x / width * 5 + time * 0.6 + curtain * 2) * 26 + Math.sin(x / width * 13 - time * 0.9 + curtain) * 10;
      const reach = (120 + Math.sin(x / width * 7 + time * 0.5 + curtain) * 60) * (1 - curtain * 0.2);
      const gradient = context.createLinearGradient(0, baseY + wave - reach, 0, baseY + wave);
      gradient.addColorStop(0, colors[0]);
      gradient.addColorStop(0.65, colors[1]);
      gradient.addColorStop(1, colors[2]);
      context.fillStyle = gradient;
      context.fillRect(x, baseY + wave - reach, 7, reach);
    }
  }
  // Moonlit mountains.
  mountains(context, width, height * 0.66, height * 0.36, [[0.12, 0.8, 0.26], [0.4, 1, 0.3], [0.7, 0.85, 0.26], [0.95, 0.7, 0.22]], { rock: '#16243e', lit: '#22345a', shade: '#101b32', snow: '#cfe0ff', snowLine: 0.5, seed: 5 });
  // The frozen lake, mirroring the sky.
  band(context, width, height * 0.66, height, '#10213f', '#0a1428');
  context.save();
  context.globalAlpha = 0.25;
  for (let x = 0; x < width; x += 6) {
    const wave = Math.sin(x / width * 5 + time * 0.6) * 12;
    context.fillStyle = 'rgba(80,255,170,0.7)';
    context.fillRect(x, height * 0.68 + wave * 0.3, 7, 44 + Math.sin(x / width * 7 + time * 0.5) * 20);
  }
  context.restore();
  context.strokeStyle = 'rgba(200,220,255,0.25)';
  context.lineWidth = 1;
  for (let crack = 0; crack < 8; crack += 1) {
    context.beginPath();
    context.moveTo(hash(crack) * width, height * 0.8);
    context.lineTo(hash(crack + 1) * width, height);
    context.stroke();
  }
  // Snowy pines on the shore.
  for (let tree = 0; tree < 16; tree += 1) pine(context, hash(tree) * width, height * (0.67 + hash(tree + 2) * 0.03), 22 + hash(tree + 4) * 20, '#12302a', true);
  const k = kit(context, width, height, Math.min(width, height * 1.6) / 24, width / 2, height * 0.8);
  // A log cabin with a warm window and smoke.
  k.box(-6, -0.5, 0, 3, 2.2, 1.2, '#7a4a2e');
  for (let log = 0; log < 5; log += 1) k.box(-6, 1.7, 0.1 + log * 0.24, 3, 0.05, 0.03, '#5a3320');
  k.roof(-6.3, -0.8, 1.2, 3.6, 2.8, 0.9, '#e8f0ff');
  const window = [k.iso(-5.5, 1.7, 0.4), k.iso(-4.8, 1.7, 0.4), k.iso(-4.8, 1.7, 0.95), k.iso(-5.5, 1.7, 0.95)];
  k.polygon(window, '#ffc15a');
  glow(context, window[0].x + 12, window[0].y - 12, 48, 'rgba(255,190,90,0.5)');
  k.box(-3.7, 0.2, 1.2, 0.35, 0.35, 0.9, '#5a3320');
  const chimney = k.iso(-3.5, 0.4, 2.2);
  for (let puff = 0; puff < 5; puff += 1) {
    const age = ((time * 0.4) + puff / 5) % 1;
    context.fillStyle = `rgba(220,230,245,${0.4 * (1 - age)})`;
    context.beginPath();
    context.arc(chimney.x + age * 26 + Math.sin(age * 6) * 4, chimney.y - age * 70, 5 + age * 12, 0, TAU);
    context.fill();
  }
  // A campfire with sparks, and a sled with a husky.
  const fire = k.iso(1.6, 3.4);
  glow(context, fire.x, fire.y - 8, 70, 'rgba(255,170,60,0.55)');
  for (let flame = 0; flame < 3; flame += 1) {
    context.fillStyle = ['#ff7b2a', '#ffb02e', '#ffe08a'][flame];
    context.beginPath();
    context.moveTo(fire.x - 9 + flame * 3, fire.y);
    context.quadraticCurveTo(fire.x + Math.sin(time * 8 + flame) * 4, fire.y - 24 + flame * 5, fire.x + 9 - flame * 3, fire.y);
    context.fill();
  }
  for (let spark = 0; spark < 8; spark += 1) {
    const age = (time * 0.8 + spark / 8) % 1;
    context.fillStyle = `rgba(255,200,100,${1 - age})`;
    context.fillRect(fire.x + Math.sin(spark * 3) * 10 * age, fire.y - 20 - age * 50, 2, 2);
  }
  k.box(2.7, 3.2, 0, 1.4, 0.5, 0.12, '#6a4a2e');
  placeTraveller(k, data, 0.3, 3.8, 'standing', time, { outfit: { top: '#c8352f', bottom: '#2a3550', shirt: '#2a3550' } });
  // A steaming mug.
  const hand = k.iso(0.55, 3.6, 1.2);
  context.strokeStyle = 'rgba(255,255,255,0.5)';
  context.lineWidth = 1.5;
  context.beginPath();
  context.moveTo(hand.x, hand.y);
  context.quadraticCurveTo(hand.x + 5 + Math.sin(time * 3) * 3, hand.y - 8, hand.x, hand.y - 16);
  context.stroke();
}

// ── The sequence ───────────────────────────────────────────────────────

export const WORLD_PLACES = [
  { id: 'paris', name: 'Paris, France', line: 'Paris at golden hour. The tower sparkles on the hour.', draw: paris },
  { id: 'kyoto', name: 'Kyoto, Japan', line: 'Fuji in cherry blossom, and a pagoda that has seen it all.', draw: kyoto },
  { id: 'alps', name: 'The Swiss Alps', line: 'A gondola up through the pines, a lake like glass.', draw: alps },
  { id: 'egypt', name: 'Giza, Egypt', line: 'Camels, sand and stone older than any org chart.', draw: egypt },
  { id: 'island', name: 'The Maldives', line: 'An overwater bungalow, a beach with no Wi-Fi.', draw: island },
  { id: 'santorini', name: 'Santorini, Greece', line: 'White walls, blue domes, and nowhere to be.', draw: santorini },
  { id: 'aurora', name: 'Lapland, Finland', line: 'The sky itself puts on a show. No one has a ticket.', draw: aurora },
];

/** How many places a retirement visits, and how long each stays on screen. */
export const WORLD_STOPS = 5;
export const WORLD_STOP_SECONDS = 3.6;
export const WORLD_INTRO_SECONDS = 0;

/** The route for a career: the places shuffled by its seed, the first few kept. */
export function worldRoute(seed) {
  const order = WORLD_PLACES.map((place, index) => ({ place, key: hash(seed * 0.37 + index * 5.1) }));
  order.sort((a, b) => a.key - b.key);
  return order.slice(0, WORLD_STOPS).map((entry) => entry.place);
}

/**
 * Draw the FIRE scene at a moment: first the flight across a map, then each
 * stop of the route, cross-fading, with its name stamped on like a passport.
 */
export function drawWorldTour(context, width, height, time, data, tools) {
  const route = worldRoute(data.seed ?? 1);
  const since = time - WORLD_INTRO_SECONDS;
  const index = Math.min(route.length - 1, Math.floor(since / WORLD_STOP_SECONDS));
  const local = since - index * WORLD_STOP_SECONDS;
  const place = route[index];
  place.draw(context, width, height, time, data, tools);
  // Fade in from and out to black, and the passport stamp.
  const fade = Math.max(0, 1 - local / 0.5, (local - (WORLD_STOP_SECONDS - 0.45)) / 0.45);
  if (fade > 0) {
    context.fillStyle = `rgba(0,0,0,${Math.min(1, fade)})`;
    context.fillRect(0, 0, width, height);
  }
  const appear = Math.min(1, Math.max(0, (local - 0.3) / 0.35));
  if (appear > 0) {
    context.save();
    context.translate(width * 0.12, height * 0.14);
    context.rotate(-0.09);
    context.globalAlpha = 0.9 * appear * (1 - Math.max(0, (local - (WORLD_STOP_SECONDS - 0.5)) / 0.5));
    context.fillStyle = 'rgba(14,26,44,0.6)';
    context.strokeStyle = '#f3e7c6';
    context.lineWidth = 3;
    const label = place.name.toUpperCase();
    context.font = '700 22px Barlow Condensed, sans-serif';
    const boxWidth = context.measureText(label).width + 36;
    context.beginPath();
    context.roundRect(-8, -26, boxWidth, 42, 6);
    context.fill();
    context.stroke();
    context.fillStyle = '#f3e7c6';
    context.fillText(label, 10, 3);
    context.restore();
  }
  return { line: index + 1 };
}
