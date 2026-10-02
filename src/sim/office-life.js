// A moment spent walking round the office instead of at the desk: a coffee
// with a colleague, a pair-up at their desk, a whiteboard session in the
// meeting room, a breather in the lounge. Once a quarter, and small: the
// point is that the player chooses where to spend an hour of the day, and
// that people are worth some of it.

import { OFFICE_LIFE } from '../config.js';
import { clamp } from './agent.js';
import { employedAgents } from './org.js';

/** Whether the player can spend a moment this quarter, and if not, why. */
export function officeVisitStatus(game) {
  if (game.outcome) return { allowed: false, reason: 'The career is over.' };
  if (!game.employment.employed) return { allowed: false, reason: 'No office to walk round.' };
  if (game.officeVisitQuarter === game.quarterIndex) return { allowed: false, reason: 'You have already made time for people this quarter.' };
  return { allowed: true, reason: 'Walk to a colleague, the pantry, the meeting room or the lounge.' };
}

function nudge(agent, amount, bonus = 1) {
  if (agent) agent.relationship = clamp((agent.relationship ?? 0) + amount * bonus, -100, 100);
}

/** A colleague to talk to: the one at the desk, or anyone at the player's level. */
function someone(game, peer) {
  if (peer && !peer.departed) return peer;
  const pool = game.org ? employedAgents(game.org).filter((agent) => agent !== game.player) : [];
  const sameLevel = pool.filter((agent) => agent.level === game.player.level);
  return game.random.pick(sameLevel.length ? sameLevel : pool) ?? null;
}

/**
 * Spend the moment. Returns { text, applied }: what to tell the player, and
 * whether it counted (a second visit in a quarter is only a pleasant chat).
 */
export function officeVisit(game, kind, peer = null) {
  const status = officeVisitStatus(game);
  if (!status.allowed) return { text: status.reason, applied: false };
  const player = game.player;
  const bonus = player.traits.relationshipBonus ?? 1;
  const other = someone(game, peer);
  const first = other?.name?.split(' ')[0] ?? 'a colleague';
  const spec = OFFICE_LIFE;
  game.officeVisitQuarter = game.quarterIndex;
  let text;
  if (kind === 'pantry') {
    nudge(other, spec.coffeeRelationship, bonus);
    player.motivation += spec.coffeeMotivation;
    game.social = clamp((game.social ?? 0) + spec.coffeeSocial, 0, 100);
    text = `Coffee with ${first}: stories, a favour, and a laugh. +${spec.coffeeRelationship} with ${first}.`;
  } else if (kind === 'peer') {
    nudge(other, spec.pairRelationship, bonus);
    player.quarter.performanceBonus = (player.quarter.performanceBonus ?? 0) + spec.pairPerformance;
    player.skill = clamp(player.skill + spec.pairSkill, 0, 100);
    text = `You pair up with ${first} on a sticky problem. Both of you leave knowing more.`;
  } else if (kind === 'meeting') {
    player.readiness = clamp(player.readiness + spec.meetingReadiness, 0, 100);
    nudge(other, spec.meetingRelationship, bonus);
    text = `A whiteboard session with ${first}: your name is on the idea. Readiness up.`;
  } else {
    player.health = clamp(player.health + spec.loungeHealth, 0, 100);
    player.motivation += spec.loungeMotivation;
    text = 'A breather on the sofa. The inbox will keep.';
  }
  return { text, applied: true };
}
