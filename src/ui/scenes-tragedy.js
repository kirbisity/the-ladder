// The hard moments: a car crash at a junction, a graveside, a house on fire,
// a diagnosis. They are staged with care and restraint: weather and light do
// the work, people stand close to each other, and nothing graphic is shown.

import { drawCar, drawHouse, drawApartment, drawUmbrella } from './props3d.js';
import { glow, hash, cloud, fillPolygon, line } from './scenes-world.js';

const TAU = Math.PI * 2;
const BLACK = { top: '#1b1d22', bottom: '#1b1d22', shirt: '#f2f2f2' };

function partnerOf(data, tools) {
  return data.partnerLook ?? tools.peerLook((data.seed ?? 1) + 5);
}

/** A flashing light: red and blue alternating, with its glow on the ground. */
function beacon(context, k, x, y, z, time, phase = 0, size = 90) {
  const on = Math.sin(time * 11 + phase) > 0;
  const p = k.iso(x, y, z);
  context.fillStyle = on ? '#ff3b3b' : '#3b7bff';
  context.fillRect(p.x - 7, p.y - 4, 14, 7);
  glow(context, p.x, p.y, size, on ? 'rgba(255,60,60,0.5)' : 'rgba(60,120,255,0.5)');
}

export function tragedyScenes(tools) {
  const { interim, sky, rain, tree, mixColor, peerLook, umbrella } = tools;

  // ── The crash ───────────────────────────────────────────────────────
  const carCrash = interim(6.5, (data) => (data.crashSeverity === 'minor'
    ? ['The light is yellow, then it is not.', `${data.firstName} gets out. Nobody is hurt. A very long afternoon of paperwork begins.`]
    : ['The light is yellow, then it is not.', data.crashSeverity === 'severe' ? 'Sirens. Somebody holding a hand. Somebody saying the name, over and over.' : 'Glass everywhere. The ambulance is already turning the corner.']),
  (context, width, height, time, data, k) => {
    const severity = data.crashSeverity ?? 'moderate';
    sky(context, width, height, '#8d98a8', '#bfc7d2');
    // Two roads crossing: asphalt, kerbs, lane markings, a crossing, lights on poles.
    k.ground(-40, -40, 40, 40, '#8f9a8a');
    k.ground(-40, -2.2, 40, 2.2, '#4f545d');
    k.ground(-2.2, -40, 2.2, 40, '#4f545d');
    k.ground(-40, -2.2, 40, -1.9, '#b9bcc0');
    k.ground(-40, 1.9, 40, 2.2, '#b9bcc0');
    for (let dash = -9; dash < 10; dash += 1) {
      if (Math.abs(dash) > 1.4) {
        k.ground(dash * 2, -0.07, dash * 2 + 1, 0.07, '#e8dfa6');
        k.ground(-0.07, dash * 2, 0.07, dash * 2 + 1, '#e8dfa6');
      }
    }
    for (let stripe = 0; stripe < 8; stripe += 1) {
      k.ground(-1.8 + stripe * 0.5, 2.3, -1.55 + stripe * 0.5, 3.3, '#e6e6e0');
      k.ground(2.3, -1.8 + stripe * 0.5, 3.3, -1.55 + stripe * 0.5, '#e6e6e0');
    }
    // Buildings on the corners: a shop with an awning, an apartment block, a bank, a bus shelter.
    k.box(-9, -9, 0, 6.4, 5.4, 3.4, '#c9b79b');
    k.box(-9, -3.7, 0, 6.4, 0.2, 0.8, '#c8352f');
    k.box(4, -9, 0, 6, 5.4, 5.6, '#9aa7b8');
    k.box(4.2, 4.2, 0, 3.4, 0.2, 2.1, '#6a7480');
    k.box(4.2, 4.2, 2.1, 3.8, 1.6, 0.1, '#6a7480');
    // Traffic lights, red on the road that crashed.
    for (const [x, y] of [[-2.6, -2.6], [2.8, 2.8]]) {
      k.box(x, y, 0, 0.1, 0.1, 3.3, '#2f3338');
      const lamp = k.iso(x + 0.05, y + 0.05, 3.4);
      context.fillStyle = '#e5484d';
      context.beginPath();
      context.arc(lamp.x, lamp.y, 5, 0, TAU);
      context.fill();
      glow(context, lamp.x, lamp.y, 26, 'rgba(255,60,60,0.5)');
    }
    // The wreck: the player's car slewed across the junction, the other vehicle against it.
    const hazard = Math.sin(time * 6) > 0;
    drawCar(context, k, 0.2, 0.4, data.car ?? 'sedan', 0, 'lowpoly', Math.PI / 2 + 0.7);
    const bumper = k.iso(0.9, 1.3, 0.7);
    if (hazard) glow(context, bumper.x, bumper.y, 40, 'rgba(255,170,40,0.7)');
    if (severity === 'minor') {
      drawCar(context, k, 1.6, -0.2, 'hatchback', 0, 'lowpoly', Math.PI + 0.3);
    } else {
      // A box truck: cab, load area, a bent bumper, hazard lights on too.
      k.box(1.1, -1.8, 0.35, 1.9, 3.0, 2.1, '#d9dde2');
      k.box(1.1, 1.2, 0.35, 1.9, 1.1, 1.3, '#2f5f9a');
      k.box(1.0, 1.1, 0.3, 2.1, 1.4, 0.18, '#2a2d33');
      for (const y of [-1.2, 1.5]) {
        const wheel = k.iso(3.0, y, 0.35);
        context.fillStyle = '#0c0d10';
        context.beginPath();
        context.ellipse(wheel.x, wheel.y, k.unit * 0.3, k.unit * 0.34, 0, 0, TAU);
        context.fill();
      }
    }
    // Steam from the bonnet, glass on the road, skid marks.
    const hood = k.iso(0.5, 0.9, 0.9);
    for (let puff = 0; puff < 6; puff += 1) {
      const age = (time * 0.5 + puff / 6) % 1;
      context.fillStyle = `rgba(240,240,240,${0.5 * (1 - age)})`;
      context.beginPath();
      context.arc(hood.x + Math.sin(age * 5 + puff) * 6, hood.y - age * 60, 6 + age * 14, 0, TAU);
      context.fill();
    }
    for (let shard = 0; shard < 40; shard += 1) {
      const p = k.iso(-1.5 + hash(shard) * 4, -1.2 + hash(shard + 5) * 3);
      context.fillStyle = `rgba(210,235,250,${0.4 + 0.5 * Math.abs(Math.sin(time * 4 + shard))})`;
      context.fillRect(p.x, p.y, 2, 2);
    }
    context.strokeStyle = 'rgba(20,20,24,0.55)';
    context.lineWidth = 3;
    for (const offset of [-0.35, 0.35]) {
      const a = k.iso(-4, -0.9 + offset);
      const b = k.iso(-0.5, -0.2 + offset);
      context.beginPath();
      context.moveTo(a.x, a.y);
      context.lineTo(b.x, b.y);
      context.stroke();
    }
    // The people: the driver out of the car, standing shaken; bystanders on phones; someone kneeling.
    k.person(-1.4, 2.4, data.look, { pose: severity === 'minor' ? 'standing' : 'sitting', expression: 'sad', time, z: severity === 'minor' ? 0 : 0.2, size: 0.22, outfit: severity === 'minor' ? undefined : undefined });
    if (severity !== 'minor') {
      const blanket = k.iso(-1.2, 2.5, 0.7);
      context.fillStyle = '#d9a23a';
      context.fillRect(blanket.x - 8, blanket.y - 12, 16, 14);
    }
    k.person(-3.0, 3.4, peerLook((data.seed ?? 1) + 41), { pose: 'waving', expression: null, time, size: 0.2 });
    k.person(3.6, 3.6, peerLook((data.seed ?? 1) + 42), { pose: 'standing', expression: 'sad', time, size: 0.2, facing: -1 });
    k.person(1.8, 3.2, peerLook((data.seed ?? 1) + 43), { pose: 'standing', expression: 'sad', time, size: 0.2, facing: -1 });
    // The response: a police car at once, the ambulance arriving for anything worse than a scrape.
    k.box(-6.0, 1.0, 0.25, 1.0, 2.6, 0.7, '#f4f4f2');
    k.box(-5.95, 1.4, 0.95, 0.9, 1.6, 0.5, '#f4f4f2');
    k.box(-6.02, 1.0, 0.45, 0.04, 2.6, 0.2, '#1f3a5f');
    beacon(context, k, -5.5, 2.3, 1.6, time, 0, 80);
    if (severity !== 'minor') {
      const arrive = Math.min(1, time / 3.5);
      const ax = -12 + arrive * 5.6;
      k.box(ax, -1.6, 0.4, 3.4, 1.8, 1.8, '#f4f4f2');
      k.box(ax + 3.4, -1.5, 0.4, 1.1, 1.6, 1.1, '#f4f4f2');
      k.box(ax, -1.62, 0.9, 3.4, 0.04, 0.22, '#d8262f');
      beacon(context, k, ax + 0.6, -1.0, 2.3, time, 0, 120);
      beacon(context, k, ax + 2.4, -1.0, 2.3, time, 3, 120);
      if (arrive >= 1) {
        const paramedic = { top: '#1d2f55', bottom: '#14203a', shirt: '#f2d13a' };
        k.person(-2.4, 1.6, peerLook((data.seed ?? 1) + 61), { pose: 'walking', expression: null, time: time * 1.4, size: 0.21, outfit: paramedic });
        k.person(-0.6, 2.0, peerLook((data.seed ?? 1) + 62), { pose: 'standing', expression: null, time, size: 0.21, facing: -1, outfit: paramedic });
        if (severity === 'severe') k.box(-1.6, 1.6, 0.35, 2.0, 0.6, 0.08, '#cfd6df');
      }
    }
    // Cones and a road-closed sign, a passing umbrella.
    for (const [x, y] of [[-3.5, -1.2], [-3.9, 0.6], [3.9, 0.4]]) {
      k.box(x, y, 0, 0.22, 0.22, 0.4, '#ff7b2a');
      k.box(x - 0.04, y - 0.04, 0.14, 0.3, 0.3, 0.08, '#ffffff');
    }
    umbrella(context, k, 6.5, 0.4, 0, '#2a3550', '#ffffff');
    rain(context, width, height, time, { count: 90, speed: 520, slant: 0.05 });
    context.fillStyle = 'rgba(30,38,50,0.12)';
    context.fillRect(0, 0, width, height);
  }, { zoom: 0.52, originY: 0.62 });

  // ── Farewell: a graveside in light rain ─────────────────────────────
  const farewell = interim(7, (data) => [`${data.lostLabel ?? 'Someone you loved'} is laid to rest.`, 'The rain is light. Everybody stands very close together.'], (context, width, height, time, data, k) => {
    sky(context, width, height, '#7f8a96', '#b3bcc4');
    cloud(context, width * 0.3, height * 0.12, 70, 'rgba(210,214,220,0.6)');
    cloud(context, width * 0.72, height * 0.08, 56, 'rgba(210,214,220,0.5)');
    k.ground(-40, -40, 40, 40, '#76876e');
    for (let stripe = -10; stripe < 11; stripe += 1) k.ground(stripe * 1.2, -12, stripe * 1.2 + 0.6, 12, 'rgba(255,255,255,0.04)');
    k.ground(-1.0, 3, 1.4, 14, '#a8a398');
    // Headstones in rows, a stone angel, an iron fence at the back and an old oak.
    for (let row = 0; row < 4; row += 1) for (let stone = 0; stone < 9; stone += 1) {
      const x = -9 + stone * 2.1 + (row % 2) * 1.0;
      const y = -8 + row * 2.3;
      if (Math.abs(x - 0.2) < 1.6 && Math.abs(y + 0.5) < 2.2) continue;
      const shade = hash(row * 9 + stone) > 0.5 ? '#9fa3a8' : '#868b92';
      k.box(x, y, 0, 0.9, 0.2, 1.0 + hash(stone + row) * 0.4, shade);
      k.box(x + 0.1, y, 1.0 + hash(stone + row) * 0.4, 0.7, 0.2, 0.18, shade);
    }
    for (let bar = 0; bar < 24; bar += 1) k.box(-11 + bar, -11, 0, 0.06, 0.06, 1.5, '#2a2d33');
    k.box(-11, -11, 1.2, 24, 0.06, 0.06, '#2a2d33');
    tree(k, context, -8, -7, { height: 7, crown: '#6f8a58' });
    tree(k, context, 8.5, -6, { height: 6, crown: '#8a7a40' });
    // The open grave, the casket on its straps, the heap of earth under a green cloth, wreaths.
    k.box(-0.9, -1.6, -0.05, 2.2, 2.6, 0.02, '#1d1710');
    k.box(-0.7, -1.4, 0, 1.8, 2.2, 0.0, '#1d1710');
    k.box(-0.3, -1.1, 0.12, 1.0, 2.0, 0.6, '#5b3a22');
    k.box(-0.35, -1.15, 0.72, 1.1, 2.1, 0.06, '#6b4630');
    k.box(-1.2, -1.7, 0.0, 0.2, 2.8, 0.08, '#2a6a3a');
    k.box(1.4, -1.7, 0.0, 0.2, 2.8, 0.08, '#2a6a3a');
    k.box(1.8, -2.4, 0, 2.6, 1.4, 0.7, '#4a3a28');
    const wreaths = [[-1.6, 0.4, '#f6efe4', '#5a8a5a'], [1.7, 0.4, '#d6336c', '#5a8a5a'], [0.2, 1.4, '#f6efe4', '#5a8a5a']];
    wreaths.forEach(([x, y, a, b]) => {
      const p = k.iso(x, y, 0.9);
      context.strokeStyle = b;
      context.lineWidth = 7;
      context.beginPath();
      context.ellipse(p.x, p.y, k.unit * 0.45, k.unit * 0.38, 0, 0, TAU);
      context.stroke();
      context.fillStyle = a;
      for (let bloom = 0; bloom < 7; bloom += 1) {
        context.beginPath();
        context.arc(p.x + Math.cos(bloom) * k.unit * 0.45, p.y + Math.sin(bloom) * k.unit * 0.38, 4, 0, TAU);
        context.fill();
      }
      k.box(x - 0.04, y, 0, 0.05, 0.05, 0.9, '#6b5038');
    });
    // A photograph on an easel, the name beneath it.
    k.box(-2.8, 0.2, 0, 0.6, 0.04, 1.4, '#6b5038');
    const photo = k.iso(-2.5, 0.22, 1.5);
    context.fillStyle = '#ffffff';
    context.fillRect(photo.x - 12, photo.y - 16, 24, 30);
    context.fillStyle = '#c9b79b';
    context.fillRect(photo.x - 9, photo.y - 13, 18, 22);
    context.fillStyle = '#7a6a58';
    context.beginPath();
    context.arc(photo.x, photo.y - 4, 5, 0, TAU);
    context.fill();
    // The officiant at the head, the hearse behind, the mourners in black under umbrellas.
    k.person(-0.1, -2.4, peerLook((data.seed ?? 1) + 150), { pose: 'standing', expression: null, time, size: 0.22, outfit: { top: '#2b2230', bottom: '#2b2230', shirt: '#ffffff' } });
    k.box(5.0, 3.4, 0.35, 4.6, 1.5, 1.1, '#15171a');
    k.box(5.0, 3.4, 1.45, 4.6, 1.5, 0.12, '#101215');
    for (let window = 0; window < 4; window += 1) k.box(5.4 + window * 1.0, 4.9, 0.9, 0.7, 0.04, 0.5, '#3a4452');
    for (let mourner = 0; mourner < 11; mourner += 1) {
      const angle = Math.PI * 0.1 + mourner / 11 * Math.PI * 0.8;
      const x = Math.cos(angle) * 4.4 + 0.3;
      const y = 2.6 + Math.sin(angle) * 1.8;
      if (mourner % 3 === 0) umbrella(context, k, x - 0.4, y - 0.4, 0, '#101215', '#2a2d33');
      k.person(x, y, peerLook((data.seed ?? 1) + 160 + mourner), { pose: 'mourning', expression: 'sad', time: time + mourner, size: 0.21, facing: x > 0 ? -1 : 1, outfit: BLACK });
    }
    // The player at the front with a single white flower, the partner's arm around them.
    k.person(0.1, 1.6, data.look, { pose: 'mourning', expression: 'sad', time, size: 0.23, outfit: BLACK });
    if (data.partnerLook) k.person(1.0, 1.6, data.partnerLook, { pose: 'standing', expression: 'sad', time, size: 0.22, facing: -1, outfit: BLACK });
    const flower = k.iso(0.4, 0.8, 1.5);
    context.fillStyle = '#ffffff';
    context.beginPath();
    context.arc(flower.x, flower.y, 4, 0, TAU);
    context.fill();
    // Falling leaves and drifting rain; a crow on a stone.
    for (let leaf = 0; leaf < 24; leaf += 1) {
      const x = (hash(leaf) * width + time * 14 * (1 + hash(leaf + 3))) % width;
      const y = (hash(leaf + 6) * height + time * 24 * (0.5 + hash(leaf + 9))) % height;
      context.fillStyle = ['#a8742f', '#8a5a2a', '#c8923a'][leaf % 3];
      context.fillRect(x, y, 5, 3);
    }
    const crow = k.iso(-5.4, -4.8, 1.2);
    context.fillStyle = '#15171a';
    context.beginPath();
    context.ellipse(crow.x, crow.y, 8, 5, 0, 0, TAU);
    context.fill();
    rain(context, width, height, time, { count: 120, speed: 420, slant: 0.04 });
    context.fillStyle = 'rgba(40,50,62,0.18)';
    context.fillRect(0, 0, width, height);
  }, { zoom: 0.5, originY: 0.66 });

  // ── The fire: a house, a night sky lit orange, firefighters, a blanket ──
  const houseFire = interim(7, (data) => [data.fireOwned === false ? 'A call at 2 AM. The whole building is awake.' : 'A call at 2 AM. The whole street is awake.', 'Everyone is out. Everything else is a list.'], (context, width, height, time, data, k) => {
    sky(context, width, height, '#07090f', '#26192a');
    for (let star = 0; star < 40; star += 1) {
      context.fillStyle = 'rgba(255,255,255,0.5)';
      context.fillRect(hash(star) * width, hash(star + 3) * height * 0.4, 1.5, 1.5);
    }
    k.ground(-40, -40, 40, 40, '#2a3a2e');
    k.ground(-40, 3.6, 40, 7.0, '#34383f');
    for (let dash = -8; dash < 9; dash += 1) k.ground(dash * 2, 5.25, dash * 2 + 1, 5.35, '#c9c08a');
    const owned = data.fireOwned !== false;
    // The burning home, with fire at every window and in the roof, and the glow it throws.
    const burn = (x, y, z, scale) => {
      const p = k.iso(x, y, z);
      for (let flame = 0; flame < 4; flame += 1) {
        const sway = Math.sin(time * 9 + flame * 1.7 + x) * 5 * scale;
        context.fillStyle = ['#c8352f', '#ff7b2a', '#ffb02e', '#ffe08a'][flame];
        context.beginPath();
        context.moveTo(p.x - (14 - flame * 3) * scale, p.y);
        context.quadraticCurveTo(p.x + sway, p.y - (50 - flame * 9) * scale - Math.sin(time * 11 + flame) * 6, p.x + (14 - flame * 3) * scale, p.y);
        context.fill();
      }
      glow(context, p.x, p.y - 20 * scale, 120 * scale, 'rgba(255,140,40,0.45)');
    };
    if (owned) drawHouse(context, k, -8.0, -4.6, 'family');
    else drawApartment(context, k, -7.4, -4.4, 'worn');
    const spread = Math.min(1, time / 2.5);
    const sources = owned ? [[-5.4, -1.4, 2.4], [-3.0, -1.4, 2.4], [-1.0, -1.4, 2.4], [-4.2, -3.0, 4.6], [-6.6, -2.4, 4.6]] : [[-5.4, -0.2, 2.2], [-3.6, -0.2, 4.0], [-1.8, -0.2, 2.2], [-3.0, -0.2, 6.2], [-5.2, -0.2, 6.2]];
    sources.forEach(([x, y, z], index) => { if (index / sources.length <= spread + 0.1) burn(x, y, z, 0.9 + 0.5 * spread); });
    // A plume of smoke, embers rising.
    const plume = k.iso(-3.4, -2.0, 5.0);
    for (let puff = 0; puff < 14; puff += 1) {
      const age = (time * 0.3 + puff / 14) % 1;
      context.fillStyle = `rgba(30,30,36,${0.55 * (1 - age)})`;
      context.beginPath();
      context.arc(plume.x + age * 80 + Math.sin(puff) * 14, plume.y - age * height * 0.55, 20 + age * 50, 0, TAU);
      context.fill();
    }
    for (let ember = 0; ember < 28; ember += 1) {
      const age = (time * 0.5 + hash(ember)) % 1;
      context.fillStyle = `rgba(255,${150 + hash(ember + 2) * 80},60,${1 - age})`;
      context.fillRect(plume.x + Math.sin(ember * 2 + age * 5) * 70 + age * 50, plume.y - age * 220, 2.5, 2.5);
    }
    // The fire engine at the kerb, ladder up, water in an arc onto the roof.
    k.box(2.0, 3.8, 0.4, 5.6, 1.8, 1.8, '#c8352f');
    k.box(7.6, 3.9, 0.4, 1.6, 1.6, 1.3, '#c8352f');
    k.box(2.0, 3.78, 1.0, 5.6, 0.04, 0.12, '#f4f1ea');
    k.box(2.2, 3.9, 2.2, 5.0, 0.4, 0.2, '#9aa1a8');
    for (const x of [3.0, 8.3]) {
      const wheel = k.iso(x, 5.5, 0.4);
      context.fillStyle = '#0c0d10';
      context.beginPath();
      context.ellipse(wheel.x, wheel.y, k.unit * 0.42, k.unit * 0.44, 0, 0, TAU);
      context.fill();
    }
    beacon(context, k, 8.0, 4.2, 1.9, time, 0, 150);
    beacon(context, k, 2.6, 4.2, 2.4, time, 3, 150);
    const hose = [k.iso(2.5, 3.8, 1.8), k.iso(-0.5, 0.5, 4.0), k.iso(-3.0, -1.0, 4.6)];
    context.strokeStyle = 'rgba(190,225,255,0.75)';
    context.lineWidth = 4;
    context.setLineDash([10, 6]);
    context.lineDashOffset = -time * 40;
    context.beginPath();
    context.moveTo(hose[0].x, hose[0].y);
    context.quadraticCurveTo(hose[1].x, hose[1].y - 90, hose[2].x, hose[2].y);
    context.stroke();
    context.setLineDash([]);
    // Firefighters in yellow and black, neighbours in dressing gowns, the player wrapped in a foil blanket with the partner.
    const gear = { top: '#d9b72a', bottom: '#1f2228', shirt: '#d9b72a' };
    k.person(0.4, 2.4, peerLook((data.seed ?? 1) + 71), { pose: 'walking', expression: null, time: time * 1.6, size: 0.22, facing: -1, outfit: gear });
    k.person(-1.4, 1.2, peerLook((data.seed ?? 1) + 72), { pose: 'standing', expression: null, time, size: 0.22, outfit: gear });
    k.person(1.6, 2.2, peerLook((data.seed ?? 1) + 73), { pose: 'carrying', expression: null, time: time * 1.4, size: 0.22, facing: -1, outfit: gear });
    for (let neighbour = 0; neighbour < 4; neighbour += 1) {
      k.person(-3.6 + neighbour * 1.1, 4.4 + (neighbour % 2) * 0.4, peerLook((data.seed ?? 1) + 80 + neighbour), { pose: 'standing', expression: 'sad', time, size: 0.2, facing: neighbour % 2 ? 1 : -1, outfit: { top: ['#6a4a8a', '#3a6a7a', '#8a4a4a', '#6a6a4a'][neighbour], bottom: '#2a2a32', shirt: '#e8e8e8' } });
    }
    k.person(-5.0, 2.6, data.look, { pose: 'standing', expression: 'sad', time, size: 0.23, outfit: { top: '#9aa1a8', bottom: '#4b4f58', shirt: '#cfd2d6' } });
    if (data.partnerLook) k.person(-4.1, 2.6, data.partnerLook, { pose: 'standing', expression: 'sad', time, size: 0.22, facing: -1, outfit: { top: '#9aa1a8', bottom: '#4b4f58', shirt: '#cfd2d6' } });
    const dog = k.iso(-3.2, 3.2);
    context.fillStyle = '#b07a3a';
    context.beginPath();
    context.ellipse(dog.x, dog.y - k.unit * 0.22, k.unit * 0.3, k.unit * 0.16, 0, 0, TAU);
    context.fill();
    // A hydrant, a street lamp, a police tape line.
    k.box(0.0, 3.4, 0, 0.2, 0.2, 0.5, '#c8352f');
    k.box(-6.0, 6.2, 0, 0.1, 0.1, 3.4, '#33373d');
    const lamp = k.iso(-6.0, 6.2, 3.5);
    glow(context, lamp.x, lamp.y, 60, 'rgba(255,224,160,0.3)');
    const tapeA = k.iso(-7, 3.2, 0.9);
    const tapeB = k.iso(3, 3.2, 0.9);
    line(context, tapeA.x, tapeA.y, tapeB.x, tapeB.y, '#f5c542', 3);
    context.fillStyle = `rgba(255,120,40,${0.1 + 0.05 * Math.sin(time * 8)})`;
    context.fillRect(0, 0, width, height);
  }, { zoom: 0.5, originY: 0.66 });

  // ── The diagnosis: a consulting room, a scan on the light box ───────
  const diagnosis = interim(7, (data) => (data.illnessWho === 'partner'
    ? ['The doctor closes the door before she sits.', `${data.partnerFirstName ?? 'They'} takes ${data.firstName}'s hand. Neither of them says anything.`]
    : ['The doctor closes the door before she sits.', 'There is a word. After it, the room goes very quiet.']), (context, width, height, time, data, k) => {
    sky(context, width, height, '#dfe6ea', '#eef3f5');
    k.ground(-40, -40, 40, 40, '#d6dfe0');
    for (let tile = -10; tile < 11; tile += 1) {
      k.ground(tile, -8, tile + 0.03, 10, 'rgba(0,0,0,0.06)');
      k.ground(-10, tile, 10, tile + 0.03, 'rgba(0,0,0,0.06)');
    }
    k.box(-8, -4.5, 0, 16, 0.25, 4.6, '#eef3f4');
    // The window: a grey day, a hospital car park beyond.
    k.polygon([k.iso(3, -4.2, 1.2), k.iso(7, -4.2, 1.2), k.iso(7, -4.2, 3.9), k.iso(3, -4.2, 3.9)], '#b8c6d2');
    for (let car = 0; car < 5; car += 1) k.box(3.2 + car * 0.8, -4.6, 1.2, 0.5, 0.2, 0.25, ['#c8352f', '#e8e8e8', '#2f5f9a'][car % 3]);
    // The light box on the wall: a chest scan, a bright spot pulsing.
    k.box(-6.4, -4.2, 1.4, 3.2, 0.12, 2.0, '#1b1f26');
    const scan = k.iso(-4.8, -4.05, 2.4);
    context.fillStyle = '#0c1118';
    context.fillRect(scan.x - k.unit * 1.4, scan.y - k.unit * 0.9, k.unit * 2.8, k.unit * 1.8);
    context.strokeStyle = 'rgba(170,205,235,0.75)';
    context.lineWidth = 2;
    context.beginPath();
    context.ellipse(scan.x - k.unit * 0.5, scan.y, k.unit * 0.5, k.unit * 0.75, 0, 0, TAU);
    context.ellipse(scan.x + k.unit * 0.5, scan.y, k.unit * 0.5, k.unit * 0.75, 0, 0, TAU);
    context.moveTo(scan.x, scan.y - k.unit * 0.85);
    context.lineTo(scan.x, scan.y + k.unit * 0.85);
    context.stroke();
    for (let rib = 0; rib < 6; rib += 1) {
      context.beginPath();
      context.arc(scan.x, scan.y - k.unit * 0.5 + rib * k.unit * 0.2, k.unit * 0.95, 0.2, Math.PI - 0.2);
      context.stroke();
    }
    const pulse = 0.5 + 0.5 * Math.sin(time * 3);
    context.fillStyle = `rgba(255,255,255,${0.55 + 0.4 * pulse})`;
    context.beginPath();
    context.arc(scan.x - k.unit * 0.55, scan.y - k.unit * 0.15, k.unit * (0.12 + 0.03 * pulse), 0, TAU);
    context.fill();
    glow(context, scan.x - k.unit * 0.55, scan.y - k.unit * 0.15, k.unit * 0.8, 'rgba(255,255,255,0.35)');
    // A desk, a computer, tissues, a plant, a clipboard, the clock on the wall.
    k.box(-1.6, -2.4, 0, 3.4, 1.4, 0.8, '#b98f5a');
    k.box(-1.7, -2.5, 0.8, 3.6, 1.6, 0.07, '#8a6a4a');
    k.box(0.6, -2.1, 0.88, 0.9, 0.06, 0.55, '#1b1f26');
    k.box(-0.8, -1.6, 0.88, 0.3, 0.2, 0.15, '#7fb7e8');
    k.box(-1.3, -1.9, 0.88, 0.5, 0.4, 0.04, '#ffffff');
    tree(k, context, 6.0, -3.0, { height: 2.0, crown: '#4f8c4f' });
    const clock = k.iso(0.6, -4.2, 3.9);
    context.fillStyle = '#ffffff';
    context.beginPath();
    context.arc(clock.x, clock.y, k.unit * 0.4, 0, TAU);
    context.fill();
    line(context, clock.x, clock.y, clock.x, clock.y - k.unit * 0.28, '#222', 2);
    line(context, clock.x, clock.y, clock.x + Math.cos(time * 0.5) * k.unit * 0.3, clock.y + Math.sin(time * 0.5) * k.unit * 0.3, '#222', 1.5);
    // The doctor standing by the scan, the patient and the one beside them in two chairs.
    k.person(-1.6, -0.8, peerLook((data.seed ?? 1) + 131), { pose: 'standing', expression: null, time, size: 0.22, outfit: { top: '#f4f6f8', bottom: '#dfe6ec', shirt: '#8fb3d6' } });
    k.box(0.4, 1.2, 0, 0.7, 0.7, 0.5, '#4a6a8a');
    k.box(1.6, 1.2, 0, 0.7, 0.7, 0.5, '#4a6a8a');
    const sick = data.illnessWho === 'partner';
    k.person(0.7, 1.4, sick ? (data.partnerLook ?? peerLook((data.seed ?? 1) + 5)) : data.look, { pose: 'sitting', expression: 'sad', time, z: 0.5, size: 0.22, outfit: { top: '#e8e8ea', bottom: '#4b4f58', shirt: '#e8e8ea' } });
    k.person(1.9, 1.4, sick ? data.look : (data.partnerLook ?? peerLook((data.seed ?? 1) + 5)), { pose: 'sitting', expression: 'sad', time, z: 0.5, size: 0.22, facing: -1, outfit: { top: '#4a5a6a', bottom: '#2a2f3a', shirt: '#ffffff' } });
    // Hands held between the chairs.
    const hands = k.iso(1.35, 1.4, 1.0);
    context.fillStyle = '#d9a67a';
    context.beginPath();
    context.arc(hands.x, hands.y, 5, 0, TAU);
    context.fill();
    // The light through the window, the room cooler, a vignette.
    const vignette = context.createRadialGradient(width / 2, height / 2, height * 0.3, width / 2, height / 2, height * 0.9);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(10,20,40,0.35)');
    context.fillStyle = vignette;
    context.fillRect(0, 0, width, height);
  }, { zoom: 0.52, originY: 0.62 });

  return { carCrash, farewell, houseFire, diagnosis };
}
