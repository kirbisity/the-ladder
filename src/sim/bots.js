// Players that play whole careers headlessly, so balance is measured rather
// than guessed. Each policy reads only what the HUD shows a human: health,
// motivation, readiness, rating, PIP, burnout, the industry meter.

import { createGame, setPlan, chooseEventOption, startRunning, runDay, closeQuarter, netWorth, takeFmla, fmlaStatus, fireNumber } from './game.js';
import { clamp, projectFor, projectsOpenTo, healthTarget, stagnationYears } from './agent.js';
import { READINESS, INDUSTRY_STATS, BANDWIDTH, FIRE } from '../config.js';

function preferTags(order) {
  return (game, choices) => {
    for (const tag of order) {
      const index = choices.findIndex((choice) => choice.tag === tag);
      if (index >= 0) return index;
    }
    return 0;
  };
}

// A fixed style. Most still obey the burnout banner, as a person would when
// the screen goes grey and tells them what to do; the grinder does not.
function fixed(plan, tagOrder, { heedsBurnout = true } = {}) {
  return {
    plan: (game) => {
      if (heedsBurnout && game.player.burnout.active) {
        return { ...plan, hours: Math.min(plan.hours, 9), shares: [0.35, 0.1, 0.05, 0.5] };
      }
      if (!game.employment.employed) return { ...plan, openness: 0.8 };
      return plan;
    },
    choose: preferTags(tagOrder),
  };
}

function industryProject(game, fallback) {
  const player = game.player;
  if (game.industry.subStat === 'techDebt' && player.industry.techDebt > 65) return 'repair';
  if (game.industry.subStat === 'citations' && game.quarterIndex % 3 === 0) return 'special';
  if (game.industry.subStat === 'dealFlow' && player.industry.dealFlow < 30) return 'repair';
  return fallback;
}

/**
 * A thoughtful human: rests when the bars say so, pushes when they allow,
 * and learns a sustainable pace by watching health and motivation rather
 * than by knowing the character's hidden numbers. Networking effort follows
 * the political skill on the character card.
 */
function adaptivePlan(game) {
  const player = game.player;
  const memory = game.botMemory ?? (game.botMemory = { hours: 9, lastHealth: player.health, lastMotivation: player.motivation });
  const base = { citizenshipFocus: 'help', politicsFocus: 'upward', managementStyle: 0.4 };
  const healthTrend = player.health - memory.lastHealth;
  const motivationTrend = player.motivation - memory.lastMotivation;
  memory.lastHealth = player.health;
  memory.lastMotivation = player.motivation;
  if (!game.employment.employed) {
    return { ...base, hours: 8, shares: [0.4, 0.1, 0.1, 0.4], openness: 1, project: 'safe' };
  }
  const openness = game.flags.layoffAt !== null ? 0.8 : 0.25;
  if (player.burnout.active) {
    memory.hours = Math.max(8, memory.hours - 1.5);
    return { ...base, hours: 8, shares: [0.3, 0.1, 0.05, 0.55], openness, project: 'safe' };
  }
  if (player.health < 50 || player.motivation < 35) {
    memory.hours = Math.max(8, memory.hours - 1);
    return { ...base, hours: 8, shares: [0.45, 0.1, 0.1, 0.35], openness, project: 'safe' };
  }
  if (player.pip.active) {
    return { ...base, hours: Math.max(10, memory.hours), shares: [0.75, 0.05, 0.1, 0.1], openness: 0.6, project: 'safe' };
  }
  // Pace: add half an hour while both bars are high and holding; back off
  // as soon as either starts to slide, as a player watching the weekly
  // arrows on the HUD would. Past 12 hours only when health is excellent.
  // Health counts twice in output (bandwidth and execution), so an hour that
  // costs ten points of health loses more than it adds: the bot guards it.
  // Thresholds sit relative to the health a standard day would hold in this
  // job: consulting travel lowers it for everyone, and that is not strain.
  const restingHealth = Math.min(95, healthTarget({ ...player, plan: { ...player.plan, hours: BANDWIDTH.standardHours } }, { industry: game.industry, employed: true }));
  const ceiling = player.health > Math.min(90, restingHealth - 2) ? BOT_MAX_HOURS : 12;
  // Motivation jumps with every event, so only its level counts; health
  // moves slowly, so its trend is a fair early warning.
  const comfortable = player.health > Math.min(86, restingHealth - 6) && player.motivation > 55 && healthTrend > -1;
  const strained = player.health < Math.min(80, restingHealth - 12) || player.motivation < 45 || healthTrend < -2;
  if (strained) memory.hours = Math.max(8, memory.hours - 1);
  else if (comfortable) memory.hours = Math.min(ceiling, memory.hours + 0.5);
  memory.hours = Math.min(memory.hours, ceiling);
  const hours = memory.hours;
  const politicalTalent = clamp((player.pol - 80) / 60, 0, 1);
  const politics = 0.1 + 0.15 * politicalTalent;
  const needReadiness = player.readiness < READINESS.threshold;
  const citizenship = needReadiness ? 0.15 : 0.1;
  const recovery = 0.15;
  let shares = [1 - politics - citizenship - recovery, citizenship, politics, recovery];
  if (game.industry.subStat === 'utilization') {
    const core = clamp(INDUSTRY_STATS.utilization.target * BANDWIDTH.standardHours / hours, 0.4, 0.8);
    // What is not billable goes to politics by talent, then rest and help.
    const politicalTime = Math.min((1 - core) * 0.7, politics);
    const left = 1 - core - politicalTime;
    shares = [core, left * 0.45, politicalTime, left * 0.55];
  }
  const canMoonshot = player.level >= 3 || player.traits.moonshotUnlocked;
  const ahead = ['greatlyExceeds', 'exceeds'].includes(player.lastRating);
  const project = industryProject(game, canMoonshot && comfortable && ahead ? 'risky' : 'visible');
  return { ...base, hours, shares, openness, project };
}

// The longest day a sensible player will try, however well they take it.
const BOT_MAX_HOURS = 13;

function adaptiveChoose(game, choices) {
  const player = game.player;
  // The fork: the character card's political sense says which track suits.
  if (game.currentEvent?.event.id === 'trackChoice') {
    if (game.botForceTrack) return game.botForceTrack === 'management' ? 0 : 1;
    return player.pol >= 100 ? 0 : 1;
  }
  if (game.currentEvent?.event.id === 'jobOffer') {
    const offer = game.currentEvent.data;
    const accept = !game.employment.employed || offer.level > player.level
      || (offer.salary > player.salary * 1.2 && player.quartersAtLevel > 12) || player.pip.active;
    return accept ? 0 : choices.length - 1;
  }
  // Financial independence: a thoughtful player takes it once the climb has
  // stopped being worth what it costs, or once they are old enough to enjoy it.
  // Fifty: a thoughtful player stops if worn out, otherwise carries on to sixty.
  if (game.currentEvent?.event.id === 'retireOffer') return player.health < 55 || player.motivation < 40 ? 0 : 1;
  if (game.currentEvent?.event.id === 'fireOffer') {
    const wornOrStalled = player.health < 65 || player.motivation < 45 || stagnationYears(player) >= 3 || !game.employment.employed;
    const done = player.age >= 50 || (player.age >= 40 && wornOrStalled);
    return done ? 0 : 1;
  }
  const order = player.health < 55 || player.motivation < 40 || player.burnout.active
    ? ['rest', 'safe', 'kind', 'ambitious']
    : ['ambitious', 'safe', 'kind', 'rest'];
  return preferTags(order)(game, choices);
}

export const POLICIES = {
  grinder: fixed({ hours: 14, shares: [0.75, 0.05, 0.15, 0.05], openness: 0.2, project: 'visible', politicsFocus: 'upward' }, ['ambitious', 'bold', 'safe'], { heedsBurnout: false }),
  // Twelve-hour days every quarter, resting only when burnout forces it:
  // the test of who can sustain a maxed-out schedule.
  longHours: fixed({ hours: 12, shares: [0.65, 0.1, 0.15, 0.1], openness: 0.2, project: 'visible', politicsFocus: 'upward' }, ['ambitious', 'safe', 'rest']),
  coaster: fixed({ hours: 7, shares: [0.45, 0.1, 0.05, 0.4], openness: 0.3, project: 'safe' }, ['rest', 'safe']),
  minimal: fixed({ hours: 8, shares: [0.6, 0.1, 0.1, 0.2], openness: 0.3, project: 'safe' }, ['safe', 'rest']),
  balanced: fixed({ hours: 9, shares: [0.55, 0.15, 0.15, 0.15], openness: 0.3, project: 'visible' }, ['safe', 'kind']),
  politician: fixed({ hours: 9.5, shares: [0.35, 0.15, 0.45, 0.05], openness: 0.3, project: 'visible', politicsFocus: 'upward' }, ['ambitious', 'selfish', 'safe']),
  // The thoughtful player also takes FMLA when burned out, if eligible.
  adaptive: { plan: adaptivePlan, choose: adaptiveChoose, useFmla: (game) => game.player.burnout.active && fmlaStatus(game).eligible },
  random: {
    plan: (game) => {
      const random = game.botRandom;
      return {
        hours: random.between(6, 15),
        shares: [random.next(), random.next(), random.next(), random.next()],
        openness: random.next(),
        project: random.pick(['safe', 'visible', 'citizenship']),
      };
    },
    choose: (game, choices) => game.botRandom.int(0, choices.length - 1),
  },
};

// Plans name a project by role; the industry decides which project that is.
function applyPlan(game, policy) {
  const plan = { ...policy.plan(game) };
  const open = projectsOpenTo(game.player, game.industry);
  const wanted = projectFor(game.industry, plan.project ?? 'safe');
  plan.project = open.includes(wanted) ? wanted.id : projectFor(game.industry, 'safe').id;
  setPlan(game, plan);
}

/**
 * Play one quarter with a policy: answer events, set the plan, run the days.
 */
export function playQuarter(game, policy) {
  let guard = 0;
  while (game.currentEvent && guard < 10) {
    chooseEventOption(game, policy.choose(game, game.currentEvent.choices));
    guard += 1;
  }
  if (game.outcome) return null;
  applyPlan(game, policy);
  game.player.quarter.projectId = game.player.plan.project;
  if (policy.useFmla && policy.useFmla(game)) takeFmla(game);
  startRunning(game);
  while (game.phase === 'running') {
    if (game.currentEvent) {
      chooseEventOption(game, policy.choose(game, game.currentEvent.choices));
      continue;
    }
    const { notes } = runDay(game);
    // The screen greys and the game pauses on burnout; a player re-plans there.
    if (notes.some((note) => note.kind === 'burnout')) {
      applyPlan(game, policy);
      if (policy.useFmla && policy.useFmla(game)) takeFmla(game);
    }
  }
  return closeQuarter(game);
}

/**
 * Play a career to its end.
 *
 * Returns:
 *   a summary for balance tables
 */
// Balance is measured on the career, not on fate: crashes, fires and cancer are switched off, so a character's
// retirement rate does not hang on whether the dice took them in a car.
export function playCareer({ seed, characterId, industryId, policyName, tierLock = null, track = null, birthYear = undefined }) {
  const game = createGame({ seed, characterId, industryId, tierLock, misfortune: false, birthYear });
  game.botForceTrack = track;
  game.botRandom = (function makeBotRandom() {
    let state = seed * 7919 + 13;
    const next = () => {
      state = (state * 1103515245 + 12345) % 2147483648;
      return state / 2147483648;
    };
    return {
      next,
      between: (low, high) => low + (high - low) * next(),
      int: (low, high) => Math.floor(low + (high - low + 1) * next()),
      pick: (items) => items[Math.floor(next() * items.length)],
    };
  }());
  const policy = POLICIES[policyName];
  const stats = {
    ageAtLevel: [], burnoutQuarters: 0, burnouts: 0, pipCount: 0, lostJobs: 0, unemployedQuarters: 0, leapfrogs: 0, promotions: 0, hopUps: 0, hops: 0,
    levelAt40: null, firstPromotionAge: null, hoursSum: 0, workedQuarters: 0, topRatings: 0, ratedQuarters: 0,
    readinessGained: 0, readinessFromPolitics: 0, fireReadyAge: null, lowHealthQuarters: 0, lowMotivationQuarters: 0, divorced: false,
  };
  let wasBurnedOut = false;
  let guard = 0;
  while (!game.outcome && guard < 400) {
    const levelBefore = game.player.level;
    const orgBefore = game.org;
    const report = playQuarter(game, policy);
    guard += 1;
    if (!report) continue;
    if (game.player.burnout.active) stats.burnoutQuarters += 1;
    if (game.player.burnout.active && !wasBurnedOut) stats.burnouts += 1;
    wasBurnedOut = game.player.burnout.active;
    if (game.player.health < 50) stats.lowHealthQuarters += 1;
    if (game.player.motivation < 35) stats.lowMotivationQuarters += 1;
    if (report.rating && report.rating !== 'onLeave') {
      stats.ratedQuarters += 1;
      if (report.rating === 'greatlyExceeds' || report.rating === 'exceeds') stats.topRatings += 1;
      stats.hoursSum += report.hours ?? 0;
      stats.workedQuarters += 1;
      stats.readinessGained += report.readinessGain ?? 0;
      stats.readinessFromPolitics += report.readinessFromPolitics ?? 0;
    }
    if (stats.fireReadyAge === null && game.player.age >= FIRE.minimumAge && netWorth(game) >= fireNumber(game)) stats.fireReadyAge = game.player.age;
    if (report.pipStarted) stats.pipCount += 1;
    if (report.lostJob) stats.lostJobs += 1;
    if (report.unemployed) stats.unemployedQuarters += 1;
    if (report.leapfrogged) stats.leapfrogs += 1;
    for (let level = 1; level <= game.player.level; level += 1) stats.ageAtLevel[level] ??= game.player.age;
    if (game.org && orgBefore && game.org !== orgBefore) {
      stats.hops += 1;
      if (game.player.level > levelBefore) stats.hopUps += 1;
    }
    if (report.promoted) {
      stats.promotions += 1;
      if (stats.firstPromotionAge === null) stats.firstPromotionAge = game.player.age;
    }
    if (stats.levelAt40 === null && game.player.age >= 40) stats.levelAt40 = game.player.level;
  }
  stats.divorced = (game.journal ?? []).some((entry) => entry.kind === 'divorce');
  stats.lossReasons = {};
  for (const entry of game.journal ?? []) {
    if (entry.kind === 'lostJob') stats.lossReasons[entry.reason] = (stats.lossReasons[entry.reason] ?? 0) + 1;
    if (entry.kind === 'layoffSurvived') stats.lossReasons.survivedLayoff = (stats.lossReasons.survivedLayoff ?? 0) + 1;
    if (entry.kind === 'pip') stats.lossReasons.pip = (stats.lossReasons.pip ?? 0) + 1;
  }
  stats.track = game.player.track ?? null;
  return {
    outcome: game.outcome?.kind ?? 'unfinished',
    age: game.player.age,
    peakLevel: game.peakLevel,
    netWorth: netWorth(game),
    score: game.outcome?.score ?? 0,
    ...stats,
  };
}
