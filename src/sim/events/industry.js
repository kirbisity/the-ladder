// Each industry's own working life. These sit beside the first build's
// industry cards (outages, client escalations, auctions, reviewer 2) and
// all need a job: they open a quarter at work.

import { payInBand } from '../agent.js';
import { makeOffer, acceptOffer, quitJob, formatMoney, employerIndustry, titleOf } from '../game.js';
import {
  peers, samePeerLevel, bumpRelationship, scaleQuarter, bonusQuarter, forceHours, boostSearch, setPlan, spend, politicalOdds, paymentPlan,
} from './helpers.js';

const pol = (game, base = 0.2, span = 140) => politicalOdds(game, base, span);

// Career moves that change the kind of employer are off when a run is
// pinned to one tier (the outcome report plays each tier on its own).
const canMove = (game) => !game.tierLock;

/** A named move to another kind of employer, at a stated title and pay. */
function namedMove(game, tier, levelChange, payFactor) {
  const level = Math.max(0, Math.min(game.industry.seats.length - 2, game.player.level + levelChange));
  return makeOffer(game, level, payFactor, 'headhunter', { tier });
}

const TECH = [
  {
    id: 'foundingEngineer',
    title: 'A founding role',
    weight: (game) => (canMove(game) && game.org?.tier !== 'startup' && game.player.level >= 1 && game.player.level <= 4 ? 0.35 : 0),
    onDraw: (game) => namedMove(game, 'startup', 1, 0.85),
    text: (game, offer) => `A former teammate has raised a seed round and wants you as a founder-level hire: ${offer.company}, ${titleOf(game, offer.level)}, ${formatMoney(offer.salary)} and a percent of the company. Nine in ten startups never sell.`,
    choices: [
      { label: 'Join the startup', tag: 'bold', apply: (game, offer) => {
        acceptOffer(game, offer);
        return 'A bigger title, a smaller salary, and a lottery ticket. The office is a WeWork.';
      } },
      { label: 'Stay where the paycheck is', tag: 'safe', apply: () => 'You wish them luck, and mean it.' },
    ],
  },
  {
    id: 'internalTransfer',
    title: 'An internal transfer',
    weight: (game) => (game.player.quartersAtLevel >= 8 && game.player.level >= 1 ? 0.5 : 0),
    text: 'The new AI platform team is hiring from inside: same level, a new manager, the roadmap everyone wants to be on.',
    choices: [
      { label: 'Transfer', tag: 'ambitious', apply: (game) => {
        game.player.motivation += 10;
        game.player.alignment = 1;
        game.player.readiness *= 0.8;
        game.player.quartersAtLevel = 0;
        return 'A fresh start: new problems, new people, and a manager who has to learn what you can do.';
      } },
      { label: 'Stay with the team you know', tag: 'safe', apply: (game) => {
        game.player.alignment += 0.03;
        return 'Your manager is quietly relieved.';
      } },
    ],
  },
  {
    id: 'cve',
    title: 'A critical CVE',
    weight: () => 0.8,
    text: 'A remote-code-execution bug in a library your service depends on. Exploits are on GitHub by lunchtime.',
    choices: [
      { label: 'Patch it this weekend', tag: 'ambitious', apply: (game) => {
        game.player.health -= 3;
        game.player.alignment += 0.04;
        bonusQuarter(game, 4);
        return 'Saturday and Sunday in the incident channel. The CISO sends a thank-you.';
      } },
      { label: 'File it for Monday\'s sprint planning', tag: 'safe', apply: (game, data, random) => {
        if (random.chance(0.3)) {
          bonusQuarter(game, -10);
          game.player.motivation -= 6;
          return 'Someone got in on Sunday night. There is a postmortem with your name in it.';
        }
        return 'Monday it is. Nothing happens, this time.';
      } },
    ],
  },
  {
    id: 'rto',
    title: 'Return to office',
    weight: () => 0.6,
    text: 'An all-hands email: five days a week in the office from next quarter. Badge swipes will be tracked.',
    choices: [
      { label: 'Comply', tag: 'safe', apply: (game) => {
        game.player.health -= 2;
        game.player.motivation -= 4;
        game.player.alignment += 0.04;
        return 'Ninety minutes of commuting a day to sit on Zoom calls.';
      } },
      { label: 'Ask for a remote exception', tag: 'bold', apply: (game, data, random) => {
        if (game.player.alignment > 1.05 && random.chance(0.6)) {
          game.player.motivation += 3;
          return 'Your manager signs it off. Quietly.';
        }
        game.player.alignment -= 0.06;
        return 'Denied, and now HR knows your name.';
      } },
      { label: 'Start interviewing', tag: 'ambitious', apply: (game) => {
        setPlan(game, { openness: Math.max(game.player.plan.openness, 0.7) });
        return 'You update LinkedIn to "Open to work (remote)".';
      } },
    ],
  },
  {
    id: 'aiMandate',
    title: 'The AI mandate',
    weight: () => 0.6,
    text: 'Leadership mandates AI coding assistants for everyone, and raises output targets by 20% to match.',
    choices: [
      { label: 'Go all in on the tools', tag: 'ambitious', apply: (game) => {
        game.player.skill += 3;
        bonusQuarter(game, 4);
        return 'You learn where the tools help, and where they invent APIs that do not exist.';
      } },
      { label: 'Use them where they help, push back on the targets', tag: 'bold', apply: (game) => {
        game.player.alignment -= 0.04;
        return 'You write a memo about review burden. It is not well received.';
      } },
    ],
  },
  {
    id: 'calibration',
    title: 'Calibration season',
    weight: () => 0.8,
    text: 'Calibration: managers must put 10% of the org in "needs improvement". Your manager is in the room without you.',
    choices: [
      { label: 'Send your manager a brag document first', tag: 'ambitious', apply: (game) => {
        if (game.player.alignment > 1) {
          game.player.readiness += 5;
          return 'Your manager reads from it, word for word.';
        }
        return 'Your manager did not open it.';
      } },
      { label: 'Trust the process', tag: 'safe', apply: () => 'You find out in three weeks, like everyone else.' },
    ],
  },
  {
    id: 'promoPacket',
    title: 'The promo packet',
    weight: (game) => (game.player.readiness >= 60 ? 1.2 : 0),
    text: 'Your manager thinks you are ready. The promo packet needs twelve pages of impact, with metrics and peer quotes.',
    choices: [
      { label: 'Spend two weekends writing it', tag: 'ambitious', apply: (game) => {
        game.player.health -= 2;
        game.player.readiness += 8;
        return 'It reads well. You have never sounded so impressive.';
      } },
      { label: 'Let your manager write it', tag: 'safe', apply: (game) => {
        game.player.readiness += 4;
        return 'Three bullet points and a typo in your name.';
      } },
    ],
  },
  {
    id: 'onCallHell',
    title: 'On-call week',
    weight: (game) => 0.4 + game.player.industry.techDebt / 100,
    text: 'Your on-call week: fourteen pages, three of them between 2 and 4 AM.',
    choices: [
      { label: 'Carry it', tag: 'safe', apply: (game) => {
        game.player.health -= 4;
        game.player.motivation -= 3;
        bonusQuarter(game, 2);
        return 'You learn the system better than anyone, and sleep through Saturday.';
      } },
      { label: 'Swap with a colleague', tag: 'selfish', apply: (game, data, random) => {
        const colleague = random.pick(samePeerLevel(game));
        bumpRelationship(colleague, -12, game);
        return colleague ? `${colleague.name} takes it. They remember.` : 'Nobody will swap.';
      } },
    ],
  },
  {
    id: 'rsuCrash',
    title: 'The stock drops 40%',
    weight: () => 0.4,
    text: 'Earnings miss. The stock drops 40% overnight, and half your compensation was RSUs.',
    choices: [
      { label: 'Ask for a retention refresh', tag: 'bold', apply: (game) => {
        if (game.player.alignment > 1.05) {
          game.player.salary = payInBand(employerIndustry(game), game.player.level, game.player.salary * 1.06);
          return 'A refresh grant: about a 6% raise in real terms.';
        }
        game.player.motivation -= 4;
        return '"Budgets are tight right now."';
      } },
      { label: 'Ride it out', tag: 'safe', apply: (game) => {
        game.player.motivation -= 5;
        return 'Everyone is quietly doing the maths on Slack.';
      } },
    ],
  },
  {
    id: 'barRaiser',
    title: 'Bar raiser',
    weight: () => 0.5,
    text: 'You are asked to join the interview loop as a bar raiser: four interviews a week, plus write-ups.',
    choices: [
      { label: 'Accept', tag: 'kind', apply: (game) => {
        game.player.readiness += 6;
        scaleQuarter(game, 0.96);
        return 'You meet half the future org. Leadership notices who shows up.';
      } },
      { label: 'Decline: you have a launch', tag: 'safe', apply: () => 'Someone else does it.' },
    ],
  },
  {
    id: 'principalBlocks',
    title: 'Blocked in design review',
    weight: () => 0.7,
    text: 'A principal engineer blocks your design doc: "This will not scale." It will, but they have twenty years on you.',
    choices: [
      { label: 'Escalate with benchmarks', tag: 'bold', apply: (game, data, random) => {
        if (random.chance(pol(game))) {
          game.player.readiness += 8;
          return 'The benchmarks win. The principal concedes, gracefully, in public.';
        }
        game.player.alignment -= 0.06;
        return 'You were right and it does not matter. The project stalls.';
      } },
      { label: 'Rewrite it their way', tag: 'safe', apply: (game) => {
        bonusQuarter(game, -3);
        return 'Two weeks lost. You gain an ally with a long memory.';
      } },
    ],
  },
  {
    id: 'confTalk',
    title: 'Your talk is accepted',
    weight: () => 0.4 + 0.4 * 1,
    text: 'Your talk on the migration got into a major conference. Thirty minutes, 2,000 people.',
    choices: [
      { label: 'Give the talk', tag: 'ambitious', apply: (game) => {
        game.player.informants += 1;
        game.player.readiness += 6;
        boostSearch(game, 0.05);
        setPlan(game, { openness: Math.min(1, game.player.plan.openness + 0.1) });
        return 'Recruiters find your LinkedIn within the hour.';
      } },
      { label: 'Withdraw: no time', tag: 'safe', apply: () => 'The slot goes to someone from a rival company.' },
    ],
  },
  {
    id: 'acquisition',
    title: 'Acquired',
    weight: () => 0.25,
    text: 'Your company is being acquired by a bigger rival. Everyone gets a retention offer, or a severance package.',
    choices: [
      { label: 'Take the retention package', tag: 'safe', apply: (game) => {
        game.savings += game.player.salary * 0.2;
        game.player.motivation -= 4;
        return `A ${formatMoney(game.player.salary * 0.2)} retention bonus, and a new org chart to learn.`;
      } },
      { label: 'Take the severance and go', tag: 'bold', apply: (game) => {
        game.savings += game.player.salary * 0.35;
        quitJob(game);
        return 'Severance in hand, and a quarter to find what is next.';
      } },
    ],
  },
];

const CONSULTING = [
  {
    id: 'executiveMba',
    title: 'The sponsored MBA',
    weight: (game) => (game.player.level >= 2 && game.player.level <= 4 && !game.flags.mbaDone ? 0.4 : 0),
    text: 'The firm will sponsor half of an executive MBA: every other weekend for two years, and $90,000 of your own.',
    choices: [
      { label: 'Enrol', tag: 'ambitious', apply: (game) => {
        game.flags.mbaDone = true;
        game.player.skill += 5;
        game.player.readiness += 20;
        game.player.informants += 2;
        game.player.health -= 4;
        game.player.motivation -= 4;
        return `${paymentPlan(game, 90000, 8)} a quarter for two years. Cases on Saturday, clients on Monday, and a network that will outlast the firm.`;
      } },
      { label: 'Not now', tag: 'safe', apply: () => 'You keep your weekends.' },
    ],
  },
  {
    id: 'deathMarch',
    title: 'Staffed on a death march',
    weight: () => 0.9,
    text: 'Staffing puts you on a turnaround case with a partner famous for 80-hour weeks. Twelve weeks.',
    choices: [
      { label: 'Accept the case', tag: 'ambitious', apply: (game) => {
        forceHours(game, 13, 1);
        game.player.readiness += 8;
        return 'You will see the client site more than your apartment.';
      } },
      { label: 'Ask staffing for another case', tag: 'safe', apply: (game) => {
        game.player.alignment -= 0.05;
        game.player.industry.clientScore -= 5;
        return 'Staffing notes it. The next case is a cost-benchmarking slog.';
      } },
    ],
  },
  {
    id: 'deckAt1am',
    title: 'The 1 AM rewrite',
    weight: () => 1,
    text: 'The partner reviews the steering committee deck at 11 PM and wants it restructured by 7 AM.',
    choices: [
      { label: 'Pull the all-nighter', tag: 'ambitious', apply: (game) => {
        game.player.health -= 3;
        bonusQuarter(game, 4);
        return 'Forty slides, new storyline. The CEO says "this is exactly what we needed".';
      } },
      { label: 'Push back: send a tighter 70% version', tag: 'bold', apply: (game, data, random) => {
        if (random.chance(pol(game))) {
          game.player.readiness += 4;
          return 'The partner agrees the shorter story is better.';
        }
        game.player.alignment -= 0.06;
        return 'The partner rebuilds it themselves, and mentions it in your review.';
      } },
    ],
  },
  {
    id: 'clientExit',
    title: 'The client wants you',
    // Once a career: the exit is a raise and a life, not a faster ladder.
    weight: (game) => (game.player.level >= 2 && !game.flags.clientExitOffered ? 0.6 : 0),
    onDraw: (game) => {
      game.flags.clientExitOffered = true;
    },
    text: 'Your client\'s COO offers you a role in-house: strategy team, a 35% raise, home for dinner.',
    choices: [
      { label: 'Take the exit', tag: 'bold', apply: (game) => {
        const offer = makeOffer(game, game.player.level, 1.35, 'headhunter', { tier: 'stable' });
        acceptOffer(game, { ...offer, company: `${offer.company} (in-house)` });
        return 'You hand in your notice. The partners take you to a farewell dinner.';
      } },
      { label: 'Stay on the partner track', tag: 'safe', apply: (game) => {
        game.player.alignment += 0.04;
        return 'The partner hears you turned it down. That counts for something.';
      } },
    ],
  },
  {
    id: 'utilizationReview',
    title: 'The utilization report',
    weight: (game) => (game.player.industry.utilization < 0.75 ? 1.6 : 0.3),
    text: 'Staffing circulates utilization numbers. Yours is highlighted in yellow.',
    choices: [
      { label: 'Find billable work, any work', tag: 'ambitious', apply: (game) => {
        forceHours(game, 11, 1);
        game.player.industry.clientScore += 6;
        return 'A data-cleaning workstream nobody wanted. Billable, though.';
      } },
      { label: 'Argue that business development counts', tag: 'bold', apply: (game) => {
        game.player.alignment -= 0.04;
        return 'It does not count. Not yet, anyway.';
      } },
    ],
  },
  {
    id: 'upwardFeedback',
    title: 'Upward feedback',
    weight: (game) => (game.player.level >= 3 ? 0.8 : 0),
    text: 'Your case team rates you 2.6 out of 5 on upward feedback. "Unclear asks, late-night changes."',
    choices: [
      { label: 'Take the leadership coaching', tag: 'kind', apply: (game) => {
        for (const peer of peers(game, (agent) => agent.level < game.player.level)) bumpRelationship(peer, 5, game);
        game.player.readiness += 4;
        return 'Six sessions. Your next team notices the difference.';
      } },
      { label: 'Juniors always complain', tag: 'selfish', apply: (game) => {
        for (const peer of peers(game, (agent) => agent.level < game.player.level)) bumpRelationship(peer, -6, game);
        return 'The juniors talk to each other. Staffing hears about it.';
      } },
    ],
  },
  {
    id: 'proBono',
    title: 'A pro bono case',
    weight: () => 0.5,
    text: 'The firm is doing a pro bono case for a food bank network. The team needs one more person.',
    choices: [
      { label: 'Volunteer', tag: 'kind', apply: (game) => {
        game.player.motivation += 7;
        game.player.readiness += 3;
        scaleQuarter(game, 0.97);
        return 'The best work you have done all year, and you do not bill a minute.';
      } },
      { label: 'Stay on paying work', tag: 'safe', apply: () => 'Utilization stays green.' },
    ],
  },
  {
    id: 'salesTarget',
    title: 'The sales target',
    weight: (game) => (game.player.level >= 4 ? 1.2 : 0),
    text: 'You are on the partner track now, which means a sales target: $3M of new work this year.',
    choices: [
      { label: 'Work every relationship you have', tag: 'ambitious', apply: (game, data, random) => {
        forceHours(game, 11, 1);
        if (random.chance(pol(game, 0.25))) {
          game.player.readiness += 10;
          return 'Two new clients sign. The partners start inviting you to dinners.';
        }
        game.player.readiness += 3;
        return 'Lots of coffees, one small proposal.';
      } },
      { label: 'Negotiate the target down', tag: 'safe', apply: (game) => {
        game.player.alignment -= 0.04;
        return 'It goes to $2M. Your readiness for Partner slips a little.';
      } },
    ],
  },
  {
    id: 'stranded',
    title: 'Stranded at O\'Hare',
    weight: (game) => 0.4 + game.player.industry.utilization * 0.4,
    text: 'A snowstorm grounds every flight. The client workshop starts at 8 AM in Minneapolis.',
    choices: [
      { label: 'Rent a car and drive through the night', tag: 'ambitious', apply: (game) => {
        game.player.health -= 3;
        game.player.industry.clientScore += 6;
        return 'Seven hours on I-94. You walk in at 7:55.';
      } },
      { label: 'Run it over video from the airport', tag: 'safe', apply: (game) => {
        game.player.industry.clientScore -= 8;
        return 'The Wi-Fi drops twice. The client is polite about it.';
      } },
    ],
  },
  {
    id: 'expenseAudit',
    title: 'Expense audit',
    weight: () => 0.4,
    text: 'Finance flags $1,900 of your expenses: a team dinner over the per-head limit, and an Uber Black.',
    choices: [
      { label: 'Repay it and apologise', tag: 'safe', apply: (game) => {
        game.player.motivation -= 2;
        return `${spend(game, 1900)}. A lesson in reading the travel policy.`;
      } },
      { label: 'Get the partner to approve it', tag: 'bold', apply: (game) => {
        game.player.alignment -= 0.03;
        return 'Approved, with a sigh.';
      } },
    ],
  },
];

const PRIVATE_EQUITY = [
  {
    id: 'portcoOperator',
    title: 'Run a portfolio company',
    weight: (game) => (canMove(game) && game.player.level >= 2 && game.player.level <= 5 ? 0.35 : 0),
    onDraw: (game) => namedMove(game, 'stable', 1, 0.9),
    text: (game, offer) => `The partners want one of their own as COO of a portfolio company: ${offer.company}, ${titleOf(game, offer.level)}, ${formatMoney(offer.salary)}. Operating, not investing: saner hours, slower money.`,
    choices: [
      { label: 'Take the operating seat', tag: 'bold', apply: (game, offer) => {
        acceptOffer(game, offer);
        return 'You trade the deal team for a plant in Ohio and a P&L of your own.';
      } },
      { label: 'Stay on the deal team', tag: 'safe', apply: () => 'Carry is where the money is.' },
    ],
  },
  {
    id: 'ownFund',
    title: 'A fund of your own',
    weight: (game) => (canMove(game) && game.player.level >= 4 && game.org?.tier !== 'startup' ? 0.2 : 0),
    onDraw: (game) => namedMove(game, 'startup', 0, 0.7),
    text: (game, offer) => `Two LPs say they would anchor a first-time fund if you raised one: ${offer.company}, ${formatMoney(offer.salary)} in fees, and the carry is all yours. Most first funds never raise a second.`,
    choices: [
      { label: 'Raise the fund', tag: 'bold', apply: (game, offer) => {
        acceptOffer(game, offer);
        return 'Your name on the door, and two years of pitching to pension funds.';
      } },
      { label: 'Not yet', tag: 'safe', apply: () => 'You keep your seat at the big table.' },
    ],
  },
  {
    id: 'icGrilling',
    title: 'Investment committee',
    weight: () => 1,
    text: 'The investment committee spends forty minutes on one assumption in your model: churn in year three.',
    choices: [
      { label: 'Defend it with the cohort data', tag: 'bold', apply: (game, data, random) => {
        if (random.chance(pol(game))) {
          game.player.readiness += 8;
          return 'The founding partner nods. "Good work." The deal goes to final bids.';
        }
        bonusQuarter(game, -5);
        return 'They are not convinced. The deal is shelved.';
      } },
      { label: 'Rework the model over the weekend', tag: 'safe', apply: (game) => {
        game.player.health -= 2;
        bonusQuarter(game, 3);
        return 'Downside case, sensitivity tables, a new memo by Monday.';
      } },
    ],
  },
  {
    id: 'ceoQuits',
    title: 'The CEO quits by text',
    weight: () => 0.6,
    text: 'The CEO of a portfolio company resigns by text message on a Sunday night. Payroll is on Friday.',
    choices: [
      { label: 'Step in as interim chair', tag: 'ambitious', apply: (game) => {
        forceHours(game, 13, 1);
        game.player.readiness += 10;
        return 'You run the company from a borrowed office for three months.';
      } },
      { label: 'Hire a search firm and an interim', tag: 'safe', apply: (game) => {
        bonusQuarter(game, -3);
        return 'A $400k search fee, and an interim who knows the playbook.';
      } },
    ],
  },
  {
    id: 'covenant',
    title: 'Covenant breach',
    weight: () => 0.6,
    text: 'A portfolio company will breach its leverage covenant at quarter end. The lenders want a call.',
    choices: [
      { label: 'Negotiate a waiver', tag: 'bold', apply: (game, data, random) => {
        if (random.chance(pol(game, 0.3))) {
          game.player.readiness += 8;
          return 'A waiver for a 50-basis-point fee. The partners are impressed.';
        }
        bonusQuarter(game, -6);
        return 'The lenders want an equity cure. The fund writes another cheque.';
      } },
      { label: 'Recommend an equity cure', tag: 'safe', apply: (game) => {
        game.player.alignment -= 0.03;
        return 'The fund puts in $20M more. Returns take a hit.';
      } },
    ],
  },
  {
    id: 'weekendCim',
    title: 'Friday-night CIM',
    weight: () => 1,
    text: 'A banker sends a confidential information memorandum at 7 PM Friday. First-round bids are due Monday.',
    choices: [
      { label: 'Work the weekend', tag: 'ambitious', apply: (game) => {
        game.player.health -= 3;
        game.player.industry.dealFlow = Math.min(100, game.player.industry.dealFlow + 15);
        return 'An indicative bid goes in at 8:59 AM Monday.';
      } },
      { label: 'Pass on it', tag: 'safe', apply: () => 'Plenty of auctions. You have a life.' },
    ],
  },
  {
    id: 'carryVests',
    title: 'Carry vests',
    weight: (game) => (game.player.level >= 3 ? 0.5 : 0),
    text: 'An exit from Fund II closes at 3.1x. Your carried interest from that fund vests.',
    choices: [
      { label: 'Wire it to savings', tag: 'safe', apply: (game) => {
        const carry = game.player.salary * 0.6;
        game.savings += carry * 0.8;
        game.lifetimeEarnings += carry;
        game.player.motivation += 8;
        return `${formatMoney(carry)} of carry, taxed as capital gains.`;
      } },
    ],
  },
  {
    id: 'secLetter',
    title: 'A letter from the SEC',
    weight: () => 0.3,
    text: 'The SEC requests documents on how the firm allocated broken-deal expenses across funds.',
    choices: [
      { label: 'Lead the document review', tag: 'kind', apply: (game) => {
        forceHours(game, 11, 1);
        game.player.alignment += 0.06;
        return 'Six weeks of email archives. The general counsel owes you one.';
      } },
      { label: 'Leave it to compliance', tag: 'safe', apply: (game) => {
        game.player.motivation -= 2;
        return 'The firm settles for a fine. Everyone is tense for a quarter.';
      } },
    ],
  },
  {
    id: 'analystPoached',
    title: 'Your analyst is poached',
    weight: (game) => (game.player.level >= 2 ? 0.6 : 0),
    text: 'Your best analyst has an offer from a hedge fund: double the pay, half the hours.',
    choices: [
      { label: 'Fight for a counter', tag: 'kind', apply: (game, data, random) => {
        game.player.alignment -= 0.03;
        if (random.chance(0.4)) return 'They stay. You owe the managing director a favour.';
        bonusQuarter(game, -4);
        return 'They go anyway. You rebuild the model yourself.';
      } },
      { label: 'Write a warm reference', tag: 'safe', apply: (game) => {
        bonusQuarter(game, -4);
        game.player.informants += 0.5;
        return 'You lose an analyst and gain a friend at a hedge fund.';
      } },
    ],
  },
  {
    id: 'dividendRecap',
    title: 'Dividend recap',
    weight: () => 0.4,
    text: 'Credit markets are wide open. The partners want to lever up a portfolio company and pay the fund a dividend.',
    choices: [
      { label: 'Run the process', tag: 'ambitious', apply: (game) => {
        bonusQuarter(game, 6);
        game.player.readiness += 5;
        return 'The fund gets 40% of its money back early. LPs love it.';
      } },
      { label: 'Argue it is too much debt', tag: 'bold', apply: (game) => {
        game.player.alignment -= 0.05;
        return 'You are overruled. In two years you may be proven right.';
      } },
    ],
  },
];

const ACADEMIA = [
  {
    id: 'sideConsulting',
    title: 'The advisory board',
    weight: (game) => (game.player.level >= 2 ? 0.5 : 0),
    text: 'A biotech wants you on its scientific advisory board: $40,000 a year for a day a month, and options.',
    choices: [
      { label: 'Join the board', tag: 'bold', apply: (game) => {
        game.savings += 40000 * 0.7;
        game.lifetimeEarnings += 40000;
        scaleQuarter(game, 0.95);
        return 'A second income, and a little less time in the lab.';
      } },
      { label: 'Protect your research time', tag: 'safe', apply: () => 'The grant renewal needs you more.' },
    ],
  },
  {
    id: 'visitingChair',
    title: 'A call from a top department',
    weight: (game) => (canMove(game) && game.player.level >= 2 && game.org?.tier !== 'aggressive' ? 0.3 : 0),
    onDraw: (game) => namedMove(game, 'aggressive', 0, 1.1),
    text: (game, offer) => `${offer.company} wants you: ${titleOf(game, offer.level)}, ${formatMoney(offer.salary)}, a bigger lab and a higher bar. Your family would have to move.`,
    choices: [
      { label: 'Accept the chair', tag: 'ambitious', apply: (game, offer) => {
        game.player.motivation -= 3;
        acceptOffer(game, offer);
        return 'Boxes, a new city, and colleagues whose names you cited in your thesis.';
      } },
      { label: 'Stay', tag: 'safe', apply: (game) => {
        game.player.motivation += 2;
        return 'Your department counter-offers with a parking spot.';
      } },
    ],
  },
  {
    id: 'plagiarism',
    title: 'A plagiarised paper',
    weight: () => 0.6,
    text: 'A term paper in your course is 60% copied from a 2014 article, word for word.',
    choices: [
      { label: 'Report it to academic integrity', tag: 'safe', apply: (game) => {
        game.player.motivation -= 2;
        scaleQuarter(game, 0.98);
        return 'Three meetings, a hearing, and an appeal.';
      } },
      { label: 'Fail the paper quietly', tag: 'bold', apply: (game, data, random) => (random.chance(0.25)
        ? (game.player.alignment -= 0.05, 'The student appeals to the dean. You did not follow procedure.')
        : 'It ends there.') },
    ],
  },
  {
    id: 'teachingEvals',
    title: 'Teaching evaluations',
    weight: () => 0.8,
    text: 'Your teaching evaluations are in: 2.9 out of 5. "Clearly brilliant, impossible to follow."',
    choices: [
      { label: 'Go to the teaching centre\'s workshop', tag: 'kind', apply: (game) => {
        game.player.readiness += 4;
        return 'Active learning, clicker questions. Next term: 4.1.';
      } },
      { label: 'Ignore them: research is what counts', tag: 'safe', apply: (game) => {
        game.player.readiness -= 4;
        return 'The tenure committee reads them anyway.';
      } },
    ],
  },
  {
    id: 'hiringVote',
    title: 'The hiring vote',
    weight: () => 0.6,
    text: 'The department votes on a candidate your rival champions. The candidate is good, and would compete with your lab.',
    choices: [
      { label: 'Vote yes', tag: 'kind', apply: (game, data, random) => {
        for (const peer of samePeerLevel(game).slice(0, 3)) bumpRelationship(peer, 6, game);
        return 'Collegial. The department is stronger, and so is the competition.';
      } },
      { label: 'Vote no, and say why', tag: 'selfish', apply: (game) => {
        for (const peer of samePeerLevel(game).slice(0, 3)) bumpRelationship(peer, -10, game);
        game.player.alignment += 0.03;
        return 'The vote fails by one. Faculty meetings get colder.';
      } },
    ],
  },
  {
    id: 'sabbatical',
    title: 'Sabbatical',
    weight: (game) => (game.player.level >= 2 && game.player.quartersAtLevel > 8 ? 0.8 : 0),
    text: 'Your sabbatical is approved: a year at a partner university abroad, no teaching.',
    choices: [
      { label: 'Go', tag: 'rest', apply: (game) => {
        game.player.health += 8;
        game.player.motivation += 12;
        game.player.industry.researchProgress += 80;
        scaleQuarter(game, 0.85);
        return 'A flat in Copenhagen, a new collaborator, and a draft book.';
      } },
      { label: 'Postpone it', tag: 'safe', apply: () => 'Your lab needs you. It always will.' },
    ],
  },
  {
    id: 'industryLab',
    title: 'An offer from an AI lab',
    weight: (game) => (game.player.industry.citations > 40 ? 0.6 : 0.1),
    text: 'A big tech AI lab offers you $450,000 to lead a research team. Your dean has heard.',
    choices: [
      { label: 'Use it for a retention package', tag: 'bold', apply: (game, data, random) => {
        if (random.chance(0.6)) {
          game.player.salary = payInBand(employerIndustry(game), game.player.level, game.player.salary * 1.12);
          game.player.industry.grantQuarters = Math.max(game.player.industry.grantQuarters, 4);
          return 'A 12% raise, a reduced teaching load and a new postdoc line.';
        }
        game.player.alignment -= 0.06;
        return 'The dean calls your bluff. "We would hate to lose you."';
      } },
      { label: 'Decline: you love the work', tag: 'safe', apply: (game) => {
        game.player.motivation += 3;
        return 'You stay for the freedom, and the summers.';
      } },
    ],
  },
  {
    id: 'predatoryJournal',
    title: 'An invitation',
    weight: () => 0.5,
    text: 'You are invited to guest-edit a special issue of "The International Journal of Advanced Interdisciplinary Studies".',
    choices: [
      { label: 'Delete it', tag: 'safe', apply: () => 'It is a predatory journal. Your spam folder is full of them.' },
      { label: 'Accept', tag: 'bold', apply: (game) => {
        game.player.industry.citations += 2;
        game.player.alignment -= 0.06;
        return 'Your colleagues notice the name on your CV, and not in a good way.';
      } },
    ],
  },
  {
    id: 'reproducibility',
    title: 'It does not replicate',
    weight: (game) => (game.player.industry.papers > 2 ? 0.5 : 0),
    text: 'A graduate student cannot reproduce the main result of your most cited paper.',
    choices: [
      { label: 'Investigate openly', tag: 'kind', apply: (game, data, random) => {
        game.player.motivation -= 4;
        if (random.chance(0.6)) return 'A data-cleaning bug in their code. Your result holds.';
        game.player.industry.citations = Math.max(0, game.player.industry.citations - 10);
        return 'You find a real error and publish a correction. People respect it.';
      } },
      { label: 'Defend the paper', tag: 'bold', apply: (game, data, random) => {
        if (random.chance(0.7)) return 'The student drops it.';
        game.player.alignment -= 0.08;
        game.player.motivation -= 8;
        return 'A blog post goes viral: "When famous results fail". Your name is in the title.';
      } },
    ],
  },
  {
    id: 'phdDefense',
    title: 'Your student defends',
    weight: (game) => (game.player.level >= 1 ? 0.5 : 0),
    text: 'Your PhD student defends their dissertation. The committee passes it with no revisions.',
    choices: [
      { label: 'Take them to dinner', tag: 'kind', apply: (game) => {
        game.player.motivation += 8;
        game.player.readiness += 4;
        return 'They are off to a postdoc at a great lab. Your academic family grows.';
      } },
    ],
  },
  {
    id: 'fundingGap',
    title: 'The funding gap',
    weight: (game) => (game.player.industry.grants > 0 && game.player.industry.grantQuarters === 0 ? 1 : 0.2),
    text: 'Your grant has ended and the renewal has not come through. Two postdocs need salaries from next month.',
    choices: [
      { label: 'Beg the dean for bridge funding', tag: 'bold', apply: (game, data, random) => {
        if (random.chance(pol(game))) return 'Six months of bridge funding. You owe the dean a committee.';
        game.player.motivation -= 6;
        return 'No money. You write reference letters instead.';
      } },
      { label: 'Let them go', tag: 'safe', apply: (game) => {
        game.player.motivation -= 8;
        game.player.industry.researchProgress = Math.max(0, game.player.industry.researchProgress - 40);
        return 'The lab goes quiet. Two half-finished papers stall.';
      } },
    ],
  },
  {
    id: 'directorGradStudies',
    title: 'Director of graduate studies',
    weight: (game) => (game.player.level >= 2 ? 0.6 : 0),
    text: 'The chair asks you to be director of graduate studies: admissions, advising, and every student crisis.',
    choices: [
      { label: 'Accept', tag: 'ambitious', apply: (game) => {
        game.player.readiness += 8;
        forceHours(game, 10, 1);
        return 'Your research slows. Your name comes up for chair.';
      } },
      { label: 'Decline politely', tag: 'safe', apply: () => 'Someone else gets the headache, and the credit.' },
    ],
  },
  {
    id: 'strike',
    title: 'The graduate workers strike',
    weight: () => 0.3,
    text: 'The graduate workers union goes on strike. Your TAs stop grading; the provost wants grades on time.',
    choices: [
      { label: 'Support the strike', tag: 'kind', apply: (game) => {
        game.player.motivation += 3;
        game.player.alignment -= 0.05;
        for (const peer of peers(game, (agent) => agent.level === 0)) bumpRelationship(peer, 8, game);
        return 'You hold class on the picket line.';
      } },
      { label: 'Grade it all yourself', tag: 'safe', apply: (game) => {
        game.player.health -= 2;
        game.player.alignment += 0.03;
        return '400 exams over a long weekend.';
      } },
    ],
  },
];

function tagIndustry(list, industry) {
  return list.map((event) => ({ ...event, category: 'industry', industry }));
}

export const INDUSTRY_DECK = [
  ...tagIndustry(TECH, 'tech'),
  ...tagIndustry(CONSULTING, 'consulting'),
  ...tagIndustry(PRIVATE_EQUITY, 'privateEquity'),
  ...tagIndustry(ACADEMIA, 'academia'),
];

