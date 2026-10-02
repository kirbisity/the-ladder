// Tuning a character before the career begins: a few small steps up or down
// on eight skills, paid for by steps down elsewhere. A step is tiny, two is
// the most for any one skill, and every step up has to be matched by a step
// down, so the character stays who they are; the player chooses where the
// emphasis falls.

export const ADJUSTABLE = [
  { id: 'iq', label: 'Intelligence', step: 3, unit: 'IQ', field: 'iq' },
  { id: 'pol', label: 'Political skill', step: 5, unit: 'points', field: 'pol' },
  { id: 'body', label: 'Body under long hours', trait: 'strainResistance', step: 0.08, base: 1 },
  { id: 'mood', label: 'Mood under long hours', trait: 'exhaustionResistance', step: 0.08, base: 1 },
  { id: 'steady', label: 'Shrugs off bad news', trait: 'steadiness', step: 0.04, base: 0 },
  { id: 'lead', label: 'Leadership', trait: 'leadership', step: 0.06, base: 1 },
  { id: 'desk', label: 'Output at the desk', trait: 'coreBonus', step: 0.03, base: 1 },
  { id: 'network', label: 'Networking pays back', trait: 'politicsBonus', step: 0.05, base: 1 },
];

export const MAX_STEPS = 2;

const stepsOf = (steps, id) => steps?.[id] ?? 0;

/** Steps the player can still spend: what has been given up, less what has been taken. */
export function adjustmentPoints(steps) {
  return 0 - ADJUSTABLE.reduce((sum, entry) => sum + stepsOf(steps, entry.id), 0);
}

/** Whether a set of steps is allowed: each within the range, the total no more than was given up. */
export function validAdjustments(steps) {
  return ADJUSTABLE.every((entry) => Math.abs(stepsOf(steps, entry.id)) <= MAX_STEPS) && adjustmentPoints(steps) >= 0;
}

/** The character's numbers with the steps applied: { iq, pol, traits }. */
export function applyAdjustments(character, steps = {}) {
  const traits = { ...character.traits };
  let { iq, pol } = character;
  for (const entry of ADJUSTABLE) {
    const count = stepsOf(steps, entry.id);
    if (!count) continue;
    if (entry.field === 'iq') iq += count * entry.step;
    else if (entry.field === 'pol') pol += count * entry.step;
    else traits[entry.trait] = Math.round(((traits[entry.trait] ?? entry.base) + count * entry.step) * 1000) / 1000;
  }
  return { iq, pol, traits };
}
