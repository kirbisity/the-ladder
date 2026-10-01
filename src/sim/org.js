// The player's division: a pyramid of seats filled by simulated workers who
// compete, quit, get promoted, PIP'd and laid off by the same rules as the
// player. The rest of the company is summarised, not simulated.

import { TIME, PERFORMANCE, READINESS, ORG, PEERS, SKILL, RELATIONSHIP, PROJECTS, MOTIVATION } from '../config.js';
import {
  createAgent, freshQuarter, clamp, clampVitals, onBurnoutLeave, payInBand, effectiveHours, strainOf, projectSpec, projectsOpenTo, stagnationYears,
  CORE, CITIZENSHIP, POLITICS, RECOVERY, RATINGS,
} from './agent.js';
import { FIRST_NAMES, LAST_NAMES, COMPANY_NAMES, DIVISION_NAMES, TEAM_NAMES } from './names.js';

export const TEAM_COUNT = 9;

// The plans a peer weighs each quarter. Hours are relative to the
// industry's typical day, so private equity peers grind and academics do not.
export const PEER_PLANS = [
  { id: 'coast', hoursOffset: -2, shares: [0.55, 0.1, 0.05, 0.3] },
  { id: 'steady', hoursOffset: 0, shares: [0.6, 0.15, 0.1, 0.15] },
  { id: 'push', hoursOffset: 1.5, shares: [0.6, 0.1, 0.2, 0.1] },
  { id: 'grind', hoursOffset: 3.5, shares: [0.7, 0.05, 0.2, 0.05] },
  { id: 'politic', hoursOffset: 0.5, shares: [0.4, 0.15, 0.4, 0.05] },
  { id: 'recover', hoursOffset: -2, shares: [0.35, 0.1, 0.05, 0.5] },
];

/**
 * Create a company with one fully simulated division.
 *
 * Args:
 *   random: seeded random source
 *   industry: an entry of INDUSTRIES
 *
 * Returns:
 *   the organisation, with every seat filled except the player's
 */
export function createOrganization(random, industry, ageOffset = 0) {
  const companyNames = COMPANY_NAMES[industry.id];
  const divisionNames = DIVISION_NAMES[industry.id];
  const org = {
    companyName: random.pick(companyNames),
    divisionIndex: random.int(0, divisionNames.length - 1),
    divisionNames,
    teamNames: TEAM_NAMES[industry.id],
    industry,
    agents: [],
    departures: [],
    managerId: null,
    otherDivisions: [],
  };
  for (let level = 0; level < industry.seats.length; level += 1) {
    for (let seat = 0; seat < industry.seats[level]; seat += 1) {
      org.agents.push(hirePeer(random, industry, level, { initial: true, ageOffset }));
    }
  }
  assignTeams(org);
  for (let index = 0; index < divisionNames.length; index += 1) {
    if (index === org.divisionIndex) continue;
    org.otherDivisions.push({
      name: divisionNames[index],
      headcount: industry.seats.reduce((sum, seats) => sum + seats, 0) + random.int(-6, 10),
      revenue: random.between(40, 140),
      happiness: random.between(50, 80),
      attrition: random.between(0.06, 0.18),
    });
  }
  return org;
}

export function randomName(random) {
  return `${random.pick(FIRST_NAMES)} ${random.pick(LAST_NAMES)}`;
}

/** A new simulated worker, sized for the level they are hired into. */
export function hirePeer(random, industry, level, { initial = false, ageOffset = 0 } = {}) {
  const age = TIME.startAge + level * 3.5 + random.between(0, 4) + ageOffset;
  const ambition = random.between(0.2, 0.95);
  const agent = createAgent({
    name: randomName(random),
    mbti: random.pick(['INTJ', 'ENFP', 'ENTP', 'ISTJ', 'ESTJ', 'INFJ', 'ISFP', 'ENTJ']),
    iq: clamp(random.normal(PEERS.iqMean + level * PEERS.iqPerLevel, PEERS.iqDeviation), 100, 165),
    pol: clamp(random.normal(PEERS.polMean + level * 3, PEERS.polDeviation), 40, 150),
    age,
    level,
    quartersAtLevel: initial ? random.int(0, 10) : 0,
    readiness: initial ? random.between(0, 70) : random.between(0, 25),
    skill: clamp(SKILL.startMean + 8 * level + random.normal(0, 6), 5, 95),
    health: clamp(random.normal(88 - Math.max(0, age - 35) * 0.8, 5), 45, 100),
    motivation: clamp(random.normal(68, 8), 35, 95),
    personality: {
      ambition,
      selfPreservation: random.between(0.25, 0.95),
      loyaltyRisk: random.between(0.1, 0.8),
    },
    relationship: Math.round(random.normal(0, 10)),
    rigid: random.chance(PEERS.rigidManagerChance),
    salary: industry.salaries[level] * random.between(0.95, 1.05),
    teamId: random.int(0, TEAM_COUNT - 1),
    tenured: Boolean(industry.tenureFromLevel !== null && level >= industry.tenureFromLevel),
  });
  agent.plan.openness = agent.personality.loyaltyRisk;
  agent.plan.hours = industry.peerHours;
  return agent;
}

function assignTeams(org) {
  for (const agent of org.agents) {
    if (agent.level <= 3) continue;
    agent.teamId = agent.level === 4 ? agent.teamId : Math.floor(agent.teamId / 3) * 3;
  }
}

export function employedAgents(org) {
  return org.agents.filter((agent) => !agent.departed);
}

export function agentsAtLevel(org, level) {
  return org.agents.filter((agent) => !agent.departed && agent.level === level);
}

// ── Peer decisions ─────────────────────────────────────────────────────

/**
 * Pick a peer's plan for the quarter by the design's utility:
 * Ambition × gain − SelfPreservation × risk, with a little noise.
 */
export function choosePeerPlan(peer, industry, random, pressure = 0) {
  let best = null;
  let bestUtility = -Infinity;
  for (const candidate of PEER_PLANS) {
    const hours = clamp(industry.peerHours + candidate.hoursOffset, 6, 16);
    const shares = candidate.shares;
    const faceTime = 1 + industry.faceTimePerHour * Math.max(0, hours - 8);
    const gain = effectiveHours(hours) / 8 * faceTime * (shares[CORE] + 0.8 * shares[POLITICS] + 0.4 * shares[CITIZENSHIP]);
    const strain = strainOf(hours);
    let risk = strain * strain * 4;
    // Everyone has a life; the less ambitious value it more.
    risk += 0.08 * Math.max(0, hours - 8) * (1 - peer.personality.ambition);
    if (peer.health < 60) risk += (60 - peer.health) / 60 * strain * 4;
    if (peer.motivation < 45) risk += (45 - peer.motivation) / 45 * (1 - shares[RECOVERY] * 2) * 2;
    if (peer.burnout.active) risk += shares[RECOVERY] >= MOTIVATION.burnoutRestShare ? 0 : 5;
    const fear = 1 + pressure + (peer.pip.active ? 1 : 0);
    const utility = peer.personality.ambition * gain * fear - peer.personality.selfPreservation * risk + random.normal(0, 0.05);
    if (utility > bestUtility) {
      bestUtility = utility;
      best = { hours, shares };
    }
  }
  peer.plan.hours = best.hours;
  peer.plan.shares = best.shares.slice();
  const open = projectsOpenTo(peer, industry).filter((project) => !project.risky || peer.personality.ambition > 0.7);
  peer.plan.project = random.weighted(open, (project) => (project.role === 'visible' ? 2 : 1)).id;
}

// ── Quarter close ──────────────────────────────────────────────────────

/** Resolve an agent's project at quarter end. Returns a note or null. */
export function resolveProject(agent, industry, random) {
  const quarter = agent.quarter;
  const project = projectSpec(quarter.projectId, industry);
  // On leave the project waits; it neither lands nor fails.
  if (!project || onLeaveThisQuarter(agent)) return null;
  let success = quarter.projectProgress >= 1;
  if (success && project.risky) {
    success = random.chance(Math.min(1, PROJECTS.riskyLanding * (agent.traits.moonshotLanding ?? 1)));
  }
  quarter.projectSuccess = success;
  if (success) {
    quarter.performanceBonus = (quarter.performanceBonus ?? 0) + project.successBonus;
    agent.readiness += project.readiness ?? 0;
    applyProjectEffects(agent, project);
    if (project.impact === 'high') agent.motivation += MOTIVATION.highImpactLift;
  } else {
    quarter.performanceBonus = (quarter.performanceBonus ?? 0) - project.failurePenalty;
    if (project.impact !== 'low') agent.motivation -= MOTIVATION.projectFailureHit;
  }
  return { project, success };
}

// What a landed project does to the industry meter.
const BOUNDED_STATS = new Set(['techDebt', 'clientScore', 'dealFlow']);

function applyProjectEffects(agent, project) {
  for (const [stat, change] of Object.entries(project.effects ?? {})) {
    const next = (agent.industry[stat] ?? 0) + change;
    agent.industry[stat] = BOUNDED_STATS.has(stat) ? clamp(next, 0, 100) : Math.max(0, next);
  }
}

/** On sick leave or FMLA for most of the quarter: not rated, not PIP'd. */
export function onLeaveThisQuarter(agent) {
  return onBurnoutLeave(agent) || (agent.quarter.leaveDays ?? 0) >= 30;
}

export function quarterPerformance(agent, random, industry) {
  const quarter = agent.quarter;
  const days = Math.max(1, quarter.days);
  const raw = (quarter.core + quarter.political) / days * PERFORMANCE.quarterScale;
  const faceTime = 1 + (industry?.faceTimePerHour ?? 0) * Math.max(0, agent.plan.hours - 8);
  const multiplier = (quarter.performanceMultiplier ?? 1) * faceTime;
  const score = raw * multiplier + (quarter.performanceBonus ?? 0) + random.normal(0, PERFORMANCE.noiseDeviation);
  quarter.performance = Math.max(0, score);
  agent.lastPerformance = quarter.performance;
  return quarter.performance;
}

/**
 * Rank each level's pool and hand out ratings from the design's brackets.
 * A bottom rating becomes a PIP only when it is also clearly behind.
 */
export function rateLevels(org, levelCount) {
  for (let level = 0; level < levelCount; level += 1) {
    for (const agent of agentsAtLevel(org, level)) {
      if (!onLeaveThisQuarter(agent)) continue;
      agent.quarter.rating = 'onLeave';
      agent.quarter.rank = null;
      agent.moodFromRating = 0;
      agent.lastRating = 'onLeave';
      agent.readiness -= agent.quarter.readinessGain;
    }
    const pool = agentsAtLevel(org, level)
      .filter((agent) => agent.quarter.rating !== 'onLeave')
      .sort((a, b) => b.quarter.performance - a.quarter.performance);
    if (pool.length === 0) continue;
    const median = pool[Math.floor(pool.length / 2)].quarter.performance;
    pool.forEach((agent, index) => {
      const fromTop = (index + 0.5) / pool.length;
      let rating = 'meetMost';
      if (fromTop <= PERFORMANCE.greatlyExceedsTop) rating = 'greatlyExceeds';
      else if (fromTop <= PERFORMANCE.exceedsTop) rating = 'exceeds';
      else if (fromTop <= PERFORMANCE.meetAllTop) rating = 'meetAll';
      else if (fromTop > 1 - PERFORMANCE.meetSomeBottom && agent.quarter.performance < PERFORMANCE.pipBelowMedian * median) {
        rating = 'meetSome';
      }
      agent.quarter.rating = rating;
      agent.quarter.rank = index + 1;
      agent.quarter.poolSize = pool.length;
      agent.quarter.median = median;
      agent.lastRating = rating;
      agent.ratings.push(rating);
      if (agent.ratings.length > 8) agent.ratings.shift();
      agent.readiness += READINESS.ratingBonus[rating] / (1 + READINESS.levelDifficulty * level);
      agent.moodFromRating = { greatlyExceeds: 6, exceeds: 3, meetAll: 1, meetMost: 0, meetSome: -6 }[rating];
    });
  }
}

/** Drift manager alignment and the relationship ledger after a quarter. */
export function updateAlignment(agent, manager) {
  const shares = agent.plan.shares;
  const focusWeight = { upward: 1, peers: 0.4, crossTeam: 0.2 }[agent.plan.politicsFocus] ?? 1;
  let target = 0.85 + 2 * shares[POLITICS] * focusWeight;
  if (manager && manager.rigid && agent.traits.rigidManagerClash) target -= agent.traits.rigidManagerClash;
  if (agent.isPlayer && manager) target += manager.relationship / 400;
  agent.alignment += 0.3 * (clamp(target, 0.5, 1.5) - agent.alignment);
  agent.alignment = clamp(agent.alignment, 0.5, 1.5);
}

/**
 * Who leaves this quarter, and why. Returns departure records.
 */
export function rollDepartures(org, random, market, playerId) {
  const leaving = [];
  for (const agent of employedAgents(org)) {
    if (agent.id === playerId) continue;
    let reason = null;
    if (agent.health <= 0) reason = 'died';
    else if (agent.motivation <= 0) reason = 'breakdown';
    else if (agent.age >= TIME.retirementAge) reason = 'retired';
    else if (agent.quarter.terminated) reason = agent.quarter.terminated;
    else {
      const unhappy = agent.motivation < 40 ? ORG.quitUnhappy : 0;
      const marketPull = market === 'boom' ? 1.5 : market === 'recession' ? 0.4 : 1;
      // Senior people are paid to stay: quitting falls 12% a level.
      const seniority = Math.max(0.3, 1 - 0.12 * agent.level);
      const quitChance = (ORG.quitBase + unhappy + ORG.quitOpen * agent.plan.openness) * marketPull * seniority
        + (agent.burnout.active ? 0.15 : 0);
      if (random.chance(quitChance)) reason = 'quit';
    }
    if (reason) {
      agent.departed = reason;
      leaving.push({ agent, reason });
    }
  }
  org.departures.push(...leaving.map((entry) => ({
    name: entry.agent.name, level: entry.agent.level, reason: entry.reason, teamId: entry.agent.teamId, clock: org.clock ?? 0,
  })));
  if (org.departures.length > 60) org.departures.splice(0, org.departures.length - 60);
  return leaving;
}

/** Apply PIP outcomes, up-or-out and contract rules. Marks agent.quarter.terminated. */
export function applyReviewRules(org, industry) {
  for (const agent of employedAgents(org)) {
    const rating = agent.quarter.rating;
    if (rating === 'onLeave') continue;
    if (agent.tenured) {
      agent.pip.active = false;
    } else if (agent.pip.active) {
      if (rating === 'meetSome') agent.quarter.terminated = 'fired';
      else {
        agent.pip.active = false;
        agent.quarter.pipCleared = true;
      }
    } else if (rating === 'meetSome') {
      agent.pip.active = true;
      agent.pip.quarters = 0;
      agent.motivation -= MOTIVATION.pipHit;
      agent.quarter.pipStarted = true;
    }
    if (agent.quarter.terminated) continue;
    if (industry.upOrOutQuarters && agent.level < industry.upOrOutBelowLevel && agent.quartersAtLevel >= industry.upOrOutQuarters) {
      agent.quarter.terminated = 'counselled out';
    }
    if (industry.contractQuarters && agent.level === 0 && agent.quartersAtLevel >= industry.contractQuarters) {
      agent.quarter.terminated = 'contract ended';
    }
  }
}

/**
 * Academic tenure: at the end of the clock an assistant professor is either
 * promoted without needing a chair, or let go.
 */
export function applyTenureReviews(org, industry, citationBar) {
  const results = [];
  if (!industry.tenureClockQuarters) return results;
  for (const agent of agentsAtLevel(org, industry.tenureFromLevel - 1)) {
    if (agent.quartersAtLevel < industry.tenureClockQuarters || agent.quarter.terminated) continue;
    const granted = agent.readiness >= READINESS.threshold * 0.8 && agent.industry.citations >= citationBar;
    if (granted) {
      promote(agent, industry);
      agent.tenured = true;
    } else {
      agent.quarter.terminated = 'denied tenure';
    }
    results.push({ agent, granted });
  }
  return results;
}

export function promote(agent, industry) {
  agent.level += 1;
  agent.quartersAtLevel = 0;
  agent.readiness = 0;
  agent.salary = payInBand(industry, agent.level, agent.salary * 1.1);
  agent.motivation += MOTIVATION.promotionLift;
  agent.pip.active = false;
  if (industry.tenureFromLevel !== null && agent.level >= industry.tenureFromLevel) agent.tenured = true;
  agent.quarter.promoted = true;
}

function promotionScore(agent, chairLevel, random) {
  const ratingBonus = { greatlyExceeds: 30, exceeds: 20, meetAll: 10, meetMost: 0, meetSome: -40 }[agent.lastRating] ?? 0;
  const politics = (agent.pol - 100) * ORG.promotionPoliticsPerLevel * chairLevel;
  return agent.readiness + ratingBonus + (agent.alignment - 1) * 40 + politics + random.between(0, 10);
}

/**
 * Fill empty chairs from the top down, so one departure can ripple a chain
 * of promotions below it. Returns the promotions made.
 */
export function fillVacancies(org, industry, random, { playerId = null, playerEligible = true } = {}) {
  const promotions = [];
  const levels = industry.seats.length;
  for (let level = levels - 1; level >= 1; level -= 1) {
    let vacancies = industry.seats[level] - agentsAtLevel(org, level).length;
    while (vacancies > 0) {
      const candidates = agentsAtLevel(org, level - 1).filter((agent) => agent.readiness >= READINESS.threshold
        && !agent.pip.active && !agent.quarter.terminated && (agent.id !== playerId || playerEligible));
      const internal = candidates.length > 0 && random.chance(ORG.internalFillChance[level]);
      if (internal) {
        const scores = new Map(candidates.map((agent) => [agent, promotionScore(agent, level, random)]));
        candidates.sort((a, b) => scores.get(b) - scores.get(a));
        const chosen = candidates[0];
        const quartersAtFormerLevel = chosen.quartersAtLevel;
        promote(chosen, industry);
        promotions.push({ agent: chosen, level, quartersAtFormerLevel, passedOver: candidates.slice(1) });
      } else {
        org.agents.push(hirePeer(random, industry, level));
        promotions.push({ agent: null, level, external: true, passedOver: candidates });
      }
      vacancies -= 1;
    }
  }
  const entryVacancies = industry.seats[0] - agentsAtLevel(org, 0).length;
  for (let index = 0; index < entryVacancies; index += 1) org.agents.push(hirePeer(random, industry, 0));
  org.agents = org.agents.filter((agent) => !agent.departed || agent.id === playerId);
  return promotions;
}

/** Readiness past the line fades when no chair opened for it. */
export function decayUnusedReadiness(org) {
  for (const agent of employedAgents(org)) {
    if (agent.quarter.promoted) continue;
    if (agent.readiness > READINESS.threshold) {
      agent.readiness = Math.max(READINESS.threshold * 0.9, agent.readiness - READINESS.decayWithoutChair);
    }
  }
}

/**
 * Choose who goes in a layoff: expensive and poorly networked first,
 * shielded by performance and political cover.
 */
export function layoffScore(agent, levelMedianSalary, random) {
  const cost = agent.salary / levelMedianSalary - 1;
  const network = (agent.alignment - 1) + agent.informants * 0.05;
  const performance = { greatlyExceeds: 0.6, exceeds: 0.4, meetAll: 0.2, meetMost: 0, meetSome: -0.4 }[agent.lastRating] ?? 0;
  const loyalty = (1 - agent.plan.openness) * 0.3;
  return cost - network - performance - loyalty + random.normal(0, 0.15);
}

export function runLayoffs(org, industry, share, random) {
  const cut = [];
  for (let level = 0; level < industry.seats.length - 1; level += 1) {
    // Tenure and FMLA both protect a job from a layoff list.
    const pool = agentsAtLevel(org, level).filter((agent) => !agent.tenured && !agent.quarter.leaveDays);
    if (pool.length === 0) continue;
    const salaries = pool.map((agent) => agent.salary).sort((a, b) => a - b);
    const median = salaries[Math.floor(salaries.length / 2)];
    const scored = pool.map((agent) => ({ agent, score: layoffScore(agent, median, random) }));
    scored.sort((a, b) => b.score - a.score);
    const count = Math.floor(pool.length * share + random.next());
    for (let index = 0; index < count; index += 1) {
      scored[index].agent.quarter.terminated = 'laid off';
      cut.push(scored[index].agent);
    }
  }
  return cut;
}

/** Quarter-end bookkeeping every agent shares. */
export function ageAgents(org) {
  org.clock = (org.clock ?? 0) + 1;
  for (const agent of employedAgents(org)) {
    clampVitals(agent);
    agent.age += 0.25;
    agent.quartersAtLevel += 1;
    agent.quartersEmployed += 1;
    if (agent.burnout.active) {
      agent.burnout.quarters += 1;
      if (agent.burnout.quarters >= MOTIVATION.burnoutMinQuarters && agent.motivation >= MOTIVATION.burnoutExitLine) {
        agent.burnout.active = false;
      }
    }
    if (agent.industry.grantQuarters > 0) agent.industry.grantQuarters -= 1;
  }
}

export function startQuarterFor(agent) {
  agent.quarter = freshQuarter(agent);
}

/** Headcount, mood and churn of the simulated division, for the org chart. */
export function divisionStats(org) {
  const agents = employedAgents(org);
  const headcount = agents.length;
  const happiness = agents.reduce((sum, agent) => sum + agent.motivation, 0) / Math.max(1, headcount);
  const recentDepartures = org.departures.slice(-20).length;
  return {
    headcount,
    happiness,
    attrition: recentDepartures / Math.max(1, headcount) / 2,
    revenue: agents.reduce((sum, agent) => sum + (agent.quarter.performance || 80), 0) / 100,
  };
}

export { stagnationYears, RATINGS };
