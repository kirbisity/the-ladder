import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createOrganization, agentsAtLevel, fillVacancies, rateLevels, applyReviewRules, runLayoffs,
  choosePeerPlan, employedAgents, layoffScore, rollDepartures,
} from '../src/sim/org.js';
import { createRandom } from '../src/sim/random.js';
import { INDUSTRIES, PERFORMANCE, MOTIVATION, ORG } from '../src/config.js';
import { tieredIndustry } from '../src/sim/org.js';

const industry = INDUSTRIES.tech;

test('a new organisation fills every seat of the pyramid', () => {
  const org = createOrganization(createRandom(3), industry);
  industry.seats.forEach((seats, level) => assert.equal(agentsAtLevel(org, level).length, seats));
});

test('one empty chair at the top ripples promotions all the way down', () => {
  const random = createRandom(4);
  const org = createOrganization(random, industry);
  for (const agent of org.agents) {
    agent.readiness = 120;
    agent.ratings = ['exceeds', 'exceeds', 'exceeds', 'exceeds'];
    agent.standing = 0.9;
  }
  const top = industry.seats.length - 1;
  agentsAtLevel(org, top)[0].departed = 'retired';
  const savedChances = ORG.externalSearchChance.slice();
  const savedOnly = ORG.externalOnlyChance.slice();
  ORG.externalSearchChance.fill(0);
  ORG.externalOnlyChance.fill(0);
  try {
    const promotions = fillVacancies(org, industry, random);
    assert.equal(promotions.length, top, 'one move at every level below the empty chair');
  } finally {
    ORG.externalSearchChance.splice(0, savedChances.length, ...savedChances);
    ORG.externalOnlyChance.splice(0, savedOnly.length, ...savedOnly);
  }
  industry.seats.forEach((seats, level) => assert.equal(agentsAtLevel(org, level).length, seats));
});

test('ratings follow the design brackets, and a PIP needs both bottom rank and a real gap', () => {
  const random = createRandom(5);
  const org = createOrganization(random, industry);
  const pool = agentsAtLevel(org, 0);
  pool.forEach((agent, index) => {
    agent.quarter.performance = 100 - index;
  });
  const laggard = pool[pool.length - 1];
  laggard.quarter.performance = 40;
  laggard.quartersAtLevel = 5;
  rateLevels(org, industry.seats.length);
  assert.equal(pool[0].quarter.rating, 'greatlyExceeds');
  assert.equal(laggard.quarter.rating, 'meetSome');
  const closeBehind = pool[pool.length - 2];
  assert.notEqual(closeBehind.quarter.rating, 'meetSome', 'bottom rank alone is not a PIP');
  applyReviewRules(org, industry);
  assert.ok(laggard.pip.active);
  assert.ok(laggard.quarter.performance < PERFORMANCE.pipBelowMedian * laggard.quarter.median);
});

test('a second bottom rating on a PIP ends the job', () => {
  const random = createRandom(6);
  const org = createOrganization(random, industry);
  const pool = agentsAtLevel(org, 0);
  pool.forEach((agent, index) => {
    agent.quarter.performance = 100 - index;
  });
  const laggard = pool[pool.length - 1];
  laggard.pip.active = true;
  laggard.quarter.performance = 30;
  rateLevels(org, industry.seats.length);
  applyReviewRules(org, industry);
  assert.equal(laggard.quarter.terminated, 'fired');
});

test('burnout rested properly is medical leave: no rating, no PIP', () => {
  const random = createRandom(7);
  const org = createOrganization(random, industry);
  const pool = agentsAtLevel(org, 0);
  pool.forEach((agent, index) => {
    agent.quarter.performance = 100 - index;
  });
  const onLeave = pool[pool.length - 1];
  onLeave.quarter.performance = 5;
  onLeave.burnout.active = true;
  onLeave.plan.hours = 8;
  onLeave.plan.shares = [0.3, 0.1, 0.1, 0.5];
  rateLevels(org, industry.seats.length);
  applyReviewRules(org, industry);
  assert.equal(onLeave.quarter.rating, 'onLeave');
  assert.ok(!onLeave.pip.active);
});

test('layoffs take the expensive and unconnected before the cheap and protected', () => {
  const random = createRandom(8);
  const org = createOrganization(random, industry);
  const pool = agentsAtLevel(org, 2);
  const exposed = pool[0];
  const covered = pool[1];
  exposed.salary *= 1.4;
  exposed.alignment = 0.6;
  exposed.lastRating = 'meetMost';
  covered.alignment = 1.4;
  covered.lastRating = 'exceeds';
  const median = industry.salaries[2];
  const quiet = { normal: () => 0, next: () => 0.5 };
  assert.ok(layoffScore(exposed, median, quiet) > layoffScore(covered, median, quiet));
  runLayoffs(org, industry, 0.2, random);
  const cut = employedAgents(org).filter((agent) => agent.quarter.terminated === 'laid off');
  assert.ok(cut.length > 0);
});

test('peers choose their hours around their industry, and rest when burned out', () => {
  const random = createRandom(9);
  const meanHours = {};
  for (const industryId of ['academia', 'tech', 'privateEquity']) {
    const org = createOrganization(random, INDUSTRIES[industryId]);
    let total = 0;
    for (const peer of org.agents) {
      choosePeerPlan(peer, INDUSTRIES[industryId], random);
      total += peer.plan.hours;
    }
    meanHours[industryId] = total / org.agents.length;
    assert.ok(Math.abs(meanHours[industryId] - INDUSTRIES[industryId].peerHours) < 2, `${industryId} peers average ${meanHours[industryId].toFixed(1)} h`);
  }
  assert.ok(meanHours.privateEquity > meanHours.tech + 0.5, 'private equity culture runs longer days');
  const org = createOrganization(random, industry);
  const burned = org.agents[0];
  burned.burnout.active = true;
  burned.personality.selfPreservation = 0.6;
  choosePeerPlan(burned, industry, random);
  assert.ok(burned.plan.shares[3] >= MOTIVATION.burnoutRestShare);
});

test('older people are pushed out of aggressive tech far more than steady tech, and not out of a university', () => {
  const pushedOutShare = (baseIndustry, tier) => {
    let left = 0;
    let total = 0;
    for (let seed = 1; seed <= 20; seed += 1) {
      const random = createRandom(seed);
      const org = createOrganization(random, baseIndustry, { tier });
      for (const agent of employedAgents(org)) agent.age = 52;
      for (const agent of employedAgents(org)) { agent.plan.openness = 0; agent.motivation = 90; }
      total += employedAgents(org).length;
      left += rollDepartures(org, random, 'normal', null).filter((entry) => entry.reason === 'pushed out').length;
    }
    return left / total;
  };
  const aggressive = pushedOutShare(INDUSTRIES.tech, 'aggressive');
  const stable = pushedOutShare(INDUSTRIES.tech, 'stable');
  const university = pushedOutShare(INDUSTRIES.academia, 'mid');
  assert.ok(aggressive > stable * 2, `aggressive ${aggressive}, stable ${stable}`);
  assert.ok(stable > university && university === 0, `stable ${stable}, university ${university}`);
});

test('where age-out is strong, an older worker is likelier to be on the layoff list', () => {
  const industryTech = tieredIndustry(INDUSTRIES.tech, 'aggressive');
  const org = createOrganization(createRandom(5), INDUSTRIES.tech, { tier: 'aggressive' });
  const [older, younger] = agentsAtLevel(org, 2);
  for (const agent of [older, younger]) { agent.alignment = 1; agent.informants = 0; agent.lastRating = 'meetAll'; agent.salary = industryTech.salaries[2]; agent.recentStanding = 0.5; agent.plan.openness = 0.3; }
  older.age = 50;
  younger.age = 30;
  const quiet = { normal: () => 0, next: () => 0.5 };
  const median = industryTech.salaries[2];
  assert.ok(layoffScore(older, median, quiet, industryTech) > layoffScore(younger, median, quiet, industryTech));
  const university = tieredIndustry(INDUSTRIES.academia, 'mid');
  assert.equal(layoffScore(older, university.salaries[2], quiet, university), layoffScore(younger, university.salaries[2], quiet, university));
});
