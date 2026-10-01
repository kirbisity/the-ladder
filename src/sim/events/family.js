// The life outside the office: friends, romance, marriage and children.
// The circle of friends feeds mood (see SOCIAL); meeting someone depends on
// how big it is; a partner is simulated (see family.js); a marriage holds or
// breaks on how much of the player's day is left for home. What the player
// chooses is remembered on the game (`partner`, `family`, `children`).

import { SOCIAL, FAMILY } from '../../config.js';
import {
  scaleQuarter, setPlan, spend, schedule, formatMoney, record, clamp,
} from './helpers.js';
import { parentalLeaveStatus, startParentalLeave } from '../game.js';
import {
  bumpSocial, isExtrovert, makeCandidate, startDating, marry, addChild, kidsAtHome, kidsUnder, quartersTogether, isDating,
} from '../family.js';

const firstName = (person) => person.name.split(' ')[0];
const single = (game) => !game.partner && !game.married;
const married = (game) => Boolean(game.married && game.partner && game.family);
const nudgeQuality = (game, amount) => {
  if (game.family) game.family.quality = clamp(game.family.quality + amount, 0, 100);
};
const nudgeBond = (game, amount) => {
  if (game.partner) game.partner.bond = clamp(game.partner.bond + amount, 0, 100);
};
const pronouns = (person) => (person.gender === 'female' ? { subject: 'she', possessive: 'her' } : { subject: 'he', possessive: 'his' });

// Where the player might meet someone: the places a circle of friends leads.
const MEETING_PLACES = [
  'A friend of a friend throws a dinner party, and you end up on the balcony talking',
  'At a colleague\'s birthday drinks, someone you have never met laughs at your joke',
  'A wedding of people you barely know seats you next to someone interesting',
  'The climbing gym has a new regular who keeps asking you to hold the rope',
  'A neighbour\'s book club needs one more person, and you are it',
  'Waiting for the same delayed train, you start talking, and miss two more',
];

export const SOCIAL_LIFE = [
  {
    id: 'oldFriends',
    category: 'lifestyle',
    title: 'The old group',
    weight: (game) => (game.player.age < 60 ? 0.5 : 0),
    text: 'Three people you went to university with are meeting in a cabin for the weekend. They have saved you a bed and a spot at the grill.',
    choices: [
      { label: 'Fly out and stay the weekend', tag: 'kind', apply: (game) => {
        bumpSocial(game, 10);
        game.player.motivation += 4;
        return `${spend(game, 900)} in flights, and the first real laugh in months.`;
      } },
      { label: 'Join for dinner, drive home', tag: 'safe', apply: (game) => {
        bumpSocial(game, 5);
        return 'Four hours of old stories, then the long way home.';
      } },
      { label: 'Send a rain check', tag: 'ambitious', apply: (game) => {
        bumpSocial(game, -2);
        return 'They say it is fine. It is a little bit not fine.';
      } },
    ],
  },
  {
    id: 'clubInvite',
    category: 'lifestyle',
    title: 'A standing Thursday',
    weight: (game) => (game.player.age < 58 ? 0.45 : 0),
    text: 'A neighbour runs a Thursday evening group: climbing, board games, whatever people bring. "You would like it," they say, for the third time.',
    choices: [
      { label: 'Go, and keep going', tag: 'kind', apply: (game) => {
        bumpSocial(game, 8);
        game.player.health += 2;
        return 'By the fourth week you know everyone\'s drink.';
      } },
      { label: 'Go once, see how it feels', tag: 'safe', apply: (game) => {
        bumpSocial(game, 3);
        return 'Pleasant enough. You are not sure you will be back.';
      } },
      { label: 'Thursday is for the backlog', tag: 'ambitious', apply: (game) => {
        game.player.alignment += 0.01;
        return 'The backlog does not thank you.';
      } },
    ],
  },
  {
    id: 'friendDrifted',
    category: 'lifestyle',
    title: 'Drifting',
    weight: (game) => (game.social > 25 ? 0.4 : 0),
    text: 'Your closest friend from the old city has sent three messages you have not answered. The fourth is just a question mark.',
    choices: [
      { label: 'Call them tonight', tag: 'kind', apply: (game) => {
        bumpSocial(game, 4);
        return 'Two hours on the phone. You apologise, they pretend you do not need to.';
      } },
      { label: 'Reply, "let\'s catch up soon"', tag: 'safe', apply: (game) => {
        bumpSocial(game, -1);
        return 'Soon turns out to be a long word.';
      } },
      { label: 'Let it fade', tag: 'ambitious', apply: (game) => {
        bumpSocial(game, -6);
        return 'Some friendships end without anyone deciding.';
      } },
    ],
  },
  {
    id: 'newNeighbours',
    category: 'lifestyle',
    title: 'New neighbours',
    weight: () => 0.4,
    text: 'The flat across the hall has new people, and they have knocked to ask whether you want to come to their housewarming on Saturday.',
    choices: [
      { label: 'Go, with a bottle', tag: 'kind', apply: (game) => {
        bumpSocial(game, 6);
        return 'A stranger from the fourth floor now knows your plant-watering schedule.';
      } },
      { label: 'Say hello at the door, nothing more', tag: 'safe', apply: (game) => {
        bumpSocial(game, 1);
        return 'Friendly, in a closed-door kind of way.';
      } },
    ],
  },
  {
    id: 'friendInNeed',
    category: 'lifestyle',
    title: 'A friend in trouble',
    weight: (game) => (game.social > 30 ? 0.3 : 0),
    text: 'A friend\'s relationship has just ended. They are on your doorstep with a bag, and a face you do not need to ask about.',
    choices: [
      { label: 'Clear the weekend', tag: 'kind', apply: (game) => {
        bumpSocial(game, 7);
        game.player.motivation += 3;
        game.player.health -= 1;
        return 'You are not sure who helped whom more.';
      } },
      { label: 'Give them the spare key and your evening', tag: 'safe', apply: (game) => {
        bumpSocial(game, 3);
        return 'You hold the line on Saturday, which is hard.';
      } },
      { label: 'Gently suggest a professional', tag: 'ambitious', apply: (game) => {
        bumpSocial(game, -3);
        return 'They nod. They go quiet.';
      } },
    ],
  },
];

export const ROMANCE = [
  {
    id: 'meetSomeone',
    category: 'lifestyle',
    title: 'Someone new',
    cooldown: 6,
    // The circle is where people come from: a bigger one meets someone sooner.
    weight: (game) => (single(game) && game.player.age >= 22 && game.player.age <= 48
      ? (SOCIAL.meetBase + SOCIAL.meetPerPoint * (game.social ?? 0)) * ((game.flags.divorceShadow ?? 0) > 0.5 ? 0.3 : 1) : 0),
    onDraw: (game, random) => ({ candidate: makeCandidate(game, random), place: random.pick(MEETING_PLACES) }),
    text: (game, data) => {
      const person = data.candidate;
      const they = pronouns(person);
      const keen = (game.social ?? 0) >= 60 ? 'Having a wide circle helps: you were introduced, not left to guess.' : '';
      return `${data.place}. ${person.name}, ${person.age}, a ${person.career.toLowerCase()}. ${they.subject[0].toUpperCase()}${they.subject.slice(1)} asks what you do, listens to the whole answer, and writes ${they.possessive} number on a napkin. ${keen}`.trim();
    },
    choices: (game, data) => [
      { label: `Ask ${firstName(data.candidate)} out`, tag: 'kind', apply: (innerGame, innerData, random) => {
        const chance = clamp(SOCIAL.askBase + SOCIAL.askPerPoint * innerGame.social + (isExtrovert(innerGame.player) ? SOCIAL.askExtrovertBonus : 0), 0.15, 0.9);
        if (random.chance(chance)) {
          startDating(innerGame, innerData.candidate);
          innerGame.player.motivation += 6;
          return `${firstName(innerData.candidate)} says yes. A first dinner is booked for Friday. (${Math.round(chance * 100)}% chance, set by your circle and your nerve.)`;
        }
        innerGame.player.motivation -= 3;
        return `${firstName(innerData.candidate)} is kind about it, and says no. (${Math.round(chance * 100)}% chance.)`;
      } },
      { label: 'Keep it friendly', tag: 'safe', apply: (innerGame) => {
        bumpSocial(innerGame, 3);
        return 'You swap numbers as friends. The napkin goes in a drawer.';
      } },
      { label: 'Not now: the career comes first', tag: 'ambitious', apply: () => 'You smile, thank them for the number, and leave it in the taxi.' },
    ],
  },
  {
    id: 'meetParents',
    category: 'lifestyle',
    title: 'Dinner with the parents',
    cooldown: 8,
    weight: (game) => (isDating(game) && quartersTogether(game) >= 2 ? 0.7 : 0),
    text: (game) => `${firstName(game.partner)}'s parents are in town for one night, and the reservation is for four. It is also the night of your team\'s big push.`,
    choices: [
      { label: 'Be there, jacket and all', tag: 'kind', apply: (game) => {
        nudgeBond(game, 9);
        game.player.motivation += 3;
        return `${spend(game, 250)} on a dinner you do not remember, and a handshake you do.`;
      } },
      { label: 'Join for dessert, after the push', tag: 'safe', apply: (game) => {
        nudgeBond(game, 2);
        return 'Dessert is polite. Everyone is.';
      } },
      { label: 'Send flowers and your apologies', tag: 'ambitious', apply: (game) => {
        nudgeBond(game, -10);
        return `${firstName(game.partner)} says it is fine in a way that is not.`;
      } },
    ],
  },
  {
    id: 'proposal',
    category: 'lifestyle',
    title: 'The question',
    cooldown: 6,
    weight: (game) => (isDating(game) && quartersTogether(game) >= FAMILY.proposalAfterQuarters && game.partner.bond >= FAMILY.proposalBond
      ? 0.5 + (game.partner.bond - FAMILY.proposalBond) / 45 : 0),
    text: (game) => {
      const years = Math.max(1, Math.round(quartersTogether(game) / 4));
      return `You and ${firstName(game.partner)} have been together ${years === 1 ? 'a year' : `${years} years`}. Over dinner, there is the kind of quiet that comes before a question. Do you ask it?`;
    },
    choices: [
      { label: 'Propose, and plan a big wedding', tag: 'kind', apply: (game, data, random) => proposeOutcome(game, random, 35000, 12, 'A wonderful day.') },
      { label: 'Propose, and head to the courthouse', tag: 'safe', apply: (game, data, random) => proposeOutcome(game, random, 3000, 10, 'Just the two of you, and lunch after.') },
      { label: 'Not yet: work comes first', tag: 'ambitious', apply: (game) => {
        game.partner.waited += 1;
        nudgeBond(game, -6);
        game.player.motivation -= 2;
        return `${firstName(game.partner)} nods slowly. "Okay," they say, and it is not.`;
      } },
    ],
  },
  {
    id: 'anniversary',
    category: 'lifestyle',
    title: 'The anniversary',
    cooldown: 8,
    weight: (game) => (married(game) ? 0.5 : 0),
    text: (game) => `Your anniversary falls on a Thursday, in the middle of the quarter. ${firstName(game.partner)} has not mentioned it, which is how you know it matters.`,
    choices: [
      { label: 'A weekend away', tag: 'kind', apply: (game) => {
        nudgeQuality(game, 10);
        game.player.motivation += 4;
        return `${spend(game, 1800)} on a cabin, a fire, and no phones. It lands.`;
      } },
      { label: 'A nice dinner', tag: 'safe', apply: (game) => {
        nudgeQuality(game, 5);
        return `${spend(game, 300)} and a toast.`;
      } },
      { label: 'Realise it at 9 PM', tag: 'ambitious', apply: (game) => {
        nudgeQuality(game, -10);
        return `${firstName(game.partner)} is in bed already. The flowers are not enough.`;
      } },
    ],
  },
  {
    id: 'partnerSetback',
    category: 'lifestyle',
    title: 'A hard season for them',
    cooldown: 10,
    weight: (game) => (married(game) ? 0.4 : 0),
    onDraw: (game, random) => ({ kind: random.chance(0.5) ? 'laidOff' : 'ill' }),
    text: (game, data) => (data.kind === 'laidOff'
      ? `${firstName(game.partner)} comes home early, sits at the kitchen table, and says they have been let go.`
      : `${firstName(game.partner)} has been tired for weeks. The doctor says it is serious, and treatable, and will take months.`),
    choices: (game, data) => (data.kind === 'laidOff' ? [
      { label: 'Carry the household while they search', tag: 'kind', apply: (innerGame) => {
        innerGame.partner.laidOffQuarters = 3;
        nudgeQuality(innerGame, 4);
        return 'It is a leaner few quarters, and a closer one.';
      } },
      { label: 'Push them to take the first thing', tag: 'ambitious', apply: (innerGame) => {
        innerGame.partner.laidOffQuarters = 1;
        nudgeQuality(innerGame, -6);
        return 'They take a worse job, quickly. The silence at dinner is its own cost.';
      } },
    ] : [
      { label: 'Go to every appointment', tag: 'kind', apply: (innerGame) => {
        innerGame.partner.health = Math.max(35, innerGame.partner.health - 15);
        nudgeQuality(innerGame, 5);
        scaleQuarter(innerGame, 0.9);
        return 'You are tired in a way you did not expect, and you would do it again.';
      } },
      { label: 'Hire help, and keep your hours', tag: 'safe', apply: (innerGame) => {
        innerGame.partner.health = Math.max(35, innerGame.partner.health - 15);
        nudgeQuality(innerGame, -2);
        return `${spend(innerGame, 3500)} for the best nurse in the city. ${firstName(innerGame.partner)} would have preferred you.`;
      } },
    ]),
  },
  {
    id: 'partnerPromoted',
    category: 'lifestyle',
    title: 'Their good news',
    cooldown: 10,
    weight: (game) => (married(game) && game.partner.laidOffQuarters === 0 && game.partner.age < 55 ? 0.35 : 0),
    text: (game) => `${firstName(game.partner)} has been promoted: a bigger title, a bigger salary, and a bottle of something already open on the counter.`,
    choices: [
      { label: 'Celebrate loudly', tag: 'kind', apply: (game) => {
        game.partner.income = Math.round(game.partner.income * 1.15 / 1000) * 1000;
        nudgeQuality(game, 5);
        game.player.motivation += 3;
        return `${spend(game, 300)} on dinner, and a raise to ${formatMoney(game.partner.income)} a year in the house.`;
      } },
    ],
  },
];

/** A proposal: the partner says yes in proportion to how close they are. */
function proposeOutcome(game, random, cost, lift, happy) {
  const partner = game.partner;
  const chance = clamp(partner.bond / 100 + 0.2, 0.3, 0.95);
  if (!random.chance(chance)) {
    nudgeBond(game, -10);
    game.player.motivation -= 6;
    return `${firstName(partner)} asks for time. It is not a no, and not a yes. (${Math.round(chance * 100)}% chance, set by how close you are.)`;
  }
  marry(game);
  game.player.motivation += lift;
  return `${firstName(partner)} says yes. ${happy} ${spend(game, cost)} well spent, mostly.`;
}

export const CHILDREN = [
  {
    id: 'considerKids',
    category: 'lifestyle',
    title: 'The big question',
    cooldown: 8,
    weight: (game) => (married(game) && !game.flags.childFree && game.partner.age <= 43 && game.player.age <= 48
      && kidsAtHome(game).length < 3 && game.family.quality >= 45 && !(game.flags.scheduled ?? []).some((entry) => entry.id === 'baby') ? 0.6 : 0),
    text: (game) => {
      const count = kidsAtHome(game).length;
      return `${firstName(game.partner)} brings it up on a walk. ${count === 0 ? 'Whether you want children.' : `Whether you want another child, a ${count === 1 ? 'sibling' : 'little one'} for the ${count === 1 ? 'one you have' : 'ones you have'}.`} `
        + 'A child costs a great deal, in money and in evenings, and repays it in a way spreadsheets do not capture.';
    },
    choices: [
      { label: 'Yes: start trying', tag: 'kind', apply: (game, data, random) => {
        schedule(game, 'baby', random.int(1, 3), { girl: random.chance(0.5) });
        nudgeQuality(game, 4);
        game.player.motivation += 4;
        return 'You hold hands the whole walk home.';
      } },
      { label: 'Not yet: ask again in a while', tag: 'safe', apply: (game) => {
        nudgeQuality(game, -1);
        return 'Soon, you both agree, in different tones.';
      } },
      { label: 'No: we have decided, for good', tag: 'ambitious', apply: (game) => {
        game.flags.childFree = true;
        nudgeQuality(game, game.partner.warmth > 0.6 ? 0 : -6);
        return 'It is settled, and the house stays quiet.';
      } },
    ],
  },
  {
    id: 'baby',
    category: 'arc',
    title: 'The baby arrives',
    eligible: (game) => married(game),
    text: (game, data) => `A ${data.girl ? 'daughter' : 'son'}. Seven pounds, two ounces, and a firm opinion about the hour. ${game.character?.gender === 'female' ? 'You have been given twelve weeks, if you want them.' : `${firstName(game.partner)} has twelve weeks off; your employer offers six.`}`,
    choices: (game) => {
      const leave = parentalLeaveStatus(game);
      const word = game.character?.gender === 'female' ? 'maternity' : 'paternity';
      return [
        { label: `Take ${word} leave`, tag: 'rest', available: () => leave.eligible, apply: (innerGame) => {
          addChild(innerGame);
          startParentalLeave(innerGame);
          if (innerGame.character?.gender !== 'female') innerGame.partner.leaveQuarters = FAMILY.partnerLeaveQuarters;
          nudgeQuality(innerGame, 8);
          innerGame.player.motivation += 12;
          return 'Three blurry months you will never forget. The laptop stays in the bag.';
        } },
        { label: `${firstName(game.partner)} takes the leave; you keep going`, tag: 'safe', apply: (innerGame) => {
          addChild(innerGame);
          innerGame.partner.leaveQuarters = FAMILY.partnerLeaveQuarters;
          nudgeQuality(innerGame, 2);
          innerGame.player.motivation += 8;
          return 'You learn to answer email one-handed at 3 AM. Their income halves for two quarters.';
        } },
        { label: 'Back at your desk in two weeks', tag: 'ambitious', apply: (innerGame) => {
          addChild(innerGame);
          innerGame.player.health -= 6;
          innerGame.player.motivation += 4;
          nudgeQuality(innerGame, -6);
          return 'The baby grows a week for every one you miss.';
        } },
      ];
    },
  },
  {
    id: 'sickChild',
    category: 'lifestyle',
    title: 'A small fever',
    cooldown: 4,
    weight: (game) => (kidsUnder(game, 6).length > 0 ? 0.6 : 0),
    text: 'The nursery calls at 10 AM: a temperature of 39, and could someone come now. You have a review in an hour.',
    choices: [
      { label: 'Go. Everything else can wait', tag: 'kind', apply: (game) => {
        scaleQuarter(game, 0.92);
        nudgeQuality(game, 4);
        game.player.motivation += 2;
        return 'A day of cuddles and cartoons, and a very understanding manager.';
      } },
      { label: 'Call the nanny', tag: 'safe', apply: (game) => {
        nudgeQuality(game, -1);
        return `${spend(game, 180)}, and a guilty glance at your phone all afternoon.`;
      } },
      { label: 'Send your partner, take the review', tag: 'ambitious', apply: (game) => {
        nudgeQuality(game, -4);
        scaleQuarter(game, 1.01);
        return `${firstName(game.partner ?? { name: 'Your partner' })} goes. The review goes well; the evening does not.`;
      } },
    ],
  },
  {
    id: 'schoolPlay',
    category: 'lifestyle',
    title: 'The school play',
    cooldown: 6,
    weight: (game) => (kidsAtHome(game).some((child) => (game.quarterIndex - child.born) / 4 >= 5 && (game.quarterIndex - child.born) / 4 < 13) ? 0.5 : 0),
    text: 'Your child is a tree in the school play and has told you, repeatedly, that the tree is the main part. It is at 2 PM on a Wednesday.',
    choices: [
      { label: 'Leave early. Front row.', tag: 'kind', apply: (game) => {
        game.player.motivation += 5;
        nudgeQuality(game, 4);
        scaleQuarter(game, 0.97);
        return 'The tree is magnificent. You are in tears by the second line.';
      } },
      { label: 'Watch the video later', tag: 'ambitious', apply: (game) => {
        nudgeQuality(game, -5);
        return 'The video is shaky, and you were not there.';
      } },
    ],
  },
];

export const FAMILY_ARCS = [
  {
    id: 'coupleTalk',
    category: 'arc',
    title: 'We need to talk',
    eligible: (game) => married(game),
    text: (game) => `${firstName(game.partner)} sits you down at the kitchen table. "I feel like I live with a roommate who is also my coworker," they say. `
      + `They can manage about ${game.partner.workTolerance} hours of you working. You have been well past it.`,
    choices: (game) => [
      { label: `Promise to be home on time, and mean it`, tag: 'kind', apply: (innerGame) => {
        innerGame.family.boost = 10;
        innerGame.family.boostQuarters = 3;
        nudgeQuality(innerGame, 4);
        setPlan(innerGame, { hours: Math.min(innerGame.player.plan.hours, innerGame.partner.workTolerance) });
        return `You cut your days to ${Math.min(innerGame.player.plan.hours, innerGame.partner.workTolerance)} hours. Keeping it up is the hard part.`;
      } },
      { label: 'Book couples counselling', tag: 'safe', available: () => true, apply: (innerGame) => {
        nudgeQuality(innerGame, FAMILY.counsellingLift);
        return `${spend(innerGame, FAMILY.counsellingCost)} and an hour a week of being heard. It helps more than you wanted it to.`;
      } },
      { label: 'Brush it off: this is a busy season', tag: 'ambitious', apply: (innerGame) => {
        nudgeQuality(innerGame, -6);
        return 'They nod. They do not bring it up again, which is the worst sign.';
      } },
    ],
  },
];

export const FAMILY_LIFE = [...SOCIAL_LIFE, ...ROMANCE, ...CHILDREN, ...FAMILY_ARCS];

export { record };
