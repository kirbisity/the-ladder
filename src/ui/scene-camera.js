// The cut scenes' drawing kit, with two cameras. `iso` is the original
// isometric one (2:1 dimetric, everything the same size at every depth).
// `perspective` looks at the same ground from the same side and the same
// 30° down, but from a finite distance: things shrink toward the horizon,
// verticals lean toward the vanishing point, and a box shows the side
// that faces the camera. Scenes are written once, in kit coordinates
// (x right-down, y left-down, z up), and either camera draws them.

import { drawPerson } from './figures.js';
import { mixColor } from './office.js';

// Heights in kit units are drawn at this share of a ground unit, as in the props.
const HEIGHT_SCALE = 0.8165;
const ISO_PITCH = Math.PI / 6;

export const CAMERAS = {
  iso: { mode: 'iso' },
  // Distance in ground units from the point the scene is drawn around:
  // nearer is a wider lens and a stronger look.
  perspective: { mode: 'perspective', distance: 34, pitch: ISO_PITCH, near: 0.5 },
};

/** The camera every scene uses unless told otherwise. */
export const SCENE_CAMERA = { current: CAMERAS.perspective };

export function makeKit(context, unit, originX, originY, camera = SCENE_CAMERA.current) {
  const polygon = (points, fill) => {
    context.beginPath();
    points.forEach((point, index) => (index ? context.lineTo(point.x, point.y) : context.moveTo(point.x, point.y)));
    context.closePath();
    context.fillStyle = fill;
    context.fill();
  };
  if (camera.mode === 'iso') return isoKit(context, unit, originX, originY, polygon);
  return perspectiveKit(context, unit, originX, originY, polygon, camera);
}

function isoKit(context, unit, originX, originY, polygon) {
  const iso = (x, y, z = 0) => ({ x: originX + (x - y) * unit, y: originY + (x + y) * unit * 0.5 - z * unit });
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
  const view = (x, y, z = 0) => ({ ...iso(x, y, z), scale: 1, yaw: 0, pitch: ISO_PITCH });
  const person = (x, y, look, options) => {
    const point = iso(x, y, options.z ?? 0);
    drawPerson(context, point.x, point.y, unit * (options.size ?? 0.22), look, options);
  };
  return { iso, view, polygon, box, roof, ground, person, unit, camera: 'iso' };
}

function perspectiveKit(context, unit, originX, originY, polygon, camera) {
  const lateral = Math.SQRT2 * unit;
  const { distance, pitch, near } = camera;
  const cosine = Math.cos(pitch);
  const sine = Math.sin(pitch);
  const focal = lateral * distance;
  // The camera hangs over the (+x, +y) side, looking back at the origin.
  const cameraGround = distance * cosine;
  const cameraHeight = distance * sine;
  const cameraX = cameraGround / Math.SQRT2;
  const cameraZ = cameraHeight / HEIGHT_SCALE;

  /** A point in camera space: sideways, up and depth. */
  const toCamera = (x, y, z) => {
    const side = (x - y) / Math.SQRT2;
    const ground = (x + y) / Math.SQRT2 - cameraGround;
    const up = z * HEIGHT_SCALE - cameraHeight;
    return { side, up: -ground * sine + up * cosine, depth: -(ground * cosine + up * sine) };
  };
  const toScreen = (c) => {
    const depth = Math.max(near, c.depth);
    const scale = focal / depth;
    return { x: originX + c.side * scale, y: originY - c.up * scale };
  };
  const iso = (x, y, z = 0) => toScreen(toCamera(x, y, z));

  /** Scale, turn and tilt for a model standing at a point: it is seen from the camera's side. */
  const view = (x, y, z = 0) => {
    const c = toCamera(x, y, z);
    const point = toScreen(c);
    const dx = x - cameraX;
    const dy = y - cameraX;
    const azimuth = Math.atan2(dy, dx);
    const ground = Math.hypot(dx, dy);
    const lift = cameraZ * HEIGHT_SCALE - z * HEIGHT_SCALE;
    return { ...point, scale: distance / Math.max(near, c.depth), yaw: azimuth - Math.atan2(-1, -1), pitch: Math.atan2(lift, ground) };
  };

  /** A polygon of 3D points, cut at the near plane and drawn. */
  const polygon3 = (points, fill) => {
    const cameraPoints = points.map(([x, y, z]) => toCamera(x, y, z));
    const kept = [];
    for (let index = 0; index < cameraPoints.length; index += 1) {
      const a = cameraPoints[index];
      const b = cameraPoints[(index + 1) % cameraPoints.length];
      const aIn = a.depth >= near;
      const bIn = b.depth >= near;
      if (aIn) kept.push(a);
      if (aIn !== bIn) {
        const t = (near - a.depth) / (b.depth - a.depth);
        kept.push({ side: a.side + (b.side - a.side) * t, up: a.up + (b.up - a.up) * t, depth: near });
      }
    }
    if (kept.length >= 3) polygon(kept.map(toScreen), fill);
  };

  // Whether a face looks at the camera: its outward normal against the ray to the eye.
  const faces = (list, inside) => {
    for (const [points, color] of list) {
      const [p0, p1, p2] = points;
      const u = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
      const v = [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]];
      let normal = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      const away = [p0[0] - inside[0], p0[1] - inside[1], p0[2] - inside[2]];
      if (normal[0] * away[0] + normal[1] * away[1] + normal[2] * away[2] < 0) normal = normal.map((value) => -value);
      const toEye = [cameraX - p0[0], cameraX - p0[1], cameraZ - p0[2]];
      if (normal[0] * toEye[0] + normal[1] * toEye[1] + normal[2] * toEye[2] > 0) polygon3(points, color);
    }
  };

  const box = (x, y, z, w, d, h, color) => {
    const x1 = x + w;
    const y1 = y + d;
    const z1 = z + h;
    faces([
      [[[x, y1, z], [x1, y1, z], [x1, y1, z1], [x, y1, z1]], mixColor(color, '#000000', 0.12)],
      [[[x1, y, z], [x1, y1, z], [x1, y1, z1], [x1, y, z1]], mixColor(color, '#000000', 0.26)],
      [[[x, y, z], [x, y1, z], [x, y1, z1], [x, y, z1]], mixColor(color, '#000000', 0.2)],
      [[[x, y, z], [x1, y, z], [x1, y, z1], [x, y, z1]], mixColor(color, '#000000', 0.16)],
      [[[x, y, z1], [x1, y, z1], [x1, y1, z1], [x, y1, z1]], mixColor(color, '#ffffff', 0.08)],
    ], [x + w / 2, y + d / 2, z + h / 2]);
  };
  const roof = (x, y, z, w, d, h, color) => {
    const x1 = x + w;
    const y1 = y + d;
    const ridgeY = y + d / 2;
    const top = z + h;
    faces([
      [[[x, y, z], [x1, y, z], [x1, ridgeY, top], [x, ridgeY, top]], mixColor(color, '#ffffff', 0.05)],
      [[[x, y1, z], [x1, y1, z], [x1, ridgeY, top], [x, ridgeY, top]], mixColor(color, '#000000', 0.18)],
      [[[x1, y, z], [x1, y1, z], [x1, ridgeY, top]], mixColor(color, '#000000', 0.3)],
      [[[x, y, z], [x, y1, z], [x, ridgeY, top]], mixColor(color, '#000000', 0.22)],
    ], [x + w / 2, ridgeY, z + h / 3]);
  };
  const ground = (x0, y0, x1, y1, color) => polygon3([[x0, y0, 0], [x1, y0, 0], [x1, y1, 0], [x0, y1, 0]], color);
  const person = (x, y, look, options) => {
    const placed = view(x, y, options.z ?? 0);
    drawPerson(context, placed.x, placed.y, unit * (options.size ?? 0.22) * placed.scale, look, options);
  };
  return { iso, view, polygon, box, roof, ground, person, unit, camera: 'perspective' };
}
