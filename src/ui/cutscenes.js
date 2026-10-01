// Cut scenes: short animated vignettes drawn in the office's isometric 3D
// style, with the player's own face and body. Endings run about twelve
// seconds; interim scenes for big moments about four. Every scene can be
// skipped, and all of them can be replayed from the developer menu.

import { drawPerson, drawHead, peerLook } from './figures.js';
import { mixColor } from './office.js';

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
  married: 'Wedding',
  child: 'A new baby',
  house: 'The keys',
  burnout: 'Burnout',
  healthScare: 'The ambulance',
  holiday: 'Holiday',
  fmla: 'Leave',
  startupWin: 'The exit',
};

// Journal moments that earn a short scene.
export const JOURNAL_SCENES = {
  promoted: 'promoted', lostJob: 'lostJob', rehired: 'newJob', joined: 'newJob', married: 'married', child: 'child', house: 'house',
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

function car(k, context, x, y, kind, time = 0) {
  const styles = {
    hatchback: { body: '#c9b48a', length: 1.6, height: 0.55, cabin: 0.45, rust: true },
    sedan: { body: '#9aa5b1', length: 2.0, height: 0.5, cabin: 0.42 },
    suv: { body: '#1e2228', length: 2.2, height: 0.75, cabin: 0.5 },
    sports: { body: '#c8102e', length: 2.2, height: 0.38, cabin: 0.3 },
  };
  const style = styles[kind];
  k.box(x, y, 0.15, style.length, 0.9, style.height, style.body);
  k.box(x + style.length * 0.25, y + 0.08, 0.15 + style.height, style.length * 0.5, 0.74, style.cabin, mixColor(style.body, '#9fc4e0', 0.55));
  for (const [wx, wy] of [[0.3, 0.9], [style.length - 0.35, 0.9]]) {
    const wheel = k.iso(x + wx, y + wy, 0.15);
    context.fillStyle = '#111111';
    context.beginPath();
    context.ellipse(wheel.x, wheel.y, k.unit * 0.18, k.unit * 0.18, 0, 0, Math.PI * 2);
    context.fill();
  }
  if (style.rust) {
    context.fillStyle = 'rgba(120, 60, 30, 0.6)';
    const spot = k.iso(x + 0.4, y + 0.9, 0.35);
    context.beginPath();
    context.ellipse(spot.x, spot.y, k.unit * 0.12, k.unit * 0.08, 0, 0, Math.PI * 2);
    context.fill();
  }
  if (kind === 'sports' || kind === 'suv') {
    const light = k.iso(x + style.length, y + 0.7, 0.4);
    context.fillStyle = `rgba(255, 245, 200, ${0.6 + 0.3 * Math.sin(time * 3)})`;
    context.fillRect(light.x - 2, light.y - 2, 5, 4);
  }
}

// ── Scenes ─────────────────────────────────────────────────────────────

function mourners(seed) {
  return [0, 1, 2, 3, 4].map((index) => peerLook(seed * 7 + index * 13 + 3));
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
      sky(context, width, height, '#5d6670', '#9aa3ab');
      const pan = Math.min(1, time / 10) * width * 0.04;
      const k = kit(context, width, height, Math.min(width, height * 1.7) / 17, width / 2 - pan, height * 0.34);
      k.ground(-16, -16, 18, 18, '#4f6a4a');
      k.ground(-1, -16, 0, 18, '#77736a');
      tree(k, context, -4.5, -3.5, { height: 4, bare: true, trunk: '#3b3330' });
      for (let row = -4; row <= 5; row += 3) {
        for (let column = -5; column <= 6; column += 2.4) {
          if (Math.abs(column - 2.2) < 1.5 && Math.abs(row - 2) < 2) continue;
          k.box(column, row, 0, 0.7, 0.18, 0.9 + ((row * 3 + column) % 2 + 2) % 2 * 0.25, '#8f9396');
        }
      }
      // The grave: mound, headstone, flowers, a portrait on an easel.
      k.box(1.6, 2.1, 0, 1.4, 2.2, 0.18, '#5b4634');
      k.box(1.6, 1.7, 0, 1.4, 0.3, 1.5, '#a7aaad');
      const stone = k.iso(2.3, 1.85, 1.15);
      context.fillStyle = '#3b3e42';
      context.font = `600 ${Math.max(9, k.unit * 0.22)}px Barlow Condensed, sans-serif`;
      context.textAlign = 'center';
      context.fillText(data.name.toUpperCase(), stone.x - k.unit * 0.3, stone.y);
      context.fillText(`${data.born}–${data.died}`, stone.x - k.unit * 0.3, stone.y + k.unit * 0.3);
      for (let flower = 0; flower < 9; flower += 1) {
        const point = k.iso(1.8 + (flower % 3) * 0.45, 2.4 + Math.floor(flower / 3) * 0.6, 0.22);
        context.fillStyle = ['#e7e2f0', '#f2c5d0', '#ffffff'][flower % 3];
        context.beginPath();
        context.arc(point.x, point.y, k.unit * 0.09, 0, Math.PI * 2);
        context.fill();
      }
      k.box(3.5, 1.1, 0, 0.08, 0.08, 1.3, '#4a3828');
      const frame = k.iso(3.55, 1.15, 1.6);
      context.fillStyle = '#2b2018';
      context.fillRect(frame.x - k.unit * 0.42, frame.y - k.unit * 0.5, k.unit * 0.84, k.unit * 0.95);
      context.fillStyle = '#d9cdb8';
      context.fillRect(frame.x - k.unit * 0.36, frame.y - k.unit * 0.44, k.unit * 0.72, k.unit * 0.83);
      drawHead(context, frame.x, frame.y, k.unit * 0.24, data.look, { time });
      const black = { top: '#1a1b1e', bottom: '#111214', shirt: '#2b2c30' };
      mourners(data.seed).forEach((look, index) => {
        const spots = [[0.3, 4.6], [1.2, 5.2], [2.4, 5.4], [3.6, 5.1], [4.6, 4.4]];
        const [x, y] = spots[index];
        k.person(x, y, look, { pose: 'mourning', expression: 'crying', outfit: black, time: time + index });
        if (index === 2) {
          const top = k.iso(x, y, 3.4);
          context.fillStyle = '#111';
          context.beginPath();
          context.arc(top.x, top.y, k.unit * 0.95, Math.PI, 0);
          context.fill();
          context.fillRect(top.x - 1, top.y, 2, k.unit * 1.2);
        }
      });
      rain(context, width, height, time, { count: 140, speed: 700, color: 'rgba(200, 210, 225, 0.35)', slant: 0.1 });
      context.fillStyle = 'rgba(30, 35, 45, 0.12)';
      context.fillRect(0, 0, width, height);
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

  fire: {
    duration: 14,
    captions: (data) => [
      `At ${data.age}, ${data.firstName} decided the money was enough.`,
      'Paris in the spring. Fuji in cherry blossom. A beach with no Wi-Fi.',
      'No alarm clock. No calendar invites. The whole world, one place at a time.',
    ],
    draw(context, width, height, time, data) {
      const stage = Math.min(3, Math.floor(time / 3.5));
      const local = time - stage * 3.5;
      if (stage === 0) {
        // A world map with a flight arcing across it.
        sky(context, width, height, '#0f2a4a', '#1d4f7a');
        context.fillStyle = '#2f6a4f';
        for (const [x, y, rx, ry] of [[0.22, 0.4, 0.12, 0.16], [0.28, 0.68, 0.06, 0.14], [0.5, 0.38, 0.09, 0.12], [0.53, 0.62, 0.07, 0.15], [0.72, 0.42, 0.16, 0.14], [0.82, 0.72, 0.06, 0.05]]) {
          context.beginPath();
          context.ellipse(width * x, height * y, width * rx, height * ry, 0, 0, Math.PI * 2);
          context.fill();
        }
        const progress = Math.min(1, local / 3.2);
        context.setLineDash([6, 8]);
        context.strokeStyle = 'rgba(255, 255, 255, 0.7)';
        context.lineWidth = 2;
        context.beginPath();
        const start = { x: width * 0.22, y: height * 0.42 };
        const control = { x: width * 0.5, y: height * 0.05 };
        const end = { x: width * 0.78, y: height * 0.45 };
        for (let step = 0; step <= 40 * progress; step += 1) {
          const t = step / 40;
          const x = (1 - t) ** 2 * start.x + 2 * (1 - t) * t * control.x + t ** 2 * end.x;
          const y = (1 - t) ** 2 * start.y + 2 * (1 - t) * t * control.y + t ** 2 * end.y;
          if (step === 0) context.moveTo(x, y);
          else context.lineTo(x, y);
        }
        context.stroke();
        context.setLineDash([]);
        const t = progress;
        const px = (1 - t) ** 2 * start.x + 2 * (1 - t) * t * control.x + t ** 2 * end.x;
        const py = (1 - t) ** 2 * start.y + 2 * (1 - t) * t * control.y + t ** 2 * end.y;
        context.fillStyle = '#ffffff';
        context.save();
        context.translate(px, py);
        context.rotate(Math.atan2(height * 0.3 * (1 - 2 * t), width * 0.56) - 0.1);
        context.fillRect(-14, -3, 28, 6);
        context.fillRect(-4, -12, 6, 24);
        context.restore();
        return;
      }
      const traveller = { top: '#d97706', bottom: '#3f5a73', shirt: '#fff4dc' };
      if (stage === 1) {
        sky(context, width, height, '#f6a46b', '#fde2b8');
        const k = kit(context, width, height, Math.min(width, height * 1.6) / 16, width / 2, height * 0.6);
        context.fillStyle = '#b8a88e';
        context.fillRect(0, height * 0.7, width, height * 0.3);
        // An iron lattice tower on the skyline.
        const base = { x: width * 0.72, y: height * 0.7 };
        context.strokeStyle = '#4a3a2e';
        context.lineWidth = 3;
        context.beginPath();
        context.moveTo(base.x - width * 0.08, base.y);
        context.quadraticCurveTo(base.x - width * 0.02, base.y - height * 0.3, base.x, base.y - height * 0.58);
        context.quadraticCurveTo(base.x + width * 0.02, base.y - height * 0.3, base.x + width * 0.08, base.y);
        context.moveTo(base.x - width * 0.05, base.y - height * 0.2);
        context.lineTo(base.x + width * 0.05, base.y - height * 0.2);
        context.moveTo(base.x - width * 0.025, base.y - height * 0.38);
        context.lineTo(base.x + width * 0.025, base.y - height * 0.38);
        context.stroke();
        k.box(-6, 1, 0, 1.2, 0.8, 0.9, '#d8c6a8');
        k.person(-1 + local * 0.5, 4, data.look, { pose: 'walking', expression: 'happy', outfit: traveller, time });
      } else if (stage === 2) {
        sky(context, width, height, '#9cc8ec', '#e8f3fb');
        context.fillStyle = '#5a6d86';
        context.beginPath();
        context.moveTo(width * 0.25, height * 0.68);
        context.lineTo(width * 0.55, height * 0.22);
        context.lineTo(width * 0.85, height * 0.68);
        context.fill();
        context.fillStyle = '#ffffff';
        context.beginPath();
        context.moveTo(width * 0.47, height * 0.34);
        context.lineTo(width * 0.55, height * 0.22);
        context.lineTo(width * 0.63, height * 0.34);
        context.lineTo(width * 0.58, height * 0.31);
        context.lineTo(width * 0.55, height * 0.35);
        context.lineTo(width * 0.51, height * 0.31);
        context.fill();
        const k = kit(context, width, height, Math.min(width, height * 1.6) / 16, width / 2, height * 0.6);
        context.fillStyle = '#7fa36a';
        context.fillRect(0, height * 0.68, width, height * 0.32);
        tree(k, context, -3, 3, { crown: '#f3b6c8', height: 2.6 });
        tree(k, context, 3.5, 1.5, { crown: '#f7c6d4', height: 2.4 });
        k.person(0.5, 4.2, data.look, { pose: 'waving', expression: 'happy', outfit: traveller, time });
        falling(context, width, height, time, ['#f7c6d4', '#ffffff', '#f3a5bb'], { count: 50, speed: 50, size: 6 });
      } else {
        sky(context, width, height, '#4fb3e8', '#c7ecff');
        context.fillStyle = '#2a8fc7';
        context.fillRect(0, height * 0.45, width, height * 0.25);
        context.fillStyle = '#fff3c4';
        context.beginPath();
        context.arc(width * 0.8, height * 0.18, height * 0.08, 0, Math.PI * 2);
        context.fill();
        const k = kit(context, width, height, Math.min(width, height * 1.6) / 16, width / 2, height * 0.62);
        context.fillStyle = '#f0dca4';
        context.fillRect(0, height * 0.7, width, height * 0.3);
        for (let wave = 0; wave < 4; wave += 1) {
          context.strokeStyle = 'rgba(255, 255, 255, 0.6)';
          context.beginPath();
          const y = height * 0.66 + wave * 4 + Math.sin(time * 2 + wave) * 2;
          context.moveTo(0, y);
          for (let x = 0; x <= width; x += 20) context.lineTo(x, y + Math.sin(x / 30 + time * 3) * 2);
          context.stroke();
        }
        tree(k, context, -3.5, 2, { palm: true, crown: '#2f7d3b', trunk: '#8a6a42', height: 3.5 });
        k.box(1.5, 3.5, 0, 1.6, 0.7, 0.25, '#ffffff');
        k.person(2.3, 3.9, data.look, { pose: 'sitting', expression: 'happy', outfit: { top: '#1aa3a3', bottom: '#f4d06f', shirt: '#1aa3a3' }, time, z: 0.25 });
      }
    },
  },

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
  married: interim(4, () => ['Just married.'], (context, width, height, time, data, k) => {
    sky(context, width, height, '#bfe3f7', '#f4fbff');
    k.ground(-4, -2, 6, 6, '#8fc47a');
    const arch = k.iso(0.6, 0.6, 0);
    context.strokeStyle = '#ffffff';
    context.lineWidth = k.unit * 0.18;
    context.beginPath();
    context.arc(arch.x, arch.y - k.unit * 2.2, k.unit * 1.6, Math.PI, 0);
    context.stroke();
    k.person(0, 1.5, data.look, { pose: 'standing', expression: 'happy', time, outfit: { top: '#1d2433', bottom: '#1d2433', shirt: '#ffffff' } });
    k.person(1.3, 1.5, peerLook(data.seed + 5), { pose: 'waving', expression: 'happy', time, outfit: { top: '#f6f2ea', bottom: '#f6f2ea', shirt: '#f6f2ea' } });
    falling(context, width, height, time, ['#ffffff', '#f7c6d4', '#ffe9a8'], { count: 70, speed: 70, size: 5 });
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
    k.box(-2, -2, 0, 3, 2.4, 2, '#e8dcc6');
    k.roof(-2.2, -2.2, 2, 3.4, 2.8, 1.3, '#9a4a3a');
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
  healthScare: interim(3.8, () => ['Chest pains. Sirens.'], (context, width, height, time, data, k) => {
    sky(context, width, height, '#0b1020', '#1a2240');
    k.ground(-4, -2, 6, 6, '#2a2f3a');
    k.box(-1.5, 0, 0.2, 3, 1.4, 1.6, '#f2f2f2');
    k.box(1.5, 0.05, 0.2, 0.9, 1.3, 1.1, '#f2f2f2');
    k.box(-1.5, -0.01, 0.9, 3, 0.02, 0.3, '#c8102e');
    const light = k.iso(0, 0.7, 1.9);
    const on = Math.sin(time * 12) > 0;
    context.fillStyle = on ? '#ff3b3b' : '#3b7bff';
    context.beginPath();
    context.arc(light.x, light.y, k.unit * 0.18, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = on ? 'rgba(255, 50, 50, 0.08)' : 'rgba(50, 100, 255, 0.08)';
    context.fillRect(0, 0, width, height);
  }),
  holiday: interim(4, (data) => [`${data.firstName} switches off. Properly.`], (context, width, height, time, data, k) => {
    sky(context, width, height, '#4fb3e8', '#c7ecff');
    context.fillStyle = '#2a8fc7';
    context.fillRect(0, height * 0.42, width, height * 0.2);
    k.ground(-4, -1, 6, 6, '#f0dca4');
    k.box(0, 1.5, 0, 1.6, 0.7, 0.25, '#ffffff');
    const pole = k.iso(-0.3, 1.8, 2.2);
    context.fillStyle = '#e5484d';
    context.beginPath();
    context.arc(pole.x, pole.y, k.unit * 1.1, Math.PI, 0);
    context.fill();
    k.person(0.8, 1.9, data.look, { pose: 'sitting', expression: 'happy', outfit: { top: '#1aa3a3', bottom: '#f4d06f', shirt: '#1aa3a3' }, time, z: 0.25 });
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

function interim(duration, captions, draw) {
  return {
    duration,
    captions,
    draw(context, width, height, time, data) {
      const k = kit(context, width, height, Math.min(width, height * 1.6) / 13, width / 2, height * 0.52);
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
      const k = kit(context, width, height, Math.min(width, height * 1.6) / 22, width / 2, height * 0.6);
      const lawn = ['#9aa092', '#7fb06a', '#6aa85a', '#76b35f'][tier];
      k.ground(-16, -14, 18, 18, lawn);
      k.ground(4.5, -14, 6, 18, '#6d7178');
      const arrive = Math.min(1, time / 3.5);
      if (tier === 0) {
        // A worn apartment block with a balcony.
        k.box(-4, -3, 0, 5, 3, 6, '#b9ad9a');
        for (let floor = 0.8; floor < 6; floor += 1.4) for (let column = -3.6; column < 0.8; column += 1.1) k.box(column, -0.02, floor, 0.6, 0.02, 0.7, '#5f7a8c');
        k.box(-1.2, 0, 2.8, 1.8, 0.8, 0.12, '#8d8577');
        k.person(-0.4, 0.5, data.look, { pose: 'sitting', expression: null, outfit: { top: '#7b7568', bottom: '#4b4740', shirt: '#7b7568' }, time, z: 2.92 });
        car(k, context, 4.7, 4.5 - (1 - arrive) * 4, 'hatchback', time);
      } else if (tier === 1) {
        k.box(-3.5, -2.5, 0, 4, 3, 2.2, '#e8dcc6');
        k.roof(-3.7, -2.7, 2.2, 4.4, 3.4, 1.4, '#7a4a3a');
        k.box(-1.2, 0.5, 0, 1.5, 0.05, 1.5, '#7a5a3a');
        for (let plant = 0; plant < 5; plant += 1) k.box(-3 + plant * 0.6, 1.5, 0, 0.3, 0.3, 0.5 + (plant % 2) * 0.2, '#4f8a45');
        tree(k, context, 2.5, -2, { height: 3 });
        k.person(-0.6, 2.2, data.look, { pose: 'standing', expression: 'happy', outfit: { top: '#5b7f9a', bottom: '#c9b48a', shirt: '#ffffff' }, time });
        car(k, context, 4.6, 4 - (1 - arrive) * 4, 'sedan', time);
      } else if (tier === 2) {
        k.box(-4.5, -3.5, 0, 6, 4, 2.8, '#f2ebe0');
        k.roof(-4.7, -3.7, 2.8, 6.4, 4.4, 1.6, '#3f4a5a');
        k.box(-1, 0.5, 0, 2, 0.05, 2, '#d9e6f2');
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
        car(k, context, 4.6, 3.8 - (1 - arrive) * 4, 'suv', time);
      } else {
        // A villa: white cubes, a pool, palms, the sea and a boat.
        k.ground(-16, -14, 18, -5, '#2a8fc7');
        const boat = k.iso(-3 + Math.sin(time * 0.2) * 2, -9);
        context.fillStyle = '#ffffff';
        context.beginPath();
        context.moveTo(boat.x - 30, boat.y);
        context.lineTo(boat.x + 30, boat.y);
        context.lineTo(boat.x + 20, boat.y + 8);
        context.lineTo(boat.x - 22, boat.y + 8);
        context.fill();
        k.box(-5, -3.5, 0, 6.5, 3.5, 2.4, '#fbfbf8');
        k.box(-3.5, -3, 2.4, 4, 2.5, 1.8, '#f6f6f2');
        k.box(-4.9, -0.02, 0.4, 6.2, 0.02, 1.6, '#9fc8e6');
        k.ground(-3.5, 1.2, 1.5, 3.4, '#4cc3e8');
        const shimmer = k.iso(-1 + Math.sin(time) * 1.5, 2.3, 0);
        context.fillStyle = 'rgba(255, 255, 255, 0.35)';
        context.fillRect(shimmer.x - 20, shimmer.y - 2, 40, 3);
        for (const [x, y] of [[2.5, -3], [3, 3.5], [-5.5, 2.5]]) tree(k, context, x, y, { palm: true, crown: '#2f7d3b', trunk: '#8a6a42', height: 4 });
        k.box(-0.4, 3.7, 0, 1.6, 0.6, 0.25, '#ffffff');
        k.person(0.3, 4.0, data.look, { pose: 'sitting', expression: 'happy', outfit: { top: '#ffffff', bottom: '#d9c7a8', shirt: '#ffffff' }, time, z: 0.25 });
        car(k, context, 4.6, 3.6 - (1 - arrive) * 4, 'sports', time);
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
    const line = Math.min(current.lines.length - 1, Math.floor(time / current.scene.duration * current.lines.length));
    if (caption.textContent !== current.lines[line]) caption.textContent = current.lines[line];
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
    const line = Math.min(current.lines.length - 1, Math.floor(seconds / current.scene.duration * current.lines.length));
    caption.textContent = current.lines[line];
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
