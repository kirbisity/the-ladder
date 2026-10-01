// More of the ordinary texture of a working life, added to widen the deck:
// losses and family, the body keeping score, and office moments that are not
// tied to one industry. Cards that depend on age say so in their weights, so
// a 25-year-old and a 55-year-old do not face the same deck.

import {
  peers, bumpRelationship, scaleQuarter, bonusQuarter, setPlan, spend, schedule, employed, insured, savvy,
  politicalOdds, formatMoney, record, boostSearch,
} from './helpers.js';

const older = (game, from) => game.player.age >= from;

// Life: the cards that land on a random day, working or not.
export const MORE_LIFE = [
  {
    id: 'friendDies',
    category: 'lifestyle',
    title: 'A friend is gone',
    weight: (game) => (older(game, 26) && !game.flags.friendDied ? 0.4 : 0),
    text: 'A friend from college died on Sunday: a cyclist and a driver looking at a phone. The funeral is Friday, four hundred miles away.',
    choices: [
      { label: 'Go, and stay the weekend', tag: 'kind', apply: (game) => {
        game.flags.friendDied = true;
        scaleQuarter(game, 0.95);
        game.player.motivation -= 8;
        return `${spend(game, 1400)} in flights and a hotel. You sit with people you have not seen in years, and it helps a little.`;
      } },
      { label: 'Send flowers and stay at work', tag: 'ambitious', apply: (game) => {
        game.flags.friendDied = true;
        game.player.motivation -= 12;
        return 'You work through the afternoon of the funeral. It catches up with you in the evening.';
      } },
    ],
  },
  {
    id: 'grandparentDies',
    category: 'lifestyle',
    title: 'Your grandmother',
    weight: (game) => (older(game, 28) && game.player.age < 52 && !game.flags.grandparentDied ? 0.35 : 0),
    text: 'Your grandmother died in her sleep at ninety-one. The family wants to gather. Your cousins are already booking flights.',
    choices: [
      { label: 'Fly out and help with the service', tag: 'kind', apply: (game) => {
        game.flags.grandparentDied = true;
        game.player.motivation -= 4;
        if (employed(game)) scaleQuarter(game, 0.97);
        return `${spend(game, 900)}, three days, and the stories told over her cooking.`;
      } },
      { label: 'Watch the service on a video call', tag: 'safe', apply: (game) => {
        game.flags.grandparentDied = true;
        game.player.motivation -= 7;
        return 'It is not the same from a laptop in a meeting room.';
      } },
    ],
  },
  {
    id: 'parentDies',
    category: 'lifestyle',
    title: 'The call you were dreading',
    weight: (game) => (older(game, 44) && !game.flags.parentDied ? 0.5 : 0),
    text: 'Your mother has died, after a short illness. There is a house to empty, a will, and a brother who cannot cope with any of it.',
    choices: [
      { label: 'Take bereavement leave and settle everything', tag: 'rest', apply: (game) => {
        game.flags.parentDied = true;
        game.player.motivation -= 10;
        game.player.health -= 2;
        if (employed(game)) scaleQuarter(game, 0.8);
        game.savings += 30000;
        record(game, 'bereaved');
        return `Two weeks away. The house sells; ${formatMoney(30000)} comes to you after the lawyers.`;
      } },
      { label: 'Do it all from your phone', tag: 'ambitious', apply: (game) => {
        game.flags.parentDied = true;
        game.player.motivation -= 16;
        game.player.health -= 4;
        game.savings += 30000;
        record(game, 'bereaved');
        return 'You answer emails in the funeral home parking lot. Grief arrives late, and all at once.';
      } },
    ],
  },
  {
    id: 'highwayCrash',
    category: 'lifestyle',
    title: 'The crash',
    weight: (game) => 0.25 + (game.player.plan.hours > 11 ? 0.15 : 0) + (game.player.health < 50 ? 0.1 : 0),
    text: (game) => `A truck runs a red light at 60 mph and hits your driver's door. You wake up in the ER with a broken collarbone and three cracked ribs. ${insured(game) ? 'Your plan covers most of it.' : 'You have no insurance.'}`,
    choices: [
      { label: 'Rest and do the physical therapy', tag: 'rest', apply: (game) => {
        game.player.health -= 9;
        game.player.motivation -= 5;
        if (employed(game)) scaleQuarter(game, 0.8);
        schedule(game, 'crashAftermath', 2);
        return `${spend(game, insured(game) ? 6800 : 61000)} in bills. Eight weeks of PT, and it heals properly.`;
      } },
      { label: 'Back at your desk in three days', tag: 'ambitious', apply: (game) => {
        game.player.health -= 14;
        game.player.motivation -= 8;
        schedule(game, 'crashAftermath', 2);
        return `${spend(game, insured(game) ? 6800 : 61000)} in bills, and a shoulder that never quite sits right again.`;
      } },
    ],
  },
  {
    id: 'crashAftermath',
    category: 'arc',
    title: 'After the crash',
    text: 'The other driver\'s insurer finally calls with an offer. The adjuster is polite and fast, and wants a signature today.',
    choices: [
      { label: 'Take it', tag: 'safe', apply: (game) => {
        game.savings += 9000;
        return `${formatMoney(9000)}, and it is over.`;
      } },
      { label: 'Hire a lawyer', tag: 'bold', apply: (game, data, random) => {
        if (random.chance(0.65)) {
          game.savings += 31000;
          return `Four months later: ${formatMoney(31000)} after the lawyer's cut. It was worth it.`;
        }
        game.player.motivation -= 3;
        game.savings += 6000;
        return 'The case drags on, and the settlement is smaller than the first offer.';
      } },
    ],
  },
  {
    id: 'burglary',
    category: 'lifestyle',
    title: 'The break-in',
    weight: () => 0.3,
    text: 'You come home to a kicked-in back door, a missing laptop and a drawer of jewellery turned over. The police officer takes notes and says not to expect much.',
    choices: [
      { label: 'Claim it on renters insurance', tag: 'safe', apply: (game) => {
        game.player.motivation -= 4;
        return `${spend(game, 500)} deductible; the claim pays most of the rest in six weeks. You do not sleep well for a month.`;
      } },
      { label: 'Skip the claim and fit better locks', tag: 'bold', apply: (game) => {
        game.player.motivation -= 5;
        return `${spend(game, 3200)} of losses, and a deadbolt you check three times a night.`;
      } },
    ],
  },
  {
    id: 'petDies',
    category: 'lifestyle',
    title: 'The quiet apartment',
    weight: (game) => (older(game, 25) && !game.flags.petLost ? 0.25 : 0),
    text: 'The dog you have had since your first job died this morning. He was fourteen.',
    choices: [
      { label: 'Take the afternoon', tag: 'rest', apply: (game) => {
        game.flags.petLost = true;
        game.player.motivation -= 5;
        return 'You bury him in the park, the way he would have wanted: somewhere with squirrels.';
      } },
      { label: 'Push through the day', tag: 'safe', apply: (game) => {
        game.flags.petLost = true;
        game.player.motivation -= 9;
        return 'You do not mention it to anyone at work. The leash is still by the door.';
      } },
    ],
  },
  {
    id: 'wildfire',
    category: 'lifestyle',
    title: 'The evacuation order',
    weight: () => 0.15,
    text: 'A wildfire jumped the ridge overnight. You have an hour to pack the car.',
    choices: [
      { label: 'Evacuate and wait it out', tag: 'safe', apply: (game) => {
        game.player.motivation -= 6;
        game.player.health -= 2;
        if (employed(game)) scaleQuarter(game, 0.9);
        return `${spend(game, 2600)} in motels, a week of smoke and refresh-clicking the fire map. The house stands.`;
      } },
      { label: 'Stay and watch the hose', tag: 'bold', apply: (game, data, random) => {
        if (random.chance(0.8)) {
          game.player.health -= 4;
          return 'The wind turns. You are exhausted and covered in ash, and the house is fine.';
        }
        game.player.health -= 12;
        game.player.motivation -= 12;
        return `The shed goes, and your lungs hurt for a month. ${spend(game, 12000)} to rebuild.`;
      } },
    ],
  },
  {
    id: 'reunion',
    category: 'lifestyle',
    title: 'The reunion',
    weight: (game) => (older(game, 31) && !game.flags.reunionDone ? 0.35 : 0),
    text: 'Your ten-year college reunion. Everyone has a title, a house, and a better story than yours.',
    choices: [
      { label: 'Go and compare', tag: 'ambitious', apply: (game) => {
        game.flags.reunionDone = true;
        if (game.player.level >= 3) {
          game.player.motivation += 8;
          return 'You are further along than most of them. It feels better than it should.';
        }
        game.player.motivation -= 7;
        return 'A roommate sold a company. Another is a partner at a firm. You drive home quiet.';
      } },
      { label: 'Skip it', tag: 'safe', apply: (game) => {
        game.flags.reunionDone = true;
        return 'You send regrets and see the photos online anyway.';
      } },
    ],
  },
  {
    id: 'midlifeQuestion',
    category: 'lifestyle',
    title: 'The 3 AM question',
    weight: (game) => (older(game, 40) && !game.flags.midlifeAsked ? 0.5 + (game.player.quartersAtLevel > 16 ? 0.4 : 0) : 0),
    text: 'You wake at three with the question that has been waiting for years: is this what you wanted to be doing at this age?',
    choices: [
      { label: 'Recommit: set a new goal', tag: 'ambitious', apply: (game) => {
        game.flags.midlifeAsked = true;
        game.player.motivation += 8;
        game.player.readiness += 10;
        return 'You write it on a card and put it on the monitor. It helps, for a while.';
      } },
      { label: 'Make peace with it', tag: 'rest', apply: (game) => {
        game.flags.midlifeAsked = true;
        game.player.motivation += 3;
        setPlan(game, { hours: Math.min(game.player.plan.hours, 9) });
        return 'You decide the work is a part of the life, not the point of it. You start leaving at six.';
      } },
      { label: 'Look for the exit', tag: 'bold', apply: (game) => {
        game.flags.midlifeAsked = true;
        boostSearch(game, 0.1);
        game.player.plan.openness = Math.min(1, game.player.plan.openness + 0.3);
        return 'You update your résumé at midnight and tell no one.';
      } },
    ],
  },
  {
    id: 'doctorWarning',
    category: 'lifestyle',
    title: 'The doctor\'s warning',
    weight: (game) => (older(game, 38) ? 0.2 + (game.player.health < 70 ? 0.5 : 0) + (game.player.plan.hours > 10.5 ? 0.3 : 0) : 0),
    text: 'Your annual physical: blood pressure 158 over 98, cholesterol through the roof. The doctor looks at you over her glasses. "Whatever you are doing, it is not sustainable."',
    choices: [
      { label: 'Change something: shorter days, real exercise', tag: 'rest', apply: (game) => {
        game.player.health += 4;
        setPlan(game, { hours: Math.min(game.player.plan.hours, 9) });
        return `${spend(game, insured(game) ? 400 : 1800)} on medication and a gym membership you actually use.`;
      } },
      { label: 'Take the pills and keep going', tag: 'ambitious', apply: (game) => {
        game.player.health -= 3;
        return 'The numbers hold for now. The doctor writes a longer note.';
      } },
    ],
  },
  {
    id: 'kneeSurgery',
    category: 'lifestyle',
    title: 'Your knee',
    weight: (game) => (older(game, 42) && !game.flags.kneeDone ? 0.35 : 0),
    text: 'An old running injury has turned into a torn meniscus. The surgeon can fix it, with six weeks of limping and rehab.',
    choices: [
      { label: 'Have the surgery now', tag: 'rest', apply: (game) => {
        game.flags.kneeDone = true;
        game.player.health += 3;
        if (employed(game)) scaleQuarter(game, 0.85);
        return `${spend(game, insured(game) ? 3400 : 32000)}, six weeks of rehab, and stairs are fine again.`;
      } },
      { label: 'Put it off until after the project', tag: 'ambitious', apply: (game) => {
        game.flags.kneeDone = true;
        game.player.health -= 4;
        return 'You stop running and take the elevator. It will keep.';
      } },
    ],
  },
  {
    id: 'friendIll',
    category: 'lifestyle',
    title: 'A friend is sick',
    weight: (game) => (older(game, 32) ? 0.3 : 0),
    text: 'A close friend has been diagnosed with cancer, at thirty-nine. They ask if you can take them to chemo on Tuesdays.',
    choices: [
      { label: 'Drive them every Tuesday', tag: 'kind', apply: (game) => {
        game.player.motivation -= 4;
        return 'Six months of Tuesdays. You learn more about them than in the previous ten years.';
      } },
      { label: 'Send food and call on Sundays', tag: 'safe', apply: (game) => {
        game.player.motivation -= 2;
        return 'It is what you can manage. You wish you could do more.';
      } },
    ],
  },
  {
    id: 'kidTrouble',
    category: 'lifestyle',
    title: 'The school calls',
    weight: (game) => (game.dependents > 0 ? 0.6 : 0),
    text: 'The school calls: your child has been in a fight, and is not talking. Can you come in?',
    choices: [
      { label: 'Leave work and go now', tag: 'kind', apply: (game) => {
        if (employed(game)) scaleQuarter(game, 0.96);
        game.player.motivation += 2;
        return 'You sit with them on the curb for an hour. It turns out to be about a friend who was being teased.';
      } },
      { label: 'Ask your partner to go', tag: 'safe', apply: (game) => {
        game.player.motivation -= 3;
        return 'It is handled. You are left with the feeling you should have gone.';
      } },
    ],
  },
  {
    id: 'sideGig',
    category: 'lifestyle',
    title: 'A weekend gig',
    weight: (game) => (employed(game) && game.player.level >= 1 ? 0.3 : 0),
    text: 'A friend asks you to help their small business with a one-off project: $8,000 for three weekends.',
    choices: [
      { label: 'Take the weekends', tag: 'ambitious', apply: (game) => {
        game.savings += 8000 * 0.75;
        game.lifetimeEarnings += 8000;
        game.player.health -= 3;
        game.player.motivation += 2;
        return 'Three weekends of work for money, and it is oddly refreshing to see something finished.';
      } },
      { label: 'Keep the weekends', tag: 'rest', apply: (game) => {
        game.player.health += 1;
        return 'You hike instead. It was a good call.';
      } },
    ],
  },
];

// Work: office moments that any industry has.
export const MORE_WORK = [
  {
    id: 'newManager',
    category: 'interpersonal',
    title: 'A new manager',
    weight: (game) => (game.player.quartersAtLevel > 4 ? 0.8 : 0),
    text: 'Your manager has been moved to another group. The new one is from outside, ten years younger, and has opinions.',
    choices: [
      { label: 'Win them over in the first month', tag: 'ambitious', apply: (game, data, random) => {
        if (random.chance(politicalOdds(game, 0.3, 120))) {
          game.player.alignment += 0.08;
          return 'A weekly one-on-one, one early win, and they stop reading you as a legacy hire.';
        }
        game.player.alignment -= 0.05;
        return 'You try too hard. They find it grating.';
      } },
      { label: 'Keep your head down and deliver', tag: 'safe', apply: (game) => {
        bonusQuarter(game, 4);
        return 'The work speaks for itself, mostly.';
      } },
      { label: 'Ask about a transfer', tag: 'bold', apply: (game) => {
        game.player.alignment -= 0.03;
        boostSearch(game, 0.05);
        return 'Your skip-level is surprised, and takes note.';
      } },
    ],
  },
  {
    id: 'youngerBoss',
    category: 'interpersonal',
    title: 'Younger than your kid',
    weight: (game) => (older(game, 42) && game.player.level >= 2 ? 0.6 : 0),
    text: 'Your new director is 31. In the first meeting they say "move fast" twice, and ask whether you are comfortable with the new tools.',
    choices: [
      { label: 'Show them you are not behind', tag: 'ambitious', apply: (game) => {
        game.player.health -= 2;
        bonusQuarter(game, 6);
        return 'You ship a demo in the new stack in a week. They look slightly embarrassed.';
      } },
      { label: 'Play the long game: be the person they ask', tag: 'safe', apply: (game) => {
        game.player.alignment += 0.04;
        return 'Within a quarter they are asking you which of their ideas will actually work.';
      } },
      { label: 'Take it as a sign', tag: 'bold', apply: (game) => {
        game.player.motivation -= 6;
        boostSearch(game, 0.08);
        game.player.plan.openness = Math.min(1, game.player.plan.openness + 0.2);
        return 'You start taking recruiter calls.';
      } },
    ],
  },
  {
    id: 'workFriend',
    category: 'interpersonal',
    title: 'Lunch regulars',
    weight: () => 0.7,
    text: 'You and a colleague have started having lunch together every Thursday. Today they ask for a candid read on a delicate situation.',
    choices: [
      { label: 'Be honest, including the hard part', tag: 'kind', apply: (game) => {
        const friend = game.random.pick(peers(game));
        bumpRelationship(friend, 18, game);
        game.player.motivation += 2;
        return friend ? `${friend.name} says it is the most useful thing anyone has told them all year.` : 'It is a good lunch.';
      } },
      { label: 'Stay polite and vague', tag: 'safe', apply: () => 'It is a perfectly pleasant lunch.' },
    ],
  },
  {
    id: 'teammateBurnout',
    category: 'interpersonal',
    title: 'A teammate is not okay',
    weight: () => 0.6,
    text: 'A teammate misses a third deadline in a row and tells you quietly, in the kitchen, that they are not sleeping.',
    choices: [
      { label: 'Cover for them for a few weeks', tag: 'kind', apply: (game) => {
        const friend = peers(game, (agent) => agent.level === game.player.level)[0];
        bumpRelationship(friend, 22, game);
        scaleQuarter(game, 0.95);
        game.player.alignment = Math.max(0.5, game.player.alignment - 0.02);
        return 'They get through the quarter. They will not forget it.';
      } },
      { label: 'Tell the manager', tag: 'safe', apply: () => 'It is handled properly, and awkwardly, and you did the right thing.' },
      { label: 'Stay out of it', tag: 'selfish', apply: (game) => {
        game.player.motivation -= 2;
        return 'You keep your head down. You do not feel great about it.';
      } },
    ],
  },
  {
    id: 'payDataLeak',
    category: 'interpersonal',
    title: 'The spreadsheet',
    weight: (game) => (game.player.quartersAtLevel > 6 ? 0.5 : 0),
    text: 'A salary spreadsheet is making the rounds on the group chat. Two people at your level, with the same scope, are paid noticeably more.',
    choices: [
      { label: 'Ask for a raise with the data in hand', tag: 'bold', apply: (game, data, random) => {
        if (random.chance(savvy(game, 0.5))) {
          game.player.salary *= 1.06;
          return 'Your manager checks, and adjusts you by 6%.';
        }
        game.player.alignment -= 0.05;
        return 'Your manager says compensation is "not a matter for comparison". It goes in your file.';
      } },
      { label: 'Let it go', tag: 'safe', apply: (game) => {
        game.player.motivation -= 3;
        return 'You do not mention it. You think about it every payday.';
      } },
    ],
  },
  {
    id: 'hiringFreeze',
    category: 'macro',
    title: 'Hiring freeze',
    weight: (game) => (game.market === 'recession' ? 1.2 : 0.3),
    text: 'A company-wide hiring freeze. Open roles are cancelled, and "internal moves only after review".',
    choices: [
      { label: 'Wait it out', tag: 'safe', apply: (game) => {
        game.player.readiness *= 0.9;
        return 'Chairs that were about to open stay shut. Promotions slow.';
      } },
      { label: 'Test the outside market', tag: 'bold', apply: (game) => {
        boostSearch(game, 0.1);
        game.player.plan.openness = Math.min(1, game.player.plan.openness + 0.3);
        return 'Everyone else is thinking the same. Recruiters are busy.';
      } },
    ],
  },
  {
    id: 'allHands',
    category: 'macro',
    title: 'The all-hands',
    weight: () => 0.8,
    text: 'The CEO\'s all-hands has a Q&A. A rumour is circulating about bonuses, and nobody wants to be the one to ask.',
    choices: [
      { label: 'Ask the question', tag: 'bold', apply: (game, data, random) => {
        if (random.chance(politicalOdds(game, 0.3, 130))) {
          game.player.alignment += 0.04;
          return 'A straight answer, and a lot of people thank you afterwards.';
        }
        game.player.alignment -= 0.07;
        return 'It turns into a small scene. Your manager asks for a word afterwards.';
      } },
      { label: 'Stay quiet', tag: 'safe', apply: () => 'Someone else asks it, badly.' },
    ],
  },
  {
    id: 'wellnessWeek',
    category: 'macro',
    title: 'Wellness week',
    weight: (game) => (game.player.health < 85 || game.player.motivation < 60 ? 0.9 : 0.3),
    text: 'HR launches "Wellness Week": yoga at noon, a meditation app subscription, and a "no meetings Friday" that everyone suspects will not last.',
    choices: [
      { label: 'Actually use it', tag: 'rest', apply: (game) => {
        game.player.health += 2;
        game.player.motivation += 4;
        scaleQuarter(game, 0.98);
        return 'Noon yoga and an early Friday. You feel slightly more like a person.';
      } },
      { label: 'Ignore it and keep working', tag: 'ambitious', apply: (game) => {
        bonusQuarter(game, 2);
        return 'You get a lot done while everyone else is at yoga.';
      } },
    ],
  },
  {
    id: 'crossTeamProject',
    category: 'interpersonal',
    title: 'A cross-team project',
    weight: () => 0.7,
    text: 'A project that spans three teams needs a lead from your level. Nobody has volunteered, and it will be seen by the people above you.',
    choices: [
      { label: 'Volunteer', tag: 'ambitious', apply: (game, data, random) => {
        if (random.chance(savvy(game, 0.6))) {
          game.player.readiness += 14;
          bonusQuarter(game, 8);
          return 'It lands. Your name is on the all-hands slide.';
        }
        game.player.motivation -= 4;
        scaleQuarter(game, 0.93);
        return 'Three teams with three agendas. It eats your quarter and is declared a draw.';
      } },
      { label: 'Let someone else do it', tag: 'safe', apply: () => 'A peer takes it, and gets the credit.' },
    ],
  },
  {
    id: 'rumourMill',
    category: 'interpersonal',
    title: 'Rumours',
    weight: () => 0.6,
    text: 'You hear that someone has told your manager you are interviewing elsewhere. (You are not, or not yet.)',
    choices: [
      { label: 'Address it directly with your manager', tag: 'bold', apply: (game, data, random) => {
        if (random.chance(politicalOdds(game, 0.35, 130))) {
          game.player.alignment += 0.04;
          return 'Your manager is relieved to hear it from you, and a little embarrassed.';
        }
        game.player.alignment -= 0.04;
        return 'It makes it look like there was something to address.';
      } },
      { label: 'Ignore it', tag: 'safe', apply: (game) => {
        game.player.alignment -= 0.02;
        return 'Rumours fade, mostly.';
      } },
    ],
  },
];
