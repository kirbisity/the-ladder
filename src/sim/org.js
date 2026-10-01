// The player's division: a pyramid of seats filled by simulated workers who
// compete, quit, get promoted, PIP'd and laid off by the same rules as the
// player. The rest of the company is summarised, not simulated.

import { TIME, PERFORMANCE, READINESS, ORG, PEERS, SKILL, RELATIONSHIP, PROJECTS, MOTIVATION, MONEY, TRACKS, COMPANY_TIERS, TIER_MIX, INDUSTRY_STATS, BANDWIDTH } from '../config.js';
import {
  createAgent, freshQuarter, clamp, clampVitals, onBurnoutLeave, payInBand, effectiveHours, strainOf, projectSpec, projectsOpenTo, stagnationYears,
  defaultTrack, managementMix,
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
/** Pick a tier for a new employer in an industry, by its mix. */
export function pickTier(random, industryId) {
  const mix = TIER_MIX[industryId] ?? { mid: 1 };
  return random.weighted(Object.keys(mix), (tier) => mix[tier]);
}

/**
 * The industry's rules as this employer runs them: pay, bonuses, seats,
 * culture hours and review rules scaled by its tier.
 */
export function tieredIndustry(industry, tierId) {
  const tier = COMPANY_TIERS[tierId] ?? COMPANY_TIERS.mid;
  const base = industry.base ?? industry;
  return {
    ...industry,
    base: industry.base ?? industry,
    tier: tierId,
    salaries: (industry.base ?? industry).salaries.map((salary) => Math.round(salary * tier.pay / 1000) * 1000),
    bonusShare: (industry.base ?? industry).bonusShare.map((share) => share * tier.bonus),
    seats: (industry.base ?? industry).seats.map((seats) => Math.max(1, Math.round(seats * tier.seatScale))),
    peerHours: (industry.base ?? industry).peerHours + tier.peerHoursOffset,
    reviewEvery: tier.reviewEvery,
    pipBelowMedian: tier.pipBelowMedian,
    quitMultiplier: tier.quitMultiplier,
    politicsWeight: tier.politicsWeight,
    payCatchUp: tier.payCatchUp,
    layoffMultiplier: tier.layoffMultiplier,
    growthPerYear: tier.growthPerYear,
    ageSensitivity: (base.ageSensitivity ?? 1) * tier.ageSensitivity,
    ageOutPerYear: (base.ageOutPerYear ?? 0) * tier.ageOut,
    upOrOutQuarters: base.upOrOutQuarters && tier.upOrOut ? Math.round(base.upOrOutQuarters * tier.upOrOut) : null,
  };
}

/** A company name of the right kind, avoiding one to skip. */
export function companyNameFor(random, industryId, tierId, avoid = null) {
  const names = (COMPANY_NAMES[industryId]?.[tierId] ?? COMPANY_NAMES[industryId].mid).filter((name) => name !== avoid);
  return random.pick(names);
}

export function createOrganization(random, baseIndustry, { ageOffset = 0, tier = null } = {}) {
  const tierId = tier ?? pickTier(random, baseIndustry.id);
  const industry = tieredIndustry(baseIndustry.base ?? baseIndustry, tierId);
  const divisionNames = DIVISION_NAMES[industry.id];
  const org = {
    companyName: companyNameFor(random, industry.id, tierId),
    tier: tierId,
    seatGrowth: 1,
    quartersSinceReview: 0,
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

// Everyone in the game goes by first name and last initial.
export function randomName(random) {
  return `${random.pick(FIRST_NAMES)} ${random.pick(LAST_NAMES).charAt(0)}`;
}

/** A new simulated worker, sized for the level they are hired into. */
/** The skill a typical career has built by this age. */
export function experiencedSkill(age) {
  const years = Math.max(0, age - TIME.startAge);
  return 100 - (100 - SKILL.startMean) * Math.exp(-SKILL.experienceRate * years);
}

export function hirePeer(random, industry, level, { initial = false, ageOffset = 0 } = {}) {
  const initialQuarters = initial ? random.int(0, 10) : 0;
  const age = TIME.startAge + level * 3.5 + random.between(0, 4) + ageOffset;
  const ambition = random.between(PEERS.ambitionRange[0], PEERS.ambitionRange[1]);
  const agent = createAgent({
    name: randomName(random),
    mbti: random.pick(['INTJ', 'ENFP', 'ENTP', 'ISTJ', 'ESTJ', 'INFJ', 'ISFP', 'ENTJ']),
    iq: clamp(random.normal(PEERS.iqMean + level * PEERS.iqPerLevel, PEERS.iqDeviation), 100, 165),
    pol: clamp(random.normal(PEERS.polMean + level * 3, PEERS.polDeviation), 40, 150),
    age,
    level,
    quartersAtLevel: initialQuarters,
    quartersInGrade: initialQuarters,
    readiness: initial ? random.between(0, 70) : random.between(0, 25),
    skill: clamp(experiencedSkill(age) + random.normal(0, SKILL.hireDeviation), 5, 95),
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
  if (industry.trackFromLevel && level > industry.trackFromLevel) agent.track = defaultTrack(agent, random);
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
  // Consultants know the job is billable hours: whatever the plan, they keep
  // enough of the week on client work to stay in the utilization sweet spot.
  if (industry.subStat === 'utilization') keepUtilized(peer.plan);
  const open = projectsOpenTo(peer, industry).filter((project) => !project.risky || peer.personality.ambition > 0.7);
  peer.plan.project = random.weighted(open, (project) => (project.role === 'visible' ? 2 : 1)).id;
}

function keepUtilized(plan) {
  const dials = INDUSTRY_STATS.utilization;
  const wanted = dials.target * BANDWIDTH.standardHours / plan.hours;
  const core = clamp(wanted, plan.shares[CORE], 0.85);
  const others = 1 - plan.shares[CORE];
  plan.shares = plan.shares.map((share, index) => (index === CORE ? core : others > 0 ? share / others * (1 - core) : (1 - core) / 3));
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
    if (project.impact === 'high') agent.motivation += MOTIVATION.highImpactLift * (agent.traits.noveltyLift ?? 1);
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

/**
 * The quarter's output as the agent's track judges it: past the fork,
 * managers are judged more on influence and people the higher they go
 * (scaled by their leadership), experts on their own work.
 */
export function trackWeightedOutput(agent, industry) {
  const quarter = agent.quarter;
  if (!agent.track || !industry?.trackFromLevel || agent.level < industry.trackFromLevel) return quarter.core + quarter.political;
  const track = TRACKS[agent.track];
  const mix = agent.track === 'management' ? managementMix(agent, industry) : 1;
  const leadership = agent.track === 'management' ? (agent.traits.leadership ?? 1) : 1;
  const core = quarter.core * (1 - track.coreWeightDrop * mix);
  const political = quarter.political * Math.max(0, 1 + track.politicalWeightGain * mix) * leadership;
  const people = quarter.citizenship * track.peopleWeight * mix * leadership * (agent.pol / 100);
  return core + political + people;
}

export function quarterPerformance(agent, random, industry) {
  const quarter = agent.quarter;
  const days = Math.max(1, quarter.days);
  const raw = trackWeightedOutput(agent, industry) / days * PERFORMANCE.quarterScale;
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
  const pipBar = org.industry?.pipBelowMedian ?? PERFORMANCE.pipBelowMedian;
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
      else if (fromTop > 1 - PERFORMANCE.meetSomeBottom && agent.quarter.performance < pipBar * median) {
        rating = 'meetSome';
      }
      agent.quarter.rating = rating;
      agent.quarter.rank = index + 1;
      agent.quarter.poolSize = pool.length;
      agent.quarter.median = median;
      agent.lastRating = rating;
      const rankScore = pool.length > 1 ? 1 - index / (pool.length - 1) : 0.5;
      agent.recentStanding = rankScore;
      agent.standing = (agent.standing ?? 0.5) + (rankScore - (agent.standing ?? 0.5)) * MONEY.standingSmoothing;
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
      const seniority = Math.max(0.3, 1 - 0.12 * agent.level) * (org.industry?.quitMultiplier ?? 1);
      const quitChance = (ORG.quitBase + unhappy + ORG.quitOpen * agent.plan.openness) * marketPull * seniority
        + (agent.burnout.active ? 0.15 : 0);
      // Where the culture pushes older people out, more leave each year of
      // age past its line; the senior are paid to stay and are pushed less.
      const pushedOut = Math.max(0, agent.age - (org.industry?.ageOutFrom ?? 99)) * (org.industry?.ageOutPerYear ?? 0) * Math.max(0.3, 1 - 0.1 * agent.level);
      if (random.chance(quitChance + pushedOut)) reason = pushedOut > 0 && random.chance(0.5) ? 'pushed out' : 'quit';
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
      if (rating === 'meetSome' && agent.level >= ORG.managementFromLevel) {
        // A manager who cannot make it work steps back to the level below
        // rather than out of the door.
        stepBack(agent, industry);
      } else if (rating === 'meetSome') {
        agent.quarter.terminated = 'fired';
      }
      else {
        agent.pip.active = false;
        agent.quarter.pipCleared = true;
      }
    } else if (rating === 'meetSome' && agent.quartersAtLevel >= ORG.rampUpQuarters) {
      // A new level or a new job gets a ramp-up before a PIP can start.
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

/** Step back one level, keeping the top of the lower band's pay. */
export function stepBack(agent, industry) {
  agent.level -= 1;
  agent.quartersAtLevel = 0;
  agent.quartersInGrade = 0;
  agent.readiness = 0;
  agent.pip.active = false;
  agent.salary = payInBand(industry, agent.level, agent.salary);
  agent.motivation -= MOTIVATION.stepBackHit;
  agent.quarter.steppedBack = true;
}

export function promote(agent, industry, random = null) {
  agent.level += 1;
  if (industry.trackFromLevel && agent.level > industry.trackFromLevel && !agent.track) agent.track = defaultTrack(agent, random);
  agent.quartersAtLevel = 0;
  agent.quartersInGrade = 0;
  agent.readiness = 0;
  agent.salary = payInBand(industry, agent.level, agent.salary * 1.1);
  agent.motivation += MOTIVATION.promotionLift;
  agent.pip.active = false;
  if (industry.tenureFromLevel !== null && agent.level >= industry.tenureFromLevel) agent.tenured = true;
  agent.quarter.promoted = true;
}

// Ratings that show someone is already doing well at their level.
const STRONG_RATINGS = new Set(['greatlyExceeds', 'exceeds', 'meetAll']);

/**
 * Promotions go to people who have been performing well for a while, not
 * on a good quarter: their smoothed stack rank (standing, about a year's
 * memory) must clear the bar and the latest rating must be top half. The
 * expert track's upper chairs need exceptional standing.
 */
export function performingAtLevel(agent, industry = null) {
  const latest = [...agent.ratings].reverse().find((rating) => rating !== 'onLeave');
  if (!latest || !STRONG_RATINGS.has(latest)) return false;
  const standing = agent.standing ?? 0.5;
  const expertUpper = agent.track === 'expert' && industry?.trackFromLevel !== undefined && agent.level >= industry.trackFromLevel + 1;
  return standing >= (expertUpper ? ORG.expertPromotionStanding : ORG.promotionStanding);
}

/** The score of an outside candidate: ready, with a strong record elsewhere. */
function externalCandidateScore(random, chairLevel) {
  const standing = random.between(ORG.externalStanding[0], ORG.externalStanding[1]);
  // Seasoned outsiders bring their own politics and leadership, more so for
  // senior chairs.
  return READINESS.cap + standing * ORG.standingPromotionWeight + 20 + chairLevel * ORG.outsiderSeniorityPerLevel + random.between(0, 20);
}

function promotionScore(agent, chairLevel, random, politicsWeight = 1) {
  const ratingBonus = { greatlyExceeds: 30, exceeds: 20, meetAll: 10, meetMost: 0, meetSome: -40 }[agent.lastRating] ?? 0;
  const trackPolitics = agent.track ? TRACKS[agent.track].promotionPolitics : 1;
  const politics = (agent.pol - 100) * ORG.promotionPoliticsPerLevel * chairLevel * trackPolitics * politicsWeight;
  // Committees for manager chairs look for leaders, not only producers.
  const leads = agent.track !== 'expert' && chairLevel >= ORG.managementFromLevel;
  const leadership = leads ? ((agent.traits.leadership ?? 1) - 1) * ORG.leadershipPromotionWeight : 0;
  // Among the ready, the chair goes to the strongest track record.
  const record = (agent.standing ?? 0.5) * ORG.standingPromotionWeight;
  // Committees favour rising stars: years stuck at a level read as a
  // plateau, and late-career promotions are rare.
  const plateau = Math.max(0, (agent.quartersInGrade ?? agent.quartersAtLevel) / 4 - ORG.plateauAfterYears) * ORG.plateauPerYear;
  const late = Math.max(0, agent.age - ORG.latePromotionAge) * ORG.latePerYear;
  return agent.readiness + record + ratingBonus + (agent.alignment - 1) * 40 + politics + leadership - plateau - late + random.between(0, 10);
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
        && performingAtLevel(agent, industry)
        && !agent.pip.active && !agent.quarter.terminated && (agent.id !== playerId || playerEligible));
      const scores = new Map(candidates.map((agent) => [agent, promotionScore(agent, level, random, industry.politicsWeight ?? 1)]));
      candidates.sort((a, b) => scores.get(b) - scores.get(a));
      // A real search: often an outside candidate with a strong record is on
      // the slate too, more often the more senior the chair.
      const externalOnly = random.chance(ORG.externalOnlyChance[level]);
      let outsider = -Infinity;
      if (random.chance(ORG.externalSearchChance[level])) {
        for (let index = 0; index < ORG.outsideCandidates[level]; index += 1) outsider = Math.max(outsider, externalCandidateScore(random, level));
      }
      const internal = !externalOnly && candidates.length > 0 && scores.get(candidates[0]) > outsider;
      if (internal) {
        const chosen = candidates[0];
        const quartersAtFormerLevel = chosen.quartersAtLevel;
        promote(chosen, industry, random);
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

/** What someone's recent work is worth in their band: pay for current standing. */
export function currentValue(agent, industry) {
  const base = industry.salaries[agent.level];
  return base * (1 + (MONEY.bandTop - 1) * (agent.recentStanding ?? agent.standing ?? 0.5));
}

/** The salary someone's smoothed standing has earned. */
export function payTarget(agent, industry) {
  const base = industry.salaries[agent.level];
  return base * (1 + (MONEY.bandTop - 1) * (agent.standing ?? 0.5));
}

/** A year of growth: the division adds seats, opening chairs to fill. */
export function growOrganization(org) {
  const industry = org.industry;
  org.seatGrowth = Math.min(ORG.maxSeatGrowth, org.seatGrowth * (1 + (industry.growthPerYear ?? 0)));
  const base = industry.base.seats;
  const scale = COMPANY_TIERS[org.tier].seatScale;
  // Growth widens the base and middle of the pyramid; directors grow at
  // half the rate and the top two chairs not at all.
  industry.seats = base.map((seats, level) => {
    const growth = level >= ORG.growthStopsAtLevel ? 1 : level === ORG.growthStopsAtLevel - 1 ? 1 + (org.seatGrowth - 1) / 2 : org.seatGrowth;
    return Math.max(1, Math.round(seats * scale * growth));
  });
}

/** Move the company to another tier, keeping its people and growth. */
export function retierOrganization(org, tierId) {
  const seats = org.industry.seats;
  org.tier = tierId;
  org.industry = tieredIndustry(org.industry.base, tierId);
  org.industry.seats = seats;
}

/** Year-end pay review: close part of the gap to the target; never cut. */
export function reviewPay(org, industry) {
  for (const agent of employedAgents(org)) {
    const target = payTarget(agent, industry);
    const catchUp = Math.min(1, MONEY.payCatchUpPerYear * (industry.payCatchUp ?? 1));
    if (target > agent.salary) agent.salary = payInBand(industry, agent.level, agent.salary + (target - agent.salary) * catchUp);
  }
}

/**
 * Who goes in a layoff: the expensive for what they do now, and the poorly
 * connected. Someone paid for past glory who has slipped lately is exposed
 * unless they have rapport above them.
 */
export function layoffScore(agent, levelMedianSalary, random, industry) {
  const cost = agent.salary / levelMedianSalary - 1;
  const overpaid = industry ? agent.salary / currentValue(agent, industry) - 1 : 0;
  const rapport = (agent.alignment - 1) + agent.informants * 0.05;
  const performance = { greatlyExceeds: 0.6, exceeds: 0.4, meetAll: 0.2, meetMost: 0, meetSome: -0.4 }[agent.lastRating] ?? 0;
  const loyalty = (1 - agent.plan.openness) * 0.3;
  // Older workers are likelier to be on the list where the culture is young.
  const ageBias = industry ? Math.max(0, agent.age - (industry.ageOutFrom ?? 99)) * (industry.ageOutPerYear ?? 0) * 5 : 0;
  return 0.5 * cost + 1.5 * overpaid + ageBias - rapport - performance - loyalty + random.normal(0, 0.15);
}

export function runLayoffs(org, industry, share, random) {
  const cut = [];
  for (let level = 0; level < industry.seats.length - 1; level += 1) {
    // Tenure and FMLA both protect a job from a layoff list.
    const pool = agentsAtLevel(org, level).filter((agent) => !agent.tenured && !agent.quarter.leaveDays);
    if (pool.length === 0) continue;
    const salaries = pool.map((agent) => agent.salary).sort((a, b) => a - b);
    const median = salaries[Math.floor(salaries.length / 2)];
    const scored = pool.map((agent) => ({ agent, score: layoffScore(agent, median, random, industry) }));
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
    agent.quartersInGrade = (agent.quartersInGrade ?? agent.quartersAtLevel - 1) + 1;
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
