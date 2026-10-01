// Props as 3D models, for the isometric scenes: cars, houses, apartment
// blocks and umbrellas, built from the same primitives as the cast
// (model3d.js) and drawn through the same lit, culled, depth-sorted
// painter. Everything is authored in the scenes' own world units (x and y
// along the ground, z up), then viewed from the scenes' isometric angle, so
// a prop can be dropped at any `k.iso(x, y)` point and sits with the flat
// boxes around it.

import { engine } from './model3d.js';

const { Node, ellipsoid, prism, box, tube, disc, flatten, paint, rotation, hexToRgb, shadeHex, pushFace } = engine;

// The scenes squash height (a tile is 1 wide and half as tall on screen), so
// a unit of z is this much of a true unit.
const V = 0.8165;
const PITCH = Math.PI / 6;
const YAW = -Math.PI / 4;
const TILE_SCALE = Math.SQRT2;

/** A world-space box as an engine box. */
function wbox(node, x, y, z, w, d, h, color, bias = 0) {
  box(node, [x + w / 2, (z + h / 2) * V, y + d / 2], [w / 2, (h / 2) * V, d / 2], color, bias);
}

/** A frustum between two rectangles (bottom and top), for windscreens, roofs and cabins. */
function frustum(node, bottom, top, color, bias = 0) {
  const [bx0, bx1, by0, by1, bz] = bottom;
  const [tx0, tx1, ty0, ty1, tz] = top;
  const p = (x, y, z) => [x, z * V, y];
  const c = [p(bx0, by0, bz), p(bx1, by0, bz), p(bx1, by1, bz), p(bx0, by1, bz), p(tx0, ty0, tz), p(tx1, ty0, tz), p(tx1, ty1, tz), p(tx0, ty1, tz)];
  const centre = [(bx0 + bx1) / 2, ((bz + tz) / 2) * V, (by0 + by1) / 2];
  const quad = (a, b, cc, d) => pushFace(node, [c[a], c[b], c[cc], c[d]], centre, color, bias);
  quad(0, 1, 5, 4); quad(1, 2, 6, 5); quad(2, 3, 7, 6); quad(3, 0, 4, 7); quad(4, 5, 6, 7); quad(0, 1, 2, 3);
}

/** A flat quad in world space, for glass and door panels (drawn in front of what it sits on). */
function wquad(node, points, color, bias = 0.5) {
  const centre = points.reduce((s, q) => [s[0] + q[0] / points.length, s[1] + q[2] * V / points.length, s[2] + q[1] / points.length], [0, 0, 0]);
  pushFace(node, points.map(([x, y, z]) => [x, z * V, y]), centre, color, bias);
}

// ── Cars ───────────────────────────────────────────────────────────────

// Each car is a profile and a stance. `top` is the height of the upper
// surface along the body as [position 0..1, height]: the bonnet, the rake of
// the windscreen, the roof, the rear glass and the boot. `belt` is where the
// glass starts. `glass` is the [start, end] of the windscreen, roof glass and
// rear glass as positions along the body.
const CARS = {
  hatchback: {
    body: '#c9b48a', L: 1.95, W: 0.92, lift: 0.14, belt: 0.5, wheel: 0.2, tumble: 0.74,
    top: [[0, 0.3], [0.05, 0.38], [0.3, 0.5], [0.44, 0.9], [0.72, 0.95], [0.9, 0.62], [0.98, 0.48], [1, 0.4]],
    glass: { front: [0.31, 0.43], rear: [0.76, 0.9], side: [0.34, 0.84] }, worn: true,
  },
  sedan: {
    body: '#8d9aa8', L: 2.25, W: 0.95, lift: 0.14, belt: 0.5, wheel: 0.2, tumble: 0.72,
    top: [[0, 0.3], [0.05, 0.4], [0.3, 0.5], [0.42, 0.92], [0.62, 0.96], [0.76, 0.58], [0.93, 0.56], [1, 0.46]],
    glass: { front: [0.3, 0.41], rear: [0.63, 0.75], side: [0.34, 0.73] },
  },
  suv: {
    body: '#222831', L: 2.35, W: 1.02, lift: 0.2, belt: 0.68, wheel: 0.25, tumble: 0.8, rack: true,
    top: [[0, 0.46], [0.05, 0.56], [0.3, 0.68], [0.4, 1.18], [0.82, 1.2], [0.94, 0.9], [1, 0.62]],
    glass: { front: [0.3, 0.4], rear: [0.83, 0.93], side: [0.33, 0.9] },
  },
  sports: {
    body: '#c8102e', L: 2.3, W: 0.96, lift: 0.1, belt: 0.34, wheel: 0.18, tumble: 0.66, spoiler: true,
    top: [[0, 0.24], [0.07, 0.3], [0.38, 0.38], [0.5, 0.7], [0.64, 0.72], [0.8, 0.46], [0.96, 0.46], [1, 0.4]],
    glass: { front: [0.38, 0.5], rear: [0.65, 0.79], side: [0.41, 0.74] },
  },
};

/** A smooth value along a keyed profile (cosine-eased between keys). */
function along(keys, t) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let index = 1; index < keys.length; index += 1) {
    if (t <= keys[index][0]) {
      const [t0, v0] = keys[index - 1];
      const [t1, v1] = keys[index];
      const f = (t - t0) / (t1 - t0);
      return v0 + (v1 - v0) * (1 - Math.cos(f * Math.PI)) / 2;
    }
  }
  return keys[keys.length - 1][1];
}

/**
 * The shell of a car, lofted: cross-sections along its length, each a ring
 * from the sill up over the shoulder, the glass and the roof and down the
 * other side. Panels in the glass zones are painted as glass.
 */
function loftBody(root, spec) {
  const { L, W, lift, belt, tumble, top, glass } = spec;
  const stations = 56;
  const half = W / 2;
  const body = hexToRgb(spec.body);
  const glassColor = hexToRgb('#7fa3bd');
  const trim = hexToRgb(shadeHex(spec.body, -0.55));
  const rings = [];
  for (let i = 0; i <= stations; i += 1) {
    const t = i / stations;
    const x = t * L;
    const zt = lift + along(top, t);
    const zb = Math.min(lift + belt, zt - 0.04);
    const nose = t < 0.1 ? 0.84 + t * 1.6 : t > 0.9 ? 0.86 + (1 - t) * 1.4 : 1;
    const w = half * nose;
    const inCabin = zt - zb > 0.1;
    const roofHalf = w * (inCabin ? tumble : 0.86);
    const side = (zb + zt) / 2;
    // Half ring, sill to centre line, then mirrored.
    const halfRing = [
      [w * 0.9, lift - 0.02],
      [w, lift + 0.08],
      [w, zb - 0.02],
      [w * 0.99, zb],
      [w * (1 + tumble) / 2 * 0.96, side],
      [roofHalf, zt - 0.03],
      [roofHalf * 0.5, zt + 0.005],
      [0, zt + 0.012],
    ];
    const ring = [...halfRing.map(([y, z]) => [half - y, z]), ...halfRing.slice(0, -1).reverse().map(([y, z]) => [half + y, z])];
    rings.push({ x, ring, zt, zb, t });
  }
  const point = (x, y, z) => [x, z * V, y];
  const centreOf = (x, zmid) => [x, zmid * V, half];
  for (let i = 0; i < stations; i += 1) {
    const r0 = rings[i];
    const r1 = rings[i + 1];
    const tm = (r0.t + r1.t) / 2;
    const cabin = r0.zt - r0.zb > 0.1 && r1.zt - r1.zb > 0.1;
    const inRange = (range) => tm >= range[0] && tm <= range[1];
    for (let j = 0; j < r0.ring.length - 1; j += 1) {
      const quad = [point(r0.x, ...r0.ring[j]), point(r1.x, ...r1.ring[j]), point(r1.x, ...r1.ring[j + 1]), point(r0.x, ...r0.ring[j + 1])];
      // j: 0-1 sill and lower side, 2 belt, 3-4 greenhouse side, 5-6 and the mirror: roof.
      const mirrored = Math.min(j, r0.ring.length - 2 - j);
      let color = body;
      const sideGlass = cabin && inRange(glass.side) && (mirrored === 3 || mirrored === 4);
      const frontGlass = inRange(glass.front) && mirrored >= 4;
      const rearGlass = inRange(glass.rear) && mirrored >= 4;
      if (sideGlass && Math.abs(tm - (glass.side[0] + glass.side[1]) / 2) > 0.012) color = glassColor;
      if (frontGlass || rearGlass) color = glassColor;
      if (mirrored === 0) color = trim;
      pushFace(root, quad, centreOf(tm * L, (r0.zt + r0.zb) / 2), color, color === glassColor ? 0.15 : 0);
    }
  }
  // The nose and tail: closed with fascia panels, with lights and a grille in front.
  const front = rings[stations];
  const rear = rings[0];
  const cap = (ring, x, dir, kind) => {
    const centre = centreOf(x, (ring.zt + ring.zb) / 2);
    for (let j = 0; j < ring.ring.length - 1; j += 1) {
      const outer = Math.min(j, ring.ring.length - 2 - j);
      const lower = outer === 0;
      const cx = (ring.ring[j][0] + ring.ring[j + 1][0]) / 2;
      const panel = [point(x, ...ring.ring[j]), point(x, ...ring.ring[j + 1]), point(x + dir * 0.02, ...ring.ring[j + 1]), point(x + dir * 0.02, ...ring.ring[j])];
      let color = body;
      if (kind === 'front' && outer <= 2 && outer >= 1) color = hexToRgb('#fff3c4');
      else if (kind === 'rear' && outer <= 2 && outer >= 1) color = hexToRgb('#b81f26');
      else if (lower) color = hexToRgb('#1a1c20');
      void cx;
      pushFace(root, panel, centre, color, 0.1);
    }
  };
  cap(front, L, 1, 'front');
  cap(rear, 0, -1, 'rear');
  // Grille, bumper bars, plates, lamps and a stripe of chrome across the nose.
  wbox(root, L - 0.005, half - 0.24, lift + 0.12, 0.03, 0.48, 0.1, '#15171a', 0.5);
  wbox(root, L - 0.005, half - 0.24, lift + 0.12, 0.034, 0.48, 0.012, '#c9ced4', 0.6);
  wbox(root, L - 0.03, 0.03, lift - 0.03, 0.06, W - 0.06, 0.06, '#2a2d33', 0.4);
  wbox(root, -0.02, 0.03, lift - 0.03, 0.06, W - 0.06, 0.06, '#2a2d33', 0.4);
  wbox(root, -0.03, half - 0.14, lift + 0.08, 0.02, 0.28, 0.1, '#f2f2ee', 0.6);
  for (const y of [0.1, W - 0.1]) wbox(root, L - 0.02, y - 0.06, lift + 0.11, 0.03, 0.12, 0.05, '#fff7d6', 0.7);
  // Door seams, handles, mirrors and a side moulding on the visible side.
  const seamZ0 = lift + 0.1;
  for (const frac of [0.33, 0.52, 0.72]) wbox(root, L * frac, W + 0.004, seamZ0, 0.008, 0.006, belt - 0.12, shadeHex(spec.body, -0.28), 0.3);
  for (const frac of [0.4, 0.6]) wbox(root, L * frac, W + 0.01, lift + belt - 0.1, 0.12, 0.014, 0.025, '#d3d8de', 0.5);
  wbox(root, L * 0.34, W + 0.003, lift + 0.2, L * 0.46, 0.008, 0.02, shadeHex(spec.body, -0.3), 0.3);
  for (const y of [-0.05, W + 0.01]) {
    wbox(root, L * 0.33, y, lift + belt + 0.02, 0.08, 0.055, 0.06, spec.body, 0.4);
    wbox(root, L * 0.335, y + (y < 0.5 ? 0.0 : 0.012), lift + belt + 0.035, 0.065, 0.03, 0.035, '#9fb4c4', 0.45);
  }
}

/** A wheel: a tyre, a rim with spokes and a hub, and a dark arch behind it. */
function wheel(node, x, y, side, r) {
  const sign = side > 0 ? 1 : -1;
  const cz = r;
  const arch = ellipsoid;
  arch(node, [x, (cz + 0.03) * V, y + sign * 0.02], [r * 1.1, r * 1.12 * V, 0.04], '#0e0f11', { lat: 3, lon: 20, bias: 0.15 });
  ellipsoid(node, [x, cz * V, y], [r, r * V, 0.11], '#141516', { lat: 5, lon: 22, bias: 0.25 });
  ellipsoid(node, [x, cz * V, y + sign * 0.07], [r * 0.68, r * 0.68 * V, 0.05], '#8c929a', { lat: 3, lon: 20, bias: 0.4 });
  ellipsoid(node, [x, cz * V, y + sign * 0.09], [r * 0.5, r * 0.5 * V, 0.03], '#5e646c', { lat: 3, lon: 16, bias: 0.45 });
  for (let spoke = 0; spoke < 5; spoke += 1) {
    const a = (spoke / 5) * Math.PI * 2 + 0.3;
    tube(node, [[x, cz * V, y + sign * 0.1], [x + Math.cos(a) * r * 0.6, (cz + Math.sin(a) * r * 0.6) * V, y + sign * 0.1]], 0.011, '#b9bec6', { sides: 3, bias: 0.55 });
  }
  ellipsoid(node, [x, cz * V, y + sign * 0.11], [r * 0.14, r * 0.14 * V, 0.03], '#2a2d33', { lat: 3, lon: 8, bias: 0.6 });
}

/** A detailed car, nose toward +x, standing on the ground at the origin. */
export function buildCar(kind) {
  const spec = CARS[kind] ?? CARS.sedan;
  const root = new Node();
  const { L, W, lift, belt, top } = spec;
  // The chassis, then the smooth lofted shell.
  wbox(root, 0.05, 0.05, lift - 0.06, L - 0.1, W - 0.1, 0.1, '#1a1c20');
  loftBody(root, spec);
  // Wheels at the four corners (the near side shows tyre and rim; the far side only a sliver).
  for (const x of [L * 0.2, L * 0.8]) {
    wheel(root, x, W + 0.012, 1, spec.wheel);
    wheel(root, x, -0.012, -1, spec.wheel);
  }
  if (spec.rack) {
    const roofZ = lift + along(top, 0.6);
    for (const y of [0.2, W - 0.22]) wbox(root, L * 0.42, y, roofZ - 0.01, L * 0.4, 0.035, 0.07, '#2a2d33', 0.4);
    for (const x of [L * 0.48, L * 0.7]) wbox(root, x, 0.16, roofZ + 0.05, 0.04, W - 0.32, 0.03, '#2a2d33', 0.4);
  }
  if (spec.spoiler) {
    wbox(root, 0.04, 0.2, lift + along(top, 0.06) + 0.08, 0.16, W - 0.4, 0.03, '#15171a', 0.55);
    for (const y of [0.2, W - 0.24]) wbox(root, 0.08, y, lift + along(top, 0.06), 0.04, 0.04, 0.1, '#15171a', 0.5);
    wbox(root, L * 0.33, W / 2 - 0.1, lift + along(top, 0.3) + 0.01, L * 0.17, 0.2, 0.025, shadeHex(spec.body, -0.35), 0.4);
  }
  if (spec.worn) {
    for (const [x, z] of [[0.35, 0.2], [0.55, 0.3], [1.3, 0.22], [1.55, 0.3]]) wbox(root, x, W + 0.014, lift + z, 0.12, 0.01, 0.07, '#8a4a28', 0.5);
    wbox(root, L * 0.35, W + 0.012, lift + belt - 0.04, 0.4, 0.01, 0.025, '#7a3a1e', 0.5);
  }
  void belt;
  return root;
}

// ── Houses and apartments ──────────────────────────────────────────────

/** A pitched roof (ridge along x) with courses of tiles. */
function gableRoof(node, x, y, z, w, d, h, color, overhang = 0.22) {
  const mid = y + d / 2;
  const ex = overhang;
  const ridge = z + h;
  const p = (px, py, pz) => [px, pz * V, py];
  const centre = [x + w / 2, (z + h / 2) * V, mid];
  pushFace(node, [p(x - ex, y - ex, z), p(x + w + ex, y - ex, z), p(x + w + ex, mid, ridge), p(x - ex, mid, ridge)], centre, color);
  pushFace(node, [p(x - ex, y + d + ex, z), p(x - ex, mid, ridge), p(x + w + ex, mid, ridge), p(x + w + ex, y + d + ex, z)], centre, shadeHex(color, -0.14));
  pushFace(node, [p(x, y, z), p(x, y + d, z), p(x, mid, ridge)], centre, shadeHex(color, 0.1));
  pushFace(node, [p(x + w, y, z), p(x + w, mid, ridge), p(x + w, y + d, z)], centre, shadeHex(color, -0.1));
  for (let i = 1; i < 5; i += 1) {
    const f = i / 5;
    const yy = y - ex + (mid - y + ex) * f;
    wquad(node, [[x - ex, yy, z + h * f + 0.012], [x + w + ex, yy, z + h * f + 0.012], [x + w + ex, yy + 0.03, z + h * f + 0.03], [x - ex, yy + 0.03, z + h * f + 0.03]], shadeHex(color, -0.22), 0.1);
  }
}

function windowPane(node, x, y, z, w, h, side, frame = '#f2f2ee', glass = '#86a9c4', shutters = false) {
  // side 'front' faces +y (toward the camera); 'right' faces +x.
  if (side === 'front') {
    wbox(node, x - 0.05, y + 0.005, z - 0.05, w + 0.1, 0.03, h + 0.1, frame, 0.5);
    wbox(node, x, y + 0.03, z, w, 0.012, h, glass, 0.6);
    wbox(node, x + w / 2 - 0.012, y + 0.04, z, 0.024, 0.012, h, frame, 0.7);
    wbox(node, x, y + 0.04, z + h / 2 - 0.012, w, 0.012, 0.024, frame, 0.7);
    if (shutters) for (const sx of [x - 0.2, x + w + 0.05]) wbox(node, sx, y + 0.005, z, 0.15, 0.03, h, '#3f6a56', 0.55);
  } else {
    wbox(node, x + 0.005, y - 0.05, z - 0.05, 0.03, w + 0.1, h + 0.1, frame, 0.5);
    wbox(node, x + 0.03, y, z, 0.012, w, h, glass, 0.6);
    wbox(node, x + 0.04, y + w / 2 - 0.012, z, 0.012, 0.024, h, frame, 0.7);
  }
}

/** A house. Kinds: 'modest' (a cottage), 'family' (two storeys, a garage), 'villa' (modern cubes). */
export function buildHouse(kind) {
  const root = new Node();
  if (kind === 'villa') {
    wbox(root, 0, 0, 0, 6.5, 3.5, 2.4, '#fbfbf8');
    wbox(root, 1.5, 0.5, 2.4, 4, 2.5, 1.8, '#f2f2ee');
    wbox(root, -0.2, -0.2, 2.4, 6.9, 3.9, 0.12, '#cfd3d8');
    wbox(root, 1.3, 0.3, 4.2, 4.4, 2.9, 0.12, '#cfd3d8');
    wbox(root, 0.4, 3.5, 0.3, 4.6, 0.02, 1.7, '#8ec2e0', 0.5);
    wbox(root, 1.8, 3.0, 2.6, 3.4, 0.02, 1.4, '#8ec2e0', 0.5);
    for (let i = 0; i < 6; i += 1) wbox(root, 0.45 + i * 0.78, 3.51, 0.3, 0.05, 0.03, 1.7, '#e8e8e3', 0.6);
    wbox(root, 5.2, 3.5, 0.1, 1.1, 0.02, 2.1, '#8a6a42', 0.5);
    wbox(root, -0.5, 3.5, 0, 7.5, 1.4, 0.1, '#d9c7a8', 0);
    wbox(root, 0.5, 3.8, 0.1, 1.4, 0.5, 0.18, '#ffffff', 0.2);
    wbox(root, 2.2, 3.8, 0.1, 1.4, 0.5, 0.18, '#ffffff', 0.2);
    for (const x of [0.6, 1.4, 2.3, 3.1]) wbox(root, x, 4.35, 0.2, 0.1, 0.04, 0.35, '#e9e4d8', 0.2);
    wbox(root, 0.5, 5.2, 0, 5, 2.4, 0.04, '#4cc3e8', 0);
    wbox(root, 0.45, 5.15, 0, 5.1, 0.06, 0.1, '#d9d4c4', 0.1);
    wbox(root, 0.5, 5.2, 0.04, 5, 0.04, 0.02, '#bfefff', 0.2);
    for (let i = 0; i < 4; i += 1) wbox(root, 1.7 + i * 0.95, 1.0, 4.34, 0.8, 1.4, 0.04, '#27406b', 0.3);
    return root;
  }
  if (kind === 'family') {
    wbox(root, 0, 0, 0, 6, 4, 2.8, '#f0e8da');
    wbox(root, 0, 0, 0, 6, 0.15, 0.7, '#a85a3e');
    wbox(root, 6, 0.3, 0, 2.4, 3.4, 1.9, '#e6dccb');
    gableRoof(root, 0, 0, 2.8, 6, 4, 1.7, '#3f4a5a');
    gableRoof(root, 6, 0.3, 1.9, 2.4, 3.4, 0.9, '#3f4a5a', 0.15);
    wbox(root, 6.3, 3.69, 0, 1.8, 0.03, 1.5, '#d7d3c8', 0.5);
    for (let i = 1; i < 5; i += 1) wbox(root, 6.3, 3.71, i * 0.3, 1.8, 0.012, 0.015, '#9a958a', 0.7);
    wbox(root, 2.3, 4.0, 0, 1.4, 0.9, 0.12, '#b8b2a6', 0.2);
    wbox(root, 2.55, 3.99, 0.12, 0.9, 0.03, 1.6, '#7a3a2e', 0.5);
    wbox(root, 3.2, 3.98, 0.8, 0.07, 0.06, 0.07, '#d9b44a', 0.8);
    wbox(root, 2.3, 3.9, 1.85, 1.4, 0.7, 0.1, '#3f4a5a', 0.3);
    for (const x of [2.3, 3.5]) wbox(root, x, 4.5, 0.12, 0.1, 0.1, 1.73, '#f2f2ee', 0.3);
    for (const [x, z] of [[0.6, 0.9], [4.0, 0.9], [0.6, 3.0], [2.45, 3.0], [4.0, 3.0]]) windowPane(root, x, 4.0, z, 0.9, 0.95, 'front', '#f2f2ee', '#86a9c4', true);
    for (const y of [1.0, 2.4]) windowPane(root, 6.0, y, 0.7, 0.8, 0.9, 'right');
    wbox(root, 4.6, 1.2, 2.8, 0.5, 0.5, 2.5, '#9a5a44');
    wbox(root, 4.55, 1.15, 5.3, 0.6, 0.6, 0.08, '#6b4234');
    wbox(root, 6.3, 4.0, 0, 1.8, 3.2, 0.03, '#8d9096', 0);
    wbox(root, 2.35, 4.9, 0, 1.3, 2.3, 0.025, '#b8b2a6', 0);
    return root;
  }
  wbox(root, 0, 0, 0, 4, 3, 2.2, '#e8dcc6');
  wbox(root, 0, 0, 0, 4, 0.12, 0.45, '#9a5a44');
  gableRoof(root, 0, 0, 2.2, 4, 3, 1.4, '#7a4a3a');
  wbox(root, 1.55, 3.0, 0, 0.9, 0.03, 1.55, '#7a5a3a', 0.5);
  wbox(root, 2.25, 3.02, 0.75, 0.07, 0.05, 0.07, '#d9b44a', 0.8);
  wbox(root, 1.35, 3.0, 1.55, 1.3, 0.5, 0.08, '#7a4a3a', 0.3);
  for (const x of [1.35, 2.55]) wbox(root, x, 3.45, 0, 0.08, 0.08, 1.55, '#f2f2ee', 0.3);
  for (const x of [0.4, 2.8]) windowPane(root, x, 3.0, 0.9, 0.8, 0.8, 'front', '#f2f2ee', '#86a9c4', true);
  windowPane(root, 4.0, 1.0, 0.9, 0.8, 0.8, 'right');
  wbox(root, 3.1, 0.7, 2.2, 0.45, 0.45, 2.0, '#9a5a44');
  wbox(root, 3.05, 0.65, 4.15, 0.55, 0.55, 0.07, '#6b4234');
  for (let i = 0; i < 4; i += 1) wbox(root, 1.7, 3.5 + i * 0.4, 0, 0.5, 0.3, 0.03, '#b8b2a6', 0);
  for (let i = 0; i < 12; i += 1) if (i < 4 || i > 6) wbox(root, -0.5 + i * 0.5, 5.2, 0, 0.07, 0.04, 0.6, '#f4f2ea', 0);
  wbox(root, -0.5, 5.2, 0.35, 6, 0.03, 0.04, '#f4f2ea', 0);
  for (const x of [0.1, 2.9]) {
    wbox(root, x, 3.6, 0, 0.9, 0.35, 0.2, '#5a4030', 0);
    for (let f = 0; f < 4; f += 1) wbox(root, x + 0.1 + f * 0.2, 3.7, 0.2, 0.08, 0.08, 0.22, ['#d9534f', '#e9b949', '#c77adf', '#ffffff'][f], 0.3);
  }
  wbox(root, 5.0, 5.0, 0, 0.05, 0.05, 0.8, '#6b5038');
  wbox(root, 4.9, 4.95, 0.8, 0.28, 0.16, 0.16, '#3f5a7a', 0.3);
  return root;
}

/** An apartment block. Kinds: 'worn' (a tired walk-up with balconies), 'nice', 'tower' (a glass tower). */
export function buildApartment(kind) {
  const root = new Node();
  if (kind === 'tower') {
    wbox(root, 0, 0, 0, 3.4, 3.4, 12, '#9db8cf');
    for (let floor = 0; floor < 14; floor += 1) {
      wbox(root, -0.02, -0.02, 0.4 + floor * 0.84, 3.44, 3.44, 0.06, '#e7edf3', 0.2);
      for (let c = 0; c < 4; c += 1) wbox(root, 0.1 + c * 0.82, 3.41, 0.48 + floor * 0.84, 0.7, 0.02, 0.62, floor % 5 === 2 ? '#ffe9a8' : '#4f7ea6', 0.5);
    }
    wbox(root, 0.3, 3.4, 0, 2.8, 0.7, 0.9, '#d9dde2', 0);
    wbox(root, 0.3, 4.1, 0.9, 2.8, 0.05, 0.12, '#2b2f36', 0);
    wbox(root, 0.6, 0.6, 12, 2.2, 2.2, 0.4, '#cfd3d8');
    wbox(root, 1.6, 1.6, 12.4, 0.12, 0.12, 1.5, '#6b7078');
    return root;
  }
  const worn = kind === 'worn';
  const wall = worn ? '#b9ad9a' : '#e4ddd0';
  wbox(root, 0, 0, 0, 5, 3, 6, wall);
  wbox(root, 0, 0, 0, 5, 0.1, 0.5, worn ? '#8d8577' : '#a89f8e');
  wbox(root, -0.1, -0.1, 6, 5.2, 3.2, 0.2, worn ? '#6b6e73' : '#4f5660');
  wbox(root, 0.1, 0.1, 6.2, 0.9, 0.7, 0.45, '#c9ccd0');
  for (let floor = 0; floor < 4; floor += 1) {
    const z = 0.8 + floor * 1.35;
    for (let column = 0; column < 4; column += 1) {
      const x = 0.35 + column * 1.2;
      if (column === 1 || column === 2) {
        wbox(root, x - 0.1, 3.0, z - 0.1, 0.9, 0.55, 0.1, worn ? '#8d8577' : '#c9c3b6', 0.2);
        for (let r = 0; r < 6; r += 1) wbox(root, x - 0.08 + r * 0.16, 3.52, z, 0.03, 0.03, 0.5, worn ? '#4a4d52' : '#2b2f36', 0.2);
        wbox(root, x - 0.1, 3.52, z + 0.5, 0.9, 0.03, 0.03, worn ? '#4a4d52' : '#2b2f36', 0.2);
        wbox(root, x + 0.05, 3.0, z + 0.1, 0.6, 0.012, 0.8, '#6f94ae', 0.5);
        if (floor === 1) wbox(root, x + 0.2, 3.3, z + 0.1, 0.15, 0.15, 0.2, '#c0572b', 0.4);
        if (worn && floor === 2) wbox(root, x + 0.05, 3.3, z + 0.1, 0.6, 0.2, 0.3, '#b8b2a0', 0.4);
      } else {
        windowPane(root, x, 3.0, z, 0.7, 0.8, 'front', worn ? '#cfc7b8' : '#f2f2ee', '#6f94ae');
      }
    }
  }
  for (let floor = 1; floor < 4; floor += 2) wbox(root, 4.2, 3.0, 0.8 + floor * 1.35 + 0.2, 0.5, 0.35, 0.35, '#d9dde2', 0.4);
  wbox(root, 2.1, 3.0, 0, 0.9, 0.03, 1.4, '#3f4a5a', 0.5);
  wbox(root, 1.9, 3.0, 1.45, 1.3, 0.55, 0.1, worn ? '#7a4a3a' : '#3f6a56', 0.3);
  wbox(root, 3.1, 3.0, 0.6, 0.15, 0.03, 0.3, '#2b2f36', 0.6);
  for (let i = 0; i < 3; i += 1) wbox(root, 1.8, 3.1 + i * 0.2, 0, 1.1, 0.2, 0.08 * (i + 1), '#b8b2a6', 0);
  if (worn) {
    for (const [x, z] of [[0.6, 2.4], [3.9, 1.0]]) wbox(root, x, 3.0, z, 0.5, 0.012, 0.6, '#8c8374', 0.2);
    wbox(root, 4.8, 1.0, 0, 0.3, 0.9, 1.0, '#4a6a4a', 0);
  }
  return root;
}

// ── Umbrella ───────────────────────────────────────────────────────────

/** An open umbrella: a canopy of eight panels over a shaft with a hooked handle; origin at the handle's foot. */
export function buildUmbrella(color = '#111111', accent = null) {
  const root = new Node();
  const rgb = hexToRgb(color);
  const alt = accent ? hexToRgb(accent) : hexToRgb(shadeHex(color, 0.12));
  const radius = 0.9;
  const rise = 0.42;
  const base = 2.85;
  const panels = 8;
  const rings = 4;
  const height = (r) => base + rise * (1 - (r / radius) ** 2);
  for (let panel = 0; panel < panels; panel += 1) {
    const a0 = (panel / panels) * Math.PI * 2;
    const a1 = ((panel + 1) / panels) * Math.PI * 2;
    const am = (a0 + a1) / 2;
    for (let ring = 0; ring < rings; ring += 1) {
      const r0 = (ring / rings) * radius;
      const r1 = ((ring + 1) / rings) * radius;
      const sag = ring === rings - 1 ? 0.08 : 0;
      const p = (r, a, drop = 0) => [Math.cos(a) * r, (height(r) - drop) * V, Math.sin(a) * r];
      const points = ring === 0
        ? [p(0, a0), p(r1, a0), p(r1, am), p(r1, a1), p(0, a1)]
        : [p(r0, a0), p(r1, a0, sag), p(r1, am, sag + 0.03), p(r1, a1, sag), p(r0, a1)];
      pushFace(root, points, [0, base * V, 0], panel % 2 ? alt : rgb, 0.1);
    }
  }
  for (let panel = 0; panel < panels; panel += 1) {
    const a = (panel / panels) * Math.PI * 2;
    tube(root, [[0, (base + rise) * V, 0], [Math.cos(a) * radius * 0.5, (base + rise * 0.75) * V, Math.sin(a) * radius * 0.5], [Math.cos(a) * radius, (base - 0.04) * V, Math.sin(a) * radius]], 0.012, '#2a2a2e', { sides: 3, bias: -0.1 });
  }
  prism(root, [0, 0.5 * V, 0], [0, (base + rise + 0.2) * V, 0], 0.025, 0.025, '#2a2a2e', { sides: 6, caps: false });
  prism(root, [0, (base + rise) * V, 0], [0, (base + rise + 0.25) * V, 0], 0.03, 0.01, '#b9a45a', { sides: 6 });
  tube(root, [[0, 0.5 * V, 0], [0, 0.18 * V, 0], [0.12, 0.05 * V, 0], [0.26, 0.2 * V, 0]], 0.04, '#3a2a1e', { sides: 5, bias: 0 });
  void disc;
  return root;
}

// ── Drawing ────────────────────────────────────────────────────────────

/**
 * Draw a prop at a scene point. `origin` is where the prop's (0, 0, 0)
 * lands on screen, and `unit` is the scene kit's unit.
 */
export function drawProp(context, root, origin, unit) {
  root.angles = [PITCH, YAW, 0];
  const faces = [];
  flatten(root, rotation(0, 0, 0), [0, 0, 0], faces);
  paint(context, faces, origin.x, origin.y, unit * TILE_SCALE);
}

const cache = new Map();
function cached(key, build) {
  if (!cache.has(key)) cache.set(key, build());
  return cache.get(key);
}

export const drawCar = (context, k, x, y, kind, z = 0) => drawProp(context, cached(`car:${kind}`, () => buildCar(kind)), k.iso(x, y, z), k.unit);
export const drawHouse = (context, k, x, y, kind) => drawProp(context, cached(`house:${kind}`, () => buildHouse(kind)), k.iso(x, y), k.unit);
export const drawApartment = (context, k, x, y, kind) => drawProp(context, cached(`apt:${kind}`, () => buildApartment(kind)), k.iso(x, y), k.unit);
export const drawUmbrella = (context, k, x, y, z, color, accent) => drawProp(context, cached(`umb:${color}:${accent}`, () => buildUmbrella(color, accent)), k.iso(x, y, z), k.unit);
