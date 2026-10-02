// The page: screens, the day clock, the HUD and controls, and the wiring
// between the player's input and the simulation. The simulation itself is
// in src/sim and knows nothing about the page.

import {
  createGame, startRunning, runDay, closeQuarter, chooseEventOption, setPlan, rebalanceShares,
  titleOf, formatMoney, netWorth, quarterlyExpenses, takeFmla, fmlaStatus, takeHoliday, holidayStatus,
} from '../sim/game.js';
import { serializeGame, deserializeGame } from '../sim/save.js';
import { rememberAnswer, pickRemembered } from '../sim/autopilot.js';
import { downloadShareDocument, showShareDocument } from './share.js';
import { RATING_LABELS, totalBandwidth, effectiveHours, projectSpec, dailyCoreOutput, onBurnoutLeave } from '../sim/agent.js';
import { agentsAtLevel, employedAgents } from '../sim/org.js';
import { CHARACTERS, INDUSTRIES, TIME, BANDWIDTH, MOTIVATION, ORG, ERA } from '../config.js';
import { createOffice, officeTier } from './office.js';
import { officeThemeFor } from './office-themes.js';
import { peerLook } from './figures.js';
import { createAudio } from './audio.js';
import {
  eventPanel, reviewPanel, moneyPanel, vitalsPanel, orgPanel, performancePanel, careerPanel, projectPanel, helpPanel, menuPanel,
  gameOverPanel, storyPanel, journeyPanel, timeOffPanel, settingsPanel, characterCards, characterProfile, industryCards, employerCards, industryMeter, projectedCompletion, escapeHtml,
} from './panels.js';
import { validAdjustments } from '../sim/adjust.js';
import { socialPanel, partnerPanel } from './family-panels.js';
import { officeVisitStatus } from '../sim/office-life.js';
import { dialogueFor, answerDialogue } from '../sim/office-dialogue.js';
import { socialEquilibrium, familyTarget, dateNight, breakUp, partnerIncome } from '../sim/family.js';
import { createIntro } from './intro.js';
import { createMusic } from './music.js';
import { calendarYear } from '../sim/era.js';
import { createCutscenePlayer, END_SCENES, INTERIM_SCENES, JOURNAL_SCENES, endingSceneFor, sceneData } from './cutscenes.js';

const SAVE_KEY = 'the-ladder-save';
const SETTINGS_KEY = 'the-ladder-settings';
// Which journal moment wins when several land at once.
const SCENE_PRIORITY = ['sir', 'carCrash', 'houseFire', 'diagnosis', 'farewell', 'lostJob', 'healthScare', 'burnout', 'promoted', 'newJob', 'house', 'married', 'divorce', 'breakup', 'newborn', 'child', 'dating', 'startupWin', 'fmla', 'holiday'];
// Scenes that play even on autopilot.
const ALWAYS_PLAY = new Set(['sir']);
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
  pick: { characterId: null, industryId: null, birthYear: ERA.defaultBirthYear },
  paused: false,
  speedIndex: 0,
  auto: false,
  // Autopilot: whole quarters run at once, known events answered as last time.
  autopilot: false,
  answers: {},
  lastAutopilot: 0,
  dayAccumulator: 0,
  visualTime: 0,
  modal: null,
  orgTab: 'chart',
  careerTab: 'profile',
  vitalsTab: 'health',
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
const music = createMusic();

function loadSettings() {
  try {
    return { cutscenes: true, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') };
  } catch (error) {
    return { cutscenes: true };
  }
}

/** Sound starts on: the browser lets it play from the first click, unless the player has switched it off. */
function enableSoundOnFirstGesture() {
  const start = () => {
    document.removeEventListener('pointerdown', start, true);
    if (settings.sound === false || audio.isEnabled()) return;
    audio.enable();
    $('#sound-button').textContent = 'Sound on';
  };
  document.addEventListener('pointerdown', start, true);
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
  // Autopilot skips the everyday scenes, but a once-in-a-career moment always plays (autopilot waits for it).
  const scenes = new Set(fresh.map((entry) => JOURNAL_SCENES[entry.kind]).filter((scene) => scene && (!app.autopilot || ALWAYS_PLAY.has(scene))));
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

function startCareer(characterId, industryId, startTier = null, faceStyle = null, adjust = null, birthYear = ERA.defaultBirthYear) {
  const seed = Math.floor(Math.random() * 1e9);
  app.game = createGame({ seed, characterId, industryId, startTier, faceStyle, adjust, birthYear });
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
  if (app.autopilot && answerKnownEvents()) return;
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
    if (app.autopilot) setAutopilot(false, 'Autopilot off: burnout. Rest, then switch it back on.');
    toast(fmlaStatus(app.game).eligible
      ? 'Burnout. The quarter is paused: move Recovery to 35% or more, or take FMLA leave, then resume.'
      : 'Burnout. The quarter is paused: move Recovery to 35% or more, then resume.');
    updateHud(true);
  } else if (note.kind === 'event') {
    // Autopilot answers it, or asks, once the day's work is done.
    if (!app.autopilot) openModal('event', eventPanel(app.game));
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
  if (app.autopilot) {
    // Autopilot only stops the quarter for what needs a new plan.
    if (report.lostJob || report.pipStarted) {
      setAutopilot(false, report.lostJob ? 'Autopilot off: you lost the job.' : 'Autopilot off: you are on a PIP.');
      openModal('review', reviewPanel(game, report));
      return;
    }
    toast(`${report.promoted ? 'Promoted · ' : ''}${RATING_LABELS[report.rating] ?? 'Quarter closed'}${report.rank ? ` · rank ${report.rank}/${report.poolSize}` : ''}`);
    afterQuarterOpened();
    return;
  }
  if (app.auto && !report.promoted && !report.lostJob && !report.leapfrogged && report.rating !== 'meetSome') {
    toast(`${RATING_LABELS[report.rating] ?? 'Quarter closed'} · rank ${report.rank ?? '—'}/${report.poolSize ?? '—'}`);
    afterQuarterOpened();
    return;
  }
  openModal('review', reviewPanel(game, report));
}

// ── Autopilot ──────────────────────────────────────────────────────────

const AUTOPILOT_INTERVAL_MS = 120;

function setAutopilot(on, message = null) {
  if (on === app.autopilot) {
    if (message) toast(message);
    return;
  }
  app.autopilot = on;
  // Autopilot is the normal quarter at the fastest speed, answering what it has seen before: the player's own speed is kept for
  // when it ends, and a red button above everything cancels it at any moment.
  if (on) {
    app.speedBeforeAutopilot = app.speedIndex;
    app.speedIndex = SPEEDS.length - 1;
  } else if (app.speedBeforeAutopilot !== undefined) {
    app.speedIndex = app.speedBeforeAutopilot;
    app.speedBeforeAutopilot = undefined;
  }
  $('#autopilot-cancel').hidden = !on;
  $('#speed-button').textContent = `${SPEEDS[app.speedIndex]}×`;
  if (message) toast(message);
  $('#autopilot-button').classList.toggle('on', on);
  $('#autopilot-button').setAttribute('aria-pressed', String(on));
  $('#autopilot-button').textContent = on ? 'Autopilot on' : 'Autopilot';
  if (on) app.paused = false;
}

/** Answer events as last time. Returns true when a new kind of event needs the player. */
function answerKnownEvents() {
  const game = app.game;
  let guard = 0;
  while (game.currentEvent && guard < 12) {
    guard += 1;
    const { event, choices } = game.currentEvent;
    const index = pickRemembered(app.answers, event.id, choices);
    if (index === null) {
      openModal('event', eventPanel(game));
      return true;
    }
    const label = choices[index].label;
    chooseEventOption(game, index);
    toast(`${event.title}: ${label}`);
  }
  return false;
}

/** Autopilot between days: answer what it knows, ask about what it does not, and start the next quarter. */
function autopilotTick(now) {
  const game = app.game;
  if (app.modal || cutscenes.isPlaying() || game.outcome || now - app.lastAutopilot < AUTOPILOT_INTERVAL_MS) return;
  app.lastAutopilot = now;
  if (game.currentEvent) {
    answerKnownEvents();
    return;
  }
  if (game.phase === 'plan') {
    if (!startRunning(game)) return;
    app.paused = false;
    updateHud(true);
  }
}

function frame(now) {
  const seconds = Math.min(0.1, (now - (frame.last ?? now)) / 1000);
  frame.last = now;
  if (app.screen === 'game' && app.game) {
    const game = app.game;
    const speed = SPEEDS[app.speedIndex];
    const running = game.phase === 'running' && !app.paused && !app.modal && !app.dialogue && !cutscenes.isPlaying();
    if (app.autopilot) autopilotTick(now);
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
  const chosen = [...new Set(peers)].slice(0, 3);
  app.peerAgents = chosen;
  const unique = chosen.map((agent, index) => ({
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
    themeId: officeThemeFor(game.industry.id, game.org?.tier ?? game.lastOrg?.tier),
    productivity: Math.min(1, player.plan.shares[0] * 1.6),
    running,
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
  void tier;
  const desk = office.deskAnchor();
  const deskX = desk.x;
  addChip(`Productivity: ${level}`, level === 'High' ? 'green' : level === 'Low' ? 'red' : '', deskX + 1, desk.y - 0.2, 150, true);
  const project = projectSpec(player.quarter.projectId, game.industry);
  if (project) {
    const progress = Math.min(1, player.quarter.projectProgress);
    addChip(`<span class="ring" style="--progress:${Math.round(progress * 100)}%"></span>${escapeHtml(project.name)}: ${Math.round(progress * 100)}%`, '', deskX - 0.6, desk.y + 2, 40, true);
  }
  if (player.plan.shares[2] >= 0.15 && game.day > 0 && game.day % 18 < 6) {
    const gain = Math.max(1, Math.round(player.plan.shares[2] * 10));
    floatChip(`Peer networking: +${gain}`, '', desk.x + 4, desk.y - 1.6, 110);
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

/** A conversation at a place in the office: a small panel over the floor, never a full-screen modal. */
function openOfficeDialogue(poi) {
  const game = app.game;
  const panel = $('#office-dialog');
  if (!game || !poi || !game.employment.employed) {
    office.endChat(false);
    return;
  }
  const index = poi.id?.startsWith('peer') ? Number(poi.id.slice(4)) : -1;
  const dialogue = dialogueFor(game, poi.kind, index >= 0 ? app.peerAgents?.[index] ?? null : null);
  app.dialogue = dialogue;
  panel.hidden = false;
  panel.innerHTML = `<div class="dialog-speaker">${escapeHtml(dialogue.speaker)}</div><p>${escapeHtml(dialogue.line)}</p>
    <div class="dialog-options">${dialogue.options.map((option) => `<button class="button small" data-dialogue="${option.id}">${escapeHtml(option.label)}</button>`).join('')}</div>`;
}

/** Close the conversation panel. `finished` is whether the player chose; `return` sends them back to work if the quarter is running. */
function closeOfficeDialogue(finished = true) {
  const panel = $('#office-dialog');
  if (!panel || panel.hidden) return;
  panel.hidden = true;
  panel.innerHTML = '';
  app.dialogue = null;
  if (finished) office.endChat(app.game.phase === 'running');
}

function answerOfficeDialogue(optionId) {
  const game = app.game;
  const dialogue = app.dialogue;
  if (!game || !dialogue) return;
  const result = answerDialogue(game, dialogue, optionId);
  if (result.applied) updateHud(true);
  updateOfficeHint();
  // The answer stays on the panel until the player is done with it: it can be news worth reading.
  $('#office-dialog').innerHTML = `<div class="dialog-speaker">${escapeHtml(dialogue.speaker)}</div><p>${escapeHtml(result.text)}</p>
    <div class="dialog-options"><button class="button small primary" data-dialogue-done>Done</button></div>`;
  app.dialogue = { ...dialogue, answered: true };
}

/** The small hint on the office: what a click does, and whether this quarter's visit is spent. */
function updateOfficeHint() {
  const hint = $('#office-hint');
  if (!hint || !app.game) return;
  const status = officeVisitStatus(app.game);
  hint.hidden = !app.game.employment.employed;
  hint.textContent = status.allowed ? 'Click the floor to walk: a colleague, the pantry, the meeting room or the lounge' : 'Time with people used this quarter';
  hint.classList.toggle('used', !status.allowed);
}

const MAX_TOASTS = 3;

/** A short notice in the corner: at most three at once, the oldest giving way, none in the player's way. */
function toast(text) {
  const container = $('#toasts');
  while (container.children.length >= MAX_TOASTS) container.firstElementChild.remove();
  const element = document.createElement('div');
  element.className = 'toast';
  element.textContent = text;
  container.append(element);
  setTimeout(() => element.remove(), 3600);
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
  updateSocialBar(game);
  updateOfficeHint();
  $('#age-value').textContent = `Age: ${Math.floor(player.age)}`;
  $('#age-value').title = `${calendarYear(game)}`;
  $('#wealth-value').textContent = formatMoney(netWorth(game));
  const householdIncome = (game.employment.employed ? player.salary : 0) + partnerIncome(game);
  $('#income-value').textContent = householdIncome > 0 ? `${formatMoney(householdIncome)} / yr${game.married && game.partner ? ' (household)' : ''}` : 'No income';

  const quarterOfYear = (game.quarterIndex % 4) + 1;
  const year = Math.floor(game.quarterIndex / 4) + 1;
  $('#clock-quarter').textContent = `Q${quarterOfYear} · ${calendarYear(game)}${game.sir ? ' · AI era' : ''}`;
  void year;
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
  if (onFmla && game.fmla.kind === 'medical') $('#leave-banner').textContent = `On medical leave: ${game.fmla.daysLeft} workdays left. Unpaid, job-protected, healing.`;
  else if (onFmla && game.fmla.kind === 'parental') $('#leave-banner').textContent = `On ${game.character.gender === 'female' ? 'maternity' : 'paternity'} leave: ${game.fmla.daysLeft} workdays left. Unpaid, job-protected, with the baby.`;
  else if (onFmla) $('#leave-banner').textContent = `On FMLA leave: ${game.fmla.daysLeft} workdays left. Unpaid, job-protected, recovering fast.`;
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

/** The third bar: the social circle, which becomes the family once married. */
function updateSocialBar(game) {
  const married = Boolean(game.married && game.family);
  const element = $('#vital-social');
  const value = Math.max(0, Math.min(100, married ? game.family.quality : game.social));
  const target = married ? familyTarget(game).target : socialEquilibrium(game);
  element.querySelector('.bar').className = `bar ${married ? 'family-bar' : 'social-bar'}${value < 25 ? ' low' : ''}`;
  element.querySelector('.vital-icon').classList.toggle('family', married);
  element.querySelector('.bar-fill').style.width = `${value}%`;
  element.querySelector('.bar-label').textContent = `${married ? 'Family' : 'Social'}: ${Math.round(value)}%`;
  const delta = element.querySelector('.vital-delta');
  const gap = target - value;
  delta.textContent = Math.abs(gap) < 1.5 ? 'steady' : `${gap > 0 ? '▲' : '▼'} heading to ${Math.round(target)}%`;
  delta.className = `vital-delta ${Math.abs(gap) < 1.5 ? '' : gap > 0 ? 'up' : 'down'}`;
  $('#partner-button').hidden = !game.partner;
  $('.side-buttons').classList.toggle('five', Boolean(game.partner));
  $('#partner-button').lastChild.textContent = game.partner?.stage === 'married' ? 'Spouse' : 'Partner';
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
  const weekends = Boolean(app.game.player.plan.weekends);
  const weekly = hours * (weekends ? 7 : 5);
  $('#hours-figure').textContent = `Daily hrs: ${hours % 1 ? hours.toFixed(1) : hours} · ${weekly % 1 ? weekly.toFixed(1) : weekly} h/week`;
  $('#weekend-check').checked = weekends;
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
      renderCharacterPick();
      showScreen('character');
      break;
    case 'pick-character':
      if (app.pick.characterId) showScreen('industry');
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
    case 'back-roster': showScreen('character'); break;
    case 'back-industry': showScreen('industry'); break;
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
    case 'panel-journey': openModal('journey', journeyPanel(game), true); break;
    case 'settings': openModal('settings', settingsPanel(settings, audio.isEnabled(), END_SCENES, INTERIM_SCENES), true); break;
    case 'toggle-music':
      settings.music = settings.music === false;
      music.setEnabled(settings.music);
      saveSettings();
      openModal('settings', settingsPanel(settings, audio.isEnabled(), END_SCENES, INTERIM_SCENES), true);
      break;
    case 'toggle-cutscenes':
      settings.cutscenes = !settings.cutscenes;
      saveSettings();
      openModal('settings', settingsPanel(settings, audio.isEnabled(), END_SCENES, INTERIM_SCENES), true);
      break;
    case 'skip-scene': cutscenes.skip(); break;
    case 'share-story':
      if (game.outcome) {
        // Shown on screen to screenshot or save, not downloaded behind the player's back.
        closeModal();
        showShareDocument(game, $('#share-view'));
      }
      break;
    case 'autopilot-cancel': setAutopilot(false, 'Autopilot cancelled. Everything is back in your hands.'); break;
    case 'autopilot': setAutopilot(!app.autopilot, app.autopilot ? null : 'Autopilot on: quarters run by themselves, and you are asked only about new kinds of events.'); break;
    case 'speed':
      app.speedIndex = (app.speedIndex + 1) % SPEEDS.length;
      updateHud(true);
      break;
    case 'panel-org': openModal('org', orgPanel(game, app.orgTab, app.orgNode), true); break;
    case 'panel-performance': openModal('performance', performancePanel(game)); break;
    case 'panel-vitals': openModal('vitals', vitalsPanel(game, app.vitalsTab), true); break;
    case 'panel-social': openModal('social', socialPanel(game), true); break;
    case 'panel-partner': openModal('partner', partnerPanel(game), true); break;
    case 'date-night':
      toast(dateNight(game));
      openModal('partner', partnerPanel(game), true);
      updateHud(true);
      break;
    case 'end-relationship':
      breakUp(game, 'player');
      playJournalScenes();
      closeModal();
      updateHud(true);
      break;
    case 'panel-money': openModal('money', moneyPanel(game), true); break;
    case 'panel-career': openModal('career', careerPanel(game, app.careerTab), true); break;
    case 'pick-project': openModal('project', projectPanel(game)); break;
    case 'review-continue': afterQuarterOpened(); break;
    case 'sound': {
      if (audio.isEnabled()) audio.disable();
      else audio.enable();
      settings.sound = audio.isEnabled();
      saveSettings();
      $('#sound-button').textContent = audio.isEnabled() ? 'Sound on' : 'Sound off';
      if (app.modal === 'settings') openModal('settings', settingsPanel(settings, audio.isEnabled(), END_SCENES, INTERIM_SCENES), true);
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
      startCareer(character.id, industry.id, game.startTier, game.player.look.faceStyle);
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
    if (event.target.closest('[data-share-close]')) {
      $('#share-view').hidden = true;
      $('#share-view').innerHTML = '';
      if (app.game?.outcome) openModal('over', gameOverPanel(app.game), true);
      return;
    }
    if (event.target.closest('[data-share-save]')) {
      downloadShareDocument(app.game);
      toast('Saved: one self-contained page with the story, the ending and the charts.');
      return;
    }
    const dialogueOption = event.target.closest('[data-dialogue]');
    if (dialogueOption) {
      answerOfficeDialogue(dialogueOption.dataset.dialogue);
      return;
    }
    if (event.target.closest('[data-dialogue-done]')) {
      closeOfficeDialogue(true);
      return;
    }
    const actionTarget = event.target.closest('[data-action]');
    if (actionTarget) {
      handleAction(actionTarget.dataset.action, actionTarget);
      return;
    }
    const choice = event.target.closest('[data-choice]');
    if (choice && app.modal === 'event') {
      const picked = Number(choice.dataset.choice);
      const asked = app.game.currentEvent;
      if (asked) rememberAnswer(app.answers, asked.event.id, asked.choices[picked], picked);
      const result = chooseEventOption(app.game, picked);
      if (result) toast(result);
      playJournalScenes();
      afterQuarterOpened();
      return;
    }
    const character = event.target.closest('[data-character]');
    if (character) {
      app.pick.characterId = character.dataset.character;
      app.pick.faceStyle = null;
      app.pick.adjust = {};
      $('#profile-body').innerHTML = characterProfile(app.pick.characterId, null, {}, app.pick.birthYear);
      showScreen('profile');
      return;
    }
    const faceStyle = event.target.closest('[data-face-style]');
    if (faceStyle) {
      app.pick.faceStyle = faceStyle.dataset.faceStyle;
      $('#profile-body').innerHTML = characterProfile(app.pick.characterId, app.pick.faceStyle, app.pick.adjust ?? {}, app.pick.birthYear);
      return;
    }
    const adjustButton = event.target.closest('[data-adjust]');
    if (adjustButton && !adjustButton.disabled) {
      const steps = { ...(app.pick.adjust ?? {}) };
      const id = adjustButton.dataset.adjust;
      steps[id] = (steps[id] ?? 0) + Number(adjustButton.dataset.dir);
      if (validAdjustments(steps)) app.pick.adjust = steps;
      $('#profile-body').innerHTML = characterProfile(app.pick.characterId, app.pick.faceStyle, app.pick.adjust ?? {}, app.pick.birthYear);
      return;
    }
    if (event.target.closest('[data-adjust-reset]')) {
      app.pick.adjust = {};
      $('#profile-body').innerHTML = characterProfile(app.pick.characterId, app.pick.faceStyle, {}, app.pick.birthYear);
      return;
    }
    const industry = event.target.closest('[data-industry]');
    if (industry) {
      app.pick.industryId = industry.dataset.industry;
      $('#employer-grid').innerHTML = employerCards(app.pick.industryId);
      showScreen('employer');
      return;
    }
    const employer = event.target.closest('[data-employer]');
    if (employer) {
      const tier = employer.dataset.employer === 'random' ? null : employer.dataset.employer;
      startCareer(app.pick.characterId, app.pick.industryId, tier, app.pick.faceStyle, app.pick.adjust ?? null, app.pick.birthYear);
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
    const vitalsTab = event.target.closest('[data-vitals-tab]');
    if (vitalsTab) {
      app.vitalsTab = vitalsTab.dataset.vitalsTab;
      openModal('vitals', vitalsPanel(app.game, app.vitalsTab), true);
      return;
    }
    const careerTab = event.target.closest('[data-career-tab]');
    if (careerTab) {
      app.careerTab = careerTab.dataset.careerTab;
      openModal('career', careerPanel(app.game, app.careerTab), true);
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
    if (event.target.id === 'modal' && ['org', 'performance', 'career', 'help', 'project', 'menu', 'timeoff', 'settings', 'vitals', 'money'].includes(app.modal)) closeModal();
  });
  document.addEventListener('keydown', (event) => {
    const pressable = event.target.closest?.('[role="button"][data-action]');
    if (pressable && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      pressable.click();
      return;
    }
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
  // The birth-year slider lives inside the profile, which is re-rendered: listen on the document.
  document.addEventListener('input', (event) => {
    if (event.target.id !== 'birth-year') return;
    app.pick.birthYear = Number(event.target.value);
    event.target.style.setProperty('--fill', `${(app.pick.birthYear - ERA.birthYears[0]) / (ERA.birthYears[1] - ERA.birthYears[0]) * 100}%`);
    const picker = event.target.closest('.birth-year');
    const fresh = document.createElement('div');
    fresh.innerHTML = characterProfile(app.pick.characterId, app.pick.faceStyle, app.pick.adjust ?? {}, app.pick.birthYear);
    const next = fresh.querySelector('.birth-year');
    picker.querySelector('label').innerHTML = next.querySelector('label').innerHTML;
  });
  $('#weekend-check').addEventListener('change', (event) => {
    if (!app.game) return;
    setPlan(app.game, { weekends: event.target.checked });
    updateArc();
    updateHud(true);
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

function renderCharacterPick() {
  $('#character-grid').innerHTML = characterCards();
}

// ── Boot ───────────────────────────────────────────────────────────────

/** No pinch- or gesture-zoom on touch screens (iOS ignores the viewport's user-scalable, so stop its gesture events too). */
function preventZoom() {
  for (const type of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(type, (event) => event.preventDefault(), { passive: false });
  document.addEventListener('touchmove', (event) => { if (event.touches.length > 1) event.preventDefault(); }, { passive: false });
  document.addEventListener('dblclick', (event) => event.preventDefault());
}

function boot() {
  preventZoom();
  office = createOffice($('#office'));
  // Click the floor: the character stands, walks over, and at a colleague, the pantry, the meeting room or the lounge
  // spends a moment that counts once a quarter.
  office.setInteractHook((poi) => openOfficeDialogue(poi));
  office.setCancelHook(() => closeOfficeDialogue(false));
  $('#office').addEventListener('click', (event) => {
    const game = app.game;
    if (!game || app.screen !== 'game' || app.modal || game.outcome) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const outcome = office.click(event.clientX - rect.left, event.clientY - rect.top);
    if (outcome.status === 'blocked') toast('You cannot get there: something is in the way.');
    updateOfficeHint();
  });
  cutscenes = createCutscenePlayer($('#cutscene'));
  music.setEnabled(settings.music !== false);
  enableSoundOnFirstGesture();
  cutscenes.setOnPlay((id) => music.playForScene(id));
  intro = createIntro($('#intro-canvas'), $('#intro-line'));
  renderCharacterPick();
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
  get office() { return office; },
  get cutscenes() { return cutscenes; },
  get settings() { return settings; },
  start(characterId = 'simon', industryId = 'tech') {
    startCareer(characterId, industryId);
    intro.skip();
  },
};

boot();

export { quarterlyExpenses, dailyCoreOutput, MOTIVATION, CHARACTERS, INDUSTRIES, onBurnoutLeave };
