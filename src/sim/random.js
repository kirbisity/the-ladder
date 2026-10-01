// A seeded random source, so a career can be replayed exactly and balance
// sweeps compare policies on the same luck.

/**
 * Create a deterministic random source.
 *
 * Args:
 *   seed: any integer
 *
 * Returns:
 *   { next, chance, between, int, normal, pick, weighted, seed }
 */
export function createRandom(seed) {
  let state = (seed >>> 0) || 1;

  // mulberry32: fast, 32-bit state, good enough for game rolls.
  function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = state;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  }

  function chance(probability) {
    return next() < probability;
  }

  function between(low, high) {
    return low + (high - low) * next();
  }

  function int(low, high) {
    return Math.floor(between(low, high + 1));
  }

  // Box–Muller; one of the pair is thrown away to keep the state simple.
  function normal(mean = 0, deviation = 1) {
    const first = Math.max(next(), 1e-12);
    const second = next();
    return mean + deviation * Math.sqrt(-2 * Math.log(first)) * Math.cos(2 * Math.PI * second);
  }

  function pick(items) {
    return items[Math.floor(next() * items.length)];
  }

  function weighted(items, weightOf) {
    let total = 0;
    for (const item of items) total += Math.max(0, weightOf(item));
    if (total <= 0) return null;
    let roll = next() * total;
    for (const item of items) {
      roll -= Math.max(0, weightOf(item));
      if (roll <= 0) return item;
    }
    return items[items.length - 1];
  }

  function getState() {
    return state;
  }

  function setState(saved) {
    state = saved >>> 0;
  }

  return { next, chance, between, int, normal, pick, weighted, seed, getState, setState };
}
