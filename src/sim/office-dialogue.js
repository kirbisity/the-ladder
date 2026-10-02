// Walking round the office is a small conversation, not a click: at a
// colleague, the pantry, the meeting room or the lounge the player is offered
// a few things to say or do. Some build a relationship, some get information
// (what people are hearing, where the player stands), and one can start a
// romance. As before, a quarter allows one such moment; asking when it is
// spent only gets pleasantries.

import { OFFICE_LIFE, SOCIAL } from '../config.js';
import { clamp, RATING_LABELS } from './agent.js';
import { employedAgents } from './org.js';
import { managerOf, employerIndustry } from './game.js';
import { officeVisitStatus } from './office-life.js';
import { makeCandidate, startDating, bumpSocial } from './family.js';
import { record } from './story.js';

const firstName = (agent) => agent?.name?.split(' ')[0] ?? 'a colleague';

/** A colleague for the conversation: the one at the desk, or anyone at the player's level. */
function someone(game, peer) {
  if (peer && !peer.departed) return peer;
  const pool = game.org ? employedAgents(game.org).filter((agent) => agent !== game.player) : [];
  const sameLevel = pool.filter((agent) => agent.level === game.player.level);
  return game.random.pick(sameLevel.length ? sameLevel : pool) ?? null;
}

function nudge(agent, amount, game) {
  if (agent) agent.relationship = clamp((agent.relationship ?? 0) + amount * (amount > 0 ? game.player.traits.relationshipBonus ?? 1 : 1), -100, 100);
}

const canAskOut = (game) => !game.partner && !game.married && game.player.age >= 22 && game.player.age <= 50;

/** Something worth knowing, from what people in the building would say. */
export function intel(game, peer) {
  const player = game.player;
  const tellings = [];
  if (game.flags.layoffAt !== null && game.flags.layoffAt !== undefined) {
    const quarters = Math.max(1, game.flags.layoffAt - game.quarterIndex);
    tellings.push(`"Keep this quiet: cuts are coming, in about ${quarters} quarter${quarters > 1 ? 's' : ''}. Make sure your name is on something that matters."`);
  } else {
    tellings.push('"It has been calm upstairs. No one has said the word reorg in weeks, which is either good news or the quiet before."');
  }
  const manager = managerOf(game);
  if (manager) {
    const warm = (manager.relationship ?? 0) + (player.alignment ?? 0) * 40;
    tellings.push(warm > 10 ? `"${firstName(manager)} speaks well of you in the leadership meetings."` : warm < -10 ? `"I would not take ${firstName(manager)} to lunch yet. They are not sold on you."` : `"${firstName(manager)} has not made up their mind about you. Give them something to remember."`);
  }
  if (player.lastRating) tellings.push(`"People are saying your last review was '${RATING_LABELS[player.lastRating] ?? player.lastRating}'. That is how you are being talked about."`);
  const industry = employerIndustry(game);
  const base = industry.salaries?.[player.level];
  if (base) {
    const position = (player.salary / base - 1) / 0.5;
    tellings.push(position < 0.25 ? '"Between us, people at your level are paid more than you. Ask at the next review."' : position > 0.75 ? '"You are near the top of the pay band for your level. The next raise has to come with a title."' : '"Your pay is about where it should be for the level. Nothing to fix there."');
  }
  return game.random.pick(tellings) ?? '"Nothing new."';
}

/**
 * The conversation at a place: who speaks, what they say, and what the
 * player can answer. `kind` is 'peer', 'pantry', 'meeting' or 'lounge'.
 */
export function dialogueFor(game, kind, peer = null) {
  const status = officeVisitStatus(game);
  const other = kind === 'meeting' || kind === 'lounge' ? null : someone(game, peer);
  const first = firstName(other);
  if (!status.allowed) {
    return { kind, speaker: other ? other.name : 'You', line: other ? `${first} smiles. "We talked earlier, did we not? Good to see you."` : 'You have made your rounds this quarter. A quiet minute is all there is.', options: [{ id: 'bye', label: 'Nod and carry on' }], other, allowed: false };
  }
  const options = [];
  let line;
  let speaker = other?.name ?? 'You';
  if (kind === 'peer') {
    line = game.random.pick([`${first} looks up from a screen. "Got a minute?"`, `${first} pulls out an earbud. "Oh, hi. What is up?"`, `${first} leans back. "Perfect timing, I needed a break."`]);
    options.push({ id: 'pair', label: 'Pair up on the hard problem' }, { id: 'rumour', label: 'Ask what they are hearing' }, { id: 'chat', label: 'Ask about their weekend' });
    if (canAskOut(game)) options.push({ id: 'date', label: `Ask ${first} out` });
  } else if (kind === 'pantry') {
    line = other ? `${first} is at the coffee machine, waiting on the last drops. "Long week," they say.` : 'The coffee machine gurgles. Nobody else is around.';
    options.push({ id: 'chat', label: 'Make small talk' }, { id: 'advice', label: 'Ask for advice on a decision' });
    if (other) options.push({ id: 'rumour', label: 'Ask what they are hearing' });
    if (other && canAskOut(game)) options.push({ id: 'date', label: `Ask ${first} to lunch, properly` });
  } else if (kind === 'meeting') {
    speaker = 'The meeting room';
    line = 'A free room, a whiteboard and an hour nobody has booked.';
    options.push({ id: 'sketch', label: 'Sketch out your best idea' }, { id: 'pitch', label: 'Rehearse the pitch for your next review' }, { id: 'invite', label: 'Pull a colleague in to brainstorm' });
  } else {
    speaker = 'The lounge';
    line = 'A deep sofa by the window, and nobody looking for you.';
    options.push({ id: 'rest', label: 'Close your eyes for ten minutes' }, { id: 'news', label: 'Catch up on the news' }, { id: 'friend', label: 'Call an old friend' });
  }
  return { kind, speaker, line, options, other, allowed: true };
}

/** What the player's answer does. Returns { text, applied }. */
export function answerDialogue(game, dialogue, optionId) {
  if (!dialogue.allowed || optionId === 'bye') return { text: 'A pleasant minute, and back to it.', applied: false };
  const player = game.player;
  const spec = OFFICE_LIFE;
  const other = dialogue.other;
  const first = firstName(other);
  game.officeVisitQuarter = game.quarterIndex;
  switch (optionId) {
    case 'pair':
      nudge(other, spec.pairRelationship, game);
      player.quarter.performanceBonus = (player.quarter.performanceBonus ?? 0) + spec.pairPerformance;
      player.skill = clamp(player.skill + spec.pairSkill, 0, 100);
      return { text: `You and ${first} untangle the problem on a shared screen. Both of you leave knowing more.`, applied: true };
    case 'rumour':
      nudge(other, 2, game);
      player.readiness = clamp(player.readiness + spec.intelReadiness, 0, 100);
      return { text: `${first} lowers their voice: ${intel(game, other)}`, applied: true };
    case 'chat':
      nudge(other, dialogue.kind === 'pantry' ? spec.coffeeRelationship : spec.chatRelationship, game);
      player.motivation += dialogue.kind === 'pantry' ? spec.coffeeMotivation : 1.5;
      bumpSocial(game, spec.coffeeSocial);
      return { text: dialogue.kind === 'pantry' ? `Coffee with ${first}: stories, a favour, a laugh. +${spec.coffeeRelationship} with ${first}.` : `${first} tells you about the weekend, and you remember the details. It matters more than it sounds.`, applied: true };
    case 'advice':
      nudge(other, 3, game);
      player.skill = clamp(player.skill + spec.adviceSkill, 0, 100);
      player.motivation += 1.5;
      return { text: `${first} has been through this before, and says so kindly. You see the decision differently.`, applied: true };
    case 'sketch':
      player.readiness = clamp(player.readiness + spec.meetingReadiness, 0, 100);
      return { text: 'The idea fits on one board. Photographed, dated, and yours.', applied: true };
    case 'pitch':
      player.readiness = clamp(player.readiness + spec.meetingReadiness * 0.6, 0, 100);
      player.pol = clamp(player.pol + spec.pitchPolitical, 0, 200);
      return { text: 'Three run-throughs to an empty room. The second sentence finally lands.', applied: true };
    case 'invite': {
      const guest = someone(game, null);
      nudge(guest, spec.meetingRelationship, game);
      player.quarter.performanceBonus = (player.quarter.performanceBonus ?? 0) + spec.pairPerformance * 0.7;
      return { text: `${firstName(guest)} joins, and in twenty minutes the idea has a second author and a better name.`, applied: true };
    }
    case 'rest':
      player.health = clamp(player.health + spec.loungeHealth, 0, 100);
      player.motivation += spec.loungeMotivation;
      return { text: 'Ten minutes of nothing. The inbox will keep.', applied: true };
    case 'news':
      player.motivation += 1;
      return { text: 'Nothing you can use, which is its own kind of break.', applied: true };
    case 'friend':
      bumpSocial(game, spec.friendSocial);
      player.motivation += 2;
      return { text: 'A fifteen-minute call that should have happened months ago. The circle gets a little bigger.', applied: true };
    case 'date': {
      const chance = clamp(0.25 + (game.social ?? SOCIAL.start) * SOCIAL.askPerPoint + (other?.relationship ?? 0) / 400, 0.12, 0.8);
      if (game.random.chance(chance)) {
        startDating(game, { ...makeCandidate(game, game.random), name: other.name, career: game.industry.name, age: Math.round(other.age ?? player.age) });
        player.motivation += 6;
        record(game, 'officeRomance', { partner: other.name });
        return { text: `${first} grins. "I thought you would never ask." A first dinner is booked for Friday. (${Math.round(chance * 100)}% chance, set by your circle and your nerve.)`, applied: true };
      }
      nudge(other, -4, game);
      player.motivation -= 3;
      return { text: `${first} is kind about it, and says no. The office will be a little awkward for a week. (${Math.round(chance * 100)}% chance.)`, applied: true };
    }
    default:
      return { text: '', applied: false };
  }
}
