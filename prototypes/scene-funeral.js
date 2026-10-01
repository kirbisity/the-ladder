// Prototype: the funeral scene with a detail pass. Same camera and cast as the
// shipped scene, plus a chapel, an iron fence, varied headstones, an open
// grave, wreaths, a hearse, umbrellas, crows, fog and rain splashes.

import { kit, sky, rain, tree, mourners } from '../src/ui/cutscenes.js';
import { drawHead, drawPerson } from '../src/ui/figures.js';
import { mixColor } from '../src/ui/office.js';

export function funeralDetailed(context, width, height, time, data) {
  sky(context, width, height, '#4d5660', '#8f99a2');
  // Distant tree line and chapel, in haze.
  for (let i = 0; i < 18; i += 1) {
    const x = (i / 17) * width;
    const h = height * (0.1 + ((i * 37) % 7) / 60);
    context.fillStyle = mixColor('#3a4a44', '#8f99a2', 0.55);
    context.beginPath();
    context.ellipse(x, height * 0.3, width / 30, h, 0, 0, Math.PI * 2);
    context.fill();
  }
  const pan = Math.min(1, time / 10) * width * 0.04;
  const k = kit(context, width, height, Math.min(width, height * 1.7) / 17, width / 2 - pan, height * 0.34);
  const u = k.unit;
  k.ground(-16, -16, 18, 18, '#4a6445');
  // Mown stripes and a gravel path with puddles.
  for (let i = -16; i < 18; i += 2) k.ground(i, -16, i + 1, 18, 'rgba(255,255,255,0.025)');
  k.ground(-1, -16, 0.2, 18, '#77736a');
  for (const [px, py] of [[-0.6, -2], [-0.4, 1.2], [-0.5, 3.4]]) {
    const p = k.iso(px, py);
    context.fillStyle = 'rgba(150,170,190,0.55)';
    context.beginPath();
    context.ellipse(p.x, p.y, u * 0.5, u * 0.16, 0, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = 'rgba(255,255,255,0.35)';
    context.beginPath();
    context.ellipse(p.x, p.y, u * (0.12 + (((time * 0.5 + px) % 0.4) + 0.4) % 0.4), u * 0.04, 0, 0, Math.PI * 2);
    context.stroke();
  }
  // The chapel at the back: stone, a slate roof, a door and a stained window.
  k.box(-7.5, -3.5, 0, 4.2, 3, 2.4, '#b8b2a6');
  k.roof(-7.7, -3.7, 2.4, 4.6, 3.4, 1.6, '#4a4f58');
  k.box(-5.6, -0.5, 0, 0.9, 0.08, 1.6, '#4b3a2a');
  const rose = k.iso(-5.6, -0.45, 2.1);
  context.fillStyle = '#8f3a4f';
  context.beginPath();
  context.arc(rose.x, rose.y, u * 0.22, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = '#e9b949';
  context.beginPath();
  context.arc(rose.x, rose.y, u * 0.08, 0, Math.PI * 2);
  context.fill();
  k.box(-4.2, -3.4, 2.4, 0.5, 0.5, 2.0, '#9a948a');
  // Trees in layers.
  tree(k, context, -4.5, -3.5, { height: 4, bare: true, trunk: '#3b3330' });
  tree(k, context, 6.5, -2, { height: 4.4, crown: '#35603d' });
  tree(k, context, -8, 2, { height: 5, bare: true, trunk: '#33302c' });
  // Iron fence along the left edge.
  for (let y = -3; y <= 9; y += 0.7) {
    k.box(-8.5, y, 0, 0.06, 0.06, 1.3, '#23262b');
    const tip = k.iso(-8.5, y, 1.3);
    context.fillStyle = '#23262b';
    context.beginPath();
    context.moveTo(tip.x, tip.y - u * 0.18);
    context.lineTo(tip.x - 2, tip.y);
    context.lineTo(tip.x + 2, tip.y);
    context.fill();
  }
  k.box(-8.5, -3, 1.0, 0.04, 12, 0.06, '#23262b');
  // Headstones: arches, crosses, obelisks, an angel, some leaning, with moss.
  const kinds = ['arch', 'cross', 'slab', 'obelisk', 'arch', 'slab', 'cross', 'angel'];
  let n = 0;
  for (let row = -4; row <= 5; row += 3) {
    for (let column = -6; column <= 7; column += 2.4) {
      if (Math.abs(column - 2.2) < 1.6 && Math.abs(row - 2) < 2.1) continue;
      const kind = kinds[(n += 1) % kinds.length];
      const lean = ((n * 7) % 5 - 2) * 0.02;
      const color = mixColor('#8f9396', '#6f7a6a', ((n * 13) % 4) / 8);
      if (kind === 'cross') { k.box(column + 0.28, row, 0, 0.14, 0.14, 1.1, color); k.box(column + 0.1, row, 0.7, 0.5, 0.14, 0.14, color); }
      else if (kind === 'obelisk') { k.box(column + 0.1, row, 0, 0.5, 0.5, 0.25, color); k.box(column + 0.2, row + 0.1, 0.25, 0.3, 0.3, 1.5, color); }
      else if (kind === 'angel') { k.box(column, row, 0, 0.6, 0.4, 0.35, color); k.box(column + 0.2, row + 0.1, 0.35, 0.2, 0.2, 0.7, mixColor(color, '#ffffff', 0.2)); const head = k.iso(column + 0.3, row + 0.2, 1.15); context.fillStyle = mixColor(color, '#ffffff', 0.25); context.beginPath(); context.arc(head.x, head.y, u * 0.1, 0, Math.PI * 2); context.fill(); for (const s of [-1, 1]) { context.beginPath(); context.ellipse(head.x + s * u * 0.2, head.y + u * 0.2, u * 0.16, u * 0.08, s * 0.7, 0, Math.PI * 2); context.fill(); } }
      else { k.box(column + lean * 4, row, 0, 0.7, 0.18, 0.9 + (n % 3) * 0.2, color); if (kind === 'arch') { const top = k.iso(column + 0.35 + lean * 4, row, 1.0 + (n % 3) * 0.2); context.fillStyle = mixColor(color, '#ffffff', 0.08); context.beginPath(); context.arc(top.x, top.y, u * 0.35, Math.PI, 0); context.fill(); } }
      const moss = k.iso(column + 0.2, row + 0.2, 0.05);
      context.fillStyle = 'rgba(70,110,60,0.45)';
      context.beginPath();
      context.ellipse(moss.x, moss.y, u * 0.3, u * 0.1, 0, 0, Math.PI * 2);
      context.fill();
    }
  }
  // Fallen leaves and grass tufts.
  for (let i = 0; i < 70; i += 1) {
    const p = k.iso(-8 + (i * 2.7) % 17, -5 + (i * 1.9) % 12);
    context.fillStyle = i % 3 ? '#8a6a3a' : '#a85a2a';
    context.fillRect(p.x, p.y, 3, 2);
  }
  // The open grave: dug earth, coffin on straps, spade, a heap of soil.
  k.box(1.6, 2.1, 0, 1.5, 2.3, 0.04, '#2b2118');
  k.box(1.75, 2.3, 0, 1.2, 1.9, 0.02, '#14100c');
  k.box(1.9, 2.5, 0.0, 0.9, 1.5, 0.35, '#6b4a2e');
  k.box(1.95, 2.55, 0.35, 0.8, 1.4, 0.04, '#7a5636');
  k.box(3.2, 2.2, 0, 0.9, 1.1, 0.5, '#4e3a28');
  k.box(3.6, 3.5, 0, 0.06, 0.06, 0.9, '#6b5a40');
  k.box(1.6, 1.7, 0, 1.4, 0.3, 1.5, '#a7aaad');
  const stone = k.iso(2.3, 1.85, 1.15);
  context.fillStyle = '#3b3e42';
  context.font = `600 ${Math.max(9, u * 0.22)}px Barlow Condensed, sans-serif`;
  context.textAlign = 'center';
  context.fillText(data.name.toUpperCase(), stone.x - u * 0.3, stone.y);
  context.fillText(`${data.born}–${data.died}`, stone.x - u * 0.3, stone.y + u * 0.3);
  // Wreaths on stands, with ribbons.
  for (const [x, y, c] of [[0.3, 2.0, '#d9534f'], [4.2, 2.6, '#f2f2f2'], [0.5, 3.4, '#f2c5d0']]) {
    k.box(x, y, 0, 0.06, 0.06, 1.0, '#6b5a40');
    const p = k.iso(x + 0.03, y + 0.03, 1.15);
    context.strokeStyle = '#3f6f45';
    context.lineWidth = u * 0.14;
    context.beginPath();
    context.arc(p.x, p.y, u * 0.34, 0, Math.PI * 2);
    context.stroke();
    context.fillStyle = c;
    for (let f = 0; f < 8; f += 1) { context.beginPath(); context.arc(p.x + Math.cos(f) * u * 0.34, p.y + Math.sin(f) * u * 0.34, u * 0.07, 0, Math.PI * 2); context.fill(); }
    context.fillStyle = '#1a1a1a';
    context.fillRect(p.x - 2, p.y + u * 0.34, 4, u * 0.3);
  }
  // The portrait on its easel.
  k.box(3.5, 1.1, 0, 0.08, 0.08, 1.3, '#4a3828');
  const frame = k.iso(3.55, 1.15, 1.6);
  context.fillStyle = '#2b2018';
  context.fillRect(frame.x - u * 0.42, frame.y - u * 0.5, u * 0.84, u * 0.95);
  context.fillStyle = '#d9cdb8';
  context.fillRect(frame.x - u * 0.36, frame.y - u * 0.44, u * 0.72, u * 0.83);
  drawHead(context, frame.x, frame.y, u * 0.24, data.look, { time });
  // A hearse at the path's far end.
  k.box(-2.4, -5.2, 0.18, 1.0, 3.2, 0.9, '#15171a');
  k.box(-2.35, -5.1, 1.08, 0.9, 2.2, 0.55, '#9fb4c4');
  k.box(-2.4, -5.2, 0.18, 1.0, 0.8, 0.05, '#c9a24a');
  // Crows on the stones.
  for (const [x, y] of [[-3.2, -1.2], [5.0, 2.2]]) {
    const p = k.iso(x, y, 1.1);
    const hop = Math.max(0, Math.sin(time * 1.3 + x)) * u * 0.12;
    context.fillStyle = '#0c0c0e';
    context.beginPath();
    context.ellipse(p.x, p.y - hop, u * 0.15, u * 0.09, 0, 0, Math.PI * 2);
    context.fill();
    context.fillRect(p.x + u * 0.1, p.y - hop - u * 0.06, u * 0.1, u * 0.03);
  }
  // The priest at the head of the grave and the mourners, some under umbrellas.
  drawPerson(context, k.iso(2.4, 1.2).x, k.iso(2.4, 1.2).y, u * 0.22, { skin: '#e2b893', hair: '#bdbdbd', suit: '#2a2a2f', shirt: '#ffffff', face: 'soft', hairStyle: 'cleanShort', brows: 'soft', eyes: 'innerDouble', nose: 'soft', mouth: 'composed', faceStyle: 'anime' }, { pose: 'standing', outfit: { top: '#1c1c20', bottom: '#1c1c20', shirt: '#ffffff' }, expression: 'blank', time });
  const black = { top: '#1a1b1e', bottom: '#111214', shirt: '#2b2c30' };
  mourners(data.seed).forEach((look, index) => {
    const spots = [[0.3, 4.6], [1.2, 5.2], [2.4, 5.4], [3.6, 5.1], [4.6, 4.4]];
    const [x, y] = spots[index];
    k.person(x, y, look, { pose: 'mourning', expression: 'crying', outfit: black, time: time + index });
    if (index === 0 || index === 4) {
      const top = k.iso(x, y, 3.5);
      context.fillStyle = ['#111', '#1d2a44', '#3a1d1d'][index % 3];
      context.beginPath();
      context.arc(top.x, top.y, u * 0.95, Math.PI, 0);
      context.fill();
      context.strokeStyle = 'rgba(255,255,255,0.12)';
      for (let rib = -2; rib <= 2; rib += 1) { context.beginPath(); context.moveTo(top.x, top.y - u * 0.95); context.lineTo(top.x + rib * u * 0.4, top.y); context.stroke(); }
      context.fillStyle = '#111';
      context.fillRect(top.x - 1, top.y, 2, u * 1.2);
    }
  });
  // Fog in front, rain, splashes, and a dim wash.
  const fog = context.createLinearGradient(0, height * 0.2, 0, height * 0.65);
  fog.addColorStop(0, 'rgba(190,200,210,0.0)');
  fog.addColorStop(0.5, 'rgba(190,200,210,0.16)');
  fog.addColorStop(1, 'rgba(190,200,210,0.0)');
  context.fillStyle = fog;
  context.fillRect(0, height * 0.2, width, height * 0.45);
  rain(context, width, height, time, { count: 170, speed: 700, color: 'rgba(200, 210, 225, 0.38)', slant: 0.1 });
  context.strokeStyle = 'rgba(210,220,235,0.4)';
  for (let i = 0; i < 28; i += 1) {
    const x = (i * 131) % width;
    const y = height * 0.45 + ((i * 71) % (height * 0.45));
    const r = ((time * 3 + i * 0.37) % 1) * 7;
    context.beginPath();
    context.ellipse(x, y, r, r * 0.35, 0, 0, Math.PI * 2);
    context.stroke();
  }
  context.fillStyle = 'rgba(30, 35, 45, 0.14)';
  context.fillRect(0, 0, width, height);
  const vignette = context.createRadialGradient(width / 2, height / 2, height * 0.4, width / 2, height / 2, height * 0.95);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.35)');
  context.fillStyle = vignette;
  context.fillRect(0, 0, width, height);
}
