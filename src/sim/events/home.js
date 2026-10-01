// Big purchases and the cards that speak to a particular reader: a car, a
// better place to live, and a set of work moments that land on the women of
// the cast (a leadership network, a mentor, a pay gap, nerves, flexible
// hours). What the player chooses is remembered (`flags.car`,
// `flags.apartment`) and shows up in the cut scenes as the car in the
// driveway and the building they live in.

import {
  peers, bumpRelationship, scaleQuarter, bonusQuarter, setPlan, spend, paymentPlan, employed, savvy, formatMoney, politicalOdds,
} from './helpers.js';

const female = (game) => game.character?.gender === 'female';
const ownsCar = (game) => (game.flags.car ?? 'old');

export const HOME_LIFE = [
  {
    id: 'carDecision',
    category: 'lifestyle',
    title: 'The car question',
    weight: (game) => (game.player.age >= 24 ? (ownsCar(game) === 'old' ? 0.5 : ownsCar(game) === 'none' ? 0.12 : 0.15) : 0),
    text: (game) => {
      const kind = ownsCar(game);
      if (kind === 'old') return 'The hatchback has 160,000 miles and a noise nobody can name. The mechanic says another $3,200 will keep it going. The dealership down the road is having a sale.';
      if (kind === 'none') return 'Carrying groceries on the bus in the rain, you start to wonder whether a car would be worth it after all.';
      return 'Your car is fine. But the new models are out, a colleague just pulled up in one, and the lease is up.';
    },
    choices: (game) => [
      { label: 'Buy a new sedan on a loan', tag: 'safe', apply: (innerGame) => {
        innerGame.flags.car = 'new';
        innerGame.player.motivation += 5;
        return `${formatMoney(2400)} down and ${paymentPlan(innerGame, 32000, 12)} a quarter for three years. It smells like a new car, and you do not mind a bit.`;
      } },
      { label: 'Get the family SUV', tag: 'kind', available: (innerGame) => innerGame.dependents > 0, apply: (innerGame) => {
        innerGame.flags.car = 'family';
        innerGame.player.motivation += 4;
        return `Room for everyone and the stroller: ${paymentPlan(innerGame, 45000, 12)} a quarter for three years.`;
      } },
      { label: 'Lease the sports car you always wanted', tag: 'bold', available: (innerGame) => innerGame.player.salary > 180000, apply: (innerGame) => {
        innerGame.flags.car = 'luxury';
        innerGame.player.motivation += 10;
        return `${paymentPlan(innerGame, 70000, 12)} a quarter. The first drive home is the best one in years.`;
      } },
      { label: 'Fix the old one, again', tag: 'rest', available: () => true, apply: (innerGame) => {
        innerGame.flags.car = ownsCar(innerGame) === 'none' ? 'none' : 'old';
        innerGame.player.motivation -= 2;
        return `${spend(innerGame, 3200)}, and a promise to yourself that this is the last time.`;
      } },
      { label: 'Go without a car', tag: 'rest', apply: (innerGame) => {
        innerGame.flags.car = 'none';
        innerGame.player.health += 2;
        innerGame.savings += 4000;
        return 'You sell it for $4,000 and walk more. The savings account likes it; the Monday rain does not.';
      } },
    ],
  },
  {
    id: 'betterApartment',
    category: 'lifestyle',
    title: 'A nicer place',
    weight: (game) => (game.homeEquity === 0 && game.player.age >= 23 ? 0.45 : 0),
    text: (game) => {
      const home = game.flags.apartment ?? 'basic';
      if (home === 'basic') return 'A listing catches your eye: a bright one-bedroom with a balcony and a dishwasher, ten minutes closer to the office. $600 a month more than you pay now.';
      if (home === 'nice') return 'The penthouse on the top floor is empty: floor-to-ceiling windows and a rooftop terrace. It would cost a great deal more.';
      return 'The rent on your place went up again, and a smaller, cheaper flat has appeared a few streets away.';
    },
    choices: (game) => [
      { label: 'Move to the nicer apartment', tag: 'ambitious', available: (innerGame) => (innerGame.flags.apartment ?? 'basic') === 'basic', apply: (innerGame) => {
        innerGame.flags.apartment = 'nice';
        innerGame.rentPremium = (innerGame.rentPremium ?? 0) + 7200;
        innerGame.player.motivation += 7;
        innerGame.player.health += 1;
        return `${spend(innerGame, 2500)} to move, and a balcony with morning light. Coming home feels different.`;
      } },
      { label: 'Take the penthouse', tag: 'bold', available: (innerGame) => (innerGame.flags.apartment ?? 'basic') !== 'luxury' && innerGame.player.salary > 220000, apply: (innerGame) => {
        innerGame.flags.apartment = 'luxury';
        innerGame.rentPremium = (innerGame.rentPremium ?? 0) + 20000;
        innerGame.player.motivation += 11;
        return `${spend(innerGame, 6000)} to move in, and a city spread out under your terrace. You tell nobody what the rent is.`;
      } },
      { label: 'Downsize to something cheaper', tag: 'safe', available: (innerGame) => (innerGame.rentPremium ?? 0) >= 4800, apply: (innerGame) => {
        innerGame.flags.apartment = 'basic';
        innerGame.rentPremium = Math.max(0, (innerGame.rentPremium ?? 0) - 7200);
        innerGame.player.motivation -= 3;
        return 'Smaller, quieter, and four thousand dollars a year lighter. The boxes are the worst part.';
      } },
      { label: 'Stay put and save the difference', tag: 'safe', apply: (innerGame) => {
        innerGame.player.motivation -= 1;
        innerGame.savings += 1500;
        return 'You close the listing. The old place has its charms, and the landlord has not raised the rent. Yet.';
      } },
    ],
  },
];

// Work cards that land on the women in the cast.
export const WOMENS_WORK = [
  {
    id: 'womenNetwork',
    category: 'interpersonal',
    title: 'The leadership dinner',
    weight: (game) => (female(game) && game.player.level >= 1 ? 0.6 : 0),
    text: 'A network for women leaders in the industry is holding its annual dinner. Directors, VPs and a founder or two will be there, and a table has your name on it.',
    choices: [
      { label: 'Go, and work the room', tag: 'ambitious', apply: (game, data, random) => {
        const contact = random.pick(peers(game));
        bumpRelationship(contact, 14, game);
        game.player.readiness += 8;
        game.player.motivation += 6;
        game.player.health -= 1;
        game.player.informants += 1;
        return 'You leave with six cards, one real invitation to coffee and the feeling that you are not the only one climbing this.';
      } },
      { label: 'Offer to speak on the panel', tag: 'bold', apply: (game, data, random) => {
        if (random.chance(savvy(game, 0.6))) {
          game.player.readiness += 14;
          game.player.motivation += 10;
          bonusQuarter(game, 4);
          return 'The panel goes well, and a VP says your name on the way out. People ask to be introduced to you.';
        }
        game.player.motivation -= 3;
        return 'Your mind goes blank for four seconds in front of two hundred people. Someone kindly takes the question.';
      } },
      { label: 'Skip it: you have a deadline', tag: 'safe', apply: (game) => {
        scaleQuarter(game, 1.02);
        game.player.motivation -= 1;
        return 'The deadline is met. You hear the dinner was great.';
      } },
    ],
  },
  {
    id: 'mentorWoman',
    category: 'interpersonal',
    title: 'Someone who has done it',
    weight: (game) => (female(game) && game.player.level >= 1 && !game.flags.womanMentor ? 0.5 : 0),
    text: 'A director two levels up, one of very few in the company, stops you after a meeting: "I would like to mentor you, if you want it. I wish someone had offered me."',
    choices: [
      { label: 'Accept, and make the most of it', tag: 'kind', apply: (game) => {
        game.flags.womanMentor = true;
        game.player.readiness += 10;
        game.player.alignment += 0.05;
        game.player.motivation += 8;
        return 'Monthly breakfasts, blunt advice, and an introduction to the right people. You stop feeling like you are guessing.';
      } },
      { label: 'Thank her, but you would rather figure it out', tag: 'safe', apply: (game) => {
        game.flags.womanMentor = true;
        game.player.motivation -= 1;
        return 'She nods, unoffended. "The offer stands."';
      } },
    ],
  },
  {
    id: 'payGap',
    category: 'interpersonal',
    title: 'The pay audit',
    weight: (game) => (female(game) && game.player.quartersAtLevel > 6 ? 0.45 : 0),
    text: 'A pay audit leaks. At your level and with your scope, you are paid about 8% less than the median, and a colleague who joined a year after you is paid more.',
    choices: [
      { label: 'Ask for a correction, with the numbers', tag: 'bold', apply: (game, data, random) => {
        if (random.chance(politicalOdds(game, 0.35, 120))) {
          game.player.salary *= 1.08;
          game.player.motivation += 6;
          return 'HR runs the analysis, agrees, and adjusts you by 8%. You wish you had asked a year ago.';
        }
        game.player.alignment -= 0.04;
        game.player.motivation -= 3;
        return 'You are told the audit "is not a basis for individual adjustments". It goes in a file somewhere.';
      } },
      { label: 'Bring it up at the annual review', tag: 'safe', apply: (game) => {
        game.player.motivation -= 2;
        return 'Your manager promises to look at it. You note the date.';
      } },
      { label: 'Start quietly looking elsewhere', tag: 'ambitious', apply: (game) => {
        game.player.plan.openness = Math.min(1, game.player.plan.openness + 0.3);
        game.flags.searchBoost = (game.flags.searchBoost ?? 0) + 0.1;
        game.player.motivation += 2;
        return 'Three recruiters reply within a day. It helps, knowing what you are worth.';
      } },
    ],
  },
  {
    id: 'nerves',
    category: 'interpersonal',
    title: 'The voice in your head',
    weight: (game) => (female(game) && employed(game) ? 0.5 : 0),
    text: 'You are to present to the senior leadership on Thursday. The voice that says "they will find out you are not as good as they think" has been loud all week.',
    choices: [
      { label: 'Book time with a coach', tag: 'safe', apply: (game) => {
        game.player.motivation += 7;
        game.player.skill += 1;
        return `${spend(game, 800)}, two sessions, and a way of breathing that actually works. You walk in steady.`;
      } },
      { label: 'Call the friend who always knows what to say', tag: 'kind', apply: (game) => {
        game.player.motivation += 5;
        return 'Twenty minutes on the phone and you remember who you are.';
      } },
      { label: 'Push through on caffeine', tag: 'ambitious', apply: (game, data, random) => {
        if (random.chance(0.6)) {
          game.player.readiness += 8;
          game.player.motivation += 5;
          return 'It goes well, and the voice, as always, is wrong.';
        }
        game.player.motivation -= 6;
        game.player.health -= 2;
        return 'You stumble through it. Nobody notices but you, and you cannot stop replaying it.';
      } },
    ],
  },
  {
    id: 'flexHours',
    category: 'interpersonal',
    title: 'A different schedule',
    weight: (game) => (female(game) && employed(game) && game.player.plan.hours > 9.5 ? 0.4 : 0),
    text: 'You have been working ten-hour days for a year. A colleague has just won a four-day compressed week, and you are wondering whether the same would be possible for you.',
    choices: [
      { label: 'Ask your manager, with a plan', tag: 'bold', apply: (game, data, random) => {
        if (random.chance(savvy(game, 0.55))) {
          setPlan(game, { hours: Math.min(game.player.plan.hours, 9) });
          game.player.motivation += 8;
          game.player.health += 2;
          return 'A four-day week, delivered in nine-hour days with Fridays free. It works so well that two others copy you.';
        }
        game.player.alignment -= 0.03;
        return '"We are not set up for it right now." You are not sure you believe that.';
      } },
      { label: 'Keep your hours; keep the peace', tag: 'safe', apply: (game) => {
        game.player.motivation -= 2;
        return 'You decide it is not the time. The thought does not go away.';
      } },
    ],
  },
];
