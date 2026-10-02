// The Super Intelligence Revolution: a fast, cut-together sequence in
// perspective. A camera flies down an aisle of server racks, an AI stock
// chart goes vertical, agents work a floor of desks at impossible speed, and
// people carry boxes out past them. Each shot is short and moves; the cuts
// flash white.

import { makeKit } from './scene-camera.js';
import { peerLook } from './figures.js';
import { glow, hash, fillPolygon, line } from './scenes-world.js';

const TAU = Math.PI * 2;
const SHOT = 2.4;
const AGENT = { top: '#0f2a3a', bottom: '#0f2a3a', shirt: '#38e1ff' };

function sky(context, width, height, top, bottom) {
  const gradient = context.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, top);
  gradient.addColorStop(1, bottom);
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
}

/** Shot 1: the data centre. Racks in two rows, the camera racing down the aisle, lights chasing. */
function dataCentre(context, width, height, time) {
  sky(context, width, height, '#03060d', '#0b1426');
  const dolly = time * 9;
  const k = makeKit(context, Math.min(width, height * 1.7) / 22, width * 0.5 + Math.sin(time * 1.3) * 30, height * 0.62);
  k.ground(-60, -60, 60, 60, '#0a111c');
  for (let tile = -30; tile < 30; tile += 1) k.ground(tile, -60, tile + 0.04, 60, 'rgba(56,225,255,0.08)');
  for (let rack = 0; rack < 26; rack += 1) {
    const y = -28 + rack * 2.2 - (dolly % 2.2) - 4;
    for (const x of [-4.2, 3.0]) {
      k.box(x, y, 0, 1.2, 1.8, 4.6, '#121a26');
      for (let unit = 0; unit < 12; unit += 1) {
        for (let led = 0; led < 4; led += 1) {
          const on = hash(rack * 97 + unit * 13 + led + Math.floor(time * 12 + rack)) > 0.45;
          if (!on) continue;
          const p = k.iso(x + (x < 0 ? 1.21 : -0.01), y + 0.3 + led * 0.38, 0.4 + unit * 0.35);
          context.fillStyle = led % 3 ? '#38e1ff' : '#7dff8a';
          context.fillRect(p.x - 1.5, p.y - 1, 3, 2);
        }
      }
    }
  }
  // Cooling haze and a pulse of light racing toward the camera.
  const pulse = (time * 1.6) % 1;
  glow(context, width * 0.5, height * (0.2 + pulse * 0.6), height * 0.5, `rgba(56,225,255,${0.25 * (1 - pulse)})`);
  for (let streak = 0; streak < 30; streak += 1) {
    const x = width * hash(streak);
    const length = 40 + hash(streak + 3) * 120;
    const y = (hash(streak + 7) * height + time * 900) % (height + length) - length;
    line(context, x, y, x, y + length, 'rgba(56,225,255,0.18)', 1);
  }
}

/** Shot 2: the AI index goes vertical, ticker tape racing, the screen-glow on a trader's face. */
function stockRocket(context, width, height, time) {
  sky(context, width, height, '#04120a', '#0a2414');
  const left = width * 0.08;
  const right = width * 0.92;
  const top = height * 0.12;
  const bottom = height * 0.78;
  context.strokeStyle = 'rgba(125,255,138,0.12)';
  context.lineWidth = 1;
  for (let row = 0; row <= 6; row += 1) line(context, left, top + (bottom - top) * row / 6, right, top + (bottom - top) * row / 6, 'rgba(125,255,138,0.12)', 1);
  const progress = Math.min(1, time / (SHOT * 0.85));
  const points = [];
  const steps = 120;
  for (let step = 0; step <= steps * progress; step += 1) {
    const t = step / steps;
    const curve = Math.pow(t, 3.4) + 0.05 * Math.sin(t * 40) * t;
    points.push([left + (right - left) * t, bottom - (bottom - top) * Math.min(1.05, curve)]);
  }
  if (points.length > 1) {
    fillPolygon(context, [[points[0][0], bottom], ...points, [points[points.length - 1][0], bottom]], 'rgba(125,255,138,0.12)');
    context.strokeStyle = '#7dff8a';
    context.lineWidth = 4;
    context.beginPath();
    points.forEach(([x, y], index) => (index ? context.lineTo(x, y) : context.moveTo(x, y)));
    context.stroke();
    const [hx, hy] = points[points.length - 1];
    glow(context, hx, hy, 70, 'rgba(125,255,138,0.7)');
  }
  const value = Math.round(100 + 2900 * Math.pow(progress, 3));
  context.fillStyle = '#7dff8a';
  context.font = `700 ${Math.round(height * 0.11)}px Barlow Condensed, sans-serif`;
  context.textAlign = 'left';
  context.fillText(`AI INDEX ▲ ${value.toLocaleString('en-US')}%`, left, top + height * 0.08);
  // The ticker.
  context.fillStyle = '#0e1d14';
  context.fillRect(0, height * 0.86, width, height * 0.08);
  context.font = `700 ${Math.round(height * 0.04)}px Barlow Condensed, sans-serif`;
  const tickers = ['NVX ▲ 412%', 'AGNT ▲ 980%', 'MODL ▲ 655%', 'CLOUD ▲ 233%', 'BANKS ▼ 18%', 'TEMP ▼ 41%', 'COMPUTE ▲ 1,120%', 'HIRE ▼ 52%'];
  const tape = tickers.join('     ');
  const offset = (time * 420) % (context.measureText(tape).width + width);
  context.fillStyle = '#7dff8a';
  context.fillText(`${tape}     ${tape}`, width - offset, height * 0.915);
}

/** Shot 3: agents at the desks, glowing, typing at a blur; screens full of scrolling work. */
function agentsAtWork(context, width, height, time, data) {
  sky(context, width, height, '#0b1220', '#1a2438');
  const k = makeKit(context, Math.min(width, height * 1.7) / 20, width * 0.5 - time * 26, height * 0.6);
  k.ground(-60, -60, 60, 60, '#1e2a3c');
  for (let tile = -20; tile < 21; tile += 1) k.ground(tile, -30, tile + 0.03, 30, 'rgba(56,225,255,0.06)');
  for (let row = 0; row < 4; row += 1) {
    for (let column = 0; column < 6; column += 1) {
      const x = -9 + column * 3.6;
      const y = -6 + row * 3.2;
      k.box(x, y, 0, 2.4, 1.2, 1.1, '#2a3446');
      k.box(x + 0.5, y + 0.1, 1.1, 0.12, 1.0, 0.9, '#05080e');
      const screen = k.iso(x + 0.45, y + 0.6, 1.55);
      context.fillStyle = 'rgba(56,225,255,0.85)';
      for (let lineIndex = 0; lineIndex < 5; lineIndex += 1) {
        const scroll = ((time * 30 + lineIndex * 7 + column) % 30) / 30;
        context.fillRect(screen.x - 10, screen.y - 12 + scroll * 24, 8 + hash(row + column + lineIndex) * 12, 1.5);
      }
      glow(context, screen.x, screen.y, 40, 'rgba(56,225,255,0.25)');
      k.person(x + 1.6, y + 1.7, peerLook(2000 + row * 7 + column), { pose: 'sitting', expression: 'blank', time: time * 12 + column, z: 0.4, size: 0.2, outfit: AGENT });
      const head = k.iso(x + 1.6, y + 1.7, 2.6);
      glow(context, head.x, head.y, 22, 'rgba(56,225,255,0.45)');
    }
  }
  // Tasks flying off the floor as they finish: little cards rising and fading.
  for (let task = 0; task < 26; task += 1) {
    const age = (time * 1.4 + hash(task)) % 1;
    const x = width * hash(task + 9);
    const y = height * (0.8 - age * 0.7);
    context.fillStyle = `rgba(125,255,138,${1 - age})`;
    context.fillRect(x, y, 26, 6);
    context.font = '700 10px Barlow Condensed, sans-serif';
    context.fillText('✓ DONE', x + 30, y + 6);
  }
  void data;
}

/** Shot 4: people walking out with boxes past the glowing floor, the doors, the rain outside. */
function exodus(context, width, height, time, data) {
  sky(context, width, height, '#5d6878', '#9aa5b3');
  const k = makeKit(context, Math.min(width, height * 1.7) / 22, width * 0.5 + time * 18, height * 0.62);
  k.ground(-60, -60, 60, 60, '#8a929c');
  k.ground(-60, 2, 60, 9, '#4f545d');
  // The tower behind, its floors lit cyan where agents work.
  k.box(-12, -14, 0, 24, 8, 26, '#2b3a52');
  for (let floor = 0; floor < 20; floor += 1) {
    for (let column = 0; column < 20; column += 1) {
      const a = k.iso(-11.5 + column * 1.15, -6, 1 + floor * 1.2);
      const b = k.iso(-10.8 + column * 1.15, -6, 1 + floor * 1.2);
      const c = k.iso(-10.8 + column * 1.15, -6, 1.8 + floor * 1.2);
      const d = k.iso(-11.5 + column * 1.15, -6, 1.8 + floor * 1.2);
      k.polygon([a, b, c, d], hash(floor * 31 + column) > 0.35 ? '#38e1ff' : '#1a2536');
    }
  }
  k.box(-2, -6.1, 0, 4, 0.3, 3.2, '#9fd8f0');
  // A line of people leaving, each carrying a box, the player among them.
  for (let walker = 0; walker < 10; walker += 1) {
    const x = -2 + walker * 1.4 + ((time * 1.4) % 1.4);
    const y = -4.6 + walker * 0.75;
    const isPlayer = walker === 4;
    k.person(x, y, isPlayer ? data.look : peerLook(2100 + walker), { pose: 'carrying', expression: 'sad', time: time * 2 + walker, size: 0.22 });
  }
  // A security guard by the door; a robot courier rolling the other way.
  k.person(-2.8, -4.8, peerLook(2200), { pose: 'standing', expression: null, time, size: 0.22, outfit: { top: '#1d1f24', bottom: '#1d1f24', shirt: '#ffffff' } });
  const bot = k.iso(6 - time * 2.2, -3.2, 0.4);
  context.fillStyle = '#e8eef4';
  context.fillRect(bot.x - 14, bot.y - 22, 28, 20);
  glow(context, bot.x, bot.y - 12, 26, 'rgba(56,225,255,0.6)');
  context.fillStyle = '#38e1ff';
  context.fillRect(bot.x - 8, bot.y - 18, 16, 4);
  // Rain.
  context.strokeStyle = 'rgba(200,215,240,0.45)';
  context.lineWidth = 1.2;
  context.beginPath();
  for (let drop = 0; drop < 180; drop += 1) {
    const x = (drop * 97.13 + time * 140) % (width + 60) - 30;
    const y = (drop * 53.71 + time * 900) % (height + 30) - 15;
    context.moveTo(x, y);
    context.lineTo(x - 4, y - 14);
  }
  context.stroke();
}

const SHOTS = [dataCentre, stockRocket, agentsAtWork, exodus];

export const SIR_SCENE = {
  duration: SHOTS.length * SHOT,
  captions: (data) => [
    `${data.sirYear ?? 'That year'}. The Super Intelligence Revolution.`,
    'AI stocks go vertical.',
    'The agents start work on Monday. They never stop.',
    'And the floor empties, one cardboard box at a time.',
  ],
  draw(context, width, height, time, data) {
    const index = Math.min(SHOTS.length - 1, Math.floor(time / SHOT));
    const local = time - index * SHOT;
    SHOTS[index](context, width, height, local, data);
    // A white flash on every cut, and a scanline shimmer over it all.
    const flash = Math.max(0, 1 - local / 0.18);
    if (flash > 0 && index > 0) {
      context.fillStyle = `rgba(255,255,255,${0.85 * flash})`;
      context.fillRect(0, 0, width, height);
    }
    context.fillStyle = 'rgba(0,0,0,0.08)';
    for (let y = (time * 60) % 4; y < height; y += 4) context.fillRect(0, y, width, 1);
    // The title card over the first shot.
    if (index === 0) {
      const alpha = Math.min(1, local / 0.4) * Math.min(1, (SHOT - local) / 0.4);
      context.fillStyle = `rgba(56,225,255,${alpha})`;
      context.font = `800 ${Math.round(height * 0.075)}px Barlow Condensed, sans-serif`;
      context.textAlign = 'center';
      context.fillText('SUPER INTELLIGENCE', width / 2, height * 0.42);
      context.fillStyle = `rgba(255,255,255,${alpha})`;
      context.font = `700 ${Math.round(height * 0.04)}px Barlow Condensed, sans-serif`;
      context.fillText('THE REVOLUTION ARRIVES', width / 2, height * 0.49);
    }
    void TAU;
  },
};
