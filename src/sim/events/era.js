// The Super Intelligence Revolution, as cards. The revolution itself is
// queued by the game (see era.js); after it, a share of each quarter's work
// cards come from this deck: the job becomes demos, pilots, workshops and
// proving that you are worth more than the agent that could replace you.

import { ERA } from '../../config.js';
import { scaleQuarter, bonusQuarter, spend, formatMoney, record, clamp, peers, bumpRelationship, politicalOdds } from './helpers.js';
import { sirWave } from '../era.js';
import { retireNow } from '../game.js';

const after = (game) => Boolean(game.sir) && game.employment.employed;

export const SIR_EVENT = {
  id: 'superIntelligence',
  category: 'arc',
  scope: 'any',
  title: 'The Super Intelligence Revolution',
  text: (game, data) => `${data.year}. It happens over a single weekend. A model that can do most of what your floor does, cheaper and around the clock, ships on a Friday; by Monday every board in ${game.industry.name.toLowerCase()} has a plan to use it. AI stocks have doubled. The memo from the CEO uses the word "leverage" eleven times. Nothing will be the same, and everyone knows it.`,
  choices: [
    { label: 'Learn the tools before anyone asks you to', tag: 'ambitious', apply: (game) => {
      game.player.skill = clamp(game.player.skill + 6, 0, 100);
      game.player.readiness = clamp(game.player.readiness + 8, 0, 100);
      game.player.motivation -= 4;
      game.player.health -= 2;
      return 'Nights and a weekend on agents and evals. On Monday you are the person people ask.';
    } },
    { label: 'Move savings into AI stocks', tag: 'bold', apply: (game, data, random) => {
      const stake = Math.max(0, game.savings) * 0.3;
      const gain = stake * (random.chance(0.7) ? random.between(0.6, 1.6) : -random.between(0.2, 0.5));
      game.savings += gain;
      return gain >= 0 ? `The rocket keeps going. ${formatMoney(gain)} on paper by the end of the quarter.` : `You bought the top. ${formatMoney(-gain)} gone by the end of the quarter.`;
    } },
    { label: 'Keep your head down and your hours up', tag: 'safe', apply: (game) => {
      game.player.motivation -= 6;
      return 'You work late and say little. The floor is quieter every week.';
    } },
  ],
};

/** Offered once, at fifty: retire now, as an ordinary retirement, or carry on to sixty. */
export function retireEvent() {
  return {
    id: 'retireOffer',
    category: 'career',
    scope: 'any',
    timing: 'start',
    title: 'Fifty',
    text: (game) => `You are fifty. ${game.employment.employed ? 'HR mentions, carefully, the early retirement package.' : 'The job search is longer at fifty.'} You could stop now and live on what you have, or carry on to sixty.`,
    choices: [
      { label: 'Retire now', tag: 'rest', apply: (game) => {
        retireNow(game);
        return 'You hand in your badge. The cake is lemon.';
      } },
      { label: 'Keep going to sixty', tag: 'safe', apply: () => 'Ten more years. You buy better shoes.' },
    ],
  };
}

const card = (spec) => ({ category: 'era', scope: 'work', ...spec, weight: (game) => (after(game) ? (spec.weight ? spec.weight(game) : 1) : 0) });

export const ERA_WORK = [
  card({
    id: 'demoDay',
    title: 'Demo day',
    text: 'Every team shows leadership what their agents can do. Ten minutes each, live, no slides. The room is full of people deciding which teams still need people.',
    choices: [
      { label: 'Demo something bold and risky', tag: 'bold', apply: (game, data, random) => {
        if (random.chance(politicalOdds(game, 0.3, 160) + 0.15)) {
          bonusQuarter(game, 8);
          game.player.readiness = clamp(game.player.readiness + 6, 0, 100);
          record(game, 'demoWin');
          return 'It works on the first try. A VP asks for your name.';
        }
        bonusQuarter(game, -5);
        return 'The agent loops on stage. Somebody laughs. It is not you.';
      } },
      { label: 'Show the safe workflow', tag: 'safe', apply: (game) => {
        bonusQuarter(game, 2);
        return 'Solid, unremarkable, and on time.';
      } },
      { label: 'Let a colleague present your work', tag: 'kind', apply: (game) => {
        const peer = game.random.pick(peers(game));
        bumpRelationship(peer, 10, game);
        return `${peer ? peer.name.split(' ')[0] : 'A colleague'} gets the credit, and owes you.`;
      } },
    ],
  }),
  card({
    id: 'promptWorkshop',
    title: 'The workshop',
    text: 'A mandatory three-day workshop: "Working alongside AI". The facilitator is enthusiastic. The coffee is not.',
    choices: [
      { label: 'Lean in, and run the follow-up session', tag: 'ambitious', apply: (game) => {
        game.player.skill = clamp(game.player.skill + 3, 0, 100);
        game.player.readiness = clamp(game.player.readiness + 3, 0, 100);
        scaleQuarter(game, 0.96);
        return 'You end up teaching half the floor. People remember who taught them.';
      } },
      { label: 'Attend, and answer email under the table', tag: 'safe', apply: (game) => {
        game.player.skill = clamp(game.player.skill + 1, 0, 100);
        return 'You learn a shortcut or two. The inbox survives.';
      } },
    ],
  }),
  card({
    id: 'automateYourTeam',
    title: 'Automate your own job',
    weight: (game) => (game.player.level >= 2 ? 1.2 : 0.6),
    text: 'A directive: every team must show which of its own tasks an agent can take over by the end of the quarter. Your name is on the template.',
    choices: [
      { label: 'Automate the grunt work, keep the judgement', tag: 'ambitious', apply: (game) => {
        bonusQuarter(game, 6);
        game.player.motivation -= 3;
        return 'Half your old week is gone. What is left is harder, and visibly yours.';
      } },
      { label: 'Automate a colleague\'s job, not yours', tag: 'selfish', apply: (game) => {
        const peer = game.random.pick(peers(game, (agent) => agent.level <= game.player.level));
        bumpRelationship(peer, -18, game);
        bonusQuarter(game, 4);
        return `It saves your seat. ${peer ? peer.name.split(' ')[0] : 'Somebody'} finds out.`;
      } },
      { label: 'Push back: some things need people', tag: 'bold', apply: (game) => {
        game.player.alignment = (game.player.alignment ?? 1) - 0.05;
        game.player.motivation += 3;
        return 'You are right, and it is noted, and not kindly.';
      } },
    ],
  }),
  card({
    id: 'agentPilot',
    title: 'The pilot',
    text: 'You are asked to run a pilot: one agent, one process, three months. If it works, the process needs fewer people. Including, possibly, you.',
    choices: [
      { label: 'Make it work brilliantly', tag: 'ambitious', apply: (game) => {
        bonusQuarter(game, 7);
        game.player.readiness = clamp(game.player.readiness + 5, 0, 100);
        return 'It works. You are now the person who knows how it works, which is the safest seat in the building.';
      } },
      { label: 'Make it work, slowly', tag: 'safe', apply: (game) => {
        bonusQuarter(game, 2);
        return 'It works, eventually. Nobody notices how long it took.';
      } },
    ],
  }),
  card({
    id: 'reskilling',
    title: 'Reskilling',
    text: 'The company offers to pay for a reskilling course in the evenings: AI systems, eight weeks.',
    choices: [
      { label: 'Take it', tag: 'ambitious', apply: (game) => {
        game.player.skill = clamp(game.player.skill + 5, 0, 100);
        game.player.health -= 3;
        game.player.motivation -= 2;
        return 'Eight weeks of evenings. You come out the other side fluent.';
      } },
      { label: 'Not now', tag: 'rest', apply: () => 'You will get to it. Everybody says that.' },
    ],
  }),
  card({
    id: 'aiOffsite',
    title: 'The AI strategy offsite',
    weight: (game) => (game.player.level >= 3 ? 1.4 : 0.3),
    text: 'Two days at a lake hotel to decide which departments become "AI-first". Your opinion has been asked for, which means your opinion will be remembered.',
    choices: [
      { label: 'Argue for your own team', tag: 'kind', apply: (game) => {
        for (const peer of peers(game, (agent) => agent.teamId === game.player.teamId)) bumpRelationship(peer, 6, game);
        game.player.alignment = (game.player.alignment ?? 1) - 0.02;
        return 'Your team keeps its headcount for another year. They know who to thank.';
      } },
      { label: 'Back the boldest plan in the room', tag: 'ambitious', apply: (game) => {
        game.player.readiness = clamp(game.player.readiness + 8, 0, 100);
        game.player.alignment = (game.player.alignment ?? 1) + 0.04;
        return 'The CEO nods at you twice. Your floor will be smaller next year.';
      } },
    ],
  }),
  card({
    id: 'impactReview',
    title: 'Show your AI impact',
    weight: (game) => 0.8 + sirWave(game) * 0.2,
    text: 'The review form has a new section: "How have you used AI to multiply your impact?" It is the first section.',
    choices: [
      { label: 'Write it up with numbers', tag: 'ambitious', apply: (game) => {
        bonusQuarter(game, 4);
        return 'Three numbers, all of them true, all of them flattering.';
      } },
      { label: 'Leave it short and honest', tag: 'safe', apply: (game) => {
        bonusQuarter(game, -2);
        return 'The calibration room reads it last.';
      } },
    ],
  }),
  card({
    id: 'hackathon',
    title: 'The agent hackathon',
    text: 'A weekend hackathon: build the agent that saves the company the most money. The prize is a trip, and a lot of attention.',
    choices: [
      { label: 'Enter, and stay up both nights', tag: 'ambitious', apply: (game, data, random) => {
        game.player.health -= 4;
        if (random.chance(0.35)) {
          bonusQuarter(game, 9);
          game.savings += 5000;
          record(game, 'hackathonWin');
          return `You win. ${formatMoney(5000)} and a handshake from the CTO.`;
        }
        bonusQuarter(game, 3);
        return 'Second place. Nobody remembers second place, but your manager does.';
      } },
      { label: 'Spend the weekend offline', tag: 'rest', apply: (game) => {
        game.player.motivation += 3;
        return 'You hike. On Monday you hear about the winner.';
      } },
    ],
  }),
];

export { spend, ERA };
