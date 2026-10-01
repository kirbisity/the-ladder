// One worker, player or peer, and the daily arithmetic that moves them.
// Peers and the player run exactly the same formulas; only who chooses the
// plan differs.

import {
  BANDWIDTH, HEALTH, MOTIVATION, PERFORMANCE, SKILL, READINESS, ORG, JOBS,
  PROJECTS, INDUSTRY_STATS, TIME, MONEY, FMLA, TRACKS, AGING,
} from '../config.js';

export const CORE = 0;
export const CITIZENSHIP = 1;
export const POLITICS = 2;
export const RECOVERY = 3;

export const RATINGS = ['greatlyExceeds', 'exceeds', 'meetAll', 'meetMost', 'meetSome'];
export const RATING_LABELS = {
  onLeave: 'On leave',
  greatlyExceeds: 'Greatly Exceeds',
  exceeds: 'Exceeds',
  meetAll: 'Meets All',
  meetMost: 'Meets Most',
  meetSome: 'Meets Some',
};

let nextAgentId = 1;

/** After loading a save, keep new ids clear of the loaded ones. */
export function reserveAgentIds(highestId) {
  nextAgentId = Math.max(nextAgentId, highestId + 1);
}

export function clamp(value, low, high) {
  return Math.min(high, Math.max(low, value));
}

/** Hold pay inside its level's band. */
export function payInBand(industry, level, salary) {
  const base = industry.salaries[level];
  return Math.min(Math.max(salary, base), base * MONEY.bandTop);
}

/**
 * Keep health, motivation and readiness inside their ranges after a lift or
 * a hit. A blow that takes motivation under the line starts a burnout; near
 * zero it resists (see resistBreakdown).
 */
export function clampVitals(agent) {
  agent.health = Math.min(100, agent.health);
  // A steady temperament shrugs off part of every blow to motivation.
  const before = agent.motivationBefore ?? agent.motivation;
  if (agent.traits.steadiness && agent.motivation < before) {
    agent.motivation = before - (before - agent.motivation) * (1 - agent.traits.steadiness);
  }
  resistBreakdown(agent);
  if (!agent.burnout.active && agent.motivation <= MOTIVATION.burnoutLine) {
    agent.burnout.active = true;
    agent.burnout.quarters = 0;
  }
  agent.readiness = clamp(agent.readiness, 0, READINESS.cap);
  agent.alignment = clamp(agent.alignment, 0.5, 1.5);
  agent.skill = clamp(agent.skill, 0, 100);
}

export function defaultPlan() {
  return {
    hours: 9,
    shares: [0.55, 0.15, 0.15, 0.15],
    citizenshipFocus: 'help',
    politicsFocus: 'upward',
    project: null,
    openness: 0.3,
    managementStyle: 0.5,
  };
}

/**
 * Create a worker.
 *
 * Args:
 *   fields: any of the agent's fields to set; the rest take defaults
 *
 * Returns:
 *   a new agent
 */
export function createAgent(fields) {
  const agent = {
    id: nextAgentId++,
    name: 'Worker',
    isPlayer: false,
    mbti: 'ISTJ',
    iq: 125,
    pol: 95,
    traits: {},
    look: null,
    age: TIME.startAge,
    level: 0,
    quartersAtLevel: 0,
    // Years in this grade across employers: a new badge does not reset a plateau.
    quartersInGrade: 0,
    quartersEmployed: 0,
    readiness: 0,
    skill: SKILL.startMean,
    health: 95,
    motivation: 72,
    burnout: { active: false, quarters: 0 },
    pip: { active: false, quarters: 0 },
    tenured: false,
    plan: defaultPlan(),
    personality: { ambition: 0.5, selfPreservation: 0.5, loyaltyRisk: 0.5 },
    relationship: 0,
    rigid: false,
    alignment: 1,
    informants: 0,
    salary: 0,
    lastRating: 'meetMost',
    ratings: [],
    teamId: 0,
    departed: null,
    industry: createIndustryState(),
    quarter: null,
    moodFromRating: 0,
  };
  Object.assign(agent, fields);
  agent.motivationBefore = agent.motivation;
  agent.quarter = freshQuarter(agent);
  return agent;
}

export function createIndustryState() {
  return {
    techDebt: 30,
    utilization: 0,
    utilizationSum: 0,
    clientScore: 70,
    dealFlow: 20,
    dryPowder: 100,
    researchProgress: 0,
    papers: 0,
    paperAges: 0,
    citations: 0,
    grants: 0,
    grantQuarters: 0,
  };
}

/** Start-of-quarter accumulators for one agent. */
export function freshQuarter(agent) {
  return {
    days: 0,
    core: 0,
    political: 0,
    citizenship: 0,
    readinessGain: 0,
    projectId: agent.plan.project,
    projectProgress: 0,
    incidents: 0,
    performanceAdjust: 0,
    performance: 0,
    healthStart: agent.health,
    motivationStart: agent.motivation,
    papers: 0,
  };
}

// ── Formulas ────────────────────────────────────────────────────────────

export function effectiveHours(hours) {
  const standard = BANDWIDTH.standardHours;
  return Math.min(hours, standard) + BANDWIDTH.overtimeHourValue * Math.max(0, hours - standard);
}

/** Share of the way from a standard day to the longest one, 0..1. */
export function strainOf(hours) {
  const standard = BANDWIDTH.standardHours;
  return clamp((hours - standard) / (BANDWIDTH.maxHours - standard), 0, 1);
}

/** BW_total from the design: hours × IQ × √health × motivation^0.3. */
export function totalBandwidth(agent) {
  const iqFactor = 1 + (agent.iq - 100) / 200;
  const health = clamp(agent.health, 0, 100) / 100;
  const motivation = clamp(agent.motivation, 0, 100) / 100;
  let total = effectiveHours(agent.plan.hours) * iqFactor * Math.sqrt(health) * Math.pow(motivation, 0.3);
  if (agent.burnout.active) total *= BANDWIDTH.burnoutSpeed;
  return total;
}

export function healthMultiplier(agent) {
  return PERFORMANCE.healthFloor + (1 - PERFORMANCE.healthFloor) * clamp(agent.health, 0, 100) / 100;
}

export function motivationMultiplier(agent) {
  if (agent.burnout.active) {
    return MOTIVATION.burnoutProductivity * clamp(agent.motivation / MOTIVATION.burnoutLine, 0, 1);
  }
  const above = clamp((agent.motivation - MOTIVATION.burnoutLine) / (100 - MOTIVATION.burnoutLine), 0, 1);
  return PERFORMANCE.motivationFloor + (PERFORMANCE.motivationCeiling - PERFORMANCE.motivationFloor) * above;
}

export function skillMultiplier(agent) {
  return PERFORMANCE.skillFloor + PERFORMANCE.skillRange * clamp(agent.skill, 0, 100) / 100;
}

function addTerm(terms, label, value) {
  if (terms && Math.abs(value) >= 0.05) terms.push({ label, value });
}

/** Years past the age where the body and mood start to fade, scaled by the employer. */
export function agedYears(agent, sensitivity = 1) {
  return Math.max(0, agent.age - AGING.from) * sensitivity;
}

/** How much more a long day costs at this age: 1 for the young. */
export function strainAgeFactor(agent, sensitivity = 1) {
  return 1 + AGING.strainPerYear * agedYears(agent, sensitivity);
}

/** The share of a blow to mood that lands: older people shrug more off. */
export function blowResilience(age) {
  return Math.max(AGING.resilienceFloor, 1 - AGING.resiliencePerYear * Math.max(0, age - 30));
}

/**
 * The health a person drifts toward at their current plan. When `terms` is
 * given, each contribution is pushed to it as { label, value }, for the
 * vitals popup; the target is their sum.
 */
export function healthTarget(agent, context, terms = null) {
  const plan = agent.plan;
  const traits = agent.traits;
  const sensitivity = context.ageSensitivity ?? 1;
  const strain = strainOf(plan.hours);
  const resistance = traits.strainResistance ?? 1;
  const hoursCost = HEALTH.strainDamage * strain * strain * resistance;
  const ageHoursCost = hoursCost * (strainAgeFactor(agent, sensitivity) - 1);
  const rest = HEALTH.restBonus * plan.shares[RECOVERY];
  const wear = HEALTH.ageWearPerYear * Math.max(0, agent.age - HEALTH.ageWearFrom) * sensitivity;
  const networking = (traits.networkingHealthDrain ?? 0) * plan.shares[POLITICS];
  const stress = context.joblessStress ?? 0;
  const travel = context.industry.subStat === 'utilization' && context.employed
    ? INDUSTRY_STATS.utilization.travelHealthPerUtilization * utilizationOf(plan) : 0;
  addTerm(terms, 'A healthy baseline', HEALTH.baseTarget);
  addTerm(terms, 'Long hours', -hoursCost);
  addTerm(terms, 'Long hours hit harder with age', -ageHoursCost);
  addTerm(terms, 'Rest', rest);
  addTerm(terms, 'Age', -wear);
  addTerm(terms, 'Networking', -networking);
  addTerm(terms, 'Out-of-work stress', -stress);
  addTerm(terms, 'Travel', -travel);
  return HEALTH.baseTarget - hoursCost - ageHoursCost + rest - wear - networking - stress - travel;
}

export function stagnationYears(agent) {
  const expected = ORG.expectedYearsAtLevel[agent.level] ?? 4;
  return Math.max(0, agent.quartersAtLevel / 4 - expected);
}

/**
 * The mood a person settles at. As with healthTarget, `terms` collects each
 * contribution for the vitals popup.
 */
export function motivationTarget(agent, context, terms = null) {
  const plan = agent.plan;
  const shares = plan.shares;
  const traits = agent.traits;
  const sensitivity = context.ageSensitivity ?? 1;
  const strain = strainOf(plan.hours);
  const exhaustion = MOTIVATION.exhaustionDrain * strain * strain * (traits.exhaustionResistance ?? 1);
  const ageExhaustion = exhaustion * (strainAgeFactor(agent, sensitivity) - 1);
  const fade = AGING.motivationFadePerYear * agedYears(agent, sensitivity);
  const rest = MOTIVATION.restBonus * shares[RECOVERY];
  const stagnation = context.employed ? Math.min(MOTIVATION.stagnationCap, MOTIVATION.stagnationPerYear * stagnationYears(agent)) : 0;
  const jobless = context.employed ? 0 : context.unemployedMood ?? 15;
  const desk = traits.deskWorkDrain ? traits.deskWorkDrain * Math.max(0, shares[CORE] - traits.deskWorkLimit) : 0;
  const networking = traits.networkingDrain ? traits.networkingDrain * Math.max(0, shares[POLITICS] - 0.1) : 0;
  const autonomy = traits.autonomyNeed && context.employed && context.industry
    ? MOTIVATION.autonomyWeight * traits.autonomyNeed * ((context.industry.autonomy ?? 0.5) - 0.5) : 0;
  const burnoutDrag = agent.burnout.active
    ? MOTIVATION.burnoutDrag * (1 - Math.min(1, shares[RECOVERY] / MOTIVATION.fullRecoveryShare)) : 0;
  addTerm(terms, 'Baseline mood', MOTIVATION.baseTarget);
  addTerm(terms, 'Long hours', -exhaustion);
  addTerm(terms, 'Long hours hit harder with age', -ageExhaustion);
  addTerm(terms, 'Rest', rest);
  addTerm(terms, 'Age: enthusiasm mellows', -fade);
  addTerm(terms, 'Stuck at one level', -stagnation);
  addTerm(terms, 'Out of work', -jobless);
  addTerm(terms, 'Desk work', -desk);
  addTerm(terms, 'Networking', -networking);
  addTerm(terms, 'Freedom in the job', autonomy);
  addTerm(terms, 'Last review', agent.moodFromRating);
  addTerm(terms, 'Recent events', context.moodModifier ?? 0);
  addTerm(terms, 'Burnout', -burnoutDrag);
  const life = context.lifeTerms ?? [];
  let lifeTotal = 0;
  for (const term of life) {
    addTerm(terms, term.label, term.value);
    lifeTotal += term.value;
  }
  return lifeTotal + MOTIVATION.baseTarget - exhaustion - ageExhaustion - fade + rest - stagnation - jobless - desk - networking
    + autonomy + agent.moodFromRating + (context.moodModifier ?? 0) - burnoutDrag;
}

/** A quarter's health change toward its target: slow wear, quicker recovery. */
export function healthDrift(agent, target) {
  const rate = target > agent.health ? HEALTH.recoveryDriftPerQuarter : HEALTH.driftPerQuarter;
  return rate * (target - agent.health);
}

/** How fast motivation moves: burned out, rest speeds the climb back. */
export function motivationDrift(agent) {
  if (!agent.burnout.active) return MOTIVATION.driftPerQuarter;
  return MOTIVATION.driftPerQuarter * (1 + MOTIVATION.restSpeedup * agent.plan.shares[RECOVERY]);
}

/** Burned out and resting enough to count as sick leave this quarter. */
export function onBurnoutLeave(agent) {
  return agent.burnout.active && agent.plan.shares[RECOVERY] >= MOTIVATION.burnoutRestShare;
}

// What a day of leave looks like to the body: no work, all rest.
const LEAVE_PLAN = { hours: 6, shares: [0, 0, 0, 1], openness: 0 };

export function utilizationOf(plan) {
  return plan.shares[CORE] * plan.hours / BANDWIDTH.standardHours;
}

/** One day's core output at the current plan, before luck: the review's main input. */
export function dailyCoreOutput(agent, context) {
  const core = totalBandwidth(agent) * agent.plan.shares[CORE];
  const openCost = 1 - JOBS.openFocusCost * agent.plan.openness;
  return core * (agent.iq / 100) * skillMultiplier(agent) * healthMultiplier(agent)
    * motivationMultiplier(agent) * (agent.traits.coreBonus ?? 1) * openCost * (context.outputModifier ?? 1)
    * industryOutputBoost(agent);
}

/**
 * Advance one agent by one workday.
 *
 * Args:
 *   agent: the worker
 *   context: { industry, random, employed, onLeave, moodModifier, outputModifier }
 *
 * Returns:
 *   a list of things that happened today worth telling the player
 */
export function stepDay(agent, context) {
  if (context.onLeave) return stepLeaveDay(agent, context);
  const notes = [];
  const plan = agent.plan;
  const shares = plan.shares;
  const quarter = agent.quarter;
  const days = TIME.daysPerQuarter ?? 60;
  const traits = agent.traits;
  quarter.days += 1;

  const bandwidth = totalBandwidth(agent);
  const core = bandwidth * shares[CORE];
  const citizenship = bandwidth * shares[CITIZENSHIP];
  const politics = bandwidth * shares[POLITICS];

  if (context.employed) {
    const coreOutput = dailyCoreOutput(agent, context);
    const politicalOutput = politics * (agent.pol / 100) * agent.alignment * (traits.politicsBonus ?? 1)
      * PERFORMANCE.politicalWeight;
    quarter.core += coreOutput;
    quarter.political += politicalOutput;
    quarter.citizenship += citizenship;

    const levelFactor = 1 + READINESS.levelDifficulty * agent.level;
    const politicsWeight = READINESS.politicsWeight * (1 + READINESS.politicsPerLevel * agent.level)
      * (agent.track ? TRACKS[agent.track].readinessPolitics : 1);
    // Leadership pull matters from the first management rung up.
    const leadership = agent.level >= READINESS.leadershipFromLevel ? (traits.leadership ?? 1) : 1;
    const readinessToday = leadership * (READINESS.citizenshipWeight * citizenship
      + politicsWeight * politics * (agent.pol / 100) * (traits.politicsBonus ?? 1)) / levelFactor / days;
    agent.readiness += readinessToday;
    quarter.readinessGain += readinessToday;
    quarter.readinessFromPolitics = (quarter.readinessFromPolitics ?? 0) + leadership * politicsWeight * politics
      * (agent.pol / 100) * (traits.politicsBonus ?? 1) / levelFactor / days;

    advanceProject(agent, coreOutput, citizenship, context.industry);
    stepIndustryDay(agent, context, coreOutput, politics, notes);
    agent.skill += SKILL.learnFromWork * shares[CORE] * (1 - agent.skill / 100) / days;
  }
  agent.skill += SKILL.learnFromRest * shares[RECOVERY] * (1 - agent.skill / 100) / days;

  agent.health += healthDrift(agent, healthTarget(agent, context)) / days;
  agent.motivation += motivationDrift(agent) * (motivationTarget(agent, context) - agent.motivation) / days;
  settleDay(agent, notes);
  return notes;
}

/**
 * A day of FMLA leave: no work, no output, no pay, and both bars recover at
 * the leave's boosted pace. The quarter's rating only counts working days.
 */
function stepLeaveDay(agent, context) {
  const notes = [];
  const days = TIME.daysPerQuarter;
  const working = agent.plan;
  agent.plan = { ...working, ...LEAVE_PLAN };
  const boost = context.leaveBoost ?? FMLA.recoveryBoost;
  agent.health += boost * healthDrift(agent, healthTarget(agent, { ...context, employed: false })) / days;
  const target = motivationTarget(agent, { ...context, employed: true }) + 10;
  agent.motivation += boost * motivationDrift(agent) * (target - agent.motivation) / days;
  agent.skill += SKILL.learnFromRest * 0.5 * (1 - agent.skill / 100) / days;
  agent.plan = working;
  agent.quarter.leaveDays = (agent.quarter.leaveDays ?? 0) + 1;
  settleDay(agent, notes);
  return notes;
}

/**
 * The last few points before a breakdown are hard to lose: whatever part of
 * a fall lands inside the buffer counts at a fraction of its size.
 */
export function resistBreakdown(agent) {
  const before = agent.motivationBefore ?? agent.motivation;
  const buffer = MOTIVATION.breakdownBuffer;
  if (agent.motivation < before && agent.motivation < buffer) {
    const entry = Math.min(before, buffer);
    agent.motivation = entry - (entry - agent.motivation) * MOTIVATION.bufferResistance;
  }
  agent.motivation = clamp(agent.motivation, 0, 100);
  agent.motivationBefore = agent.motivation;
}

function settleDay(agent, notes) {
  agent.health = Math.min(100, agent.health);
  resistBreakdown(agent);
  agent.skill = clamp(agent.skill, 0, 100);
  if (!agent.burnout.active && agent.motivation <= MOTIVATION.burnoutLine) {
    agent.burnout.active = true;
    agent.burnout.quarters = 0;
    notes.push({ kind: 'burnout', text: 'Burnout. Everything greys out; only rest brings it back.' });
  }
}

function advanceProject(agent, coreOutput, citizenship, industry) {
  const quarter = agent.quarter;
  const project = projectSpec(quarter.projectId, industry);
  if (!project) return;
  const progressToday = project.usesCitizenship
    ? citizenship / project.effort
    : coreOutput / PROJECTS.standardDayOutput / project.effort;
  quarter.projectProgress += progressToday;
}

/** Default track by political sense, for anyone past the fork without a choice. */
export function defaultTrack(agent, random = null) {
  const chance = clamp(0.5 + (agent.pol - 100) / 80, 0.15, 0.85);
  return (random ? random.next() : 0.5) < chance ? 'management' : 'expert';
}

/** How far into management's influence-weighted judging this agent is, 0..1. */
export function managementMix(agent, industry) {
  if (agent.track !== 'management' || !industry?.trackFromLevel) return 0;
  // From the fork itself: a Staff engineer aiming at management is already
  // judged partly as one.
  return clamp((agent.level - industry.trackFromLevel + 1) / 5, 0, 1);
}

export function projectSpec(projectId, industry) {
  if (!industry || !projectId) return null;
  return industry.projects.find((project) => project.id === projectId) ?? null;
}

/** The industry's project in a role (safe, visible, big, risky, citizenship, repair, special). */
export function projectFor(industry, role) {
  return industry.projects.find((project) => project.role === role) ?? industry.projects[0];
}

/** Projects open to someone at this level. */
export function projectsOpenTo(agent, industry) {
  return industry.projects.filter((project) => !project.unlockLevel || agent.level >= project.unlockLevel
    || (project.risky && agent.traits.moonshotUnlocked));
}

export function industryOutputBoost(agent) {
  if (agent.industry.grantQuarters > 0) return 1 + INDUSTRY_STATS.citations.grantOutputBoost;
  return 1;
}

function stepIndustryDay(agent, context, coreOutput, politics, notes) {
  const industry = context.industry;
  const state = agent.industry;
  const plan = agent.plan;
  const days = TIME.daysPerQuarter;
  if (industry.subStat === 'techDebt') {
    const dials = INDUSTRY_STATS.techDebt;
    const tired = plan.hours > 9 ? dials.tiredGrowth : 1;
    state.techDebt += (dials.growthPerCoreShare * plan.shares[CORE] * tired - dials.naturalPaydown) / days;
    state.techDebt = clamp(state.techDebt, 0, 100);
    if (context.random.chance(dials.incidentChancePerDayAtFull * state.techDebt / 100)) {
      agent.health -= dials.incidentHealth;
      agent.motivation -= dials.incidentMotivation;
      agent.quarter.incidents += 1;
      notes.push({ kind: 'incident', text: 'PagerDuty: production is down at 2 AM.' });
    }
  } else if (industry.subStat === 'utilization') {
    state.utilizationSum += utilizationOf(plan);
  } else if (industry.subStat === 'dealFlow') {
    const dials = INDUSTRY_STATS.dealFlow;
    state.dealFlow += (dials.sourcingWeight * politics * agent.pol / 100
      + dials.modellingWeight * coreOutput / PROJECTS.standardDayOutput) / days;
    state.dealFlow = clamp(state.dealFlow, 0, 100);
  } else if (industry.subStat === 'citations') {
    const dials = INDUSTRY_STATS.citations;
    state.researchProgress += coreOutput / PROJECTS.standardDayOutput;
    while (state.researchProgress >= dials.researchPerPaper) {
      state.researchProgress -= dials.researchPerPaper;
      state.papers += 1;
      agent.quarter.papers += 1;
      notes.push({ kind: 'paper', text: 'A paper is accepted.' });
    }
  }
}
