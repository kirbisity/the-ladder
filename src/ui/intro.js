// The onboarding cinematic: graduation day, caps in the air, then the
// first morning at the new job. A few lines of text over a drawn scene.

import { titleOf } from '../sim/game.js';
import { drawIntroBeat } from './intro-scenes.js';

export function createIntro(canvas, lineElement) {
  const context = canvas.getContext('2d');
  let lines = [];
  let index = 0;
  let done = null;
  let started = 0;
  let typing = null;
  let animation = 0;
  let beatStarted = 0;
  let data = null;

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
    beatStarted = started;
    data = { look: game.player.look, name: game.player.name, year, company: game.org.companyName, seed: game.seed ?? 1 };
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
    beatStarted = performance.now();
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
    drawIntroBeat(context, rect.width, rect.height, index, (now - beatStarted) / 1000, data);
    animation = requestAnimationFrame(draw);
  }

  return { play, next, skip, resize };
}
