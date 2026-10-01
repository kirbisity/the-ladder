// The shareable page: one self-contained HTML file holding the whole career.
// The ending and a couple of the moments as pictures, the story, the stats,
// the charts and a timeline: nothing fetched, so it opens anywhere and
// survives being sent around.

import { careerSummary } from '../sim/story.js';
import { formatMoney, titleOf } from '../sim/game.js';
import { COMPANY_TIERS } from '../config.js';
import { escapeHtml, portrait, historyChart, wealthChart, outcomeText } from './panels.js';
import { snapshotScene, endingSceneFor, sceneData, JOURNAL_SCENES } from './cutscenes.js';

// Moments worth a picture, in the order they are preferred.
const MOMENT_ORDER = ['promoted', 'married', 'divorce', 'newborn', 'child', 'house', 'startupWin', 'newJob', 'burnout', 'lostJob'];

const MILESTONE_TEXT = {
  joined: (entry) => `Joined ${entry.company} as ${entry.title}`,
  promoted: (entry) => `Promoted${entry.title ? ` to ${entry.title}` : ''}`,
  lostJob: (entry) => `Lost the job at ${entry.company ?? 'work'} (${entry.reason})`,
  dating: (entry) => `Started seeing ${entry.partner ?? 'someone'}`,
  married: (entry) => (entry.partner ? `Married ${entry.partner}` : 'Married'),
  breakup: (entry) => `Broke up with ${entry.partner ?? 'a partner'}`,
  child: () => 'A child was born',
  parentalLeave: () => 'Took parental leave',
  house: () => 'Bought a house',
  divorce: (entry) => (entry.reason === 'strain' ? 'Divorced: too many hours, too little home' : 'Divorced'),
  burnout: () => 'Burned out',
  healthScare: () => 'A health scare',
  fmla: () => 'Took FMLA leave',
  startupExit: (entry) => `${entry.company} was acquired`,
  startupFolded: (entry) => `${entry.company} folded`,
  ipo: () => 'The company went public',
  bereaved: () => 'Lost a parent',
  steppedBack: () => 'Stepped back from management',
  fire: () => 'Retired early, financially independent',
};

function momentPictures(game, data) {
  const kinds = new Set((game.journal ?? []).map((entry) => entry.kind));
  const scenes = [];
  for (const kind of MOMENT_ORDER) {
    const scene = JOURNAL_SCENES[kind];
    if (kinds.has(kind) && scene && !scenes.includes(scene) && scenes.length < 2) scenes.push(scene);
  }
  return scenes.map((scene) => snapshotScene(scene, data, 480, 270, 0.6)).filter(Boolean);
}

function timeline(game) {
  const rows = [];
  for (const entry of game.journal ?? []) {
    const text = MILESTONE_TEXT[entry.kind];
    if (!text) continue;
    rows.push(`<li><span class="age">${Math.floor(entry.age)}</span>${escapeHtml(text(entry))}</li>`);
  }
  return rows.slice(0, 40).join('');
}

/** The whole page, as an HTML string. */
export function buildShareDocument(game) {
  const outcome = game.outcome;
  const player = game.player;
  const summary = careerSummary(game);
  const data = sceneData(game);
  const ending = outcomeText(game);
  const endingPicture = snapshotScene(endingSceneFor(outcome), { ...data, netWorth: data.netWorth || 1e6 }, 960, 440, 0.75);
  const moments = momentPictures(game, data);
  const tier = COMPANY_TIERS[game.org?.tier ?? game.lastOrg?.tier];
  const faceMatch = portrait(player.look, 96).match(/src="([^"]*)"/);
  const face = faceMatch ? faceMatch[1] : '';
  const years = Math.max(1, Math.round(outcome.age - 22));
  const stats = [
    ['Ended at', `age ${Math.floor(outcome.age)}`],
    ['Years worked', years],
    ['Highest title', outcome.title],
    ['Net worth', formatMoney(outcome.netWorth)],
    ['Earned', formatMoney(outcome.lifetimeEarnings)],
    ['Score', outcome.score.toLocaleString()],
  ].map(([label, value]) => `<div class="stat"><span>${escapeHtml(label)}</span><strong>${escapeHtml(String(value))}</strong></div>`).join('');
  const title = `${player.name}: ${ending.title}`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)} · The Ladder</title>
<style>
:root { --bg: #0e1320; --card: #171e2f; --line: #2a3450; --ink: #eef1f7; --soft: #b7c0d4; --faint: #7f8aa3; --gold: #f4c542; }
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--ink); font: 15px/1.5 -apple-system, "Segoe UI", system-ui, sans-serif; padding: 24px 16px; }
main { max-width: 860px; margin: 0 auto; display: grid; gap: 18px; }
h1 { margin: 0; font-size: clamp(28px, 6vw, 44px); line-height: 1.05; text-transform: uppercase; letter-spacing: 0.02em; }
h2 { margin: 0 0 8px; font-size: 14px; text-transform: uppercase; letter-spacing: 0.12em; color: var(--faint); }
.hero { display: grid; grid-template-columns: auto 1fr; gap: 16px; align-items: center; }
.hero img.face { width: 96px; height: 96px; border-radius: 16px; background: var(--card); }
.kicker { color: var(--faint); text-transform: uppercase; letter-spacing: 0.14em; font-size: 12px; }
.card { background: var(--card); border: 1px solid var(--line); border-radius: 14px; padding: 14px 16px; }
.scene { width: 100%; border-radius: 12px; display: block; border: 1px solid var(--line); }
.stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 8px; }
.stat { background: rgba(255,255,255,0.05); border-radius: 10px; padding: 8px 12px; min-width: 0; }
.stat span { display: block; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--faint); }
.stat strong { font-size: 18px; overflow-wrap: anywhere; }
.story p { margin: 0 0 10px; color: var(--soft); font-size: 14px; max-width: 70ch; }
.verdict { color: var(--gold); font-weight: 700; }
.moments { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px; }
.cols { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 14px; }
ul.timeline { list-style: none; margin: 0; padding: 0; display: grid; gap: 3px; font-size: 13px; color: var(--soft); }
ul.timeline .age { display: inline-block; width: 34px; color: var(--gold); font-weight: 700; }
svg.chart { width: 100%; height: 150px; display: block; }
.modal-kicker { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--faint); margin-bottom: 4px; }
footer { color: var(--faint); font-size: 12px; text-align: center; }
@media print { body { background: #fff; color: #000; } .card { border-color: #ccc; background: #fff; } }
</style></head>
<body><main>
<header class="hero">${face ? `<img class="face" src="${face}" alt="">` : ''}
  <div><div class="kicker">The Ladder · ${escapeHtml(game.industry.name)}${tier ? ` · ${escapeHtml(tier.name)} employer` : ''}</div>
  <h1>${escapeHtml(player.name)}: ${escapeHtml(ending.title)}</h1>
  <p style="margin:6px 0 0;color:var(--soft)">${escapeHtml(ending.line)}</p></div></header>
${endingPicture ? `<img class="scene" src="${endingPicture}" alt="The ending">` : ''}
<section class="stats">${stats}</section>
<section class="card story"><h2>The story · <span class="verdict">${escapeHtml(summary.verdict)}</span></h2>${summary.paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('')}</section>
${moments.length ? `<section class="moments">${moments.map((picture) => `<img class="scene" src="${picture}" alt="A moment from the career">`).join('')}</section>` : ''}
<section class="cols">
  <div class="card"><h2>The career</h2>${historyChart(game)}</div>
  <div class="card"><h2>The money</h2>${wealthChart(game)}</div>
</section>
<section class="card"><h2>Timeline</h2><ul class="timeline">${timeline(game)}</ul></section>
<footer>Played in The Ladder · ${escapeHtml(titleOf(game, Math.max(game.peakLevel ?? 0, player.level)))} at best · a career simulator where every colleague runs the same equations you do.</footer>
</main></body></html>`;
}

/** Download the shareable page as a file. */
export function downloadShareDocument(game) {
  const html = buildShareDocument(game);
  const blob = new Blob([html], { type: 'text/html' });
  const link = document.createElement('a');
  const slug = game.player.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  link.href = URL.createObjectURL(blob);
  link.download = `the-ladder-${slug}-${Math.floor(game.outcome.age)}.html`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 4000);
  return html;
}
