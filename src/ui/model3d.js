// The cast as 3D models, built the way Slope Lab's skier and Greatwall's
// structures are: primitives (ellipsoids, tapered prisms, boxes) whose faces
// are wound outward, lit by their normals, culled when they face away and
// painted far to near onto the 2D canvas. No library and no WebGL, so the
// same code runs in every scene, portrait and desk, and animates live.
//
// A model is built from a character's look card (face shape, hair, brows,
// eyes, nose, mouth, glasses, build, colours) and posed on a small skeleton:
// hips, torso, head, two arms with elbows, two legs with knees.
//
// Units: one head radius is 1. Feet at y = 0, hips at 3.6, shoulders at
// 6.9, head centre at 8.15. y is up, the model faces +z (toward the viewer).

const TWO_PI = Math.PI * 2;
const LIGHT = norm([-0.4, 0.7, 0.75]);
const AMBIENT = 0.68;
const DIFFUSE = 0.48;

// Features sit on the face; this pulls them in front of the skin they are
// painted on when faces are sorted by depth.
const FEATURE_BIAS = 0.7;
const HAIR_BIAS = 0.25;

// How fast each moving pose cycles, radians a second at game time.
const OMEGA = { walking: 6, mourning: 6, waving: 5, typing: 4, standing: 1.2 };

// ── Vectors and matrices ───────────────────────────────────────────────

function norm(v) {
  const length = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / length, v[1] / length, v[2] / length];
}
function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }

/** Rotation matrix for Euler angles, x then y then z applied to a point as Rx·Ry·Rz. */
function rotation(x, y, z) {
  const [sx, cx, sy, cy, sz, cz] = [Math.sin(x), Math.cos(x), Math.sin(y), Math.cos(y), Math.sin(z), Math.cos(z)];
  return [
    [cy * cz, -cy * sz, sy],
    [cx * sz + sx * sy * cz, cx * cz - sx * sy * sz, -sx * cy],
    [sx * sz - cx * sy * cz, sx * cz + cx * sy * sz, cx * cy],
  ];
}
function mulMat(a, b) {
  return a.map((row) => [0, 1, 2].map((column) => row[0] * b[0][column] + row[1] * b[1][column] + row[2] * b[2][column]));
}
function applyMat(m, v) { return [dot(m[0], v), dot(m[1], v), dot(m[2], v)]; }

function toRgb(color) {
  return typeof color === 'string' ? hexToRgb(color) : color;
}
function hexToRgb(hex) {
  const value = parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}
function shadeHex(hex, amount) {
  const [r, g, b] = hexToRgb(hex);
  const target = amount >= 0 ? 255 : 0;
  const mix = Math.abs(amount);
  const channel = (value) => Math.round(value * (1 - mix) + target * mix);
  return `#${((channel(r) << 16) | (channel(g) << 8) | channel(b)).toString(16).padStart(6, '0')}`;
}

// ── Scene graph ────────────────────────────────────────────────────────

class Node {
  constructor(x = 0, y = 0, z = 0) {
    this.position = [x, y, z];
    this.angles = [0, 0, 0];
    this.faces = [];
    this.children = [];
    this.visible = true;
  }
  add(child) { this.children.push(child); return child; }
  reset(x, y, z) { this.angles = [0, 0, 0]; if (x !== undefined) this.position = [x, y, z]; }
}

/** Collect every face of a node tree as world-space polygons. */
function flatten(node, parentRotation, parentPosition, out) {
  if (!node.visible) return;
  const local = rotation(node.angles[0], node.angles[1], node.angles[2]);
  const world = mulMat(parentRotation, local);
  const origin = applyMat(parentRotation, node.position);
  const position = [origin[0] + parentPosition[0], origin[1] + parentPosition[1], origin[2] + parentPosition[2]];
  for (const face of node.faces) {
    const points = face.points.map((point) => {
      const moved = applyMat(world, point);
      return [moved[0] + position[0], moved[1] + position[1], moved[2] + position[2]];
    });
    out.push({ points, color: face.color, bias: face.bias, alpha: face.alpha });
  }
  for (const child of node.children) flatten(child, world, position, out);
}

// ── Primitives ─────────────────────────────────────────────────────────

function pushFace(node, points, centre, color, bias = 0, alpha = 1) {
  const normal = cross(sub(points[1], points[0]), sub(points[2], points[0]));
  const middle = points.reduce((sum, point) => [sum[0] + point[0], sum[1] + point[1], sum[2] + point[2]], [0, 0, 0]).map((value) => value / points.length);
  const ordered = dot(normal, sub(middle, centre)) >= 0 ? points : points.slice().reverse();
  node.faces.push({ points: ordered, color: toRgb(color), bias, alpha });
}

/**
 * An ellipsoid (or the cap of one: `reach` is the polar angle covered from
 * the top). `deform` may move each vertex, and `spin` turns it about z.
 */
function ellipsoid(node, centre, radii, color, { lat = 8, lon = 12, reach = Math.PI, deform = null, spin = 0, bias = 0, alpha = 1 } = {}) {
  const grid = [];
  const [cs, sn] = [Math.cos(spin), Math.sin(spin)];
  for (let i = 0; i <= lat; i += 1) {
    const theta = (i / lat) * reach;
    const ring = [];
    for (let j = 0; j < lon; j += 1) {
      const phi = (j / lon) * TWO_PI;
      let x = Math.sin(theta) * Math.cos(phi);
      let y = Math.cos(theta);
      let z = Math.sin(theta) * Math.sin(phi);
      if (deform) [x, y, z] = deform(x, y, z);
      x *= radii[0];
      y *= radii[1];
      z *= radii[2];
      ring.push([centre[0] + x * cs - y * sn, centre[1] + x * sn + y * cs, centre[2] + z]);
    }
    grid.push(ring);
  }
  const inner = [centre[0], centre[1], centre[2]];
  for (let i = 0; i < lat; i += 1) {
    for (let j = 0; j < lon; j += 1) {
      const next = (j + 1) % lon;
      pushFace(node, [grid[i][j], grid[i][next], grid[i + 1][next], grid[i + 1][j]], inner, color, bias, alpha);
    }
  }
}

/** A tapered prism between two points, with optional caps. */
function prism(node, a, b, radiusA, radiusB, color, { sides = 8, squash = 1, caps = true, bias = 0 } = {}) {
  const axis = norm(sub(b, a));
  const helper = Math.abs(axis[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
  const u = norm(cross(axis, helper));
  const v = cross(axis, u);
  const ringAt = (centre, radius) => Array.from({ length: sides }, (_, index) => {
    const angle = (index / sides) * TWO_PI;
    const offsetU = Math.cos(angle) * radius;
    const offsetV = Math.sin(angle) * radius;
    return [centre[0] + u[0] * offsetU + v[0] * offsetV, centre[1] + u[1] * offsetU + v[1] * offsetV, centre[2] + (u[2] * offsetU + v[2] * offsetV) * squash];
  });
  const start = ringAt(a, radiusA);
  const end = ringAt(b, radiusB);
  const centre = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
  for (let index = 0; index < sides; index += 1) {
    const next = (index + 1) % sides;
    pushFace(node, [start[index], start[next], end[next], end[index]], centre, color, bias);
  }
  if (caps) {
    pushFace(node, start, centre, color, bias);
    pushFace(node, end, centre, color, bias);
  }
}

function box(node, centre, half, color, bias = 0) {
  const [hx, hy, hz] = half;
  const corner = (sx, sy, sz) => [centre[0] + sx * hx, centre[1] + sy * hy, centre[2] + sz * hz];
  const quads = [
    [corner(-1, -1, 1), corner(1, -1, 1), corner(1, 1, 1), corner(-1, 1, 1)],
    [corner(-1, -1, -1), corner(-1, 1, -1), corner(1, 1, -1), corner(1, -1, -1)],
    [corner(-1, 1, -1), corner(-1, 1, 1), corner(1, 1, 1), corner(1, 1, -1)],
    [corner(-1, -1, -1), corner(1, -1, -1), corner(1, -1, 1), corner(-1, -1, 1)],
    [corner(1, -1, -1), corner(1, 1, -1), corner(1, 1, 1), corner(1, -1, 1)],
    [corner(-1, -1, -1), corner(-1, -1, 1), corner(-1, 1, 1), corner(-1, 1, -1)],
  ];
  for (const quad of quads) pushFace(node, quad, centre, color, bias);
}

/** A thin strip along a polyline, for brows, lips and glasses. */
function tube(node, points, radius, color, { sides = 4, closed = false, bias = FEATURE_BIAS } = {}) {
  const last = closed ? points.length : points.length - 1;
  for (let index = 0; index < last; index += 1) {
    prism(node, points[index], points[(index + 1) % points.length], radius, radius, color, { sides, caps: false, bias });
  }
}

/** A flat disc facing +z, for cheeks and highlights. */
function disc(node, centre, radiusX, radiusY, color, { segments = 8, alpha = 1, bias = FEATURE_BIAS } = {}) {
  const points = Array.from({ length: segments }, (_, index) => {
    const angle = (index / segments) * TWO_PI;
    return [centre[0] + Math.cos(angle) * radiusX, centre[1] + Math.sin(angle) * radiusY, centre[2]];
  });
  node.faces.push({ points, color: toRgb(color), bias, alpha });
}

// ── The head ───────────────────────────────────────────────────────────

// Per face shape: width, height, depth, and how hard the jaw tapers to the chin.
const FACES = {
  round: { w: 1.0, h: 1.0, d: 0.98, taper: 0.1 },
  soft: { w: 0.93, h: 1.06, d: 0.97, taper: 0.2 },
  structured: { w: 0.94, h: 1.04, d: 0.98, taper: 0.3 },
  narrow: { w: 0.8, h: 1.12, d: 0.94, taper: 0.4 },
  // A squarish face: a wide jaw and a flat chin.
  square: { w: 0.95, h: 1.06, d: 0.98, taper: 0.05, flatChin: 0.92 },
};

function faceDeform(shape) {
  return (x, y, z) => {
    if (y < 0.15) {
      const drop = 0.15 - y;
      const lowest = shape.flatChin ? Math.max(y, -shape.flatChin) : y;
      return [x * (1 - shape.taper * drop * drop * 1.3), lowest, z * (1 - shape.taper * 0.4 * drop * drop)];
    }
    return [x, y, z];
  };
}

/** The depth of the face surface at (x, y), so features sit on it. */
function surfaceZ(shape, x, y) {
  const nx = x / shape.w;
  const ny = y / shape.h;
  return Math.sqrt(Math.max(0.04, 1 - nx * nx - ny * ny)) * shape.d;
}

// ── Building a figure ──────────────────────────────────────────────────

function buildEyes(head, look, shape, skin, detail) {
  const type = look.eyes ?? 'innerDouble';
  const width = { large: 0.25, focused: 0.21, monolid: 0.22, innerDouble: 0.22 }[type] ?? 0.22;
  const height = { large: 0.2, focused: 0.1, monolid: 0.085, innerDouble: 0.12 }[type] ?? 0.12;
  const scale = look.youthful ? 1.14 : 1;
  const eyeY = look.youthful ? -0.04 : 0.05;
  const eyes = [];
  for (const side of [-1, 1]) {
    const x = side * 0.38;
    const z = surfaceZ(shape, x, eyeY) + 0.01;
    const holder = head.add(new Node(x, eyeY, z));
    const w = width * scale;
    const h = height * scale;
    if (detail === 0) {
      ellipsoid(holder, [0, 0, 0], [w * 0.8, h * 1.1, 0.03], '#2b1c14', { lat: 3, lon: 6, bias: FEATURE_BIAS });
      eyes.push({ holder, side, h, closedLine: null, open: [] });
      continue;
    }
    const open = new Node();
    holder.add(open);
    ellipsoid(open, [0, 0, 0], [w, h, 0.05], '#fbfaf7', { lat: 4, lon: 10, bias: FEATURE_BIAS });
    ellipsoid(open, [0, 0, 0.04], [h * 0.95, h * 0.95, 0.04], '#2b1c14', { lat: 4, lon: 8, bias: FEATURE_BIAS + 0.05 });
    ellipsoid(open, [0, 0, 0.07], [h * 0.45, h * 0.45, 0.03], '#0c0a0a', { lat: 3, lon: 6, bias: FEATURE_BIAS + 0.1 });
    if (type === 'large') ellipsoid(open, [-h * 0.35, h * 0.4, 0.1], [h * 0.22, h * 0.22, 0.02], '#ffffff', { lat: 3, lon: 6, bias: FEATURE_BIAS + 0.15 });
    const lid = (y, tilt) => tube(holder, [[-w * 1.1, y - tilt, 0.06], [0, y + h * 0.35, 0.07], [w * 1.1, y + tilt, 0.06]], 0.022, '#1d1a1a', { sides: 3, bias: FEATURE_BIAS + 0.2 });
    lid(h * 1.05, type === 'monolid' ? side * 0.03 : 0);
    if (type === 'monolid') ellipsoid(holder, [0, h * 0.78, 0.04], [w * 1.08, h * 0.5, 0.04], skin, { lat: 3, lon: 8, bias: FEATURE_BIAS + 0.12 });
    if (type === 'innerDouble' || type === 'large') tube(holder, [[-w * 0.9, h * 1.7, 0.05], [0, h * 2.0, 0.06], [w * 0.9, h * 1.7, 0.05]], 0.014, shadeHex(skin, -0.3), { sides: 3, bias: FEATURE_BIAS + 0.1 });
    const closedLine = new Node();
    tube(closedLine, [[-w, 0, 0.06], [0, -0.07, 0.07], [w, 0, 0.06]], 0.03, '#1d1a1a', { sides: 3, bias: FEATURE_BIAS + 0.3 });
    closedLine.visible = false;
    holder.add(closedLine);
    eyes.push({ holder, side, h, open, closedLine });
  }
  return { eyes, eyeY, scale };
}

function buildBrows(head, look, shape, eyeY) {
  const style = look.brows ?? 'soft';
  const thickness = { thickCurved: 0.07, straight: 0.045, soft: 0.035 }[style] ?? 0.04;
  const color = shadeHex(look.hair === '#ffffff' ? '#cfcfcf' : look.hair, 0.05);
  const browY = eyeY + 0.27;
  const brows = [];
  for (const side of [-1, 1]) {
    const holder = head.add(new Node(0, browY, 0));
    const spots = [[0.18, 0.0], [0.39, style === 'straight' ? 0.01 : 0.05], [0.6, style === 'straight' ? -0.01 : -0.04]];
    const points = spots.map(([x, y]) => [side * x, y, surfaceZ(shape, side * x, browY + y) + 0.02]);
    tube(holder, points, thickness, color, { sides: 4, bias: FEATURE_BIAS + 0.05 });
    brows.push({ holder, side, browY });
  }
  return brows;
}

function buildNose(head, look, shape) {
  const color = shadeHex(look.skin, -0.1);
  const z = surfaceZ(shape, 0, -0.12);
  const at = (y, dz) => [0, y, z + dz];
  if (look.nose === 'bridge') {
    ellipsoid(head, at(0.0, -0.01), [0.07, 0.3, 0.1], color, { lat: 4, lon: 6, bias: FEATURE_BIAS });
    ellipsoid(head, at(-0.2, 0.06), [0.14, 0.1, 0.1], color, { lat: 4, lon: 8, bias: FEATURE_BIAS });
  } else if (look.nose === 'delicate') {
    ellipsoid(head, at(-0.1, 0.02), [0.05, 0.2, 0.07], color, { lat: 4, lon: 6, bias: FEATURE_BIAS });
    ellipsoid(head, at(-0.2, 0.05), [0.09, 0.07, 0.07], color, { lat: 4, lon: 8, bias: FEATURE_BIAS });
  } else {
    ellipsoid(head, at(-0.14, 0.04), [0.13, 0.12, 0.1], color, { lat: 4, lon: 8, bias: FEATURE_BIAS });
  }
}

/** The mouth for an expression, built into a node that is rebuilt when it changes. */
function buildMouth(node, look, shape, expression) {
  node.faces = [];
  const mouthY = -0.5;
  const z = surfaceZ(shape, 0, mouthY) + 0.015;
  const lip = '#9c4f4f';
  const arc = (span, radius, flip) => {
    const points = Array.from({ length: 9 }, (_, index) => {
      const angle = -span / 2 + (span * index) / 8;
      return [Math.sin(angle) * radius, flip ? mouthY + Math.cos(angle) * radius - radius : mouthY - Math.cos(angle) * radius + radius, z];
    });
    tube(node, points.map((point) => [point[0], point[1], surfaceZ(shape, point[0], point[1]) + 0.015]), 0.035, lip, { sides: 3, bias: FEATURE_BIAS + 0.1 });
  };
  const open = (w, h) => {
    disc(node, [0, mouthY + 0.03, z], w, h, '#6f2a2e', { segments: 10, bias: FEATURE_BIAS + 0.05 });
  };
  if (expression === 'happy') {
    open(0.26, 0.09);
    disc(node, [0, mouthY + 0.075, z + 0.001], 0.22, 0.035, '#ffffff', { segments: 8, bias: FEATURE_BIAS + 0.08 });
    arc(1.8, 0.27, false);
  } else if (expression === 'sad' || expression === 'crying') {
    arc(1.1, 0.25, true);
  } else if (expression === 'sleep' || expression === 'blank' || expression === 'blank-closed') {
    tube(node, [[-0.13, mouthY, z], [0.13, mouthY, z]], 0.03, lip, { sides: 3 });
  } else if (look.mouth === 'smileTeeth') {
    open(0.24, 0.085);
    disc(node, [0, mouthY + 0.07, z + 0.001], 0.2, 0.032, '#ffffff', { segments: 8, bias: FEATURE_BIAS + 0.08 });
    arc(1.6, 0.26, false);
  } else if (look.mouth === 'animated') {
    open(0.12, 0.11);
    arc(1.3, 0.22, false);
  } else if (look.mouth === 'composed') {
    tube(node, [[-0.15, mouthY, z], [0.15, mouthY, z]], 0.032, lip, { sides: 3 });
  } else {
    arc(1.0, 0.3, false);
  }
}

function buildGlasses(head, look, shape, eyeY) {
  if (!look.glasses) return;
  const thick = look.glasses === 'thickBlack';
  const color = thick ? '#0d0d0d' : '#b6a27a';
  const radius = thick ? 0.3 : 0.31;
  const tubeRadius = thick ? 0.05 : 0.022;
  for (const side of [-1, 1]) {
    const cx = side * 0.38;
    const z = surfaceZ(shape, cx, eyeY) + 0.11;
    const ring = Array.from({ length: 14 }, (_, index) => {
      const angle = (index / 14) * TWO_PI;
      return [cx + Math.cos(angle) * radius, eyeY + Math.sin(angle) * radius * 0.92, z];
    });
    tube(head, ring, tubeRadius, color, { sides: 4, closed: true, bias: FEATURE_BIAS + 0.3 });
    if (!thick) ellipsoid(head, [cx, eyeY, z - 0.02], [radius, radius * 0.92, 0.01], '#a6c0b0', { lat: 2, lon: 10, alpha: 0.18, bias: FEATURE_BIAS + 0.2 });
    tube(head, [[cx + side * radius, eyeY, z], [side * (shape.w * 0.92), eyeY, z - 0.5]], tubeRadius * 0.8, color, { sides: 3, bias: FEATURE_BIAS + 0.2 });
  }
  tube(head, [[-0.1, eyeY + 0.05, surfaceZ(shape, 0, eyeY) + 0.12], [0.1, eyeY + 0.05, surfaceZ(shape, 0, eyeY) + 0.12]], tubeRadius, color, { sides: 3, bias: FEATURE_BIAS + 0.3 });
}

function buildHair(head, look, shape, detail) {
  const style = look.hairStyle ?? 'cleanShort';
  if (style === 'bald') return;
  const color = look.hair;
  const lat = detail ? 8 : 5;
  const lon = detail ? 14 : 8;
  const cap = (reach, radius = 1.06) => {
    // The hairline: reach is how far down the head the hair comes, as a share of a hemisphere.
    reach *= 0.74;
    const taper = faceDeform(shape);
    ellipsoid(head, [0, 0.03, -0.03], [shape.w * radius, shape.h * radius, shape.d * radius * 1.02], color, { lat, lon, reach, deform: taper, bias: HAIR_BIAS });
  };
  const fringe = (swept) => {
    ellipsoid(head, [swept ? -0.12 : 0, 0.6, shape.d * 0.72], [swept ? 0.88 : 0.92, 0.3, 0.38], color, { lat: 4, lon: 10, spin: swept ? 0.28 : 0, bias: HAIR_BIAS + 0.1 });
  };
  const mass = (centre, radii) => ellipsoid(head, centre, radii, color, { lat: detail ? 7 : 5, lon: detail ? 12 : 8, bias: -0.2 });
  if (style === 'sideSwept') {
    cap(Math.PI * 0.52);
    fringe(true);
  } else if (style === 'cleanShort') {
    cap(Math.PI * 0.5, 1.05);
  } else if (style === 'shoulderStraight' || style === 'long') {
    const length = style === 'long' ? 2.9 : 2.1;
    cap(Math.PI * 0.55);
    mass([0, -length / 2 + 0.7, -0.55], [1.12, length / 2 + 0.5, 0.55]);
    for (const side of [-1, 1]) mass([side * 0.98 * shape.w, -length / 2 + 0.55, 0.02], [0.2, length / 2 + 0.35, 0.62]);
  } else if (style === 'bob') {
    cap(Math.PI * 0.55);
    mass([0, -0.25, -0.3], [1.18, 1.0, 0.95]);
    fringe(false);
  } else if (style === 'ponytail') {
    cap(Math.PI * 0.55);
    fringe(false);
    ellipsoid(head, [0.95, -0.25, -0.55], [0.3, 1.15, 0.3], color, { lat: 6, lon: 8, spin: -0.28, bias: -0.1 });
    ellipsoid(head, [0.72, 0.78, -0.45], [0.13, 0.13, 0.13], '#d9546b', { lat: 3, lon: 6, bias: HAIR_BIAS + 0.2 });
  }
}

/**
 * Build a model from a look. `detail` 1 is the full face; 0 is a plain
 * head for figures too small to read features on.
 */
function buildModel(look, outfit, detail) {
  const skin = look.skin;
  const top = hexToRgb(outfit?.top ?? look.suit);
  const bottomHex = outfit?.bottom ?? shadeHex(look.suit, -0.25);
  const bottom = hexToRgb(bottomHex);
  const shirt = hexToRgb(outfit?.shirt ?? look.shirt ?? '#ffffff');
  const thin = look.build === 'thin' ? 0.82 : 1;
  const sides = detail ? 12 : 8;
  const shoe = hexToRgb('#1b1b1f');
  const skinRgb = hexToRgb(skin);

  const root = new Node();
  const body = root.add(new Node());

  const legs = [-1, 1].map((side) => {
    const hip = body.add(new Node(side * 0.35 * thin, 3.6, 0));
    prism(hip, [0, 0, 0], [0, -1.7, 0], 0.34 * thin, 0.3 * thin, bottom, { sides, caps: false });
    const knee = hip.add(new Node(0, -1.7, 0));
    prism(knee, [0, 0, 0], [0, -1.7, 0], 0.3 * thin, 0.26 * thin, bottom, { sides, caps: true });
    box(knee, [0, -1.78, 0.25], [0.31 * thin, 0.15, 0.5], shoe);
    return { hip, knee, side };
  });

  const torso = body.add(new Node(0, 3.6, 0));
  prism(torso, [0, 0, 0], [0, 3.3, 0], 0.88 * thin, 0.98 * thin, top, { sides: detail ? 14 : 10, squash: 0.64 });
  ellipsoid(torso, [0, 3.2, 0], [1.02 * thin, 0.3, 0.64], top, { lat: 4, lon: 12 });
  // The open collar: a shirt triangle on the chest.
  torso.faces.push({ points: [[-0.34, 3.26, 0.6], [0.34, 3.26, 0.6], [0, 2.1, 0.6]], color: shirt, bias: 0.3, alpha: 1 });
  prism(torso, [0, 3.2, 0], [0, 3.85, 0], 0.32, 0.3, hexToRgb(shadeHex(skin, -0.08)), { sides: 8, caps: false });

  const head = torso.add(new Node(0, 4.55, 0));
  const shape = FACES[look.face] ?? FACES.round;
  ellipsoid(head, [0, 0, 0], [shape.w, shape.h, shape.d], skinRgb, { lat: detail ? 14 : 8, lon: detail ? 20 : 12, deform: faceDeform(shape) });
  for (const side of [-1, 1]) ellipsoid(head, [side * shape.w * 0.96, 0.05, 0], [0.14, 0.26, 0.14], hexToRgb(shadeHex(skin, -0.05)), { lat: 4, lon: 6 });
  let eyes = [];
  let brows = [];
  const mouthNode = head.add(new Node());
  const tears = [];
  let eyeY = 0.05;
  if (detail) {
    const built = buildEyes(head, look, shape, skin, detail);
    eyes = built.eyes;
    eyeY = built.eyeY;
    brows = buildBrows(head, look, shape, eyeY);
    buildNose(head, look, shape);
    buildGlasses(head, look, shape, eyeY);
    if (look.cheeks === 'flushed') {
      for (const side of [-1, 1]) disc(head, [side * 0.55, -0.18, surfaceZ(shape, side * 0.55, -0.18) + 0.015], 0.2, 0.12, hexToRgb('#f07882'), { segments: 8, alpha: 0.45 });
    }
    if (look.stubble) {
      ellipsoid(head, [0, 0, 0], [shape.w * 1.012, shape.h * 1.012, shape.d * 1.012], hexToRgb('#3b2d25'), { lat: 6, lon: 20, deform: faceDeform(shape), alpha: 0.2, bias: 0.05 });
    }
    for (const side of [-1, 1]) {
      const tearNode = head.add(new Node(side * 0.4, -0.2, surfaceZ(shape, side * 0.4, -0.2) + 0.05));
      ellipsoid(tearNode, [0, 0, 0], [0.06, 0.09, 0.04], hexToRgb('#a0d2ff'), { lat: 3, lon: 6, bias: FEATURE_BIAS + 0.3 });
      tearNode.visible = false;
      tears.push({ node: tearNode, side });
    }
  } else {
    buildEyes(head, look, shape, skin, 0);
    buildGlasses(head, look, shape, eyeY);
  }
  buildHair(head, look, shape, detail);

  const arms = [-1, 1].map((side) => {
    const shoulder = torso.add(new Node(side * 1.0 * thin, 3.1, 0));
    prism(shoulder, [0, 0, 0], [0, -1.65, 0], 0.3, 0.27, top, { sides: detail ? 8 : 6, caps: false });
    const elbow = shoulder.add(new Node(0, -1.65, 0));
    prism(elbow, [0, 0, 0], [0, -1.5, 0], 0.27, 0.24, top, { sides: detail ? 8 : 6, caps: false });
    ellipsoid(elbow, [0, -1.62, 0], [0.28, 0.3, 0.28], skinRgb, { lat: 4, lon: 8 });
    return { shoulder, elbow, side };
  });

  const crate = torso.add(new Node(0, 1.3, 1.25));
  box(crate, [0, 0, 0], [1.2, 0.7, 0.55], hexToRgb('#c8a26a'));
  box(crate, [0, 0.58, 0], [1.2, 0.12, 0.56], hexToRgb('#a8844f'));
  crate.visible = false;

  return { root, body, torso, head, legs, arms, eyes, brows, tears, mouthNode, shape, look, crate, mouthKey: null, detail };
}

// ── Posing ─────────────────────────────────────────────────────────────

function resetPose(model) {
  model.root.angles = [0, 0, 0];
  model.root.position = [0, 0, 0];
  model.body.angles = [0, 0, 0];
  model.body.position = [0, 0, 0];
  model.torso.angles = [0, 0, 0];
  model.head.angles = [0, 0, 0];
  for (const leg of model.legs) {
    leg.hip.angles = [0, 0, 0];
    leg.knee.angles = [0, 0, 0];
  }
  for (const arm of model.arms) {
    arm.shoulder.angles = [0, 0, 0];
    arm.elbow.angles = [0, 0, 0];
  }
  model.crate.visible = false;
}

function applyPose(model, pose, phase, posture) {
  resetPose(model);
  const s = Math.sin(phase);
  const [legL, legR] = model.legs;
  const [armL, armR] = model.arms;
  armL.shoulder.angles[2] = -0.07;
  armR.shoulder.angles[2] = 0.07;
  if (pose === 'walking') {
    legL.hip.angles[0] = -0.4 * s;
    legR.hip.angles[0] = 0.4 * s;
    legL.knee.angles[0] = Math.max(0, 0.4 * s) * 0.9;
    legR.knee.angles[0] = Math.max(0, -0.4 * s) * 0.9;
    armL.shoulder.angles[0] = 0.4 * s;
    armR.shoulder.angles[0] = -0.4 * s;
    model.torso.angles[1] = 0.06 * s;
  } else if (pose === 'sitting' || pose === 'typing') {
    // The hips rest at the seat, a little above the baseline.
    model.body.position[1] = 0.2 - 3.6;
    for (const leg of model.legs) {
      leg.hip.angles[0] = -Math.PI / 2;
      leg.knee.angles[0] = Math.PI / 2;
    }
    if (pose === 'sitting') {
      armL.shoulder.angles[0] = -0.35;
      armR.shoulder.angles[0] = -0.35;
      armL.elbow.angles[0] = -0.9;
      armR.elbow.angles[0] = -0.9;
    } else {
      const bob = Math.sin(phase * 2) * 0.12;
      model.torso.angles[0] = posture === 'slumped' ? 0.35 : 0.05;
      model.head.angles[0] = posture === 'slumped' ? 0.3 : 0.05;
      armL.shoulder.angles[0] = -0.9 + bob;
      armR.shoulder.angles[0] = -0.9 - bob;
      armL.elbow.angles[0] = -1.2;
      armR.elbow.angles[0] = -1.2;
    }
  } else if (pose === 'mourning') {
    model.torso.angles[0] = 0.2;
    model.torso.angles[2] = s * 0.05;
    model.head.angles[0] = 0.28;
    for (const arm of model.arms) {
      arm.shoulder.angles[0] = -0.75;
      arm.shoulder.angles[2] = -arm.side * 0.2;
      arm.elbow.angles[0] = -1.35;
      arm.elbow.angles[2] = -arm.side * 0.2;
    }
  } else if (pose === 'waving') {
    armR.shoulder.angles[2] = 2.5;
    armR.elbow.angles[2] = 0.5 * s;
  } else if (pose === 'carrying') {
    for (const arm of model.arms) {
      arm.shoulder.angles[0] = -1.0;
      arm.shoulder.angles[2] = -arm.side * 0.12;
      arm.elbow.angles[0] = -0.9;
    }
    model.crate.visible = true;
  } else if (pose === 'lying') {
    // On the left side, head to the left, knees drawn up a little.
    model.root.angles[2] = Math.PI / 2;
    model.root.position = [2.3, 0.75, 0];
    legL.hip.angles[0] = -0.4;
    legR.hip.angles[0] = -0.25;
    legL.knee.angles[0] = 0.7;
    legR.knee.angles[0] = 0.55;
    armL.shoulder.angles[0] = -0.4;
    armR.shoulder.angles[0] = -0.9;
    armR.elbow.angles[0] = -0.8;
  } else {
    model.torso.angles[2] = s * 0.012;
  }
}

function applyFace(model, expression, phase) {
  if (!model.detail) return;
  const closed = expression === 'sleep' || expression === 'blank-closed';
  const sad = expression === 'sad' || expression === 'crying';
  for (const eye of model.eyes) {
    eye.open.visible = !closed;
    if (eye.closedLine) eye.closedLine.visible = closed;
  }
  for (const brow of model.brows) {
    brow.holder.angles[2] = sad ? brow.side * -0.3 : 0;
    brow.holder.position[1] = brow.browY + (sad ? 0.04 : 0);
  }
  const key = expression ?? '';
  if (model.mouthKey !== key) {
    buildMouth(model.mouthNode, model.look, model.shape, expression);
    model.mouthKey = key;
  }
  for (const tear of model.tears) {
    tear.node.visible = expression === 'crying';
    if (expression === 'crying') {
      const drop = (phase / TWO_PI + (tear.side + 1) * 0.37) % 1;
      tear.node.position[1] = -0.2 - drop * 0.7;
    }
  }
}

// ── Drawing ────────────────────────────────────────────────────────────

const models = new Map();

function modelFor(look, outfit, detail) {
  const key = `${JSON.stringify(look)}|${JSON.stringify(outfit ?? null)}|${detail}`;
  if (!models.has(key)) {
    if (models.size > 120) models.clear();
    models.set(key, buildModel(look, outfit, detail));
  }
  return models.get(key);
}

/** Paint a model's faces, far to near, lit by their normals, at a scale and place. */
function paint(context, faces, x, y, u) {
  const visible = [];
  for (const face of faces) {
    const [p0, p1, p2] = face.points;
    const normal = cross(sub(p1, p0), sub(p2, p0));
    if (normal[2] <= 0) continue;
    const unit = norm(normal);
    let depth = 0;
    for (const point of face.points) depth += point[2];
    visible.push({ face, unit, depth: depth / face.points.length + face.bias });
  }
  visible.sort((a, b) => a.depth - b.depth);
  context.lineJoin = 'round';
  context.lineWidth = Math.max(0.4, u * 0.03);
  for (const { face, unit } of visible) {
    const light = AMBIENT + DIFFUSE * Math.max(0, dot(unit, LIGHT));
    const [r, g, b] = face.color.map((channel) => Math.max(0, Math.min(255, Math.round(channel * light))));
    const paintColor = face.alpha < 1 ? `rgba(${r},${g},${b},${face.alpha})` : `rgb(${r},${g},${b})`;
    context.beginPath();
    face.points.forEach((point, index) => {
      const px = x + point[0] * u;
      const py = y - point[1] * u;
      if (index === 0) context.moveTo(px, py);
      else context.lineTo(px, py);
    });
    context.closePath();
    context.fillStyle = paintColor;
    context.fill();
    // A hairline in the fill colour hides the seams between polygons.
    if (face.alpha >= 1) {
      context.strokeStyle = paintColor;
      context.stroke();
    }
  }
}

function pose(model, options, yawDefault) {
  const { pose: poseName = 'standing', expression = null, time = 0, posture = 'upright', view = 'front' } = options;
  const phase = time * (OMEGA[poseName] ?? 1.2);
  applyPose(model, poseName, phase, posture);
  applyFace(model, expression, phase);
  // A three-quarter turn gives depth; from the back, a desk worker.
  const yaw = view === 'back' ? Math.PI - 0.45 : poseName === 'lying' ? 0 : yawDefault;
  model.root.angles[1] = yaw;
}

/**
 * Draw a figure so its feet stand at (x, y), `u` pixels to a head radius:
 * the 3D replacement for the flat figure.
 */
export function drawFigure3D(context, x, y, u, look, options = {}) {
  const model = modelFor(look, options.outfit, u >= 7 ? 1 : 0);
  pose(model, options, -0.3);
  const faces = [];
  flatten(model.root, rotation(0, 0, 0), [0, 0, 0], faces);
  paint(context, faces, x, y, u);
  return true;
}

/** Just the head and neck, for close-ups: the head's centre lands at (x, y). */
export function drawHead3D(context, x, y, r, look, options = {}) {
  const model = modelFor(look, options.outfit, 1);
  pose(model, { ...options, pose: 'standing' }, -0.25);
  const faces = [];
  const savedPosition = model.head.position;
  model.head.position = [0, 0, 0];
  flatten(model.head, rotation(0, model.root.angles[1], 0), [0, 0, 0], faces);
  model.head.position = savedPosition;
  paint(context, faces, x, y, r);
  return true;
}
