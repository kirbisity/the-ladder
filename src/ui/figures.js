// People. Every figure in the game (portraits, the office, the cut scenes)
// is the 3D model in model3d.js, built from a look card:
//   face: round | soft | structured | narrow (pointy) | square
//   hairStyle: sideSwept | shoulderStraight | bob | ponytail | cleanShort | long | bald
//   brows: thickCurved | soft | straight
//   eyes: monolid | innerDouble | large | focused
//   nose: soft | delicate | bridge
//   mouth: gentle | smileTeeth | animated | composed
//   glasses: thickBlack | aviator (optional); cheeks: flushed; stubble: true
//   build: thin (a slighter body)
//   faceStyle: a key of FACE_STYLES in the config (head size, eyes, mouth, nose); faceTweaks overrides it
// Expressions override the mouth and eyes: happy, sad, crying, blank, sleep.

import { drawFigure3D, drawHead3D } from './model3d.js';

/** A figure standing (or posed) with its feet at (x, y), u pixels to a head radius. */
export function drawPerson(context, x, y, u, look, { pose = 'standing', outfit = null, expression = null, time = 0, facing = 1, yaw = undefined } = {}) {
  context.save();
  context.translate(x, y);
  context.scale(facing, 1);
  drawFigure3D(context, 0, 0, u, look, { pose, outfit, expression, time, yaw });
  context.restore();
}

/** A head and neck centred at (x, y), radius r, optionally tilted. */
export function drawHead(context, x, y, r, look, { expression = null, time = 0, tilt = 0 } = {}) {
  context.save();
  context.translate(x, y);
  context.rotate(tilt);
  drawHead3D(context, 0, 0, r, look, { expression, time });
  context.restore();
}

/** A worker at a desk, seen from behind and to the side, typing. */
export function drawSeatedWorker(context, seatX, seatY, u, look, { time = 0, typingRate = 1, posture = 'upright' } = {}) {
  drawFigure3D(context, seatX, seatY, u, look, { pose: 'typing', view: 'back', posture, time: time * typingRate * 4.5 });
}

export function peerLook(id) {
  const pick = (list, salt) => list[Math.abs(Math.imul(id + salt, 2654435761)) % list.length];
  return {
    skin: pick(['#f1d2b0', '#e2b893', '#c99a76', '#8d5a3b', '#f4d6b8', '#6b4430'], 1),
    hair: pick(['#121212', '#3a2a1e', '#6b3b23', '#c9a15a', '#5a5a5a', '#1b1512'], 2),
    suit: pick(['#3c4f6e', '#5a3f2e', '#2e4a3d', '#4b3a63', '#444b55', '#6a2e35'], 3),
    shirt: pick(['#ffffff', '#e6eef8', '#f6efe4'], 4),
    face: pick(['round', 'soft', 'structured'], 5),
    hairStyle: pick(['sideSwept', 'shoulderStraight', 'bob', 'cleanShort', 'long', 'cleanShort'], 6),
    brows: pick(['soft', 'straight', 'thickCurved'], 7),
    eyes: pick(['monolid', 'innerDouble', 'large', 'focused'], 8),
    nose: pick(['soft', 'delicate', 'bridge'], 9),
    mouth: pick(['gentle', 'composed', 'smileTeeth'], 10),
    glasses: pick([null, null, null, 'thickBlack', 'aviator'], 11),
    stubble: pick([false, false, true], 12),
    faceStyle: pick(['glossy', 'dots', 'beans', 'anime', 'sleepy', 'small'], 13),
  };
}
