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
  // Below this the player is burned out: a grey screen, bandwidth halved,
  // and productivity falling from 0.4 at the line to nothing at zero.
  // Motivation at zero never ends a career; it leaves you unable to work,
  // which the reviews then punish.
  burnoutLine: 20,
  burnoutProductivity: 0.4,
  burnoutMinQuarters: 1,
  burnoutExitLine: 40,
  // Burned out, the motivation target sits this far below normal unless
  // at least fullRecoveryShare of bandwidth goes to Recovery, and the more
  // you rest the faster it climbs: full rest triples the pace.
  burnoutDrag: 30,
  fullRecoveryShare: 0.4,
  restSpeedup: 2,
  // Burned out with at least this much on Recovery counts as sick leave:
  // the quarter is not rated, so no PIP, and nothing is earned toward a
  // promotion either.
  burnoutRestShare: 0.35,
  // Motivation at zero is a breakdown and ends the career, but the last
  // stretch resists: any fall inside the bottom breakdownBuffer points,
  // day by day or in one blow, counts at bufferResistance of its size. A
  // grinder in burnout with no rest takes about a year and a half to slide
  // through it; a single firing near the bottom costs four points, not 18.
  breakdownBuffer: 10,
  bufferResistance: 0.25,
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
  // The full premium to keep an employer plan after leaving: about $700 a month.
  cobraPerQuarter: 2100,
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

// FMLA: twelve weeks of unpaid, job-protected leave, open after a year
// with the employer and once a year after that. No work, no pay, no
// rating; health and motivation recover half again as fast as resting at
// work: a burned-out player comes back near 70%, not fully restored.
export const FMLA = {
  leaveDays: 60,
  eligibleAfterQuarters: 4,
  cooldownQuarters: 4,
  recoveryBoost: 1.5,
};

export const EVENTS = {
  // One work event at the start of a quarter, from the design's split; the
  // last share is the industry's own. Out of work, the job-search deck.
  chancePerQuarter: 0.7,
  categoryWeights: { macro: 15, interpersonal: 40, industry: 25 },
  joblessChancePerQuarter: 0.8,
  // Life does not wait for quarter boundaries: up to two personal events
  // land on random days, employed or not.
  lifeEventChance: 0.5,
  secondLifeEventChance: 0.15,
  firstLifeDay: 5,
  lastLifeDay: 55,
};

// Projects are measured in standard days: what an average worker at the
// level puts out in a day of core work (a 9-hour, 55%-delivery quarter is
// about 60). Citizenship projects run on Mentoring bandwidth instead.
// Every industry has its own list; each project has a role the bots and
// peers choose by (safe, visible, big, risky, citizenship, special), and
// effects on the industry meter when it lands.
export const PROJECTS = {
  standardDayOutput: 5,
  // A risky project that is fully done still only lands this often.
  riskyLanding: 0.6,
};

const TECH_PROJECTS = [
  { id: 'oncall', role: 'safe', name: 'On-call rotation and bug queue', effort: 25, impact: 'low', successBonus: 4, failurePenalty: 6, effects: { techDebt: -4 },
    blurb: 'Close tickets, carry the pager. Hard to fail, easy to overlook.' },
  { id: 'feature', role: 'visible', name: 'Ship a feature behind a flag', effort: 42, impact: 'high', successBonus: 10, failurePenalty: 10, readiness: 8, effects: { techDebt: 6 },
    blurb: 'Spec, build, dogfood, ramp to 100%. Leadership sees launches; debt grows.' },
  { id: 'designDoc', role: 'special', name: 'Write the design doc and RFC', effort: 30, impact: 'medium', successBonus: 5, failurePenalty: 4, readiness: 10,
    blurb: 'Survive the review with three principal engineers. Readiness for the next rung.' },
  { id: 'migration', role: 'big', name: 'Lead a platform migration', effort: 58, impact: 'high', successBonus: 14, failurePenalty: 12, readiness: 12, unlockLevel: 2, effects: { techDebt: -20 },
    blurb: 'Move forty services off the legacy stack without an outage.' },
  { id: 'refactor', role: 'repair', name: 'Refactoring sprint', effort: 28, impact: 'low', successBonus: 2, failurePenalty: 4, effects: { techDebt: -45 },
    blurb: 'Pay down tech debt: fewer 2 AM pages. Product will grumble.' },
  { id: 'techTalk', role: 'citizenship', name: 'Give an internal tech talk series', effort: 60, impact: 'medium', successBonus: 2, failurePenalty: 2, readiness: 10, usesCitizenship: true,
    blurb: 'Runs on Mentoring bandwidth. Goodwill and readiness.' },
  { id: 'launch', role: 'risky', name: 'Launch a new product line', effort: 64, impact: 'high', successBonus: 25, failurePenalty: 15, readiness: 25, risky: true, unlockLevel: 3, effects: { techDebt: 12 },
    blurb: 'Zero to GA in a quarter. Careers are made here, when it lands.' },
];

const CONSULTING_PROJECTS = [
  { id: 'research', role: 'safe', name: 'Benchmarking and market sizing', effort: 25, impact: 'low', successBonus: 4, failurePenalty: 6,
    blurb: 'Spreadsheets, expert calls, a clean appendix.' },
  { id: 'diligence', role: 'visible', name: 'Commercial due diligence sprint', effort: 42, impact: 'high', successBonus: 10, failurePenalty: 10, readiness: 6, effects: { clientScore: 8 },
    blurb: 'Four weeks, one buyer, forty interviews, a red-flag memo.' },
  { id: 'proposal', role: 'special', name: 'Write an RFP response', effort: 30, impact: 'high', successBonus: 8, failurePenalty: 8, readiness: 8, effects: { clientScore: 5 },
    blurb: 'Business development: sell the next engagement.' },
  { id: 'costProgram', role: 'big', name: 'Run a cost-reduction program', effort: 58, impact: 'high', successBonus: 14, failurePenalty: 12, readiness: 12, unlockLevel: 2, effects: { clientScore: 12 },
    blurb: 'Find 15% of opex, then help the client defend it.' },
  { id: 'article', role: 'repair', name: 'Publish a thought-leadership piece', effort: 28, impact: 'medium', successBonus: 4, failurePenalty: 3, readiness: 6,
    blurb: 'A byline in the firm journal. Partners read it on planes.' },
  { id: 'analystTraining', role: 'citizenship', name: 'Train the new analyst class', effort: 60, impact: 'medium', successBonus: 2, failurePenalty: 2, readiness: 10, usesCitizenship: true,
    blurb: 'Runs on Mentoring bandwidth. The juniors remember who taught them.' },
  { id: 'transformation', role: 'risky', name: 'Lead a digital transformation', effort: 66, impact: 'high', successBonus: 25, failurePenalty: 15, readiness: 25, risky: true, unlockLevel: 3, effects: { clientScore: 15 },
    blurb: 'A three-year program sold in a quarter. Partner-making, if it lands.' },
];

const PE_PROJECTS = [
  { id: 'lbo', role: 'safe', name: 'Build the LBO model', effort: 25, impact: 'low', successBonus: 4, failurePenalty: 6, effects: { dealFlow: 4 },
    blurb: 'Three statements, a debt schedule, returns at five exit multiples.' },
  { id: 'confirmatory', role: 'visible', name: 'Run confirmatory diligence', effort: 42, impact: 'high', successBonus: 10, failurePenalty: 10, readiness: 6, effects: { dealFlow: 12 },
    blurb: 'Quality of earnings, legal, IT, management references.' },
  { id: 'icMemo', role: 'special', name: 'Write the investment committee memo', effort: 32, impact: 'high', successBonus: 8, failurePenalty: 8, readiness: 10,
    blurb: 'Sixty pages that the IC will tear apart in ninety minutes.' },
  { id: 'valueCreation', role: 'big', name: 'Portfolio value-creation plan', effort: 56, impact: 'high', successBonus: 14, failurePenalty: 12, readiness: 12, unlockLevel: 2,
    blurb: 'Pricing, procurement, a new CFO. EBITDA is the scoreboard.' },
  { id: 'lpDeck', role: 'repair', name: 'Prepare the LP update deck', effort: 28, impact: 'medium', successBonus: 4, failurePenalty: 4, readiness: 4, effects: { dealFlow: 20 },
    blurb: 'Keep the investors warm. Feeds deal flow and the next fund.' },
  { id: 'analystClass', role: 'citizenship', name: 'Recruit and train the analyst class', effort: 60, impact: 'medium', successBonus: 2, failurePenalty: 2, readiness: 10, usesCitizenship: true,
    blurb: 'Runs on Mentoring bandwidth. Superdays, then modelling boot camp.' },
  { id: 'proprietary', role: 'risky', name: 'Source a proprietary deal', effort: 64, impact: 'high', successBonus: 25, failurePenalty: 15, readiness: 25, risky: true, unlockLevel: 3, effects: { dealFlow: 40 },
    blurb: 'A founder who will not talk to bankers. If it closes, it is yours.' },
];

const ACADEMIA_PROJECTS = [
  { id: 'teaching', role: 'safe', name: 'Teach your course load', effort: 25, impact: 'low', successBonus: 4, failurePenalty: 6,
    blurb: 'Lectures, office hours, 180 midterms to grade.' },
  { id: 'paper', role: 'visible', name: 'Write a journal paper', effort: 42, impact: 'high', successBonus: 8, failurePenalty: 8, readiness: 6, effects: { researchProgress: 60 },
    blurb: 'Draft, co-author fights, submit. Moves you a paper closer.' },
  { id: 'grant', role: 'special', name: 'Write a grant proposal', effort: 34, impact: 'high', successBonus: 6, failurePenalty: 4, readiness: 8, grant: true,
    blurb: 'If it is in on time, a chance at two years of funding.' },
  { id: 'labSeries', role: 'big', name: 'Run a lab experiment series', effort: 56, impact: 'high', successBonus: 12, failurePenalty: 10, readiness: 10, unlockLevel: 1, effects: { researchProgress: 90 },
    blurb: 'Six months of data in three. The paper writes itself, almost.' },
  { id: 'committee', role: 'repair', name: 'Serve on the hiring committee', effort: 20, impact: 'low', successBonus: 3, failurePenalty: 2, readiness: 8,
    blurb: 'Read 300 applications. The department notices who does service.' },
  { id: 'phdStudents', role: 'citizenship', name: 'Supervise PhD students', effort: 60, impact: 'medium', successBonus: 2, failurePenalty: 2, readiness: 10, usesCitizenship: true, effects: { researchProgress: 30 },
    blurb: 'Runs on Mentoring bandwidth. Their papers carry your name.' },
  { id: 'monograph', role: 'risky', name: 'Write a monograph', effort: 70, impact: 'high', successBonus: 22, failurePenalty: 12, readiness: 25, risky: true, unlockLevel: 2, effects: { citations: 40 },
    blurb: 'The book that defines a field, or a manuscript in a drawer.' },
];

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
  projects: TECH_PROJECTS,
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
    projects: CONSULTING_PROJECTS,
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
    projects: PE_PROJECTS,
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
    projects: ACADEMIA_PROJECTS,
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

// The four characters. Everyone in the game goes by first name and last
// initial. Stats as in the design; traits: Simon and Jennifer take long
// hours well, Chloe badly, Joseph is an average Joe.
// look: colours plus the features the portrait, office and cut scenes draw
// (face shape, hair style, eyes, brows, nose, mouth, glasses, cheeks, stubble).
export const CHARACTERS = [
  {
    id: 'simon',
    name: 'Simon C',
    mbti: 'INTJ',
    iq: 140,
    pol: 60,
    archetype: 'Systems Thinker',
    blurb: 'Bonus to solitary technical work, and long hours wear him down slowly. Unstructured networking drains him badly.',
    traits: { coreBonus: 1.15, networkingDrain: 45, networkingHealthDrain: 10, strainResistance: 0.6, exhaustionResistance: 0.65 },
    look: {
      skin: '#f1d2b0', hair: '#121212', suit: '#2f3a4a', shirt: '#ffffff',
      face: 'round', hairStyle: 'sideSwept', brows: 'thickCurved', eyes: 'monolid', nose: 'soft', mouth: 'gentle',
    },
  },
  {
    id: 'jennifer',
    name: 'Jennifer B',
    mbti: 'ENFP',
    iq: 140,
    pol: 110,
    archetype: 'Charismatic Catalyst',
    blurb: 'Builds relationships and alliances fast, and keeps going on long days. Long stretches of isolated desk work sap her motivation.',
    traits: { relationshipBonus: 1.5, politicsBonus: 1.2, deskWorkDrain: 50, deskWorkLimit: 0.45, strainResistance: 0.6, exhaustionResistance: 0.65 },
    look: {
      skin: '#f4d6b8', hair: '#0e0e0e', suit: '#4a3260', shirt: '#f3e8ee',
      face: 'soft', hairStyle: 'shoulderStraight', brows: 'soft', eyes: 'innerDouble', nose: 'delicate', mouth: 'smileTeeth',
    },
  },
  {
    id: 'chloe',
    name: 'Chloe C',
    mbti: 'ENTP',
    iq: 150,
    pol: 95,
    archetype: 'Disruptive Innovator',
    blurb: 'Moonshots open from day one and land more often. Long hours burn her out fast, and she clashes with rigid leadership.',
    traits: { moonshotUnlocked: true, moonshotLanding: 1.25, rigidManagerClash: 0.25, strainResistance: 1.35, exhaustionResistance: 1.35 },
    look: {
      skin: '#f0cdaa', hair: '#1b1512', suit: '#25505a', shirt: '#fff6e8',
      face: 'round', hairStyle: 'bob', brows: 'soft', eyes: 'large', nose: 'soft', mouth: 'animated', glasses: 'thickBlack', cheeks: 'flushed',
    },
  },
  {
    id: 'joseph',
    name: 'Joseph J',
    mbti: 'ISTJ',
    iq: 130,
    pol: 105,
    archetype: 'The Average Joe',
    blurb: 'No special strengths, no special weaknesses. Steady, composed, and exactly as tired after a long day as anyone.',
    traits: {},
    look: {
      skin: '#e2b893', hair: '#3a2a1e', suit: '#3b3b3b', shirt: '#dfe7f0',
      face: 'structured', hairStyle: 'cleanShort', brows: 'straight', eyes: 'focused', nose: 'bridge', mouth: 'composed', glasses: 'aviator', stubble: true,
    },
  },
];

// Holidays: paid time off covers the first fifteen days a year; anything
// longer is unpaid. A day away recovers half again as fast as resting at
// work, and travel costs money. Past two weeks, your manager notices.
export const HOLIDAY = {
  ptoDaysPerYear: 15,
  options: [5, 10, 20],
  recoveryBoost: 1.5,
  costPerDay: 220,
  alignmentCostPerWeekPastTwo: 0.03,
};

// FIRE: financially independent once net worth covers 25 years of spending
// (the 4% rule). The game asks, at most once every two years.
export const FIRE = {
  yearsOfSpending: 25,
  askEveryQuarters: 8,
  minimumAge: 30,
};

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
