// The calendar a career runs on, and the Super Intelligence Revolution. The
// player picks a birth year; the career starts the year they turn 22, pay is
// scaled to that year, and the revolution reaches their field at a fixed year
// (ERA.sirYear) or, for someone who starts after it, two quarters in. From
// then on there is a round of layoffs every year, the bottom rating comes
// sooner at the lower levels, and every five years both step up a wave: the
// safest place is higher up.

import { ERA, TIME } from '../config.js';

export function clampBirthYear(year) {
  const [low, high] = ERA.birthYears;
  return Math.max(low, Math.min(high, Math.round(Number.isFinite(year) ? year : ERA.defaultBirthYear)));
}

/** Pay in the money of the career's first year: a little more for later starters. */
export function payFactor(birthYear) {
  return 1 + ERA.payPerYear * (clampBirthYear(birthYear) - ERA.payReferenceYear);
}

/** The industry with its salaries scaled to the birth year. Keeps the original as `unscaled`. */
export function industryForEra(industry, birthYear) {
  const factor = payFactor(birthYear);
  return { ...industry, salaries: industry.salaries.map((salary) => Math.round(salary * factor / 1000) * 1000), payFactor: factor, unscaled: industry };
}

export function startYearOf(birthYear) {
  return clampBirthYear(birthYear) + TIME.startAge;
}

/** The calendar year a quarter falls in. */
export function calendarYear(game, quarterIndex = game.quarterIndex) {
  return (game.startYear ?? startYearOf(ERA.defaultBirthYear)) + Math.floor(quarterIndex / 4);
}

/** The quarter the revolution reaches this career's field. */
export function sirQuarter(game) {
  const year = ERA.sirYear[game.industry.id] ?? ERA.sirYear.tech;
  const start = game.startYear ?? startYearOf(ERA.defaultBirthYear);
  if (start >= year) return ERA.lateStarterDelayQuarters;
  return (year - start) * 4;
}

/** Whether the revolution has happened. */
export function sirActive(game) {
  return Boolean(game.sir);
}

/** The wave: 1 in the first five years after the revolution, 2 in the next five, and so on. */
export function sirWave(game) {
  if (!game.sir) return 0;
  return Math.min(ERA.maxWave, 1 + Math.floor((game.quarterIndex - game.sir.quarter) / (4 * ERA.waveYears)));
}

/** The share of a level cut in the year's layoff round: more at the bottom, more each wave. */
export function sirLayoffShare(wave, level) {
  const base = ERA.layoffBase + ERA.layoffPerWave * (wave - 1);
  const below = Math.max(0, ERA.middleLevel - level);
  const above = Math.max(0, level - ERA.middleLevel);
  return Math.min(0.45, base * (1 + ERA.lowLevelBias * below) / (1 + 0.5 * above));
}

/** How much higher the PIP bar sits at a level, as a multiplier on the bar. */
export function sirPipFactor(wave, level) {
  if (!wave) return 1;
  const step = ERA.pipBarPerWave * wave;
  return 1 + (level < ERA.middleLevel ? step : step / 3);
}

/** Whether this quarter is the year's layoff round (half a year after the revolution, then every year). */
export function sirLayoffDue(game) {
  if (!game.sir) return false;
  const since = game.quarterIndex - game.sir.quarter;
  return since >= 2 && (since - 2) % 4 === 0;
}
