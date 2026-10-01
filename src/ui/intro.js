// The onboarding cinematic: graduation day, caps in the air, then the
// first morning at the new job. A few lines of text over a drawn scene.

import { titleOf } from '../sim/game.js';
import { lightAt } from './office.js';

export function createIntro(canvas, lineElement) {
  const context = canvas.getContext('2d');
  let lines = [];
  let index = 0;
  let done = null;
  let started = 0;
  let typing = null;
  let animation = 0;
  let caps = [];

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.round(rect.width * ratio);
    canvas.height = Math.round(rect.height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  function play(game, onDone) {
    const character = game.character;
    const year = new Date().getFullYear();
    lines = [
      `Class of ${year}. ${character.name} crosses the stage with a diploma, ${formatSavings(game.savings)} in the bank, and a plan.`,
      `${character.mbti}. IQ ${character.iq}. Political sense ${character.pol}. ${character.archetype}: ${character.blurb}`,
      `Monday, 8:00 AM. ${game.org.companyName}, ${game.org.divisionNames[game.org.divisionIndex]} division. The badge says ${titleOf(game, 0)}.`,
      `There are eight rungs on this ladder, and everyone in the building wants the next one. Pace yourself: it is forty years to the top.`,
    ];
    index = 0;
    done = onDone;
    started = performance.now();
    caps = Array.from({ length: 26 }, (_, capIndex) => ({
      x: 0.1 + Math.random() * 0.8,
      delay: Math.random() * 0.8 + capIndex * 0.02,
      speed: 0.8 + Math.random() * 0.5,
      spin: (Math.random() - 0.5) * 8,
    }));
    resize();
    showLine();
    cancelAnimationFrame(animation);
    animation = requestAnimationFrame(draw);
  }

  function formatSavings(amount) {
    return `$${Math.round(amount / 1000)}k`;
  }

  function showLine() {
    clearInterval(typing);
    const text = lines[index];
    let shown = 0;
    lineElement.textContent = '';
    typing = setInterval(() => {
      shown += 2;
      lineElement.textContent = text.slice(0, shown);
      if (shown >= text.length) clearInterval(typing);
    }, 18);
  }

  function next() {
    if (lineElement.textContent.length < lines[index].length) {
      clearInterval(typing);
      lineElement.textContent = lines[index];
      return;
    }
    index += 1;
    if (index >= lines.length) {
      skip();
      return;
    }
    showLine();
  }

  function skip() {
    clearInterval(typing);
    cancelAnimationFrame(animation);
    const finish = done;
    done = null;
    if (finish) finish();
  }

  function draw(now) {
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const seconds = (now - started) / 1000;
    const atWork = index >= 2;
    const light = lightAt(atWork ? 8 : 11);
    const sky = context.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, light.sky[0]);
    sky.addColorStop(1, light.sky[1]);
    context.fillStyle = sky;
    context.fillRect(0, 0, width, height);
    if (atWork) drawTowers(width, height, seconds);
    else drawGraduation(width, height, seconds);
    animation = requestAnimationFrame(draw);
  }

  function drawGraduation(width, height, seconds) {
    context.fillStyle = '#5c8f4a';
    context.fillRect(0, height * 0.62, width, height * 0.38);
    context.fillStyle = '#8b5a3c';
    context.fillRect(width * 0.2, height * 0.5, width * 0.6, height * 0.08);
    context.fillStyle = '#6a4330';
    context.fillRect(width * 0.2, height * 0.58, width * 0.6, height * 0.04);
    const rows = 4;
    for (let row = 0; row < rows; row += 1) {
      const count = 14 + row * 2;
      for (let seat = 0; seat < count; seat += 1) {
        const x = (seat + 0.5) / count * width;
        const y = height * (0.68 + row * 0.07);
        const size = 10 + row * 3;
        context.fillStyle = '#1d2433';
        context.beginPath();
        context.arc(x, y, size, Math.PI, 0);
        context.fill();
        context.fillStyle = ['#e0b48f', '#c99a76', '#8d5a3b', '#f1c6a6'][(seat + row) % 4];
        context.beginPath();
        context.arc(x, y - size * 1.2, size * 0.55, 0, Math.PI * 2);
        context.fill();
      }
    }
    for (const cap of caps) {
      const t = seconds * cap.speed - cap.delay;
      if (t < 0) continue;
      const rise = t * 1.2 - t * t * 0.45;
      const x = cap.x * width + Math.sin(t * 2 + cap.x * 10) * 20;
      const y = height * 0.66 - rise * height * 0.5;
      if (y > height) continue;
      context.save();
      context.translate(x, y);
      context.rotate(t * cap.spin);
      context.fillStyle = '#111827';
      context.fillRect(-14, -3, 28, 6);
      context.fillStyle = '#f4c542';
      context.fillRect(10, 2, 2, 10);
      context.restore();
    }
  }

  function drawTowers(width, height, seconds) {
    const towers = [0.08, 0.22, 0.38, 0.55, 0.7, 0.86];
    towers.forEach((at, towerIndex) => {
      const towerHeight = height * (0.35 + ((towerIndex * 37) % 30) / 100);
      const towerWidth = width * 0.12;
      const x = at * width - towerWidth / 2;
      const y = height - towerHeight;
      context.fillStyle = towerIndex === 3 ? '#2f4a6e' : '#4a6488';
      context.fillRect(x, y, towerWidth, towerHeight);
      context.fillStyle = 'rgba(200, 225, 255, 0.55)';
      for (let row = 0; row < towerHeight / 18 - 1; row += 1) {
        for (let column = 0; column < 4; column += 1) {
          context.fillRect(x + 6 + column * (towerWidth - 12) / 4, y + 8 + row * 18, (towerWidth - 12) / 4 - 4, 10);
        }
      }
    });
    const walker = (seconds * 40) % (width + 60) - 30;
    context.fillStyle = '#1d2433';
    context.fillRect(walker, height - 46, 10, 30);
    context.beginPath();
    context.arc(walker + 5, height - 52, 7, 0, Math.PI * 2);
    context.fill();
  }

  return { play, next, skip, resize };
}
