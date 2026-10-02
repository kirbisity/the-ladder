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

import { FACE_STYLES } from '../config.js';

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

/** The face style a look asks for: a named preset from the config, with any per-character tweaks on top. */
function styleOf(look) {
  return { ...(FACE_STYLES[look.faceStyle] ?? FACE_STYLES.glossy), ...(look.faceTweaks ?? {}) };
}

/** What each expression asks of the face: blink, smile (negative is a frown), brows. */
function lifeFor(expression, blinking, gaze) {
  const base = { blink: blinking ? 1 : 0, talk: 0, lookX: gaze, brow: 0, smile: 0.35 };
  if (expression === 'happy') return { ...base, smile: 1, brow: 0.4 };
  if (expression === 'sad' || expression === 'crying') return { ...base, smile: -0.3, brow: -0.8 };
  if (expression === 'sleep' || expression === 'blank-closed') return { ...base, blink: 1, smile: 0.2 };
  if (expression === 'blank') return { ...base, smile: 0.15 };
  return base;
}

/**
 * The face features for a style, built fresh into `face` whenever the
 * expression, blink or gaze changes. `big` is the head's own proportions.
 */
function buildFace(face, look, big, style, life, detail, tearDrop) {
  const z = (x, y) => surfaceZ(big, x, y) + 0.01;
  const eyes = style.eyes;
  const open = 1 - life.blink;
  const eyeY = style.lowEyes ? -0.08 : 0.06;
  const spread = 0.4 + style.head * 0.08;
  const iris = hexToRgb(look.eyes === 'monolid' ? '#2a1d14' : '#3a2418');
  const gx = life.lookX;
  if (!detail) {
    for (const side of [-1, 1]) ellipsoid(face, [side * spread, eyeY, z(side * spread, eyeY)], [0.1, 0.1, 0.03], '#141010', { lat: 3, lon: 6, bias: FEATURE_BIAS });
    return;
  }
  for (const side of [-1, 1]) {
    const x = side * spread;
    const holder = face.add(new Node(x, eyeY, z(x, eyeY)));
    const closedLine = (w) => tube(holder, [[-w, 0, 0.07], [0, -0.09, 0.08], [w, 0, 0.07]], 0.04, '#1d1a1a', { sides: 3, bias: FEATURE_BIAS + 0.2 });
    if (eyes === 'dot') {
      if (open > 0.2) ellipsoid(holder, [gx * 0.08, 0, 0.04], [0.085, 0.085 * open, 0.05], '#141010', { lat: 5, lon: 8, bias: FEATURE_BIAS + 0.1 });
      else closedLine(0.1);
    } else if (eyes === 'bean') {
      if (open > 0.2) {
        ellipsoid(holder, [gx * 0.06, 0, 0.04], [0.1, 0.2 * open, 0.05], '#141010', { lat: 6, lon: 10, bias: FEATURE_BIAS + 0.1 });
        ellipsoid(holder, [gx * 0.06 - 0.03, 0.07 * open, 0.09], [0.035, 0.05, 0.02], '#ffffff', { lat: 3, lon: 6, bias: FEATURE_BIAS + 0.15 });
      } else closedLine(0.1);
    } else if (eyes === 'oval') {
      if (open > 0.2) {
        ellipsoid(holder, [0, 0, 0], [0.26, 0.22 * open, 0.05], '#ffffff', { lat: 5, lon: 12, bias: FEATURE_BIAS });
        ellipsoid(holder, [gx * 0.1, 0, 0.05], [0.17, 0.2 * Math.min(1, open * 1.1), 0.04], iris, { lat: 5, lon: 10, bias: FEATURE_BIAS + 0.05 });
        ellipsoid(holder, [gx * 0.1, 0, 0.08], [0.08, 0.1, 0.03], '#0a0807', { lat: 3, lon: 8, bias: FEATURE_BIAS + 0.1 });
        ellipsoid(holder, [gx * 0.1 - 0.06, 0.08, 0.11], [0.05, 0.05, 0.02], '#ffffff', { lat: 3, lon: 6, bias: FEATURE_BIAS + 0.15 });
      } else closedLine(0.24);
      tube(holder, [[-0.28, 0.18 * open, 0.07], [0, 0.26 * open, 0.08], [0.28, 0.18 * open, 0.07]], 0.03, '#1d1a1a', { sides: 3, bias: FEATURE_BIAS + 0.2 });
    } else if (eyes === 'sleepy') {
      const lid = 0.5 + life.blink * 0.5;
      ellipsoid(holder, [0, 0, 0], [0.24, 0.18, 0.05], '#fbfaf7', { lat: 5, lon: 12, bias: FEATURE_BIAS });
      ellipsoid(holder, [gx * 0.08, -0.02, 0.05], [0.13, 0.13, 0.04], iris, { lat: 5, lon: 10, bias: FEATURE_BIAS + 0.05 });
      ellipsoid(holder, [gx * 0.08, -0.02, 0.08], [0.06, 0.06, 0.03], '#0a0807', { lat: 3, lon: 6, bias: FEATURE_BIAS + 0.1 });
      // The heavy lid: skin-coloured, pulled down over the top of the eye.
      ellipsoid(holder, [0, 0.18 - lid * 0.2, 0.09], [0.27, 0.19 * lid + 0.02, 0.05], hexToRgb(look.skin), { lat: 4, lon: 12, bias: FEATURE_BIAS + 0.2 });
      tube(holder, [[-0.27, (0.18 - lid * 0.2) * 0.1, 0.12], [0, -0.04 - lid * 0.02, 0.13], [0.27, 0, 0.12]], 0.035, '#1d1a1a', { sides: 3, bias: FEATURE_BIAS + 0.25 });
    } else if (open > 0.15) {
      ellipsoid(holder, [0, 0, 0], [0.3, 0.34 * open, 0.06], '#ffffff', { lat: 6, lon: 12, bias: FEATURE_BIAS });
      ellipsoid(holder, [gx * 0.1, 0, 0.05], [0.22, 0.25 * Math.min(1, open * 1.2), 0.05], iris, { lat: 6, lon: 10, bias: FEATURE_BIAS + 0.05 });
      ellipsoid(holder, [gx * 0.1, 0, 0.09], [0.11, 0.12, 0.03], '#0a0807', { lat: 4, lon: 8, bias: FEATURE_BIAS + 0.1 });
      ellipsoid(holder, [gx * 0.1 - 0.08, 0.1, 0.12], [0.07, 0.07, 0.02], '#ffffff', { lat: 3, lon: 6, bias: FEATURE_BIAS + 0.15 });
    } else closedLine(0.3);
    // Brows: the face's main way of acting, most of all for dot eyes.
    const browY = eyeY + (eyes === 'dot' ? 0.2 : eyes === 'sleepy' ? 0.28 : 0.4) + life.brow * 0.12;
    tube(face, [[side * (spread - 0.2), browY, z(side * (spread - 0.2), browY) + 0.01], [side * spread, browY + 0.05, z(side * spread, browY) + 0.01], [side * (spread + 0.26), browY - 0.03 - life.brow * 0.05, z(side * (spread + 0.26), browY) + 0.01]], eyes === 'dot' ? 0.035 : 0.045, shadeHex(look.hair, 0.05), { sides: 4, bias: FEATURE_BIAS + 0.1 });
    if (look.cheeks === 'flushed' || eyes === 'glossy' || eyes === 'oval') disc(face, [side * (spread + 0.28), eyeY - 0.4, z(side * (spread + 0.28), eyeY - 0.4) + 0.005], 0.2, 0.12, '#f07882', { segments: 8, alpha: 0.5 });
    if (tearDrop !== null) {
      const drop = (tearDrop + (side + 1) * 0.37) % 1;
      ellipsoid(face, [side * spread * 0.9, eyeY - 0.22 - drop * 0.7, z(side * spread * 0.9, eyeY - 0.3) + 0.04], [0.06, 0.09, 0.04], '#a0d2ff', { lat: 3, lon: 6, bias: FEATURE_BIAS + 0.3 });
    }
  }
  if (style.nose === 'small') ellipsoid(face, [0, eyeY - 0.3, z(0, eyeY - 0.3) + 0.02], [0.06, 0.05, 0.05], shadeHex(look.skin, -0.12), { lat: 3, lon: 6, bias: FEATURE_BIAS });
  else if (style.nose === 'dot') ellipsoid(face, [0, eyeY - 0.28, z(0, eyeY - 0.28) + 0.01], [0.035, 0.035, 0.03], '#7a4a3a', { lat: 3, lon: 6, bias: FEATURE_BIAS });
  // The mouth: a style of its own, bending with the smile.
  const my = eyeY - 0.58;
  const mz = (x, y) => z(x, y) + 0.005;
  const frown = life.smile < 0;
  if (style.mouth === 'line') {
    const tilt = (life.smile - 0.3) * 0.12;
    tube(face, [[-0.16, my + tilt, mz(-0.16, my)], [0, my - Math.abs(tilt) * 0.3, mz(0, my)], [0.16, my + tilt, mz(0.16, my)]], 0.03, '#5a3030', { sides: 3, bias: FEATURE_BIAS + 0.1 });
  } else if (style.mouth === 'dot') {
    disc(face, [0, my, mz(0, my)], frown ? 0.05 : 0.045, frown ? 0.035 : 0.045, '#6f2a2e', { segments: 8, bias: FEATURE_BIAS + 0.1 });
  } else if (style.mouth === 'cat') {
    for (const side of [-1, 1]) {
      const points = Array.from({ length: 6 }, (_, index) => {
        const angle = (index / 5) * Math.PI;
        const x = side * 0.1 + side * 0.1 * (1 - Math.cos(angle)) * 0.9 - side * 0.09;
        const y = my + (frown ? -0.1 : 0.1) - (frown ? -1 : 1) * Math.sin(angle) * 0.1 * (0.6 + Math.abs(life.smile) * 0.6);
        return [x, y, mz(x, y)];
      });
      tube(face, points, 0.028, '#7a3a3a', { sides: 3, bias: FEATURE_BIAS + 0.1 });
    }
  } else {
    const span = 0.7 + Math.abs(life.smile) * 0.8;
    const arc = Array.from({ length: 7 }, (_, index) => {
      const angle = -span / 2 + (span * index) / 6;
      const x = Math.sin(angle) * 0.26;
      const y = frown ? my + Math.cos(angle) * 0.26 - 0.26 : my - Math.cos(angle) * 0.26 + 0.26;
      return [x, y, mz(x, y)];
    });
    if (life.smile > 0.8) disc(face, [0, my + 0.04, mz(0, my)], 0.2, 0.06, '#6f2a2e', { segments: 10, bias: FEATURE_BIAS });
    tube(face, arc, 0.03, '#9c4f4f', { sides: 3, bias: FEATURE_BIAS + 0.1 });
  }
}

function buildGlasses(head, look, big, style) {
  if (!look.glasses) return;
  const thick = look.glasses === 'thickBlack';
  const color = thick ? '#0d0d0d' : '#b6a27a';
  const eyeY = style.lowEyes ? -0.08 : 0.06;
  const spread = 0.4 + style.head * 0.08;
  const radius = style.eyes === 'dot' || style.eyes === 'bean' ? 0.3 : 0.4;
  const tubeRadius = thick ? 0.05 : 0.022;
  const z = surfaceZ(big, spread, eyeY) + 0.12;
  for (const side of [-1, 1]) {
    const ring = Array.from({ length: 14 }, (_, index) => [side * spread + Math.cos((index / 14) * TWO_PI) * radius, eyeY + Math.sin((index / 14) * TWO_PI) * radius * 0.95, z]);
    tube(head, ring, tubeRadius, color, { sides: 4, closed: true, bias: FEATURE_BIAS + 0.3 });
    tube(head, [[side * (spread + radius), eyeY, z], [side * (big.w * 0.92), eyeY, z - 0.5]], tubeRadius * 0.8, color, { sides: 3, bias: FEATURE_BIAS + 0.2 });
  }
  tube(head, [[-0.1, eyeY + 0.05, z], [0.1, eyeY + 0.05, z]], tubeRadius, color, { sides: 3, bias: FEATURE_BIAS + 0.3 });
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

  // A toy head: its size and features come from the character's face style.
  const style = styleOf(look);
  const shape = FACES[look.face] ?? FACES.round;
  const big = { w: shape.w * style.head, h: shape.h * (0.85 + style.head * 0.17), d: shape.d * (0.9 + style.head * 0.17), taper: shape.taper * 0.5 };
  const head = torso.add(new Node(0, 3.6 + big.h, 0));
  ellipsoid(head, [0, 0, 0], [big.w, big.h, big.d], skinRgb, { lat: detail ? 20 : 8, lon: detail ? 30 : 12, deform: faceDeform(big) });
  for (const side of [-1, 1]) ellipsoid(head, [side * big.w * 0.97, -0.1, 0], [0.12, 0.2, 0.12], hexToRgb(shadeHex(skin, -0.05)), { lat: 4, lon: 6 });
  buildGlasses(head, look, big, style);
  if (look.stubble && detail) ellipsoid(head, [0, 0, 0], [big.w * 1.012, big.h * 1.012, big.d * 1.012], hexToRgb('#3b2d25'), { lat: 6, lon: 20, deform: faceDeform(big), alpha: 0.2, bias: 0.05 });
  buildHair(head, look, big, detail);
  const faceNode = head.add(new Node());

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

  return { root, body, torso, head, legs, arms, faceNode, big, style, look, crate, faceKey: null, detail };
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

/** Blink every few seconds and glance about, so a still figure is never frozen. */
function applyFace(model, expression, phase, time) {
  const blinking = time % 4.3 > 4.15;
  const gaze = [0, 0, 1, 0, -1][Math.floor(time / 2.7) % 5];
  const crying = expression === 'crying';
  const tearFrame = crying ? Math.floor((phase / TWO_PI) * 8) % 8 : -1;
  const key = `${expression ?? ''}|${blinking}|${gaze}|${tearFrame}`;
  if (model.faceKey === key) return;
  model.faceKey = key;
  model.faceNode.faces = [];
  model.faceNode.children = [];
  buildFace(model.faceNode, model.look, model.big, model.style, lifeFor(expression, blinking, gaze), model.detail, crying ? tearFrame / 8 : null);
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
  applyFace(model, expression, phase, time);
  // A three-quarter turn gives depth; from the back, a desk worker.
  // A caller can turn the figure to any heading (a walker faces where it goes).
  const yaw = options.yaw !== undefined ? options.yaw : view === 'back' ? Math.PI - 0.45 : poseName === 'lying' ? 0 : yawDefault;
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

/** The renderer's building blocks, for prototypes of other head styles. */
export const engine = { pushFace, Node, ellipsoid, prism, box, tube, disc, flatten, paint, rotation, hexToRgb, shadeHex, surfaceZ, FACES, faceDeform };
