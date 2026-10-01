// Prototype: one isometric office, six settings. Industry sets the genre
// (tech loft, consulting client site, private-equity wood and brass, a
// university study) and the company tier sets how it is dressed (a startup
// garage, a growth-company campus, an established open plan, a steady-state
// cubicle farm). Props are drawn in code on the same grid as the shipped
// office, so any of these can replace it.

import { drawSeatedWorker } from './figures.js';
import { lightAt, mixColor } from './office.js';

const TILE_W = 64;
const TILE_H = 32;
const WALL_H = 120;
const ROOM = { width: 10, depth: 8 };
const shade = (c, a) => (a >= 0 ? mixColor(c, '#ffffff', a) : mixColor(c, '#000000', -a));

export const THEMES = {
  startup: { name: 'Tech · Startup', floor: 'concrete', floorColor: '#a9a9a6', wall: '#b4684f', brick: true, wallRight: '#c47a5c', window: 'strip', desks: 'bench', lights: 'string', props: ['neon', 'whiteboard', 'beanbag', 'pizza', 'bike', 'cables'], screen: '#2b6cb0' },
  growth: { name: 'Tech · High-growth', floor: 'wood', floorColor: '#c9a672', wall: '#eef2f6', window: 'big', desks: 'standing', lights: 'pendants', props: ['snackwall', 'pingpong', 'beanbag', 'whiteboard', 'logo', 'plant'], screen: '#2b6cb0', accent: '#ff6b4a' },
  established: { name: 'Tech · Established', floor: 'carpet', floorColor: '#b9c3d0', wall: '#e9edf2', window: 'big', desks: 'dividers', lights: 'panels', props: ['printer', 'cooler', 'poster', 'plant', 'bin', 'clock'], screen: '#2b6cb0' },
  steady: { name: 'Tech · Steady', floor: 'carpet', floorColor: '#a7a79a', wall: '#dcd8c8', window: 'strip', desks: 'cubicle', lights: 'panels', props: ['filing', 'clock', 'cooler', 'poster', 'bin', 'plant'], screen: '#4a7a5a' },
  consulting: { name: 'Consulting · Client site', floor: 'carpet', floorColor: '#8e99a8', wall: '#e8edf3', window: 'big', desks: 'hot', lights: 'panels', props: ['boardroom', 'flipchart', 'bag', 'screenwall', 'cooler', 'plant'], screen: '#2f855a' },
  equity: { name: 'Private equity', floor: 'parquet', floorColor: '#7a4f2f', wall: '#5b3d2b', paneled: true, window: 'skyline', desks: 'wood', lights: 'lamps', props: ['tombstones', 'rug', 'globe', 'bar', 'portrait', 'lamp'], screen: '#276749' },
  academiaNew: { name: 'Academia · Research building', floor: 'carpet', floorColor: '#b9c3d0', wall: '#eef2f6', window: 'big', desks: 'standing', lights: 'pendants', props: ['bookwall', 'whiteboard', 'plant', 'papers', 'mug', 'cooler'], screen: '#6b46c1' },
  academia: { name: 'Academia · Study', floor: 'wood', floorColor: '#b88a56', wall: '#d9cdb5', window: 'trees', desks: 'wood', lights: 'lamps', props: ['bookwall', 'chalkboard', 'papers', 'mug', 'lamp', 'globe'], screen: '#6b46c1' },
};

/**
 * Which setting an industry and company tier work in. Academia keeps its
 * study (a glass research building at the high-growth end); consulting and
 * private equity keep their genre across tiers, the steady tier dressed down.
 */
export function officeThemeFor(industryId, companyTier) {
  if (industryId === 'tech') return { startup: 'startup', aggressive: 'growth', mid: 'established', stable: 'steady' }[companyTier] ?? 'established';
  if (industryId === 'consulting') return companyTier === 'stable' ? 'steady' : 'consulting';
  if (industryId === 'privateEquity') return 'equity';
  if (industryId === 'academia') return companyTier === 'aggressive' ? 'academiaNew' : 'academia';
  return 'established';
}

/**
 * Draw the themed room onto a 2D context of the given size. `scene` is the
 * game's office scene: hour and time, the player and peers (look, typing
 * rate, posture), productivity, and `tier` (the room's seniority: open,
 * window, office or suite), which sets the desks and the furniture.
 */
export function drawOfficeTheme(ctx, w, h, themeId, scene) {
  const theme = THEMES[themeId] ?? THEMES.established;
  const { hour = 11, time = 0 } = scene;
  const rank = scene.tier ?? 'open';
  const sceneW = (ROOM.width + ROOM.depth) * TILE_W / 2;
  const sceneH = (ROOM.width + ROOM.depth) * TILE_H / 2 + WALL_H;
  const scale = Math.min(w / (sceneW * 1.04), h / (sceneH * 1.02));
  const originX = w / 2 + (ROOM.depth - ROOM.width) * TILE_W / 4 * scale;
  const originY = (h - sceneH * scale) / 2 + WALL_H * scale;
  const light = lightAt(hour);
  const iso = (x, y, z = 0) => ({ x: originX + (x - y) * TILE_W / 2 * scale, y: originY + (x + y) * TILE_H / 2 * scale - z * scale });
  const poly = (pts, fill, stroke = null) => {
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = Math.max(0.5, scale * 0.8); ctx.stroke(); }
  };
  const box = (x, y, z, bw, bd, bh, color) => {
    poly([iso(x, y + bd, z), iso(x + bw, y + bd, z), iso(x + bw, y + bd, z + bh), iso(x, y + bd, z + bh)], shade(color, -0.12));
    poly([iso(x + bw, y, z), iso(x + bw, y + bd, z), iso(x + bw, y + bd, z + bh), iso(x + bw, y, z + bh)], shade(color, -0.25));
    poly([iso(x, y, z + bh), iso(x + bw, y, z + bh), iso(x + bw, y + bd, z + bh), iso(x, y + bd, z + bh)], shade(color, 0.08));
  };
  const seg = (a, b, color, width = 1) => { ctx.strokeStyle = color; ctx.lineWidth = Math.max(0.6, width * scale); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); };
  const dot = (p, r, color) => { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(0.5, r * scale), 0, Math.PI * 2); ctx.fill(); };
  // A flat panel on the left wall (x = 0): y along the wall, z up.
  const wallL = (y0, y1, z0, z1, fill, stroke = null) => poly([iso(0, y0, z0), iso(0, y1, z0), iso(0, y1, z1), iso(0, y0, z1)], fill, stroke);
  // A flat panel on the right wall (y = 0).
  const wallR = (x0, x1, z0, z1, fill, stroke = null) => poly([iso(x0, 0, z0), iso(x1, 0, z0), iso(x1, 0, z1), iso(x0, 0, z1)], fill, stroke);

  // Backdrop and floor.
  ctx.fillStyle = shade(light.sky[1], -0.3);
  ctx.fillRect(0, 0, w, h);
  poly([iso(0, 0), iso(ROOM.width, 0), iso(ROOM.width, ROOM.depth), iso(0, ROOM.depth)], theme.floorColor);
  if (theme.floor === 'wood' || theme.floor === 'parquet') {
    for (let i = 1; i < ROOM.width * 2; i += 1) seg(iso(i / 2, 0), iso(i / 2, ROOM.depth), shade(theme.floorColor, -0.1), 0.7);
    if (theme.floor === 'parquet') for (let j = 1; j < ROOM.depth * 2; j += 1) seg(iso(0, j / 2), iso(ROOM.width, j / 2), shade(theme.floorColor, -0.07), 0.6);
  } else if (theme.floor === 'concrete') {
    for (let i = 1; i < ROOM.width; i += 2) seg(iso(i, 0), iso(i, ROOM.depth), shade(theme.floorColor, -0.12), 0.8);
    for (let j = 1; j < ROOM.depth; j += 2) seg(iso(0, j), iso(ROOM.width, j), shade(theme.floorColor, -0.12), 0.8);
  } else {
    for (let i = 1; i < ROOM.width; i += 1) seg(iso(i, 0), iso(i, ROOM.depth), shade(theme.floorColor, -0.06), 0.6);
    for (let j = 1; j < ROOM.depth; j += 1) seg(iso(0, j), iso(ROOM.width, j), shade(theme.floorColor, -0.06), 0.6);
  }

  // Left wall with its windows.
  wallL(0, ROOM.depth, 0, WALL_H, shade(theme.wall, -0.1));
  if (theme.brick) for (let z = 6; z < WALL_H; z += 8) for (let y = (z / 8) % 2 ? 0 : 0.3; y < ROOM.depth; y += 0.6) wallL(y, y + 0.5, z, z + 6, shade(theme.wall, ((y * 7 + z) % 5) / 40 - 0.06));
  if (theme.paneled) for (let y = 0.5; y < ROOM.depth; y += 1.6) wallL(y, y + 1.4, 8, 56, shade(theme.wall, 0.06), shade(theme.wall, -0.3));
  const windows = theme.window === 'big' ? [[0.4, 3.4], [3.8, 7.6]] : theme.window === 'strip' ? [[0.5, 7.5]] : theme.window === 'skyline' ? [[0.6, 7.4]] : theme.window === 'trees' ? [[1, 3.2], [4.6, 6.8]] : [];
  for (const [y0, y1] of windows) {
    const z0 = theme.window === 'strip' ? 60 : theme.window === 'skyline' ? 14 : 24;
    const z1 = theme.window === 'strip' ? 96 : WALL_H - 8;
    ctx.save();
    ctx.beginPath();
    [iso(0, y0, z0), iso(0, y1, z0), iso(0, y1, z1), iso(0, y0, z1)].forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.clip();
    const top = iso(0, y0, z1);
    const bottom = iso(0, y0, z0);
    const grad = ctx.createLinearGradient(0, top.y, 0, bottom.y);
    grad.addColorStop(0, light.sky[0]);
    grad.addColorStop(1, light.sky[1]);
    ctx.fillStyle = grad;
    ctx.fillRect(top.x - 400, top.y - 20, 900, bottom.y - top.y + 40);
    if (theme.window === 'trees') {
      for (let i = 0; i < 5; i += 1) { const p = iso(0, y0 + 0.3 + i * 0.5, z0 + 6 + (i % 2) * 14); dot(p, 14 + (i % 3) * 4, i % 2 ? '#4f8a4e' : '#3e7a45'); dot({ x: p.x + 4 * scale, y: p.y - 6 * scale }, 8, '#6aa660'); }
    } else {
      for (let i = 0; i < 9; i += 1) { const p = iso(0, y0 + 0.2 + i * 0.45, z0); const bh = (28 + (i * 37) % 50) * scale; ctx.fillStyle = mixColor('#7c93ad', '#1b2338', light.night); ctx.fillRect(p.x - 7 * scale, p.y - bh - (theme.window === 'skyline' ? 20 * scale : 0), 14 * scale, bh + 40 * scale); }
    }
    ctx.restore();
    poly([iso(0, y0, z0), iso(0, y1, z0), iso(0, y1, z1), iso(0, y0, z1)], 'rgba(255,255,255,0.05)', shade(theme.wall, -0.45));
    if (theme.window !== 'strip') for (let y = y0 + (y1 - y0) / 3; y < y1 - 0.1; y += (y1 - y0) / 3) seg(iso(0, y, z0), iso(0, y, z1), shade(theme.wall, -0.4), 1.2);
  }

  // Right wall.
  const rightWall = theme.wallRight ?? shade(theme.wall, 0.04);
  wallR(0, ROOM.width, 0, WALL_H, rightWall);
  if (theme.brick) for (let z = 6; z < WALL_H; z += 8) for (let x = (z / 8) % 2 ? 0 : 0.3; x < ROOM.width; x += 0.6) wallR(x, x + 0.5, z, z + 6, shade(rightWall, ((x * 7 + z) % 5) / 40 - 0.06));
  if (theme.paneled) for (let x = 0.4; x < ROOM.width; x += 1.6) wallR(x, x + 1.4, 8, 70, shade(rightWall, 0.05), shade(rightWall, -0.3));
  // Skirting.
  wallR(0, ROOM.width, 0, 5, shade(rightWall, -0.18));
  wallL(0, ROOM.depth, 0, 5, shade(theme.wall, -0.28));

  // ── Props on the right wall and floor, back to front ───────────────
  const P = {
    neon: () => { wallR(3.2, 6.6, 66, 92, '#1a1a22'); const a = iso(3.5, 0, 82); const b = iso(6.3, 0, 82); seg(a, b, '#ff4fa3', 3); seg(iso(3.6, 0, 74), iso(6.0, 0, 74), '#5ad1ff', 2.4); },
    whiteboard: () => { wallR(0.8, 3.6, 46, 92, '#f7f8fa', '#8a93a0'); for (let i = 0; i < 6; i += 1) seg(iso(1.0 + (i % 3) * 0.8, 0, 84 - i * 6), iso(1.6 + (i % 3) * 0.8, 0, 84 - i * 6), i % 2 ? '#e24b4b' : '#2f6bd8', 1.3); dot(iso(2.6, 0, 60), 4, '#2f6bd8'); },
    logo: () => { wallR(3.6, 6.2, 60, 100, theme.accent ?? '#ff6b4a'); wallR(4.2, 5.6, 72, 88, '#ffffff'); },
    snackwall: () => { box(6.4, 0.1, 0, 3.4, 1, 46, '#d7dce3'); wallR(6.4, 9.8, 46, 56, '#2b2f36'); for (let i = 0; i < 7; i += 1) box(6.55 + i * 0.46, 0.2, 56, 0.34, 0.3, 14, ['#e9b949', '#d9534f', '#3f7fd9', '#4aa86a'][i % 4]); box(6.6, 0.15, 46, 0.9, 0.8, 30, '#eef1f5'); dot(iso(7.05, 0.95, 62), 3, '#59d37a'); },
    pingpong: () => { box(6.2, 5.2, 14, 2.6, 1.4, 2, '#2d7a58'); for (const [x, y] of [[6.3, 5.3], [7.6, 5.3], [6.3, 6.4], [7.6, 6.4]]) box(x, y, 0, 0.15, 0.15, 14, '#444'); seg(iso(7.5, 5.2, 16), iso(7.5, 6.6, 16), '#ffffff', 1.4); },
    beanbag: () => { dot(iso(5.5, 6.4, 7), 17, '#ff8a5c'); dot(iso(5.4, 6.2, 12), 12, shade('#ff8a5c', 0.12)); dot(iso(7.2, 6.8, 7), 15, '#4aa3d9'); },
    pizza: () => { box(3.2, 5.6, 0, 0.7, 0.7, 3, '#d9a65a'); box(3.35, 5.7, 3, 0.7, 0.7, 3, '#d9a65a'); dot(iso(3.9, 6.0, 10), 3, '#c0392b'); },
    bike: () => { const c = iso(8.9, 0, 40); for (const dx of [-14, 14]) { ctx.strokeStyle = '#222'; ctx.lineWidth = 2 * scale; ctx.beginPath(); ctx.arc(c.x + dx * scale, c.y, 13 * scale, 0, 7); ctx.stroke(); } seg({ x: c.x - 14 * scale, y: c.y }, { x: c.x, y: c.y - 14 * scale }, '#d9534f', 2); seg({ x: c.x, y: c.y - 14 * scale }, { x: c.x + 14 * scale, y: c.y }, '#d9534f', 2); },
    cables: () => { ctx.strokeStyle = '#222'; ctx.lineWidth = 1.4 * scale; ctx.beginPath(); const a = iso(2.2, 3.4); const b = iso(3.1, 2.4); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(a.x + 18 * scale, a.y + 8 * scale, b.x, b.y); ctx.stroke(); },
    printer: () => { box(8.6, 0.3, 0, 1.1, 0.8, 24, '#dfe3e8'); box(8.7, 0.35, 24, 0.9, 0.6, 10, '#bfc6ce'); },
    cooler: () => { box(9.3, 1.2, 0, 0.5, 0.5, 26, '#e8ecf0'); dot(iso(9.55, 1.45, 36), 8, '#8fd0ff'); },
    poster: () => { wallR(1.2, 2.4, 46, 86, '#2f5fae'); wallR(1.35, 2.25, 52, 80, '#e9b949'); wallR(4, 5.2, 50, 82, '#e9ecef', '#8a93a0'); seg(iso(4.2, 0, 70), iso(5.0, 0, 70), '#2f6bd8', 1.4); },
    plant: () => { box(9, 0.4, 0, 0.5, 0.5, 14, '#d9dde2'); const b = iso(9.25, 0.65, 14); for (let l = 0; l < 7; l += 1) { const a = -Math.PI / 2 + (l - 3) * 0.4; ctx.fillStyle = '#3f8f4f'; ctx.beginPath(); ctx.ellipse(b.x + Math.cos(a) * 14 * scale, b.y + Math.sin(a) * 14 * scale, 3.5 * scale, 14 * scale, a + Math.PI / 2, 0, 7); ctx.fill(); } },
    bin: () => { box(6.1, 0.3, 0, 0.35, 0.35, 12, '#595f69'); },
    clock: () => { const c = iso(5, 0, 88); dot(c, 8, '#fff'); ctx.strokeStyle = '#222'; ctx.lineWidth = scale; ctx.beginPath(); ctx.arc(c.x, c.y, 8 * scale, 0, 7); ctx.stroke(); seg(c, { x: c.x + 4 * scale, y: c.y - 3 * scale }, '#222', 1); seg(c, { x: c.x - 1 * scale, y: c.y - 6 * scale }, '#222', 1); },
    filing: () => { for (let i = 0; i < 3; i += 1) { box(7 + i * 0.75, 0.2, 0, 0.7, 0.7, 44, '#8f9aa3'); for (let d = 0; d < 3; d += 1) wallR(7.1 + i * 0.75, 7.6 + i * 0.75, 4 + d * 14, 12 + d * 14, '#a9b3bb', '#6d767e'); } },
    boardroom: () => { box(5.6, 5.4, 0, 3.4, 1.6, 4, '#c8d4de'); box(5.6, 5.4, 26, 3.4, 1.6, 3, '#e7eef4'); for (const [x, y] of [[5.9, 5.9], [6.9, 5.9], [7.9, 5.9]]) box(x, y, 0, 0.2, 0.2, 28, '#9aa7b3'); for (let i = 0; i < 3; i += 1) box(5.9 + i, 5.7, 29, 0.5, 0.35, 2, '#2b2f36'); },
    flipchart: () => { box(8.3, 3.1, 0, 0.08, 0.7, 62, '#444'); wallR(8.0, 9.0, 0, 0, '#fff'); const p = iso(8.3, 3.1, 56); poly([iso(8.1, 2.9, 40), iso(8.1, 3.9, 40), iso(8.1, 3.9, 70), iso(8.1, 2.9, 70)], '#f7f8fa', '#8a93a0'); seg(iso(8.1, 3.05, 62), iso(8.1, 3.7, 62), '#2f6bd8', 1.3); seg(iso(8.1, 3.05, 54), iso(8.1, 3.5, 54), '#d9534f', 1.3); void p; },
    bag: () => { box(1.4, 6.2, 0, 0.7, 0.4, 20, '#262a30'); seg(iso(1.55, 6.2, 20), iso(1.55, 6.4, 28), '#262a30', 1.5); },
    screenwall: () => { wallR(3.2, 7, 46, 92, '#14181f', '#3a4150'); wallR(3.4, 5.6, 52, 86, '#1f3b66'); for (let i = 0; i < 4; i += 1) seg(iso(3.6, 0, 80 - i * 6), iso(5.2, 0, 80 - i * 6), '#9fc4e0', 1.2); },
    tombstones: () => { box(2.0, 0.2, 40, 6.5, 1.0, 3, '#2a1d14'); for (let i = 0; i < 6; i += 1) { box(2.3 + i * 1.05, 0.35, 43, 0.5, 0.35, 16 + (i % 2) * 4, 'rgba(200,220,255,0.9)'.length ? '#cfe2f4' : '#fff'); } for (let i = 0; i < 6; i += 1) wallR(2.4 + i * 1.05, 2.7 + i * 1.05, 70, 71, '#c9a24a'); },
    rug: () => { poly([iso(2.4, 2.8), iso(8.2, 2.8), iso(8.2, 7.2), iso(2.4, 7.2)], '#6b2a2a'); poly([iso(2.7, 3.1), iso(7.9, 3.1), iso(7.9, 6.9), iso(2.7, 6.9)], '#8a3a36'); poly([iso(3.1, 3.5), iso(7.5, 3.5), iso(7.5, 6.5), iso(3.1, 6.5)], '#6b2a2a'); },
    globe: () => { box(8.8, 6.4, 0, 0.5, 0.5, 20, '#4a2f1d'); dot(iso(9.05, 6.65, 36), 11, '#3f7fb5'); dot(iso(9.0, 6.6, 38), 5, '#5aa064'); },
    bar: () => { box(8.4, 0.3, 0, 1.4, 0.8, 34, '#3a2216'); for (let i = 0; i < 4; i += 1) box(8.5 + i * 0.3, 0.45, 34, 0.15, 0.15, 12 + (i % 2) * 4, ['#c9a24a', '#5aa064', '#d9a65a', '#8fb8d9'][i]); },
    portrait: () => { wallR(1.4, 2.8, 46, 92, '#c9a24a'); wallR(1.55, 2.65, 52, 86, '#3a3f55'); dot(iso(2.1, 0, 74), 7, '#c9a98a'); },
    lamp: () => { box(9.1, 5.6, 0, 0.35, 0.35, 12, '#2b2b2b'); box(9.0, 5.5, 12, 0.55, 0.55, 22, '#c9a24a'); const g = iso(9.27, 5.77, 24); ctx.fillStyle = 'rgba(255,214,140,0.2)'; ctx.beginPath(); ctx.arc(g.x, g.y, 38 * scale, 0, 7); ctx.fill(); },
    bookwall: () => { box(0.3, 0.1, 0, 9.4, 0.9, 100, shade('#6a4a2e', -0.02)); const colors = ['#8a3a36', '#2f5fae', '#d9a65a', '#3f7a46', '#6b46c1', '#c9a24a', '#556b7a']; for (let row = 0; row < 3; row += 1) for (let i = 0; i < 24; i += 1) wallR(0.45 + i * 0.38, 0.45 + i * 0.38 + 0.3, 8 + row * 30, 34 + row * 30 - ((i * 13) % 4), colors[(i * 3 + row * 2) % colors.length]); },
    chalkboard: () => { wallL(1.3, 5.8, 38, 92, '#243a31', '#7a5a38'); for (let i = 0; i < 5; i += 1) seg(iso(0, 1.8 + (i % 2) * 0.3, 82 - i * 8), iso(0, 3.5 + (i % 3) * 0.6, 82 - i * 8), '#e8efe8', 1.3); wallL(0, 0, 0, 0, '#fff'); },
    papers: () => { box(3.7, 4.0, 32, 0.5, 0.4, 5, '#f4f1e6'); box(3.9, 4.15, 37, 0.5, 0.4, 3, '#efe9d6'); box(4.4, 4.5, 32, 0.4, 0.3, 8, '#f4f1e6'); },
    mug: () => { box(4.9, 4.3, 32, 0.22, 0.22, 7, '#e8e4dc'); dot(iso(5.0, 4.4, 40), 2, '#6b3a1d'); },
  };
  for (const name of theme.props.filter((p) => ['neon', 'whiteboard', 'logo', 'poster', 'clock', 'screenwall', 'portrait', 'chalkboard', 'tombstones', 'bookwall', 'snackwall', 'printer', 'filing', 'bike', 'bar'].includes(p))) P[name]?.();
  // Ceiling lights hint.
  if (theme.lights === 'string') for (let i = 0; i < 12; i += 1) { const p = iso(0.4, 0.5 + i * 0.6, 100 - Math.sin(i / 11 * Math.PI) * -8 - 6); dot(p, 2, `rgba(255,224,140,${0.7 + 0.3 * Math.sin(time * 2 + i)})`); }
  if (theme.lights === 'pendants') for (const y of [2, 5]) { const p = iso(0, y, 112); seg(p, iso(0, y, 94), '#555', 0.8); dot(iso(0, y, 90), 6, '#fff3c4'); }
  for (const name of theme.props.filter((p) => ['rug', 'beanbag', 'pingpong', 'pizza', 'boardroom', 'flipchart', 'bag', 'cooler', 'plant', 'bin', 'lamp', 'globe', 'cables', 'papers', 'mug'].includes(p))) P[name]?.();

  // ── Desks and people ──────────────────────────────────────────────
  const deskTop = { standing: '#f0f2f4', bench: '#c9a672', dividers: '#f4f4f2', cubicle: '#d9d4c2', hot: '#e8edf2', wood: '#7a4f2f' }[theme.desks];
  const drawDesk = (x, y, glow) => {
    const legs = theme.desks === 'wood' ? '#4a2f1d' : '#9aa3ad';
    const height = theme.desks === 'standing' ? 40 : 28;
    box(x, y, 0, 2.4, 1.2, height - 4, legs);
    box(x, y, height - 4, 2.4, 1.2, 4, deskTop);
    if (theme.desks === 'cubicle') { box(x - 0.1, y - 0.1, 0, 0.12, 1.5, 48, '#9b9a8a'); box(x - 0.1, y - 0.1, 0, 2.6, 0.12, 48, '#a8a796'); }
    if (theme.desks === 'dividers') box(x - 0.1, y - 0.1, height, 0.1, 1.4, 14, '#c3cad4');
    box(x + 0.5, y + 0.05, height, 0.12, 0.9, 26, '#1f2329');
    poly([iso(x + 0.44, y + 0.12, height + 3), iso(x + 0.44, y + 0.88, height + 3), iso(x + 0.44, y + 0.88, height + 23), iso(x + 0.44, y + 0.12, height + 23)], mixColor('#0d1117', theme.screen, 0.35 + 0.5 * glow));
    if (theme.desks === 'standing' || theme.desks === 'hot') box(x + 0.5, y + 1.0, height, 0.12, 0.7, 24, '#1f2329');
    box(x + 1.1, y + 0.25, height, 0.35, 0.7, 2, '#d9dde2');
  };
  const drawChair = (x, y, color) => { box(x - 0.05, y + 0.2, 0, 0.2, 0.2, 16, '#3a3f47'); box(x - 0.35, y - 0.15, 16, 0.8, 0.9, 5, color); box(x + 0.35, y - 0.15, 21, 0.18, 0.9, theme.desks === 'wood' ? 40 : 30, shade(color, -0.1)); };
  const person = (x, y, look, t, typing = 1, posture = 'upright') => { const seat = iso(x, y + 0.3, 21); drawSeatedWorker(ctx, seat.x, seat.y, 10 * scale, look, { time: t, typingRate: typing, posture }); };
  const chairColor = theme.desks === 'wood' ? '#3b2a20' : '#4a4f6a';
  // Seniority: the open-plan floor has neighbours, a window desk one, a private office none.
  const spots = rank === 'open' ? (theme.desks === 'cubicle' ? [[6.9, 2.8], [6.9, 5.6]] : [[6.6, 2.6], [6.6, 5.4], [3.6, 1.2]]) : rank === 'window' ? [[6.6, 4.8]] : [];
  if (rank === 'office' || rank === 'suite') {
    if (!theme.props.includes('rug')) P.rug?.();
    const couch = rank === 'suite' ? '#5a3d2b' : '#46607f';
    box(6.4, 6.4, 0, 2.6, 1, 12, couch);
    box(6.4, 6.4, 12, 2.6, 0.3, 14, shade(couch, -0.08));
  }
  const peers = scene.peers ?? [];
  spots.forEach(([x, y], index) => {
    const peer = peers[index];
    if (!peer) return;
    drawDesk(x - 0.9, y - 0.6, 0.5);
    drawChair(x + 0.35, y, chairColor);
    person(x + 0.35, y - 0.1, peer.look, time + index, peer.typingRate, peer.posture);
  });
  drawDesk(2.2, 3.6, scene.productivity ?? 0.6);
  drawChair(3.85, 4.2, theme.desks === 'wood' ? '#3b2a20' : '#3b3f5c');
  person(3.85, 4.1, scene.player.look, time, scene.player.typingRate, scene.player.posture);

  // Light tint and a vignette.
  if (light.tintAlpha > 0) { ctx.fillStyle = light.tint; ctx.globalAlpha = light.tintAlpha; ctx.fillRect(0, 0, w, h); ctx.globalAlpha = 1; }
}

