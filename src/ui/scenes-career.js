// The career and home moments, each a full set rather than a backdrop: a
// promotion party outside a corner office, a first morning in a lobby, the
// box carried out of the building, a desk at three in the morning, a rainy
// day on leave, an acquisition party, a hospital room, a moving day. The
// camera is close, and every set has people and small things in it.

import { drawHouse } from './props3d.js';
import { glow, hash, cloud, fillPolygon, line } from './scenes-world.js';

const TAU = Math.PI * 2;

function windowBand(context, k, x0, y0, x1, y1, z0, z1, sky = '#9ec8ef', panes = 4) {
  k.polygon([k.iso(x0, y0, z0), k.iso(x1, y1, z0), k.iso(x1, y1, z1), k.iso(x0, y0, z1)], sky);
  context.strokeStyle = 'rgba(255,255,255,0.8)';
  context.lineWidth = 2;
  for (let pane = 0; pane <= panes; pane += 1) {
    const t = pane / panes;
    const a = k.iso(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, z0);
    const b = k.iso(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, z1);
    context.beginPath();
    context.moveTo(a.x, a.y);
    context.lineTo(b.x, b.y);
    context.stroke();
  }
}

/** A skyline of towers seen through a window: boxes of varied height in a distant haze. */
function skylineBehind(context, k, x0, x1, y, floor, seed, color) {
  for (let tower = 0; tower < 9; tower += 1) {
    const x = x0 + (x1 - x0) * tower / 9;
    k.box(x, y, floor, (x1 - x0) / 10, 0.4, 1.0 + hash(seed + tower) * 2.4, color);
  }
}

function desk(k, x, y, color = '#cfd6df') {
  k.box(x, y, 0.5, 1.6, 0.8, 0.07, color);
  k.box(x + 0.05, y + 0.05, 0, 0.07, 0.7, 0.5, '#7d8590');
  k.box(x + 1.48, y + 0.05, 0, 0.07, 0.7, 0.5, '#7d8590');
  k.box(x + 0.6, y + 0.15, 0.57, 0.5, 0.05, 0.38, '#22262c');
  k.box(x + 0.55, y + 0.3, 0.57, 0.6, 0.3, 0.04, '#3a3f47');
}

export function careerScenes(tools) {
  const { interim, sky, falling, rain, tree, mixColor, peerLook, umbrella } = tools;

  // ── Promotion: the corner office, the team clapping, a champagne cork ──
  const promoted = interim(6.5, (data) => [`Promoted: ${data.title}.`, 'The team crowds round. Someone has brought a cake.'], (context, width, height, time, data, k) => {
    sky(context, width, height, '#cfe0f2', '#eef4fa');
    // The floor: carpet tiles, and the wall behind with a skyline window.
    k.ground(-40, -40, 40, 40, '#b8c3d3');
    for (let tile = -8; tile < 9; tile += 1) k.ground(tile, -6, tile + 0.04, 8, 'rgba(255,255,255,0.1)');
    k.box(-8, -5, 0, 16, 0.3, 4.8, '#e6ebf2');
    windowBand(context, k, -7, -4.7, 1, -4.7, 1.0, 4.2, '#9ec8ef', 6);
    skylineBehind(context, k, -7, 1, -5.6, 0, 3, '#8fa6c4');
    // The corner office: glass walls, a big desk, a chair, a bookshelf, a plant and a framed degree.
    k.box(1.4, -4.8, 0, 6.4, 0.08, 3.4, '#c4dcea');
    k.box(7.8, -4.8, 0, 0.08, 6.4, 3.4, '#c9deea');
    k.box(2.6, -3.6, 0, 2.6, 1.2, 0.8, '#6b4a30');
    k.box(2.6, -3.6, 0.8, 2.6, 1.2, 0.07, '#8a6240');
    k.box(3.4, -3.3, 0.87, 0.9, 0.05, 0.55, '#1c2026');
    k.box(3.1, -2.2, 0, 0.9, 0.9, 0.5, '#2f3a4a');
    k.box(3.1, -1.4, 0.5, 0.9, 0.1, 1.1, '#2f3a4a');
    k.box(6.3, -4.6, 0, 1.4, 0.4, 2.8, '#8a5a36');
    for (let shelf = 0; shelf < 5; shelf += 1) for (let book = 0; book < 6; book += 1) k.box(6.4 + book * 0.2, -4.6, 0.3 + shelf * 0.5, 0.12, 0.3, 0.38, ['#c8352f', '#2f5f9a', '#e0a050', '#3f8a4a', '#7a5a9a'][(book + shelf) % 5]);
    tree(k, context, 7.2, -1.2, { height: 2.2, crown: '#4f8c4f' });
    // The door plate, revealed.
    const open = Math.min(1, time / 1.6);
    const plate = k.iso(2.3, -4.7, 3.0);
    context.fillStyle = '#c9a24a';
    context.fillRect(plate.x - k.unit * 1.0, plate.y - k.unit * 0.22, k.unit * 2 * open, k.unit * 0.44);
    if (open > 0.7) {
      context.fillStyle = '#1d1d1d';
      context.font = `700 ${Math.max(10, k.unit * 0.24)}px Barlow Condensed, sans-serif`;
      context.textAlign = 'center';
      context.fillText(data.title.toUpperCase(), plate.x, plate.y + k.unit * 0.08);
    }
    // The open-plan floor outside: desks with the team, clapping.
    for (const [x, y] of [[-6.5, -1.5], [-3.6, -1.5], [-6.5, 1.8], [-3.6, 1.8]]) desk(k, x, y);
    for (let person = 0; person < 7; person += 1) {
      const x = -2.5 + (person % 4) * 1.1 + (person > 3 ? 0.5 : 0);
      const y = 0.4 + Math.floor(person / 4) * 1.3;
      const clap = Math.sin(time * 8 + person) > 0.4;
      k.person(x, y, peerLook((data.seed ?? 1) + person * 9), { pose: clap ? 'waving' : 'standing', expression: 'happy', time: time + person, size: 0.21, facing: person % 2 ? -1 : 1 });
    }
    // The cake on a table, and balloons.
    k.box(-1.2, 3.2, 0, 1.4, 1.0, 0.8, '#ffffff');
    k.box(-1.0, 3.35, 0.8, 1.0, 0.7, 0.3, '#f6c6d4');
    k.box(-0.8, 3.5, 1.1, 0.6, 0.4, 0.25, '#ffffff');
    for (let candle = 0; candle < 3; candle += 1) {
      const flame = k.iso(-0.7 + candle * 0.2, 3.7, 1.45);
      glow(context, flame.x, flame.y, 12, 'rgba(255,200,120,0.7)');
    }
    for (let balloon = 0; balloon < 6; balloon += 1) {
      const base = k.iso(-4.4 + balloon * 0.3, 3.6, 0.3);
      const top = { x: base.x + Math.sin(time * 1.2 + balloon) * 4, y: base.y - k.unit * (2.2 + hash(balloon) * 0.6) };
      line(context, base.x, base.y, top.x, top.y, 'rgba(60,60,70,0.5)', 1);
      context.fillStyle = ['#e5484d', '#f5c542', '#3b82f6', '#46b96b', '#a05bd6', '#f08c4a'][balloon];
      context.beginPath();
      context.ellipse(top.x, top.y, k.unit * 0.28, k.unit * 0.34, 0, 0, TAU);
      context.fill();
    }
    // A banner, the new director at the door with the manager, a cork popping.
    k.box(-6.8, 4.2, 3.0, 5.0, 0.05, 0.6, '#f5c542');
    k.person(2.0, 0.6, peerLook((data.seed ?? 1) + 200), { pose: 'standing', expression: 'happy', time, size: 0.22, outfit: { top: '#3c4f6e', bottom: '#2a2f3a', shirt: '#ffffff' } });
    k.person(0.9, 0.6, data.look, { pose: 'waving', expression: 'happy', time, size: 0.23 });
    if (time > 2.5) {
      const age = time - 2.5;
      const cork = k.iso(1.4, 0.4, 1.5 + age * 2.4 - age * age * 1.4);
      context.fillStyle = '#d9c7a0';
      context.fillRect(cork.x - 3, cork.y - 3, 6, 6);
      falling(context, width, height, time, ['#f4c542', '#46b96b', '#3b82f6', '#e5484d', '#ffffff'], { count: 140, speed: 170, size: 8 });
    }
  }, { zoom: 0.55, originY: 0.70, originX: 0.42 });

  // ── First day: a bright lobby, a badge, a welcome ───────────────────
  const newJob = interim(6.5, (data) => [`First day at ${data.company}.`, 'A badge, a laptop, and eleven names to remember.'], (context, width, height, time, data, k) => {
    sky(context, width, height, '#c9dff3', '#eef5fb');
    k.ground(-40, -40, 40, 40, '#d9dde2');
    for (let tile = -10; tile < 11; tile += 1) {
      k.ground(tile, -8, tile + 0.03, 10, 'rgba(0,0,0,0.06)');
      k.ground(-10, tile, 10, tile + 0.03, 'rgba(0,0,0,0.06)');
    }
    // The glass facade with revolving doors, daylight outside, a plaza and a tree.
    k.box(-9, -6, 0, 18, 0.2, 5.6, '#a9cde4');
    windowBand(context, k, -8, -5.8, 8, -5.8, 0.3, 5.2, '#a9d0f0', 12);
    for (const x of [-1.0, 0.6]) k.box(x, -5.9, 0, 0.9, 0.9, 2.6, '#cfe3f2');
    tree(k, context, -7.5, -8, { height: 3, crown: '#4f8c4f' });
    // The company sign across the wall, in the company's name.
    k.box(-6, -5.7, 3.4, 12, 0.15, 1.0, '#1d3f6e');
    const sign = k.iso(0, -5.55, 3.9);
    context.fillStyle = '#ffffff';
    context.font = `700 ${Math.max(12, k.unit * 0.55)}px Barlow Condensed, sans-serif`;
    context.textAlign = 'center';
    context.fillText(data.company.toUpperCase(), sign.x, sign.y + k.unit * 0.2);
    // The reception desk, a receptionist, the welcome screen, security gates.
    k.box(-5.2, -2.6, 0, 3.6, 0.9, 1.0, '#e6dccb');
    k.box(-5.3, -2.7, 1.0, 3.8, 1.1, 0.08, '#8a6a4a');
    k.person(-3.6, -2.9, peerLook((data.seed ?? 1) + 111), { pose: 'standing', expression: 'happy', time, size: 0.21, outfit: { top: '#1d3f6e', bottom: '#1d3f6e', shirt: '#ffffff' } });
    k.box(-6.8, -4.6, 0.6, 1.8, 0.1, 1.1, '#101828');
    const screen = k.iso(-5.9, -4.5, 1.2);
    context.fillStyle = '#7fd0ff';
    context.font = `700 ${Math.max(9, k.unit * 0.22)}px Barlow Condensed, sans-serif`;
    context.textAlign = 'center';
    context.fillText(`WELCOME, ${data.firstName.toUpperCase()}`, screen.x, screen.y);
    for (let gate = 0; gate < 3; gate += 1) {
      k.box(1.6 + gate * 1.5, -1.6, 0, 0.12, 1.2, 1.0, '#9aa5b3');
      k.box(1.6 + gate * 1.5, -1.6, 1.0, 0.12, 1.2, 0.06, '#46b96b');
    }
    // Sofas, a coffee table, a plant, a coffee cart, a wall of framed awards.
    k.box(4.0, 2.6, 0, 2.6, 1.0, 0.5, '#4a6a8a');
    k.box(4.0, 3.4, 0.5, 2.6, 0.2, 0.6, '#3b5a7a');
    k.box(4.6, 1.3, 0, 1.2, 0.8, 0.35, '#8a6a4a');
    tree(k, context, 7.4, 1.0, { height: 2.0, crown: '#4f8c4f' });
    k.box(-8, -0.6, 0, 1.6, 0.9, 1.1, '#6b4a30');
    k.box(-7.9, -0.55, 1.1, 1.4, 0.8, 0.07, '#c9ccd0');
    const steam = k.iso(-7.3, -0.1, 1.4);
    for (let wisp = 0; wisp < 3; wisp += 1) {
      const age = (time * 0.6 + wisp / 3) % 1;
      context.fillStyle = `rgba(255,255,255,${0.5 * (1 - age)})`;
      context.beginPath();
      context.arc(steam.x + Math.sin(age * 6) * 3, steam.y - age * 28, 3 + age * 5, 0, TAU);
      context.fill();
    }
    // People walking through with laptops and cups, and the HR host coming to meet the new hire.
    for (let walker = 0; walker < 5; walker += 1) {
      const x = ((time * (0.8 + hash(walker) * 0.5) + walker * 3.1) % 14) - 7;
      k.person(x, 1.2 + (walker % 3) * 1.1, peerLook((data.seed ?? 1) + 300 + walker), { pose: 'walking', expression: null, time: time * 2 + walker, size: 0.2, facing: walker % 2 ? 1 : -1 });
    }
    const arrive = Math.min(1, time / 3.2);
    k.person(0.0, 5.4 - arrive * 3.4, data.look, { pose: arrive < 1 ? 'walking' : 'waving', expression: 'happy', time, size: 0.23, outfit: { top: '#2f3a4a', bottom: '#3f4a5a', shirt: '#ffffff' } });
    k.person(0.9, 1.4, peerLook((data.seed ?? 1) + 400), { pose: arrive < 1 ? 'standing' : 'waving', expression: 'happy', time, size: 0.22, facing: -1, outfit: { top: '#8a2f4a', bottom: '#2a2f3a', shirt: '#ffffff' } });
    // The badge, held up, once they have met.
    if (arrive >= 1) {
      const badge = k.iso(0.2, 3.4, 1.8);
      context.fillStyle = '#ffffff';
      context.fillRect(badge.x - 10, badge.y - 14, 20, 28);
      context.fillStyle = '#1d3f6e';
      context.fillRect(badge.x - 10, badge.y - 14, 20, 8);
      glow(context, badge.x, badge.y, 30, 'rgba(255,255,255,0.35)');
    }
    // Morning light through the glass.
    for (let shaft = 0; shaft < 4; shaft += 1) fillPolygon(context, [[width * (0.1 + shaft * 0.15), 0], [width * (0.16 + shaft * 0.15), 0], [width * (0.4 + shaft * 0.15), height], [width * (0.28 + shaft * 0.15), height]], 'rgba(255,248,220,0.07)');
  }, { zoom: 0.55, originY: 0.72, originX: 0.42 });

  // ── Losing the job: the box, the badge, the rain, colleagues at the window ──
  const lostJob = interim(5.5, (data) => [`${data.firstName} carries a box out of ${data.company}.`, 'Eleven years of badge photos. One cardboard box.'], (context, width, height, time, data, k) => {
    sky(context, width, height, '#6f7b88', '#a9b3bd');
    k.ground(-40, -40, 40, 40, '#8d949b');
    k.ground(-9, 3.4, 9, 5.6, '#6d7178');
    for (let dash = -4; dash < 5; dash += 1) k.ground(dash * 2, 4.45, dash * 2 + 1, 4.55, '#d8d0a0');
    // The tower: glass and steel, the company name in lit letters, colleagues at the windows.
    k.box(-8, -7, 0, 10, 4.2, 9.5, '#5f6f84');
    for (let row = 0; row < 7; row += 1) for (let column = 0; column < 8; column += 1) {
      const lit = hash(row * 13 + column) > 0.35;
      const a = k.iso(-7.6 + column * 1.2, -2.8, 0.8 + row * 1.2);
      const b = k.iso(-6.7 + column * 1.2, -2.8, 0.8 + row * 1.2);
      const c = k.iso(-6.7 + column * 1.2, -2.8, 1.7 + row * 1.2);
      const d = k.iso(-7.6 + column * 1.2, -2.8, 1.7 + row * 1.2);
      k.polygon([a, b, c, d], lit ? '#c9d8e6' : '#7d93ab');
    }
    for (let watcher = 0; watcher < 3; watcher += 1) {
      const head = k.iso(-6.2 + watcher * 2.3, -2.8, 5.0 - watcher * 0.2);
      context.fillStyle = '#d9a67a';
      context.beginPath();
      context.arc(head.x, head.y, 6, 0, TAU);
      context.fill();
    }
    k.box(-8, -2.9, 8.7, 10, 0.1, 0.6, '#1d3f6e');
    const logo = k.iso(-3, -2.8, 9.0);
    context.fillStyle = '#ffffff';
    context.font = `700 ${Math.max(10, k.unit * 0.3)}px Barlow Condensed, sans-serif`;
    context.textAlign = 'center';
    context.fillText(data.company.toUpperCase(), logo.x, logo.y + 5);
    // A revolving door, a security guard, a bin full of paperwork.
    k.box(-1.0, -2.9, 0, 1.8, 0.2, 2.4, '#d4e6f2');
    k.person(1.8, -1.8, peerLook((data.seed ?? 1) + 77), { pose: 'standing', expression: null, time, size: 0.21, outfit: { top: '#2a2f3a', bottom: '#2a2f3a', shirt: '#ffffff' } });
    k.box(3.2, -2.2, 0, 0.5, 0.5, 0.8, '#3f5a46');
    // The walk away: the box with a plant, a mug and a framed photo sticking out.
    const walk = Math.min(1, time / 4.6);
    const x = -0.4 + walk * 3.6;
    k.person(x, 1.8, data.look, { pose: 'carrying', expression: 'sad', time, size: 0.22, outfit: { top: '#4a5260', bottom: '#2a2f3a', shirt: '#e8e8e8' } });
    const boxTop = k.iso(x + 0.1, 1.7, 1.35);
    context.fillStyle = '#4f9a4a';
    context.beginPath();
    context.ellipse(boxTop.x, boxTop.y - 10, 7, 11, 0, 0, TAU);
    context.fill();
    context.fillStyle = '#e8e8e8';
    context.fillRect(boxTop.x + 6, boxTop.y - 14, 8, 11);
    // The badge, dropped on the pavement; a taxi waiting with its light on; umbrellas passing.
    const badge = k.iso(0.2, 2.6);
    context.fillStyle = '#ffffff';
    context.fillRect(badge.x - 4, badge.y - 2, 10, 6);
    k.box(6.0, 3.7, 0.2, 2.6, 1.2, 0.7, '#f2c14a');
    k.box(6.5, 3.8, 0.9, 1.4, 1.0, 0.5, '#f2c14a');
    k.box(6.9, 4.0, 1.4, 0.5, 0.3, 0.2, '#ffffff');
    umbrella(context, k, 7.5, -0.4 + Math.sin(time * 0.6) * 0.6, 0, '#2a3550', '#ffffff');
    k.person(-5.6, 3.0, peerLook((data.seed ?? 1) + 88), { pose: 'walking', expression: null, time: time * 2, size: 0.2 });
    rain(context, width, height, time, { count: 200, speed: 760, slant: 0.1 });
    context.fillStyle = 'rgba(30,40,55,0.2)';
    context.fillRect(0, 0, width, height);
  }, { zoom: 0.55, originY: 0.80, originX: 0.42 });

  // ── Burnout: the desk at 3 AM ───────────────────────────────────────
  const burnout = interim(5.5, () => ['Something gives.', 'The screen swims. The coffee has been cold for hours.'], (context, width, height, time, data, k) => {
    sky(context, width, height, '#0d1222', '#1c2440');
    k.ground(-40, -40, 40, 40, '#2b3345');
    k.box(-8, -4, 0, 16, 0.3, 4.4, '#1a2133');
    windowBand(context, k, -7, -3.7, 7, -3.7, 0.9, 3.8, '#0a1020', 8);
    // The city beyond: lit windows in far towers.
    for (let tower = 0; tower < 18; tower += 1) {
      const a = k.iso(-7 + tower * 0.78, -3.7, 0.9);
      const heightTower = 0.5 + hash(tower) * 2.0;
      for (let floor = 0; floor < heightTower * 4; floor += 1) {
        if (hash(tower * 11 + floor) > 0.5) {
          context.fillStyle = 'rgba(255,214,140,0.8)';
          context.fillRect(a.x + 4, a.y - floor * 9 - 8, 6, 4);
        }
      }
    }
    // Three monitors, a keyboard, cups, takeaway boxes, sticky notes, a desk lamp.
    k.box(-2.4, -1.2, 0.7, 4.8, 1.6, 0.09, '#6b5038');
    for (const x of [-2.2, 3.4]) k.box(x, -1.1, 0, 0.14, 1.4, 0.7, '#4a3a2a');
    for (let monitor = 0; monitor < 3; monitor += 1) {
      k.box(-1.9 + monitor * 1.35, -0.7, 0.8, 1.2, 0.07, 0.8, '#101418');
      const screenPoint = k.iso(-1.3 + monitor * 1.35, -0.62, 1.2);
      glow(context, screenPoint.x, screenPoint.y, k.unit * 1.3, monitor === 1 ? 'rgba(255,90,90,0.28)' : 'rgba(120,180,255,0.25)');
    }
    for (let cup = 0; cup < 7; cup += 1) k.box(-2.1 + cup * 0.62 + hash(cup) * 0.2, 0.15 + hash(cup + 4) * 0.2, 0.79, 0.14, 0.14, 0.2, ['#f4f1ea', '#c8352f', '#2f5f9a'][cup % 3]);
    for (let note = 0; note < 6; note += 1) k.box(-1.9 + note * 0.7, -0.75, 1.5 + (note % 2) * 0.12, 0.2, 0.01, 0.2, ['#f5e04a', '#f08cb0', '#7fd0ff'][note % 3]);
    k.box(2.6, 0.2, 0.79, 0.6, 0.5, 0.25, '#c8352f');
    k.box(-3.3, -0.4, 0.79, 0.12, 0.12, 0.7, '#8a8f98');
    const lamp = k.iso(-3.25, -0.3, 1.5);
    glow(context, lamp.x, lamp.y, k.unit * 1.8, 'rgba(255,224,160,0.35)');
    // A chair, the player slumped in it.
    k.box(-0.4, 1.4, 0, 1.0, 1.0, 0.5, '#2a2f3a');
    k.box(-0.4, 2.3, 0.5, 1.0, 0.1, 1.1, '#2a2f3a');
    k.person(0.1, 1.9, data.look, { pose: 'sitting', expression: 'sad', time, z: 0.5, size: 0.22, outfit: { top: '#5a6578', bottom: '#2a2f3a', shirt: '#e8e8e8' } });
    // The wall clock at three, a cleaner's trolley far off, the building humming.
    const clock = k.iso(4.4, -3.7, 3.6);
    context.fillStyle = '#e8e8e8';
    context.beginPath();
    context.arc(clock.x, clock.y, k.unit * 0.5, 0, TAU);
    context.fill();
    line(context, clock.x, clock.y, clock.x, clock.y - k.unit * 0.3, '#222', 2);
    line(context, clock.x, clock.y, clock.x + k.unit * 0.22, clock.y + k.unit * 0.14, '#222', 2);
    k.box(6.2, 3.0, 0, 0.8, 0.5, 0.9, '#3a6a8f');
    context.fillStyle = `rgba(128,128,128,${Math.min(0.7, time / 4.5)})`;
    context.globalCompositeOperation = 'saturation';
    context.fillRect(0, 0, width, height);
    context.globalCompositeOperation = 'source-over';
    // The vignette closing in.
    const vignette = context.createRadialGradient(width / 2, height / 2, height * 0.25, width / 2, height / 2, height * 0.85);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, `rgba(0,0,0,${Math.min(0.7, time / 6)})`);
    context.fillStyle = vignette;
    context.fillRect(0, 0, width, height);
  }, { zoom: 0.58, originY: 0.74, originX: 0.42 });

  // ── Leave: a rainy day at home ──────────────────────────────────────
  const fmla = interim(6, () => ['Twelve weeks. The laptop stays closed.', 'Tea, a blanket, and nothing to answer for.'], (context, width, height, time, data, k) => {
    sky(context, width, height, '#7d8fa6', '#b4c2d2');
    k.ground(-40, -40, 40, 40, '#b79c78');
    for (let board = -10; board < 11; board += 1) k.ground(board * 0.8, -8, board * 0.8 + 0.03, 10, 'rgba(60,40,20,0.12)');
    k.box(-8, -4, 0, 16, 0.25, 4.6, '#efe3cf');
    // The window, with rain on the glass and a grey street beyond.
    windowBand(context, k, -6, -3.7, -1.5, -3.7, 1.0, 3.8, '#9fb6cf', 3);
    for (let drop = 0; drop < 24; drop += 1) {
      const p = k.iso(-6 + hash(drop) * 4.5, -3.7, 1.0 + ((hash(drop + 7) * 2.8 + time * 0.5 * (0.5 + hash(drop))) % 2.8));
      context.fillStyle = 'rgba(255,255,255,0.55)';
      context.fillRect(p.x, p.y, 1.5, 6);
    }
    // A sofa with a blanket, a coffee table with tea and a book, a rug, a floor lamp, a bookshelf, a cat.
    k.ground(-3.5, -1, 3.5, 3.8, '#a65f56');
    k.ground(-3.2, -0.7, 3.2, 3.5, '#bd746a');
    k.box(-3, -2.2, 0, 4.4, 1.3, 0.55, '#6f8a76');
    k.box(-3, -2.4, 0.55, 4.4, 0.35, 0.8, '#5f7a66');
    k.box(-3.1, -2.3, 0.55, 0.35, 1.3, 0.35, '#5f7a66');
    k.box(1.1, -2.3, 0.55, 0.35, 1.3, 0.35, '#5f7a66');
    k.box(-1.6, -1.9, 0.55, 1.6, 0.8, 0.1, '#c8a24a');
    k.box(-1.3, 0.4, 0, 2.0, 1.0, 0.4, '#8a6a46');
    k.box(-1.0, 0.7, 0.4, 0.2, 0.2, 0.15, '#f4f1ea');
    const steam = k.iso(-0.9, 0.8, 0.7);
    for (let wisp = 0; wisp < 3; wisp += 1) {
      const age = (time * 0.5 + wisp / 3) % 1;
      context.fillStyle = `rgba(255,255,255,${0.5 * (1 - age)})`;
      context.beginPath();
      context.arc(steam.x + Math.sin(age * 5) * 3, steam.y - age * 26, 3 + age * 5, 0, TAU);
      context.fill();
    }
    k.box(0.0, 0.5, 0.4, 0.5, 0.35, 0.05, '#2f5f9a');
    k.box(3.2, -3.4, 0, 0.1, 0.1, 2.6, '#33373d');
    const shade = k.iso(3.25, -3.35, 2.7);
    glow(context, shade.x, shade.y, k.unit * 2.2, 'rgba(255,224,160,0.4)');
    k.box(-7.2, -3.6, 0, 1.6, 0.5, 3.0, '#8a5a36');
    for (let shelf = 0; shelf < 6; shelf += 1) for (let book = 0; book < 7; book += 1) k.box(-7.1 + book * 0.2, -3.6, 0.3 + shelf * 0.45, 0.12, 0.3, 0.36, ['#c8352f', '#2f5f9a', '#e0a050', '#3f8a4a', '#7a5a9a'][(book + shelf) % 5]);
    tree(k, context, 5.0, -2.4, { height: 2.4, crown: '#4f8c4f' });
    k.box(5.2, 0.4, 0.15, 0.7, 0.4, 0.18, '#d98a3a');
    const calendar = k.iso(-0.6, -3.7, 2.8);
    context.fillStyle = '#ffffff';
    context.fillRect(calendar.x - 22, calendar.y - 26, 44, 52);
    context.strokeStyle = '#c8352f';
    context.lineWidth = 2;
    for (let day = 0; day < 12; day += 1) {
      const gx = calendar.x - 18 + (day % 4) * 10;
      const gy = calendar.y - 14 + Math.floor(day / 4) * 10;
      if (time * 2 > day) {
        context.beginPath();
        context.moveTo(gx, gy);
        context.lineTo(gx + 7, gy + 7);
        context.stroke();
      }
    }
    k.person(-0.4, -1.4, data.look, { pose: 'sitting', expression: 'happy', time, z: 0.55, size: 0.22, outfit: { top: '#8a9a7b', bottom: '#5a6470', shirt: '#8a9a7b' } });
    rain(context, width, height * 0.4, time, { count: 30, speed: 320, slant: 0.05 });
    context.fillStyle = 'rgba(60,70,95,0.1)';
    context.fillRect(0, 0, width, height);
  }, { zoom: 0.58, originY: 0.74, originX: 0.42 });

  // ── The startup sells: a loft party, a screen, falling cash ─────────
  const startupWin = interim(5.5, () => ['The startup sold. Your $20,000 is now $200,000.', 'Somebody opens a bottle that was supposed to be for the launch.'], (context, width, height, time, data, k) => {
    sky(context, width, height, '#f7d774', '#fff4cf');
    k.ground(-40, -40, 40, 40, '#d8c9a0');
    k.box(-8, -4, 0, 16, 0.25, 4.8, '#f2e8d0');
    // The wall screen: ACQUIRED, in the colours of whoever bought it.
    k.box(-4.5, -3.8, 1.2, 8.0, 0.1, 2.4, '#101418');
    const screen = k.iso(-0.5, -3.7, 2.4);
    context.fillStyle = '#46e08a';
    context.font = `700 ${Math.max(14, k.unit * 0.6)}px Barlow Condensed, sans-serif`;
    context.textAlign = 'center';
    context.fillText('ACQUIRED', screen.x, screen.y);
    context.fillStyle = '#ffffff';
    context.font = `600 ${Math.max(10, k.unit * 0.24)}px Barlow, sans-serif`;
    context.fillText('$200,000 → your account', screen.x, screen.y + k.unit * 0.5);
    // Beanbags, standing desks, a snack bar, string lights, a foosball table, a dog.
    for (const [x, y, color] of [[-6, 0, '#e5484d'], [-5, 2, '#3b82f6'], [6, 0.5, '#f5c542'], [5, 2.4, '#46b96b']]) {
      k.box(x, y, 0, 1.0, 1.0, 0.5, color);
    }
    k.box(2.0, 3.0, 0, 2.4, 1.0, 0.9, '#8a6a46');
    for (let bottle = 0; bottle < 4; bottle += 1) k.box(2.3 + bottle * 0.5, 3.3, 0.9, 0.12, 0.12, 0.4, ['#2f8f4e', '#e0a050', '#c8352f', '#3b82f6'][bottle]);
    k.box(-3.4, 3.2, 0.5, 2.0, 1.0, 0.1, '#5a7a4a');
    for (let strand = 0; strand < 2; strand += 1) {
      const a = k.iso(-8, -2 + strand * 5, 4.2);
      const b = k.iso(8, -2 + strand * 5, 4.2);
      for (let bulb = 0; bulb <= 18; bulb += 1) {
        const t = bulb / 18;
        glow(context, a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t + Math.sin(t * Math.PI) * k.unit * 0.5, 9, 'rgba(255,214,140,0.8)');
      }
    }
    // The team, cheering, and the player in the middle with a phone held up.
    for (let person = 0; person < 7; person += 1) {
      const angle = person / 7 * Math.PI + 0.15;
      k.person(Math.cos(angle) * 3.2, 1.0 + Math.sin(angle) * 1.8, peerLook((data.seed ?? 1) + 500 + person), { pose: Math.sin(time * 6 + person) > 0 ? 'waving' : 'standing', expression: 'happy', time: time + person, size: 0.21, facing: person % 2 ? 1 : -1 });
    }
    k.person(0.0, 1.4, data.look, { pose: 'waving', expression: 'happy', time, size: 0.24 });
    const phone = k.iso(0.4, 1.2, 2.1);
    context.fillStyle = '#101418';
    context.fillRect(phone.x - 6, phone.y - 11, 12, 20);
    context.fillStyle = '#46e08a';
    context.fillRect(phone.x - 4, phone.y - 8, 8, 4);
    falling(context, width, height, time, ['#2f8f50', '#46b96b', '#f4c542', '#ffffff'], { count: 130, speed: 160, size: 9 });
  }, { zoom: 0.55, originY: 0.74, originX: 0.42 });

  // ── A baby, born at the hospital ────────────────────────────────────
  const child = interim(6, () => ['A new person in the house. Nobody sleeps.', 'Seven pounds, and a firm opinion about the hour.'], (context, width, height, time, data, k) => {
    sky(context, width, height, '#e6f1f7', '#f6fafc');
    k.ground(-40, -40, 40, 40, '#d4e4e8');
    k.box(-8, -4, 0, 16, 0.25, 4.6, '#eaf3f5');
    windowBand(context, k, 1.5, -3.7, 6.5, -3.7, 1.2, 3.8, '#bfe0f4', 3);
    // The bed with a raised head, a bedside monitor, a tray, flowers and balloons.
    k.box(-4, -2.8, 0, 3.0, 1.8, 0.6, '#cfd6dd');
    k.box(-4, -2.8, 0.6, 3.0, 1.8, 0.2, '#ffffff');
    k.box(-4, -2.9, 0.8, 0.3, 1.9, 1.0, '#cfd6dd');
    k.box(-1.0, -2.6, 0, 0.7, 0.8, 1.4, '#2a2f3a');
    const monitor = k.iso(-0.7, -2.5, 1.2);
    context.strokeStyle = '#46e08a';
    context.lineWidth = 1.5;
    context.beginPath();
    for (let x = 0; x < 22; x += 2) context.lineTo(monitor.x - 11 + x, monitor.y + Math.sin(x * 0.9 + time * 6) * (x % 8 === 0 ? 5 : 1.5));
    context.stroke();
    k.box(-0.4, 0.8, 0, 1.6, 0.8, 0.7, '#ffffff');
    for (let bloom = 0; bloom < 9; bloom += 1) {
      const p = k.iso(-0.1 + hash(bloom) * 0.9, 1.0 + hash(bloom + 3) * 0.4, 0.8 + hash(bloom + 6) * 0.4);
      context.fillStyle = ['#f6a6bb', '#ffffff', '#f5c542'][bloom % 3];
      context.beginPath();
      context.arc(p.x, p.y, 5, 0, TAU);
      context.fill();
    }
    for (let balloon = 0; balloon < 4; balloon += 1) {
      const base = k.iso(-4.6 + balloon * 0.4, 0.8, 0.4);
      const top = { x: base.x + Math.sin(time + balloon) * 4, y: base.y - k.unit * 2.2 };
      line(context, base.x, base.y, top.x, top.y, 'rgba(60,60,70,0.5)', 1);
      context.fillStyle = ['#7fd0ff', '#f6a6bb', '#f5c542', '#ffffff'][balloon];
      context.beginPath();
      context.ellipse(top.x, top.y, k.unit * 0.28, k.unit * 0.34, 0, 0, TAU);
      context.fill();
    }
    // A clear bassinet with a bundle, a chair, the new parent holding the baby, the other beside.
    k.box(2.0, -1.4, 0, 1.3, 0.8, 0.12, '#cfd6dd');
    k.box(2.0, -1.4, 0.12, 1.3, 0.8, 0.5, '#d4ebf4');
    k.box(2.15, -1.3, 0.2, 1.0, 0.6, 0.18, '#fbe4ea');
    k.person(-2.4, -1.4, data.look, { pose: 'sitting', expression: 'happy', time, z: 0.8, size: 0.21, outfit: { top: '#a9c6dc', bottom: '#a9c6dc', shirt: '#a9c6dc' } });
    k.person(-0.6, 0.6, data.partnerLook ?? peerLook((data.seed ?? 1) + 5), { pose: 'standing', expression: 'happy', time, size: 0.22, facing: -1 });
    k.person(1.8, 1.2, peerLook((data.seed ?? 1) + 520), { pose: 'standing', expression: null, time, size: 0.21, facing: -1, outfit: { top: '#8fb3d6', bottom: '#dfe6ec', shirt: '#8fb3d6' } });
    cloud(context, width * 0.8, height * 0.12, 30, 'rgba(255,255,255,0.7)');
    falling(context, width, height, time, ['#f6c6d4', '#fbe4ea', '#bfe0f4'], { count: 30, speed: 40, size: 5 });
  }, { zoom: 0.58, originY: 0.74, originX: 0.42 });

  // ── Moving day: the keys, the truck, the neighbours ─────────────────
  const house = interim(6, () => ['The keys are yours.', 'A pie from the neighbours, and forty boxes that all say KITCHEN.'], (context, width, height, time, data, k) => {
    sky(context, width, height, '#8ec5ec', '#e2f1fb');
    cloud(context, width * 0.3, height * 0.12, 54);
    k.ground(-40, -40, 40, 40, '#7fb06a');
    k.ground(-1.5, 2.0, 1.5, 9, '#cfd2d4');
    k.ground(1.5, 3.0, 8.0, 7.0, '#a9acb0');
    drawHouse(context, k, -7.5, -4.5, 'modest');
    // The truck, its ramp down, boxes carried up the path by movers.
    k.box(4.0, -0.5, 0.4, 4.4, 2.2, 2.4, '#e8e8e4');
    k.box(8.4, -0.3, 0.4, 1.3, 1.9, 1.5, '#c8352f');
    k.box(4.0, -0.5, 0.2, 5.8, 2.2, 0.25, '#2a2d33');
    for (const x of [4.6, 8.8]) {
      const wheel = k.iso(x, 1.7, 0.4);
      context.fillStyle = '#0c0d10';
      context.beginPath();
      context.ellipse(wheel.x, wheel.y, k.unit * 0.38, k.unit * 0.4, 0, 0, TAU);
      context.fill();
    }
    k.box(4.0, 1.7, 0.4, 0.04, 1.8, 0.1, '#8a8f98');
    for (let carrier = 0; carrier < 3; carrier += 1) {
      const t = ((time * 0.25 + carrier / 3) % 1);
      const x = 4.2 - t * 5.5;
      k.person(x, 2.8 + carrier * 0.1, peerLook((data.seed ?? 1) + 600 + carrier), { pose: 'carrying', expression: null, time: time * 1.5 + carrier, size: 0.21, facing: -1, outfit: { top: '#3f6f9a', bottom: '#2a2f3a', shirt: '#3f6f9a' } });
    }
    for (let stack = 0; stack < 6; stack += 1) k.box(1.8 + (stack % 3) * 0.7, 4.6 + Math.floor(stack / 3) * 0.7, 0, 0.6, 0.6, 0.5 + (stack % 2) * 0.3, '#b98f5a');
    // The SOLD sign and the keys, the player at the door, neighbours with a pie and a dog.
    k.box(-3.2, 3.6, 0, 0.08, 0.08, 1.4, '#6b5038');
    const sign = k.iso(-3.15, 3.6, 1.45);
    context.fillStyle = '#ffffff';
    context.fillRect(sign.x - k.unit * 0.7, sign.y - k.unit * 0.42, k.unit * 1.4, k.unit * 0.58);
    context.fillStyle = '#c8102e';
    context.font = `700 ${Math.max(10, k.unit * 0.34)}px Barlow Condensed, sans-serif`;
    context.textAlign = 'center';
    context.fillText('SOLD', sign.x, sign.y - k.unit * 0.02);
    k.person(-0.8, 1.2, data.look, { pose: 'waving', expression: 'happy', time, size: 0.23 });
    const key = k.iso(-0.5, 1.2, 1.7);
    glow(context, key.x, key.y, 18, 'rgba(255,224,120,0.7)');
    context.fillStyle = '#f5c542';
    context.fillRect(key.x - 3, key.y - 1, 8, 3);
    k.person(0.8, 4.0, peerLook((data.seed ?? 1) + 650), { pose: 'waving', expression: 'happy', time, size: 0.21, facing: -1 });
    k.person(1.4, 4.4, peerLook((data.seed ?? 1) + 651), { pose: 'standing', expression: 'happy', time, size: 0.14 });
    k.box(0.45, 3.9, 0.9, 0.35, 0.35, 0.1, '#e0a050');
    const dog = k.iso(1.2, 5.2, 0);
    context.fillStyle = '#b07a3a';
    context.beginPath();
    context.ellipse(dog.x, dog.y - k.unit * 0.25, k.unit * 0.3, k.unit * 0.16, 0, 0, TAU);
    context.fill();
    context.beginPath();
    context.arc(dog.x + k.unit * 0.3, dog.y - k.unit * 0.38 + Math.sin(time * 8) * 2, k.unit * 0.12, 0, TAU);
    context.fill();
    tree(k, context, -9.5, 2.0, { height: 4, crown: '#4f8f4f' });
    tree(k, context, 8.6, 6.5, { height: 3.6, crown: '#5faa5a' });
    for (let bed = 0; bed < 5; bed += 1) k.box(-6.4 + bed * 0.8, 0.4, 0, 0.5, 0.4, 0.25, ['#d6336c', '#f08c00', '#ffffff', '#d6336c', '#f5c542'][bed]);
  }, { zoom: 0.51, originY: 0.74 });

  return { promoted, newJob, lostJob, burnout, fmla, startupWin, child, house };
}
