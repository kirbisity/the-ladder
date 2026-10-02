// What life throws at a career: people close to you passing, a car crash, a
// fire at home, cancer for the player or a partner. Each is rolled once a
// quarter against a hazard that follows age (see MISFORTUNE in the config),
// and the rolls return events for the game to queue. The illness that comes
// of cancer runs on for quarters and is resolved here.

import { MISFORTUNE, FAMILY } from '../config.js';
import { record } from './story.js';

const SURNAMES_FIRST = {
  grandparent: ['Margaret', 'Walter', 'Eleanor', 'Harold', 'Ruth', 'Arthur'],
  parent: ['Helen', 'Robert', 'Patricia', 'Thomas', 'Linda', 'David'],
  relative: ['Aunt Carol', 'Uncle Ray', 'Aunt Nina', 'Uncle Sam', 'Aunt Joyce'],
  friend: ['Mika', 'Jonah', 'Priya', 'Luis', 'Hannah', 'Tomas'],
};

/** How likely a loss is this quarter, by the player's age. */
export function lossHazard(age) {
  return Math.min(MISFORTUNE.lossCap, MISFORTUNE.lossBase + MISFORTUNE.lossPerYear * Math.max(0, age - 24));
}

/** How near an age is to the peak of a window [low, peak, high]: 0 outside, 1 at the peak. */
function windowWeight(age, [low, peak, high]) {
  if (age <= low || age >= high) return 0.04;
  return age < peak ? (age - low) / (peak - low) : (high - age) / (high - peak);
}

function remaining(game) {
  if (!game.loved) {
    game.loved = {};
    for (const [kind, spec] of Object.entries(MISFORTUNE.loved)) game.loved[kind] = spec.count;
  }
  return game.loved;
}

/** Who is lost: a kind of loved one still living, chosen by how likely they are to go at this age. */
export function pickLoved(game, random) {
  const counts = remaining(game);
  const kinds = Object.keys(MISFORTUNE.loved).filter((kind) => counts[kind] > 0 && (kind !== 'inlaw' || (game.married && game.partner)));
  const kind = random.weighted(kinds, (name) => counts[name] * windowWeight(game.player.age, MISFORTUNE.loved[name].window));
  if (!kind) return null;
  counts[kind] -= 1;
  const spec = MISFORTUNE.loved[kind];
  const names = SURNAMES_FIRST[kind === 'inlaw' ? 'parent' : kind];
  const first = random.pick(names);
  const partnerFirst = game.partner?.name.split(' ')[0] ?? 'your partner';
  const label = {
    grandparent: first.match(/^(Margaret|Eleanor|Ruth)$/) ? 'Your grandmother' : 'Your grandfather',
    parent: first.match(/^(Helen|Patricia|Linda)$/) ? 'Your mother' : 'Your father',
    inlaw: `${partnerFirst}'s ${first.match(/^(Helen|Patricia|Linda)$/) ? 'mother' : 'father'}`,
    relative: `Your ${first}`.replace('Your Aunt ', 'Your aunt ').replace('Your Uncle ', 'Your uncle '),
    friend: `Your close friend ${first}`,
  }[kind];
  return { kind, name: first, label, hit: spec.hit };
}

/** The share of the crash hazard owed to who is driving: the young and the tired crash more. */
function crashHazard(game) {
  const spec = MISFORTUNE.crash;
  let hazard = spec.perQuarter;
  if (game.player.age < spec.youngBefore) hazard *= spec.youngFactor;
  if (game.player.plan.hours >= spec.tiredHours) hazard *= spec.tiredFactor;
  return hazard;
}

/** Cancer's hazard for someone of an age, per quarter. */
export function cancerHazard(age) {
  return Math.max(0, age - (MISFORTUNE.cancer.fromAge - 2)) * MISFORTUNE.cancer.perQuarterPerYear;
}

/**
 * The ages at which this career will lose someone: four to eight of them,
 * spread by how the hazard climbs with age. Fixing the count up front keeps
 * every career inside the plausible range, where independent rolls would
 * leave some with one loss and some with eleven.
 */
function lossAges(game) {
  if (!game.lossAges) {
    const random = game.random;
    const count = random.int(MISFORTUNE.lossesPerLife[0], MISFORTUNE.lossesPerLife[1]);
    const ages = [];
    for (let age = 24; age < 66; age += 0.25) ages.push(age);
    game.lossAges = Array.from({ length: count }, () => random.weighted(ages, lossHazard)).sort((a, b) => a - b);
  }
  return game.lossAges;
}

/**
 * The unlucky things that start this quarter, as [{ id, data }] for the
 * event queue. Nothing in the first quarter: a new hire finds their desk first.
 */
export function rollMisfortunes(game) {
  if (game.quarterIndex === 0 || game.flags.noMisfortune) return [];
  const random = game.random;
  const out = [];
  const rolled = game.misfortune ?? (game.misfortune = { crashes: 0, lastCrash: -99, lastFire: -99, cancers: 0 });
  const due = lossAges(game);
  if (due.length && game.player.age >= due[0]) {
    due.shift();
    const loved = pickLoved(game, random);
    if (loved) out.push({ id: 'passing', data: loved });
  }
  const spec = MISFORTUNE.crash;
  if (game.flags.car !== 'none' && rolled.crashes < spec.max && game.quarterIndex - rolled.lastCrash >= spec.cooldown && random.chance(crashHazard(game))) {
    const severity = random.weighted(Object.keys(spec.severity), (name) => spec.severity[name]);
    rolled.crashes += 1;
    rolled.lastCrash = game.quarterIndex;
    out.push({ id: 'carCrash', data: { severity, car: game.flags.car ?? 'old' } });
  }
  if (game.quarterIndex - rolled.lastFire >= MISFORTUNE.fire.cooldown && random.chance(MISFORTUNE.fire.perQuarter)) {
    rolled.lastFire = game.quarterIndex;
    out.push({ id: 'houseFire', data: { owned: game.homeEquity > 0, insured: !random.chance(MISFORTUNE.fire.uninsured) } });
  }
  if (!game.flags.illness) {
    const partnerOk = game.married && game.partner && game.partner.stage === 'married';
    const playerAt = random.chance(cancerHazard(game.player.age));
    const partnerAt = partnerOk && random.chance(cancerHazard(game.partner.age));
    if (playerAt || partnerAt) {
      rolled.cancers += 1;
      const stage = random.weighted([1, 2, 3], (value) => [0.4, 0.35, 0.25][value - 1]);
      out.push({ id: 'cancer', data: { who: playerAt ? 'player' : 'partner', stage } });
    }
  }
  return out;
}

/** The chance of coming out clear: stage, treatment and care. */
export function survivalChance(stage, treatment, cared) {
  const spec = MISFORTUNE.survival;
  const chance = spec.base - spec.perStage * (stage - 1) + (spec[treatment] ?? 0) + (cared ? spec.care : 0);
  return Math.min(spec.ceiling, Math.max(spec.floor, chance));
}

/** Begin an illness: the player's or the partner's, for a number of quarters of treatment. */
export function startIllness(game, { who, stage, treatment, cared = false }) {
  game.flags.illness = {
    who, stage, treatment, quartersLeft: MISFORTUNE.cancer.treatmentQuarters[treatment] ?? 8, survive: survivalChance(stage, treatment, cared),
  };
  record(game, 'cancer', { who, stage, partner: who === 'partner' ? game.partner?.name ?? null : null });
}

/** Health target lost to treatment, for the player's own illness. */
export function illnessHealthCost(game) {
  return game.flags.illness?.who === 'player' ? MISFORTUNE.cancer.healthTarget : 0;
}

/** Mood terms of an illness in the house: your own treatment, or caring for them. */
export function illnessMoodTerms(game) {
  const illness = game.flags.illness;
  if (!illness) return [];
  if (illness.who === 'player') return [{ label: 'Cancer treatment', value: -MISFORTUNE.cancer.moodWhileIll }];
  return [{ label: `Caring for ${game.partner?.name.split(' ')[0] ?? 'your partner'} through treatment`, value: -MISFORTUNE.cancer.careMood }];
}

/** What the partner's illness does to the marriage while it lasts. */
export function illnessFamilyTerm(game) {
  return game.flags.illness?.who === 'partner' ? -MISFORTUNE.cancer.careFamily : 0;
}

/**
 * One quarter of illness: the clock runs down, and at the end the player (or
 * partner) comes out clear or does not. Returns 'cleared', 'died' (the
 * player) or 'widowed' (the partner) on the quarter it resolves, else null.
 */
export function advanceIllness(game, report) {
  const illness = game.flags.illness;
  if (!illness) return null;
  illness.quartersLeft -= 1;
  if (illness.who === 'partner' && game.partner) game.partner.health = Math.max(10, game.partner.health - 4);
  if (illness.quartersLeft > 0) return null;
  game.flags.illness = null;
  if (game.random.chance(illness.survive)) {
    game.player.motivation += 15;
    if (game.partner && illness.who === 'partner') game.partner.health = Math.min(100, game.partner.health + 15);
    record(game, 'cancerCleared', { who: illness.who });
    report?.notes.push(illness.who === 'player' ? 'The scan is clear. The doctor says the word remission, and you cry in the car park.' : `${game.partner?.name.split(' ')[0] ?? 'They'} is clear. The word is remission.`);
    return 'cleared';
  }
  if (illness.who === 'player') {
    game.flags.cancerDeath = true;
    return 'died';
  }
  return 'widowed';
}

/** The partner has died: the marriage ends without a divorce, the mood falls hard and lingers. */
export function widow(game, report) {
  const partner = game.partner;
  const first = partner?.name.split(' ')[0] ?? 'Your partner';
  game.player.motivation -= FAMILY.divorceMotivationHit + 8;
  game.flags.divorceShadow = FAMILY.divorceShadow + 8;
  game.married = false;
  record(game, 'widowed', { partner: partner?.name ?? null, kids: game.children?.length ?? 0 });
  if (partner) game.exPartner = { ...partner, died: true };
  game.partner = null;
  game.family = null;
  report?.notes.push(`${first} has died. The house is very quiet.`);
}
