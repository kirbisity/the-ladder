// Shared tools for event cards: finding colleagues, scheduling the next
// stage of an arc, nudging the quarter, and paying bills the way a real
// household does (insured or not).

import { RELATIONSHIP } from '../../config.js';
import { clamp } from '../agent.js';
import { employedAgents } from '../org.js';
import { setPlan, formatMoney } from '../game.js';
import { record } from '../story.js';

export function peers(game, filter = () => true) {
  if (!game.org) return [];
  return employedAgents(game.org).filter((agent) => agent !== game.player && filter(agent));
}

export function samePeerLevel(game) {
  return peers(game, (agent) => agent.level === game.player.level);
}

export function findPeer(game, id) {
  return game.org ? game.org.agents.find((agent) => agent.id === id && !agent.departed) : null;
}

export function schedule(game, id, inQuarters, data = {}) {
  game.flags.scheduled.push({ id, quarter: game.quarterIndex + inQuarters, data });
}

export function hasLoyalFriend(game) {
  return peers(game, (agent) => agent.relationship >= RELATIONSHIP.loyalLine).length > 0;
}

export function employed(game) {
  return game.employment.employed;
}

export function bumpRelationship(peer, amount, game) {
  if (!peer) return;
  peer.relationship = clamp(peer.relationship + amount * (amount > 0 ? (game.player.traits.relationshipBonus ?? 1) : 1), -100, 100);
}

export function scaleQuarter(game, multiplier) {
  const quarter = game.player.quarter;
  quarter.performanceMultiplier = (quarter.performanceMultiplier ?? 1) * multiplier;
}

export function bonusQuarter(game, amount) {
  const quarter = game.player.quarter;
  quarter.performanceBonus = (quarter.performanceBonus ?? 0) + amount;
}

export function forceHours(game, hours, quarters) {
  game.flags.minHours = hours;
  game.flags.minHoursQuarters = quarters + 1;
  setPlan(game, { hours: Math.max(game.player.plan.hours, hours) });
}

/** The same moment, told in each industry's own words. */
export function byIndustry(game, variants) {
  return variants[game.industry.id] ?? variants.default ?? variants.tech;
}

/** Health cover: an employer plan, or COBRA while out of work. */
export function insured(game) {
  return game.employment.employed || Boolean(game.flags.cobra);
}

/** Pay a bill from savings. Returns the amount, formatted, for the card's result. */
export function spend(game, amount) {
  game.savings -= amount;
  return formatMoney(amount);
}

/** Spread a bill over the next quarters as a payment plan. */
export function paymentPlan(game, total, quarters) {
  game.paymentPlans = game.paymentPlans ?? [];
  game.paymentPlans.push({ perQuarter: total / quarters, quartersLeft: quarters });
  return formatMoney(total / quarters);
}

/** A one-quarter lift to the odds of a job offer, while searching. */
export function boostSearch(game, amount) {
  game.flags.searchBoost = (game.flags.searchBoost ?? 0) + amount;
}

export { record, formatMoney, setPlan, clamp };
