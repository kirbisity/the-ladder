// The quarterly event and crisis deck. Each event has a category (the
// design's macro / interpersonal / lifestyle split, plus the industry's
// own), a weight that can depend on the state of the career, and choices.
// Choices carry a tag so the balance bots can play them by temperament.
// Arcs schedule their next stage a quarter or more ahead.

import { EVENTS as EVENT_DIALS, RELATIONSHIP, INDUSTRY_STATS, ORG } from '../config.js';
import { clamp, payInBand, CITIZENSHIP, POLITICS } from './agent.js';
import { employedAgents, agentsAtLevel } from './org.js';
import { acceptOffer, managerOf, titleOf, formatMoney, netWorth, setPlan } from './game.js';

// ── Helpers ────────────────────────────────────────────────────────────

function peers(game, filter = () => true) {
  if (!game.org) return [];
  return employedAgents(game.org).filter((agent) => agent !== game.player && filter(agent));
}

function samePeerLevel(game) {
  return peers(game, (agent) => agent.level === game.player.level);
}

function findPeer(game, id) {
  return game.org ? game.org.agents.find((agent) => agent.id === id && !agent.departed) : null;
}

function schedule(game, id, inQuarters, data = {}) {
  game.flags.scheduled.push({ id, quarter: game.quarterIndex + inQuarters, data });
}

function hasLoyalFriend(game) {
  return peers(game, (agent) => agent.relationship >= RELATIONSHIP.loyalLine).length > 0;
}

function employed(game) {
  return game.employment.employed;
}

function bumpRelationship(peer, amount, game) {
  if (!peer) return;
  peer.relationship = clamp(peer.relationship + amount * (amount > 0 ? (game.player.traits.relationshipBonus ?? 1) : 1), -100, 100);
}

function scaleQuarter(game, multiplier) {
  const quarter = game.player.quarter;
  quarter.performanceMultiplier = (quarter.performanceMultiplier ?? 1) * multiplier;
}

function bonusQuarter(game, amount) {
  const quarter = game.player.quarter;
  quarter.performanceBonus = (quarter.performanceBonus ?? 0) + amount;
}

function forceHours(game, hours, quarters) {
  game.flags.minHours = hours;
  game.flags.minHoursQuarters = quarters + 1;
  setPlan(game, { hours: Math.max(game.player.plan.hours, hours) });
}

// ── The deck ───────────────────────────────────────────────────────────

const DECK = [
  // ─── Macro / structural ───
  {
    id: 'layoffRumor',
    category: 'macro',
    title: 'Restructuring whispers',
    weight: (game) => (employed(game) && game.flags.layoffAt === null ? (game.market === 'recession' ? 3 : 1) : 0),
    text: (game) => (hasLoyalFriend(game)
      ? 'A friend pulls you aside: finance has a list, and it lands next quarter.'
      : 'The all-hands is cancelled. Calendars fill with "sync" meetings with HR.'),
    onDraw: (game) => {
      game.flags.layoffAt = game.quarterIndex + 1;
    },
    choices: [
      { label: 'Keep your head down and deliver', tag: 'safe', apply: (game) => {
        setPlan(game, { openness: Math.min(game.player.plan.openness, 0.2) });
        game.player.alignment += 0.05;
        return 'You stay late and stay visible. Loyalty is noticed.';
      } },
      { label: 'Quietly polish your résumé', tag: 'ambitious', apply: (game) => {
        setPlan(game, { openness: Math.max(game.player.plan.openness, 0.7) });
        return 'Recruiters start hearing from you. Your focus slips a little.';
      } },
      { label: 'Ask your manager straight out', tag: 'bold', apply: (game, data, random) => {
        if (game.player.alignment > 1.05 && random.chance(0.7)) {
          game.player.alignment += 0.1;
          return 'Your manager levels with you, and makes sure your name is not on the list.';
        }
        game.player.alignment -= 0.08;
        return 'Your manager goes pale and changes the subject. That was noted.';
      } },
    ],
  },
  {
    id: 'surpriseLayoffs',
    category: 'macro',
    title: 'Surprise cuts',
    weight: (game) => (employed(game) && game.flags.layoffAt === null && !hasLoyalFriend(game) ? (game.market === 'recession' ? 1.5 : 0.3) : 0),
    text: 'A calendar invite titled "Org update" lands for Friday at 4 PM. Nobody warned you.',
    onDraw: (game) => {
      game.flags.layoffAt = game.quarterIndex;
    },
    choices: [
      { label: 'Brace yourself', tag: 'safe', apply: () => 'The quarter runs under a cloud. Cuts land at its end.' },
    ],
  },
  {
    id: 'budgetCuts',
    category: 'macro',
    title: 'Budget cuts',
    weight: (game) => (employed(game) ? (game.market === 'recession' ? 2 : 0.8) : 0),
    text: 'Finance freezes travel, hiring, and two projects your team cared about.',
    choices: [
      { label: 'Volunteer to absorb a cancelled project', tag: 'ambitious', apply: (game) => {
        game.player.readiness += 10;
        forceHours(game, 10, 1);
        return 'More work, and leadership remembers who stepped up.';
      } },
      { label: 'Fight to protect your team\'s budget', tag: 'kind', apply: (game) => {
        game.player.alignment -= 0.06;
        for (const peer of samePeerLevel(game)) bumpRelationship(peer, 8, game);
        return 'You lose the argument upstairs and win the room.';
      } },
      { label: 'Do less with less', tag: 'safe', apply: (game) => {
        game.player.motivation -= 4;
        return 'Nothing changes except the mood.';
      } },
    ],
  },
  {
    id: 'downturn',
    category: 'macro',
    title: 'Sector downturn',
    weight: (game) => (game.market === 'normal' ? 0.7 : 0),
    text: 'Your sector\'s index is down 30%. Hiring freezes everywhere.',
    choices: [
      { label: 'Hold on to what you have', tag: 'safe', apply: (game) => {
        game.market = 'recession';
        return 'Headhunters go quiet. Savings earn less.';
      } },
    ],
  },
  {
    id: 'boom',
    category: 'macro',
    title: 'Boom times',
    weight: (game) => (game.market === 'normal' ? 0.7 : 0),
    text: 'Funding is everywhere. Everyone you know is getting poached.',
    choices: [
      { label: 'Ride the wave', tag: 'safe', apply: (game) => {
        game.market = 'boom';
        game.player.motivation += 4;
        return 'Offers flow and the portfolio climbs.';
      } },
    ],
  },
  {
    id: 'reorg',
    category: 'macro',
    title: 'Reorg',
    weight: (game) => (employed(game) ? 1 : 0),
    text: 'A new org chart arrives with the subject line "Exciting changes". You have a new manager.',
    onDraw: (game, random) => {
      if (!game.org) return;
      const above = agentsAtLevel(game.org, game.player.level + 1).filter((agent) => agent.id !== game.org.managerId);
      if (above.length > 0) game.org.managerId = random.pick(above).id;
      game.player.alignment = 0.5 * game.player.alignment + 0.45;
    },
    choices: [
      { label: 'Book a 1:1 in week one', tag: 'ambitious', apply: (game) => {
        game.player.alignment += 0.12;
        const manager = managerOf(game);
        return manager?.rigid
          ? `${manager.name} runs a tight ship. You learn exactly what they want to see.`
          : 'You make a good first impression.';
      } },
      { label: 'Wait and see', tag: 'safe', apply: () => 'You keep your head down.' },
    ],
  },
  {
    id: 'strategyPivot',
    category: 'macro',
    title: 'Executive pivot',
    weight: (game) => (employed(game) && game.flags.pivotQuarters === 0 ? 0.8 : 0),
    text: 'The CEO announces a "bold new direction". Half of what you were building is now off-strategy.',
    onDraw: (game) => {
      const penalty = game.player.traits.pivotPenalty ?? 1;
      game.flags.outputModifier = 1 - 0.12 * penalty;
      game.flags.pivotQuarters = Math.round(2 * penalty);
    },
    choices: [
      { label: 'Champion the new direction loudly', tag: 'ambitious', apply: (game) => {
        game.player.readiness += 10;
        game.player.alignment += 0.06;
        return 'You are early to the new thing. It costs some evenings.';
      } },
      { label: 'Keep the old work alive quietly', tag: 'bold', apply: (game, data, random) => {
        if (random.chance(0.35)) {
          game.player.readiness += 20;
          return 'Six months later the old work saves the new direction. You look prescient.';
        }
        game.player.alignment -= 0.1;
        return 'Someone notices you did not get the memo.';
      } },
      { label: 'Adapt and get on with it', tag: 'safe', apply: () => 'Output dips while everyone re-plans.' },
    ],
  },

  // ─── Interpersonal / political ───
  {
    id: 'creditHeist',
    category: 'interpersonal',
    title: 'Credit heist',
    weight: (game) => (samePeerLevel(game).length > 0 ? 1.4 : 0),
    onDraw: (game, random) => {
      const rivals = samePeerLevel(game).sort((a, b) => a.relationship - b.relationship);
      return { peerId: rivals[0]?.id ?? random.pick(samePeerLevel(game)).id };
    },
    text: (game, data) => `${findPeer(game, data.peerId)?.name ?? 'A peer'} presents your analysis at the leadership review. Your name is not on the slide.`,
    choices: [
      { label: 'Confront them privately', tag: 'bold', apply: (game, data, random) => {
        const peer = findPeer(game, data.peerId);
        bumpRelationship(peer, -12, game);
        if (random.chance(0.5)) {
          bonusQuarter(game, 4);
          return 'They mumble an apology and send a correcting email.';
        }
        return 'They shrug. "We\'re a team, right?"';
      } },
      { label: 'Escalate to your manager', tag: 'ambitious', apply: (game, data) => {
        const peer = findPeer(game, data.peerId);
        if (game.player.alignment > 1) {
          game.player.readiness += 8;
          bumpRelationship(peer, -30, game);
          return 'Your manager sets the record straight in public. You have an enemy now.';
        }
        game.player.alignment -= 0.08;
        return 'Your manager sees "drama". It does not help you.';
      } },
      { label: 'Let it go', tag: 'safe', apply: (game) => {
        scaleQuarter(game, 0.94);
        game.player.motivation -= 5;
        return 'It stings for weeks.';
      } },
    ],
  },
  {
    id: 'mentorOffer',
    category: 'interpersonal',
    title: 'A sponsor appears',
    weight: (game) => (employed(game) && !game.flags.mentor ? 1 : 0),
    onDraw: (game, random) => {
      const seniors = peers(game, (agent) => agent.level >= game.player.level + 2);
      return { peerId: seniors.length ? random.pick(seniors).id : null };
    },
    text: (game, data) => `${findPeer(game, data.peerId)?.name ?? 'A senior leader'} offers to mentor you: a monthly coffee, and an advocate in rooms you are not in.`,
    choices: [
      { label: 'Accept, and do the homework they set', tag: 'ambitious', apply: (game, data, random) => {
        game.flags.mentor = data.peerId ?? 'outside';
        schedule(game, 'sponsorPayoff', random.int(2, 4), data);
        return 'You leave every coffee with a list.';
      } },
      { label: 'Politely decline: too busy', tag: 'safe', apply: () => 'They understand. Mostly.' },
    ],
  },
  {
    id: 'sponsorPayoff',
    category: 'arc',
    title: 'Your sponsor',
    eligible: (game) => employed(game),
    text: (game, data) => {
      const sponsor = findPeer(game, data.peerId);
      return sponsor
        ? `${sponsor.name} goes to bat for you in calibration.`
        : 'Your mentor has left the company. They send a warm note and their new number.';
    },
    choices: [
      { label: 'Thank them', tag: 'safe', apply: (game, data) => {
        const sponsor = findPeer(game, data.peerId);
        game.flags.mentor = null;
        if (sponsor) {
          game.player.readiness += 25;
          bumpRelationship(sponsor, 20, game);
          return 'Readiness jumps. People above you know your name now.';
        }
        game.player.plan.openness = Math.min(1, game.player.plan.openness + 0.1);
        return 'Your network grew, even if the sponsor walked.';
      } },
    ],
  },
  {
    id: 'juniorNeedsHelp',
    category: 'interpersonal',
    title: 'A junior is drowning',
    weight: (game) => (peers(game, (agent) => agent.level < game.player.level || agent.level === 0).length > 0 ? 1 : 0),
    onDraw: (game, random) => {
      const juniors = peers(game, (agent) => agent.level <= game.player.level);
      return { peerId: random.pick(juniors).id };
    },
    text: (game, data) => `${findPeer(game, data.peerId)?.name} is close to tears at their desk. Their launch is in two weeks.`,
    choices: [
      { label: 'Spend your evenings helping', tag: 'kind', apply: (game, data) => {
        game.player.health -= 2;
        game.player.readiness += 4;
        bumpRelationship(findPeer(game, data.peerId), 25, game);
        return 'The launch lands. They will remember it.';
      } },
      { label: 'Point them to the docs', tag: 'safe', apply: () => 'They figure it out, slowly.' },
      { label: 'Flag their performance to management', tag: 'selfish', apply: (game, data) => {
        game.player.alignment += 0.04;
        bumpRelationship(findPeer(game, data.peerId), -30, game);
        return 'Management appreciates the heads-up. Word gets around.';
      } },
    ],
  },
  {
    id: 'chairRival',
    category: 'interpersonal',
    title: 'Two candidates, one chair',
    weight: (game) => (samePeerLevel(game).some((agent) => agent.readiness > 70) ? 1.2 : 0),
    onDraw: (game) => {
      const rival = samePeerLevel(game).sort((a, b) => b.readiness - a.readiness)[0];
      return { peerId: rival.id };
    },
    text: (game, data) => `${findPeer(game, data.peerId)?.name} asks you to endorse them for the same promotion you are chasing.`,
    choices: [
      { label: 'Endorse them sincerely', tag: 'kind', apply: (game, data) => {
        bumpRelationship(findPeer(game, data.peerId), 30, game);
        game.player.readiness -= 10;
        return 'They are grateful. A future ally above you is worth something.';
      } },
      { label: 'Stay neutral', tag: 'safe', apply: (game, data) => {
        bumpRelationship(findPeer(game, data.peerId), -5, game);
        return 'They notice the silence.';
      } },
      { label: 'Quietly cast doubt on them', tag: 'selfish', apply: (game, data, random) => {
        const peer = findPeer(game, data.peerId);
        if (peer) peer.readiness -= 25;
        game.player.readiness += 6;
        if (random.chance(0.4)) {
          bumpRelationship(peer, -45, game);
          return 'It works, but they find out. Watch your back.';
        }
        return 'It works. Nobody traces it to you. Yet.';
      } },
    ],
  },
  {
    id: 'skipLevel',
    category: 'interpersonal',
    title: 'Lunch with the skip-level',
    weight: (game) => (employed(game) ? 0.9 : 0),
    text: 'Your manager\'s manager invites you to lunch. "Tell me what you\'d change."',
    choices: [
      { label: 'Pitch your boldest idea', tag: 'bold', apply: (game, data, random) => {
        if (random.chance(clamp(game.player.pol / 140, 0.2, 0.85))) {
          game.player.readiness += 12;
          return 'They take notes. Your idea shows up in the next all-hands.';
        }
        game.player.alignment -= 0.06;
        return 'It lands badly. Your manager hears about it.';
      } },
      { label: 'Listen and ask good questions', tag: 'safe', apply: (game) => {
        game.player.alignment += 0.05;
        return 'A pleasant lunch. You learn where the bodies are buried.';
      } },
    ],
  },
  {
    id: 'offsite',
    category: 'interpersonal',
    title: 'Team offsite',
    weight: (game) => (employed(game) ? 0.8 : 0),
    text: 'Two days at a lakeside lodge: trust falls, a karaoke night, and a "visioning" workshop.',
    choices: [
      { label: 'Go all in', tag: 'kind', apply: (game) => {
        for (const peer of peers(game, (agent) => Math.abs(agent.level - game.player.level) <= 1)) bumpRelationship(peer, 6, game);
        game.player.motivation += 3;
        game.player.health -= 1;
        return 'You sing badly and make three friends.';
      } },
      { label: 'Skip it: you have real work', tag: 'safe', apply: (game) => {
        for (const peer of samePeerLevel(game)) bumpRelationship(peer, -3, game);
        bonusQuarter(game, 2);
        return 'You ship things. The photos go round without you.';
      } },
    ],
  },
  {
    id: 'sharedStage',
    category: 'interpersonal',
    title: 'Who presents?',
    weight: (game) => (samePeerLevel(game).length > 0 ? 1 : 0),
    onDraw: (game, random) => ({ peerId: random.pick(samePeerLevel(game)).id }),
    text: (game, data) => `${findPeer(game, data.peerId)?.name} worked on your project too, and wants to co-present it to leadership.`,
    choices: [
      { label: 'Share the stage', tag: 'kind', apply: (game, data) => {
        bumpRelationship(findPeer(game, data.peerId), 18, game);
        bonusQuarter(game, -2);
        return 'A good partnership. Less spotlight for you.';
      } },
      { label: 'Present it alone', tag: 'selfish', apply: (game, data) => {
        bumpRelationship(findPeer(game, data.peerId), -15, game);
        bonusQuarter(game, 5);
        return 'Leadership sees you. They see you taking the credit too.';
      } },
    ],
  },
  {
    id: 'harshFeedback',
    category: 'interpersonal',
    title: 'Harsh feedback',
    weight: (game) => (managerOf(game)?.rigid ? 1.4 + (game.player.traits.rigidManagerClash ? 1 : 0) : 0.3),
    text: (game) => `${managerOf(game)?.name ?? 'Your manager'} says your work is "undisciplined" and wants daily status reports.`,
    choices: [
      { label: 'Push back with data', tag: 'bold', apply: (game) => {
        game.player.alignment -= game.player.traits.rigidManagerClash ? 0.14 : 0.07;
        game.player.motivation += 4;
        return 'You are right, and it does not matter. The relationship cools.';
      } },
      { label: 'Accept it and adjust', tag: 'safe', apply: (game) => {
        game.player.alignment += 0.06;
        game.player.motivation -= game.player.traits.rigidManagerClash ? 8 : 4;
        return 'Daily reports it is.';
      } },
    ],
  },
  {
    id: 'alliance',
    category: 'interpersonal',
    title: 'An alliance offered',
    weight: (game) => (peers(game, (agent) => agent.level === game.player.level).length > 0 ? 0.8 : 0),
    onDraw: (game, random) => ({ peerId: random.pick(samePeerLevel(game)).id }),
    text: (game, data) => `${findPeer(game, data.peerId)?.name} suggests you back each other in meetings. "Two votes are better than one."`,
    choices: [
      { label: 'Shake on it', tag: 'ambitious', apply: (game, data) => {
        bumpRelationship(findPeer(game, data.peerId), 25, game);
        game.player.informants += 0.5;
        return 'You hear about things earlier now.';
      } },
      { label: 'Decline politely', tag: 'safe', apply: () => 'You keep your independence.' },
    ],
  },
  {
    id: 'crossTeamContact',
    category: 'interpersonal',
    title: 'A contact in another division',
    weight: (game) => (employed(game) ? 0.6 + game.player.plan.openness : 0),
    text: 'Someone from another division asks to grab coffee. They know things about the company you do not.',
    choices: [
      { label: 'Grab coffee', tag: 'ambitious', apply: (game) => {
        game.player.informants += 1;
        return 'You leave with a clearer picture of the org, and a new informant.';
      } },
      { label: 'Too busy', tag: 'safe', apply: () => 'Maybe next quarter.' },
    ],
  },
  {
    id: 'reportResigns',
    category: 'interpersonal',
    title: 'A key report resigns',
    weight: (game) => (employed(game) && game.player.level >= ORG.managementFromLevel ? 1 + game.player.plan.managementStyle : 0),
    text: 'Your strongest report hands in their notice. A competitor offered 30% more.',
    choices: [
      { label: 'Fight for a counter-offer', tag: 'kind', apply: (game, data, random) => {
        game.player.alignment -= 0.04;
        if (random.chance(0.5)) return 'They stay. Finance is annoyed with you.';
        bonusQuarter(game, -5);
        return 'They leave anyway. The team scrambles.';
      } },
      { label: 'Wish them well', tag: 'safe', apply: (game) => {
        bonusQuarter(game, -6);
        return 'The hiring pipeline is long. Your team carries the load.';
      } },
    ],
  },
  {
    id: 'underperformer',
    category: 'interpersonal',
    title: 'An underperformer',
    weight: (game) => (employed(game) && game.player.level >= ORG.managementFromLevel ? 1 : 0),
    text: 'One of your reports has missed three deadlines in a row.',
    choices: [
      { label: 'Put them on a PIP', tag: 'selfish', apply: (game) => {
        bonusQuarter(game, 3);
        for (const peer of peers(game, (agent) => agent.level < game.player.level)) bumpRelationship(peer, -4, game);
        setPlan(game, { managementStyle: Math.min(1, game.player.plan.managementStyle + 0.1) });
        return 'Output ticks up. The team gets quieter.';
      } },
      { label: 'Coach them through it', tag: 'kind', apply: (game) => {
        forceHours(game, Math.min(16, game.player.plan.hours + 1), 1);
        game.player.readiness += 5;
        return 'Slow going, but they turn it round.';
      } },
    ],
  },

  // ─── Lifestyle / personal ───
  {
    id: 'healthScare',
    category: 'lifestyle',
    title: 'A health scare',
    weight: (game) => (game.player.health < 60 ? 3 : 0.4),
    text: 'Your doctor looks at the bloodwork and then at you. "How many hours are you working?"',
    choices: [
      { label: 'Take medical leave this quarter', tag: 'rest', apply: (game) => {
        game.player.health += 12;
        scaleQuarter(game, 0.7);
        return 'Six weeks off. The numbers improve. So does your mood.';
      } },
      { label: 'Push through', tag: 'ambitious', apply: (game, data, random) => {
        game.player.health -= 6;
        if (random.chance(0.3)) {
          game.player.health -= 15;
          return 'You collapse in the parking garage. Hospitalised for a week.';
        }
        return 'You fill the prescription and keep going.';
      } },
    ],
  },
  {
    id: 'familyIllness',
    category: 'lifestyle',
    title: 'A parent falls ill',
    weight: (game) => (game.player.age > 30 && !game.flags.caregiving ? 0.9 : 0),
    text: 'Your father has had a stroke. Your sister says she can\'t do this alone.',
    choices: [
      { label: 'Take family leave', tag: 'rest', apply: (game) => {
        scaleQuarter(game, 0.7);
        game.player.motivation += 4;
        game.flags.caregiving = true;
        schedule(game, 'familyRecovery', 2);
        return 'You are there. Work can wait.';
      } },
      { label: 'Pay for professional care', tag: 'safe', apply: (game) => {
        game.savings -= 18000;
        game.flags.caregiving = true;
        schedule(game, 'familyRecovery', 2);
        return `A carer starts Monday. ${formatMoney(18000)} a quarter, for now.`;
      } },
      { label: 'Juggle both', tag: 'ambitious', apply: (game) => {
        game.player.health -= 5;
        game.player.motivation -= 8;
        game.flags.caregiving = true;
        schedule(game, 'familyRecovery', 2);
        return 'Hospital at 7, office at 9, hospital at 8. Something has to give.';
      } },
    ],
  },
  {
    id: 'familyRecovery',
    category: 'arc',
    title: 'Your father',
    text: 'Your father is home from rehab, walking with a cane, and complaining about the food.',
    choices: [
      { label: 'Visit on Sunday', tag: 'kind', apply: (game) => {
        game.flags.caregiving = false;
        game.player.motivation += 6;
        return 'It is good to just sit with him.';
      } },
    ],
  },
  {
    id: 'partner',
    category: 'lifestyle',
    title: 'Someone special',
    weight: (game) => (!game.married && game.player.age > 24 && game.player.age < 45 ? 0.9 : 0),
    text: 'Two years in, your partner asks the question over dinner.',
    choices: [
      { label: 'Yes, with a big wedding', tag: 'kind', apply: (game) => {
        game.married = true;
        game.savings -= 35000;
        game.player.motivation += 12;
        return `A wonderful day. ${formatMoney(35000)} well spent, mostly.`;
      } },
      { label: 'Yes, at the courthouse', tag: 'safe', apply: (game) => {
        game.married = true;
        game.savings -= 3000;
        game.player.motivation += 10;
        return 'Just the two of you, and lunch after.';
      } },
      { label: 'Not now: work comes first', tag: 'ambitious', apply: (game) => {
        game.player.motivation -= 10;
        return 'They leave in the spring.';
      } },
    ],
  },
  {
    id: 'baby',
    category: 'lifestyle',
    title: 'A baby on the way',
    weight: (game) => (game.married && game.dependents < 3 && game.player.age < 44 ? 1 : 0),
    text: 'Two pink lines.',
    choices: [
      { label: 'Take full parental leave', tag: 'rest', apply: (game) => {
        game.dependents += 1;
        scaleQuarter(game, 0.6);
        game.player.motivation += 12;
        return 'Three blurry months you will never forget.';
      } },
      { label: 'Back at your desk in two weeks', tag: 'ambitious', apply: (game) => {
        game.dependents += 1;
        game.player.health -= 6;
        game.player.motivation += 4;
        return 'You learn to answer email one-handed at 3 AM.';
      } },
    ],
  },
  {
    id: 'house',
    category: 'lifestyle',
    title: 'The house',
    weight: (game) => (game.homeEquity === 0 && game.savings > 120000 ? 1 : 0),
    text: 'A house you love comes up, ten minutes from the office.',
    choices: [
      { label: 'Buy it', tag: 'ambitious', apply: (game) => {
        const deposit = Math.min(game.savings * 0.6, 250000);
        game.savings -= deposit;
        game.homeEquity = deposit * 1.2;
        game.player.motivation += 6;
        return `You put down ${formatMoney(deposit)}. The mortgage starts next month.`;
      } },
      { label: 'Keep renting', tag: 'safe', apply: () => 'Flexibility has value too.' },
    ],
  },
  {
    id: 'fitness',
    category: 'lifestyle',
    title: 'A half-marathon',
    weight: () => 0.7,
    text: 'A friend talks you into training for a half-marathon in the spring.',
    choices: [
      { label: 'Sign up and train', tag: 'rest', apply: (game) => {
        game.player.health += 6;
        game.player.motivation += 3;
        game.flags.moodModifier = (game.flags.moodModifier ?? 0) + 4;
        return 'Early runs, early nights. You feel twenty-five.';
      } },
      { label: 'Not this year', tag: 'safe', apply: () => 'Next year, definitely.' },
    ],
  },
  {
    id: 'vacation',
    category: 'lifestyle',
    title: 'Use it or lose it',
    weight: (game) => (employed(game) ? 1 : 0),
    text: 'HR reminds you that you have 19 days of unused vacation.',
    choices: [
      { label: 'Take two real weeks off', tag: 'rest', apply: (game) => {
        game.player.motivation += 12;
        game.player.health += 3;
        scaleQuarter(game, 0.9);
        return 'No laptop. You come back a person again.';
      } },
      { label: 'Let it lapse', tag: 'ambitious', apply: (game) => {
        game.player.motivation -= 3;
        return 'The days vanish at year end.';
      } },
    ],
  },
  {
    id: 'startupBet',
    category: 'lifestyle',
    title: 'A friend\'s startup',
    weight: (game) => (game.savings > 30000 ? 0.7 : 0),
    text: 'An old classmate is raising a seed round and offers you a slice.',
    choices: [
      { label: `Invest $20k`, tag: 'bold', apply: (game, data, random) => {
        game.savings -= 20000;
        schedule(game, 'startupOutcome', random.int(8, 16), { win: random.chance(0.15) });
        return 'You wire the money and try not to think about it.';
      } },
      { label: 'Pass', tag: 'safe', apply: () => 'You wish them luck.' },
    ],
  },
  {
    id: 'startupOutcome',
    category: 'arc',
    title: 'The startup',
    text: (game, data) => (data.win ? 'Your friend\'s startup is acquired.' : 'Your friend\'s startup has shut down.'),
    choices: [
      { label: 'Read the email', tag: 'safe', apply: (game, data) => {
        if (data.win) {
          game.savings += 200000;
          game.player.motivation += 8;
          return `Your $20k is now ${formatMoney(200000)}.`;
        }
        return 'The $20k is gone. You still have the hoodie.';
      } },
    ],
  },
  {
    id: 'insomnia',
    category: 'lifestyle',
    title: 'Insomnia',
    weight: (game) => (game.player.plan.hours >= 11 ? 1.5 : 0.1),
    text: 'You lie awake rehearsing tomorrow\'s meetings. It has been three weeks.',
    choices: [
      { label: 'Cut your hours back', tag: 'rest', apply: (game) => {
        setPlan(game, { hours: Math.max(8, game.player.plan.hours - 2) });
        return 'You start leaving at six. Sleep returns.';
      } },
      { label: 'Melatonin and coffee', tag: 'ambitious', apply: (game) => {
        game.player.health -= 4;
        game.player.motivation -= 3;
        return 'It mostly works. Mostly.';
      } },
    ],
  },
  {
    id: 'windfall',
    category: 'lifestyle',
    title: 'An inheritance',
    weight: () => 0.25,
    text: 'A great-aunt you met twice has left you something.',
    choices: [
      { label: 'Invest it', tag: 'safe', apply: (game) => {
        game.savings += 25000;
        return `${formatMoney(25000)} into an index fund.`;
      } },
    ],
  },
  {
    id: 'carTrouble',
    category: 'lifestyle',
    title: 'The transmission',
    weight: () => 0.6,
    text: 'The car makes a noise like a dying walrus.',
    choices: [
      { label: 'Fix it', tag: 'safe', apply: (game) => {
        game.savings -= 6000;
        return `${formatMoney(6000)} later, it runs.`;
      } },
    ],
  },
  {
    id: 'unemploymentLow',
    category: 'lifestyle',
    title: 'Another rejection',
    weight: (game) => (!employed(game) ? 2.5 : 0),
    text: 'The final round went well, you thought. The email starts "Unfortunately".',
    choices: [
      { label: 'Widen the search', tag: 'ambitious', apply: (game) => {
        setPlan(game, { openness: 1 });
        game.player.motivation -= 3;
        return 'You apply to anything that pays.';
      } },
      { label: 'Take a week to reset', tag: 'rest', apply: (game) => {
        game.player.motivation += 4;
        return 'A week of walks. Then back to it.';
      } },
    ],
  },

  // ─── Industry ───
  {
    id: 'productionOutage',
    category: 'industry',
    industry: 'tech',
    title: 'Production outage',
    weight: (game) => (employed(game) ? 0.3 + game.player.industry.techDebt / 100 : 0),
    text: 'The main service is down. Twitter has noticed. Your VP is in the incident channel.',
    choices: [
      { label: 'Lead a heroic overhaul', tag: 'ambitious', apply: (game) => {
        forceHours(game, 13, 1);
        schedule(game, 'overhaulVerdict', 1, { startReadiness: game.player.readiness });
        return 'You will live in the office this quarter. Leadership is watching.';
      } },
      { label: 'Patch it and hand it to on-call', tag: 'safe', apply: (game) => {
        game.player.industry.techDebt = Math.min(100, game.player.industry.techDebt + 10);
        return 'The bleeding stops. The debt grows.';
      } },
    ],
  },
  {
    id: 'overhaulVerdict',
    category: 'arc',
    title: 'The overhaul',
    eligible: (game) => employed(game),
    text: (game) => (['greatlyExceeds', 'exceeds'].includes(game.player.lastRating)
      ? 'Leadership pivots the roadmap around your overhaul. It is now "the platform".'
      : 'Leadership thanks you for the overhaul, then pivots to a different strategy.'),
    choices: [
      { label: 'Take it in', tag: 'safe', apply: (game) => {
        game.player.industry.techDebt = Math.max(0, game.player.industry.techDebt - 30);
        if (['greatlyExceeds', 'exceeds'].includes(game.player.lastRating)) {
          game.player.readiness += 25;
          game.player.motivation += 8;
          return 'You are on the shortlist for the next chair.';
        }
        game.player.motivation -= 10;
        return 'All those nights, for a slide in someone else\'s deck.';
      } },
    ],
  },
  {
    id: 'techDebtCrisis',
    category: 'industry',
    industry: 'tech',
    title: 'The codebase is on fire',
    weight: (game) => (game.player.industry.techDebt > 70 ? 2 : 0),
    text: 'Every change breaks two things. Your team wants a quarter to refactor.',
    choices: [
      { label: 'Demand a refactoring sprint', tag: 'safe', apply: (game) => {
        setPlan(game, { project: 'refactor' });
        game.flags.lockedProject = 'refactor';
        game.player.alignment -= 0.04;
        return 'Product grumbles. The pagers will thank you.';
      } },
      { label: 'Ship features anyway', tag: 'ambitious', apply: (game) => {
        game.player.industry.techDebt = Math.min(100, game.player.industry.techDebt + 10);
        bonusQuarter(game, 3);
        return 'Velocity now, incidents later.';
      } },
    ],
  },
  {
    id: 'hackathon',
    category: 'industry',
    industry: 'tech',
    title: 'Hackathon',
    weight: () => 0.8,
    text: 'The annual 48-hour hackathon. The winner demos to the CEO.',
    choices: [
      { label: 'Enter with a wild idea', tag: 'bold', apply: (game, data, random) => {
        game.player.skill += 4;
        game.player.health -= 2;
        if (random.chance(0.25 * (game.player.traits.moonshotLanding ?? 1))) {
          game.player.readiness += 12;
          return 'You win. The CEO asks for your name twice.';
        }
        return 'No prize, but you learned a framework.';
      } },
      { label: 'Sleep through it', tag: 'rest', apply: (game) => {
        game.player.motivation += 2;
        return 'A good weekend.';
      } },
    ],
  },
  {
    id: 'clientEscalation',
    category: 'industry',
    industry: 'consulting',
    title: 'Client escalation',
    weight: () => 1,
    text: 'The client CFO hates the deck and wants someone on a plane tonight.',
    choices: [
      { label: 'Fly out tonight', tag: 'ambitious', apply: (game) => {
        game.player.health -= 4;
        game.player.industry.clientScore = Math.min(100, game.player.industry.clientScore + 15);
        return 'You rebuild the deck at 30,000 feet. The CFO is mollified.';
      } },
      { label: 'Send the junior', tag: 'safe', apply: (game) => {
        game.player.industry.clientScore -= 12;
        return 'The junior does their best. The client wanted you.';
      } },
    ],
  },
  {
    id: 'benchTime',
    category: 'industry',
    industry: 'consulting',
    title: 'On the bench',
    weight: (game) => (game.player.industry.utilization < 0.7 ? 1.5 : 0.2),
    text: 'Your case ended early. Staffing has nothing but a six-month audit in Ohio.',
    choices: [
      { label: 'Take the Ohio audit', tag: 'ambitious', apply: (game) => {
        game.player.industry.clientScore += 10;
        game.player.motivation -= 5;
        return 'Billable again. The hotel has a waffle maker.';
      } },
      { label: 'Wait for a better case', tag: 'bold', apply: (game) => {
        game.player.industry.clientScore -= 10;
        game.player.skill += 3;
        return 'You read, you learn, and your utilisation number glows red.';
      } },
    ],
  },
  {
    id: 'roadShow',
    category: 'industry',
    industry: 'consulting',
    title: 'Four cities, ten days',
    weight: () => 0.8,
    text: 'The partner wants you on the roadshow: Chicago, Dallas, Atlanta, Denver.',
    choices: [
      { label: 'Pack the carry-on', tag: 'ambitious', apply: (game) => {
        game.player.health -= 5;
        game.player.readiness += 8;
        return 'You learn every airport lounge. The partner learns your name.';
      } },
      { label: 'Plead a family conflict', tag: 'rest', apply: (game) => {
        game.player.alignment -= 0.05;
        return 'Someone else goes. They get the face time.';
      } },
    ],
  },
  {
    id: 'auction',
    category: 'industry',
    industry: 'privateEquity',
    title: 'A competitive auction',
    weight: () => 1,
    text: 'A target company is in a competitive auction. The MD wants a model by Monday.',
    choices: [
      { label: 'Bid aggressively', tag: 'bold', apply: (game, data, random) => {
        game.player.health -= 3;
        if (random.chance(0.4)) {
          game.player.industry.dealFlow = Math.min(100, game.player.industry.dealFlow + 40);
          return 'You win the auction. The deal is yours to close.';
        }
        game.player.motivation -= 5;
        return 'Outbid by a sovereign wealth fund. A lost weekend.';
      } },
      { label: 'Walk away from a rich price', tag: 'safe', apply: (game) => {
        game.player.alignment += 0.03;
        return 'Discipline. The MD nods.';
      } },
    ],
  },
  {
    id: 'portfolioCrisis',
    category: 'industry',
    industry: 'privateEquity',
    title: 'A portfolio company stumbles',
    weight: () => 0.8,
    text: 'A portfolio company has missed its covenants. The board needs someone in the room.',
    choices: [
      { label: 'Take the board seat', tag: 'ambitious', apply: (game) => {
        forceHours(game, Math.min(16, game.player.plan.hours + 2), 1);
        game.player.readiness += 12;
        return 'Turnarounds make careers, or end them.';
      } },
      { label: 'Let operations handle it', tag: 'safe', apply: (game) => {
        bonusQuarter(game, -4);
        return 'It limps along.';
      } },
    ],
  },
  {
    id: 'fundraise',
    category: 'industry',
    industry: 'privateEquity',
    title: 'Fundraising',
    weight: (game) => ((game.fundDryPowder ?? 100) < 40 ? 2 : 0.3),
    text: 'Dry powder is running low. The partners are raising Fund IV and need people on the road with LPs.',
    choices: [
      { label: 'Join the LP roadshow', tag: 'ambitious', apply: (game) => {
        game.fundDryPowder = 100;
        game.player.health -= 3;
        game.player.readiness += 8;
        return 'Fund IV closes oversubscribed. You were in the room.';
      } },
      { label: 'Stay on deals', tag: 'safe', apply: (game) => {
        game.fundDryPowder = Math.min(100, (game.fundDryPowder ?? 100) + 50);
        return 'The partners raise a smaller fund without you.';
      } },
    ],
  },
  {
    id: 'reviewer2',
    category: 'industry',
    industry: 'academia',
    title: 'Reviewer 2',
    weight: () => 1,
    text: 'Reviewer 2 says your paper "lacks novelty" and recommends citing their own work.',
    choices: [
      { label: 'Revise and resubmit', tag: 'safe', apply: (game) => {
        game.player.motivation -= 4;
        return 'Six more weeks of revisions.';
      } },
      { label: 'Send it to a lesser venue', tag: 'ambitious', apply: (game) => {
        game.player.industry.researchProgress += 40;
        return 'Accepted in a week. Fewer people will read it.';
      } },
    ],
  },
  {
    id: 'grantDeadline',
    category: 'industry',
    industry: 'academia',
    title: 'Grant deadline',
    weight: () => 1,
    text: 'The big federal grant is due in nine days and the budget section is empty.',
    choices: [
      { label: 'All-nighters until it is in', tag: 'ambitious', apply: (game, data, random) => {
        game.player.health -= 4;
        if (random.chance(0.3 + game.player.pol / 400)) {
          game.player.industry.grants += 1;
          game.player.industry.grantQuarters = 8;
          game.player.readiness += 10;
          return 'Funded. Two years of postdocs.';
        }
        return 'Not funded, "but very competitive".';
      } },
      { label: 'Skip this cycle', tag: 'rest', apply: () => 'There is always next year.' },
    ],
  },
  {
    id: 'keynote',
    category: 'industry',
    industry: 'academia',
    title: 'A keynote invitation',
    weight: (game) => 0.4 + game.player.plan.openness,
    text: 'You are invited to give a keynote at a major conference abroad.',
    choices: [
      { label: 'Accept', tag: 'ambitious', apply: (game) => {
        game.player.industry.citations += 15;
        game.player.informants += 1;
        game.player.health -= 2;
        return 'Jet lag, and twelve new collaborators.';
      } },
      { label: 'Decline', tag: 'rest', apply: () => 'You stay home and write.' },
    ],
  },
];

const DECK_BY_ID = new Map(DECK.map((event) => [event.id, event]));

export function eventById(id) {
  return DECK_BY_ID.get(id) ?? null;
}

export function allEvents() {
  return DECK;
}

/**
 * Draw one event: a category by the design's split, then an event in it by
 * weight. Categories with nothing eligible fall through to the others.
 */
export function drawEvent(game, random) {
  const weights = EVENT_DIALS.categoryWeights;
  const eligible = DECK.filter((event) => event.category !== 'arc'
    && (!event.industry || event.industry === game.industry.id)
    && (event.weight ? event.weight(game) : 1) > 0);
  const categories = Object.keys(weights).filter((category) => eligible.some((event) => event.category === category));
  const category = random.weighted(categories, (name) => weights[name]);
  if (!category) return null;
  const event = random.weighted(eligible.filter((entry) => entry.category === category), (entry) => entry.weight(game));
  if (!event) return null;
  return event;
}

/** The job offer event, built from the offer in hand. */
export function offerEvent() {
  return {
    id: 'jobOffer',
    category: 'career',
    title: 'An offer',
    text: (game, offer) => {
      const title = titleOf(game, offer.level);
      const from = offer.source === 'headhunter' ? 'A recruiter calls' : 'After weeks of interviews, a call';
      return `${from}: ${offer.company} wants you as ${title}, at ${formatMoney(offer.salary)} a year.`;
    },
    choices: (game, offer) => [
      { label: 'Accept the offer', tag: !game.employment.employed ? 'safe' : offer.level > game.player.level ? 'ambitious' : 'bold', apply: (innerGame) => {
        acceptOffer(innerGame, offer);
        return `New badge, new desk, new politics at ${offer.company}.`;
      } },
      { label: 'Use it to negotiate a raise', tag: 'bold', available: (innerGame) => innerGame.employment.employed, apply: (innerGame, data, random) => {
        if (random.chance(0.5)) {
          innerGame.player.salary = payInBand(innerGame.industry, innerGame.player.level, innerGame.player.salary * 1.06);
          return 'Your manager matches part of it. A 6% raise.';
        }
        innerGame.player.alignment -= 0.06;
        return 'Your manager calls the bluff. Awkward.';
      } },
      { label: 'Decline', tag: game.employment.employed ? 'safe' : 'bold', apply: (innerGame) => (innerGame.employment.employed ? 'You stay put.' : 'You hold out for something better.') },
    ],
  };
}

export { netWorth, CITIZENSHIP, POLITICS, INDUSTRY_STATS };
