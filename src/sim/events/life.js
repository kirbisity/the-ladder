// Life, which happens on random days whatever the job is doing. Costs are
// US household numbers; health bills depend on whether you are insured
// (an employer plan, or COBRA while out of work).

import { employed, insured, spend, paymentPlan, scaleQuarter, schedule, formatMoney } from './helpers.js';

export const LIFE_DECK = [
  {
    id: 'stressIllness',
    category: 'lifestyle',
    medical: true,
    title: 'What the stress does',
    weight: (game) => (!employed(game) && game.employment.unemployedQuarters >= 2 ? 0.6 : 0),
    text: (game) => (insured(game)
      ? 'Months of rejections have settled in your body: blood pressure at 150 over 95, and a rash the doctor calls shingles. Your COBRA plan covers most of it.'
      : 'Months of rejections have settled in your body: blood pressure at 150 over 95, and a rash the doctor calls shingles. Without insurance, the clinic visits and prescriptions are $2,800, and the specialist wants more.'),
    choices: [
      { label: 'Treat it properly', tag: 'safe', apply: (game) => {
        game.player.health += 3;
        return `${spend(game, insured(game) ? 600 : 2800)} for the visits and the pills. The numbers come down slowly.`;
      } },
      { label: 'Ride it out', tag: 'bold', apply: (game) => {
        game.player.health -= 8;
        game.player.motivation -= 4;
        return 'You skip the follow-up. The headaches come most mornings now.';
      } },
    ],
  },
  {
    id: 'therapy',
    category: 'lifestyle',
    medical: true,
    title: 'The low months',
    weight: (game) => (!employed(game) && game.player.motivation < 40 ? 0.7 : 0),
    text: (game) => `You sleep till noon and stop answering friends. A therapist has an opening: ${insured(game) ? '$40 a session with your plan' : '$180 a session'}.`,
    choices: [
      { label: 'Start weekly sessions', tag: 'rest', apply: (game) => {
        game.player.motivation += 12;
        return `${spend(game, insured(game) ? 480 : 2160)} for the quarter. It is the first thing that helps.`;
      } },
      { label: 'Push through alone', tag: 'safe', apply: (game) => {
        game.player.motivation -= 5;
        return 'You keep it to yourself. The days blur together.';
      } },
    ],
  },
  {
    id: 'erVisit',
    category: 'lifestyle',
    medical: true,
    title: 'An ambulance ride',
    weight: (game) => 0.5 + (game.player.health < 60 ? 0.8 : 0),
    text: (game) => (insured(game)
      ? 'A kidney stone at 2 AM: ambulance, CT scan, two nights inpatient. The explanation of benefits says you owe $3,200 after insurance.'
      : 'A kidney stone at 2 AM: ambulance, CT scan, two nights inpatient. With no insurance, the itemised bill comes to $38,400.'),
    choices: [
      { label: 'Pay it', tag: 'safe', apply: (game) => `Paid ${spend(game, insured(game) ? 3200 : 38400)}. The stone is a souvenir now.` },
      { label: 'Call billing and negotiate', tag: 'bold', apply: (game, data, random) => {
        const bill = insured(game) ? 3200 : 38400;
        if (random.chance(0.55)) return `After four calls, a "self-pay discount": you pay ${spend(game, bill * 0.45)}.`;
        game.player.motivation -= 3;
        return `Hold music, transfers, nothing. You pay ${spend(game, bill)}.`;
      } },
      { label: 'Set up a payment plan', tag: 'rest', apply: (game) => `${paymentPlan(game, insured(game) ? 3400 : 40000, 8)} a quarter for two years.` },
    ],
  },
  {
    id: 'dental',
    category: 'lifestyle',
    medical: true,
    title: 'The crown',
    weight: () => 0.6,
    text: (game) => `A cracked molar. The dentist says crown, ${insured(game) ? '$1,100 after dental insurance' : '$2,400 out of pocket'}, or pull it.`,
    choices: [
      { label: 'Get the crown', tag: 'safe', apply: (game) => `Two visits and ${spend(game, insured(game) ? 1100 : 2400)}. You can chew on the left again.` },
      { label: 'Pull it', tag: 'bold', apply: (game) => {
        game.player.motivation -= 2;
        return `${spend(game, 350)} and a gap you notice in photos.`;
      } },
    ],
  },
  {
    id: 'flu',
    category: 'lifestyle',
    medical: true,
    title: 'Flu season',
    weight: () => 0.8,
    text: '102°F, chills, and a cough that rattles. It is going round the whole floor.',
    choices: [
      { label: 'Take four sick days', tag: 'rest', apply: (game) => {
        game.player.health += 2;
        if (employed(game)) scaleQuarter(game, 0.95);
        return 'Soup, sleep, and a backlog waiting for you.';
      } },
      { label: 'Work from bed', tag: 'ambitious', apply: (game) => {
        game.player.health -= 5;
        game.player.motivation -= 2;
        return 'You ship things you will have to redo. It turns into bronchitis.';
      } },
    ],
  },
  {
    id: 'backPain',
    category: 'lifestyle',
    medical: true,
    title: 'Your lower back',
    weight: (game) => 0.3 + Math.max(0, game.player.plan.hours - 8) * 0.12 + (game.player.age > 35 ? 0.3 : 0),
    text: 'You bend down to tie a shoe and something in your lower back goes. Sitting is agony.',
    choices: [
      { label: 'Physical therapy and a standing desk', tag: 'rest', apply: (game) => {
        game.player.health += 4;
        return `Six PT sessions and a desk: ${spend(game, insured(game) ? 900 : 2100)}. It mostly comes back.`;
      } },
      { label: 'Ibuprofen and get on with it', tag: 'safe', apply: (game) => {
        game.player.health -= 4;
        return 'It becomes the kind of back pain people have for decades.';
      } },
    ],
  },
  {
    id: 'carAccident',
    category: 'lifestyle',
    title: 'A fender bender',
    weight: () => 0.4,
    text: 'Someone runs a red light into your passenger door. Nobody is badly hurt; your neck is stiff for weeks.',
    choices: [
      { label: 'Claim on your insurance', tag: 'safe', apply: (game) => {
        game.player.health -= 2;
        return `Your ${spend(game, 1000)} deductible, and a rental for ten days.`;
      } },
      { label: 'Chase the other driver\'s insurer', tag: 'bold', apply: (game, data, random) => {
        game.player.health -= 2;
        game.player.motivation -= 3;
        if (random.chance(0.6)) return 'Months of calls, but their insurer pays it all.';
        return `Their insurer denies liability. You pay ${spend(game, 4200)} for the repair.`;
      } },
    ],
  },
  {
    id: 'carTrouble',
    category: 'lifestyle',
    title: 'The transmission',
    weight: () => 0.5,
    text: 'The car makes a noise like a dying walrus. The mechanic says transmission.',
    choices: [
      { label: 'Fix it', tag: 'safe', apply: (game) => `${spend(game, 4800)} later, it runs.` },
      { label: 'Sell it and take transit', tag: 'bold', apply: (game) => {
        game.savings += 3000;
        game.player.health -= 1;
        return 'An hour more commuting a day, $3k richer.';
      } },
    ],
  },
  {
    id: 'rentHike',
    category: 'lifestyle',
    title: 'Lease renewal',
    // Rent rises with the market; the game's money is in real terms, so only
    // the part above inflation is charged, and it stops at $12k a year.
    weight: (game) => (game.homeEquity === 0 && (game.rentPremium ?? 0) < 12000 ? 0.5 : 0),
    text: 'The renewal letter: rent goes up $400 a month, "in line with the market".',
    choices: [
      { label: 'Sign it', tag: 'safe', apply: (game) => {
        game.rentPremium = (game.rentPremium ?? 0) + 4800;
        return `${formatMoney(4800)} a year more, from next quarter.`;
      } },
      { label: 'Move somewhere cheaper', tag: 'bold', apply: (game) => {
        game.player.motivation -= 3;
        game.player.health -= 1;
        return `Movers, deposit, a weekend of boxes: ${spend(game, 3800)}. The commute is longer.`;
      } },
    ],
  },
  {
    id: 'propertyTax',
    category: 'lifestyle',
    title: 'Reassessment',
    weight: (game) => (game.homeEquity > 0 ? 0.6 : 0),
    text: 'The county reassesses your house. Property tax goes up, and the roof needs work too.',
    choices: [
      { label: 'Pay and fix the roof', tag: 'safe', apply: (game) => `${spend(game, 14000)} for the roof and the tax.` },
      { label: 'Appeal the assessment, patch the roof', tag: 'bold', apply: (game, data, random) => {
        const saved = random.chance(0.5) ? 'The appeal works.' : 'The appeal fails.';
        return `${saved} ${spend(game, random.chance(0.5) ? 5000 : 9000)} all in.`;
      } },
    ],
  },
  {
    id: 'flood',
    category: 'lifestyle',
    title: 'Water through the ceiling',
    weight: () => 0.3,
    text: 'The upstairs neighbour\'s water heater bursts. Your laptop, your couch and your rug are ruined.',
    choices: [
      { label: 'Claim on renter\'s insurance', tag: 'safe', apply: (game, data, random) => (random.chance(0.7)
        ? `The claim pays out, less the deductible: ${spend(game, 500)}.`
        : `Turns out you let the policy lapse. ${spend(game, 6000)} to replace it all.`) },
      { label: 'Replace only the laptop', tag: 'bold', apply: (game) => {
        game.player.motivation -= 3;
        return `${spend(game, 1600)}. You sit on folding chairs for a while.`;
      } },
    ],
  },
  {
    id: 'friendsWedding',
    category: 'lifestyle',
    title: 'A wedding in Lisbon',
    weight: (game) => (game.player.age < 45 ? 0.6 : 0.2),
    text: 'Your college roommate is getting married in Lisbon. Flights, three nights, and a gift.',
    choices: [
      { label: 'Go', tag: 'rest', apply: (game) => {
        game.player.motivation += 7;
        if (employed(game)) scaleQuarter(game, 0.97);
        return `${spend(game, 3200)} and the best weekend in years.`;
      } },
      { label: 'Send a gift and a video', tag: 'safe', apply: (game) => {
        game.player.motivation -= 2;
        return `${spend(game, 250)}. You watch the photos come in at your desk.`;
      } },
    ],
  },
  {
    id: 'juryDuty',
    category: 'lifestyle',
    title: 'Jury summons',
    scope: 'work',
    weight: () => 0.35,
    text: 'A jury summons. The trial is expected to run eight days.',
    choices: [
      { label: 'Serve', tag: 'kind', apply: (game) => {
        scaleQuarter(game, 0.88);
        game.player.motivation += 2;
        return 'Eight days of a contract dispute. Strangely restful.';
      } },
      { label: 'Ask for a deferral', tag: 'safe', apply: (game, data, random) => (random.chance(0.5)
        ? 'Deferred six months. It will come back.'
        : (scaleQuarter(game, 0.88), 'Deferral denied. You serve.')) },
    ],
  },
  {
    id: 'petSurgery',
    category: 'lifestyle',
    title: 'The dog swallowed a sock',
    weight: () => 0.35,
    text: 'The emergency vet needs to operate tonight. Estimate: $4,500.',
    choices: [
      { label: 'Operate', tag: 'kind', apply: (game) => `${spend(game, 4500)}. The dog is fine, and unrepentant.` },
      { label: 'Ask about cheaper options', tag: 'bold', apply: (game, data, random) => {
        if (random.chance(0.5)) return `It passes on its own. ${spend(game, 600)} for the X-rays.`;
        game.player.motivation -= 10;
        return 'You lose the dog. The house is very quiet.';
      } },
    ],
  },
  {
    id: 'taxBill',
    category: 'lifestyle',
    title: 'April',
    weight: (game) => (game.quarterIndex % 4 === 1 && employed(game) && game.player.salary > 140000 ? 1.2 : 0),
    text: (game) => `Your withholding was short. You owe the IRS ${formatMoney(Math.round(game.player.salary * 0.03 / 100) * 100)} by April 15.`,
    choices: [
      { label: 'Pay it', tag: 'safe', apply: (game) => `Paid ${spend(game, game.player.salary * 0.03)}. Fix the W-4 next year.` },
      { label: 'Install-ment agreement with the IRS', tag: 'rest', apply: (game) => `${paymentPlan(game, game.player.salary * 0.034, 4)} a quarter, with interest.` },
    ],
  },
  {
    id: 'siblingLoan',
    category: 'lifestyle',
    title: 'Your brother calls',
    weight: (game) => (game.savings > 20000 ? 0.4 : 0),
    text: 'Your brother lost his job and is three months behind on rent. He asks to borrow $8,000.',
    choices: [
      { label: 'Lend it', tag: 'kind', apply: (game, data, random) => {
        spend(game, 8000);
        schedule(game, 'loanRepaid', random.int(4, 10), { repaid: random.chance(0.5) });
        game.player.motivation += 2;
        return 'He cries on the phone. You hope you see it again.';
      } },
      { label: 'Say no', tag: 'safe', apply: (game) => {
        game.player.motivation -= 5;
        return 'Thanksgiving is going to be awkward.';
      } },
    ],
  },
  {
    id: 'loanRepaid',
    category: 'arc',
    title: 'Your brother again',
    text: (game, data) => (data.repaid ? 'Your brother is back on his feet, and sends the $8,000 back with a bottle of wine.' : 'Your brother is still struggling. The $8,000 is not coming back, and you both know it.'),
    choices: [
      { label: 'Call him', tag: 'kind', apply: (game, data) => {
        if (data.repaid) game.savings += 8000;
        return data.repaid ? 'Paid in full.' : 'You let it go. Family.';
      } },
    ],
  },
  {
    id: 'identityTheft',
    category: 'lifestyle',
    title: 'Identity theft',
    weight: () => 0.25,
    text: 'Three credit cards you never opened, all maxed out. The bank wants affidavits.',
    choices: [
      { label: 'Freeze everything and file reports', tag: 'safe', apply: (game) => {
        game.player.motivation -= 4;
        return 'Twenty hours of calls. Your money comes back; your trust does not.';
      } },
    ],
  },
  {
    id: 'laptopDies',
    category: 'lifestyle',
    title: 'The blue screen',
    weight: (game) => (employed(game) ? 0.2 : 0.6),
    text: 'Your personal laptop dies, with five years of photos you never backed up.',
    choices: [
      { label: 'Data recovery and a new laptop', tag: 'safe', apply: (game) => `${spend(game, 2300)}. Most of the photos come back.` },
      { label: 'Just a new laptop', tag: 'bold', apply: (game) => {
        game.player.motivation -= 4;
        return `${spend(game, 1300)}. The photos are gone.`;
      } },
    ],
  },
];

// The first build's life cards, kept: they are tagged as mid-quarter in events.js.
export const LIFE_IDS_FROM_CORE = ['healthScare', 'familyIllness', 'house', 'fitness', 'vacation', 'startupBet', 'insomnia', 'windfall'];
