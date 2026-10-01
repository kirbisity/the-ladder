// Players that play whole careers headlessly, so balance is measured rather
// than guessed. Each policy reads only what the HUD shows a human: health,
// motivation, readiness, rating, PIP, burnout, the industry meter.

import { createGame, setPlan, chooseEventOption, startRunning, runDay, closeQuarter, netWorth, takeFmla, fmlaStatus } from './game.js';
import { clamp, projectFor, projectsOpenTo } from './agent.js';
import { READINESS } from '../config.js';

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

/** A thoughtful human: rests when the bars say so, pushes when they allow. */
function adaptivePlan(game) {
  const player = game.player;
  const base = { citizenshipFocus: 'help', politicsFocus: 'upward', managementStyle: 0.4 };
  if (!game.employment.employed) {
    return { ...base, hours: 8, shares: [0.4, 0.1, 0.1, 0.4], openness: 1, project: 'safe' };
  }
  const openness = game.flags.layoffAt !== null ? 0.8 : 0.25;
  if (player.burnout.active) {
    return { ...base, hours: 8, shares: [0.3, 0.1, 0.05, 0.55], openness, project: 'safe' };
  }
  if (player.health < 50 || player.motivation < 35) {
    return { ...base, hours: 8, shares: [0.45, 0.1, 0.1, 0.35], openness, project: 'safe' };
  }
  if (player.pip.active) {
    return { ...base, hours: 10.5, shares: [0.75, 0.05, 0.1, 0.1], openness: 0.6, project: 'safe' };
  }
  const strong = player.health > 75 && player.motivation > 55;
  const hours = strong ? 10 : 9;
  const needReadiness = player.readiness < READINESS.threshold;
  let shares = needReadiness ? [0.5, 0.15, 0.2, 0.15] : [0.6, 0.1, 0.15, 0.15];
  if (game.industry.subStat === 'utilization') {
    const core = clamp(0.9 * 8 / hours, 0.4, 0.8);
    shares = [core, (1 - core) * 0.3, (1 - core) * 0.4, (1 - core) * 0.3];
  }
  const canMoonshot = player.level >= 3 || player.traits.moonshotUnlocked;
  const ahead = ['greatlyExceeds', 'exceeds'].includes(player.lastRating);
  const project = industryProject(game, canMoonshot && strong && ahead ? 'risky' : 'visible');
  return { ...base, hours, shares, openness, project };
}

function adaptiveChoose(game, choices) {
  const player = game.player;
  if (game.currentEvent?.event.id === 'jobOffer') {
    const offer = game.currentEvent.data;
    const accept = !game.employment.employed || offer.level > player.level
      || (offer.salary > player.salary * 1.2 && player.quartersAtLevel > 12) || player.pip.active;
    return accept ? 0 : choices.length - 1;
  }
  const order = player.health < 55 || player.motivation < 40 || player.burnout.active
    ? ['rest', 'safe', 'kind', 'ambitious']
    : ['ambitious', 'safe', 'kind', 'rest'];
  return preferTags(order)(game, choices);
}

export const POLICIES = {
  grinder: fixed({ hours: 14, shares: [0.75, 0.05, 0.15, 0.05], openness: 0.2, project: 'visible', politicsFocus: 'upward' }, ['ambitious', 'bold', 'safe'], { heedsBurnout: false }),
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
export function playCareer({ seed, characterId, industryId, policyName }) {
  const game = createGame({ seed, characterId, industryId });
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
  const stats = { ageAtLevel: [], burnoutQuarters: 0, pipCount: 0, lostJobs: 0, unemployedQuarters: 0, leapfrogs: 0, promotions: 0, levelAt40: null, firstPromotionAge: null };
  let guard = 0;
  while (!game.outcome && guard < 400) {
    const report = playQuarter(game, policy);
    guard += 1;
    if (!report) continue;
    if (game.player.burnout.active) stats.burnoutQuarters += 1;
    if (report.pipStarted) stats.pipCount += 1;
    if (report.lostJob) stats.lostJobs += 1;
    if (report.unemployed) stats.unemployedQuarters += 1;
    if (report.leapfrogged) stats.leapfrogs += 1;
    for (let level = 1; level <= game.player.level; level += 1) stats.ageAtLevel[level] ??= game.player.age;
    if (report.promoted) {
      stats.promotions += 1;
      if (stats.firstPromotionAge === null) stats.firstPromotionAge = game.player.age;
    }
    if (stats.levelAt40 === null && game.player.age >= 40) stats.levelAt40 = game.player.level;
  }
  return {
    outcome: game.outcome?.kind ?? 'unfinished',
    age: game.player.age,
    peakLevel: game.peakLevel,
    netWorth: netWorth(game),
    score: game.outcome?.score ?? 0,
    ...stats,
  };
}
