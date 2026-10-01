// The unemployment spiral, measured: careers are played normally to an age,
// then the job is lost and every offer declined, so the search runs as long
// as it can. Prints, by quarters out of work, the share divorced and the
// share homeless.
// Usage: node tools/spiral.js [careers] [age]

import { createGame, quitJob } from '../src/sim/game.js';
import { playQuarter, POLICIES } from '../src/sim/bots.js';

const declineEveryOffer = {
  ...POLICIES.adaptive,
  choose: (game, choices) => (game.currentEvent?.event.id === 'jobOffer' ? choices.length - 1 : POLICIES.adaptive.choose(game, choices)),
};

/** Shares divorced and homeless after 1..quarters of searching, for married players. */
export function measureSpiral(careers, startAge, quarters = 12, characterId = 'joseph') {
  const tally = Array.from({ length: quarters + 1 }, () => ({ divorced: 0, homeless: 0 }));
  let played = 0;
  for (let index = 0; index < careers; index += 1) {
    const game = createGame({ seed: 5000 + index, characterId, industryId: 'tech' });
    let guard = 0;
    while (!game.outcome && game.player.age < startAge && guard < 400) {
      playQuarter(game, POLICIES.adaptive);
      guard += 1;
    }
    if (game.outcome) continue;
    played += 1;
    game.married = true;
    game.dependents = Math.max(game.dependents, 1);
    if (game.employment.employed) quitJob(game);
    let divorced = false;
    for (let quarter = 1; quarter <= quarters; quarter += 1) {
      if (!game.outcome) {
        const report = playQuarter(game, declineEveryOffer);
        if (report?.divorced) divorced = true;
      }
      if (divorced) tally[quarter].divorced += 1;
      if (game.outcome?.kind === 'homeless') tally[quarter].homeless += 1;
    }
  }
  return tally.slice(1).map((entry, index) => ({
    quarter: index + 1,
    divorced: entry.divorced / played,
    homeless: entry.homeless / played,
  }));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const careers = Number(process.argv[2] ?? 150);
  const age = Number(process.argv[3] ?? 27);
  for (const row of measureSpiral(careers, age)) {
    console.log(`Q${row.quarter}`.padEnd(4), `divorced ${Math.round(row.divorced * 100)}%`.padEnd(15), `homeless ${Math.round(row.homeless * 100)}%`);
  }
}
