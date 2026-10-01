// Autopilot's memory: for each kind of event, the answer the player gave
// last time. Autopilot repeats it; an event it has never seen is the
// player's to answer. The simulation itself is untouched: only who answers.

// Decisions too big to repeat blindly: an ending is always the player's.
const ALWAYS_ASK = new Set(['fireOffer', 'meetSomeone', 'proposal', 'considerKids', 'baby', 'coupleTalk']);

/** Remember how this kind of event was just answered. */
export function rememberAnswer(memory, eventId, choice, index) {
  memory[eventId] = { label: choice.label, tag: choice.tag, index };
}

/**
 * The choice to repeat, or null when the player must decide: a new kind of
 * event, one that is always asked, or one whose old answer is no longer on
 * offer. Labels can carry details that change (a title, a salary), so when
 * the exact label is gone the same tag stands in for it.
 */
export function pickRemembered(memory, eventId, choices) {
  const answer = memory[eventId];
  if (!answer || ALWAYS_ASK.has(eventId)) return null;
  const sameLabel = choices.findIndex((choice) => choice.label === answer.label);
  if (sameLabel >= 0) return sameLabel;
  const sameTag = choices.findIndex((choice) => choice.tag === answer.tag);
  return sameTag >= 0 ? sameTag : null;
}
