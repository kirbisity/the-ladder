// Life outside the office: the social network, a partner, a marriage,
// children. Everything here is pure data on the game (`social`, `partner`,
// `family`, `children`), advanced once a quarter, and read by the mood
// formula as extra terms (lifeMoodTerms). The partner is a simulated
// person with a job, a body, a mood and a temperament.

import { SOCIAL, FAMILY, MONEY } from '../config.js';
import { RECOVERY, POLITICS, clamp, blowResilience } from './agent.js';
import { record } from './story.js';

// ── The social network ─────────────────────────────────────────────────

/** Extroverts (an E in their type) need a bigger circle than introverts. */
export function isExtrovert(agent) {
  return (agent.mbti ?? 'I')[0] === 'E';
}

export function socialNeed(agent) {
  return isExtrovert(agent) ? SOCIAL.extrovertNeed : SOCIAL.introvertNeed;
}

/** What a quarter adds to the circle, with the parts that make it up. */
export function socialGain(game) {
  const player = game.player;
  const plan = player.plan;
  const parts = [];
  const add = (label, value) => parts.push({ label, value });
  add('Time for people', SOCIAL.baseGain);
  add('Networking at work', SOCIAL.politicsGain * plan.shares[POLITICS]);
  add('Being open to people', SOCIAL.opennessGain * plan.openness);
  add('Free evenings', SOCIAL.restGain * plan.shares[RECOVERY]);
  add('A bigger title opens doors', SOCIAL.levelGain * player.level);
  const raw = parts.reduce((sum, part) => sum + part.value, 0);
  const temperament = isExtrovert(player) ? SOCIAL.extrovertGain : SOCIAL.introvertGain;
  const evenings = clamp(1 - SOCIAL.hoursPenaltyPerHour * Math.max(0, plan.hours - 9), SOCIAL.gainFloor, 1);
  const work = game.employment.employed ? 1 : SOCIAL.joblessGainShare;
  const total = raw * temperament * evenings * work;
  return { total, parts, temperament, evenings, work };
}

/** Where the circle would settle if nothing changed: gain over decay. */
export function socialEquilibrium(game) {
  return Math.min(100, socialGain(game).total / SOCIAL.decayPerQuarter);
}

/** Add to (or take from) the circle, for events. */
export function bumpSocial(game, amount) {
  game.social = clamp((game.social ?? SOCIAL.start) + amount, 0, 100);
}

function advanceSocial(game) {
  const gain = socialGain(game).total;
  const share = game.married ? 0.5 : 1;
  game.social = clamp((game.social ?? SOCIAL.start) * (1 - SOCIAL.decayPerQuarter) + gain * share, 0, 100);
}

// ── Children ───────────────────────────────────────────────────────────

const QUARTERS_PER_YEAR = 4;

export function childAge(game, child) {
  return (game.quarterIndex - child.born) / QUARTERS_PER_YEAR;
}

/** Children still living at home. */
export function kidsAtHome(game) {
  return (game.children ?? []).filter((child) => childAge(game, child) < FAMILY.childLeavesHomeAge);
}

export function kidsUnder(game, years) {
  return (game.children ?? []).filter((child) => childAge(game, child) < years);
}

/** Dependents set directly (older saves, tests) before children were tracked. */
function legacyKids(game) {
  return (game.children ?? []).length === 0 ? game.dependents ?? 0 : game.legacyDependents ?? 0;
}

/** What the children cost a year, by age; less after a divorce. */
export function childCostPerYear(game) {
  const tracked = kidsAtHome(game).reduce((sum, child) => {
    const age = childAge(game, child);
    if (age < 5) return sum + FAMILY.childCostUnderFive;
    if (age < 13) return sum + FAMILY.childCostSchoolAge;
    if (age < 18) return sum + FAMILY.childCostTeen;
    return sum + FAMILY.childCostCollege;
  }, 0);
  // Dependents set directly (older saves, tests) still cost the old flat sum.
  const share = !game.married && game.exPartner ? FAMILY.custodyCostShare : 1;
  return (tracked + legacyKids(game) * 14000) * share;
}

export function addChild(game) {
  if (!game.children) game.children = [];
  if (game.children.length === 0) game.legacyDependents = game.dependents ?? 0;
  game.children.push({ born: game.quarterIndex });
  syncDependents(game);
  record(game, 'child', { partner: game.partner?.name ?? null });
}

/** Dependents are the children at home, plus any set before children were tracked. */
function syncDependents(game) {
  if (!game.children || game.children.length === 0) return;
  game.dependents = kidsAtHome(game).length + (game.legacyDependents ?? 0);
}

// ── The partner ────────────────────────────────────────────────────────

const FEMALE_NAMES = ['Amelia', 'Bianca', 'Camille', 'Dalia', 'Elena', 'Freya', 'Hana', 'Imani', 'Julia', 'Lucia', 'Maya', 'Noor', 'Olivia', 'Rina', 'Sofia', 'Tara'];
const MALE_NAMES = ['Adrian', 'Benji', 'Caleb', 'Daniel', 'Ethan', 'Gabriel', 'Hugo', 'Isaac', 'Jonas', 'Kenji', 'Marcus', 'Nico', 'Omar', 'Rafael', 'Theo', 'Victor'];
const SURNAMES = ['Adler', 'Brooks', 'Castillo', 'Dubois', 'Eriksen', 'Fischer', 'Garcia', 'Haddad', 'Ito', 'Jansen', 'Larsen', 'Moreau', 'Nakamura', 'Okafor', 'Rossi', 'Singh'];

// Their work, with a starting salary at 28.
const PARTNER_CAREERS = [
  { title: 'Primary school teacher', salary: 62000 }, { title: 'Nurse', salary: 85000 },
  { title: 'Product designer', salary: 95000 }, { title: 'Civil engineer', salary: 100000 },
  { title: 'Lawyer', salary: 140000 }, { title: 'Chef', salary: 58000 },
  { title: 'Physician', salary: 190000 }, { title: 'Journalist', salary: 65000 },
  { title: 'Data analyst', salary: 98000 }, { title: 'Architect', salary: 90000 },
  { title: 'Marketing manager', salary: 110000 }, { title: 'Physical therapist', salary: 88000 },
];

const MBTI_TYPES = ['ISTJ', 'ISFJ', 'INFJ', 'INTJ', 'ISTP', 'ISFP', 'INFP', 'INTP', 'ESTP', 'ESFP', 'ENFP', 'ENTP', 'ESTJ', 'ESFJ', 'ENFJ', 'ENTJ'];

function partnerLook(random, gender) {
  const woman = gender === 'female';
  return {
    skin: random.pick(['#f1d2b0', '#e2b893', '#c99a76', '#8d5a3b', '#f4d6b8', '#6b4430']),
    hair: random.pick(['#121212', '#3a2a1e', '#6b3b23', '#c9a15a', '#5a5a5a', '#1b1512']),
    suit: random.pick(['#3c4f6e', '#5a3f2e', '#2e4a3d', '#4b3a63', '#444b55', '#6a2e35']),
    shirt: random.pick(['#ffffff', '#e6eef8', '#f6efe4']),
    face: random.pick(['round', 'soft', 'structured']),
    hairStyle: woman ? random.pick(['shoulderStraight', 'bob', 'ponytail', 'long']) : random.pick(['sideSwept', 'cleanShort', 'cleanShort']),
    brows: random.pick(['soft', 'straight', 'thickCurved']),
    eyes: random.pick(['monolid', 'innerDouble', 'large', 'focused']),
    nose: random.pick(['soft', 'delicate', 'bridge']),
    mouth: random.pick(['gentle', 'composed', 'smileTeeth']),
    glasses: random.pick([null, null, null, 'thickBlack', 'aviator']),
    stubble: woman ? false : random.pick([false, true]),
    faceStyle: random.pick(['glossy', 'dots', 'beans', 'anime', 'sleepy', 'small']),
  };
}

/** The temperament line: how patient they are decides where a marriage breaks. */
export function divorceLineFor(warmth) {
  return Math.round(36 - warmth * 22);
}

/**
 * Someone the player might meet: the opposite gender, close in age, with a
 * job, a body and a temperament of their own. Plain data, so it survives a
 * save inside an event.
 */
export function makeCandidate(game, random) {
  const gender = game.character?.gender === 'female' ? 'male' : 'female';
  const age = Math.round(clamp(game.player.age + random.int(-4, 3), 23, 55));
  const career = random.pick(PARTNER_CAREERS);
  const warmth = Math.round(random.between(0.1, 0.95) * 100) / 100;
  const raiseYears = Math.max(0, Math.min(age, FAMILY.partnerRaiseUntil) - 28);
  return {
    name: `${random.pick(gender === 'female' ? FEMALE_NAMES : MALE_NAMES)} ${random.pick(SURNAMES)}`,
    gender,
    age,
    mbti: random.pick(MBTI_TYPES),
    career: career.title,
    income: Math.round(career.salary * Math.pow(1 + FAMILY.partnerRaisePerYear, raiseYears) / 1000) * 1000,
    // Hours a day they are happy to have you work, and how patient they are.
    workTolerance: Math.round(random.between(8, 12) * 2) / 2,
    warmth,
    divorceLine: divorceLineFor(warmth),
    health: Math.round(random.between(78, 95)),
    motivation: Math.round(random.between(60, 80)),
    look: partnerLook(random, gender),
  };
}

/** Start dating a candidate. */
export function startDating(game, candidate) {
  game.partner = {
    ...candidate,
    stage: 'dating',
    since: game.quarterIndex,
    bond: FAMILY.bondStart,
    waited: 0,
    leaveQuarters: 0,
    laidOffQuarters: 0,
    lastDateNight: -99,
  };
  game.family = null;
  record(game, 'dating', { partner: candidate.name });
}

/** The wedding. */
export function marry(game) {
  const partner = game.partner;
  if (!partner) {
    game.married = true;
    return;
  }
  partner.stage = 'married';
  partner.marriedQuarter = game.quarterIndex;
  game.married = true;
  game.family = { quality: FAMILY.startQuality, below: 0, warned: false, boost: 0, boostQuarters: 0 };
  bumpSocial(game, 8);
  record(game, 'married', { partner: partner.name });
}

export function isDating(game) {
  return game.partner?.stage === 'dating';
}

export function isMarried(game) {
  return Boolean(game.married);
}

/** Quarters the couple have been together. */
export function quartersTogether(game) {
  return game.partner ? game.quarterIndex - game.partner.since : 0;
}

/** What the partner earns this quarter, before tax, with leave and layoffs. */
export function partnerIncome(game) {
  const partner = game.partner;
  if (!partner || partner.stage !== 'married') return 0;
  if (partner.laidOffQuarters > 0) return 0;
  const share = partner.leaveQuarters > 0 ? FAMILY.partnerLeaveIncomeShare : 1;
  return partner.income * share;
}

/** What a married partner adds to take-home pay, a year, after tax. */
export function partnerTakeHome(game) {
  const gross = partnerIncome(game);
  const rate = MONEY.taxBase + MONEY.taxRise * Math.min(1, gross / MONEY.taxRiseSalary);
  return gross * (1 - rate);
}

/** What the partner adds to the household's committed costs, a year. */
export function partnerCostPerYear(game) {
  if (!game.married) return 0;
  return game.partner ? FAMILY.partnerLivingCost : 6000;
}

// ── The marriage ───────────────────────────────────────────────────────

/** The terms the family bar drifts toward, and their sum. */
export function familyTarget(game) {
  const player = game.player;
  const partner = game.partner;
  const terms = [];
  const add = (label, value) => terms.push({ label, value });
  add('A good start', FAMILY.baseTarget);
  if (!partner) return { terms, target: FAMILY.baseTarget };
  const young = kidsUnder(game, 5).length;
  const excess = Math.max(0, player.plan.hours - partner.workTolerance);
  const hoursFactor = 1 + FAMILY.youngChildHoursFactor * young;
  add(`Hours past what ${partner.name.split(' ')[0]} tolerates (${partner.workTolerance})`, -Math.min(FAMILY.hoursPenaltyCap, FAMILY.hoursPenaltyPerHour * excess * hoursFactor));
  add('Evenings to rest together', FAMILY.restBonus * player.plan.shares[RECOVERY]);
  add('Temperament', (partner.warmth - 0.5) * FAMILY.warmthWeight);
  if (game.savings < 0) add('Money worries', -FAMILY.debtStrain);
  if (!game.employment.employed) add('The job search', -FAMILY.joblessStrain);
  if (game.family?.boostQuarters > 0) add('Making an effort', game.family.boost);
  if (partner.motivation < 35) add(`${partner.name.split(' ')[0]} is low`, -(35 - partner.motivation) * 0.3);
  const target = terms.reduce((sum, term) => sum + term.value, 0);
  return { terms, target };
}

function advanceFamily(game, report) {
  const family = game.family;
  const partner = game.partner;
  if (!family || !partner) return;
  const { target } = familyTarget(game);
  family.quality = clamp(family.quality + FAMILY.driftPerQuarter * (target - family.quality), 0, 100);
  if (family.boostQuarters > 0) family.boostQuarters -= 1;
  const line = partner.divorceLine;
  if (family.quality < line) family.below += 1;
  else family.below = 0;
  if (family.quality < line + FAMILY.warnMargin && !family.warned) {
    family.warned = true;
    game.flags.scheduled.push({ id: 'coupleTalk', quarter: game.quarterIndex + 1, data: {} });
  }
  if (family.quality >= line + FAMILY.warnMargin + 10) family.warned = false;
  report.family = Math.round(family.quality);
  return family.below >= FAMILY.divorceQuarters;
}

// ── Partner simulation ─────────────────────────────────────────────────

function advancePartner(game, report) {
  const partner = game.partner;
  if (!partner) return false;
  const years = 0.25;
  partner.age += years;
  const married = partner.stage === 'married';
  if (married) {
    if (partner.leaveQuarters > 0) partner.leaveQuarters -= 1;
    if (partner.laidOffQuarters > 0) partner.laidOffQuarters -= 1;
    if (partner.age < FAMILY.partnerRaiseUntil && game.quarterIndex % 4 === 3) partner.income = Math.round(partner.income * (1 + FAMILY.partnerRaisePerYear));
    const young = kidsUnder(game, 2).length;
    const wear = Math.max(0, partner.age - 45) * 0.4;
    const healthTarget = 88 - wear - 3 * young;
    partner.health = clamp(partner.health + 0.2 * (healthTarget - partner.health), 0, 100);
    const lift = Math.min(10, kidsAtHome(game).length * 3);
    const moodTarget = 42 + 0.4 * (game.family?.quality ?? 60) + lift - (partner.laidOffQuarters > 0 ? 15 : 0);
    partner.motivation = clamp(partner.motivation + 0.25 * (moodTarget - partner.motivation), 0, 100);
    return false;
  }
  // Dating: closeness follows how much of the player's time they get.
  const excess = Math.max(0, game.player.plan.hours - partner.workTolerance);
  const target = FAMILY.bondTarget + (partner.warmth - 0.5) * 12 - FAMILY.bondHoursPenalty * excess;
  partner.bond = clamp(partner.bond + FAMILY.bondDrift * (target - partner.bond), 0, 100);
  if (partner.bond < FAMILY.breakupLine && game.random.chance(FAMILY.breakupChance)) return 'bond';
  if (partner.waited >= FAMILY.proposalPatience && game.random.chance(0.2)) return 'waited';
  return false;
}

/** The effects of an ending that every kind of ending shares. */
function releasePartner(game) {
  if (game.partner) game.exPartner = { ...game.partner };
  game.partner = null;
  game.family = null;
}

/** A dating relationship ends: no marriage, but a lingering low. */
export function breakUp(game, reason, report = null) {
  const partner = game.partner;
  if (!partner) return;
  const first = partner.name.split(' ')[0];
  game.player.motivation -= 8 * blowResilience(game.player.age);
  bumpSocial(game, -4);
  game.flags.divorceShadow = Math.max(game.flags.divorceShadow ?? 0, 6);
  record(game, 'breakup', { partner: partner.name, reason });
  releasePartner(game);
  if (report) {
    report.breakup = true;
    report.notes.push(reason === 'waited'
      ? `${first} ends it. After waiting this long for an answer, they want a life that is going somewhere.`
      : `${first} ends it. The long hours left too little of you to love.`);
  }
}

/**
 * What every ending of a marriage does beyond the money: the partner and the
 * family bar go, friends take sides, and a shadow lingers on the mood. The
 * mood hit itself is applied by the caller (divorce in game.js).
 */
export function afterDivorce(game, reason) {
  const partner = game.partner;
  bumpSocial(game, -FAMILY.divorceSocialLoss);
  game.flags.divorceShadow = FAMILY.divorceShadow;
  record(game, 'divorce', { partner: partner?.name ?? null, reason, kids: kidsAtHome(game).length });
  releasePartner(game);
}

// ── The quarter ────────────────────────────────────────────────────────

/**
 * Advance the life outside the office by a quarter. Returns 'divorce' when
 * the marriage has been under the line long enough to end.
 */
export function closeLifeQuarter(game, report) {
  advanceSocial(game);
  syncDependents(game);
  if (game.flags.divorceShadow) game.flags.divorceShadow *= FAMILY.divorceShadowFade;
  if (game.flags.divorceShadow < 0.5) game.flags.divorceShadow = 0;
  const partnerEnd = advancePartner(game, report);
  if (partnerEnd) {
    breakUp(game, partnerEnd, report);
    return null;
  }
  if (game.married && game.partner && advanceFamily(game, report)) return 'divorce';
  return null;
}

// ── Mood ───────────────────────────────────────────────────────────────

/**
 * The extra terms the circle, a partner and children put on the mood
 * target: [{ label, value }].
 */
export function lifeMoodTerms(game) {
  const terms = [];
  const player = game.player;
  const social = game.social ?? SOCIAL.start;
  const circle = clamp((social - socialNeed(player)) * SOCIAL.motivationWeight, -SOCIAL.motivationCap, SOCIAL.motivationCap);
  terms.push({ label: isExtrovert(player) ? 'Social circle (extroverts need more)' : 'Social circle', value: game.married && game.family ? circle * SOCIAL.marriedShare : circle });
  if (game.married && game.family) {
    const quality = clamp((game.family.quality - FAMILY.moodReference) * FAMILY.moodWeight, FAMILY.moodFloor, FAMILY.moodCeiling);
    terms.push({ label: 'Family life', value: quality });
  } else if (isDating(game)) {
    terms.push({ label: 'Someone to come home to', value: Math.min(FAMILY.datingLiftCap, game.partner.bond * FAMILY.datingLift) });
  }
  const kids = kidsAtHome(game).length + legacyKids(game);
  if (kids > 0) terms.push({ label: 'Kids at home', value: Math.min(FAMILY.kidMotivationCap, FAMILY.kidMotivation * kids) });
  if (game.flags.divorceShadow > 0.5) terms.push({ label: game.exPartner && !game.married ? 'After the split' : 'After the breakup', value: -game.flags.divorceShadow });
  return terms;
}

// ── Things the player does ─────────────────────────────────────────────

/** A night out for two: costs a little, lifts the bond or the marriage. */
export function dateNightStatus(game) {
  const partner = game.partner;
  if (!partner) return { allowed: false, reason: 'No one to take out.' };
  if (partner.lastDateNight === game.quarterIndex) return { allowed: false, reason: 'You already did this quarter.' };
  if (game.savings < FAMILY.dateNightCost) return { allowed: false, reason: 'Money is too tight.' };
  return { allowed: true, reason: 'Dinner, no phones.' };
}

export function dateNight(game) {
  const status = dateNightStatus(game);
  if (!status.allowed) return status.reason;
  const partner = game.partner;
  partner.lastDateNight = game.quarterIndex;
  game.savings -= FAMILY.dateNightCost;
  if (game.family) game.family.quality = clamp(game.family.quality + FAMILY.dateNightLift, 0, 100);
  else partner.bond = clamp(partner.bond + FAMILY.dateNightLift, 0, 100);
  game.player.motivation += 1.5;
  return `A night out with ${partner.name.split(' ')[0]}. Your phone stays in your pocket.`;
}
