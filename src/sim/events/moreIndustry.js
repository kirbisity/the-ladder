// More industry cards, so a long career in one field does not keep meeting
// the same handful of moments. Each industry's list is merged into
// INDUSTRY_DECK, which tags them with the industry.

import {
  bumpRelationship, scaleQuarter, bonusQuarter, setPlan, savvy, politicalOdds, formatMoney, record, peers, schedule,
} from './helpers.js';

export const MORE_TECH = [
  {
    id: 'openSourceFame',
    title: 'Your side project takes off',
    weight: (game) => (game.player.level >= 1 ? 0.35 : 0),
    text: 'A library you wrote on weekends hits the front page of the programmer news site. Issues pour in, and two companies ask if you would maintain it for pay.',
    choices: [
      { label: 'Give it your evenings', tag: 'ambitious', apply: (game) => {
        game.player.health -= 3;
        game.player.motivation += 8;
        game.player.readiness += 8;
        game.savings += 6000;
        return 'Sponsors, a conference invitation, and no sleep. For a while you are the person who wrote that library.';
      } },
      { label: 'Accept some help and keep it small', tag: 'safe', apply: (game) => {
        game.player.motivation += 3;
        return 'You hand over two maintainers. It stays good, and you stay rested.';
      } },
    ],
  },
  {
    id: 'rewriteDebate',
    title: 'Rewrite or patch',
    weight: (game) => (game.player.level >= 2 ? 0.6 : 0),
    text: 'The billing service is fifteen years old and nobody dares touch it. Your team is split: rewrite it in a modern stack, or keep patching.',
    choices: [
      { label: 'Champion the rewrite', tag: 'bold', apply: (game, data, random) => {
        if (random.chance(savvy(game, 0.5))) {
          game.player.readiness += 12;
          game.player.industry.techDebt = Math.max(0, game.player.industry.techDebt - 15);
          return 'Eighteen months later it ships, to a standing ovation and a small bonus.';
        }
        scaleQuarter(game, 0.9);
        game.player.motivation -= 5;
        return 'It balloons. Everyone agrees it was a good idea in principle.';
      } },
      { label: 'Argue for patching', tag: 'safe', apply: (game) => {
        game.player.industry.techDebt = Math.min(100, game.player.industry.techDebt + 6);
        return 'Cheap and fast, again, and the next engineer inherits a worse problem.';
      } },
    ],
  },
  {
    id: 'youngPhenom',
    title: 'The twenty-three-year-old',
    weight: (game) => (game.player.age >= 36 && game.player.level >= 2 ? 0.7 : 0),
    text: 'A new grad ships in two weeks what your team estimated at a quarter. They are not even showing off. The room has noticed.',
    choices: [
      { label: 'Mentor them and share the credit', tag: 'kind', apply: (game) => {
        game.player.alignment += 0.04;
        game.player.motivation += 3;
        return 'They become your best ally. You learn a few new tricks from them.';
      } },
      { label: 'Work harder to keep up', tag: 'ambitious', apply: (game) => {
        game.player.health -= 3;
        game.player.motivation -= 3;
        bonusQuarter(game, 6);
        return 'You stay late until the review. It works, at a price.';
      } },
      { label: 'Question whether the code is sound', tag: 'selfish', apply: (game, data, random) => {
        if (random.chance(0.4)) {
          bonusQuarter(game, 4);
          return 'You find two real issues. They do not take it well, but they fix them.';
        }
        game.player.alignment -= 0.06;
        return 'The code is fine. You look petty.';
      } },
    ],
  },
  {
    id: 'ipoDay',
    title: 'The company goes public',
    weight: (game) => (game.org?.tier === 'aggressive' && !game.flags.ipoSeen ? 0.12 : game.org?.tier === 'mid' && !game.flags.ipoSeen ? 0.04 : 0),
    onDraw: (game) => {
      game.flags.ipoSeen = true;
    },
    text: 'The company rings the bell. Your equity, which you had mostly stopped thinking about, is suddenly worth real money after the six-month lock-up.',
    choices: [
      { label: 'Sell as soon as you can', tag: 'safe', apply: (game) => {
        const gain = game.player.salary * 1.4;
        game.savings += gain * 0.7;
        game.lifetimeEarnings += gain;
        record(game, 'ipo');
        return `${formatMoney(gain)} before tax, banked while the price is still high.`;
      } },
      { label: 'Hold and see where it goes', tag: 'bold', apply: (game, data, random) => {
        const gain = game.player.salary * (random.chance(0.55) ? 3 : 0.6);
        game.savings += gain * 0.7;
        game.lifetimeEarnings += gain;
        record(game, 'ipo');
        return gain > game.player.salary * 2 ? `The stock doubles. ${formatMoney(gain)} before tax.` : `The stock sags after the first week: ${formatMoney(gain)} before tax.`;
      } },
    ],
  },
  {
    id: 'incidentReview',
    title: 'The post-mortem',
    weight: () => 0.6,
    text: 'You were on call for last week\'s outage, and the post-mortem has to name a root cause. The easy answer points at a teammate\'s change.',
    choices: [
      { label: 'Write it blameless, and name the process gap', tag: 'kind', apply: (game) => {
        game.player.alignment += 0.04;
        return 'It becomes the template the company uses for post-mortems.';
      } },
      { label: 'Name the change', tag: 'selfish', apply: (game) => {
        const friend = game.random.pick(peers(game));
        bumpRelationship(friend, -20, game);
        return 'It is accurate, and it costs you a friend.';
      } },
    ],
  },
];

export const MORE_CONSULTING = [
  {
    id: 'rainmakerLunch',
    title: 'Lunch with the rainmaker',
    weight: (game) => (game.player.level >= 2 ? 0.6 : 0),
    text: 'A partner who brings in a third of the office\'s revenue asks you to lunch. "I need someone who can run my next three engagements."',
    choices: [
      { label: 'Say yes: they are the fast track', tag: 'ambitious', apply: (game) => {
        game.player.readiness += 14;
        game.player.health -= 3;
        game.player.plan.openness = Math.max(0, game.player.plan.openness - 0.1);
        return 'Their engagements are the best and the hardest. Your name goes on the staffing list.';
      } },
      { label: 'Pick your own projects', tag: 'safe', apply: (game) => {
        game.player.motivation += 2;
        return 'You keep your freedom. The rainmaker moves on to someone hungrier.';
      } },
    ],
  },
  {
    id: 'staffingRoulette',
    title: 'Staffing roulette',
    weight: () => 0.9,
    text: 'The next staffing round starts Monday. You can lobby your staffer, or take what you are given.',
    choices: [
      { label: 'Lobby for a client in your city', tag: 'bold', apply: (game, data, random) => {
        if (random.chance(politicalOdds(game, 0.35, 130))) {
          game.player.health += 2;
          return 'A local client. You sleep in your own bed for six months.';
        }
        game.player.alignment -= 0.03;
        return 'You get staffed in Houston. For a year.';
      } },
      { label: 'Take whatever comes', tag: 'safe', apply: (game, data, random) => {
        if (random.chance(0.5)) {
          game.player.readiness += 6;
          return 'A strong team and a respected partner. Lucky.';
        }
        game.player.motivation -= 3;
        return 'A team of strangers on a client with no budget.';
      } },
    ],
  },
  {
    id: 'airlineStatus',
    title: 'Diamond status',
    weight: (game) => (game.player.plan.hours > 9.5 ? 0.5 : 0.2),
    text: 'The airline sends a shiny card: you have flown enough to be treated like a king in lounges and nowhere else.',
    choices: [
      { label: 'Use the lounges and upgrades', tag: 'rest', apply: (game) => {
        game.player.motivation += 3;
        return 'Not a bad perk. It makes the travel slightly less grim.';
      } },
      { label: 'Notice what it says about your life', tag: 'bold', apply: (game) => {
        game.player.motivation -= 3;
        setPlan(game, { hours: Math.max(8, game.player.plan.hours - 0.5) });
        return 'Two hundred nights in hotels last year. You start declining the second red-eye of the week.';
      } },
    ],
  },
  {
    id: 'bidDefence',
    title: 'The bid defence',
    weight: () => 0.7,
    text: 'The partners are pitching a $4M engagement against a rival firm. They want you in the room for the technical Q&A.',
    choices: [
      { label: 'Prepare like it is a trial', tag: 'ambitious', apply: (game, data, random) => {
        game.player.health -= 2;
        if (random.chance(savvy(game, 0.65))) {
          game.player.readiness += 10;
          bonusQuarter(game, 6);
          return 'You win it. A partner says your name in the debrief.';
        }
        return 'You lose to a cheaper firm. It was not your fault, and you know it.';
      } },
      { label: 'Wing it from the slides', tag: 'bold', apply: (game) => {
        game.player.alignment -= 0.03;
        return 'It goes fine, which is not the same as winning.';
      } },
    ],
  },
];

export const MORE_PRIVATE_EQUITY = [
  {
    id: 'lpMeeting',
    title: 'The annual LP meeting',
    weight: (game) => (game.player.level >= 2 ? 0.6 : 0),
    text: 'The annual meeting with limited partners. The managing partner asks you to present the portfolio performance slide, live, to the pension funds.',
    choices: [
      { label: 'Own the slide', tag: 'ambitious', apply: (game, data, random) => {
        if (random.chance(savvy(game, 0.6))) {
          game.player.readiness += 10;
          return 'It goes flawlessly. Two LPs ask who you are.';
        }
        game.player.motivation -= 4;
        return 'A question catches you out. The room is silent for six seconds.';
      } },
      { label: 'Hand it to a more senior colleague', tag: 'safe', apply: () => 'It goes well, and no one remembers you were there.' },
    ],
  },
  {
    id: 'dealDies',
    title: 'The deal dies',
    weight: () => 0.8,
    text: 'Three months of diligence on a deal, and at the last meeting the seller takes a competing bid. Your model was pristine; your weekends are gone.',
    choices: [
      { label: 'Debrief and move on', tag: 'safe', apply: (game) => {
        game.player.motivation -= 5;
        return 'The partners call it "the cost of doing business". It does not feel that way.';
      } },
      { label: 'Ask why you lost, and keep the relationship', tag: 'bold', apply: (game, data, random) => {
        if (random.chance(0.5)) {
          game.player.readiness += 6;
          return 'The seller calls two weeks later with the next one.';
        }
        game.player.motivation -= 6;
        return 'You get polite non-answers.';
      } },
    ],
  },
  {
    id: 'coInvest',
    title: 'Co-invest',
    weight: (game) => (game.player.level >= 3 && game.savings > 150000 ? 0.4 : 0),
    text: 'The firm allows senior staff to co-invest in a deal. You can put in $100,000 of your own money.',
    choices: [
      { label: 'Invest', tag: 'bold', apply: (game, data, random) => {
        game.savings -= 100000;
        const multiple = random.chance(0.6) ? random.between(1.6, 3.2) : random.between(0.2, 0.9);
        schedule(game, 'coInvestResult', 12, { multiple });
        return 'It is in. Three years of waiting begin.';
      } },
      { label: 'Pass', tag: 'safe', apply: () => 'You keep the cash for a rainy day.' },
    ],
  },
  {
    id: 'portcoLayoffs',
    title: 'The portfolio company cuts',
    weight: () => 0.5,
    text: 'To hit the plan, the CEO of a portfolio company needs to cut 15% of staff. The partners ask you to review the deck and sign off.',
    choices: [
      { label: 'Sign off', tag: 'safe', apply: (game) => {
        game.player.motivation -= 3;
        game.player.alignment += 0.03;
        return 'The numbers work. You do not read the names on the list.';
      } },
      { label: 'Push for a smaller cut', tag: 'kind', apply: (game, data, random) => {
        if (random.chance(0.5)) {
          game.player.alignment -= 0.02;
          return 'Eight percent instead, and a hard conversation with the partners.';
        }
        game.player.alignment -= 0.05;
        return 'Overruled, politely.';
      } },
    ],
  },
];

export const MORE_ACADEMIA = [
  {
    id: 'studentCrisis',
    title: 'A student in crisis',
    weight: () => 0.6,
    text: 'One of your PhD students stops coming in, and tells you in an email at 2 AM that they are not okay.',
    choices: [
      { label: 'Drop everything and help', tag: 'kind', apply: (game) => {
        game.player.motivation -= 4;
        game.player.alignment += 0.02;
        scaleQuarter(game, 0.95);
        return 'You find them support, and a plan, and a lighter workload. They graduate a year late, and they graduate.';
      } },
      { label: 'Point them to the counselling service', tag: 'safe', apply: (game) => {
        game.player.motivation -= 2;
        return 'The service has a six-week waitlist. You keep checking in.';
      } },
    ],
  },
  {
    id: 'bookContract',
    title: 'A book contract',
    weight: (game) => (game.player.level >= 1 ? 0.35 : 0),
    text: 'A university press offers you a contract for the book you have been talking about for years. It means two years of writing on top of everything else.',
    choices: [
      { label: 'Sign and write it', tag: 'ambitious', apply: (game) => {
        game.player.industry.citations += 10;
        game.player.readiness += 15;
        game.player.health -= 3;
        game.player.motivation += 4;
        return 'Two years of early mornings. It comes out, and it is cited.';
      } },
      { label: 'Decline: papers are enough', tag: 'safe', apply: () => 'It is a lot of time for a few dozen readers.' },
    ],
  },
  {
    id: 'deanOffer',
    title: 'The dean\'s request',
    weight: (game) => (game.player.level >= 3 && game.player.age > 42 ? 0.4 : 0),
    text: 'The dean asks if you will serve as associate dean for two years. It is administration, committees and no research time, and it is where chairs come from.',
    choices: [
      { label: 'Accept', tag: 'ambitious', apply: (game) => {
        game.player.readiness += 18;
        game.player.motivation -= 3;
        scaleQuarter(game, 0.92);
        return 'Meetings, budgets and compromises. Your research slows down.';
      } },
      { label: 'Decline and keep your lab', tag: 'safe', apply: (game) => {
        game.player.motivation += 2;
        return 'The dean finds another victim.';
      } },
    ],
  },
  {
    id: 'visitingFellowship',
    title: 'A visiting fellowship abroad',
    weight: (game) => (game.player.level >= 1 ? 0.35 : 0),
    text: 'A university in Europe offers a one-semester visiting fellowship. Funded, with no teaching and a month of walking around old libraries.',
    choices: [
      { label: 'Go', tag: 'rest', apply: (game) => {
        game.player.health += 3;
        game.player.motivation += 8;
        game.player.industry.citations += 4;
        scaleQuarter(game, 0.9);
        return 'A semester without email. You come back thinking about your work differently.';
      } },
      { label: 'Stay: the lab needs you', tag: 'safe', apply: () => 'Someone else gets it. Next time, perhaps.' },
    ],
  },
  {
    id: 'spinout',
    title: 'The spin-out',
    weight: (game) => (game.player.level >= 2 && game.player.industry.citations > 30 && !game.flags.spinoutAsked ? 0.25 : 0),
    onDraw: (game) => {
      game.flags.spinoutAsked = true;
    },
    text: 'A venture fund wants to spin your lab\'s method out into a company, with you as scientific founder and a stake. Your university will take its cut.',
    choices: [
      { label: 'Found the company', tag: 'bold', apply: (game, data, random) => {
        if (random.chance(0.25)) {
          const payout = game.player.salary * 6;
          game.savings += payout * 0.75;
          game.lifetimeEarnings += payout;
          record(game, 'startupWin');
          return `It is acquired in three years. ${formatMoney(payout)} for your stake, and a lot of tenured jealousy.`;
        }
        game.player.motivation -= 3;
        scaleQuarter(game, 0.93);
        return 'The company dies slowly. You return to the lab, a little older.';
      } },
      { label: 'Stay an academic', tag: 'safe', apply: () => 'A student founds it instead.' },
    ],
  },
];

// Follow-ups scheduled by the cards above; not drawn on their own.
export const MORE_INDUSTRY_ARCS = [
  {
    id: 'coInvestResult',
    category: 'arc',
    title: 'The co-invest pays out',
    text: (game, data) => (data.multiple >= 1 ? 'The portfolio company is sold, and your cheque comes back with a very nice friend.' : 'The company missed its targets, and the sale returned less than you put in.'),
    choices: [
      { label: 'Take the cheque', tag: 'safe', apply: (game, data) => {
        const proceeds = 100000 * data.multiple;
        game.savings += proceeds;
        return `${formatMoney(proceeds)} on your ${formatMoney(100000)}.`;
      } },
    ],
  },
];
