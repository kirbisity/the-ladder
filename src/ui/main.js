// The page: screens, the day clock, the HUD and controls, and the wiring
// between the player's input and the simulation. The simulation itself is
// in src/sim and knows nothing about the page.

import {
  createGame, startRunning, runDay, closeQuarter, chooseEventOption, setPlan, rebalanceShares,
  titleOf, formatMoney, netWorth, quarterlyExpenses, takeFmla, fmlaStatus, takeHoliday, holidayStatus,
} from '../sim/game.js';
import { serializeGame, deserializeGame } from '../sim/save.js';
import { RATING_LABELS, totalBandwidth, effectiveHours, projectSpec, dailyCoreOutput, onBurnoutLeave } from '../sim/agent.js';
import { agentsAtLevel, employedAgents } from '../sim/org.js';
import { CHARACTERS, INDUSTRIES, TIME, BANDWIDTH, MOTIVATION, ORG } from '../config.js';
import { createOffice, officeTier } from './office.js';
import { peerLook } from './figures.js';
import { createAudio } from './audio.js';
import {
  eventPanel, reviewPanel, orgPanel, performancePanel, careerPanel, projectPanel, helpPanel, menuPanel,
  gameOverPanel, storyPanel, timeOffPanel, settingsPanel, characterCards, industryCards, industryMeter, projectedCompletion, escapeHtml,
} from './panels.js';
import { createIntro } from './intro.js';
import { createCutscenePlayer, END_SCENES, INTERIM_SCENES, JOURNAL_SCENES, endingSceneFor, sceneData } from './cutscenes.js';

const SAVE_KEY = 'the-ladder-save';
const SETTINGS_KEY = 'the-ladder-settings';
// Which journal moment wins when several land at once.
const SCENE_PRIORITY = ['lostJob', 'healthScare', 'burnout', 'promoted', 'newJob', 'house', 'married', 'child', 'startupWin', 'fmla', 'holiday'];
const SPEEDS = [1, 2, 4, 8];
// At 1× a quarter takes six seconds: ten workdays a second.
const DAYS_PER_SECOND = 10;
// A visual workday loop lasts this long at 1×, so the light can run from
// morning to night without strobing.
const VISUAL_DAY_SECONDS = 1.6;

const BUCKETS = [
  { name: 'Project delivery', color: 'var(--core)' },
  { name: 'Mentoring', color: 'var(--citizenship)', focus: 'citizenshipFocus', options: [['help', 'Help peers'], ['mentor', 'Mentor juniors']] },
  { name: 'Networking', color: 'var(--politics)', focus: 'politicsFocus', options: [['upward', 'Upward'], ['peers', 'Peers'], ['crossTeam', 'Cross-team']] },
  { name: 'Recovery', color: 'var(--recovery)' },
];

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const app = {
  screen: 'title',
  game: null,
  pick: { characterId: null, industryId: null },
  paused: false,
  speedIndex: 0,
  auto: false,
  dayAccumulator: 0,
  visualTime: 0,
  modal: null,
  orgTab: 'chart',
  orgNode: null,
  lastHudUpdate: 0,
  lastLabelDay: -1,
  pendingReport: null,
  readinessChimed: false,
  activeTab: 'bandwidth',
};

const audio = createAudio();
let office = null;
let intro = null;
let cutscenes = null;
const settings = loadSettings();

function loadSettings() {
  try {
    return { cutscenes: true, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') };
  } catch (error) {
    return { cutscenes: true };
  }
}

function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (error) {
    console.warn('The Ladder: could not save settings', error);
  }
}

// ── Cut scenes ─────────────────────────────────────────────────────────

/** Play a short scene for the most important journal moment since the last look. */
function playJournalScenes() {
  const game = app.game;
  if (!game) return;
  const journal = game.journal ?? [];
  const fresh = journal.slice(app.journalSeen ?? journal.length);
  app.journalSeen = journal.length;
  if (!settings.cutscenes || game.outcome || fresh.length === 0) return;
  const scenes = new Set(fresh.map((entry) => JOURNAL_SCENES[entry.kind]).filter(Boolean));
  const winner = SCENE_PRIORITY.find((scene) => scenes.has(scene));
  if (winner) cutscenes.play(winner, sceneData(game), () => updateHud(true));
}

// ── Screens ────────────────────────────────────────────────────────────

function showScreen(name) {
  app.screen = name;
  // Burnout greys the game, never the menus or a fresh career.
  if (name !== 'game') {
    $('#app').classList.remove('burnout');
    audio.setState({ burnout: false, running: false });
  }
  for (const screen of $$('.screen')) screen.hidden = screen.dataset.screen !== name;
  if (name === 'title') $('[data-action="continue"]').hidden = !readSave();
  if (name === 'game') {
    requestAnimationFrame(() => {
      office.resize();
      updateHud(true);
    });
  }
}

function readSave() {
  try {
    return localStorage.getItem(SAVE_KEY);
  } catch (error) {
    return null;
  }
}

function writeSave() {
  if (!app.game || app.game.outcome) return;
  try {
    localStorage.setItem(SAVE_KEY, serializeGame(app.game));
  } catch (error) {
    console.warn('The Ladder: could not save', error);
  }
}

function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch (error) {
    console.warn('The Ladder: could not clear the save', error);
  }
}

function sampleSceneData() {
  const character = CHARACTERS[0];
  return { look: character.look, name: character.name, firstName: character.name.split(' ')[0], age: 62, born: 1990, died: 2052, title: 'Director', company: 'Stackwell', seed: 7, netWorth: 1e6 };
}

function startCareer(characterId, industryId) {
  const seed = Math.floor(Math.random() * 1e9);
  app.game = createGame({ seed, characterId, industryId });
  app.paused = false;
  app.dayAccumulator = 0;
  app.readinessChimed = false;
  app.journalSeen = app.game.journal.length;
  buildSliders();
  showScreen('intro');
  intro.play(app.game, () => enterGame());
}

function enterGame() {
  showScreen('game');
  afterQuarterOpened();
}

// ── Modal ──────────────────────────────────────────────────────────────

function openModal(kind, html, wide = false) {
  app.modal = kind;
  const card = $('#modal-card');
  card.className = `modal-card${wide ? ' wide' : ''}`;
  card.innerHTML = html;
  $('#modal').hidden = false;
  const focusTarget = card.querySelector('.choice, .button.primary, .button');
  if (focusTarget) focusTarget.focus({ preventScroll: true });
}

function closeModal() {
  app.modal = null;
  $('#modal').hidden = true;
  $('#modal-card').innerHTML = '';
}

/** After an event or review, show whatever the quarter needs next. */
function afterQuarterOpened() {
  const game = app.game;
  if (game.outcome) {
    showGameOver();
    return;
  }
  if (game.currentEvent) {
    openModal('event', eventPanel(game));
    return;
  }
  closeModal();
  updateHud(true);
  if (app.auto && game.phase === 'plan') beginRunning();
}

function showGameOver() {
  clearSave();
  audio.setState({ running: false });
  openModal('over', gameOverPanel(app.game), true);
  // The ending plays over the summary; skipping or finishing reveals it.
  if (settings.cutscenes) cutscenes.play(endingSceneFor(app.game.outcome), sceneData(app.game), null);
}

// ── The clock ──────────────────────────────────────────────────────────

function beginRunning() {
  const game = app.game;
  if (game.phase === 'plan') {
    if (!startRunning(game)) return;
    app.paused = false;
  } else if (game.phase === 'running') {
    app.paused = !app.paused;
  }
  audio.setState({ running: game.phase === 'running' && !app.paused });
  updateHud(true);
}

function stepOneDay() {
  const game = app.game;
  const { notes, quarterOver } = runDay(game);
  for (const note of notes) handleNote(note);
  if (game.outcome) {
    updateHud(true);
    showGameOver();
    return;
  }
  if (game.day - app.lastLabelDay >= 6) {
    app.lastLabelDay = game.day;
    refreshLiveLabels();
  }
  if (quarterOver) finishQuarter();
}

function handleNote(note) {
  if (note.kind === 'burnout') {
    playJournalScenes();
    app.paused = true;
    audio.setState({ burnout: true, running: false });
    toast(fmlaStatus(app.game).eligible
      ? 'Burnout. The quarter is paused: move Recovery to 35% or more, or take FMLA leave, then resume.'
      : 'Burnout. The quarter is paused: move Recovery to 35% or more, then resume.');
    updateHud(true);
  } else if (note.kind === 'event') {
    openModal('event', eventPanel(app.game));
  } else if (note.kind === 'leaveOver') {
    toast(note.text);
  } else if (note.kind === 'incident') {
    floatChip('Pager: 2 AM incident', 'red', 2.6, 3.6, 70);
  } else if (note.kind === 'paper') {
    floatChip('Paper accepted', 'green', 2.6, 3.6, 70);
  }
}

function finishQuarter() {
  const game = app.game;
  const report = closeQuarter(game);
  playJournalScenes();
  $('#labels').querySelectorAll('.chip.live').forEach((chip) => chip.remove());
  audio.setState({ running: false });
  if (report.stinger === 'layoff') audio.brass();
  if (report.promoted) audio.chime();
  if (game.player.readiness >= 100 && !app.readinessChimed && !report.promoted) {
    app.readinessChimed = true;
    audio.chime();
  }
  if (report.promoted) app.readinessChimed = false;
  writeSave();
  updateHud(true);
  if (game.outcome) {
    showGameOver();
    return;
  }
  if (app.auto && !report.promoted && !report.lostJob && !report.leapfrogged && report.rating !== 'meetSome') {
    toast(`${RATING_LABELS[report.rating] ?? 'Quarter closed'} · rank ${report.rank ?? '—'}/${report.poolSize ?? '—'}`);
    afterQuarterOpened();
    return;
  }
  openModal('review', reviewPanel(game, report));
}

function frame(now) {
  const seconds = Math.min(0.1, (now - (frame.last ?? now)) / 1000);
  frame.last = now;
  if (app.screen === 'game' && app.game) {
    const game = app.game;
    const speed = SPEEDS[app.speedIndex];
    const running = game.phase === 'running' && !app.paused && !app.modal && !cutscenes.isPlaying();
    if (running) {
      app.dayAccumulator += seconds * DAYS_PER_SECOND * speed;
      while (app.dayAccumulator >= 1 && game.phase === 'running' && !app.paused && !app.modal) {
        app.dayAccumulator -= 1;
        stepOneDay();
      }
      app.visualTime += seconds * speed;
      audio.tick(seconds);
    }
    drawOffice(now / 1000);
    if (now - app.lastHudUpdate > 120) updateHud(false);
  }
  requestAnimationFrame(frame);
}

// ── Office drawing and floating labels ─────────────────────────────────

function currentHour() {
  const game = app.game;
  const hours = game.player.plan.hours;
  if (game.phase !== 'running') return game.phase === 'plan' ? 9 : 8 + hours;
  const loop = (app.visualTime / VISUAL_DAY_SECONDS) % 1;
  return Math.min(24, 7.5 + loop * (hours + 1));
}

function drawOffice(seconds) {
  const game = app.game;
  const player = game.player;
  const running = game.phase === 'running' && !app.paused && !app.modal;
  const burned = player.burnout.active;
  const typingRate = running ? (burned ? 0.5 : 1) * (0.6 + player.plan.shares[0]) : 0.05;
  const peers = game.org
    ? employedAgents(game.org).filter((agent) => agent !== player && agent.level === player.level && agent.teamId === player.teamId)
      .concat(employedAgents(game.org).filter((agent) => agent !== player && agent.level === player.level))
    : [];
  const unique = [...new Set(peers)].slice(0, 3).map((agent, index) => ({
    look: peerLook(agent.id),
    typingRate: running ? (agent.burnout.active ? 0.4 : 0.9) : 0.05,
    posture: agent.burnout.active ? 'slumped' : 'upright',
  }));
  office.draw({
    tier: officeTier(player.level, game.employment.employed),
    hour: currentHour(),
    time: running ? app.visualTime * 1.2 : seconds * 0.2,
    player: { look: player.look, typingRate, posture: burned ? 'slumped' : 'upright' },
    peers: unique,
    industryId: game.industry.id,
    productivity: Math.min(1, player.plan.shares[0] * 1.6),
  });
}

function refreshLiveLabels() {
  const game = app.game;
  const labels = $('#labels');
  labels.querySelectorAll('.chip.live').forEach((chip) => chip.remove());
  if (!game.employment.employed || app.screen !== 'game') return;
  const player = game.player;
  const pace = livePace(game);
  const level = pace > 1.08 ? 'High' : pace > 0.92 ? 'Medium' : 'Low';
  const tier = officeTier(player.level, true);
  const deskX = tier === 'open' ? 2.3 : 2.2;
  addChip(`Productivity: ${level}`, level === 'High' ? 'green' : level === 'Low' ? 'red' : '', deskX + 1, 3.4, 150, true);
  const project = projectSpec(player.quarter.projectId, game.industry);
  if (project) {
    const progress = Math.min(1, player.quarter.projectProgress);
    addChip(`<span class="ring" style="--progress:${Math.round(progress * 100)}%"></span>${escapeHtml(project.name)}: ${Math.round(progress * 100)}%`, '', deskX - 0.6, 5.6, 40, true);
  }
  if (player.plan.shares[2] >= 0.15 && game.day > 0 && game.day % 18 < 6) {
    const gain = Math.max(1, Math.round(player.plan.shares[2] * 10));
    floatChip(`Peer networking: +${gain}`, '', 7.6, 1.6, 110);
  }
}

/** Player's pace this quarter against the median of their level. */
function livePace(game) {
  const player = game.player;
  const pace = (agent) => (agent.quarter.core + agent.quarter.political) / Math.max(1, agent.quarter.days);
  const pool = agentsAtLevel(game.org, player.level).filter((agent) => agent !== player).map(pace).sort((a, b) => a - b);
  if (pool.length === 0) return 1;
  const median = pool[Math.floor(pool.length / 2)];
  return median > 0 ? pace(player) / median : 1;
}

function addChip(html, tone, x, y, z, live) {
  const point = office.screenPoint(x, y, z);
  const chip = document.createElement('div');
  chip.className = `chip ${tone} ${live ? 'live' : 'float'}`;
  chip.innerHTML = html;
  $('#labels').append(chip);
  const stage = $('#stage');
  const reserved = $('.side-buttons').offsetWidth + 16;
  const half = chip.offsetWidth / 2;
  const left = Math.max(half + 6, Math.min(stage.clientWidth - reserved - half, point.x));
  const top = Math.max(chip.offsetHeight / 2 + 4, Math.min(stage.clientHeight - chip.offsetHeight / 2 - 4, point.y));
  chip.style.left = `${left}px`;
  chip.style.top = `${top}px`;
  return chip;
}

function floatChip(text, tone, x, y, z) {
  const chip = addChip(escapeHtml(text), tone, x, y, z, false);
  setTimeout(() => chip.remove(), 2300);
}

function toast(text) {
  const element = document.createElement('div');
  element.className = 'toast';
  element.textContent = text;
  $('#toasts').append(element);
  setTimeout(() => element.remove(), 4600);
}

// ── HUD ────────────────────────────────────────────────────────────────

function updateHud(full) {
  const game = app.game;
  if (!game || app.screen !== 'game') return;
  app.lastHudUpdate = performance.now();
  const player = game.player;

  setBar('#vital-health', player.health, 'Health', game.weekDeltas.health, 'this week');
  setBar('#vital-motivation', player.motivation, 'Motivation', game.weekDeltas.motivation, 'this week');
  $('#vital-motivation .battery-level').style.width = `${Math.max(0, Math.min(100, player.motivation)) * 0.92}%`;
  $('#age-value').textContent = `Age: ${Math.floor(player.age)}`;
  $('#wealth-value').textContent = formatMoney(netWorth(game));
  $('#income-value').textContent = game.employment.employed ? `${formatMoney(player.salary)} / yr` : 'No income';

  const quarterOfYear = (game.quarterIndex % 4) + 1;
  const year = Math.floor(game.quarterIndex / 4) + 1;
  $('#clock-quarter').textContent = `Q${quarterOfYear} · Year ${year}`;
  $('#clock-title').textContent = game.employment.employed ? titleOf(game, player.level) : 'Between jobs';
  $('#day-fill').style.width = `${game.day / TIME.daysPerQuarter * 100}%`;
  const runButton = $('#run-button');
  runButton.classList.toggle('pulse', game.phase === 'plan');
  runButton.textContent = game.phase === 'plan' ? `Start Q${quarterOfYear}` : game.phase === 'running' ? (app.paused ? 'Resume' : 'Pause') : 'Reviewing';
  runButton.disabled = game.phase !== 'plan' && game.phase !== 'running';
  $('#speed-button').textContent = `${SPEEDS[app.speedIndex]}×`;

  const burned = player.burnout.active;
  $('#app').classList.toggle('burnout', burned);
  const leave = fmlaStatus(game);
  const onFmla = game.fmla.daysLeft > 0;
  const onHoliday = game.holiday.daysLeft > 0;
  $('#burnout-banner').hidden = !burned || onFmla || onHoliday;
  $('#banner-fmla').hidden = !leave.eligible;
  $('#banner-holiday').hidden = !holidayStatus(game).allowed;
  $('#leave-banner').hidden = !onFmla && !onHoliday;
  if (onFmla) $('#leave-banner').textContent = `On FMLA leave: ${game.fmla.daysLeft} workdays left. Unpaid, job-protected, recovering fast.`;
  else if (onHoliday) $('#leave-banner').textContent = `On holiday: ${game.holiday.daysLeft} workdays left. Out of office.`;
  $('#pip-banner').hidden = !player.pip.active;
  audio.setState({ burnout: burned, hours: player.plan.hours });

  const bandwidth = totalBandwidth(player);
  const ofStandard = bandwidth / effectiveHours(player.plan.hours) * 100;
  $('#bandwidth-figure').textContent = `Daily BW: ${Math.round(ofStandard)}%`;
  $('#bandwidth-figure').title = `${bandwidth.toFixed(1)} focused hours a day`;
  updateSliders();
  updateArc();
  updateOpenness();
  if (full || game.phase === 'running') updateProject();
  $('#industry-meter').innerHTML = industryMeter(game);
  const management = $('#management');
  management.hidden = player.level < ORG.managementFromLevel || !game.employment.employed;
  if (!management.hidden) $('#management-slider').value = Math.round(player.plan.managementStyle * 100);
}

function setBar(selector, value, name, weekDelta, suffix) {
  const element = $(selector);
  const clamped = Math.max(0, Math.min(100, value));
  element.querySelector('.bar-fill').style.width = `${clamped}%`;
  element.querySelector('.bar').classList.toggle('low', clamped < 25);
  element.querySelector('.bar-label').textContent = `${name}: ${Math.round(clamped)}%`;
  const delta = element.querySelector('.vital-delta');
  const rounded = Math.round(weekDelta * 10) / 10;
  if (Math.abs(rounded) < 0.1) {
    delta.textContent = 'steady';
    delta.className = 'vital-delta';
  } else {
    delta.textContent = `${rounded > 0 ? '▲ +' : '▼ '}${rounded.toFixed(1)}% ${suffix}`;
    delta.className = `vital-delta ${rounded > 0 ? 'up' : 'down'}`;
  }
}

// ── Bandwidth sliders ──────────────────────────────────────────────────

function buildSliders() {
  const container = $('#sliders');
  container.innerHTML = BUCKETS.map((bucket, index) => {
    const focus = bucket.focus
      ? `<span class="focus">${bucket.options.map(([value, label]) => `<button data-focus="${bucket.focus}" data-value="${value}">${label}</button>`).join('')}</span>`
      : '';
    return `<div class="slider-row" data-bucket="${index}">
      <span class="slider-name">${bucket.name}${focus}</span>
      <span class="slider-value">0%</span>
      <input type="range" min="0" max="100" step="1" style="--color:${bucket.color}" aria-label="${bucket.name}">
    </div>`;
  }).join('');
  container.querySelectorAll('input').forEach((input, index) => {
    input.addEventListener('input', () => {
      const shares = rebalanceShares(app.game.player.plan.shares, index, Number(input.value) / 100);
      setPlan(app.game, { shares });
      updateHud(false);
    });
  });
  container.querySelectorAll('[data-focus]').forEach((button) => {
    button.addEventListener('click', () => {
      setPlan(app.game, { [button.dataset.focus]: button.dataset.value });
      updateHud(false);
    });
  });
}

function updateSliders() {
  const plan = app.game.player.plan;
  $$('#sliders .slider-row').forEach((row, index) => {
    const share = plan.shares[index];
    const input = row.querySelector('input');
    if (document.activeElement !== input) input.value = Math.round(share * 100);
    input.style.setProperty('--fill', `${share * 100}%`);
    row.querySelector('.slider-value').textContent = `${Math.round(share * 100)}%`;
    row.querySelectorAll('[data-focus]').forEach((button) => button.classList.toggle('active', plan[button.dataset.focus] === button.dataset.value));
  });
}

// ── Work-life arc ──────────────────────────────────────────────────────

const ARC = { cx: 150, cy: 110, rx: 120, ry: 95 };

function hoursLabel(hours) {
  if (hours < 7.5) return 'Coasting';
  if (hours <= 8.5) return 'Balanced';
  if (hours <= 10) return 'Committed';
  if (hours <= 12) return 'Long hours';
  return 'Crunch';
}

function updateArc() {
  const hours = app.game.player.plan.hours;
  // Long hours on the left (red), short on the right (green), as in the mock-up.
  const share = (BANDWIDTH.maxHours - hours) / (BANDWIDTH.maxHours - BANDWIDTH.minHours);
  const angle = Math.PI * (1 - share);
  $('#arc-knob').setAttribute('cx', (ARC.cx + ARC.rx * Math.cos(angle)).toFixed(1));
  $('#arc-knob').setAttribute('cy', (ARC.cy - ARC.ry * Math.sin(angle)).toFixed(1));
  $('#arc-label').textContent = hoursLabel(hours).toUpperCase();
  $('#arc').setAttribute('aria-valuenow', hours);
  $('#hours-figure').textContent = `Daily hrs: ${hours % 1 ? hours.toFixed(1) : hours}`;
}

function setHoursFromPointer(event) {
  const svg = $('#arc');
  const rect = svg.getBoundingClientRect();
  const x = (event.clientX - rect.left) / rect.width * 300;
  const y = (event.clientY - rect.top) / rect.height * 120;
  const angle = Math.atan2((ARC.cy - y) / ARC.ry, (x - ARC.cx) / ARC.rx);
  const clamped = Math.max(0, Math.min(Math.PI, angle < -Math.PI / 2 ? Math.PI : angle));
  const share = 1 - clamped / Math.PI;
  const hours = Math.round((BANDWIDTH.maxHours - share * (BANDWIDTH.maxHours - BANDWIDTH.minHours)) * 2) / 2;
  setPlan(app.game, { hours });
  updateHud(false);
}

function bindArc() {
  const svg = $('#arc');
  let dragging = false;
  svg.addEventListener('pointerdown', (event) => {
    dragging = true;
    svg.setPointerCapture(event.pointerId);
    setHoursFromPointer(event);
  });
  svg.addEventListener('pointermove', (event) => {
    if (dragging) setHoursFromPointer(event);
  });
  svg.addEventListener('pointerup', () => {
    dragging = false;
  });
  svg.addEventListener('keydown', (event) => {
    const step = { ArrowLeft: 0.5, ArrowUp: 0.5, ArrowRight: -0.5, ArrowDown: -0.5 }[event.key];
    if (step === undefined) return;
    event.preventDefault();
    setPlan(app.game, { hours: app.game.player.plan.hours + step });
    updateHud(false);
  });
}

function updateOpenness() {
  const plan = app.game.player.plan;
  const slider = $('#openness-slider');
  if (document.activeElement !== slider) slider.value = Math.round(plan.openness * 100);
  slider.style.setProperty('--fill', `${plan.openness * 100}%`);
  slider.style.setProperty('--color', '#f5c542');
  const note = plan.openness > 0.6 ? 'Recruiters call often; focus slips and you are first in line for cuts.'
    : plan.openness < 0.25 ? 'Heads-down and loyal: protected in layoffs, invisible to recruiters.'
      : 'Some doors open, most of your focus here.';
  $('#open-note').textContent = app.game.employment.employed ? note : 'Searching: the more open, the faster an offer comes.';
}

// ── Project tile ───────────────────────────────────────────────────────

function updateProject() {
  const game = app.game;
  const player = game.player;
  const tile = $('#project-tile');
  if (!game.employment.employed) {
    tile.innerHTML = '<span class="doc-icon"></span><div class="project-name">Job search</div><div class="project-tags"><span class="tag warn">No deadline</span></div>';
    $('#project-lock').textContent = '';
    return;
  }
  const projectId = game.phase === 'plan' ? player.plan.project : player.quarter.projectId;
  const project = projectSpec(projectId, game.industry);
  const daysLeft = TIME.daysPerQuarter - game.day;
  const progress = game.phase === 'plan' ? 0 : Math.min(1, player.quarter.projectProgress);
  const onPace = Math.min(1, projectedCompletion(game, projectId));
  const impactTone = project.impact === 'high' ? 'hot' : project.impact === 'medium' ? 'warn' : 'blue';
  tile.innerHTML = `<span class="doc-icon"></span>
    <div class="project-name">${escapeHtml(project.name)}</div>
    <div class="project-tags"><span class="tag warn">Deadline: ${daysLeft} days</span><span class="tag ${impactTone}">Impact: ${project.impact}</span>
      <span class="tag ${onPace >= 1 ? 'good' : 'bad'}">On pace: ${Math.round(onPace * 100)}%</span></div>
    <div class="project-progress"><div style="width:${progress * 100}%"></div></div>
    ${game.phase === 'plan' ? '<button class="button small" data-action="pick-project">Change project</button>' : ''}`;
  $('#project-lock').textContent = game.phase === 'plan' ? '' : 'Locked until next quarter';
}

// ── Input ──────────────────────────────────────────────────────────────

function handleAction(action, target) {
  const game = app.game;
  switch (action) {
    case 'new-career':
      closeModal();
      app.pick = { characterId: null, industryId: null };
      showScreen('character');
      break;
    case 'continue': {
      const loaded = deserializeGame(readSave());
      if (!loaded) {
        toast('That save could not be read. Starting fresh.');
        clearSave();
        showScreen('title');
        break;
      }
      app.game = loaded;
      app.journalSeen = loaded.journal?.length ?? 0;
      app.paused = true;
      buildSliders();
      enterGame();
      break;
    }
    case 'back-title': showScreen('title'); break;
    case 'back-character': showScreen('character'); break;
    case 'help': openModal('help', helpPanel(0)); break;
    case 'close-modal':
      if (app.modal === 'over') break;
      closeModal();
      if (game) afterQuarterOpened();
      break;
    case 'run': beginRunning(); break;
    case 'fmla': {
      toast(takeFmla(game));
      if (app.modal === 'timeoff') closeModal();
      playJournalScenes();
      updateHud(true);
      break;
    }
    case 'holiday': {
      toast(takeHoliday(game, Number(target.dataset.days)));
      if (app.modal === 'timeoff') closeModal();
      playJournalScenes();
      updateHud(true);
      break;
    }
    case 'panel-timeoff': openModal('timeoff', timeOffPanel(game)); break;
    case 'settings': openModal('settings', settingsPanel(settings, audio.isEnabled(), END_SCENES, INTERIM_SCENES)); break;
    case 'toggle-cutscenes':
      settings.cutscenes = !settings.cutscenes;
      saveSettings();
      openModal('settings', settingsPanel(settings, audio.isEnabled(), END_SCENES, INTERIM_SCENES));
      break;
    case 'skip-scene': cutscenes.skip(); break;
    case 'speed':
      app.speedIndex = (app.speedIndex + 1) % SPEEDS.length;
      updateHud(true);
      break;
    case 'panel-org': openModal('org', orgPanel(game, app.orgTab, app.orgNode), true); break;
    case 'panel-performance': openModal('performance', performancePanel(game)); break;
    case 'panel-career': openModal('career', careerPanel(game), true); break;
    case 'pick-project': openModal('project', projectPanel(game)); break;
    case 'review-continue': afterQuarterOpened(); break;
    case 'sound': {
      if (audio.isEnabled()) audio.disable();
      else audio.enable();
      $('#sound-button').textContent = audio.isEnabled() ? 'Sound on' : 'Sound off';
      if (app.modal === 'settings') openModal('settings', settingsPanel(settings, audio.isEnabled(), END_SCENES, INTERIM_SCENES));
      if (game) audio.setState({ running: game.phase === 'running' && !app.paused, burnout: game.player.burnout.active, hours: game.player.plan.hours });
      break;
    }
    case 'menu': openModal('menu', menuPanel(Boolean(game && !game.outcome))); break;
    case 'save-quit':
      writeSave();
      closeModal();
      showScreen('title');
      break;
    case 'same-again': {
      const { character, industry } = game;
      closeModal();
      startCareer(character.id, industry.id);
      break;
    }
    case 'intro-next': intro.next(); break;
    case 'intro-skip': intro.skip(); break;
    default: break;
  }
  return target;
}

function bindInput() {
  document.addEventListener('click', (event) => {
    const actionTarget = event.target.closest('[data-action]');
    if (actionTarget) {
      handleAction(actionTarget.dataset.action, actionTarget);
      return;
    }
    const choice = event.target.closest('[data-choice]');
    if (choice && app.modal === 'event') {
      const result = chooseEventOption(app.game, Number(choice.dataset.choice));
      if (result) toast(result);
      playJournalScenes();
      afterQuarterOpened();
      return;
    }
    const character = event.target.closest('[data-character]');
    if (character) {
      app.pick.characterId = character.dataset.character;
      showScreen('industry');
      return;
    }
    const industry = event.target.closest('[data-industry]');
    if (industry) {
      app.pick.industryId = industry.dataset.industry;
      startCareer(app.pick.characterId, app.pick.industryId);
      return;
    }
    const project = event.target.closest('[data-project]');
    if (project) {
      setPlan(app.game, { project: project.dataset.project });
      closeModal();
      updateHud(true);
      return;
    }
    const scene = event.target.closest('[data-scene]');
    if (scene) {
      const data = app.game ? sceneData(app.game) : sampleSceneData();
      cutscenes.play(scene.dataset.scene, { ...data, netWorth: data.netWorth || 1e6 }, null);
      return;
    }
    const story = event.target.closest('[data-story]');
    if (story) {
      const page = Number(story.dataset.story);
      openModal('over', page < 0 ? gameOverPanel(app.game) : storyPanel(app.game, page), true);
      return;
    }
    const help = event.target.closest('[data-help]');
    if (help) {
      openModal('help', helpPanel(Number(help.dataset.help)));
      return;
    }
    const orgTab = event.target.closest('[data-org-tab]');
    if (orgTab) {
      app.orgTab = orgTab.dataset.orgTab;
      openModal('org', orgPanel(app.game, app.orgTab, app.orgNode), true);
      return;
    }
    const node = event.target.closest('[data-node]');
    if (node) {
      app.orgNode = node.dataset.node;
      openModal('org', orgPanel(app.game, app.orgTab, app.orgNode), true);
      return;
    }
    const tab = event.target.closest('[data-tab]');
    if (tab) selectTab(tab.dataset.tab);
  });
  $('#modal').addEventListener('click', (event) => {
    if (event.target.id === 'modal' && ['org', 'performance', 'career', 'help', 'project', 'menu', 'timeoff', 'settings'].includes(app.modal)) closeModal();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && cutscenes.isPlaying()) cutscenes.skip();
    else if (event.key === 'Escape' && ['org', 'performance', 'career', 'help', 'project', 'menu', 'timeoff', 'settings'].includes(app.modal)) closeModal();
    if (event.key === ' ' && app.screen === 'game' && !app.modal && event.target === document.body) {
      event.preventDefault();
      beginRunning();
    }
  });
  $('#auto-advance').addEventListener('change', (event) => {
    app.auto = event.target.checked;
  });
  $('#openness-slider').addEventListener('input', (event) => {
    setPlan(app.game, { openness: Number(event.target.value) / 100 });
    updateHud(false);
  });
  $('#management-slider').addEventListener('input', (event) => {
    setPlan(app.game, { managementStyle: Number(event.target.value) / 100 });
  });
  window.addEventListener('resize', () => {
    if (office) office.resize();
    if (cutscenes) cutscenes.resize();
    if (intro) intro.resize();
  });
  bindArc();
}

function selectTab(name) {
  app.activeTab = name;
  $$('.control-tab').forEach((tab) => tab.classList.toggle('active', tab.dataset.tab === name));
  $$('.controls > .panel').forEach((panel) => panel.classList.toggle('active', panel.dataset.tabPanel === name));
}

// ── Boot ───────────────────────────────────────────────────────────────

function boot() {
  office = createOffice($('#office'));
  cutscenes = createCutscenePlayer($('#cutscene'));
  intro = createIntro($('#intro-canvas'), $('#intro-line'));
  $('#character-grid').innerHTML = characterCards();
  $('#industry-grid').innerHTML = industryCards();
  bindInput();
  selectTab('bandwidth');
  showScreen('title');
  requestAnimationFrame(frame);
}

// A test and debugging hook: drive the game without timers, which hidden
// tabs freeze.
window.theLadder = {
  get game() { return app.game; },
  get app() { return app; },
  advanceDays(count) {
    for (let index = 0; index < count && app.game && app.game.phase === 'running'; index += 1) stepOneDay();
    updateHud(true);
  },
  // Paint one frame now, at a chosen hour of the visual day: unfocused tabs
  // never run animation frames, so looks are checked through this.
  redraw(hour = null) {
    if (hour !== null) app.visualTime = Math.max(0, (hour - 7.5) / (app.game.player.plan.hours + 1)) * VISUAL_DAY_SECONDS;
    drawOffice(performance.now() / 1000);
  },
  get cutscenes() { return cutscenes; },
  get settings() { return settings; },
  start(characterId = 'simon', industryId = 'tech') {
    startCareer(characterId, industryId);
    intro.skip();
  },
};

boot();

export { quarterlyExpenses, dailyCoreOutput, MOTIVATION, CHARACTERS, INDUSTRIES, onBurnoutLeave };
