// Every tuning value lives here with the reasoning it was set against.
// Units: health and motivation are 0–100; rates are per quarter (a turn of
// 60 workdays) unless the name says otherwise; money is US dollars a year.
// The balance targets these dials were tuned to are in tools/balance.js.

export const TIME = {
  daysPerQuarter: 60,
  startAge: 22,
  // 40 years, 160 quarters: a whole career in roughly half an hour of play
  // at the default speed.
  retirementAge: 62,
};

export const BANDWIDTH = {
  // Every hour past 8 is worth three quarters of one: tiredness within the
  // day, before any lasting cost to health.
  standardHours: 8,
  overtimeHourValue: 0.75,
  minHours: 6,
  maxHours: 16,
  // Burnout halves task execution speed, as the design asks.
  burnoutSpeed: 0.5,
};

export const HEALTH = {
  // Health drifts toward a target, a tenth of the gap each quarter: a body
  // takes years, not weeks, to wear down or come back.
  driftPerQuarter: 0.1,
  // A healthy 22-year-old on standard hours.
  baseTarget: 95,
  // Strain is the share of the way from 8 to 16 hours, squared. 150 puts
  // the target near −55 at 16 hours (death in about four years), near 57 at
  // 12 hours, and costs almost nothing at 9.
  strainDamage: 150,
  // Rest share of bandwidth lifts the target: half the week protected is
  // worth 15 points.
  restBonus: 30,
  // Wear from age past 35, per year: 22 points by 60 on standard hours.
  ageWearFrom: 35,
  ageWearPerYear: 0.9,
  // Below this, a heart scare can strike in any quarter.
  dangerLine: 25,
  scareChancePerQuarter: 0.25,
  scareDamage: 15,
};

export const MOTIVATION = {
  // A quarter of the gap each quarter: mood moves within a year.
  driftPerQuarter: 0.25,
  baseTarget: 72,
  // Exhaustion is the same squared strain as health: 16 hours alone pull the
  // target to −18, so motivation runs out; 12 hours cost 22 points.
  exhaustionDrain: 90,
  restBonus: 25,
  // Years at one level past the expected pace, each costing this much from
  // the target, up to the cap.
  stagnationPerYear: 3,
  stagnationCap: 15,
  promotionLift: 25,
  highImpactLift: 10,
  projectFailureHit: 8,
  leapfrogHit: 15,
  pipHit: 12,
  firedHit: 18,
  laidOffHit: 15,
  // Below this the player is burned out: productivity at 0.4, a grey
  // screen, and only real rest brings it back.
  burnoutLine: 20,
  burnoutProductivity: 0.4,
  burnoutMinQuarters: 2,
  burnoutExitLine: 45,
  // While burned out, rest is the only way up: at least this share of
  // bandwidth on recovery and no more than these hours a day.
  burnoutRestShare: 0.35,
  burnoutMaxHours: 9,
  burnoutRecoveryBase: 25,
  burnoutRecoveryPerRest: 70,
  burnoutSlideTarget: -20,
  // Burnout rested properly counts as medical leave: the quarter is not
  // rated, so no PIP, but nothing is earned toward a promotion either.
};

export const PERFORMANCE = {
  // Raw daily output is scaled so a typical quarter scores near 100, which
  // makes the noise a share of a score. The design's N(0, 5) is widened a
  // little: a review is partly luck.
  quarterScale: 12,
  noiseDeviation: 7,
  politicalWeight: 0.5,
  // Health and motivation multipliers on top of their effect on bandwidth.
  healthFloor: 0.7,
  motivationFloor: 0.85,
  motivationCeiling: 1.1,
  // Skill from 0 to 100 moves output from 0.7× to 1.3×.
  skillFloor: 0.7,
  skillRange: 0.6,
  // Percentile brackets, as the design states them.
  greatlyExceedsTop: 0.05,
  exceedsTop: 0.2,
  meetAllTop: 0.5,
  meetSomeBottom: 0.15,
  // A bottom-bracket rating only becomes a PIP when it is also clearly
  // behind the pack, so a tight team does not fire someone every quarter.
  pipBelowMedian: 0.85,
};

export const SKILL = {
  // Learning by doing, and faster by deliberate upskilling; both slow as
  // skill nears its ceiling.
  learnFromWork: 4,
  learnFromRest: 7,
  startMean: 20,
};

export const READINESS = {
  threshold: 100,
  // Readiness per quarter from a day's average citizenship and politics
  // bandwidth, plus the quarter's rating. Each level up divides the gain by
  // another 0.7: a steady "meets all" earns the first rung in about three
  // years, while the upper rungs need extra work as well as results.
  citizenshipWeight: 1.8,
  politicsWeight: 2.2,
  levelDifficulty: 0.7,
  // Politics counts for more the higher the chair: +15% a level.
  politicsPerLevel: 0.15,
  ratingBonus: { greatlyExceeds: 14, exceeds: 10, meetAll: 6, meetMost: 3, meetSome: -15 },
  // With no chair open, readiness past the line fades back toward it, and
  // it never banks beyond the cap: being over-ready does not stack.
  decayWithoutChair: 8,
  cap: 130,
};

export const RELATIONSHIP = {
  mentoringGain: 3,
  helpingGain: 4,
  networkingGain: 2,
  leapfrogLoss: 12,
  // Ledger values that turn a peer into a friend or an enemy.
  loyalLine: 40,
  hostileLine: -40,
  sabotageHit: 0.08,
};

export const ORG = {
  // Chance an internal candidate fills a chair when one is ready; the rest
  // go to outside hires. The top two chairs are contested across the
  // company: other divisions' leaders want them too.
  internalFillChance: [0.75, 0.75, 0.75, 0.7, 0.6, 0.45, 0.3, 0.12],
  // How much political skill weighs when choosing between ready
  // candidates, per level of the chair: nothing at the bottom, a lot at
  // the top.
  promotionPoliticsPerLevel: 0.06,
  quitBase: 0.015,
  quitUnhappy: 0.06,
  quitOpen: 0.03,
  // Expected years at each level before stagnation starts to bite.
  expectedYearsAtLevel: [2, 2.5, 3, 3.5, 4, 5, 6, 8],
  managementFromLevel: 4,
};

export const MONEY = {
  startSavings: 12000,
  // Effective tax rises from 18% toward 30% as pay approaches $500k.
  taxBase: 0.18,
  taxRise: 0.12,
  taxRiseSalary: 500000,
  // Living costs: a floor plus lifestyle that grows with take-home pay.
  livingFloor: 32000,
  lifestyleShare: 0.7,
  // Out of work the lifestyle shrinks, but not to nothing.
  unemployedLifestyleShare: 0.2,
  unemploymentBenefitPerQuarter: 7000,
  benefitQuarters: 2,
  severanceQuarters: 1,
  // Real return on savings a year, by market mood.
  returns: { boom: 0.09, normal: 0.05, recession: -0.06 },
  meritRaise: { greatlyExceeds: 0.08, exceeds: 0.05, meetAll: 0.03, meetMost: 0.02, meetSome: 0 },
  // Pay at a level runs from its base to this multiple of it. Raises,
  // counter-offers and job hops stop at the top of the band: past it, the
  // only way up is a bigger title.
  bandTop: 1.5,
};

export const JOBS = {
  headhunterBase: 0.02,
  headhunterOpen: 0.22,
  // Distraction from keeping every door open.
  openFocusCost: 0.1,
  searchBase: 0.25,
  searchOpen: 0.45,
  searchStigmaPerQuarter: 0.06,
  searchAgePenaltyFrom: 50,
  reentryDemoteAfterQuarters: 3,
};

export const EVENTS = {
  chancePerQuarter: 0.75,
  // The design's split; the last fifth is the industry's own events.
  categoryWeights: { macro: 15, interpersonal: 40, lifestyle: 25, industry: 20 },
};

// Projects are measured in standard days: what an average worker at the
// level puts out in a day of core work.
export const PROJECTS = {
  standardDayOutput: 5,
  catalog: {
    maintenance: { name: 'Maintenance backlog', effort: 25, impact: 'low', successBonus: 4, failurePenalty: 6 },
    demo: { name: 'Product demo', effort: 40, impact: 'high', successBonus: 10, failurePenalty: 10, readiness: 8 },
    moonshot: { name: 'Moonshot', effort: 60, impact: 'high', successBonus: 25, failurePenalty: 15, readiness: 25, risky: true, unlockLevel: 3 },
    workshop: { name: 'Host a workshop', effort: 18, impact: 'medium', successBonus: 2, failurePenalty: 2, readiness: 10, usesCitizenship: true },
  },
  // A moonshot that is fully done still only lands this often.
  moonshotLanding: 0.6,
};

// Levels and money per industry. Industries are patches over the default:
// a variant states only what differs.
const DEFAULT_INDUSTRY = {
  id: 'tech',
  name: 'Technology',
  titles: ['Junior Engineer', 'Software Engineer', 'Senior Engineer', 'Staff Engineer', 'Engineering Manager', 'Director', 'VP Engineering', 'CTO'],
  salaries: [115000, 150000, 200000, 270000, 350000, 450000, 650000, 1200000],
  seats: [16, 14, 11, 8, 5, 3, 2, 1],
  // How hard the typical peer works here, in hours a day.
  peerHours: 9,
  // Face time: the review credit for being seen working late, per hour
  // past 8, as a share of the score. Some cultures reward it more than the
  // work it produces.
  faceTimePerHour: 0.01,
  upOrOutQuarters: null,
  upOrOutBelowLevel: null,
  tenureFromLevel: null,
  contractQuarters: null,
  subStat: 'techDebt',
  project: { id: 'refactor', name: 'Refactoring sprint', effort: 25, impact: 'low', successBonus: 2, failurePenalty: 4 },
  bonusShare: [0, 0, 0.05, 0.1, 0.15, 0.2, 0.3, 0.5],
};

export const INDUSTRIES = {
  tech: DEFAULT_INDUSTRY,
  consulting: {
    ...DEFAULT_INDUSTRY,
    id: 'consulting',
    name: 'Management Consulting',
    titles: ['Analyst', 'Consultant', 'Senior Consultant', 'Manager', 'Senior Manager', 'Principal', 'Partner', 'Managing Partner'],
    salaries: [95000, 130000, 180000, 250000, 350000, 500000, 800000, 1500000],
    seats: [18, 14, 10, 7, 5, 3, 2, 1],
    peerHours: 10.5,
    faceTimePerHour: 0.03,
    // Up or out: 16 quarters at a level below Principal and you are
    // counselled out.
    upOrOutQuarters: 16,
    upOrOutBelowLevel: 5,
    subStat: 'utilization',
    project: { id: 'pitch', name: 'Client pitch', effort: 30, impact: 'high', successBonus: 8, failurePenalty: 8, readiness: 6 },
    bonusShare: [0.05, 0.1, 0.15, 0.2, 0.25, 0.35, 0.6, 1],
  },
  privateEquity: {
    ...DEFAULT_INDUSTRY,
    id: 'privateEquity',
    name: 'Private Equity',
    titles: ['Analyst', 'Associate', 'Senior Associate', 'Vice President', 'Principal', 'Director', 'Managing Director', 'Founding Partner'],
    salaries: [150000, 220000, 320000, 450000, 650000, 1000000, 1800000, 3500000],
    seats: [10, 8, 6, 4, 3, 2, 2, 1],
    peerHours: 12,
    faceTimePerHour: 0.045,
    upOrOutQuarters: 16,
    upOrOutBelowLevel: 4,
    subStat: 'dealFlow',
    project: { id: 'deck', name: 'Pitch deck', effort: 30, impact: 'high', successBonus: 6, failurePenalty: 6, readiness: 4 },
    bonusShare: [0.1, 0.2, 0.3, 0.5, 0.7, 1, 1.5, 2.5],
  },
  academia: {
    ...DEFAULT_INDUSTRY,
    id: 'academia',
    name: 'Education & Academia',
    titles: ['Postdoc', 'Assistant Professor', 'Associate Professor', 'Professor', 'Endowed Chair', 'Department Chair', 'Dean', 'Provost'],
    salaries: [55000, 85000, 110000, 150000, 180000, 230000, 300000, 450000],
    seats: [12, 10, 8, 7, 3, 2, 1, 1],
    peerHours: 9.5,
    faceTimePerHour: 0,
    upOrOutQuarters: null,
    // The tenure clock: an assistant professor gets 24 quarters, then
    // either tenure (no PIPs, no layoffs) or the door.
    tenureClockQuarters: 24,
    tenureFromLevel: 2,
    // Postdoc contracts end after 12 quarters.
    contractQuarters: 12,
    subStat: 'citations',
    project: { id: 'grant', name: 'Grant proposal', effort: 30, impact: 'high', successBonus: 6, failurePenalty: 4, readiness: 8 },
    bonusShare: [0, 0, 0, 0, 0, 0, 0, 0],
  },
};

export const INDUSTRY_STATS = {
  techDebt: {
    label: 'Tech debt index',
    // Debt rises with delivery, faster when tired, and is paid down by
    // refactoring. At 100 a pager goes off on roughly one night in ten.
    growthPerCoreShare: 12,
    tiredGrowth: 1.5,
    naturalPaydown: 4,
    refactorPaydown: 45,
    incidentChancePerDayAtFull: 0.1,
    // At full debt (6 incidents a quarter) this pulls the long-run health
    // level down ~15 points: a real cost of never refactoring, not a death.
    incidentHealth: 0.25,
    incidentMotivation: 0.15,
  },
  utilization: {
    label: 'Client utilization',
    // Billable hours over a standard week. Travel grows with it.
    travelHealthPerUtilization: 14,
    sweetSpotLow: 0.75,
    sweetSpotHigh: 1.05,
    failedClientPenalty: 0.15,
  },
  dealFlow: {
    label: 'Deal flow velocity',
    sourcingWeight: 6,
    modellingWeight: 2,
    pitchDeckBoost: 30,
    dealPerformance: 22,
    dealCarry: 0.15,
  },
  citations: {
    label: 'Citation index',
    // Research becomes papers through a pipeline; papers earn citations
    // for years after.
    researchPerPaper: 120,
    citationsPerPaperPerQuarter: 1.5,
    grantChancePerProposal: 0.35,
    grantOutputBoost: 0.15,
    tenureCitationBar: 60,
  },
};

// The four templates from the design. Stats as given; traits as described.
export const CHARACTERS = [
  {
    id: 'marcus',
    name: 'Marcus Vance',
    mbti: 'INTJ',
    iq: 140,
    pol: 60,
    archetype: 'Systems Thinker',
    blurb: 'Bonus to solitary architectural and technical work. Unstructured networking drains him badly.',
    traits: { coreBonus: 1.15, networkingDrain: 45, networkingHealthDrain: 10 },
    look: { skin: '#e0b48f', hair: '#3a2a20', suit: '#2f3a4a' },
  },
  {
    id: 'elena',
    name: 'Elena Rostova',
    mbti: 'ENFP',
    iq: 140,
    pol: 110,
    archetype: 'Charismatic Catalyst',
    blurb: 'Builds relationships and alliances fast. Long stretches of isolated desk work sap her motivation.',
    traits: { relationshipBonus: 1.5, politicsBonus: 1.2, deskWorkDrain: 50, deskWorkLimit: 0.45 },
    look: { skin: '#f1c6a6', hair: '#8a4b2a', suit: '#4a3260' },
  },
  {
    id: 'maya',
    name: 'Maya Lin',
    mbti: 'ENTP',
    iq: 150,
    pol: 95,
    archetype: 'Disruptive Innovator',
    blurb: 'Moonshots open from day one and land more often. Clashes with rigid, traditional leadership.',
    traits: { moonshotUnlocked: true, moonshotLanding: 1.25, rigidManagerClash: 0.25 },
    look: { skin: '#e9c39c', hair: '#151515', suit: '#25505a' },
  },
  {
    id: 'david',
    name: 'David Thorne',
    mbti: 'ISTJ',
    iq: 130,
    pol: 105,
    archetype: 'The Anchor',
    blurb: 'Shrugs off long hours: strain and exhaustion hit him far less. Slow to adapt when strategy pivots.',
    traits: { strainResistance: 0.55, exhaustionResistance: 0.6, pivotPenalty: 1.6 },
    look: { skin: '#c99a76', hair: '#5a5a5a', suit: '#3b3b3b' },
  },
];

// What a peer's personality looks like, drawn per agent.
export const PEERS = {
  // Selective employers hire people about as sharp as the roster; each
  // level up is a further filter.
  iqMean: 134,
  iqPerLevel: 2,
  iqDeviation: 10,
  polMean: 95,
  polDeviation: 20,
  rigidManagerChance: 0.35,
};
