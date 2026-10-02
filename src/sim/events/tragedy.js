// The cards for misfortune.js: a loved one passing, a car crash, a fire at
// home, cancer. They are never drawn from the deck: the rolls queue them
// (category 'arc'), with the details in the card's data.

import { MISFORTUNE } from '../../config.js';
import { scaleQuarter, spend, schedule, formatMoney, record, clamp, insured } from './helpers.js';
import { startMedicalLeave } from '../game.js';
import { startIllness } from '../misfortune.js';
import { bumpSocial } from '../family.js';

const first = (person) => person.name.split(' ')[0];
const married = (game) => Boolean(game.married && game.partner && game.family);

export const TRAGEDY = [
  {
    id: 'passing',
    category: 'arc',
    title: 'Someone you love has died',
    text: (game, data) => {
      const lines = {
        grandparent: `${data.label} has died at ninety-one, in her sleep or his. The family wants to gather. Your cousins are already booking flights.`,
        parent: `${data.label} has died. There is a house to empty, papers to sign, and a silence where the phone calls used to be.`,
        inlaw: `${data.label} has died. ${game.partner ? first(game.partner) : 'Your partner'} is standing in the kitchen with the phone still in a hand, not saying anything.`,
        relative: `${data.label} has died, after a long illness the family did not discuss. There will be a service on Saturday.`,
        friend: `${data.label} has died, suddenly. You read the message three times. You were going to call next week.`,
      };
      return lines[data.kind];
    },
    choices: (game, data) => {
      const far = data.kind === 'grandparent' || data.kind === 'relative';
      const cost = data.kind === 'parent' ? 1800 : 1200;
      return [
        { label: 'Go, and stay for all of it', tag: 'kind', apply: (innerGame, innerData) => {
          innerGame.player.motivation -= innerData.hit * 0.7;
          bumpSocial(innerGame, 4);
          if (married(innerGame) && innerData.kind === 'inlaw') innerGame.family.quality = clamp(innerGame.family.quality + 6, 0, 100);
          if (innerGame.employment.employed) scaleQuarter(innerGame, 0.94);
          inherit(innerGame, innerData);
          record(innerGame, 'bereaved', { relation: innerData.kind, name: innerData.name, label: innerData.label });
          return `${spend(innerGame, cost)} in flights and a hotel. You sit with people you have not seen in years, and it helps a little.`;
        } },
        { label: innerLabel(data), tag: 'rest', apply: (innerGame, innerData) => {
          innerGame.player.motivation -= innerData.hit * 0.9;
          innerGame.player.health -= innerData.kind === 'parent' ? 2 : 0;
          if (innerGame.employment.employed) scaleQuarter(innerGame, innerData.kind === 'parent' ? 0.82 : 0.9);
          if (married(innerGame) && innerData.kind === 'inlaw') innerGame.family.quality = clamp(innerGame.family.quality + 8, 0, 100);
          inherit(innerGame, innerData);
          record(innerGame, 'bereaved', { relation: innerData.kind, name: innerData.name, label: innerData.label });
          return 'A week of bereavement leave. You do the paperwork and the casseroles and, at the end, the crying.';
        } },
        { label: far ? 'Send flowers and stay at work' : 'Hold it together and go back on Monday', tag: 'ambitious', apply: (innerGame, innerData) => {
          innerGame.player.motivation -= innerData.hit * 1.5;
          bumpSocial(innerGame, -3);
          if (married(innerGame) && innerData.kind === 'inlaw') innerGame.family.quality = clamp(innerGame.family.quality - 6, 0, 100);
          inherit(innerGame, innerData);
          record(innerGame, 'bereaved', { relation: innerData.kind, name: innerData.name, label: innerData.label });
          return 'You work through the afternoon of the funeral. Grief arrives late, and all at once.';
        } },
      ];
    },
  },
  {
    id: 'carCrash',
    category: 'arc',
    title: 'The crash',
    text: (game, data) => ({
      minor: 'The light is yellow, then it is not. A low-speed collision at a junction: a crumpled bumper, a cracked headlight, a shaken stranger, and nobody hurt.',
      moderate: `A truck runs a red light and hits your driver's door at speed. You wake up in the ER with a broken collarbone and three cracked ribs. ${insured(game) ? 'Your plan covers most of it.' : 'You have no insurance.'}`,
      severe: `You do not remember the road. You remember the ceiling of an ambulance, a paramedic saying your name, and then nothing for two days. The car is gone. ${insured(game) ? 'Your plan will cover most of it.' : 'You have no insurance, and the bills are already coming.'}`,
    }[data.severity]),
    choices: (game, data) => {
      if (data.severity === 'minor') {
        return [
          { label: 'Claim on insurance', tag: 'safe', apply: (innerGame) => {
            innerGame.player.motivation -= 3;
            record(innerGame, 'carCrash', { severity: 'minor' });
            return `${spend(innerGame, 800)} deductible, and a week without the car. You drive more carefully for a month.`;
          } },
          { label: 'Settle it in cash and keep the premium', tag: 'bold', apply: (innerGame, innerData, random) => {
            innerGame.player.motivation -= 3;
            record(innerGame, 'carCrash', { severity: 'minor' });
            if (random.chance(0.25)) return `${spend(innerGame, 5200)}: the other driver's "small scratch" turns out to be a lot of paint.`;
            return `${spend(innerGame, 1900)} in cash, and a handshake.`;
          } },
        ];
      }
      const bills = insured(game) ? (data.severity === 'severe' ? 24000 : 6800) : (data.severity === 'severe' ? 185000 : 61000);
      const hit = data.severity === 'severe' ? 30 : 12;
      const leave = data.severity === 'severe' ? 40 : 0;
      return [
        { label: 'Rest and do the physical therapy', tag: 'rest', apply: (innerGame) => {
          innerGame.player.health = Math.max(6, innerGame.player.health - hit);
          innerGame.player.motivation -= data.severity === 'severe' ? 14 : 5;
          if (leave && startMedicalLeave(innerGame, leave)) scaleQuarter(innerGame, 1);
          else if (innerGame.employment.employed) scaleQuarter(innerGame, 0.8);
          wreck(innerGame);
          record(innerGame, 'carCrash', { severity: data.severity });
          schedule(innerGame, 'crashAftermath', 2);
          return `${spend(innerGame, bills)} in bills. Months of physical therapy, and it heals properly. The car is gone.`;
        } },
        { label: 'Back at your desk as soon as you can', tag: 'ambitious', apply: (innerGame) => {
          innerGame.player.health = Math.max(5, innerGame.player.health - hit * 1.4);
          innerGame.player.motivation -= data.severity === 'severe' ? 18 : 8;
          wreck(innerGame);
          record(innerGame, 'carCrash', { severity: data.severity });
          schedule(innerGame, 'crashAftermath', 2);
          return `${spend(innerGame, bills)} in bills, and a shoulder that never quite sits right again. The car is gone.`;
        } },
      ];
    },
  },
  {
    id: 'houseFire',
    category: 'arc',
    title: 'Fire',
    text: (game, data) => `A call at 2 AM: smoke from the kitchen, then the stairs, then sirens. ${data.owned ? 'The house' : 'The flat'} burns for an hour. Everyone is out. ${data.insured ? 'Your policy will cover most of it.' : 'You let the policy lapse in the spring.'}`,
    choices: (game, data) => (data.owned ? [
      { label: 'Rebuild it, and live in a rental meanwhile', tag: 'safe', apply: (innerGame, innerData) => {
        innerGame.player.motivation -= 10;
        bumpSocial(innerGame, 2);
        scarFlags(innerGame);
        record(innerGame, 'houseFire', { owned: true });
        const cost = innerData.insured ? 22000 : Math.max(60000, innerGame.homeEquity * 0.5);
        if (!innerData.insured) innerGame.homeEquity *= 0.6;
        return `${spend(innerGame, cost)} out of pocket and eight months in a rental with a borrowed kettle. The new kitchen is better.`;
      } },
      { label: 'Take the payout, sell the lot, rent', tag: 'bold', apply: (innerGame, innerData) => {
        innerGame.player.motivation -= 12;
        scarFlags(innerGame);
        record(innerGame, 'houseFire', { owned: true });
        const take = innerGame.homeEquity * (innerData.insured ? 0.9 : 0.3);
        innerGame.savings += take;
        innerGame.homeEquity = 0;
        return `${formatMoney(take)} lands in the account and the house is a lot with a fence. You are renting again.`;
      } },
    ] : [
      { label: 'Replace what you can, and move into a new flat', tag: 'safe', apply: (innerGame, innerData) => {
        innerGame.player.motivation -= 9;
        scarFlags(innerGame);
        record(innerGame, 'houseFire', { owned: false });
        return `${spend(innerGame, innerData.insured ? 3200 : 16000)} for the basics. You wear the same two shirts for a month.`;
      } },
      { label: 'Stay with friends while you sort it out', tag: 'kind', apply: (innerGame, innerData) => {
        innerGame.player.motivation -= 6;
        bumpSocial(innerGame, 8);
        scarFlags(innerGame);
        record(innerGame, 'houseFire', { owned: false });
        return `${spend(innerGame, innerData.insured ? 1200 : 9000)}, a lot of kindness, and a sofa that is not yours. The circle holds you up.`;
      } },
    ]),
  },
  {
    id: 'cancer',
    category: 'arc',
    title: 'The results',
    text: (game, data) => {
      const stage = ['early', 'locally advanced', 'advanced'][data.stage - 1];
      return data.who === 'player'
        ? `The doctor closes the door before she sits. It is cancer: ${stage}. She says the word treatable twice, and you only hear it once.`
        : `${first(game.partner)} comes home from the appointment, puts the keys down very carefully, and tells you it is cancer: ${stage}. You hold on to each other in the hall.`;
    },
    choices: (game, data) => {
      const cost = (aggressive) => (insured(game) ? (aggressive ? 18000 : 14000) : (aggressive ? 140000 : 95000));
      if (data.who === 'player') {
        return [
          { label: 'Aggressive treatment: take medical leave', tag: 'rest', apply: (innerGame, innerData) => {
            startIllness(innerGame, { who: 'player', stage: innerData.stage, treatment: 'aggressive' });
            innerGame.player.motivation -= 12;
            startMedicalLeave(innerGame, 60);
            return `${spend(innerGame, cost(true))} and twelve weeks away from everything. The odds are the best they can be.`;
          } },
          { label: 'Standard treatment, and keep working', tag: 'ambitious', apply: (innerGame, innerData) => {
            startIllness(innerGame, { who: 'player', stage: innerData.stage, treatment: 'standard' });
            innerGame.player.motivation -= 10;
            if (innerGame.employment.employed) scaleQuarter(innerGame, 0.85);
            return `${spend(innerGame, cost(false))}. Infusions on Fridays, calls from the chair, and a team that does not quite know where to look.`;
          } },
          { label: 'Wait and see: it is probably nothing', tag: 'bold', apply: (innerGame, innerData) => {
            startIllness(innerGame, { who: 'player', stage: innerData.stage, treatment: 'wait' });
            innerGame.player.motivation -= 4;
            return `${spend(innerGame, 2500)} on tests. You tell no one. The doctor is not pleased.`;
          } },
        ];
      }
      return [
        { label: 'Take leave and be there for every appointment', tag: 'kind', apply: (innerGame, innerData) => {
          startIllness(innerGame, { who: 'partner', stage: innerData.stage, treatment: 'aggressive', cared: true });
          innerGame.player.motivation -= 10;
          innerGame.family.quality = clamp(innerGame.family.quality + 8, 0, 100);
          startMedicalLeave(innerGame, 30);
          return `${spend(innerGame, cost(true) * 0.5)} and a month of being a nurse, a driver, and a husband or wife. It is the hardest thing you have ever done.`;
        } },
        { label: 'Pay for the best care, and keep your hours', tag: 'safe', apply: (innerGame, innerData) => {
          startIllness(innerGame, { who: 'partner', stage: innerData.stage, treatment: 'standard' });
          innerGame.player.motivation -= 12;
          innerGame.family.quality = clamp(innerGame.family.quality - 2, 0, 100);
          return `${spend(innerGame, cost(true) * 0.6)}. You send the best doctors and sit in the waiting room with your laptop.`;
        } },
        { label: 'Keep to your schedule; they say they understand', tag: 'ambitious', apply: (innerGame, innerData) => {
          startIllness(innerGame, { who: 'partner', stage: innerData.stage, treatment: 'standard' });
          innerGame.player.motivation -= 8;
          innerGame.family.quality = clamp(innerGame.family.quality - 14, 0, 100);
          return `${spend(innerGame, cost(false) * 0.5)}. They say they understand. They go to the appointments alone.`;
        } },
      ];
    },
  },
];

function innerLabel(data) {
  return data.kind === 'parent' ? 'Take bereavement leave and settle everything' : 'Take a few days off';
}

/** What a person leaves behind: sometimes a little money, mostly parents. */
function inherit(game, data) {
  const [low, high, chance] = MISFORTUNE.loved[data.kind].inherits;
  if (!high || !game.random.chance(chance)) return;
  game.savings += Math.round(game.random.between(low, high) / 1000) * 1000;
}

/** The car is a write-off: the insurer pays a little; the player is asked about a new one soon. */
function wreck(game) {
  game.flags.car = 'none';
  game.savings += insured(game) ? 3500 : 0;
  schedule(game, 'carDecision', 2);
}

/** A fire takes the nice things: the apartment and the car's polish go with it. */
function scarFlags(game) {
  if (game.flags.apartment) game.flags.apartment = undefined;
}
