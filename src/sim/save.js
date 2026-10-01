// Saving and loading a career. The state is plain data except for the
// random source, the industry and character (kept by id) and queued events
// (kept by id and rebuilt from the deck).

import { INDUSTRIES, CHARACTERS } from '../config.js';
import { createRandom } from './random.js';
import { reserveAgentIds } from './agent.js';
import { eventById, offerEvent } from './events.js';
import { prepareCurrentEvent } from './game.js';
import { tieredIndustry } from './org.js';

// Version 2 added FMLA, the career journal and mid-quarter events; 3 the
// renamed roster, holidays and FIRE; 4 company tiers and career tracks;
// 5 aging (the vitals log) and event cooldowns.
export const SAVE_VERSION = 5;

function eventToData(entry) {
  return entry ? { id: entry.event.id, data: entry.data } : null;
}

function eventFromData(saved) {
  if (!saved) return null;
  const event = saved.id === 'jobOffer' ? offerEvent() : eventById(saved.id);
  return event ? { event, data: saved.data } : null;
}

/** Turn a game into a JSON string. */
export function serializeGame(game) {
  const { random, industry, character, org, lastOrg, eventQueue, currentEvent, botRandom, ...rest } = game;
  const plain = {
    ...rest,
    version: SAVE_VERSION,
    randomState: random.getState(),
    industryId: industry.id,
    characterId: character.id,
    org: org ? { ...org, industry: undefined, industryId: org.industry.id, seats: org.industry.seats } : null,
    lastOrg: lastOrg ? { companyName: lastOrg.companyName, tier: lastOrg.tier } : null,
    eventQueue: eventQueue.map(eventToData),
    currentEvent: eventToData(currentEvent),
  };
  return JSON.stringify(plain);
}

/**
 * Rebuild a game from a saved string.
 *
 * Returns:
 *   the game, or null when the save is missing, damaged or from another version
 */
export function deserializeGame(text) {
  let plain;
  try {
    plain = JSON.parse(text);
  } catch (error) {
    console.warn('The Ladder: could not read the save', error);
    return null;
  }
  if (!plain || plain.version !== SAVE_VERSION) return null;
  const random = createRandom(plain.seed);
  random.setState(plain.randomState);
  const industry = INDUSTRIES[plain.industryId] ?? INDUSTRIES.tech;
  const character = CHARACTERS.find((entry) => entry.id === plain.characterId) ?? CHARACTERS[0];
  const game = {
    ...plain,
    random,
    industry,
    character,
    eventQueue: plain.eventQueue.map(eventFromData).filter(Boolean),
    currentEvent: eventFromData(plain.currentEvent),
  };
  delete game.randomState;
  delete game.industryId;
  delete game.characterId;
  if (plain.org) {
    game.org = { ...plain.org, industry: tieredIndustry(industry, plain.org.tier ?? 'mid') };
    game.org.industry.seats = plain.org.seats ?? game.org.industry.seats;
    delete game.org.industryId;
    delete game.org.seats;
    const seated = game.org.agents.find((agent) => agent.isPlayer);
    if (seated) game.player = seated;
  }
  let highest = game.player.id;
  for (const agent of game.org?.agents ?? []) highest = Math.max(highest, agent.id);
  reserveAgentIds(highest);
  prepareCurrentEvent(game);
  return game;
}
