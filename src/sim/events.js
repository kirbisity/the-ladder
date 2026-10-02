// The event and crisis deck, assembled. Every card has:
//   category — macro, interpersonal, industry (work), lifestyle (life),
//              jobless (the job hunt), arc (a scheduled follow-up), career
//   scope    — 'work' needs a job, 'jobless' needs to be out of work, 'any'
//   timing   — 'start' opens a quarter; 'life' lands on a random day mid-quarter
// The cards themselves live in src/sim/events/. Choices carry a tag so the
// balance bots can play them by temperament.

import { EVENTS as EVENT_DIALS, JOBLESS, COMPANY_TIERS } from '../config.js';
import { payInBand } from './agent.js';
import { acceptOffer, titleOf, formatMoney, retireEarly, chooseTrack, employerIndustry } from './game.js';
import { CORE_DECK } from './events/core.js';
import { LIFE_DECK, LIFE_IDS_FROM_CORE } from './events/life.js';
import { JOBLESS_DECK } from './events/jobless.js';
import { INDUSTRY_DECK } from './events/industry.js';
import { MORE_LIFE, MORE_WORK } from './events/more.js';
import { HOME_LIFE, WOMENS_WORK } from './events/home.js';
import { FAMILY_LIFE } from './events/family.js';
import { TRAGEDY } from './events/tragedy.js';
import { SIR_EVENT, ERA_WORK, retireEvent } from './events/era.js';
import { ERA } from '../config.js';
import { MORE_INDUSTRY_ARCS } from './events/moreIndustry.js';

// Cards that need no job: the market moves for everyone.
const ANY_SCOPE = new Set(['downturn', 'boom']);
// Life cards that only make sense with a job.
const WORK_LIFE = new Set(['vacation', 'juryDuty']);

function normalise(event) {
  const life = event.category === 'lifestyle' || LIFE_IDS_FROM_CORE.includes(event.id);
  const category = life ? 'lifestyle' : event.category;
  let scope = event.scope;
  if (!scope) {
    if (category === 'jobless') scope = 'jobless';
    else if (life) scope = WORK_LIFE.has(event.id) ? 'work' : 'any';
    else if (ANY_SCOPE.has(event.id) || category === 'arc' || category === 'career') scope = 'any';
    else scope = 'work';
  }
  return { ...event, category, scope, timing: life ? 'life' : 'start' };
}

const DECK = [...CORE_DECK, ...LIFE_DECK, ...MORE_LIFE, ...MORE_WORK, ...HOME_LIFE, ...WOMENS_WORK, ...FAMILY_LIFE, ...TRAGEDY, SIR_EVENT, ...ERA_WORK, ...JOBLESS_DECK, ...INDUSTRY_DECK, ...MORE_INDUSTRY_ARCS].map(normalise);
const DECK_BY_ID = new Map(DECK.map((event) => [event.id, event]));

export function eventById(id) {
  return DECK_BY_ID.get(id) ?? null;
}

export function allEvents() {
  return DECK;
}

function inScope(game, event) {
  if (event.scope === 'work') return game.employment.employed;
  if (event.scope === 'jobless') return !game.employment.employed;
  return true;
}

function rested(game, event) {
  const last = game.eventLast?.[event.id];
  return last === undefined || game.quarterIndex - last >= (event.cooldown ?? EVENT_DIALS.cooldownQuarters[event.timing]);
}

function eligibleCards(game, timing) {
  return DECK.filter((event) => event.timing === timing
    && event.category !== 'arc'
    && inScope(game, event)
    && (!event.industry || event.industry === game.industry.id)
    && (event.weight ? event.weight(game) : 1) > 0);
}

/** Remember when a card was drawn, for its cooldown. */
function markDrawn(game, event) {
  if (!game.eventLast) game.eventLast = {};
  game.eventLast[event.id] = game.quarterIndex;
  return event;
}

/**
 * Draw the card that opens a quarter. At work: a category by the design's
 * split (macro, office politics, the industry's own), then a card by
 * weight. Out of work: the job-hunt deck, with the odd market shock.
 */
export function drawEvent(game, random) {
  const eligible = eligibleCards(game, 'start');
  // After the revolution, most work cards are its own: demos, pilots, workshops.
  const eraCards = eligible.filter((event) => event.category === 'era');
  if (game.employment.employed && eraCards.length && random.chance(ERA.eraCardShare)) {
    const fresh = eraCards.filter((entry) => rested(game, entry));
    return markDrawn(game, random.weighted(fresh.length ? fresh : eraCards, (entry) => entry.weight(game)));
  }
  const weights = game.employment.employed ? EVENT_DIALS.categoryWeights : { jobless: 85, macro: 15 };
  const categories = Object.keys(weights).filter((category) => eligible.some((event) => event.category === category));
  const category = random.weighted(categories, (name) => weights[name]);
  if (!category) return null;
  const inCategory = eligible.filter((entry) => entry.category === category);
  const fresh = inCategory.filter((entry) => rested(game, entry));
  const pool = fresh.length > 0 ? fresh : inCategory;
  return markDrawn(game, random.weighted(pool, (entry) => (entry.weight ? entry.weight(game) : 1)));
}

/** Draw a personal event for a random day of the quarter. */
export function drawLifeEvent(game, random) {
  const eligible = eligibleCards(game, 'life');
  const fresh = eligible.filter((entry) => rested(game, entry));
  const drawn = random.weighted(fresh.length > 0 ? fresh : eligible, (entry) => lifeWeight(game, entry));
  return drawn ? markDrawn(game, drawn) : drawn;
}

/** A card's weight today; a long search makes illness and bills likelier. */
export function lifeWeight(game, event) {
  const base = event.weight ? event.weight(game) : 1;
  if (!event.medical || game.employment.employed) return base;
  return base * (1 + Math.min(JOBLESS.illnessWeightCap, JOBLESS.illnessWeightPerQuarter * game.employment.unemployedQuarters));
}

/** The fork in the ladder: lead people, or be the expert. */
export function trackEvent() {
  return {
    id: 'trackChoice',
    category: 'career',
    scope: 'work',
    timing: 'start',
    title: 'The fork in the ladder',
    text: (game) => {
      const next = game.player.level + 1;
      return `Your manager asks where you want to go from here. Management: ${titleOf(game, next, 'management')}, judged more and more on influence and people. `
        + `Or the expert track: ${titleOf(game, next, 'expert')}, judged on your own work. Same pay either way.`;
    },
    choices: (game) => [
      { label: `Management: become ${titleOf(game, game.player.level + 1, 'management')}`, tag: 'ambitious', apply: (innerGame) => {
        chooseTrack(innerGame, 'management');
        return 'You start sitting in on hiring loops and budget meetings.';
      } },
      { label: `Expert track: become ${titleOf(game, game.player.level + 1, 'expert')}`, tag: 'safe', apply: (innerGame) => {
        chooseTrack(innerGame, 'expert');
        return 'You keep your hands on the hardest problems.';
      } },
    ],
  };
}

export { retireEvent };

/** Financial independence: the game offers early retirement. */
export function fireEvent() {
  return {
    id: 'fireOffer',
    category: 'career',
    scope: 'any',
    timing: 'start',
    title: 'Financially independent',
    text: (game, data) => `Your net worth, ${formatMoney(data.number)} or more, covers what you spend for the rest of your life at a safe withdrawal rate. You never have to work again. Retire early?`,
    choices: [
      { label: 'Retire early and see the world', tag: 'rest', apply: (game) => {
        retireEarly(game);
        return 'You hand in your notice. The out-of-office reply never comes off.';
      } },
      { label: 'Keep climbing', tag: 'safe', apply: () => 'One more year. Everyone says that.' },
    ],
  };
}

/** The job offer event, built from the offer in hand. */
export function offerEvent() {
  return {
    id: 'jobOffer',
    category: 'career',
    scope: 'any',
    timing: 'start',
    title: 'An offer',
    text: (game, offer) => {
      const title = titleOf(game, offer.level);
      const from = offer.source === 'headhunter' ? 'A recruiter calls' : 'After weeks of interviews, a call';
      const tier = COMPANY_TIERS[offer.tier];
      const kind = tier ? ` (${tier.name.toLowerCase()}: ${tier.blurb.charAt(0).toLowerCase()}${tier.blurb.slice(1, -1)})` : '';
      const current = game.employment.employed ? game.player.level : game.employment.lastLevel ?? game.player.level;
      const change = offer.level > current ? ' A step up in title.' : offer.level < current ? ' A level down: bigger names often down-level.' : '';
      const equity = offer.tier === 'startup' ? ' Part of the pay is equity, worth something only if it sells.' : '';
      return `${from}: ${offer.company}${kind} wants you as ${title}, at ${formatMoney(offer.salary)} a year.${change}${equity}`;
    },
    choices: (game, offer) => [
      { label: 'Accept the offer', tag: !game.employment.employed ? 'safe' : offer.level > game.player.level ? 'ambitious' : 'bold', apply: (innerGame) => {
        acceptOffer(innerGame, offer);
        return `New badge, new desk, new politics at ${offer.company}.`;
      } },
      { label: 'Use it to negotiate a raise', tag: 'bold', available: (innerGame) => innerGame.employment.employed, apply: (innerGame, data, random) => {
        if (random.chance(0.5)) {
          innerGame.player.salary = payInBand(employerIndustry(innerGame), innerGame.player.level, innerGame.player.salary * 1.06);
          return 'Your manager matches part of it. A 6% raise.';
        }
        innerGame.player.alignment -= 0.06;
        return 'Your manager calls the bluff. Awkward.';
      } },
      { label: 'Decline', tag: game.employment.employed ? 'safe' : 'bold', apply: (innerGame) => (innerGame.employment.employed ? 'You stay put.' : 'You hold out for something better.') },
    ],
  };
}
