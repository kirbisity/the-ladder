// Prototypes: five ways to model a head, on the same look cards, with the
// "lively" controls each can support. Every variant builds a bust (head,
// neck, shoulders) as a Node tree for the shared software renderer, and takes
// `life`: { blink 0..1, talk 0..1, lookX -1..1, tilt radians, brow -1..1, smile 0..1 }.

import { engine } from '../src/ui/model3d.js';
const { Node, ellipsoid, prism, box, tube, disc, flatten, paint, rotation, hexToRgb, shadeHex } = engine;

const NEUTRAL = { blink: 0, talk: 0, lookX: 0, tilt: 0, brow: 0, smile: 0.3 };

function shoulders(root, look, width = 1.0, depth = 0.62) {
  const top = hexToRgb(look.suit);
  prism(root, [0, -2.2, 0], [0, -0.9, 0], 1.0 * width, 0.62 * width, top, { sides: 12, squash: depth });
  ellipsoid(root, [0, -0.95, 0], [1.1 * width, 0.4, depth * 1.1], top, { lat: 5, lon: 14 });
  root.faces.push({ points: [[-0.34, -0.9, depth + 0.02], [0.34, -0.9, depth + 0.02], [0, -2.0, depth + 0.02]], color: hexToRgb(look.shirt ?? '#ffffff'), bias: 0.3, alpha: 1 });
}

// Features common to the rounded variants (A, B, E): eyes, brows, nose, mouth, glasses.
function roundedFace(head, look, shape, life, opts) {
  const { eyeScale = 1, glossy = false, eyeY = 0.05, detail = 1, mouthY = -0.5 } = opts;
  const z = (x, y) => engine.surfaceZ(shape, x, y);
  const eyeW = { large: 0.25, focused: 0.21, monolid: 0.22, innerDouble: 0.22 }[look.eyes] ?? 0.22;
  const eyeH = ({ large: 0.2, focused: 0.1, monolid: 0.085, innerDouble: 0.12 }[look.eyes] ?? 0.12) * eyeScale;
  const open = 1 - life.blink;
  for (const side of [-1, 1]) {
    const x = side * 0.38;
    const holder = head.add(new Node(x, eyeY, z(x, eyeY) + 0.01));
    if (open > 0.15) {
      ellipsoid(holder, [0, 0, 0], [eyeW * eyeScale, eyeH * open, 0.05], '#fbfaf7', { lat: 4, lon: 10, bias: 0.7 });
      ellipsoid(holder, [life.lookX * eyeW * 0.45, 0, 0.04], [eyeH * 0.95, eyeH * 0.95 * Math.min(1, open * 1.2), 0.04], '#2b1c14', { lat: 4, lon: 8, bias: 0.75 });
      ellipsoid(holder, [life.lookX * eyeW * 0.45, 0, 0.07], [eyeH * 0.45, eyeH * 0.45, 0.03], '#0c0a0a', { lat: 3, lon: 6, bias: 0.8 });
      if (glossy) ellipsoid(holder, [life.lookX * eyeW * 0.45 - eyeH * 0.35, eyeH * 0.4, 0.1], [eyeH * 0.25, eyeH * 0.25, 0.02], '#ffffff', { lat: 3, lon: 6, bias: 0.85 });
    } else {
      tube(holder, [[-eyeW, 0, 0.06], [0, -0.06, 0.07], [eyeW, 0, 0.06]], 0.03, '#1d1a1a', { sides: 3, bias: 0.9 });
    }
    tube(holder, [[-eyeW * 1.1, eyeH * 1.05, 0.06], [0, eyeH * 1.4 * open, 0.07], [eyeW * 1.1, eyeH * 1.05, 0.06]], 0.02, '#1d1a1a', { sides: 3, bias: 0.9 });
    const browY = eyeY + 0.27 + life.brow * 0.1;
    const browPoints = [[0.18, 0], [0.39, 0.05], [0.6, -0.04 - life.brow * 0.05]].map(([bx, by]) => [side * bx, browY + by, z(side * bx, browY + by) + 0.02]);
    tube(head, browPoints, { thickCurved: 0.07, straight: 0.045, soft: 0.035 }[look.brows] ?? 0.04, shadeHex(look.hair, 0.05), { sides: 4, bias: 0.75 });
  }
  ellipsoid(head, [0, -0.14, z(0, -0.14) + 0.04], [0.12, 0.12, 0.1], shadeHex(look.skin, -0.1), { lat: 4, lon: 8, bias: 0.7 });
  // Mouth: a smile arc whose curve follows `smile`, opening with `talk`.
  const span = 0.8 + life.smile * 1.0;
  const radius = 0.34 - life.smile * 0.07;
  const arc = Array.from({ length: 9 }, (_, i) => {
    const a = -span / 2 + (span * i) / 8;
    const x = Math.sin(a) * radius;
    const y = mouthY - Math.cos(a) * radius + radius - life.talk * 0.08;
    return [x, y, z(x, y) + 0.015];
  });
  if (life.talk > 0.05) disc(head, [0, mouthY + 0.02 - life.talk * 0.05, z(0, mouthY) + 0.012], 0.16 + life.talk * 0.06, 0.03 + life.talk * 0.1, '#6f2a2e', { segments: 10, bias: 0.72 });
  tube(head, arc, 0.035, '#9c4f4f', { sides: 3, bias: 0.8 });
  if (look.cheeks === 'flushed') for (const side of [-1, 1]) disc(head, [side * 0.55, -0.18, z(side * 0.55, -0.18) + 0.015], 0.2, 0.12, '#f07882', { segments: 8, alpha: 0.45 });
  if (look.glasses) {
    const thick = look.glasses === 'thickBlack';
    for (const side of [-1, 1]) {
      const ring = Array.from({ length: 14 }, (_, i) => [side * 0.38 + Math.cos((i / 14) * Math.PI * 2) * 0.3, eyeY + Math.sin((i / 14) * Math.PI * 2) * 0.28, z(side * 0.38, eyeY) + 0.11]);
      tube(head, ring, thick ? 0.05 : 0.022, thick ? '#0d0d0d' : '#b6a27a', { sides: 4, closed: true, bias: 0.95 });
    }
  }
  if (look.stubble) ellipsoid(head, [0, 0, 0], [shape.w * 1.012, shape.h * 1.012, shape.d * 1.012], '#3b2d25', { lat: 6, lon: 20, deform: engine.faceDeform(shape), alpha: 0.2, bias: 0.05 });
  void detail;
}

function hairFor(head, look, shape, scale = 1) {
  const color = look.hair;
  const style = look.hairStyle;
  if (style === 'bald') return;
  const cap = (reach) => ellipsoid(head, [0, 0.03, -0.03], [shape.w * 1.06 * scale, shape.h * 1.06 * scale, shape.d * 1.08 * scale], color, { lat: 8, lon: 14, reach: reach * 0.74, deform: engine.faceDeform(shape), bias: 0.25 });
  const mass = (c, r) => ellipsoid(head, c, r, color, { lat: 7, lon: 12, bias: -0.2 });
  if (style === 'long' || style === 'shoulderStraight') {
    const length = style === 'long' ? 2.9 : 2.1;
    cap(Math.PI * 0.55);
    mass([0, -length / 2 + 0.7, -0.55], [1.12 * scale, length / 2 + 0.5, 0.55]);
    for (const side of [-1, 1]) mass([side * 0.98 * shape.w * scale, -length / 2 + 0.55, 0.02], [0.2, length / 2 + 0.35, 0.62]);
  } else if (style === 'ponytail') {
    cap(Math.PI * 0.55);
    ellipsoid(head, [0, 0.6, shape.d * 0.72], [0.92, 0.3, 0.38], color, { lat: 4, lon: 10, bias: 0.35 });
    ellipsoid(head, [0.95, -0.25, -0.55], [0.3, 1.15, 0.3], color, { lat: 6, lon: 8, spin: -0.28, bias: -0.1 });
    ellipsoid(head, [0.72, 0.78, -0.45], [0.13, 0.13, 0.13], '#d9546b', { lat: 3, lon: 6, bias: 0.45 });
  } else if (style === 'sideSwept') {
    cap(Math.PI * 0.52);
    ellipsoid(head, [-0.12, 0.6, shape.d * 0.72], [0.88, 0.3, 0.38], color, { lat: 4, lon: 10, spin: 0.28, bias: 0.35 });
  } else if (style === 'bob') {
    cap(Math.PI * 0.55);
    mass([0, -0.25, -0.3], [1.18, 1.0, 0.95]);
  } else cap(Math.PI * 0.5);
}

// ── A. Faceted spheres: the shipped model ──────────────────────────────
function variantFaceted(look, life) {
  const root = new Node();
  shoulders(root, look);
  const head = root.add(new Node(0, 0, 0));
  const shape = engine.FACES[look.face] ?? engine.FACES.round;
  ellipsoid(head, [0, 0, 0], [shape.w, shape.h, shape.d], hexToRgb(look.skin), { lat: 12, lon: 18, deform: engine.faceDeform(shape) });
  for (const side of [-1, 1]) ellipsoid(head, [side * shape.w * 0.96, 0.05, 0], [0.14, 0.26, 0.14], hexToRgb(shadeHex(look.skin, -0.05)), { lat: 4, lon: 6 });
  roundedFace(head, look, shape, life, {});
  hairFor(head, look, shape);
  head.angles[2] = life.tilt;
  return root;
}

// ── B. Smooth spheres: the same face on a finely tessellated head ──────
function variantSmooth(look, life) {
  const root = new Node();
  shoulders(root, look);
  const head = root.add(new Node(0, 0, 0));
  const shape = engine.FACES[look.face] ?? engine.FACES.round;
  ellipsoid(head, [0, 0, 0], [shape.w, shape.h, shape.d], hexToRgb(look.skin), { lat: 32, lon: 48, deform: engine.faceDeform(shape) });
  for (const side of [-1, 1]) ellipsoid(head, [side * shape.w * 0.96, 0.05, 0], [0.14, 0.26, 0.14], hexToRgb(shadeHex(look.skin, -0.05)), { lat: 8, lon: 10 });
  roundedFace(head, look, shape, life, { glossy: true });
  hairFor(head, look, shape);
  head.angles[2] = life.tilt;
  return root;
}

// ── C. Moai: chiselled, angular polygons ───────────────────────────────
function variantMoai(look, life) {
  const root = new Node();
  const stone = (c) => c;
  shoulders(root, look, 1.05, 0.7);
  const head = root.add(new Node(0, 0, 0));
  const skin = hexToRgb(look.skin);
  const dark = hexToRgb(shadeHex(look.skin, -0.42));
  // A tall, blocky skull with a heavy jaw: few facets, hard edges.
  ellipsoid(head, [0, 0.05, 0], [0.92, 1.18, 0.95], skin, { lat: 5, lon: 8, deform: (x, y, z) => [x * (y < 0 ? 1 + y * 0.12 : 1), y, z] });
  box(head, [0, -0.62, 0.35], [0.72, 0.38, 0.5], skin);
  // The brow ridge, deep eye sockets, the long nose, the lips and the chin.
  box(head, [0, 0.32, 0.8], [0.85, 0.14, 0.2], stone(skin), 0.5);
  for (const side of [-1, 1]) {
    const open = 1 - life.blink;
    box(head, [side * 0.38, 0.12, 0.84], [0.22, 0.13, 0.08], dark, 0.7);
    if (open > 0.2) box(head, [side * 0.38 + life.lookX * 0.07, 0.12, 0.9], [0.09, 0.08 * open, 0.04], '#f4f1ea', 0.8);
    if (open > 0.2) box(head, [side * 0.38 + life.lookX * 0.1, 0.12, 0.93], [0.04, 0.05 * open, 0.03], '#17110e', 0.9);
    box(head, [side * 0.38, 0.27 + life.brow * 0.05, 0.9], [0.24, 0.035, 0.05], shadeHex(look.hair, 0.05), 0.8);
  }
  prism(head, [0, 0.35, 0.82], [0, -0.28, 1.0], 0.1, 0.22, skin, { sides: 4, bias: 0.7 });
  box(head, [0, -0.52 - life.talk * 0.03, 0.9], [0.3, 0.05 + life.talk * 0.05, 0.08], life.talk > 0.1 ? '#4a1f22' : '#8a4646', 0.75);
  box(head, [0, -0.88, 0.62], [0.38, 0.14, 0.2], shadeHex(look.skin, -0.06), 0.5);
  if (look.glasses) {
    const color = look.glasses === 'thickBlack' ? '#0d0d0d' : '#b6a27a';
    for (const side of [-1, 1]) for (const [cx, cy, hw, hh] of [[0, 0.3, 0.3, 0.03], [0, -0.04, 0.3, 0.03], [-0.3, 0.13, 0.03, 0.17], [0.3, 0.13, 0.03, 0.17]]) box(head, [side * 0.38 + cx, cy, 0.97], [hw, hh, 0.03], color, 0.95);
  }
  if (look.stubble) box(head, [0, -0.7, 0.55], [0.6, 0.3, 0.45], '#3b2d25', 0.2);
  // Hair as a stone cap and slabs.
  const hair = hexToRgb(look.hair);
  box(head, [0, 1.0, -0.05], [0.95, 0.22, 0.95], hair);
  box(head, [0, 0.62, -0.5], [0.95, 0.65, 0.4], hair);
  if (look.hairStyle === 'long' || look.hairStyle === 'shoulderStraight') {
    box(head, [0, -0.9, -0.55], [1.0, 1.7, 0.3], hair, -0.2);
    for (const side of [-1, 1]) box(head, [side * 0.98, -0.5, 0.0], [0.12, 1.3, 0.55], hair);
  } else if (look.hairStyle === 'ponytail') {
    box(head, [0.9, -0.2, -0.55], [0.18, 1.0, 0.18], hair, -0.1);
  } else if (look.hairStyle === 'sideSwept') {
    box(head, [-0.2, 0.78, 0.6], [0.85, 0.16, 0.3], hair, 0.4);
  } else if (look.hairStyle === 'bob') {
    box(head, [0, -0.2, -0.5], [1.1, 1.0, 0.45], hair, -0.2);
  } else box(head, [0, 0.8, 0.55], [0.9, 0.17, 0.3], hair, 0.4);
  head.angles[2] = life.tilt;
  return root;
}

// ── D. Cubes: a pixel-textured block head, like Minecraft ──────────────
function variantCubes(look, life) {
  const root = new Node();
  const top = hexToRgb(look.suit);
  box(root, [0, -1.5, 0], [1.0, 0.8, 0.55], top);
  box(root, [-1.35, -1.5, 0], [0.32, 0.8, 0.4], top);
  box(root, [1.35, -1.5, 0], [0.32, 0.8, 0.4], top);
  root.faces.push({ points: [[-0.3, -0.7, 0.56], [0.3, -0.7, 0.56], [0, -1.5, 0.56]], color: hexToRgb(look.shirt ?? '#fff'), bias: 0.3, alpha: 1 });
  const head = root.add(new Node(0, 0.1, 0));
  const half = 1.0;
  box(head, [0, 0, 0], [half, half, half], hexToRgb(look.skin));
  // The face: an 8 x 8 pixel grid on the front, one small square a pixel.
  const px = (col, row, color) => {
    const size = (half * 2) / 8;
    const x = -half + (col + 0.5) * size;
    const y = half - (row + 0.5) * size;
    box(head, [x, y, half + 0.005], [size / 2, size / 2, 0.01], color, 0.6);
  };
  const skin = look.skin;
  const hair = look.hair;
  const open = life.blink < 0.5;
  // Hair rows on top and the fringe.
  for (let col = 0; col < 8; col += 1) {
    px(col, 0, hair);
    if (look.hairStyle !== 'bald') px(col, 1, hair);
  }
  if (look.hairStyle === 'sideSwept') { px(0, 2, hair); px(1, 2, hair); px(2, 2, hair); }
  else if (look.hairStyle === 'long' || look.hairStyle === 'shoulderStraight') { px(0, 2, hair); px(7, 2, hair); px(0, 3, hair); px(7, 3, hair); px(0, 4, hair); px(7, 4, hair); }
  else if (look.hairStyle === 'bob' || look.hairStyle === 'ponytail') { px(0, 2, hair); px(1, 2, hair); px(6, 2, hair); px(7, 2, hair); px(0, 3, hair); px(7, 3, hair); }
  else { px(0, 2, hair); px(7, 2, hair); }
  // Brows, eyes, nose, mouth.
  const browRow = life.brow > 0.3 ? 2 : 3;
  for (const col of [1, 2, 5, 6]) px(col, browRow, shadeHex(hair, 0.05));
  const eyeLook = life.lookX > 0.3 ? 1 : life.lookX < -0.3 ? -1 : 0;
  for (const side of [-1, 1]) {
    const base = side < 0 ? 1 : 5;
    if (open) {
      px(base, 4, '#fbfaf7');
      px(base + 1, 4, '#fbfaf7');
      px(base + (side < 0 ? 1 : 0) + eyeLook * 0, 4, '#3a2418');
      if (look.eyes === 'large') { px(base, 5, '#fbfaf7'); px(base + (side < 0 ? 1 : 0), 5, '#3a2418'); }
    } else {
      px(base, 4, '#2a2220');
      px(base + 1, 4, '#2a2220');
    }
  }
  px(3, 5, shadeHex(skin, -0.12));
  px(4, 5, shadeHex(skin, -0.12));
  const smile = life.smile > 0.5;
  for (const col of [3, 4]) px(col, 6, life.talk > 0.3 ? '#4a1f22' : '#9c4f4f');
  if (smile) { px(2, 6 - 0, '#9c4f4f'); px(5, 6, '#9c4f4f'); }
  if (life.talk > 0.3) px(3, 7, '#4a1f22'), px(4, 7, '#4a1f22');
  if (look.cheeks === 'flushed') { px(0, 5, '#f07882'); px(7, 5, '#f07882'); }
  if (look.stubble) for (const col of [1, 2, 3, 4, 5, 6]) if (!(life.talk > 0.3 && (col === 3 || col === 4))) px(col, 7, '#6b5a50');
  if (look.glasses) {
    const color = look.glasses === 'thickBlack' ? '#101010' : '#b6a27a';
    for (const col of [0, 1, 2, 3, 4, 5, 6, 7]) { px(col, 3 === browRow ? 4 : 3, color); }
  }
  // The hair shell around the cube.
  const hairRgb = hexToRgb(hair);
  if (look.hairStyle !== 'bald') {
    box(head, [0, half * 0.9, 0], [half + 0.06, half * 0.2, half + 0.06], hairRgb);
    box(head, [0, half * 0.35, -half * 0.9], [half + 0.06, half * 0.85, half * 0.2], hairRgb);
    for (const side of [-1, 1]) box(head, [side * (half + 0.03), half * 0.55, -half * 0.1], [0.05, half * 0.45, half * 0.9], hairRgb);
    if (look.hairStyle === 'long' || look.hairStyle === 'shoulderStraight') {
      box(head, [0, -1.0, -half * 0.9], [half + 0.06, 1.0, half * 0.2], hairRgb);
      for (const side of [-1, 1]) box(head, [side * (half + 0.03), -0.4, -half * 0.1], [0.05, 0.9, half * 0.9], hairRgb);
    } else if (look.hairStyle === 'ponytail') {
      box(head, [0.95, 0.0, -0.9], [0.22, 0.9, 0.22], hairRgb);
    }
  }
  head.angles[2] = life.tilt;
  return root;
}

// ── Toy family: one builder, many faces ────────────────────────────────
// opts: head (size multiplier), eyes (glossy | dot | bean | oval | sleepy),
//       mouth (smile | line | cat | dot), nose (none | dot | small), body (shoulder width).
function makeToy(opts) {
  const { head: headSize = 1.2, eyes = 'glossy', mouth = 'smile', nose = 'small', body = 0.7, lowEyes = true } = opts;
  return function variantToy(look, life) {
    const root = new Node();
    shoulders(root, look, body, 0.6);
    const head = root.add(new Node(0, 0.55 + headSize * 0.18, 0));
    const shape = { ...(engine.FACES[look.face] ?? engine.FACES.round) };
    const big = { w: shape.w * headSize, h: shape.h * (0.85 + headSize * 0.17), d: shape.d * (0.9 + headSize * 0.17), taper: shape.taper * 0.5 };
    ellipsoid(head, [0, 0, 0], [big.w, big.h, big.d], hexToRgb(look.skin), { lat: 24, lon: 36, deform: engine.faceDeform(big) });
    for (const side of [-1, 1]) ellipsoid(head, [side * big.w * 0.97, -0.1, 0], [0.12, 0.2, 0.12], hexToRgb(shadeHex(look.skin, -0.05)), { lat: 6, lon: 8 });
    const z = (x, y) => engine.surfaceZ(big, x, y);
    const open = 1 - life.blink;
    const eyeY = lowEyes ? -0.08 : 0.06;
    const spread = 0.4 + headSize * 0.08;
    const iris = hexToRgb('#3a2418');
    for (const side of [-1, 1]) {
      const x = side * spread;
      const holder = head.add(new Node(x, eyeY, z(x, eyeY) + 0.01));
      const gx = life.lookX;
      const closedLine = (w) => tube(holder, [[-w, 0, 0.07], [0, -0.09, 0.08], [w, 0, 0.07]], 0.04, '#1d1a1a', { sides: 3, bias: 0.9 });
      if (eyes === 'dot') {
        if (open > 0.2) ellipsoid(holder, [gx * 0.08, 0, 0.04], [0.085, 0.085 * open, 0.05], '#141010', { lat: 5, lon: 8, bias: 0.8 });
        else closedLine(0.1);
      } else if (eyes === 'bean') {
        if (open > 0.2) {
          ellipsoid(holder, [gx * 0.06, 0, 0.04], [0.1, 0.2 * open, 0.05], '#141010', { lat: 6, lon: 10, bias: 0.8 });
          ellipsoid(holder, [gx * 0.06 - 0.03, 0.07 * open, 0.09], [0.035, 0.05, 0.02], '#ffffff', { lat: 3, lon: 6, bias: 0.85 });
        } else closedLine(0.1);
      } else if (eyes === 'oval') {
        if (open > 0.2) {
          ellipsoid(holder, [0, 0, 0], [0.26, 0.22 * open, 0.05], '#ffffff', { lat: 5, lon: 12, bias: 0.7 });
          ellipsoid(holder, [gx * 0.1, 0, 0.05], [0.17, 0.2 * Math.min(1, open * 1.1), 0.04], iris, { lat: 5, lon: 10, bias: 0.75 });
          ellipsoid(holder, [gx * 0.1, 0, 0.08], [0.08, 0.1, 0.03], '#0a0807', { lat: 3, lon: 8, bias: 0.8 });
          ellipsoid(holder, [gx * 0.1 - 0.06, 0.08, 0.11], [0.05, 0.05, 0.02], '#ffffff', { lat: 3, lon: 6, bias: 0.85 });
        } else closedLine(0.24);
        tube(holder, [[-0.28, 0.18 * open, 0.07], [0, 0.26 * open, 0.08], [0.28, 0.18 * open, 0.07]], 0.03, '#1d1a1a', { sides: 3, bias: 0.9 });
      } else if (eyes === 'sleepy') {
        const lidDrop = 0.5 + life.blink * 0.5;
        ellipsoid(holder, [0, 0, 0], [0.24, 0.18, 0.05], '#fbfaf7', { lat: 5, lon: 12, bias: 0.7 });
        ellipsoid(holder, [gx * 0.08, -0.02, 0.05], [0.13, 0.13, 0.04], iris, { lat: 5, lon: 10, bias: 0.75 });
        ellipsoid(holder, [gx * 0.08, -0.02, 0.08], [0.06, 0.06, 0.03], '#0a0807', { lat: 3, lon: 6, bias: 0.8 });
        // The heavy lid: skin-coloured, pulled down over the top of the eye.
        ellipsoid(holder, [0, 0.18 - lidDrop * 0.2, 0.09], [0.27, 0.19 * lidDrop + 0.02, 0.05], hexToRgb(look.skin), { lat: 4, lon: 12, bias: 0.9 });
        tube(holder, [[-0.27, 0.0 + (0.18 - lidDrop * 0.2) * 0.1, 0.12], [0, -0.04 - lidDrop * 0.02, 0.13], [0.27, 0.0, 0.12]], 0.035, '#1d1a1a', { sides: 3, bias: 0.95 });
      } else {
        if (open > 0.15) {
          ellipsoid(holder, [0, 0, 0], [0.3, 0.34 * open, 0.06], '#ffffff', { lat: 6, lon: 12, bias: 0.7 });
          ellipsoid(holder, [gx * 0.1, 0, 0.05], [0.22, 0.25 * Math.min(1, open * 1.2), 0.05], hexToRgb(look.eyes === 'monolid' ? '#2a1d14' : '#3a2418'), { lat: 6, lon: 10, bias: 0.75 });
          ellipsoid(holder, [gx * 0.1, 0, 0.09], [0.11, 0.12, 0.03], '#0a0807', { lat: 4, lon: 8, bias: 0.8 });
          ellipsoid(holder, [gx * 0.1 - 0.08, 0.1, 0.12], [0.07, 0.07, 0.02], '#ffffff', { lat: 3, lon: 6, bias: 0.85 });
        } else closedLine(0.3);
      }
      const by = eyeY + (eyes === 'dot' ? 0.2 : eyes === 'sleepy' ? 0.28 : 0.4) + life.brow * 0.12;
      const browStyle = eyes === 'dot' ? 0.035 : 0.045;
      tube(head, [[side * (spread - 0.2), by, z(side * (spread - 0.2), by) + 0.02], [side * spread, by + 0.05, z(side * spread, by) + 0.02], [side * (spread + 0.26), by - 0.03 - life.brow * 0.05, z(side * (spread + 0.26), by) + 0.02]], browStyle, shadeHex(look.hair, 0.05), { sides: 4, bias: 0.8 });
      if (look.cheeks === 'flushed' || eyes === 'glossy' || eyes === 'oval') disc(head, [side * (spread + 0.28), eyeY - 0.4, z(side * (spread + 0.28), eyeY - 0.4) + 0.015], 0.2, 0.12, '#f07882', { segments: 8, alpha: 0.5 });
    }
    if (nose === 'small') ellipsoid(head, [0, eyeY - 0.3, z(0, eyeY - 0.3) + 0.03], [0.06, 0.05, 0.05], shadeHex(look.skin, -0.12), { lat: 3, lon: 6, bias: 0.7 });
    else if (nose === 'dot') ellipsoid(head, [0, eyeY - 0.28, z(0, eyeY - 0.28) + 0.02], [0.035, 0.035, 0.03], '#7a4a3a', { lat: 3, lon: 6, bias: 0.7 });
    const my = eyeY - 0.58;
    const mz = (x, y) => z(x, y) + 0.015;
    if (life.talk > 0.05) {
      disc(head, [0, my - life.talk * 0.05, mz(0, my)], 0.1 + life.talk * 0.05, 0.03 + life.talk * 0.1, '#6f2a2e', { segments: 10, bias: 0.72 });
    } else if (mouth === 'line') {
      const tilt = (life.smile - 0.3) * 0.12;
      tube(head, [[-0.16, my + tilt, mz(-0.16, my)], [0, my - Math.abs(tilt) * 0.3, mz(0, my)], [0.16, my + tilt, mz(0.16, my)]], 0.03, '#5a3030', { sides: 3, bias: 0.8 });
    } else if (mouth === 'dot') {
      disc(head, [0, my, mz(0, my)], 0.045, 0.045, '#6f2a2e', { segments: 8, bias: 0.8 });
    } else if (mouth === 'cat') {
      for (const side of [-1, 1]) {
        const pts = Array.from({ length: 6 }, (_, i) => { const a = (i / 5) * Math.PI; return [side * 0.1 + Math.cos(a + (side < 0 ? Math.PI : 0)) * 0.1 * 0 + (side * 0.1) * (1 - Math.cos(a)) * 0.9 - side * 0.0, my + 0.1 - Math.sin(a) * 0.1 * (0.6 + life.smile * 0.6), mz(0, my)]; });
        tube(head, pts.map(([x, y, zz]) => [x - side * 0.09, y, z(x - side * 0.09, y) + 0.015]), 0.028, '#7a3a3a', { sides: 3, bias: 0.8 });
      }
    } else {
      const span = 0.7 + life.smile * 0.8;
      const arc = Array.from({ length: 7 }, (_, i) => { const a = -span / 2 + (span * i) / 6; const x = Math.sin(a) * 0.26; const y = my - Math.cos(a) * 0.26 + 0.26; return [x, y, mz(x, y)]; });
      tube(head, arc, 0.03, '#9c4f4f', { sides: 3, bias: 0.8 });
    }
    if (look.glasses) {
      const thick = look.glasses === 'thickBlack';
      const r = eyes === 'dot' || eyes === 'bean' ? 0.3 : 0.4;
      for (const side of [-1, 1]) tube(head, Array.from({ length: 14 }, (_, i) => [side * spread + Math.cos((i / 14) * Math.PI * 2) * r, eyeY + Math.sin((i / 14) * Math.PI * 2) * r * 0.95, z(side * spread, eyeY) + 0.12]), thick ? 0.05 : 0.022, thick ? '#0d0d0d' : '#b6a27a', { sides: 4, closed: true, bias: 0.95 });
    }
    hairFor(head, look, big, 1.04);
    head.angles[2] = life.tilt;
    return root;
  };
}

export const VARIANTS = [
  { id: 't1', name: 'T1 · Big glossy', build: makeToy({ head: 1.22, eyes: 'glossy', mouth: 'smile', nose: 'small' }), note: 'The pick so far: huge glossy eyes, blush, smile.' },
  { id: 't2', name: 'T2 · Dots and a line', build: makeToy({ head: 1.18, eyes: 'dot', mouth: 'line', nose: 'none', lowEyes: false }), note: 'Black dot eyes, a straight line mouth. Deadpan; brows do all the acting.' },
  { id: 't3', name: 'T3 · Beans and a cat mouth', build: makeToy({ head: 1.2, eyes: 'bean', mouth: 'cat', nose: 'dot' }), note: 'Tall bean eyes with a spark, a cat-style "w" mouth. Cute, playful.' },
  { id: 't4', name: 'T4 · Anime ovals, medium head', build: makeToy({ head: 1.05, eyes: 'oval', mouth: 'smile', nose: 'small', body: 0.85 }), note: 'A smaller head, oval eyes with a lid line. Closest to normal proportions.' },
  { id: 't5', name: 'T5 · Sleepy lids', build: makeToy({ head: 1.1, eyes: 'sleepy', mouth: 'line', nose: 'small', body: 0.8, lowEyes: false }), note: 'Half-lidded eyes and a flat mouth. Weary, dry; a great look for burnout and calm characters.' },
  { id: 't6', name: 'T6 · Small head, dot eyes', build: makeToy({ head: 0.95, eyes: 'dot', mouth: 'dot', nose: 'dot', body: 0.95, lowEyes: false }), note: 'A near-realistic head with dot eyes and a dot mouth. The most grown-up.' },
];

export function renderBust(context, variant, look, life, x, y, u, yaw = -0.3) {
  const root = variant.build(look, { ...NEUTRAL, ...life });
  root.angles[1] = yaw;
  const faces = [];
  flatten(root, rotation(0, 0, 0), [0, 0, 0], faces);
  paint(context, faces, x, y, u);
}
export { NEUTRAL };
