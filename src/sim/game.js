// A whole career: the turn structure, money, the job market and the end.
// One turn is a quarter of 60 workdays. The player sets a plan, the days
// tick for everyone at once, and the quarter closes with reviews,
// departures, promotions and pay.

import {
  TIME, MONEY, JOBS, HEALTH, MOTIVATION, READINESS, RELATIONSHIP, EVENTS as EVENT_DIALS,
  INDUSTRIES, INDUSTRY_STATS, CHARACTERS, ORG, PROJECTS,
} from '../config.js';
import { createRandom } from './random.js';
import {
  createAgent, stepDay, clamp, clampVitals, defaultPlan, payInBand, utilizationOf, RATING_LABELS,
  CORE, CITIZENSHIP, POLITICS, RECOVERY,
} from './agent.js';
import {
  createOrganization, hirePeer, choosePeerPlan, resolveProject, quarterPerformance, rateLevels,
  applyReviewRules, applyTenureReviews, rollDepartures, fillVacancies, decayUnusedReadiness,
  updateAlignment, runLayoffs, ageAgents, startQuarterFor, employedAgents, agentsAtLevel,
} from './org.js';
import { drawEvent, eventById, offerEvent } from './events.js';
import { COMPANY_NAMES as INDUSTRY_COMPANY_POOL } from './names.js';

export const MARKET_STATES = ['boom', 'normal', 'recession'];
const MARKET_TRANSITIONS = {
  normal: { recession: 0.04, boom: 0.05 },
  boom: { normal: 0.15 },
  recession: { normal: 0.2 },
};

/**
 * Start a career.
 *
 * Args:
 *   options: { seed, characterId, industryId, playerName }
 *
 * Returns:
 *   the game state, in the plan phase of the first quarter
 */
export function createGame({ seed = Date.now() % 1e9, characterId = 'marcus', industryId = 'tech', playerName = null } = {}) {
  const random = createRandom(seed);
  const character = CHARACTERS.find((entry) => entry.id === characterId) ?? CHARACTERS[0];
  const industry = INDUSTRIES[industryId] ?? INDUSTRIES.tech;
  const player = createAgent({
    name: playerName || character.name,
    isPlayer: true,
    mbti: character.mbti,
    iq: character.iq,
    pol: character.pol,
    traits: { ...character.traits },
    look: character.look,
    characterId: character.id,
    level: 0,
    salary: industry.salaries[0],
    health: 95,
    motivation: 75,
    relationship: 0,
    personality: { ambition: 0.7, selfPreservation: 0.5, loyaltyRisk: 0.3 },
  });
  player.plan = defaultPlan();
  const game = {
    seed,
    random,
    industry,
    character,
    quarterIndex: 0,
    day: 0,
    phase: 'plan',
    player,
    org: null,
    employment: { employed: true, unemployedQuarters: 0, benefitQuartersLeft: 0, lastTakeHome: 0, firedFor: null },
    savings: MONEY.startSavings,
    homeEquity: 0,
    dependents: 0,
    married: false,
    lifetimeEarnings: 0,
    yearIncome: 0,
    lastYearIncome: 0,
    market: 'normal',
    flags: { scheduled: [], outputModifier: 1, pivotQuarters: 0, minHours: 0, layoffAt: null, mentor: null, revealed: [] },
    eventQueue: [],
    currentEvent: null,
    log: [],
    history: [],
    outcome: null,
    peakLevel: 0,
    promotions: 0,
    lastReport: null,
    weekDeltas: { health: 0, motivation: 0 },
  };
  joinOrganization(game, createOrganization(random, industry), 0);
  beginQuarter(game);
  return game;
}

// ── Employment ─────────────────────────────────────────────────────────

/** Put the player into an organisation at a level, displacing one peer. */
export function joinOrganization(game, org, level) {
  const player = game.player;
  const seated = agentsAtLevel(org, level);
  if (seated.length > 0) {
    const displaced = game.random.pick(seated);
    org.agents = org.agents.filter((agent) => agent !== displaced);
  }
  player.level = level;
  player.quartersAtLevel = 0;
  player.departed = null;
  player.pip = { active: false, quarters: 0 };
  player.teamId = game.random.int(0, 8);
  player.tenured = Boolean(game.industry.tenureFromLevel !== null && level >= game.industry.tenureFromLevel);
  player.salary = payInBand(game.industry, level, player.salary);
  for (const peer of org.agents) peer.relationship = Math.round(game.random.normal(0, 10));
  org.agents.push(player);
  game.org = org;
  game.employment.employed = true;
  game.employment.unemployedQuarters = 0;
  game.flags.revealed = [];
  player.informants = 0;
  pickManager(game);
}

function pickManager(game) {
  const org = game.org;
  const above = agentsAtLevel(org, game.player.level + 1);
  const sameTeam = above.filter((agent) => agent.teamId === game.player.teamId);
  const manager = sameTeam[0] ?? above[0] ?? null;
  org.managerId = manager ? manager.id : null;
}

export function managerOf(game) {
  if (!game.org) return null;
  return game.org.agents.find((agent) => agent.id === game.org.managerId && !agent.departed) ?? null;
}

function loseJob(game, reason) {
  const player = game.player;
  const employment = game.employment;
  player.departed = reason;
  game.org.agents = game.org.agents.filter((agent) => agent !== player);
  game.lastOrg = game.org;
  game.org = null;
  employment.employed = false;
  employment.unemployedQuarters = 0;
  employment.firedFor = reason;
  employment.benefitQuartersLeft = reason === 'quit' ? 0 : MONEY.benefitQuarters;
  employment.lastLevel = player.level;
  player.pip = { active: false, quarters: 0 };
  player.readiness *= 0.5;
  if (reason === 'laid off' || reason === 'counselled out') {
    const severance = player.salary / 4 * MONEY.severanceQuarters;
    game.savings += severance;
    log(game, `Severance: ${formatMoney(severance)}.`);
  }
  const hit = reason === 'laid off' ? MOTIVATION.laidOffHit : reason === 'quit' ? 0 : MOTIVATION.firedHit;
  player.motivation -= hit;
}

/** The player resigns. Without an offer in hand this starts unemployment. */
export function quitJob(game) {
  if (!game.employment.employed) return;
  log(game, 'You resign. The badge stops working on Monday.');
  loseJob(game, 'quit');
}

/** Take a job at a new company. */
export function acceptOffer(game, offer) {
  if (game.org) {
    game.org.agents = game.org.agents.filter((agent) => agent !== game.player);
  }
  const org = createOrganization(game.random, game.industry);
  org.companyName = offer.company;
  game.player.salary = offer.salary;
  game.player.readiness *= 0.3;
  game.player.alignment = 1;
  joinOrganization(game, org, offer.level);
  log(game, `You start at ${offer.company} as ${titleOf(game, offer.level)}.`);
}

export function titleOf(game, level) {
  return game.industry.titles[clamp(level, 0, game.industry.titles.length - 1)];
}

// ── Turn structure ─────────────────────────────────────────────────────

/** Open a quarter: peers plan, events are drawn, accumulators reset. */
export function beginQuarter(game) {
  if (game.outcome) return;
  game.phase = 'plan';
  game.day = 0;
  const random = game.random;
  const player = game.player;
  startQuarterFor(player);
  if (game.org) {
    const pressure = game.flags.layoffAt !== null ? 0.3 : 0;
    for (const agent of employedAgents(game.org)) {
      if (agent === player) continue;
      startQuarterFor(agent);
      choosePeerPlan(agent, game.industry, random, pressure);
      agent.quarter.projectId = agent.plan.project;
    }
  }
  const due = game.flags.scheduled.filter((entry) => entry.quarter <= game.quarterIndex);
  game.flags.scheduled = game.flags.scheduled.filter((entry) => entry.quarter > game.quarterIndex);
  for (const entry of due) {
    const event = eventById(entry.id);
    if (event && (!event.eligible || event.eligible(game, entry.data))) game.eventQueue.push({ event, data: entry.data });
  }
  if (game.pendingOffer) {
    game.eventQueue.push({ event: offerEvent(), data: game.pendingOffer });
    game.pendingOffer = null;
  }
  // The first quarter is quiet: a new hire gets to find their desk first.
  if (game.quarterIndex > 0 && random.chance(EVENT_DIALS.chancePerQuarter)) {
    const drawn = drawEvent(game, random);
    if (drawn) {
      const data = drawn.onDraw ? drawn.onDraw(game, random) ?? {} : {};
      game.eventQueue.push({ event: drawn, data });
    }
  }
  nextEvent(game);
}

function nextEvent(game) {
  game.currentEvent = game.eventQueue.shift() ?? null;
  prepareCurrentEvent(game);
}

/** Work out the current event's text and the choices open right now. */
export function prepareCurrentEvent(game) {
  if (game.currentEvent) {
    const { event, data } = game.currentEvent;
    game.currentEvent.text = typeof event.text === 'function' ? event.text(game, data) : event.text;
    game.currentEvent.choices = (typeof event.choices === 'function' ? event.choices(game, data) : event.choices)
      .filter((choice) => !choice.available || choice.available(game, data));
  }
}

/**
 * Answer the current event.
 *
 * Returns:
 *   the result text of the chosen option
 */
export function chooseEventOption(game, choiceIndex) {
  const current = game.currentEvent;
  if (!current) return null;
  const choice = current.choices[clamp(choiceIndex, 0, current.choices.length - 1)];
  const result = choice.apply ? choice.apply(game, current.data, game.random) : null;
  if (result) log(game, result);
  clampVitals(game.player);
  game.lastEventResult = { title: current.event.title, choice: choice.label, result };
  nextEvent(game);
  return result;
}

/** Change any part of the player's plan; bandwidth shares are renormalised. */
export function setPlan(game, changes) {
  const plan = game.player.plan;
  Object.assign(plan, changes);
  if (game.flags.lockedProject) plan.project = game.flags.lockedProject;
  if (changes.shares) plan.shares = normaliseShares(changes.shares);
  // An event can hold the hours up, but never against burnout: resting has
  // to stay possible, or burnout would be a sentence rather than a warning.
  const floor = game.player.burnout.active ? 6 : Math.max(6, game.flags.minHours || 0);
  plan.hours = clamp(plan.hours, floor, 16);
  if (changes.project && game.phase === 'plan') game.player.quarter.projectId = changes.project;
}

export function normaliseShares(shares) {
  const cleaned = shares.map((share) => Math.max(0, share));
  const total = cleaned.reduce((sum, share) => sum + share, 0);
  if (total <= 0) return [0.25, 0.25, 0.25, 0.25];
  return cleaned.map((share) => share / total);
}

/**
 * Move one bandwidth bucket to a new share and spread the difference over
 * the other three in proportion, so the four always add to 100%.
 */
export function rebalanceShares(shares, index, newShare) {
  const target = clamp(newShare, 0, 1);
  const others = shares.reduce((sum, share, position) => (position === index ? sum : sum + share), 0);
  const result = shares.slice();
  result[index] = target;
  const remaining = 1 - target;
  for (let position = 0; position < result.length; position += 1) {
    if (position === index) continue;
    result[position] = others > 0 ? shares[position] / others * remaining : remaining / (shares.length - 1);
  }
  return result;
}

export function startRunning(game) {
  if (game.currentEvent || game.outcome) return false;
  game.phase = 'running';
  return true;
}

/**
 * Advance every worker by one day.
 *
 * Returns:
 *   notes for the player from today, and whether the quarter is over
 */
export function runDay(game) {
  if (game.phase !== 'running') return { notes: [], quarterOver: false };
  const random = game.random;
  const employed = game.employment.employed;
  const player = game.player;
  const healthBefore = player.health;
  const motivationBefore = player.motivation;
  const context = {
    industry: game.industry,
    random,
    employed,
    outputModifier: game.flags.outputModifier,
    moodModifier: game.flags.moodModifier ?? 0,
  };
  const notes = stepDay(player, context);
  if (game.org) {
    const peerContext = { industry: game.industry, random, employed: true, outputModifier: 1 };
    for (const agent of employedAgents(game.org)) {
      if (agent !== player) stepDay(agent, peerContext);
    }
  }
  game.day += 1;
  trackWeek(game, player.health - healthBefore, player.motivation - motivationBefore);
  if (player.health <= 0) endGame(game, 'death');
  else if (player.motivation <= 0) endGame(game, 'breakdown');
  const quarterOver = game.day >= TIME.daysPerQuarter || Boolean(game.outcome);
  if (quarterOver && !game.outcome) game.phase = 'review';
  return { notes, quarterOver };
}

function trackWeek(game, healthChange, motivationChange) {
  const week = game.weekDeltas;
  week.health = week.health * 0.8 + healthChange * 5 * 0.2;
  week.motivation = week.motivation * 0.8 + motivationChange * 5 * 0.2;
}

/** Run the rest of the quarter without stopping. */
export function finishQuarterDays(game) {
  if (game.phase === 'plan') startRunning(game);
  while (game.phase === 'running') runDay(game);
}

// ── Quarter close ──────────────────────────────────────────────────────

/**
 * Close the quarter: reviews, departures, promotions, pay, the end checks.
 *
 * Returns:
 *   a report of what happened to the player
 */
export function closeQuarter(game) {
  if (game.phase !== 'review' && !game.outcome) return null;
  const random = game.random;
  const player = game.player;
  const report = {
    quarterIndex: game.quarterIndex,
    year: Math.floor(game.quarterIndex / 4) + 1,
    quarterOfYear: (game.quarterIndex % 4) + 1,
    notes: [],
    promoted: false,
    rating: null,
    project: null,
  };
  if (game.outcome) {
    game.lastReport = report;
    return report;
  }

  if (game.employment.employed) closeEmployedQuarter(game, report);
  else closeUnemployedQuarter(game, report);

  payQuarter(game, report);
  if (!game.employment.employed) ageOutsideOrganization(player);
  rollHealthScare(game, report);
  advanceMarket(game, report);
  if (game.flags.pivotQuarters > 0) {
    game.flags.pivotQuarters -= 1;
    if (game.flags.pivotQuarters === 0) game.flags.outputModifier = 1;
  }
  game.flags.minHoursQuarters = Math.max(0, (game.flags.minHoursQuarters ?? 0) - 1);
  if (game.flags.minHoursQuarters === 0) game.flags.minHours = 0;
  game.flags.moodModifier = 0;
  game.flags.lockedProject = null;

  clampVitals(player);
  game.peakLevel = Math.max(game.peakLevel, player.level);
  checkOutcome(game, report);
  snapshot(game, report);
  game.lastReport = report;
  game.quarterIndex += 1;
  if (!game.outcome) beginQuarter(game);
  else game.phase = 'over';
  return report;
}

function closeEmployedQuarter(game, report) {
  const random = game.random;
  const player = game.player;
  const org = game.org;
  const industry = game.industry;

  peerSocialActions(game, report);
  for (const agent of employedAgents(org)) {
    const projectResult = resolveProject(agent, industry, random);
    closeIndustryQuarter(game, agent, agent === player ? report : null);
    if (agent === player) {
      report.project = projectResult ? { name: projectResult.project.name, success: projectResult.success, progress: player.quarter.projectProgress } : null;
      applyManagementStyle(game, report);
    }
    quarterPerformance(agent, random, industry);
  }
  rateLevels(org, industry.seats.length);
  report.rating = player.quarter.rating;
  report.performance = player.quarter.performance;
  report.rank = player.quarter.rank;
  report.poolSize = player.quarter.poolSize;
  report.median = player.quarter.median;

  applyReviewRules(org, industry);
  const tenureResults = applyTenureReviews(org, industry, INDUSTRY_STATS.citations.tenureCitationBar);
  for (const entry of tenureResults) {
    if (entry.agent === player) {
      report.notes.push(entry.granted ? 'Tenure granted. Nobody can PIP you now.' : 'Tenure denied. You have a year to find somewhere else... starting now.');
      if (entry.granted) {
        report.promoted = true;
        game.promotions += 1;
      }
    }
  }
  report.pipStarted = Boolean(player.quarter.pipStarted);
  if (player.quarter.pipStarted) report.notes.push('You are on a Performance Improvement Plan. One quarter to climb out of the bottom bracket.');
  if (player.quarter.pipCleared) report.notes.push('PIP cleared. Breathe.');

  if (game.flags.layoffAt !== null && game.flags.layoffAt <= game.quarterIndex) {
    const share = game.market === 'recession' ? 0.18 : 0.12;
    const cut = runLayoffs(org, industry, share, random);
    game.flags.layoffAt = null;
    report.layoffs = cut.length;
    report.notes.push(`Layoffs: ${cut.length} people in the division are cut.`);
    report.stinger = 'layoff';
  }

  if (player.quarter.terminated) {
    const reason = player.quarter.terminated;
    const messages = {
      fired: 'The PIP ends the way PIPs do. You are let go.',
      'laid off': 'Your name is on the list. You are laid off.',
      'counselled out': 'Up or out: you have been at this level too long, and you are counselled out.',
      'contract ended': 'Your postdoc contract ends with no renewal.',
      'denied tenure': 'Your terminal year is over.',
    };
    report.notes.push(messages[reason] ?? 'You lose your job.');
    report.lostJob = reason;
    loseJob(game, reason);
  }

  const departures = rollDepartures(org, random, game.market, player.id);
  report.departures = departures.length;
  const managerBefore = org.managerId;

  const readinessBefore = player.readiness;
  const levelBefore = player.level;
  const promotions = fillVacancies(org, industry, random, { playerId: game.employment.employed ? player.id : null });
  for (const promotion of promotions) {
    if (promotion.agent === player) {
      report.promoted = true;
      game.promotions += 1;
      report.notes.push(`Promoted to ${titleOf(game, player.level)}.`);
      report.chime = true;
      for (const passed of promotion.passedOver) passed.relationship -= RELATIONSHIP.leapfrogLoss;
      pickManager(game);
    } else if (game.employment.employed && !report.leapfrogged && !report.promoted
      && promotion.level === levelBefore + 1 && readinessBefore >= READINESS.threshold) {
      // A leapfrog is someone junior to you jumping past: less time at your
      // level than you. It stings once a quarter, however many chairs went.
      // Losing a chair to a senior colleague or an outside hire is only news.
      const jumper = promotion.agent;
      if (jumper && promotion.quartersAtFormerLevel < player.quartersAtLevel) {
        player.motivation -= MOTIVATION.leapfrogHit;
        report.notes.push(`Leapfrogged: ${jumper.name}, junior to you, takes the ${titleOf(game, promotion.level)} chair you were ready for.`);
        report.leapfrogged = true;
      } else if (!report.passedOver) {
        report.notes.push(`${jumper ? jumper.name : 'An outside hire'} takes the ${titleOf(game, promotion.level)} chair. You were in the running.`);
        report.passedOver = true;
      }
    }
  }
  decayUnusedReadiness(org);
  if (game.employment.employed && (!managerOf(game) || managerBefore !== org.managerId)) {
    pickManager(game);
    if (managerOf(game) && managerBefore && managerBefore !== org.managerId && !report.promoted) {
      report.notes.push(`New manager: ${managerOf(game).name}.`);
      player.alignment = 0.5 * player.alignment + 0.5;
    }
  }
  for (const agent of employedAgents(org)) updateAlignment(agent, agent === player ? managerOf(game) : null);
  updateRelationships(game);
  ageAgents(org);
  if (game.employment.employed) rollHeadhunter(game, report);
}

// The org ages its own workers; out of work the player ages alone.
function ageOutsideOrganization(player) {
  player.age += 0.25;
  if (player.burnout.active) {
    player.burnout.quarters += 1;
    if (player.burnout.quarters >= MOTIVATION.burnoutMinQuarters && player.motivation >= MOTIVATION.burnoutExitLine) {
      player.burnout.active = false;
    }
  }
}

function closeUnemployedQuarter(game, report) {
  const random = game.random;
  const player = game.player;
  const employment = game.employment;
  employment.unemployedQuarters += 1;
  report.unemployed = true;
  const ratingBoost = { greatlyExceeds: 0.15, exceeds: 0.1, meetAll: 0.05, meetMost: 0, meetSome: -0.1 }[player.lastRating] ?? 0;
  const marketFactor = game.market === 'boom' ? 1.3 : game.market === 'recession' ? 0.6 : 1;
  const agePenalty = Math.max(0, player.age - JOBS.searchAgePenaltyFrom) * 0.02;
  const chance = clamp((JOBS.searchBase + JOBS.searchOpen * player.plan.openness + ratingBoost
    - JOBS.searchStigmaPerQuarter * (employment.unemployedQuarters - 1) - agePenalty) * marketFactor, 0.03, 0.95);
  report.searchChance = chance;
  if (random.chance(chance)) {
    const demote = employment.unemployedQuarters >= JOBS.reentryDemoteAfterQuarters || employment.firedFor === 'fired' ? 1 : 0;
    const level = clamp((employment.lastLevel ?? player.level) - demote, 0, game.industry.seats.length - 2);
    game.pendingOffer = makeOffer(game, level, 0.95, 'search');
    report.notes.push('A company calls back with an offer.');
  } else {
    report.notes.push(`Another quarter of applications, and nothing. (${Math.round(chance * 100)}% chance this quarter)`);
  }
}

export function makeOffer(game, level, payFactor, source) {
  const random = game.random;
  const industry = game.industry;
  const companies = INDUSTRY_COMPANY_POOL[industry.id];
  const current = game.org ? game.org.companyName : null;
  const company = random.pick(companies.filter((name) => name !== current));
  const salary = Math.round(payInBand(industry, level, game.player.salary * payFactor) / 1000) * 1000;
  return { company, level, salary, source };
}

function rollHeadhunter(game, report) {
  const player = game.player;
  const marketFactor = game.market === 'boom' ? 1.4 : game.market === 'recession' ? 0.5 : 1;
  const standing = { greatlyExceeds: 1.5, exceeds: 1.3, meetAll: 1, meetMost: 0.8, meetSome: 0.3 }[player.lastRating] ?? 1;
  const chance = (JOBS.headhunterBase + JOBS.headhunterOpen * player.plan.openness) * marketFactor * standing;
  if (!game.random.chance(chance)) return;
  const topLevel = game.industry.seats.length - 1;
  // Recruiters sell a step up only to the nearly-ready, and rarely past
  // middle management: executive searches look for executives.
  const bump = player.readiness >= 80 && player.level <= 3 && player.level < topLevel - 1 && game.random.chance(0.35);
  const level = player.level + (bump ? 1 : 0);
  game.pendingOffer = makeOffer(game, level, bump ? 1.1 : game.random.between(1.12, 1.3), 'headhunter');
  report.notes.push('A recruiter has been leaving voicemails.');
}

function peerSocialActions(game, report) {
  const player = game.player;
  const org = game.org;
  for (const peer of employedAgents(org)) {
    if (peer === player || Math.abs(peer.level - player.level) > 1) continue;
    const competing = peer.level === player.level && peer.readiness > 60 && player.readiness > 60;
    // ActionUtility = w1·Ambition + w2·SelfPreservation − w3·LoyaltyRisk + RelationshipModifier,
    // read for the act of undermining the player.
    const sabotageUtility = 0.9 * peer.personality.ambition * (competing ? 1 : 0.3)
      - 0.6 * peer.personality.selfPreservation
      - 0.3 * (1 - peer.personality.loyaltyRisk)
      - peer.relationship / 50;
    if (peer.relationship <= RELATIONSHIP.hostileLine && sabotageUtility > 0.5 && game.random.chance(0.5)) {
      player.quarter.performanceMultiplier = (player.quarter.performanceMultiplier ?? 1) * (1 - RELATIONSHIP.sabotageHit);
      player.alignment -= 0.04;
      report.notes.push(`${peer.name} undercuts you in calibration.`);
      peer.relationship -= 5;
    } else if (peer.relationship >= RELATIONSHIP.loyalLine && peer.level > player.level && player.readiness >= 70 && game.random.chance(0.4)) {
      player.readiness += 6;
      report.notes.push(`${peer.name} puts in a good word for you.`);
    }
  }
}

function updateRelationships(game) {
  const player = game.player;
  if (!game.org || !game.employment.employed) return;
  const shares = player.plan.shares;
  const bonus = player.traits.relationshipBonus ?? 1;
  const effort = player.plan.hours / 8;
  for (const peer of employedAgents(game.org)) {
    if (peer === player) continue;
    let change = -peer.relationship * 0.05;
    if (player.plan.citizenshipFocus === 'mentor' && peer.level < player.level) change += RELATIONSHIP.mentoringGain * shares[CITIZENSHIP] * 10 * effort;
    if (player.plan.citizenshipFocus === 'help' && peer.level === player.level) change += RELATIONSHIP.helpingGain * shares[CITIZENSHIP] * 10 * effort;
    if (player.plan.politicsFocus === 'peers' && Math.abs(peer.level - player.level) <= 1) change += RELATIONSHIP.networkingGain * shares[POLITICS] * 10 * effort;
    if (player.plan.politicsFocus === 'upward' && peer.id === game.org.managerId) change += RELATIONSHIP.networkingGain * shares[POLITICS] * 20 * effort;
    if (player.level >= ORG.managementFromLevel && peer.level < player.level) change += (0.5 - player.plan.managementStyle) * 4;
    peer.relationship = clamp(peer.relationship + change * bonus, -100, 100);
  }
  if (player.plan.politicsFocus === 'crossTeam') {
    player.informants += shares[POLITICS] * 2.2 * effort * bonus;
  }
}

function applyManagementStyle(game, report) {
  const player = game.player;
  if (player.level < ORG.managementFromLevel) return;
  const style = player.plan.managementStyle;
  // Demanding leaders get more out of a team for a while, and pay for it in
  // churn; supportive ones are recognised as people leaders.
  player.quarter.performanceMultiplier = (player.quarter.performanceMultiplier ?? 1) * (1 + 0.15 * (style - 0.5));
  player.readiness += 6 * (0.5 - style);
  for (const peer of employedAgents(game.org)) {
    if (peer.level < player.level && peer.teamId === player.teamId) peer.motivation -= 6 * (style - 0.5);
  }
  report.teamHappiness = teamHappiness(game);
}

export function teamHappiness(game) {
  if (!game.org) return null;
  const team = employedAgents(game.org).filter((agent) => agent.level < game.player.level && agent.teamId === game.player.teamId);
  if (team.length === 0) return null;
  return team.reduce((sum, agent) => sum + agent.motivation, 0) / team.length;
}

function closeIndustryQuarter(game, agent, report) {
  const industry = game.industry;
  const state = agent.industry;
  const random = game.random;
  const quarter = agent.quarter;
  if (industry.subStat === 'techDebt') {
    if (quarter.projectId === 'refactor' && quarter.projectSuccess) state.techDebt = Math.max(0, state.techDebt - INDUSTRY_STATS.techDebt.refactorPaydown);
    if (report && quarter.incidents > 0) report.notes.push(`${quarter.incidents} pager incident${quarter.incidents > 1 ? 's' : ''} this quarter (tech debt ${Math.round(state.techDebt)}).`);
  } else if (industry.subStat === 'utilization') {
    const dials = INDUSTRY_STATS.utilization;
    state.utilization = state.utilizationSum / Math.max(1, quarter.days);
    state.utilizationSum = 0;
    const inSweetSpot = state.utilization >= dials.sweetSpotLow && state.utilization <= dials.sweetSpotHigh;
    state.clientScore += inSweetSpot ? 8 : state.utilization < dials.sweetSpotLow ? -12 : 2;
    state.clientScore = clamp(state.clientScore, 0, 100);
    if (state.clientScore < 40) {
      quarter.performanceMultiplier = (quarter.performanceMultiplier ?? 1) * (1 - dials.failedClientPenalty);
      if (report) report.notes.push('The client scores you poorly. It shows in your review.');
    }
  } else if (industry.subStat === 'dealFlow') {
    const dials = INDUSTRY_STATS.dealFlow;
    if (quarter.projectId === 'deck' && quarter.projectSuccess) state.dealFlow = Math.min(100, state.dealFlow + dials.pitchDeckBoost);
    const canClose = game.org && dryPowder(game) > 10;
    if (canClose && random.chance(state.dealFlow / 100)) {
      quarter.performanceBonus = (quarter.performanceBonus ?? 0) + dials.dealPerformance;
      state.dealFlow = Math.max(0, state.dealFlow - 60);
      if (agent.isPlayer) {
        game.fundDryPowder = Math.max(0, dryPowder(game) - 20);
        const carry = agent.level >= 3 ? agent.salary * dials.dealCarry : 0;
        game.savings += carry * 0.7;
        game.lifetimeEarnings += carry;
        if (report) report.notes.push(`A deal closes.${carry ? ` Carry: ${formatMoney(carry)}.` : ''}`);
      }
    }
  } else if (industry.subStat === 'citations') {
    const dials = INDUSTRY_STATS.citations;
    state.paperAges += state.papers;
    state.citations += dials.citationsPerPaperPerQuarter * state.papers;
    quarter.performanceBonus = (quarter.performanceBonus ?? 0) + 8 * quarter.papers;
    if (quarter.projectId === 'grant' && quarter.projectSuccess) {
      if (random.chance(dials.grantChancePerProposal * agent.pol / 100 + 0.1)) {
        state.grants += 1;
        state.grantQuarters = 8;
        agent.readiness += 10;
        if (report) report.notes.push('Grant funded: two years of extra hands in the lab.');
      } else if (report) {
        report.notes.push('The grant panel passes on your proposal.');
      }
    }
    if (report && quarter.papers > 0) report.notes.push(`${quarter.papers} paper${quarter.papers > 1 ? 's' : ''} published.`);
  }
}

export function dryPowder(game) {
  if (game.fundDryPowder === undefined) game.fundDryPowder = 100;
  return game.fundDryPowder;
}

// ── Money ──────────────────────────────────────────────────────────────

export function taxRate(salary) {
  return MONEY.taxBase + MONEY.taxRise * Math.min(1, salary / MONEY.taxRiseSalary);
}

export function quarterlyExpenses(game) {
  const employment = game.employment;
  const takeHome = employment.employed
    ? game.player.salary * (1 - taxRate(game.player.salary))
    : employment.lastTakeHome;
  const share = employment.employed ? MONEY.lifestyleShare : MONEY.unemployedLifestyleShare;
  const lifestyle = MONEY.livingFloor + share * Math.max(0, takeHome - MONEY.livingFloor);
  const family = game.dependents * 14000 + (game.married ? 6000 : 0);
  const mortgage = game.homeEquity > 0 ? 9000 : 0;
  return (lifestyle + family + mortgage) / 4;
}

function payQuarter(game, report) {
  const player = game.player;
  const employment = game.employment;
  let income = 0;
  let takeHome = 0;
  if (employment.employed) {
    income = player.salary / 4;
    takeHome = income * (1 - taxRate(player.salary));
    employment.lastTakeHome = player.salary * (1 - taxRate(player.salary));
    if (game.quarterIndex % 4 === 3) {
      const ratingFactor = { greatlyExceeds: 1.5, exceeds: 1.2, meetAll: 1, meetMost: 0.8, meetSome: 0, onLeave: 0.5 }[player.lastRating] ?? 1;
      const bonus = player.salary * (game.industry.bonusShare[player.level] ?? 0) * ratingFactor;
      if (bonus > 0) {
        income += bonus;
        takeHome += bonus * (1 - taxRate(player.salary + bonus));
        report.notes.push(`Year-end bonus: ${formatMoney(bonus)}.`);
      }
      const raise = MONEY.meritRaise[player.lastRating] ?? 0;
      if (raise > 0 && !report.promoted) player.salary = payInBand(game.industry, player.level, player.salary * (1 + raise));
    }
  } else if (employment.benefitQuartersLeft > 0) {
    takeHome = MONEY.unemploymentBenefitPerQuarter;
    employment.benefitQuartersLeft -= 1;
  }
  const expenses = quarterlyExpenses(game);
  const rate = MONEY.returns[game.market] / 4;
  const returns = game.savings > 0 ? game.savings * rate : game.savings * 0.02;
  game.homeEquity *= 1.0075;
  game.savings += takeHome - expenses + returns;
  game.lifetimeEarnings += income;
  game.yearIncome += income;
  if (game.quarterIndex % 4 === 3) {
    game.lastYearIncome = game.yearIncome;
    game.yearIncome = 0;
  }
  report.income = income;
  report.expenses = expenses;
  report.returns = returns;
  if (!employment.employed && game.savings <= 0 && game.homeEquity > 0) {
    game.savings += game.homeEquity * 0.9;
    game.homeEquity = 0;
    report.notes.push('You sell the house to keep afloat.');
  }
}

export function netWorth(game) {
  return game.savings + game.homeEquity;
}

export function formatMoney(amount) {
  const sign = amount < 0 ? '−' : '';
  const value = Math.abs(amount);
  if (value >= 1e6) return `${sign}$${(value / 1e6).toFixed(value >= 1e7 ? 1 : 2)}M`;
  if (value >= 1e3) return `${sign}$${Math.round(value / 1e3)}k`;
  return `${sign}$${Math.round(value)}`;
}

// ── Health, market, the end ────────────────────────────────────────────

function rollHealthScare(game, report) {
  const player = game.player;
  if (player.health < HEALTH.dangerLine && game.random.chance(HEALTH.scareChancePerQuarter)) {
    player.health -= HEALTH.scareDamage;
    report.notes.push('Chest pains on the train home. A night in the ER.');
    report.healthScare = true;
  }
}

function advanceMarket(game, report) {
  const transitions = MARKET_TRANSITIONS[game.market];
  for (const [next, chance] of Object.entries(transitions)) {
    if (game.random.chance(chance)) {
      game.market = next;
      report.notes.push({ recession: 'The economy tips into recession.', boom: 'The market is booming.', normal: 'The market settles.' }[next]);
      break;
    }
  }
}

function checkOutcome(game, report) {
  const player = game.player;
  if (game.outcome) return;
  if (player.health <= 0) endGame(game, 'death');
  else if (player.motivation <= 0) endGame(game, 'breakdown');
  else if (!game.employment.employed && game.savings <= 0) endGame(game, 'homeless');
  else if (player.age >= TIME.retirementAge) endGame(game, 'retired');
}

export function endGame(game, kind) {
  if (game.outcome) return;
  const player = game.player;
  game.outcome = {
    kind,
    age: player.age,
    level: player.level,
    peakLevel: Math.max(game.peakLevel, player.level),
    title: titleOf(game, Math.max(game.peakLevel, player.level)),
    netWorth: netWorth(game),
    lifetimeEarnings: game.lifetimeEarnings,
    quarters: game.quarterIndex + 1,
    score: careerScore(game),
  };
  game.phase = 'over';
}

/**
 * Prestige from the highest chair reached plus wealth, for the final screen.
 * Wealth counts by its order of magnitude, so a private equity fortune
 * does not drown out the title: $50k is 0, $500k is 2,000, $5M is 4,000.
 */
export function careerScore(game) {
  const peak = Math.max(game.peakLevel, game.player.level);
  const prestige = (peak + 1) * 1000;
  const wealth = 2000 * Math.log10(Math.max(1, netWorth(game) / 50000));
  return Math.round(prestige + wealth);
}

function snapshot(game, report) {
  const player = game.player;
  game.history.push({
    quarter: game.quarterIndex,
    age: player.age,
    health: player.health,
    motivation: player.motivation,
    level: player.level,
    netWorth: netWorth(game),
    rating: report.rating,
    employed: game.employment.employed,
    burnout: player.burnout.active,
    readiness: player.readiness,
  });
}

export function log(game, text) {
  game.log.push({ quarter: game.quarterIndex, text });
  if (game.log.length > 200) game.log.shift();
}

export { RATING_LABELS, utilizationOf };
