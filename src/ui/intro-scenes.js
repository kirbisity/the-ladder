// The four beats of the opening, drawn in perspective with the same toy
// figures, props and light as the rest of the game: commencement on a
// college lawn, the family photograph after it, Monday morning outside the
// office tower, and the ladder up its face. Each beat is a drawing of a
// moment: time only moves the people and the weather.

import { makeKit } from './scene-camera.js';
import { peerLook } from './figures.js';
import { drawCar } from './props3d.js';
import { mixColor } from './office.js';
import { glow, hash, cloud, birds, fillPolygon, line } from './scenes-world.js';

const TAU = Math.PI * 2;
const GOWN = { top: '#1b2038', bottom: '#1b2038', shirt: '#1b2038' };
const REGALIA = { top: '#5a1f2e', bottom: '#5a1f2e', shirt: '#e6dcc4' };

function sky(context, width, height, top, bottom) {
  const gradient = context.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, top);
  gradient.addColorStop(1, bottom);
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
}

function tree(k, context, x, y, size = 3.4, crown = '#4f8c4f') {
  k.box(x - 0.1, y - 0.1, 0, 0.22, 0.22, size * 0.5, '#5b4030');
  const top = k.iso(x, y, size * 0.58);
  for (const [dx, dy, r, shade] of [[0, 0, 0.8, 0], [-0.5, 0.2, 0.55, -0.08], [0.5, 0.15, 0.6, 0.06], [0.1, -0.35, 0.5, 0.1]]) {
    context.fillStyle = mixColor(crown, shade >= 0 ? '#ffffff' : '#000000', Math.abs(shade));
    context.beginPath();
    context.arc(top.x + dx * k.unit, top.y - k.unit * (0.5 + dy), k.unit * r * 0.95, 0, TAU);
    context.fill();
  }
}

/** A classical hall: steps, columns, a pediment and a clock tower, in warm stone. */
function hall(context, k, x, y, time) {
  const stone = '#d9cdb5';
  k.box(x, y, 0, 16, 5, 6.5, stone);
  for (let step = 0; step < 4; step += 1) k.box(x + 3 - step * 0.3, y + 5 + step * 0.4, 0, 10 + step * 0.6, 0.45, 0.35 - step * 0.07, '#cfc6b2');
  for (let column = 0; column < 7; column += 1) k.box(x + 3.4 + column * 1.5, y + 5.4, 0.4, 0.5, 0.5, 6.2, '#efe6d2');
  k.roof(x + 2.6, y + 4.6, 6.7, 11, 2.2, 1.6, '#c9bfa5');
  k.box(x + 6.5, y - 0.5, 6.5, 3, 3, 5.5, stone);
  k.roof(x + 6.2, y - 0.8, 12, 3.6, 3.6, 2.4, '#6a7a8a');
  const face = k.iso(x + 8, y + 2.6, 9.4);
  context.fillStyle = '#fffbea';
  context.beginPath();
  context.arc(face.x, face.y, k.unit * 0.7, 0, TAU);
  context.fill();
  context.strokeStyle = '#3a3226';
  context.lineWidth = 2;
  context.stroke();
  const hand = (angle, length) => line(context, face.x, face.y, face.x + Math.cos(angle) * length, face.y + Math.sin(angle) * length, '#3a3226', 2);
  hand(-Math.PI / 2 + time * 0.02, k.unit * 0.5);
  hand(-Math.PI / 2 + 2.3, k.unit * 0.34);
  for (let window = 0; window < 6; window += 1) {
    const a = k.iso(x + 1.4 + window * 2.4, y + 5, 2);
    const b = k.iso(x + 2.2 + window * 2.4, y + 5, 2);
    const c = k.iso(x + 2.2 + window * 2.4, y + 5, 4.6);
    const d = k.iso(x + 1.4 + window * 2.4, y + 5, 4.6);
    k.polygon([a, b, c, d], '#7fa0b8');
  }
}

/** A mortarboard thrown in the air: a dark square with a tassel, tumbling. */
function cap(context, k, x, y, z, spin) {
  const p = k.iso(x, y, z);
  context.save();
  context.translate(p.x, p.y);
  context.rotate(spin);
  context.fillStyle = '#10131c';
  context.fillRect(-k.unit * 0.42, -k.unit * 0.1, k.unit * 0.84, k.unit * 0.2);
  context.fillStyle = '#f4c542';
  context.fillRect(k.unit * 0.28, k.unit * 0.04, 2, k.unit * 0.34);
  context.restore();
}

function confetti(context, width, height, time, count = 80) {
  const colors = ['#f4c542', '#e5484d', '#3b82f6', '#46b96b', '#ffffff', '#a05bd6'];
  for (let index = 0; index < count; index += 1) {
    const x = (hash(index) * width + Math.sin(time * 1.3 + index) * 24) % width;
    const y = ((hash(index + 7) * height + time * (60 + hash(index + 3) * 70)) % (height + 20)) - 10;
    context.save();
    context.translate(x, y);
    context.rotate(time * 3 + index);
    context.fillStyle = colors[index % colors.length];
    context.fillRect(-3, -1.5, 6, 3);
    context.restore();
  }
}

// ── Beat 1: commencement ───────────────────────────────────────────────

function commencement(context, width, height, time, data) {
  sky(context, width, height, '#8fc4ee', '#fdeccd');
  glow(context, width * 0.82, height * 0.14, height * 0.6, 'rgba(255,236,190,0.9)');
  cloud(context, width * 0.2 + Math.sin(time * 0.1) * 20, height * 0.12, 70, 'rgba(255,255,255,0.8)');
  cloud(context, width * 0.55 - Math.sin(time * 0.08) * 20, height * 0.07, 50, 'rgba(255,255,255,0.7)');
  const k = makeKit(context, Math.min(width, height * 1.7) / 40, width * 0.5, height * 0.6);
  // Lawn, mown in stripes, a gravel path to the stage, the hall and trees behind.
  k.ground(-60, -60, 60, 60, '#79ad5e');
  for (let stripe = -12; stripe < 14; stripe += 1) k.ground(stripe * 2, -30, stripe * 2 + 1, 30, '#72a557');
  k.ground(-1.2, -7, 1.2, 14, '#cbbd9a');
  hall(context, k, -24, -22, time);
  for (const [x, y] of [[-14, -12], [10, -13], [18, -9], [-20, -7], [24, -3]]) tree(k, context, x, y, 4.4);
  // Flags and a banner: the class year in gold on navy.
  for (const x of [-8, 8]) {
    k.box(x, -8.5, 0, 0.14, 0.14, 6, '#8a8f98');
    const top = k.iso(x + 0.1, -8.4, 6);
    fillPolygon(context, [[top.x, top.y], [top.x + k.unit * 1.4 + Math.sin(time * 3 + x) * 3, top.y + k.unit * 0.3], [top.x, top.y + k.unit * 0.8]], x < 0 ? '#c8352f' : '#f4c542');
  }
  // The stage: platform, steps, a red runner, backdrop, podium, flowers, regalia on chairs.
  k.box(-8, -8, 0, 16, 6.4, 1.5, '#8a6a46');
  for (let step = 0; step < 3; step += 1) k.box(-3, -1.6 + step * 0.45, 0, 6, 0.45, 0.5 + step * 0.0, '#9a7a56');
  k.ground(-1.2, -1.6, 1.2, 0.2, '#a02030');
  k.box(-8, -8.2, 1.5, 16, 0.3, 6, '#1d2b52');
  const crest = k.iso(0, -7.9, 5.6);
  context.fillStyle = '#f4c542';
  context.font = `700 ${Math.max(14, k.unit * 0.95)}px Barlow Condensed, sans-serif`;
  context.textAlign = 'center';
  context.fillText(`CLASS OF ${data.year}`, crest.x, crest.y);
  context.font = `600 ${Math.max(9, k.unit * 0.3)}px Barlow, sans-serif`;
  context.fillStyle = '#d8dcea';
  context.fillText('VERITAS · LABOR · FUTURUM', crest.x, crest.y + k.unit * 0.8);
  k.box(1.8, -6, 1.5, 1.1, 0.8, 1.7, '#5a3d2b');
  k.box(2.2, -6.1, 3.2, 0.06, 0.06, 0.6, '#8a8f98');
  for (const x of [-7.4, 6.4]) {
    k.box(x, -7.4, 1.5, 1, 1, 0.7, '#3a5a3a');
    const bloom = k.iso(x + 0.5, -6.9, 2.5);
    for (let flower = 0; flower < 6; flower += 1) {
      context.fillStyle = ['#e5484d', '#f4c542', '#ffffff', '#a05bd6'][flower % 4];
      context.beginPath();
      context.arc(bloom.x + (flower - 2.5) * 5, bloom.y - (flower % 2) * 5, 4.5, 0, TAU);
      context.fill();
    }
  }
  const seats = [[-6.4, -6.4], [-5.2, -6.4], [-4, -6.4], [4, -6.4], [5.2, -6.4], [6.4, -6.4]];
  seats.forEach(([x, y], index) => {
    k.box(x - 0.3, y - 0.3, 1.5, 0.7, 0.7, 0.4, '#5a3d2b');
    k.person(x, y, peerLook((data.seed ?? 1) + 400 + index), { pose: 'sitting', expression: 'happy', time: time + index, z: 1.9, size: 0.2, outfit: REGALIA });
  });
  const dean = peerLook((data.seed ?? 1) + 499);
  k.person(1.6, -4.6, dean, { pose: 'standing', expression: 'happy', time, z: 1.5, size: 0.21, outfit: REGALIA });
  // The graduate: up the steps, across to the dean, the handshake, the diploma raised.
  const cross = Math.min(1, time / 3.4);
  const gx = -5.5 + cross * 6.6;
  const gy = cross < 0.35 ? -0.2 - cross / 0.35 * 1.2 : -3.8;
  k.person(gx, gy, data.look, { pose: cross < 1 ? 'walking' : time > 4.6 ? 'waving' : 'standing', expression: 'happy', time: time * 2, z: cross < 0.35 ? cross / 0.35 * 1.5 : 1.5, size: 0.22, outfit: { ...GOWN, shirt: '#e8e8ea' } });
  if (cross >= 1 && time < 4.6) {
    const hands = k.iso(1.2, -3.9, 3.2);
    glow(context, hands.x, hands.y, 24, 'rgba(255,255,255,0.7)');
  }
  // The audience: rows of chairs and seated graduates in black gowns, parents behind with phones up, a photographer in the aisle.
  for (let row = 0; row < 3; row += 1) {
    for (let seat = 0; seat < 7; seat += 1) {
      const x = -9 + seat * 3;
      const y = 3 + row * 3;
      if (Math.abs(x) < 1.6) continue;
      k.box(x - 0.35, y - 0.3, 0, 0.8, 0.8, 0.5, '#f4f1ea');
      k.box(x - 0.35, y - 0.35, 0.5, 0.8, 0.08, 0.9, '#f4f1ea');
      if (hash(row * 9 + seat) > 0.12) k.person(x, y + 0.1, peerLook((data.seed ?? 1) + row * 17 + seat * 3), { pose: 'sitting', expression: 'happy', time: time + seat + row, z: 0.5, size: 0.2, outfit: GOWN });
    }
  }
  for (let parent = 0; parent < 7; parent += 1) {
    const x = -9 + parent * 3 + hash(parent) * 0.8;
    const y = 12.4 + (parent % 2) * 0.8;
    k.person(x, y, peerLook((data.seed ?? 1) + 640 + parent), { pose: Math.sin(time * 4 + parent) > 0.5 ? 'waving' : 'standing', expression: 'happy', time: time + parent, size: 0.22 });
    if (Math.sin(time * 2.1 + parent * 2.3) > 0.97) glow(context, k.iso(x, y, 2).x, k.iso(x, y, 2).y, 60, 'rgba(255,255,255,0.9)');
  }
  k.person(-3.5, 1.6, peerLook((data.seed ?? 1) + 777), { pose: 'standing', expression: null, time, size: 0.22, outfit: { top: '#2a2f3a', bottom: '#2a2f3a', shirt: '#e8e8e8' } });
  if (Math.sin(time * 3.7) > 0.96) glow(context, k.iso(-3.5, 1.6, 2).x, k.iso(-3.5, 1.6, 2).y, 90, 'rgba(255,255,255,0.95)');
  // The toss.
  if (time > 5.2) {
    const flight = time - 5.2;
    for (let index = 0; index < 22; index += 1) {
      const delay = hash(index) * 0.5;
      const t = Math.max(0, flight - delay);
      const rise = t * 9 - t * t * 3.6;
      cap(context, k, -9 + hash(index + 2) * 18, 5 + hash(index + 4) * 5, 2.4 + Math.max(0, rise), t * (3 + hash(index)));
    }
    confetti(context, width, height, time, 90);
  }
  birds(context, width, height, time, 5, 'rgba(40,40,50,0.55)');
}

// ── Beat 2: after the ceremony ─────────────────────────────────────────

function familyPhoto(context, width, height, time, data) {
  sky(context, width, height, '#9ccbf0', '#fff2d6');
  glow(context, width * 0.2, height * 0.16, height * 0.6, 'rgba(255,240,200,0.9)');
  const k = makeKit(context, Math.min(width, height * 1.7) / 30, width * 0.5, height * 0.62);
  k.ground(-60, -60, 60, 60, '#7db262');
  for (let stripe = -12; stripe < 14; stripe += 1) k.ground(stripe * 2, -30, stripe * 2 + 1, 30, '#76aa5b');
  k.ground(-3, -20, 3, 20, '#d0c19c');
  hall(context, k, -18, -22, time);
  for (const [x, y] of [[-10, -6], [9, -8], [14, -3], [-14, 2]]) tree(k, context, x, y, 4.8);
  // A balloon arch in the school colours, bunting, and a table with a cake.
  for (let balloon = 0; balloon < 18; balloon += 1) {
    const t = balloon / 17;
    const p = k.iso(-4 + t * 8, -2.6, 0.4 + Math.sin(t * Math.PI) * 4.4);
    context.fillStyle = ['#1d2b52', '#f4c542', '#ffffff'][balloon % 3];
    context.beginPath();
    context.arc(p.x, p.y, k.unit * 0.38, 0, TAU);
    context.fill();
  }
  k.box(7, 0, 0, 3, 1.4, 0.9, '#f4f1ea');
  k.box(7.6, 0.3, 0.9, 1.5, 0.8, 0.5, '#f6c6d4');
  k.box(7.9, 0.4, 1.4, 0.9, 0.5, 0.4, '#ffffff');
  // The graduate in the middle with the diploma, parents hugging them, friends in gowns tossing caps.
  const gown = { ...GOWN, shirt: '#e8e8ea' };
  k.person(0, 1.2, data.look, { pose: 'waving', expression: 'happy', time, size: 0.24, outfit: gown });
  k.person(-1.3, 1.6, peerLook((data.seed ?? 1) + 910), { pose: 'standing', expression: 'happy', time, size: 0.22 });
  k.person(1.4, 1.7, peerLook((data.seed ?? 1) + 911), { pose: 'standing', expression: 'happy', time, size: 0.22, facing: -1 });
  k.person(-2.5, 2.4, peerLook((data.seed ?? 1) + 912), { pose: 'waving', expression: 'happy', time: time + 1, size: 0.22, outfit: gown });
  k.person(2.6, 2.6, peerLook((data.seed ?? 1) + 913), { pose: 'waving', expression: 'happy', time: time + 2, size: 0.22, facing: -1, outfit: gown });
  k.person(0.3, 4.2, peerLook((data.seed ?? 1) + 914), { pose: 'standing', expression: null, time, size: 0.22, outfit: { top: '#2a2f3a', bottom: '#2a2f3a', shirt: '#e8e8e8' } });
  if (Math.sin(time * 2.2) > 0.9) glow(context, k.iso(0.3, 4.2, 2).x, k.iso(0.3, 4.2, 2).y, 100, 'rgba(255,255,255,0.9)');
  // The old car, boot open, boxes and a lamp sticking out: the move starts today.
  drawCar(context, k, 8.5, 6, 'hatchback', 0, 'lowpoly', Math.PI + 0.35);
  k.box(7.6, 5.4, 0.5, 0.8, 0.8, 0.7, '#b98f5a');
  k.box(8.4, 5.2, 0.5, 0.7, 0.7, 0.9, '#d9c7a0');
  k.box(9.2, 5.3, 0.5, 0.5, 1.0, 0.5, '#2f5f9a');
  falling(context, width, height, time);
  for (let cap_ = 0; cap_ < 5; cap_ += 1) cap(context, k, -3 + cap_ * 1.5, 1 + (cap_ % 2), 5 + Math.sin(time * 1.4 + cap_) * 1.2, time * 2 + cap_);
}

function falling(context, width, height, time) {
  confetti(context, width, height, time * 0.6, 40);
}

// ── Beat 3: Monday morning ─────────────────────────────────────────────

function tower(context, k, x, y, w, d, h, body, windows, lit) {
  k.box(x, y, 0, w, d, h, body);
  for (let floor = 0; floor < h - 1; floor += 1.1) {
    for (let column = 0; column < w - 0.6; column += 1) {
      const wx = x + 0.4 + column;
      const a = k.iso(wx, y + d, floor + 0.3);
      const b = k.iso(wx + 0.62, y + d, floor + 0.3);
      const c = k.iso(wx + 0.62, y + d, floor + 0.95);
      const e = k.iso(wx, y + d, floor + 0.95);
      k.polygon([a, b, c, e], hash(x * 7 + floor * 3 + column) > lit ? '#ffd98a' : windows);
    }
  }
}

function mondayMorning(context, width, height, time, data) {
  sky(context, width, height, '#f2a779', '#fde6bd');
  glow(context, width * 0.18, height * 0.32, height * 0.7, 'rgba(255,214,150,0.95)');
  const k = makeKit(context, Math.min(width, height * 1.7) / 38, width * 0.5, height * 0.76);
  k.ground(-60, -60, 60, 60, '#a8a49a');
  // The street: asphalt along x, kerbs, markings and a crossing.
  k.ground(-60, 3, 60, 10, '#4f545d');
  k.ground(-60, 2.2, 60, 3, '#b9bcc0');
  k.ground(-60, 10, 60, 10.8, '#b9bcc0');
  for (let dash = -30; dash < 30; dash += 2) k.ground(dash, 6.45, dash + 1, 6.55, '#e8dfa6');
  for (let stripe = 0; stripe < 8; stripe += 1) k.ground(-2 + stripe * 0.5, 3, -1.75 + stripe * 0.5, 10, '#e6e6e0');
  // The skyline, and the company's own tower in the middle, with its name in lit letters.
  tower(context, k, -22, -14, 6, 5, 20, '#6a7f9c', '#9fb8d2', 0.8);
  tower(context, k, -14, -17, 5, 5, 28, '#5f7490', '#a9c0d8', 0.75);
  tower(context, k, 12, -16, 6, 5, 24, '#6f84a2', '#a4bcd4', 0.8);
  tower(context, k, 20, -12, 5, 5, 16, '#7a8ea8', '#aac2d8', 0.8);
  tower(context, k, -6, -10, 12, 7, 32, '#3e5f86', '#8fc0e8', 0.85);
  k.box(-6, 0, 0, 12, 0.2, 3, '#c9dff0');
  for (const x of [-1.2, 0.6]) k.box(x, 0.05, 0, 0.9, 0.3, 2.6, '#a9d0f0');
  const sign = k.iso(0, -3.1, 12);
  context.fillStyle = '#ffffff';
  context.font = `700 ${Math.max(14, k.unit * 0.95)}px Barlow Condensed, sans-serif`;
  context.textAlign = 'center';
  context.fillText(data.company.toUpperCase(), sign.x, sign.y);
  glow(context, sign.x, sign.y, k.unit * 4, 'rgba(180,220,255,0.35)');
  // The plaza: a planter, lamp posts, a coffee cart with a queue, benches.
  k.ground(-12, 0.4, 14, 2.2, '#d6d0c4');
  for (const x of [-9, 8]) tree(k, context, x, 1.2, 3.2, '#5fa05a');
  k.box(5, 1.2, 0, 2, 1, 1.1, '#c8352f');
  k.box(4.8, 1.0, 1.1, 2.4, 1.4, 0.15, '#f4f1ea');
  const steam = k.iso(5.8, 1.7, 1.5);
  for (let wisp = 0; wisp < 3; wisp += 1) {
    const age = (time * 0.5 + wisp / 3) % 1;
    context.fillStyle = `rgba(255,255,255,${0.5 * (1 - age)})`;
    context.beginPath();
    context.arc(steam.x + Math.sin(age * 5) * 3, steam.y - age * 26, 3 + age * 5, 0, TAU);
    context.fill();
  }
  for (let queue = 0; queue < 3; queue += 1) k.person(7.6 + queue * 0.8, 1.7, peerLook((data.seed ?? 1) + 830 + queue), { pose: 'standing', expression: null, time, size: 0.2, facing: -1 });
  // Commuters, in both directions along the pavement, with bags and coffee.
  for (let walker = 0; walker < 8; walker += 1) {
    const direction = walker % 2 ? 1 : -1;
    const x = ((time * (1.2 + hash(walker) * 0.7) * direction + walker * 6.3) % 34) - 17;
    k.person(x, 2.6 + (walker % 3) * 0.2, peerLook((data.seed ?? 1) + 850 + walker), { pose: 'walking', expression: null, time: time * 2 + walker, size: 0.2, facing: direction });
  }
  // Traffic: a bus, a taxi, a sedan.
  const bus = (time * 2.4) % 50 - 25;
  k.box(bus, 7.4, 0.3, 6.4, 1.8, 2.2, '#2f7d6a');
  k.box(bus, 7.38, 1.2, 6.4, 0.04, 0.8, '#bfe0f4');
  const taxi = 20 - (time * 3.1) % 46;
  drawCar(context, k, taxi, 8.8, 'sedan', 0, 'lowpoly', Math.PI);
  drawCar(context, k, ((time * 2 + 14) % 44) - 22, 4.4, 'hatchback', 0, 'lowpoly', 0);
  // The new hire, in the one good suit, with a laptop bag, crossing toward the doors.
  const approach = Math.min(1, time / 4.2);
  k.person(-3 + approach * 2.6, 5.6 - approach * 4.2, data.look, { pose: approach < 1 ? 'walking' : 'standing', expression: 'happy', time: time * 2.2, size: 0.24, outfit: { top: '#2f3a4a', bottom: '#2f3a4a', shirt: '#ffffff' } });
  // Rays through the towers and birds.
  for (let ray = 0; ray < 4; ray += 1) fillPolygon(context, [[width * (0.04 + ray * 0.1), 0], [width * (0.09 + ray * 0.1), 0], [width * (0.3 + ray * 0.12), height], [width * (0.2 + ray * 0.12), height]], 'rgba(255,230,180,0.07)');
  birds(context, width, height, time, 6, 'rgba(60,40,40,0.5)');
}

// ── Beat 4: eight rungs ────────────────────────────────────────────────

function ladderUp(context, width, height, time, data) {
  sky(context, width, height, '#5aa0de', '#d9ecf8');
  const k = makeKit(context, Math.min(width, height * 1.7) / 60, width * 0.5, height * 0.95);
  k.ground(-60, -60, 60, 60, '#b9b6ac');
  // The tower, seen from its foot: the face climbing out of the picture, eight floors lit one by one.
  const h = 48;
  k.box(-6, -4, 0, 12, 5, h, '#33507a');
  const lit = Math.min(8, Math.floor(time / 0.75));
  for (let floor = 0; floor < 8; floor += 1) {
    const z0 = 3 + floor * 5.6;
    for (let column = 0; column < 11; column += 1) {
      const x = -5.6 + column * 1.05;
      const a = k.iso(x, 1, z0);
      const b = k.iso(x + 0.8, 1, z0);
      const c = k.iso(x + 0.8, 1, z0 + 2.8);
      const d = k.iso(x, 1, z0 + 2.8);
      k.polygon([a, b, c, d], floor < lit ? '#ffe3a0' : '#7fa9d2');
    }
    // The rung, a lit bar across the face, with the level's title beside it.
    const left = k.iso(-6.2, 1.05, z0 + 3.2);
    const right = k.iso(6.2, 1.05, z0 + 3.2);
    line(context, left.x, left.y, right.x, right.y, floor < lit ? '#f4c542' : 'rgba(255,255,255,0.3)', 5);
    if (floor < lit) glow(context, (left.x + right.x) / 2, left.y, k.unit * 5, 'rgba(255,220,120,0.18)');
    context.fillStyle = floor < lit ? '#fff7d6' : 'rgba(255,255,255,0.4)';
    context.font = `700 ${Math.max(10, k.unit * 0.55)}px Barlow Condensed, sans-serif`;
    context.textAlign = 'left';
    context.fillText(`${floor + 1}`, right.x + 8, right.y + 4);
  }
  // The doors at the bottom, the new hire standing before them, looking up.
  k.box(-1.4, 1.02, 0, 2.8, 0.2, 3, '#a9d0f0');
  k.person(0, 3.4, data.look, { pose: 'standing', expression: 'happy', time, size: 0.26, outfit: { top: '#2f3a4a', bottom: '#2f3a4a', shirt: '#ffffff' } });
  for (let walker = 0; walker < 5; walker += 1) k.person(-8 + ((time * 1.2 + walker * 4) % 18), 4.6 + (walker % 2) * 0.6, peerLook((data.seed ?? 1) + 960 + walker), { pose: 'walking', expression: null, time: time * 2 + walker, size: 0.24 });
  cloud(context, width * 0.8 + Math.sin(time * 0.1) * 20, height * 0.14, 60, 'rgba(255,255,255,0.8)');
  birds(context, width, height, time, 4, 'rgba(30,40,60,0.6)');
}

const BEATS = [commencement, familyPhoto, mondayMorning, ladderUp];

/** Draw one beat of the opening, `time` seconds into it. */
export function drawIntroBeat(context, width, height, beat, time, data) {
  BEATS[Math.min(beat, BEATS.length - 1)](context, width, height, time, data);
}

export const INTRO_BEATS = BEATS.length;
