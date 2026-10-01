// The big personal moments, drawn in detail: the wedding, the holiday, the
// ambulance, and the new ones that come with a partner (a first date, a
// newborn, a breakup, a divorce). Every scene is a small set: far
// background, mid-ground with people in it, and a foreground, lit for its
// hour of the day.

import { hash, glow, cloud, band, waterShine, birds, line, fillPolygon } from './scenes-world.js';

const TAU = Math.PI * 2;

const SUIT = { top: '#1d2433', bottom: '#1d2433', shirt: '#ffffff' };
const GOWN = { top: '#f8f4ee', bottom: '#f8f4ee', shirt: '#f8f4ee' };

/** What each half of a couple wears to a wedding, by who is who. */
function weddingOutfits(data) {
  const playerIsBride = data.gender === 'female';
  return { player: playerIsBride ? GOWN : SUIT, partner: playerIsBride ? SUIT : GOWN };
}

function partnerOf(data, tools, salt = 5) {
  return data.partnerLook ?? tools.peerLook((data.seed ?? 1) + salt);
}

/** Mow stripes: alternating bands of lawn. */
function lawn(k, x0, y0, x1, y1, a, b, stripes = 14) {
  const step = (x1 - x0) / stripes;
  for (let stripe = 0; stripe < stripes; stripe += 1) k.ground(x0 + stripe * step, y0, x0 + (stripe + 1) * step, y1, stripe % 2 ? a : b);
}

function chair(k, x, y, color = '#f4f1ea') {
  k.box(x, y, 0, 0.06, 0.06, 0.4, color);
  k.box(x + 0.34, y, 0, 0.06, 0.06, 0.4, color);
  k.box(x, y + 0.34, 0, 0.06, 0.06, 0.4, color);
  k.box(x + 0.34, y + 0.34, 0, 0.06, 0.06, 0.4, color);
  k.box(x - 0.02, y - 0.02, 0.4, 0.44, 0.44, 0.05, color);
  k.box(x - 0.02, y + 0.42, 0.45, 0.44, 0.04, 0.5, color);
}

function flowers(context, k, x, y, z, count, colors, spread = 0.5, size = 4) {
  for (let index = 0; index < count; index += 1) {
    const p = k.iso(x + (hash(index + x * 3) - 0.5) * spread * 2, y + (hash(index + 9 + y) - 0.5) * spread * 2, z + hash(index + 5) * spread);
    context.fillStyle = colors[index % colors.length];
    context.beginPath();
    context.arc(p.x, p.y, size * (0.7 + hash(index) * 0.7), 0, TAU);
    context.fill();
  }
}

export function lifeScenes(tools) {
  const { interim, sky, tree, falling, rain, mixColor, peerLook, umbrella } = tools;

  // ── The wedding: a garden in the late afternoon ─────────────────────
  const married = interim(6.5, (data) => [`${data.partnerFirstName ?? 'They'} says yes, and so does ${data.firstName}.`, 'Just married.'], (context, width, height, time, data, k) => {
    sky(context, width, height, '#9fd0f2', '#fbe9c9');
    glow(context, width * 0.18, height * 0.14, height * 0.6, 'rgba(255,236,190,0.95)');
    cloud(context, width * 0.62 + Math.sin(time * 0.2) * 12, height * 0.14, 50, 'rgba(255,255,255,0.8)');
    // A tree line, in three greens.
    for (let layer = 0; layer < 3; layer += 1) {
      context.fillStyle = ['#8fb287', '#6b9a66', '#4f8452'][layer];
      for (let blob = 0; blob < 26; blob += 1) {
        context.beginPath();
        context.arc(blob * width / 25 + hash(blob + layer * 9) * 20, height * (0.4 + layer * 0.03) - hash(blob + layer) * 16, 36 + hash(blob + 4) * 26, 0, TAU);
        context.fill();
      }
    }
    k.ground(-40, -40, 40, 40, '#8fc47a');
    lawn(k, -9, -5, 9, 8, '#8fc47a', '#86bb73');
    // The rose arch.
    const left = k.iso(-1.3, -3.2, 0);
    const right = k.iso(1.3, -3.2, 0);
    const crown = k.iso(0, -3.2, 3.5);
    context.strokeStyle = '#ffffff';
    context.lineWidth = k.unit * 0.12;
    context.beginPath();
    context.moveTo(left.x, left.y);
    context.lineTo(left.x, left.y - k.unit * 2.4);
    context.quadraticCurveTo(crown.x, crown.y - k.unit * 0.6, right.x, right.y - k.unit * 2.4);
    context.lineTo(right.x, right.y);
    context.stroke();
    for (let bloom = 0; bloom < 60; bloom += 1) {
      const t = bloom / 59;
      const x = left.x + (right.x - left.x) * t;
      const arch = Math.sin(t * Math.PI);
      const y = left.y - k.unit * (2.2 + arch * 1.0) + hash(bloom) * 8;
      context.fillStyle = ['#f6a6bb', '#ffffff', '#f4c6d4', '#6fa66a'][bloom % 4];
      context.beginPath();
      context.arc(x + (hash(bloom + 3) - 0.5) * 10, y, 4 + hash(bloom + 7) * 4, 0, TAU);
      context.fill();
    }
    flowers(context, k, -1.3, -3.2, 0.4, 14, ['#f6a6bb', '#ffffff', '#f4c6d4'], 0.35);
    flowers(context, k, 1.3, -3.2, 0.4, 14, ['#f6a6bb', '#ffffff', '#f4c6d4'], 0.35);
    // The aisle, a runner scattered with petals, and rows of chairs either side.
    k.ground(-0.65, -3, 0.65, 6.5, '#f3ecdd');
    for (let petal = 0; petal < 30; petal += 1) {
      const p = k.iso(-0.5 + hash(petal) * 1, -2.5 + hash(petal + 4) * 8.5);
      context.fillStyle = petal % 3 ? '#f6a6bb' : '#ffffff';
      context.beginPath();
      context.ellipse(p.x, p.y, 3, 1.8, 0.4, 0, TAU);
      context.fill();
    }
    const guestColors = ['#b0495a', '#3f6f9a', '#e0a050', '#5a8a64', '#7a5a9a', '#c8644a', '#2f3a4a', '#d98aa0'];
    for (let row = 0; row < 6; row += 1) {
      for (const side of [-1, 1]) {
        for (let seat = 0; seat < 3; seat += 1) {
          const x = side * (1.0 + seat * 0.62) - (side < 0 ? 0.4 : 0);
          const y = -1.4 + row * 1.2;
          chair(k, x, y);
          if (hash(row * 7 + seat + (side > 0 ? 40 : 0)) > 0.18) {
            const guest = peerLook((data.seed ?? 1) + row * 13 + seat * 5 + (side > 0 ? 71 : 3));
            const clap = Math.sin(time * 9 + row + seat) > 0.8 && time > 4;
            k.person(x + 0.2, y + 0.2, guest, { pose: clap ? 'waving' : 'sitting', expression: 'happy', time: time + row, z: 0.4, size: 0.17, facing: side > 0 ? -1 : 1, outfit: { top: guestColors[(row + seat + (side > 0 ? 3 : 0)) % guestColors.length], bottom: '#2f3a4a', shirt: '#ffffff' } });
          }
        }
      }
    }
    // The officiant behind the arch, the couple in front of it.
    k.person(0, -3.6, peerLook((data.seed ?? 1) + 91), { pose: 'standing', expression: 'happy', time, size: 0.2, outfit: { top: '#3a2a4a', bottom: '#3a2a4a', shirt: '#ffffff' } });
    const outfits = weddingOutfits(data);
    const walk = Math.min(1, time / 2.2);
    k.person(-0.55 - (1 - walk) * 0.2, -2.3 + (1 - walk) * 4.5, data.look, { pose: walk < 1 ? 'walking' : 'standing', expression: 'happy', time, outfit: outfits.player, size: 0.22 });
    k.person(0.55 + (1 - walk) * 0.2, -2.3 + (1 - walk) * 4.5, partnerOf(data, tools), { pose: walk < 1 ? 'walking' : 'standing', expression: 'happy', time, outfit: outfits.partner, size: 0.22, facing: -1 });
    // The flower girl, scattering petals ahead of them.
    if (time < 3) k.person(0, 0.6 + (time / 3) * 3, peerLook((data.seed ?? 1) + 17), { pose: 'walking', expression: 'happy', time, size: 0.13, outfit: { top: '#f6c6d4', bottom: '#f6c6d4', shirt: '#ffffff' } });
    // The cake table, and the string lights overhead.
    k.box(4.6, 3.4, 0, 1.4, 1.0, 0.8, '#ffffff');
    k.box(4.8, 3.6, 0.8, 1.0, 0.6, 0.3, '#fbe4ea');
    k.box(5.0, 3.75, 1.1, 0.6, 0.35, 0.28, '#ffffff');
    k.box(5.2, 3.85, 1.38, 0.2, 0.15, 0.18, '#f6a6bb');
    for (let strand = 0; strand < 3; strand += 1) {
      context.strokeStyle = 'rgba(50,40,30,0.55)';
      context.lineWidth = 1;
      const a = k.iso(-7, -4 + strand * 4.2, 4.2);
      const b = k.iso(7, -4 + strand * 4.2, 4.2);
      context.beginPath();
      context.moveTo(a.x, a.y);
      context.quadraticCurveTo((a.x + b.x) / 2, (a.y + b.y) / 2 + k.unit * 1.1, b.x, b.y);
      context.stroke();
      for (let bulb = 0; bulb <= 18; bulb += 1) {
        const t = bulb / 18;
        const x = a.x + (b.x - a.x) * t;
        const y = a.y + (b.y - a.y) * t + Math.sin(t * Math.PI) * k.unit * 0.55;
        glow(context, x, y, 9, 'rgba(255,220,150,0.7)');
        context.fillStyle = '#fff2c4';
        context.fillRect(x - 1.5, y - 1.5, 3, 3);
      }
    }
    for (const [x, y] of [[-7, 2], [7, 1], [-6.4, -4], [6.8, -4.6]]) tree(k, context, x, y, { height: 4, crown: '#4f8c4f' });
    // A photographer, and the flash.
    k.person(3.2, 5.6, peerLook((data.seed ?? 1) + 33), { pose: 'standing', expression: 'happy', time, size: 0.2, facing: -1 });
    if (Math.sin(time * 4.3) > 0.97) {
      context.fillStyle = 'rgba(255,255,255,0.45)';
      context.fillRect(0, 0, width, height);
    }
    // The kiss, then the petals and the rice.
    if (time > 3.6) falling(context, width, height, time, ['#ffffff', '#f7c6d4', '#ffe9a8', '#f6a6bb'], { count: 120, speed: 110, size: 6 });
    // Shafts of low sun through the trees.
    context.fillStyle = 'rgba(255,240,200,0.08)';
    for (let shaft = 0; shaft < 4; shaft += 1) fillPolygon(context, [[width * (0.1 + shaft * 0.12), 0], [width * (0.16 + shaft * 0.12), 0], [width * (0.42 + shaft * 0.12), height], [width * (0.3 + shaft * 0.12), height]], 'rgba(255,240,200,0.07)');
  }, { zoom: 0.5, originY: 0.6 });

  // ── The holiday: a beach resort ─────────────────────────────────────
  const holiday = interim(6.5, (data) => [`${data.firstName} switches off. Properly.`, 'The inbox can wait. The waves cannot.'], (context, width, height, time, data, k) => {
    sky(context, width, height, '#3f9be0', '#c9ecfb');
    cloud(context, width * 0.25 + (time * 5) % 30, height * 0.14, 52);
    cloud(context, width * 0.7 - (time * 3) % 30, height * 0.1, 40);
    context.fillStyle = '#fff4c4';
    context.beginPath();
    context.arc(width * 0.82, height * 0.14, height * 0.06, 0, TAU);
    context.fill();
    glow(context, width * 0.82, height * 0.14, height * 0.3, 'rgba(255,244,196,0.7)');
    // The sea: deep out, turquoise in, foam at the shore, a far island.
    band(context, width, height * 0.38, height * 0.56, '#1d76b8', '#1fa3c9');
    band(context, width, height * 0.56, height * 0.64, '#27c1c9', '#7fe3d8');
    fillPolygon(context, [[width * 0.05, height * 0.38], [width * 0.18, height * 0.3], [width * 0.3, height * 0.38]], '#4e8a62');
    waterShine(context, width, height * 0.4, height * 0.62, time, 'rgba(255,255,255,0.4)', 30);
    for (let wave = 0; wave < 3; wave += 1) {
      const y = height * (0.61 + wave * 0.012) + Math.sin(time * 1.4 + wave) * 4;
      context.strokeStyle = `rgba(255,255,255,${0.7 - wave * 0.2})`;
      context.lineWidth = 3;
      context.beginPath();
      for (let x = 0; x <= width; x += 16) context.lineTo(x, y + Math.sin(x / 40 + time * 2 + wave) * 3);
      context.stroke();
    }
    // A sailboat and a kite.
    const boatX = width * 0.46 + Math.sin(time * 0.3) * 30;
    fillPolygon(context, [[boatX - 16, height * 0.42], [boatX + 18, height * 0.42], [boatX + 12, height * 0.435], [boatX - 10, height * 0.435]], '#f6efe4');
    fillPolygon(context, [[boatX + 1, height * 0.42 - 32], [boatX + 1, height * 0.42 - 2], [boatX + 17, height * 0.42 - 4]], '#ffffff');
    const kite = { x: width * 0.6 + Math.sin(time * 0.8) * 30, y: height * 0.22 + Math.cos(time * 0.6) * 10 };
    fillPolygon(context, [[kite.x - 18, kite.y], [kite.x, kite.y - 12], [kite.x + 18, kite.y], [kite.x, kite.y + 10]], '#e5484d');
    line(context, kite.x, kite.y + 10, kite.x - 30, height * 0.44, 'rgba(40,40,50,0.5)', 1);
    // The sand, with the wet edge.
    band(context, width, height * 0.64, height, '#e8d7a6', '#f2e4b8');
    band(context, width, height * 0.64, height * 0.68, '#cdb98a', '#e8d7a6');
    for (let ripple = 0; ripple < 40; ripple += 1) {
      context.fillStyle = 'rgba(190,160,110,0.25)';
      context.fillRect(hash(ripple) * width, height * (0.7 + hash(ripple + 2) * 0.28), 14 + hash(ripple + 5) * 20, 1.5);
    }
    // Palms, swaying.
    const palm = (x, y, size, lean) => {
      const base = { x, y };
      const topPoint = { x: x + lean, y: y - size };
      context.strokeStyle = '#8a6a42';
      context.lineWidth = size * 0.1;
      context.beginPath();
      context.moveTo(base.x, base.y);
      context.quadraticCurveTo(base.x + lean * 0.2, base.y - size * 0.6, topPoint.x, topPoint.y);
      context.stroke();
      for (let frond = 0; frond < 8; frond += 1) {
        const angle = Math.PI + frond * Math.PI / 7 + Math.sin(time * 1.4 + frond + x) * 0.07;
        context.strokeStyle = frond % 2 ? '#2f7d3b' : '#3a8f48';
        context.lineWidth = size * 0.07;
        context.beginPath();
        context.moveTo(topPoint.x, topPoint.y);
        context.quadraticCurveTo(topPoint.x + Math.cos(angle) * size * 0.4, topPoint.y - size * 0.22, topPoint.x + Math.cos(angle) * size * 0.62, topPoint.y + Math.abs(Math.sin(angle)) * size * 0.25);
        context.stroke();
      }
      context.fillStyle = '#5a3a1e';
      context.beginPath();
      context.arc(topPoint.x, topPoint.y + 3, size * 0.04, 0, TAU);
      context.fill();
    };
    palm(width * 0.08, height * 0.72, height * 0.5, 40);
    palm(width * 0.94, height * 0.7, height * 0.44, -30);
    palm(width * 0.17, height * 0.66, height * 0.36, 20);
    const k2 = k;
    // The tiki bar: thatched roof on posts, a counter, stools, bottles.
    k2.box(5.2, -1.2, 0, 0.14, 0.14, 2.1, '#6a4c30');
    k2.box(8, -1.2, 0, 0.14, 0.14, 2.1, '#6a4c30');
    k2.box(5.2, 1.4, 0, 0.14, 0.14, 2.1, '#6a4c30');
    k2.box(8, 1.4, 0, 0.14, 0.14, 2.1, '#6a4c30');
    k2.box(5.3, 0.5, 0, 2.8, 0.6, 0.85, '#8a5a36');
    k2.box(5.25, 0.45, 0.85, 2.9, 0.7, 0.07, '#b78a4a');
    for (let bottle = 0; bottle < 6; bottle += 1) k2.box(5.5 + bottle * 0.4, 0.6, 0.92, 0.1, 0.1, 0.3, ['#2f8f4e', '#c8352f', '#e0a050'][bottle % 3]);
    k2.roof(4.9, -1.5, 2.1, 3.6, 3.4, 1.0, '#c9a55a');
    for (let stool = 0; stool < 3; stool += 1) k2.box(5.5 + stool * 0.8, 1.35, 0, 0.3, 0.3, 0.55, '#a8723f');
    k2.person(6, 0.3, peerLook((data.seed ?? 1) + 50), { pose: 'standing', expression: 'happy', time, size: 0.2, outfit: { top: '#ffffff', bottom: '#2f3a4a', shirt: '#ffffff' } });
    // Umbrellas (3D), loungers and towels in a loose row, with people on them.
    const umbrellaColors = [['#e5484d', '#ffffff'], ['#f5c542', '#ffffff'], ['#1aa3a3', '#ffffff'], ['#e5484d', '#ffffff']];
    [[-6.2, 1.6], [-3.4, 2.6], [-0.4, 3.4], [2.4, 2.4]].forEach(([x, y], index) => {
      umbrella(context, k2, x, y, 0, umbrellaColors[index][0], umbrellaColors[index][1]);
      k2.box(x - 0.5, y + 0.4, 0, 0.9, 0.4, 0.1, ['#f5c542', '#e5484d', '#ffffff', '#1aa3a3'][index]);
      k2.box(x - 0.45, y + 0.9, 0.12, 0.8, 0.5, 0.08, '#f4f1ea');
      k2.box(x - 0.45, y + 0.85, 0.2, 0.2, 0.55, 0.28, '#f4f1ea');
    });
    k2.person(-1.4, 4.7, data.look, { pose: 'sitting', expression: 'happy', time, z: 0.32, size: 0.2, outfit: { top: '#1aa3a3', bottom: '#f4d06f', shirt: '#1aa3a3' } });
    k2.person(-3.3, 3.9, peerLook((data.seed ?? 1) + 70), { pose: 'sitting', expression: 'happy', time, z: 0.3, size: 0.2, outfit: { top: '#f06595', bottom: '#ffffff', shirt: '#f06595' } });
    // A cocktail on a side table, a book, a pair of sunglasses.
    k2.box(-2.7, 4.5, 0, 0.4, 0.4, 0.4, '#a8723f');
    const drink = k2.iso(-2.5, 4.7, 0.62);
    context.fillStyle = '#ff7b4a';
    context.fillRect(drink.x - 4, drink.y - 10, 8, 10);
    context.fillStyle = '#2f8f4e';
    context.fillRect(drink.x + 1, drink.y - 16, 2, 8);
    // A sandcastle with a flag, and children building it.
    k2.box(-8.6, 4.6, 0, 1.2, 1.0, 0.4, '#d9bf86');
    k2.box(-8.4, 4.75, 0.4, 0.8, 0.7, 0.3, '#d9bf86');
    k2.box(-8.2, 4.9, 0.7, 0.4, 0.4, 0.25, '#d9bf86');
    k2.box(-8.02, 5.0, 0.95, 0.04, 0.04, 0.5, '#6a4c30');
    fillPolygon(context, [[k2.iso(-8, 5.0, 1.45).x, k2.iso(-8, 5.0, 1.45).y], [k2.iso(-8, 5.0, 1.2).x + 12, k2.iso(-8, 5.0, 1.3).y], [k2.iso(-8, 5.0, 1.2).x, k2.iso(-8, 5.0, 1.2).y]], '#e5484d');
    k2.person(-7.4, 5.4, peerLook((data.seed ?? 1) + 88), { pose: 'sitting', expression: 'happy', time, z: 0.1, size: 0.12, outfit: { top: '#f5c542', bottom: '#1aa3a3', shirt: '#f5c542' } });
    // A volleyball net with a bouncing ball, and a surfboard rack.
    k2.box(0.8, -2.4, 0, 0.06, 0.06, 1.5, '#8a6a4a');
    k2.box(0.8, 0.8, 0, 0.06, 0.06, 1.5, '#8a6a4a');
    const netA = k2.iso(0.83, -2.4, 1.4);
    const netB = k2.iso(0.83, 0.8, 1.4);
    line(context, netA.x, netA.y, netB.x, netB.y, 'rgba(255,255,255,0.9)', 2);
    const ballPhase = (time * 0.9) % 1;
    const ball = k2.iso(0.83, -1.2 + Math.sin(time * 1.8) * 1.5, 1.2 + Math.abs(Math.sin(ballPhase * Math.PI)) * 1.2);
    context.fillStyle = '#ffffff';
    context.beginPath();
    context.arc(ball.x, ball.y, k2.unit * 0.12, 0, TAU);
    context.fill();
    context.strokeStyle = '#e5484d';
    context.lineWidth = 1.2;
    context.stroke();
    for (const [x, color] of [[3.6, '#f5c542'], [3.95, '#1aa3a3'], [4.3, '#e5484d']]) k2.box(x, -2.8, 0, 0.12, 0.5, 1.5, color);
    // Swimmers, and gulls.
    for (let swimmer = 0; swimmer < 3; swimmer += 1) {
      const x = width * (0.28 + swimmer * 0.2) + Math.sin(time * 0.7 + swimmer) * 14;
      const y = height * (0.54 + swimmer * 0.015);
      context.fillStyle = '#d9a67a';
      context.beginPath();
      context.arc(x, y, 5, 0, TAU);
      context.fill();
      context.fillStyle = ['#e5484d', '#f5c542', '#ffffff'][swimmer];
      context.fillRect(x - 6, y + 4, 12, 3);
    }
    birds(context, width, height, time, 5, 'rgba(255,255,255,0.9)');
  }, { zoom: 0.62, originY: 0.7 });

  // ── The ambulance: a wet night on the street ────────────────────────
  const healthScare = interim(6, () => ['Chest pains. Sirens.', 'Stay with me.'], (context, width, height, time, data, k) => {
    const night = context.createLinearGradient(0, 0, 0, height);
    night.addColorStop(0, '#05080f');
    night.addColorStop(1, '#161d2e');
    context.fillStyle = night;
    context.fillRect(0, 0, width, height);
    const flash = Math.sin(time * 11) > 0;
    const siren = flash ? '255,40,50' : '40,110,255';
    // Buildings either side, with lit windows, washed by the light bar.
    for (let tower = 0; tower < 9; tower += 1) {
      const w = width * 0.12;
      const x = tower * w * 1.02 - 10;
      const h = height * (0.3 + hash(tower + 3) * 0.28);
      context.fillStyle = mixColor('#1b2236', '#0a0e1a', hash(tower) * 0.5);
      context.fillRect(x, height * 0.56 - h, w, h);
      for (let row = 0; row < Math.floor(h / 22); row += 1) {
        for (let column = 0; column < 4; column += 1) {
          const lit = hash(tower * 31 + row * 5 + column) > 0.72;
          context.fillStyle = lit ? 'rgba(255,200,120,0.6)' : 'rgba(40,60,90,0.45)';
          context.fillRect(x + 8 + column * (w - 16) / 4, height * 0.56 - h + 10 + row * 22, (w - 16) / 4 - 6, 12);
        }
      }
    }
    context.fillStyle = `rgba(${siren},0.1)`;
    context.fillRect(0, 0, width, height);
    // The wet street: kerb, lane, reflections of the siren.
    context.fillStyle = '#1f2533';
    context.fillRect(0, height * 0.56, width, height * 0.44);
    context.fillStyle = '#2b3347';
    context.fillRect(0, height * 0.56, width, 8);
    context.fillStyle = 'rgba(230,220,160,0.5)';
    for (let dash = 0; dash < 9; dash += 1) context.fillRect(dash * width / 8 + 10, height * 0.86, 40, 4);
    const k2 = k;
    // The ambulance, side on to the viewer: boxy white body, red stripe, cab, wheels, rear doors open.
    const ax = -3.6;
    const ay = 1.4;
    k2.box(ax, ay, 0.4, 3.6, 1.5, 1.7, '#f4f4f2');
    k2.box(ax + 3.6, ay + 0.05, 0.4, 1.2, 1.4, 1.2, '#f4f4f2');
    const windscreen = [k2.iso(ax + 4.8, ay + 0.15, 1.0), k2.iso(ax + 4.8, ay + 1.35, 1.0), k2.iso(ax + 4.8, ay + 1.35, 1.5), k2.iso(ax + 4.8, ay + 0.15, 1.5)];
    k2.polygon(windscreen, '#42586f');
    k2.box(ax - 0.01, ay + 1.5, 0.95, 3.62, 0.03, 0.22, '#d8262f');
    k2.box(ax + 0.9, ay + 1.5, 1.0, 0.8, 0.04, 0.8, '#d8262f');
    k2.box(ax + 1.2, ay + 1.52, 1.35, 0.2, 0.04, 0.6, '#ffffff');
    k2.box(ax + 1.0, ay + 1.52, 1.55, 0.6, 0.04, 0.2, '#ffffff');
    k2.box(ax + 0.4, ay + 0.3, 2.1, 1.3, 0.3, 0.14, '#2a2d33');
    const lightLeft = k2.iso(ax + 0.7, ay + 0.45, 2.3);
    const lightRight = k2.iso(ax + 2.1, ay + 0.45, 2.3);
    for (const [point, on] of [[lightLeft, flash], [lightRight, !flash]]) {
      context.fillStyle = on ? (point === lightLeft ? '#ff3b3b' : '#3b7bff') : '#2a2d33';
      context.fillRect(point.x - 9, point.y - 6, 18, 8);
      if (on) glow(context, point.x, point.y, 110, point === lightLeft ? 'rgba(255,60,60,0.55)' : 'rgba(60,120,255,0.55)');
    }
    for (const x of [ax + 0.7, ax + 3.9]) {
      const wheel = k2.iso(x, ay + 1.5, 0.35);
      context.fillStyle = '#0c0d10';
      context.beginPath();
      context.ellipse(wheel.x, wheel.y, k2.unit * 0.38, k2.unit * 0.4, 0, 0, TAU);
      context.fill();
      context.fillStyle = '#7d8590';
      context.beginPath();
      context.arc(wheel.x, wheel.y, k2.unit * 0.17, 0, TAU);
      context.fill();
    }
    k2.box(ax - 0.02, ay, 0.4, 0.04, 1.5, 1.7, '#e8e8e6');
    const headlamp = k2.iso(ax + 4.8, ay + 0.3, 0.8);
    glow(context, headlamp.x, headlamp.y, 60, 'rgba(255,240,200,0.5)');
    // The stretcher with the patient, two paramedics in navy and hi-vis.
    const paramedic = { top: '#1d2f55', bottom: '#14203a', shirt: '#f2d13a' };
    const roll = Math.min(1, time / 3);
    const gx = -0.5 + roll * 0.0;
    k2.box(gx - 0.1, 3.1, 0.35, 2.0, 0.6, 0.08, '#cfd6df');
    for (const dx of [0, 1.9]) k2.box(gx + dx - 0.05, 3.15, 0, 0.06, 0.5, 0.35, '#7d8590');
    k2.person(gx + 0.95, 3.25, data.look, { pose: 'lying', expression: 'sad', time, z: 0.43, size: 0.2, outfit: { top: '#7b7568', bottom: '#4b4740', shirt: '#7b7568' } });
    k2.person(gx - 0.5, 3.4, peerLook((data.seed ?? 1) + 61), { pose: 'walking', expression: null, time: time * 0.7, size: 0.21, outfit: paramedic });
    k2.person(gx + 2.5, 3.4, peerLook((data.seed ?? 1) + 62), { pose: 'walking', expression: null, time: time * 0.7 + 1, size: 0.21, facing: -1, outfit: paramedic });
    // Bystanders under umbrellas, cones and a streetlight.
    umbrella(context, k2, 4.6, 4.2, 0, '#2f5f9a', '#ffffff');
    k2.person(5.0, 4.6, peerLook((data.seed ?? 1) + 66), { pose: 'standing', expression: 'sad', time, size: 0.2 });
    for (const x of [-4.2, 3.6]) {
      k2.box(x, 2.9, 0, 0.22, 0.22, 0.4, '#ff7b2a');
      k2.box(x - 0.04, 2.86, 0.14, 0.3, 0.3, 0.08, '#ffffff');
    }
    k2.box(7.1, 0.8, 0, 0.08, 0.08, 3.4, '#2a2d33');
    const lamp = k2.iso(7.1, 0.8, 3.5);
    glow(context, lamp.x, lamp.y, 120, 'rgba(255,230,160,0.55)');
    // Rain, rings in the puddles, and the monitor.
    rain(context, width, height, time, { count: 260, speed: 780, slant: 0.1, color: 'rgba(200,215,240,0.5)' });
    for (let puddle = 0; puddle < 8; puddle += 1) {
      const age = (time * 1.4 + puddle * 0.37) % 1;
      context.strokeStyle = `rgba(200,215,240,${0.5 * (1 - age)})`;
      context.beginPath();
      context.ellipse(width * (0.1 + hash(puddle) * 0.8), height * (0.7 + hash(puddle + 4) * 0.25), 4 + age * 14, 1.5 + age * 5, 0, 0, TAU);
      context.stroke();
    }
    context.fillStyle = 'rgba(8,12,22,0.78)';
    context.beginPath();
    context.roundRect(width - 232, height - 108, 216, 84, 8);
    context.fill();
    context.strokeStyle = '#46e08a';
    context.lineWidth = 2;
    context.beginPath();
    for (let x = 0; x < 190; x += 2) {
      const phase = ((x + time * 120) % 95) / 95;
      let y = 0;
      if (phase > 0.42 && phase < 0.46) y = -10;
      else if (phase >= 0.46 && phase < 0.5) y = 34;
      else if (phase >= 0.5 && phase < 0.54) y = -22;
      else if (phase >= 0.7 && phase < 0.8) y = -7 * Math.sin((phase - 0.7) / 0.1 * Math.PI);
      context.lineTo(width - 220 + x, height - 70 - y * 0.8);
    }
    context.stroke();
    context.fillStyle = '#46e08a';
    context.font = '700 18px Barlow Condensed, sans-serif';
    context.fillText(`${Math.round(108 + Math.sin(time * 2) * 6)} BPM`, width - 80, height - 78);
  }, { zoom: 0.62, originY: 0.7 });

  // ── A first date: candles, string lights and the city ───────────────
  const dating = interim(5.5, (data) => [`${data.partnerFirstName ?? 'Someone'} laughs at the joke. A second dinner is booked.`], (context, width, height, time, data, k) => {
    sky(context, width, height, '#2a2150', '#e28a6a');
    glow(context, width * 0.5, height * 0.5, height * 0.5, 'rgba(255,190,120,0.5)');
    // A skyline, its windows coming on.
    for (let tower = 0; tower < 14; tower += 1) {
      const w = width / 12;
      const h = height * (0.15 + hash(tower + 2) * 0.25);
      context.fillStyle = '#231b3e';
      context.fillRect(tower * w * 0.95, height * 0.55 - h, w, h);
      for (let row = 0; row < h / 14; row += 1) for (let column = 0; column < 3; column += 1) {
        if (hash(tower * 17 + row * 3 + column) > 0.4 && time * 3 > hash(tower + row) * 6) {
          context.fillStyle = 'rgba(255,214,140,0.8)';
          context.fillRect(tower * w * 0.95 + 8 + column * w / 3.4, height * 0.55 - h + 8 + row * 14, w / 4.4, 7);
        }
      }
    }
    // The terrace: planks, a railing, string lights, a table for two.
    context.fillStyle = '#54402c';
    context.fillRect(0, height * 0.5, width, height * 0.5);
    k.ground(-8, -4, 8, 8, '#6a4c30');
    for (let plank = 0; plank < 16; plank += 1) k.ground(-8 + plank, -4, -7.95 + plank, 8, '#7a5a3c');
    k.box(-8, -4, 0, 16, 0.12, 1.0, '#3a2a22');
    for (let post = 0; post < 9; post += 1) k.box(-8 + post * 2, -4, 0, 0.1, 0.12, 1.4, '#3a2a22');
    for (let strand = 0; strand < 2; strand += 1) {
      const a = k.iso(-8, -3.5 + strand * 3.5, 3.2);
      const b = k.iso(8, -3.5 + strand * 3.5, 3.2);
      context.strokeStyle = 'rgba(30,20,20,0.6)';
      context.beginPath();
      context.moveTo(a.x, a.y);
      context.quadraticCurveTo((a.x + b.x) / 2, (a.y + b.y) / 2 + k.unit, b.x, b.y);
      context.stroke();
      for (let bulb = 0; bulb <= 20; bulb += 1) {
        const t = bulb / 20;
        const x = a.x + (b.x - a.x) * t;
        const y = a.y + (b.y - a.y) * t + Math.sin(t * Math.PI) * k.unit * 0.5;
        glow(context, x, y, 14 + Math.sin(time * 3 + bulb) * 2, 'rgba(255,220,150,0.7)');
      }
    }
    k.box(-0.6, 1.0, 0, 1.3, 1.3, 0.78, '#f4efe4');
    k.box(-0.04, 1.56, 0, 0.14, 0.14, 0, '#000000');
    const candle = k.iso(0.05, 1.65, 0.82);
    glow(context, candle.x, candle.y - 6, 60, 'rgba(255,190,100,0.65)');
    context.fillStyle = '#fff2c4';
    context.fillRect(candle.x - 2, candle.y - 12, 4, 12);
    context.fillStyle = '#ffb02e';
    context.beginPath();
    context.ellipse(candle.x, candle.y - 16 + Math.sin(time * 9) * 1, 3, 6, 0, 0, TAU);
    context.fill();
    for (const [x, y, color] of [[-0.25, 1.4, '#c8352f'], [0.35, 1.9, '#f4efe4']]) {
      const glass = k.iso(x, y, 0.82);
      context.fillStyle = color === '#c8352f' ? '#8a1f2f' : '#f2d98a';
      context.fillRect(glass.x - 3, glass.y - 12, 6, 12);
    }
    k.person(-0.1, 0.4, data.look, { pose: 'sitting', expression: 'happy', time, z: 0.4, size: 0.2, outfit: { top: '#3a2a4a', bottom: '#2a2a2e', shirt: '#f4efe4' } });
    k.person(0.5, 2.6, partnerOf(data, tools), { pose: 'sitting', expression: 'happy', time, z: 0.4, size: 0.2, facing: -1, outfit: { top: '#a84a6a', bottom: '#2a2a2e', shirt: '#f4efe4' } });
    // A violinist, because why not.
    k.person(4.8, 2.4, peerLook((data.seed ?? 1) + 22), { pose: 'standing', expression: 'happy', time, size: 0.2, facing: -1, outfit: { top: '#1d1d22', bottom: '#1d1d22', shirt: '#ffffff' } });
    falling(context, width, height, time, ['#ffd9a0', '#f7c6d4'], { count: 18, speed: 30, size: 3 });
  }, { zoom: 0.55, originY: 0.62 });

  // ── A newborn: a nursery at night ───────────────────────────────────
  const newborn = interim(6, (data) => ['A new person in the house. Nobody sleeps.', `Twelve weeks. ${data.firstName} learns what the laptop was never going to teach.`], (context, width, height, time, data, k) => {
    // A back wall with a window onto the night, a moon and stars.
    context.fillStyle = '#d9c7e0';
    context.fillRect(0, 0, width, height);
    context.fillStyle = '#c9b4d4';
    context.fillRect(0, 0, width, height * 0.42);
    for (let stripe = 0; stripe < 20; stripe += 1) {
      context.fillStyle = 'rgba(255,255,255,0.18)';
      context.fillRect(stripe * width / 10, 0, width / 20, height * 0.42);
    }
    const windowBox = { x: width * 0.12, y: height * 0.08, w: width * 0.22, h: height * 0.3 };
    context.fillStyle = '#16204a';
    context.fillRect(windowBox.x, windowBox.y, windowBox.w, windowBox.h);
    context.fillStyle = '#fff2c4';
    context.beginPath();
    context.arc(windowBox.x + windowBox.w * 0.7, windowBox.y + windowBox.h * 0.3, windowBox.h * 0.12, 0, TAU);
    context.fill();
    for (let star = 0; star < 14; star += 1) context.fillRect(windowBox.x + hash(star) * windowBox.w, windowBox.y + hash(star + 3) * windowBox.h * 0.6, 2, 2);
    context.strokeStyle = '#ffffff';
    context.lineWidth = 5;
    context.strokeRect(windowBox.x, windowBox.y, windowBox.w, windowBox.h);
    line(context, windowBox.x + windowBox.w / 2, windowBox.y, windowBox.x + windowBox.w / 2, windowBox.y + windowBox.h, '#ffffff', 4);
    // Wall decals: clouds and stars on the wall.
    cloud(context, width * 0.62, height * 0.2, 40, 'rgba(255,255,255,0.7)');
    cloud(context, width * 0.82, height * 0.14, 28, 'rgba(255,255,255,0.6)');
    context.fillStyle = '#b99568';
    context.fillRect(0, height * 0.42, width, height * 0.58);
    k.ground(-6, -4, 6, 6, '#c9a87a');
    k.ground(-3, -1, 3, 4, '#e8d9f0');
    // The crib with a mobile of stars and moons turning above.
    k.box(0.8, -1.6, 0, 1.8, 1.1, 0.12, '#f4f1ea');
    for (let rail = 0; rail < 9; rail += 1) k.box(0.8 + rail * 0.2, -0.55, 0.12, 0.05, 0.05, 0.9, '#f4f1ea');
    k.box(0.8, -0.55, 0.9, 1.8, 0.05, 0.08, '#f4f1ea');
    k.box(0.85, -1.5, 0.12, 1.7, 0.9, 0.2, '#ffffff');
    const mobile = k.iso(1.7, -1.1, 2.6);
    line(context, mobile.x, mobile.y - 40, mobile.x, mobile.y, '#9a8aa8', 2);
    for (let toy = 0; toy < 5; toy += 1) {
      const angle = time * 0.9 + toy * TAU / 5;
      context.fillStyle = ['#f4c542', '#a8c8ff', '#f7c6d4', '#ffffff', '#9fe0b0'][toy];
      context.beginPath();
      context.arc(mobile.x + Math.cos(angle) * k.unit * 0.8, mobile.y + Math.sin(angle) * k.unit * 0.18 + 14, k.unit * 0.12, 0, TAU);
      context.fill();
    }
    // A rocking chair, the parent in it with the bundle.
    const rock = Math.sin(time * 1.2) * 0.12;
    k.box(-2.4 + rock, 0.6, 0, 1.3, 1.1, 0.35, '#8a6a4a');
    k.box(-2.4 + rock, 1.55, 0.35, 1.3, 0.12, 1.0, '#8a6a4a');
    k.person(-1.95 + rock, 0.9, data.look, { pose: 'sitting', expression: 'happy', time, z: 0.42, size: 0.2, outfit: { top: '#7a8ca8', bottom: '#4b5568', shirt: '#7a8ca8' } });
    const bundle = k.iso(-1.55 + rock, 1.0, 1.15);
    context.fillStyle = '#fbe4ea';
    context.beginPath();
    context.ellipse(bundle.x, bundle.y, k.unit * 0.22, k.unit * 0.13, -0.4, 0, TAU);
    context.fill();
    context.fillStyle = '#f1d2b0';
    context.beginPath();
    context.arc(bundle.x - k.unit * 0.17, bundle.y - k.unit * 0.05, k.unit * 0.09, 0, TAU);
    context.fill();
    // The other parent at the door, a bottle in hand.
    k.person(3.6, 2.4, partnerOf(data, tools), { pose: 'standing', expression: 'happy', time, size: 0.21, facing: -1, outfit: { top: '#e8a6bc', bottom: '#4b5568', shirt: '#ffffff' } });
    // Toys, a night light, a pile of clean nappies, a laptop closed on a shelf.
    k.box(-4.8, -2.8, 0, 0.5, 0.5, 0.5, '#f4c542');
    k.box(-4.4, -2.4, 0, 0.4, 0.4, 0.4, '#7aa7ff');
    k.box(-3.6, -3.0, 0.9, 1.2, 0.5, 0.05, '#8a6a4a');
    k.box(-3.4, -2.95, 0.95, 0.9, 0.35, 0.06, '#2a2d33');
    const nightLight = k.iso(3.2, -1.4, 0.7);
    glow(context, nightLight.x, nightLight.y, k.unit * 4, 'rgba(255,200,130,0.4)');
    k.box(3.1, -1.5, 0, 0.5, 0.5, 0.7, '#8a6a4a');
    context.fillStyle = 'rgba(30,24,60,0.18)';
    context.fillRect(0, 0, width, height);
    // The clock on the wall: the small hours.
    const clock = { x: width * 0.52, y: height * 0.12 };
    context.fillStyle = '#ffffff';
    context.beginPath();
    context.arc(clock.x, clock.y, 22, 0, TAU);
    context.fill();
    line(context, clock.x, clock.y, clock.x + 8, clock.y - 8, '#2a2d33', 2);
    line(context, clock.x, clock.y, clock.x + Math.cos(time * 0.8) * 14, clock.y + Math.sin(time * 0.8) * 14, '#2a2d33', 1.5);
  }, { zoom: 0.62, originY: 0.66 });

  // ── The breakup: a dusk street, one walking away ────────────────────
  const breakup = interim(5.5, (data) => [`${data.partnerFirstName ?? 'They'} walks the other way.`, 'Nobody shouts. That is the worst of it.'], (context, width, height, time, data, k) => {
    sky(context, width, height, '#44506e', '#d0897a');
    for (let tower = 0; tower < 9; tower += 1) {
      context.fillStyle = '#2b3347';
      context.fillRect(tower * width / 8.5, height * 0.4 - hash(tower) * height * 0.18, width / 8.5, height * 0.4);
      for (let row = 0; row < 5; row += 1) {
        context.fillStyle = hash(tower + row * 9) > 0.5 ? 'rgba(255,214,140,0.7)' : 'rgba(50,60,85,0.7)';
        context.fillRect(tower * width / 8.5 + 8, height * 0.28 + row * 20 + hash(tower) * 8, width / 8.5 - 16, 8);
      }
    }
    context.fillStyle = '#4a5166';
    context.fillRect(0, height * 0.48, width, height * 0.52);
    k.ground(-9, -4, 9, 8, '#4f566a');
    k.ground(-9, -4, 9, -2.6, '#7d8396');
    k.ground(-9, 5.6, 9, 8, '#7d8396');
    for (let dash = 0; dash < 8; dash += 1) k.ground(-8 + dash * 2.2, 1.4, -7 + dash * 2.2, 1.55, '#e6dca0');
    for (const x of [-6, 0, 6]) {
      k.box(x, -2.9, 0, 0.1, 0.1, 3.3, '#2a2d33');
      const lamp = k.iso(x, -2.9, 3.4);
      glow(context, lamp.x, lamp.y, k.unit * 2.2, 'rgba(255,214,140,0.55)');
    }
    const away = Math.min(1, time / 5);
    k.person(-1.4 + away * 5.5, 2.8, partnerOf(data, tools), { pose: 'walking', expression: 'sad', time, size: 0.21, facing: 1, outfit: { top: '#a84a6a', bottom: '#2a2a2e', shirt: '#f4efe4' } });
    k.person(-1.8, 2.8, data.look, { pose: 'standing', expression: 'sad', time, size: 0.21 });
    umbrella(context, k, -2.3, 2.2, 0, '#2a3550', '#ffffff');
    rain(context, width, height, time, { count: 150, speed: 560, slant: 0.06 });
    context.fillStyle = 'rgba(20,24,50,0.18)';
    context.fillRect(0, 0, width, height);
  }, { zoom: 0.55, originY: 0.62 });

  // ── The divorce: the courthouse steps in the rain ───────────────────
  const divorce = interim(6, (data) => [`${data.firstName} signs where the lawyer points.`, 'Half of everything, and the quiet that comes with it.'], (context, width, height, time, data, k) => {
    sky(context, width, height, '#5a6578', '#a9b3c0');
    // The courthouse: broad steps, columns, a pediment.
    context.fillStyle = '#767e88';
    context.fillRect(0, height * 0.3, width, height * 0.7);
    k.ground(-9, -6, 9, 9, '#8d949b');
    for (let step = 0; step < 5; step += 1) k.box(-4, -1.2 - step * 0.45 + 3.2, step * 0.14, 8, 0.45, 0.14, '#cfd2d6');
    k.box(-4.2, -4.8, 0.7, 8.4, 2.8, 0.2, '#d9dce0');
    for (let column = 0; column < 7; column += 1) k.box(-3.8 + column * 1.2, -4.3, 0.9, 0.38, 0.38, 3.0, '#e9ebee');
    k.box(-4.2, -4.8, 3.9, 8.4, 2.8, 0.3, '#d3d6da');
    k.roof(-4.4, -5.0, 4.2, 8.8, 3.2, 1.2, '#c9ccd1');
    k.box(-1.0, -2.1, 0.9, 2.0, 0.1, 2.6, '#4a3a2e');
    const scales = k.iso(0, -4.6, 5.8);
    context.strokeStyle = '#8a7a5a';
    context.lineWidth = 2.5;
    context.beginPath();
    context.moveTo(scales.x - 18, scales.y);
    context.lineTo(scales.x + 18, scales.y);
    context.moveTo(scales.x, scales.y);
    context.lineTo(scales.x, scales.y + 22);
    context.stroke();
    // Two people leave in opposite directions, one with a box.
    const parted = Math.min(1, time / 5);
    k.person(0.4 - parted * 4.6, 5.4, data.look, { pose: 'carrying', expression: 'sad', time, size: 0.21, facing: -1 });
    k.person(0.6 + parted * 4.6, 5.8, partnerOf(data, tools), { pose: 'walking', expression: 'sad', time, size: 0.21, facing: 1, outfit: { top: '#a84a6a', bottom: '#2a2a2e', shirt: '#f4efe4' } });
    umbrella(context, k, 0.2 + parted * 4.6, 5.3, 0, '#2a3550', '#ffffff');
    // Two rings, left on the top step.
    for (const dx of [0, 0.22]) {
      const ring = k.iso(-0.1 + dx, 3.4, 0.74);
      context.strokeStyle = '#f2c14a';
      context.lineWidth = 2.5;
      context.beginPath();
      context.ellipse(ring.x, ring.y, 5, 3, 0, 0, TAU);
      context.stroke();
    }
    for (const x of [-3.4, 3.4]) {
      k.box(x, 3.6, 0, 0.1, 0.1, 3.2, '#2a2d33');
      const lamp = k.iso(x, 3.6, 3.3);
      glow(context, lamp.x, lamp.y, k.unit * 2, 'rgba(255,230,170,0.35)');
    }
    // A for-sale sign in the foreground: the house will be divided too.
    k.box(6.2, 6.6, 0, 0.08, 0.08, 1.2, '#6a5038');
    const sign = k.iso(6.24, 6.6, 1.25);
    context.fillStyle = '#ffffff';
    context.fillRect(sign.x - k.unit * 0.55, sign.y - k.unit * 0.35, k.unit * 1.1, k.unit * 0.5);
    context.fillStyle = '#c8102e';
    context.font = `700 ${Math.max(9, k.unit * 0.26)}px Barlow Condensed, sans-serif`;
    context.textAlign = 'center';
    context.fillText('FOR SALE', sign.x, sign.y - k.unit * 0.02);
    rain(context, width, height, time, { count: 200, speed: 700, slant: 0.12 });
    context.fillStyle = 'rgba(40,50,70,0.2)';
    context.fillRect(0, 0, width, height);
  }, { zoom: 0.48, originY: 0.58 });

  return { married, holiday, healthScare, dating, newborn, breakup, divorce };
}
