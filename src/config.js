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
  // Health drifts toward a target. Wear is slow, a tenth of the gap each
  // quarter, so years of long hours add up; recovery is three times faster,
  // so a flu or a brutal weekend is gone in a few quarters, not a decade.
  driftPerQuarter: 0.1,
  recoveryDriftPerQuarter: 0.3,
  // A healthy 22-year-old on standard hours.
  baseTarget: 95,
  // Strain is the share of the way from 8 to 16 hours, squared. 150 puts
  // the target near −55 at 16 hours (death in about four years), near 57 at
  // 12 hours, and costs almost nothing at 9.
  strainDamage: 150,
  // Rest share of bandwidth lifts the target: half the week protected is
  // worth 15 points.
  restBonus: 30,
  // Wear from age past 35, per year: 12 points by 60 on standard hours.
  // Knowledge work ages well: experience covers much of what the body loses.
  ageWearFrom: 35,
  ageWearPerYear: 0.5,
  // Below this, a heart scare can strike in any quarter.
  dangerLine: 25,
  scareChancePerQuarter: 0.25,
  scareDamage: 15,
};

// How age changes the body and the mind. Everything here scales with the
// employer's ageSensitivity (an industry's own, times its tier's): tech and
// finance grind people down, a university does not.
export const AGING = {
  from: 35,
  // Past `from`, each year makes the same hours cost more health and more
  // mood: at 50 a twelve-hour day costs 45% more than it did at 35.
  strainPerYear: 0.03,
  // Past `from`, the mood a person settles at falls this much a year: 15
  // points by 60. Enthusiasm for the job mellows.
  motivationFadePerYear: 0.5,
  // Past 30, bad news bounces off a little more each year: a blow to mood
  // lands at (1 − this × years past 30) of its size, down to the floor.
  resiliencePerYear: 0.012,
  resilienceFloor: 0.5,
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
  // the target, up to the cap. Most people make peace with a plateau, so
  // the cap is a dent, not a slide.
  stagnationPerYear: 3,
  stagnationCap: 10,
  promotionLift: 25,
  highImpactLift: 10,
  projectFailureHit: 8,
  leapfrogHit: 15,
  pipHit: 12,
  firedHit: 18,
  laidOffHit: 15,
  // Stepping back from management after a failed PIP.
  stepBackHit: 12,
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
  // Motivation points per unit of (autonomy − 0.5) × autonomyNeed.
  autonomyWeight: 30,
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
  // A hire's skill comes from their years of experience, on the curve a
  // typical plan learns at: the gap to the ceiling shrinks this share a year
  // (about 4 a quarter at a normal core and rest split, times what is left).
  experienceRate: 0.13,
  hireDeviation: 7,
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
  // From this level up, a character's leadership multiplies readiness.
  leadershipFromLevel: 3,
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
  // Chance an open chair also gets an outside candidate, by level: the
  // more senior the chair, the more likely a search. The outsider's standing
  // is drawn from externalStanding (proven people), so an average insider
  // usually loses to one, and a strong insider usually wins.
  externalSearchChance: [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.85, 0.95],
  externalStanding: [0.45, 0.9],
  // How many outsiders compete when there is a search: the top chairs draw
  // a field (other divisions' leaders, sitting executives elsewhere).
  outsideCandidates: [1, 1, 1, 1, 1, 2, 3, 4],
  // Some senior searches are external from the start: new blood wanted.
  externalOnlyChance: [0, 0, 0, 0, 0.1, 0.2, 0.35, 0.6],
  // Points an outsider adds per level of the chair: what a seasoned
  // candidate's politics and leadership are worth to a committee.
  outsiderSeniorityPerLevel: 4,
  // Promotion-score cost per year past plateauAfterYears at one level, and
  // per year of age past latePromotionAge.
  plateauAfterYears: 4,
  plateauPerYear: 10,
  latePromotionAge: 50,
  latePerYear: 6,
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
  // Growth stops once the division has grown this much.
  maxSeatGrowth: 2,
  // Levels from here up (VP, the top chair) do not grow with the company.
  growthStopsAtLevel: 6,
  // A promotion needs a track record: standing (the smoothed stack rank, 1
  // at the top of the level) at or above this, and a top-half latest rating.
  // 0.6 is the top 40% over about a year; an average performer's standing
  // hovers near 0.5 and only now and then clears it.
  promotionStanding: 0.6,
  // Above the expert fork (principal, distinguished): the top quarter.
  expertPromotionStanding: 0.78,
  // Promotion-score points per unit of standing: the best record wins.
  standingPromotionWeight: 150,
  // Quarters at a new level or job before a PIP can start.
  rampUpQuarters: 2,
  // Promotion-score points per unit of leadership above average, for
  // manager chairs.
  leadershipPromotionWeight: 40,
};

export const MONEY = {
  startSavings: 12000,
  // Effective tax rises from 18% toward 30% as pay approaches $500k.
  taxBase: 0.18,
  taxRise: 0.12,
  taxRiseSalary: 500000,
  // Living costs: a floor plus lifestyle that grows with take-home pay.
  livingFloor: 32000,
  lifestyleShare: 0.8,
  // Spending does not keep pace with a high income: past this much spare
  // take-home, only the smaller share is spent, so a high earner saves a
  // larger share than a modest one (as real high earners do).
  lifestyleCap: 100000,
  lifestyleShareAbove: 0.3,
  // Out of work the lifestyle shrinks, but not to nothing.
  unemployedLifestyleShare: 0.2,
  unemploymentBenefitPerQuarter: 7000,
  // The full premium to keep an employer plan after leaving: about $700 a month.
  cobraPerQuarter: 2100,
  benefitQuarters: 2,
  severanceQuarters: 1,
  // Real return on savings a year, by market mood.
  returns: { boom: 0.09, normal: 0.05, recession: -0.06 },
  // Pay follows standing. Each quarter's stack rank (1 at the top of the
  // level, 0 at the bottom) feeds a smoothed standing; the standing sets a
  // target salary across the level's band (base to bandTop × base), and at
  // each year-end review pay closes payCatchUpPerYear of the gap to it, so a
  // run of top ratings takes about three years to show fully in pay. Pay is
  // never cut: a slump leaves someone paid above their current value.
  standingSmoothing: 0.25,
  payCatchUpPerYear: 0.35,
  // Pay at a level runs from its base to this multiple of it. Raises,
  // counter-offers and job hops stop at the top of the band: past it, the
  // only way up is a bigger title.
  bandTop: 1.5,
  // Out of work and out of savings, people borrow before they lose the
  // apartment: credit cards, family, a friend's couch. Debt costs interest
  // each quarter; past the cushion, the lease goes.
  debtCushion: 45000,
  debtInterestPerQuarter: 0.05,
};

// The unemployment spiral. The longer the search, the more it costs beyond
// money: mood sinks, stress wears the body down and makes illness likelier,
// and a marriage under strain can break.
export const JOBLESS = {
  // Mood: the base hit, plus more each quarter of searching, to a cap.
  moodBase: 15,
  moodPerQuarter: 4,
  moodCap: 35,
  // Health target lost to stress each quarter out of work, to a cap.
  stressPerQuarter: 2,
  stressCap: 12,
  // Divorce, while married: no risk in the first quarter out, then this much
  // per quarter for each quarter past the first, to a cap. About a quarter of
  // marriages break by a year out of work and half by two years.
  divorceFromQuarter: 2,
  divorcePerQuarter: 0.04,
  divorceCap: 0.15,
  divorceLegalFees: 18000,
  // Illness and medical cards weigh this much more per quarter out of work.
  illnessWeightPerQuarter: 0.25,
  illnessWeightCap: 2.5,
};

export const JOBS = {
  // Counselled out, the chance the next offer is from a steady employer.
  exitToSteadyChance: 0.6,
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
  // A card that has just been drawn waits before it can come up again, so a
  // career does not meet the same moment every few years. A card may set its
  // own `cooldown`. A deck with nothing else eligible ignores the wait.
  cooldownQuarters: { start: 14, life: 24 },
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
  // Seats in the division by level. Senior is the biggest rung: the level
  // most engineers make and many stay at for good.
  seats: [10, 15, 16, 7, 5, 3, 2, 1],
  // How hard the typical peer works here, in hours a day.
  peerHours: 9,
  // Face time: the review credit for being seen working late, per hour
  // past 8, as a share of the score. Some cultures reward it more than the
  // work it produces.
  faceTimePerHour: 0.01,
  // How much say people have over their own work, 0..1. Characters who need
  // autonomy gain or lose motivation by it (see autonomyNeed).
  autonomy: 0.55,
  // How hard age bites the body and the mood here (see AGING), and when a
  // workplace starts to push older people out: from ageOutFrom, each year of
  // age adds ageOutPerYear to a colleague's chance of leaving each quarter,
  // and to someone's place on a layoff list. Tiers scale both.
  ageSensitivity: 1,
  ageOutFrom: 38,
  ageOutPerYear: 0.002,
  upOrOutQuarters: null,
  upOrOutBelowLevel: null,
  tenureFromLevel: null,
  contractQuarters: null,
  subStat: 'techDebt',
  projects: TECH_PROJECTS,
  // The dual ladder: at trackFromLevel you choose management or the expert
  // track; levels above it carry the track's titles. Same pay, same seats.
  trackFromLevel: 3,
  expertTitles: ['Senior Staff Engineer', 'Principal Engineer', 'Distinguished Engineer', 'Fellow'],
  // Bonuses and, in tech, stock grants.
  bonusShare: [0, 0.05, 0.12, 0.2, 0.25, 0.3, 0.4, 0.6],
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
    autonomy: 0.25,
    ageSensitivity: 1.2,
    ageOutFrom: 40,
    ageOutPerYear: 0.003,
    // Up or out: 16 quarters at a level below Principal and you are
    // counselled out.
    upOrOutQuarters: 16,
    upOrOutBelowLevel: 5,
    subStat: 'utilization',
    projects: CONSULTING_PROJECTS,
    expertTitles: ['Senior Expert', 'Distinguished Expert', 'Expert Partner', 'Senior Expert Partner'],
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
    autonomy: 0.15,
    ageSensitivity: 1.3,
    ageOutFrom: 42,
    ageOutPerYear: 0.003,
    upOrOutQuarters: 16,
    upOrOutBelowLevel: 4,
    subStat: 'dealFlow',
    projects: PE_PROJECTS,
    expertTitles: ['Operating Principal', 'Operating Director', 'Operating Partner', 'Senior Operating Partner'],
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
    // A university is full of the old: little age wear, and no age-out.
    autonomy: 0.9,
    ageSensitivity: 0.5,
    ageOutFrom: 99,
    ageOutPerYear: 0,
    upOrOutQuarters: null,
    // The tenure clock: an assistant professor gets 24 quarters, then
    // either tenure (no PIPs, no layoffs) or the door.
    tenureClockQuarters: 24,
    tenureFromLevel: 2,
    // Postdoc contracts end after 12 quarters.
    contractQuarters: 12,
    subStat: 'citations',
    projects: ACADEMIA_PROJECTS,
    // Academia: administration (chair, dean, provost) or research chairs.
    expertTitles: ['Endowed Chair', 'Distinguished Professor', 'University Professor', 'Institute Professor'],
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
    // Where a sensible consultant aims: safely inside the sweet spot.
    target: 0.9,
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

// The characters. Everyone in the game goes by first name and last
// initial. They differ only in these numbers; every mechanic is shared.
//   iq, pol              — the design's two stats
//   strainResistance     — share of long-hours health damage taken (1 = average)
//   exhaustionResistance — share of long-hours motivation drain taken
//   steadiness           — share of every motivation blow shrugged off
//   leadership           — readiness and promotion pull at manager levels (1 = average)
//   eventSavvy           — odds multiplier on political gambles in events
//   autonomyNeed         — how much motivation tracks the industry's autonomy
//   noveltyLift          — multiplier on the lift from landing a high-impact project
//   coreBonus, politicsBonus, relationshipBonus, networkingDrain,
//   networkingHealthDrain, deskWorkDrain/Limit, moonshot*, rigidManagerClash
//   difficulty           — 1 to 3: how hard the climb is on average, set from the
//                           outcome report's Director-or-higher rates across all
//                           industries (1 above ~55%, 2 around 35-45%, 3 under 10%)
//   gender               — 'female' or 'male': a few event cards speak to one or the other
// faceStyle: which toy face the character has (a key of FACE_STYLES below).
//   faceTweaks may override any field of the style for this one character.
// look: colours plus the features the portrait, office and cut scenes draw.
// The toy faces. Each is a recipe the 3D model reads: how big the head is
// (1 is a realistic head), the eyes (glossy | dot | bean | oval | sleepy),
// the mouth (smile | line | cat | dot), the nose (small | dot | none) and
// whether the eyes sit low on the face. Add one here and name it in a
// character's `faceStyle`; override single fields with `faceTweaks`.
export const FACE_STYLES = {
  glossy: { label: 'Big glossy', head: 1.22, eyes: 'glossy', mouth: 'smile', nose: 'small', lowEyes: true },
  dots: { label: 'Dots and a line', head: 1.18, eyes: 'dot', mouth: 'line', nose: 'none', lowEyes: false },
  beans: { label: 'Beans and a cat mouth', head: 1.2, eyes: 'bean', mouth: 'cat', nose: 'dot', lowEyes: true },
  anime: { label: 'Anime ovals', head: 1.05, eyes: 'oval', mouth: 'smile', nose: 'small', lowEyes: true },
  sleepy: { label: 'Sleepy lids', head: 1.1, eyes: 'sleepy', mouth: 'line', nose: 'small', lowEyes: false },
  small: { label: 'Small head', head: 0.95, eyes: 'dot', mouth: 'dot', nose: 'dot', lowEyes: false },
};

export const CHARACTERS = [
  {
    id: 'simon',
    gender: 'male',
    difficulty: 2,
    name: 'Simon C',
    mbti: 'INTJ',
    iq: 145,
    pol: 68,
    archetype: 'Systems Thinker',
    blurb: 'Brilliant at solitary technical work and takes long hours well, but every hour of networking costs him health and mood. Climbs on output, if he can stand the politics up top.',
    traits: { coreBonus: 1.15, networkingDrain: 45, networkingHealthDrain: 10, strainResistance: 0.6, exhaustionResistance: 0.65 },
    look: {
      faceStyle: 'dots',
      skin: '#f1d2b0', hair: '#121212', suit: '#2f3a4a', shirt: '#ffffff',
      face: 'narrow', hairStyle: 'sideSwept', brows: 'thickCurved', eyes: 'monolid', nose: 'soft', mouth: 'gentle',
    },
  },
  {
    id: 'jennifer',
    gender: 'female',
    difficulty: 2,
    name: 'Jennifer B',
    mbti: 'ENFP',
    iq: 140,
    pol: 110,
    archetype: 'Charismatic Catalyst',
    blurb: 'Builds alliances fast and keeps going on long days, but long stretches of solo desk work sap her motivation. Climbs through people, if she keeps her spark.',
    traits: { relationshipBonus: 1.5, politicsBonus: 1.2, deskWorkDrain: 50, deskWorkLimit: 0.45, strainResistance: 0.6, exhaustionResistance: 0.65 },
    look: {
      faceStyle: 'glossy',
      skin: '#f4d6b8', hair: '#0e0e0e', suit: '#4a3260', shirt: '#f3e8ee',
      face: 'soft', hairStyle: 'shoulderStraight', brows: 'soft', eyes: 'innerDouble', nose: 'delicate', mouth: 'smileTeeth',
    },
  },
  {
    id: 'chloe',
    gender: 'female',
    difficulty: 2,
    name: 'Chloe C',
    mbti: 'ENTP',
    iq: 150,
    pol: 95,
    archetype: 'Disruptive Innovator',
    blurb: 'Huge capability, but she needs freedom and fun: long hours and rigid cultures drain her fast. Thrives in academia; corporate works if she guards her happiness.',
    traits: {
      moonshotUnlocked: true, moonshotLanding: 1.25, rigidManagerClash: 0.25, strainResistance: 1.35, exhaustionResistance: 1.4,
      autonomyNeed: 1, noveltyLift: 1.6,
    },
    look: {
      faceStyle: 'glossy',
      skin: '#f0cdaa', hair: '#1b1512', suit: '#25505a', shirt: '#fff6e8',
      face: 'round', hairStyle: 'ponytail', brows: 'soft', eyes: 'large', nose: 'soft', mouth: 'animated', glasses: 'thickBlack', cheeks: 'flushed',
    },
  },
  {
    id: 'joseph',
    gender: 'male',
    difficulty: 3,
    name: 'Joseph J',
    mbti: 'ISTJ',
    iq: 130,
    pol: 105,
    archetype: 'The Average Joe',
    blurb: 'No special talents and no special weaknesses, but an even temper: setbacks sting him less than most. A steady, drama-free career is his to lose.',
    traits: { steadiness: 0.35 },
    look: {
      faceStyle: 'dots',
      skin: '#e2b893', hair: '#3a2a1e', suit: '#3b3b3b', shirt: '#dfe7f0',
      face: 'square', hairStyle: 'cleanShort', brows: 'straight', eyes: 'focused', nose: 'bridge', mouth: 'composed', glasses: 'aviator', stubble: true,
    },
  },
  {
    id: 'richard',
    gender: 'male',
    difficulty: 2,
    name: 'Richard K',
    mbti: 'ENFJ',
    iq: 130,
    pol: 125,
    archetype: 'The Operator',
    blurb: 'Not the sharpest in the room, but he works the room: networking pays him back more than anyone, he plays office politics well, takes bad news in his stride, and works long hours like Simon.',
    traits: { strainResistance: 0.6, exhaustionResistance: 0.65, politicsBonus: 1.15, eventSavvy: 1.35, steadiness: 0.25 },
    look: {
      faceStyle: 'anime',
      skin: '#e8c4a0', hair: '#6b4a2e', suit: '#1f3550', shirt: '#ffffff',
      face: 'square', hairStyle: 'sideSwept', brows: 'straight', eyes: 'focused', nose: 'bridge', mouth: 'smileTeeth',
    },
  },
  {
    id: 'christian',
    gender: 'male',
    difficulty: 1,
    name: 'Christian W',
    mbti: 'INTP',
    iq: 150,
    pol: 70,
    archetype: 'The Machine',
    blurb: 'Can work brutal hours for years without burning out, and out-produces everyone. But output is not leadership: management doors open for him no faster than for anyone.',
    traits: { strainResistance: 0.3, exhaustionResistance: 0.3, coreBonus: 1.1, leadership: 0.6 },
    look: {
      faceStyle: 'anime',
      skin: '#d9a77c', hair: '#2a1d14', suit: '#2e3a2e', shirt: '#e6eef8',
      face: 'narrow', build: 'thin', hairStyle: 'long', brows: 'thickCurved', eyes: 'focused', nose: 'soft', mouth: 'composed',
    },
  },
  {
    id: 'adam',
    gender: 'male',
    difficulty: 1,
    name: 'Adam R',
    mbti: 'ENTJ',
    iq: 145,
    pol: 145,
    archetype: 'The Natural Leader',
    blurb: 'Sharp, political, and made for leadership: people follow him and promotion committees like him. The best shot at the top chair, if he keeps his health.',
    traits: { leadership: 1.3, politicsBonus: 1.15, relationshipBonus: 1.25, eventSavvy: 1.2 },
    look: {
      faceStyle: 'sleepy',
      skin: '#c99a76', hair: '#151515', suit: '#202a44', shirt: '#ffffff',
      face: 'structured', hairStyle: 'cleanShort', brows: 'thickCurved', eyes: 'large', nose: 'bridge', mouth: 'gentle',
    },
  },
  {
    id: 'eve',
    gender: 'female',
    difficulty: 3,
    name: 'Eve M',
    mbti: 'ISFJ',
    iq: 125,
    pol: 100,
    archetype: 'The Steady Hand',
    blurb: 'Much like an average Joe, calm when things go wrong, but long hours wear her down quickly. A good career at a sane pace.',
    traits: { steadiness: 0.3, strainResistance: 1.35, exhaustionResistance: 1.35 },
    look: {
      faceStyle: 'beans',
      skin: '#f2d1b3', hair: '#7a4a2a', suit: '#5a3f4e', shirt: '#fbf3f6',
      face: 'soft', hairStyle: 'long', brows: 'soft', eyes: 'innerDouble', nose: 'delicate', mouth: 'gentle',
    },
  },
];

// Company tiers. Every employer has one; it sets how the shared rules run
// there. Values are multipliers on the industry's own numbers unless noted.
//   reviewEvery      — quarters between formal reviews (ratings, PIPs,
//                      promotions, decisions use the period's average)
//   pipBelowMedian   — how far behind the median a bottom rating must be to
//                      become a PIP (higher means more PIPs)
//   growthPerYear    — seats added a year (more chairs, more promotions)
//   quitMultiplier   — how often people leave (more chairs open above)
//   politicsWeight   — how much politics counts in output, readiness and
//                      promotion
//   pay, bonus       — multipliers on salary bands and bonuses
//   payCatchUp       — multiplier on how fast pay closes on its target
//   layoffMultiplier — how often layoffs come
//   peerHoursOffset  — the culture's hours relative to the industry's
//   seatScale        — the division's size relative to the industry's
//   ageSensitivity   — multiplier on how hard age bites body and mood
//   ageOut           — multiplier on how fast older people are pushed out
//   upOrOut          — multiplier on the industry's up-or-out clock, or 0
//                      for none: elite firms enforce it, steady ones do not
export const COMPANY_TIERS = {
  aggressive: {
    name: 'High-growth', reviewEvery: 1, pipBelowMedian: 0.9, growthPerYear: 0.04, quitMultiplier: 1.4,
    politicsWeight: 0.8, pay: 1.35, bonus: 3, payCatchUp: 1.4, layoffMultiplier: 1.3, peerHoursOffset: 0.75, seatScale: 1, upOrOut: 1, ageSensitivity: 1.25, ageOut: 2,
    blurb: 'Quarterly reviews, the most PIPs, fast promotions as it grows, and the best pay.',
  },
  mid: {
    name: 'Established', reviewEvery: 2, pipBelowMedian: 0.85, growthPerYear: 0.015, quitMultiplier: 1,
    politicsWeight: 1, pay: 1, bonus: 1, payCatchUp: 1, layoffMultiplier: 1, peerHoursOffset: 0, seatScale: 1, upOrOut: 1.5, ageSensitivity: 1, ageOut: 1,
    blurb: 'Reviews twice a year, some growth, some politics.',
  },
  stable: {
    name: 'Steady', reviewEvery: 4, pipBelowMedian: 0.78, growthPerYear: 0, quitMultiplier: 0.6,
    politicsWeight: 1.4, pay: 0.85, bonus: 0.3, payCatchUp: 0.7, layoffMultiplier: 0.7, peerHoursOffset: -0.5, seatScale: 1, upOrOut: 0, ageSensitivity: 0.75, ageOut: 0.25,
    blurb: 'Annual reviews, few PIPs, slow promotions, and politics that count.',
  },
  startup: {
    name: 'Startup', reviewEvery: 2, pipBelowMedian: 0.85, growthPerYear: 0.1, quitMultiplier: 1.3,
    politicsWeight: 0.4, pay: 0.8, bonus: 0, payCatchUp: 1, layoffMultiplier: 1.6, peerHoursOffset: 1, seatScale: 0.35, upOrOut: 0, ageSensitivity: 1.2, ageOut: 1.5,
    blurb: 'Below-market pay plus equity, little politics, and a real chance it folds.',
    // Each quarter: chance the startup folds (about half within five years),
    // or is acquired (the equity pays out salary × equityMultiple).
    failPerQuarter: 0.03,
    exitPerQuarter: 0.012,
    equityMultiple: [1, 10],
    // One exit in this many is a unicorn: equity worth this many years of salary.
    unicornChance: 0.12,
    unicornMultiple: [35, 120],
  },
};

// Which tiers each industry's employers come in, by weight.
export const TIER_MIX = {
  tech: { startup: 20, aggressive: 25, mid: 35, stable: 20 },
  consulting: { aggressive: 30, mid: 50, stable: 20 },
  privateEquity: { aggressive: 30, mid: 50, stable: 20 },
  academia: { aggressive: 30, mid: 40, stable: 30 },
};

// Each year a company may move one tier: high-growth firms mature, steady
// ones get shaken up; the market tilts it.
export const TIER_SHIFT = {
  chancePerYear: 0.06,
};

// How the two tracks are judged above the fork. Management's weight moves
// from individual output to influence and people as the chair rises
// (mix 0 at the fork, 1 four levels above it); experts are judged on output.
export const TRACKS = {
  management: {
    name: 'Management',
    coreWeightDrop: 0.4,
    politicalWeightGain: 2,
    peopleWeight: 0.6,
    readinessPolitics: 1.3,
    promotionPolitics: 1.5,
  },
  expert: {
    name: 'Expert',
    coreWeightDrop: 0,
    politicalWeightGain: -0.5,
    peopleWeight: 0,
    readinessPolitics: 0.6,
    promotionPolitics: 0.3,
  },
};

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
  // The 4% rule (25 years of spending) holds for a retirement starting near
  // fullRuleAge; a longer one needs a safer withdrawal rate, so each year
  // earlier adds to the multiple: about 33 years of spending at 40.
  yearsOfSpending: 25,
  fullRuleAge: 60,
  extraYearsPerYearEarly: 0.25,
  // Retired, the commute, the work wardrobe, the childcare of a two-career
  // household and the lifestyle that went with the job fall away: a FIRE
  // budget is this share of what the working life spent.
  retiredSpendingShare: 0.75,
  askEveryQuarters: 8,
  minimumAge: 24,
};

// What a peer's personality looks like, drawn per agent.
export const PEERS = {
  // The average colleague is Joseph: IQ 130, political sense about 100.
  // Each level up is a further filter.
  iqMean: 130,
  iqPerLevel: 1,
  iqDeviation: 10,
  polMean: 100,
  polDeviation: 20,
  rigidManagerChance: 0.35,
  // Ambition, 0..1. Colleagues competing for promotions are career-minded:
  // few coast, so a focused player is average among them, not a star.
  ambitionRange: [0.45, 0.95],
};
