// One worker, player or peer, and the daily arithmetic that moves them.
// Peers and the player run exactly the same formulas; only who chooses the
// plan differs.

import {
  BANDWIDTH, HEALTH, MOTIVATION, PERFORMANCE, SKILL, READINESS, ORG, JOBS,
  PROJECTS, INDUSTRY_STATS, TIME, MONEY,
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
 * a hit. One-off blows to motivation tip a worker into burnout, never
 * straight past it: only working on through burnout, day after day, ends in
 * a breakdown.
 */
export function clampVitals(agent) {
  agent.health = Math.min(100, agent.health);
  agent.motivation = Math.min(100, agent.motivation);
  if (!agent.burnout.active || onBurnoutLeave(agent)) agent.motivation = Math.max(1, agent.motivation);
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
    project: 'maintenance',
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
  if (agent.burnout.active) return MOTIVATION.burnoutProductivity;
  const above = clamp((agent.motivation - MOTIVATION.burnoutLine) / (100 - MOTIVATION.burnoutLine), 0, 1);
  return PERFORMANCE.motivationFloor + (PERFORMANCE.motivationCeiling - PERFORMANCE.motivationFloor) * above;
}

export function skillMultiplier(agent) {
  return PERFORMANCE.skillFloor + PERFORMANCE.skillRange * clamp(agent.skill, 0, 100) / 100;
}

export function healthTarget(agent, context) {
  const plan = agent.plan;
  const traits = agent.traits;
  const strain = strainOf(plan.hours);
  const resistance = traits.strainResistance ?? 1;
  let target = HEALTH.baseTarget;
  target -= HEALTH.strainDamage * strain * strain * resistance;
  target += HEALTH.restBonus * plan.shares[RECOVERY];
  target -= HEALTH.ageWearPerYear * Math.max(0, agent.age - HEALTH.ageWearFrom);
  if (traits.networkingHealthDrain) target -= traits.networkingHealthDrain * plan.shares[POLITICS];
  if (context.industry.subStat === 'utilization' && context.employed) {
    target -= INDUSTRY_STATS.utilization.travelHealthPerUtilization * utilizationOf(plan);
  }
  return target;
}

export function stagnationYears(agent) {
  const expected = ORG.expectedYearsAtLevel[agent.level] ?? 4;
  return Math.max(0, agent.quartersAtLevel / 4 - expected);
}

export function motivationTarget(agent, context) {
  const plan = agent.plan;
  const shares = plan.shares;
  if (agent.burnout.active) {
    const resting = shares[RECOVERY] >= MOTIVATION.burnoutRestShare && plan.hours <= MOTIVATION.burnoutMaxHours;
    if (!resting) return MOTIVATION.burnoutSlideTarget;
    return MOTIVATION.burnoutRecoveryBase + MOTIVATION.burnoutRecoveryPerRest * shares[RECOVERY];
  }
  const traits = agent.traits;
  const strain = strainOf(plan.hours);
  let target = MOTIVATION.baseTarget;
  target -= MOTIVATION.exhaustionDrain * strain * strain * (traits.exhaustionResistance ?? 1);
  target += MOTIVATION.restBonus * shares[RECOVERY];
  if (context.employed) {
    target -= Math.min(MOTIVATION.stagnationCap, MOTIVATION.stagnationPerYear * stagnationYears(agent));
  } else {
    target -= context.unemployedMood ?? 15;
  }
  if (traits.deskWorkDrain) target -= traits.deskWorkDrain * Math.max(0, shares[CORE] - traits.deskWorkLimit);
  if (traits.networkingDrain) target -= traits.networkingDrain * Math.max(0, shares[POLITICS] - 0.1);
  target += agent.moodFromRating;
  target += context.moodModifier ?? 0;
  return target;
}

/** Burned out and resting by the rules: on medical leave this quarter. */
export function onBurnoutLeave(agent) {
  return agent.burnout.active
    && agent.plan.shares[RECOVERY] >= MOTIVATION.burnoutRestShare
    && agent.plan.hours <= MOTIVATION.burnoutMaxHours;
}

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
 *   context: { industry, random, employed, moodModifier, outputModifier }
 *
 * Returns:
 *   a list of things that happened today worth telling the player
 */
export function stepDay(agent, context) {
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
    const politicsWeight = READINESS.politicsWeight * (1 + READINESS.politicsPerLevel * agent.level);
    const readinessToday = (READINESS.citizenshipWeight * citizenship
      + politicsWeight * politics * (agent.pol / 100) * (traits.politicsBonus ?? 1)) / levelFactor / days;
    agent.readiness += readinessToday;
    quarter.readinessGain += readinessToday;

    advanceProject(agent, coreOutput, citizenship, context.industry);
    stepIndustryDay(agent, context, coreOutput, politics, notes);
    agent.skill += SKILL.learnFromWork * shares[CORE] * (1 - agent.skill / 100) / days;
  }
  agent.skill += SKILL.learnFromRest * shares[RECOVERY] * (1 - agent.skill / 100) / days;

  agent.health += HEALTH.driftPerQuarter * (healthTarget(agent, context) - agent.health) / days;
  agent.motivation += MOTIVATION.driftPerQuarter * (motivationTarget(agent, context) - agent.motivation) / days;
  agent.health = Math.min(100, agent.health);
  agent.motivation = Math.min(100, agent.motivation);
  agent.skill = clamp(agent.skill, 0, 100);

  if (!agent.burnout.active && agent.motivation <= MOTIVATION.burnoutLine && agent.motivation > 0) {
    agent.burnout.active = true;
    agent.burnout.quarters = 0;
    notes.push({ kind: 'burnout', text: 'Burnout. Everything greys out; only real rest brings it back.' });
  }
  return notes;
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

export function projectSpec(projectId, industry) {
  if (PROJECTS.catalog[projectId]) return PROJECTS.catalog[projectId];
  if (industry && industry.project.id === projectId) return industry.project;
  return null;
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
