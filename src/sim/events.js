// The event and crisis deck, assembled. Every card has:
//   category — macro, interpersonal, industry (work), lifestyle (life),
//              jobless (the job hunt), arc (a scheduled follow-up), career
//   scope    — 'work' needs a job, 'jobless' needs to be out of work, 'any'
//   timing   — 'start' opens a quarter; 'life' lands on a random day mid-quarter
// The cards themselves live in src/sim/events/. Choices carry a tag so the
// balance bots can play them by temperament.

import { EVENTS as EVENT_DIALS } from '../config.js';
import { payInBand } from './agent.js';
import { acceptOffer, titleOf, formatMoney } from './game.js';
import { CORE_DECK } from './events/core.js';
import { LIFE_DECK, LIFE_IDS_FROM_CORE } from './events/life.js';
import { JOBLESS_DECK } from './events/jobless.js';
import { INDUSTRY_DECK } from './events/industry.js';

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

const DECK = [...CORE_DECK, ...LIFE_DECK, ...JOBLESS_DECK, ...INDUSTRY_DECK].map(normalise);
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

function eligibleCards(game, timing) {
  return DECK.filter((event) => event.timing === timing
    && event.category !== 'arc'
    && inScope(game, event)
    && (!event.industry || event.industry === game.industry.id)
    && (event.weight ? event.weight(game) : 1) > 0);
}

/**
 * Draw the card that opens a quarter. At work: a category by the design's
 * split (macro, office politics, the industry's own), then a card by
 * weight. Out of work: the job-hunt deck, with the odd market shock.
 */
export function drawEvent(game, random) {
  const eligible = eligibleCards(game, 'start');
  const weights = game.employment.employed ? EVENT_DIALS.categoryWeights : { jobless: 85, macro: 15 };
  const categories = Object.keys(weights).filter((category) => eligible.some((event) => event.category === category));
  const category = random.weighted(categories, (name) => weights[name]);
  if (!category) return null;
  return random.weighted(eligible.filter((entry) => entry.category === category), (entry) => (entry.weight ? entry.weight(game) : 1));
}

/** Draw a personal event for a random day of the quarter. */
export function drawLifeEvent(game, random) {
  return random.weighted(eligibleCards(game, 'life'), (entry) => (entry.weight ? entry.weight(game) : 1));
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
      return `${from}: ${offer.company} wants you as ${title}, at ${formatMoney(offer.salary)} a year.`;
    },
    choices: (game, offer) => [
      { label: 'Accept the offer', tag: !game.employment.employed ? 'safe' : offer.level > game.player.level ? 'ambitious' : 'bold', apply: (innerGame) => {
        acceptOffer(innerGame, offer);
        return `New badge, new desk, new politics at ${offer.company}.`;
      } },
      { label: 'Use it to negotiate a raise', tag: 'bold', available: (innerGame) => innerGame.employment.employed, apply: (innerGame, data, random) => {
        if (random.chance(0.5)) {
          innerGame.player.salary = payInBand(innerGame.industry, innerGame.player.level, innerGame.player.salary * 1.06);
          return 'Your manager matches part of it. A 6% raise.';
        }
        innerGame.player.alignment -= 0.06;
        return 'Your manager calls the bluff. Awkward.';
      } },
      { label: 'Decline', tag: game.employment.employed ? 'safe' : 'bold', apply: (innerGame) => (innerGame.employment.employed ? 'You stay put.' : 'You hold out for something better.') },
    ],
  };
}
