// Pay, layoffs, company tiers, startups, growth and the two tracks: the
// rules that shape a whole career rather than a single quarter.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createOrganization, agentsAtLevel, reviewPay, payTarget, layoffScore, tieredIndustry, growOrganization,
  trackWeightedOutput, experiencedSkill,
} from '../src/sim/org.js';
import { managementMix } from '../src/sim/agent.js';
import { createGame, chooseEventOption, finishQuarterDays, closeQuarter, startRunning, makeOffer, fireReady, netWorth, fireNumber } from '../src/sim/game.js';
import { createRandom } from '../src/sim/random.js';
import { INDUSTRIES, COMPANY_TIERS, MONEY, ORG, TIME } from '../src/config.js';

const quiet = { normal: () => 0, next: () => 0.5 };

function clearEvents(game) {
  while (game.currentEvent) chooseEventOption(game, 0);
}

function playQuarterAsIs(game) {
  clearEvents(game);
  startRunning(game);
  finishQuarterDays(game);
  return closeQuarter(game);
}

test('pay follows standing a few years behind, and is never cut when standing falls', () => {
  const industry = tieredIndustry(INDUSTRIES.tech, 'mid');
  const org = createOrganization(createRandom(21), INDUSTRIES.tech, { tier: 'mid' });
  const star = agentsAtLevel(org, 2)[0];
  star.salary = industry.salaries[2];
  star.standing = 1;
  const target = payTarget(star, industry);
  assert.ok(target > star.salary * 1.4, 'the scenario: a top standing earns near the band top');
  reviewPay(org, industry);
  const afterOneYear = star.salary;
  assert.ok(afterOneYear > industry.salaries[2] && afterOneYear < target - (target - industry.salaries[2]) * 0.5, 'one year closes less than half the gap');
  for (let year = 0; year < 4; year += 1) reviewPay(org, industry);
  assert.ok(star.salary > target - (target - industry.salaries[2]) * 0.25, 'five years close most of it');
  const peak = star.salary;
  star.standing = 0.1;
  reviewPay(org, industry);
  assert.equal(star.salary, peak, 'a slump does not cut pay');
});

test('a slipping star paid for past glory is exposed in a layoff, unless someone above vouches for them', () => {
  const industry = tieredIndustry(INDUSTRIES.tech, 'mid');
  const org = createOrganization(createRandom(22), INDUSTRIES.tech, { tier: 'mid' });
  const [slipping, steady] = agentsAtLevel(org, 2);
  const median = industry.salaries[2] * 1.2;
  for (const agent of [slipping, steady]) {
    agent.alignment = 1;
    agent.informants = 0;
    agent.plan.openness = 0.3;
    agent.lastRating = 'meetMost';
    agent.recentStanding = 0.4;
  }
  slipping.salary = industry.salaries[2] * MONEY.bandTop;
  steady.salary = median;
  assert.ok(layoffScore(slipping, median, quiet, industry) > layoffScore(steady, median, quiet, industry), 'the expensive one goes first');
  slipping.alignment = 1.6;
  assert.ok(layoffScore(slipping, median, quiet, industry) < layoffScore(steady, median, quiet, industry), 'rapport above protects them');
});

test('tiers order their review cadence, PIP bar, growth and pay', () => {
  const aggressive = tieredIndustry(INDUSTRIES.tech, 'aggressive');
  const mid = tieredIndustry(INDUSTRIES.tech, 'mid');
  const stable = tieredIndustry(INDUSTRIES.tech, 'stable');
  assert.ok(aggressive.reviewEvery < mid.reviewEvery && mid.reviewEvery < stable.reviewEvery);
  assert.ok(aggressive.pipBelowMedian > mid.pipBelowMedian && mid.pipBelowMedian > stable.pipBelowMedian);
  assert.ok(aggressive.growthPerYear > mid.growthPerYear && mid.growthPerYear >= stable.growthPerYear);
  assert.ok(aggressive.salaries[3] > mid.salaries[3] && mid.salaries[3] > stable.salaries[3]);
  assert.ok(stable.politicsWeight > aggressive.politicsWeight && COMPANY_TIERS.startup.politicsWeight < stable.politicsWeight);
  const startup = tieredIndustry(INDUSTRIES.tech, 'startup');
  assert.ok(startup.seats.reduce((sum, seats) => sum + seats) < mid.seats.reduce((sum, seats) => sum + seats), 'a startup is small');
});

test('up or out is an elite-firm rule: steady consultancies do not enforce it', () => {
  const base = INDUSTRIES.consulting;
  assert.ok(base.upOrOutQuarters, 'the scenario: consulting has an up-or-out clock');
  assert.equal(tieredIndustry(base, 'aggressive').upOrOutQuarters, base.upOrOutQuarters);
  assert.ok(tieredIndustry(base, 'mid').upOrOutQuarters > base.upOrOutQuarters);
  assert.equal(tieredIndustry(base, 'stable').upOrOutQuarters, null);
  assert.equal(tieredIndustry(INDUSTRIES.tech, 'aggressive').upOrOutQuarters, null, 'tech never had one');
});

test('a steady employer rates once a year; a high-growth one every quarter', () => {
  for (const [tier, every] of [['stable', COMPANY_TIERS.stable.reviewEvery], ['aggressive', COMPANY_TIERS.aggressive.reviewEvery]]) {
    const game = createGame({ seed: 32, characterId: 'joseph', tierLock: tier });
    const reviewed = [];
    for (let quarter = 0; quarter < every * 3 && !game.outcome && game.employment.employed; quarter += 1) {
      const report = playQuarterAsIs(game);
      if (report.review) reviewed.push(quarter);
    }
    assert.ok(reviewed.length >= 2, `${tier}: the scenario needs two reviews in a row`);
    for (let index = 1; index < reviewed.length; index += 1) {
      assert.equal(reviewed[index] - reviewed[index - 1], every, `${tier}: one review every ${every} quarters`);
    }
  }
});

test('a startup can fold, taking the job, or sell, paying out the equity', () => {
  const failSaved = COMPANY_TIERS.startup.failPerQuarter;
  const exitSaved = COMPANY_TIERS.startup.exitPerQuarter;
  try {
    COMPANY_TIERS.startup.failPerQuarter = 1;
    const folding = createGame({ seed: 41, characterId: 'joseph', tierLock: 'startup' });
    assert.equal(folding.org.tier, 'startup');
    const report = playQuarterAsIs(folding);
    assert.equal(report.lostJob, 'company folded');
    assert.ok(folding.journal.some((entry) => entry.kind === 'startupFolded'));

    COMPANY_TIERS.startup.failPerQuarter = 0;
    COMPANY_TIERS.startup.exitPerQuarter = 1;
    const selling = createGame({ seed: 42, characterId: 'joseph', tierLock: 'startup' });
    const before = selling.savings;
    playQuarterAsIs(selling);
    const exit = selling.journal.find((entry) => entry.kind === 'startupExit');
    assert.ok(exit && exit.payout > 0, 'the equity pays');
    assert.ok(selling.savings > before + exit.payout * 0.5);
    assert.notEqual(selling.org.tier, 'startup', 'the buyer is an established company');
  } finally {
    COMPANY_TIERS.startup.failPerQuarter = failSaved;
    COMPANY_TIERS.startup.exitPerQuarter = exitSaved;
  }
});

test('growth adds chairs low and in the middle, never at the top', () => {
  const org = createOrganization(createRandom(51), INDUSTRIES.tech, { tier: 'aggressive' });
  const before = org.industry.seats.slice();
  for (let year = 0; year < 15; year += 1) growOrganization(org);
  const after = org.industry.seats;
  assert.ok(after[1] > before[1] && after[3] > before[3], 'the base and middle grow');
  for (let level = ORG.growthStopsAtLevel; level < after.length; level += 1) assert.equal(after[level], before[level], `level ${level} stays`);
});

test('past the fork, managers are judged on influence and experts on their own work', () => {
  const industry = INDUSTRIES.tech;
  const org = createOrganization(createRandom(61), industry);
  const [manager, expert] = agentsAtLevel(org, industry.trackFromLevel + 2);
  for (const agent of [manager, expert]) {
    agent.quarter.core = 1000;
    agent.quarter.political = 400;
    agent.quarter.citizenship = 300;
    agent.traits = {};
  }
  manager.track = 'management';
  expert.track = 'expert';
  assert.ok(managementMix(manager, industry) > 0);
  assert.ok(trackWeightedOutput(manager, industry) > trackWeightedOutput(expert, industry), 'politics and people count for a manager');
  for (const agent of [manager, expert]) agent.quarter.political = 0;
  assert.ok(trackWeightedOutput(expert, industry) > trackWeightedOutput(manager, industry), 'pure output counts for an expert');
  const junior = agentsAtLevel(org, 1)[0];
  junior.track = 'management';
  assert.equal(managementMix(junior, industry), 0, 'below the fork there is one ladder');
});

test('a hire brings the skill their years of experience built', () => {
  assert.ok(experiencedSkill(TIME.startAge) < experiencedSkill(TIME.startAge + 5));
  assert.ok(experiencedSkill(TIME.startAge + 5) < experiencedSkill(TIME.startAge + 15));
  assert.ok(experiencedSkill(TIME.startAge + 40) < 100);
});

test('moving to a smaller employer rounds the title up only below the fork', () => {
  const game = createGame({ seed: 71, characterId: 'joseph', tierLock: null });
  game.org.tier = 'aggressive';
  const fork = game.industry.trackFromLevel;
  let bumpedBelow = 0;
  let bumpedAbove = 0;
  for (let trial = 0; trial < 300; trial += 1) {
    const below = makeOffer(game, fork - 1, 1, 'headhunter');
    if (below.level > fork - 1) bumpedBelow += 1;
    const above = makeOffer(game, fork + 1, 1, 'headhunter');
    if (above.level > fork + 1) bumpedAbove += 1;
  }
  assert.ok(bumpedBelow > 0, 'the scenario: some offers come from smaller employers and bump the title');
  assert.equal(bumpedAbove, 0);
});

test('a startup unicorn exit can make someone financially independent overnight', () => {
  const startup = COMPANY_TIERS.startup;
  const saved = { fail: startup.failPerQuarter, exit: startup.exitPerQuarter, unicorn: startup.unicornChance };
  try {
    startup.failPerQuarter = 0;
    startup.exitPerQuarter = 1;
    startup.unicornChance = 1;
    const game = createGame({ seed: 95, characterId: 'joseph', industryId: 'tech', startTier: 'startup' });
    game.player.age = 26;
    assert.equal(fireReady(game), false, 'the scenario: not independent before the exit');
    playQuarterAsIs(game);
    const exit = game.journal.find((entry) => entry.kind === 'startupExit');
    assert.ok(exit.payout > game.player.salary * startup.unicornMultiple[0] * 0.9);
    assert.ok(netWorth(game) >= fireNumber(game), 'rich overnight: past the FIRE number at once');
    game.fireAskedQuarter = null;
    assert.equal(fireReady(game), true, 'and the game offers the door');
  } finally {
    startup.failPerQuarter = saved.fail;
    startup.exitPerQuarter = saved.exit;
    startup.unicornChance = saved.unicorn;
  }
});
