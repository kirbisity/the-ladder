// Out of work: the cards that open a quarter of job hunting. Each is shaped
// by the industry: a tech engineer gets a contract gig, a consultant goes
// independent, a PE professional becomes an interim CFO, an academic
// teaches as an adjunct.

import { makeOffer, acceptOffer, titleOf } from '../game.js';
import { MONEY } from '../../config.js';
import { spend, byIndustry, boostSearch, formatMoney, setPlan } from './helpers.js';

function contractFee(game) {
  return Math.round(game.player.salary * byIndustry(game, { tech: 0.3, consulting: 0.28, privateEquity: 0.25, academia: 0.1 }) / 1000) * 1000;
}

export const JOBLESS_DECK = [
  {
    id: 'cobra',
    category: 'jobless',
    title: 'The COBRA letter',
    weight: (game) => (!game.flags.cobraDecided ? 4 : 0),
    text: 'Your health cover ended with the job. COBRA would keep the same plan at the full premium: $2,100 a quarter.',
    choices: [
      { label: 'Elect COBRA', tag: 'safe', apply: (game) => {
        game.flags.cobra = true;
        game.flags.cobraDecided = true;
        return 'Covered. It costs more than your rent used to.';
      } },
      { label: 'Go without insurance', tag: 'bold', apply: (game) => {
        game.flags.cobra = false;
        game.flags.cobraDecided = true;
        return 'You save the premium and pray nothing happens.';
      } },
    ],
  },
  {
    id: 'gig',
    category: 'jobless',
    title: 'A short contract',
    weight: () => 1.2,
    text: (game) => byIndustry(game, {
      tech: `A seed-stage startup needs a contractor for three months to ship their mobile app: ${formatMoney(contractFee(game))}.`,
      consulting: `A boutique firm wants an independent consultant for a 10-week pricing study: ${formatMoney(contractFee(game))}.`,
      privateEquity: `A portfolio company of a rival fund needs an interim CFO for one quarter: ${formatMoney(contractFee(game))}.`,
      academia: `A community college needs an adjunct for two sections this term: ${formatMoney(contractFee(game))}, no benefits.`,
    }),
    choices: [
      { label: 'Take the contract', tag: 'safe', apply: (game) => {
        const fee = contractFee(game);
        game.savings += fee * 0.75;
        game.lifetimeEarnings += fee;
        game.player.motivation += 6;
        boostSearch(game, 0.08);
        return `${formatMoney(fee)} before tax, a fresh line on the résumé, and something to talk about in interviews.`;
      } },
      { label: 'Stay focused on full-time roles', tag: 'ambitious', apply: (game) => {
        boostSearch(game, 0.04);
        return 'Every hour goes into applications.';
      } },
    ],
  },
  {
    id: 'finalRound',
    category: 'jobless',
    title: 'The final round',
    weight: () => 1.4,
    text: (game) => byIndustry(game, {
      tech: 'A final round: five interviews in a day, system design, and a take-home due Friday.',
      consulting: 'A final round: two cases with partners and a fit interview with the office head.',
      privateEquity: 'A final round: a three-hour paper LBO, then a model test over the weekend.',
      academia: 'A campus visit: a job talk, a teaching demo, and dinner with the search committee.',
    }),
    choices: [
      { label: 'Prepare like your life depends on it', tag: 'ambitious', apply: (game) => {
        game.player.health -= 2;
        boostSearch(game, 0.2);
        return 'Mock interviews every night. You walk in ready.';
      } },
      { label: 'Wing it', tag: 'bold', apply: (game) => {
        boostSearch(game, 0.05);
        return 'You are a little rusty, and they notice.';
      } },
    ],
  },
  {
    id: 'ghosted',
    category: 'jobless',
    title: 'Ghosted',
    weight: () => 1,
    text: 'The recruiter who said "we\'re very excited" three weeks ago has stopped answering.',
    choices: [
      { label: 'Follow up once, then move on', tag: 'safe', apply: (game) => {
        game.player.motivation -= 4;
        return 'Silence. You add them to the list.';
      } },
    ],
  },
  {
    id: 'referral',
    category: 'jobless',
    title: 'Coffee with an old colleague',
    weight: () => 1,
    text: 'A former colleague answers your LinkedIn message: "Let\'s grab coffee, we might have something."',
    choices: [
      { label: 'Go, with a tailored résumé', tag: 'ambitious', apply: (game, data, random) => {
        const friends = (game.lastOrg ? game.lastOrg.agents.filter((agent) => !agent.departed && agent.relationship >= 30).length : 0);
        boostSearch(game, friends > 0 ? 0.3 : 0.12);
        return friends > 0 ? 'They walk your résumé straight to the hiring manager.' : 'Nice coffee. They will "keep an ear out".';
      } },
      { label: 'Skip it: networking feels like begging', tag: 'rest', apply: () => 'You stay home and refresh the job boards.' },
    ],
  },
  {
    id: 'lowball',
    category: 'jobless',
    title: 'A step down',
    weight: (game) => (game.employment.unemployedQuarters >= 1 && (game.employment.lastLevel ?? 0) > 0 ? 1.4 : 0),
    text: (game) => {
      const level = Math.max(0, (game.employment.lastLevel ?? 1) - 1);
      return `An offer, finally, but a level down: ${titleOf(game, level)}, at ${formatMoney(game.industry.salaries[level])}.`;
    },
    choices: [
      { label: 'Take it: a job is a job', tag: 'safe', apply: (game) => {
        const level = Math.max(0, (game.employment.lastLevel ?? 1) - 1);
        acceptOffer(game, { ...makeOffer(game, level, 0.8, 'search'), salary: game.industry.salaries[level] });
        game.player.motivation -= 4;
        return 'A new badge and a smaller title. You will climb back.';
      } },
      { label: 'Hold out for your level', tag: 'bold', apply: () => 'You decline politely and keep looking.' },
    ],
  },
  {
    id: 'retrain',
    category: 'jobless',
    title: 'A certificate',
    weight: () => 0.8,
    text: (game) => byIndustry(game, {
      tech: 'An eight-week course in machine learning engineering: $4,000.',
      consulting: 'A product management certificate, "for career switchers": $3,500.',
      privateEquity: 'The CFA Level II exam, in four months: $1,500 and every weekend.',
      academia: 'A data science boot camp, for academics leaving academia: $12,000.',
    }),
    choices: [
      { label: 'Enrol', tag: 'ambitious', apply: (game) => {
        const cost = byIndustry(game, { tech: 4000, consulting: 3500, privateEquity: 1500, academia: 12000 });
        game.player.skill += 5;
        boostSearch(game, 0.12);
        return `${spend(game, cost)}. New skills, and a reason to call recruiters back.`;
      } },
      { label: 'Not now', tag: 'safe', apply: () => 'You keep your cash.' },
    ],
  },
  {
    id: 'benefitsExtension',
    category: 'jobless',
    title: 'The unemployment office',
    weight: (game) => (game.employment.benefitQuartersLeft === 0 && !game.flags.extensionUsed ? 1 : 0),
    text: 'Your unemployment benefits ran out. A federal extension exists, if you can survive the paperwork.',
    choices: [
      { label: 'Fill out every form', tag: 'safe', apply: (game) => {
        game.flags.extensionUsed = true;
        game.employment.benefitQuartersLeft += 1;
        game.player.motivation -= 2;
        return `Approved: one more quarter at ${formatMoney(MONEY.unemploymentBenefitPerQuarter)}.`;
      } },
    ],
  },
  {
    id: 'unemploymentLow',
    category: 'jobless',
    title: 'Another rejection',
    weight: (game) => 0.6 + game.employment.unemployedQuarters * 0.4,
    text: 'The final round went well, you thought. The email starts "Unfortunately".',
    choices: [
      { label: 'Widen the search', tag: 'ambitious', apply: (game) => {
        setPlan(game, { openness: 1 });
        game.player.motivation -= 3;
        return 'You apply to anything that pays.';
      } },
      { label: 'Take a week to reset', tag: 'rest', apply: (game) => {
        game.player.motivation += 4;
        return 'A week of walks. Then back to it.';
      } },
    ],
  },
];

