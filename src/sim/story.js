// The career journal and the story told at the end. Moments are recorded
// as they happen; the summary assembles fixed sentences chosen by what the
// journal shows, so every career reads as its own.

/** Note a moment in the career. */
export function record(game, kind, details = {}) {
  if (!game.journal) game.journal = [];
  game.journal.push({ kind, quarter: game.quarterIndex, age: game.player.age, level: game.player.level, ...details });
}

function count(journal, kind) {
  return journal.filter((entry) => entry.kind === kind).length;
}

function first(journal, kind) {
  return journal.find((entry) => entry.kind === kind) ?? null;
}

const NUMBER_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];

// Small counts read as words; a sentence may start with one, so callers
// capitalise where they need to.
function plural(number, word, many = `${word}s`) {
  const count = number < NUMBER_WORDS.length ? NUMBER_WORDS[number] : String(number);
  return `${count} ${number === 1 ? word : many}`;
}

function capitalise(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// A stable choice among phrasings, so the same career always reads the same.
function pick(game, salt, options) {
  const index = Math.abs(Math.imul((game.seed ?? 1) + salt * 7919, 2654435761) >>> 0) % options.length;
  return options[index];
}

function money(amount) {
  const value = Math.abs(amount);
  const sign = amount < 0 ? '−' : '';
  if (value >= 1e6) return `${sign}$${(value / 1e6).toFixed(1)} million`;
  if (value >= 1e3) return `${sign}$${Math.round(value / 1e3)},000`;
  return `${sign}$${Math.round(value)}`;
}

/**
 * The career, told in a handful of paragraphs, plus a one-line verdict.
 *
 * Returns:
 *   { verdict, paragraphs: [string] }
 */
export function careerSummary(game) {
  const journal = game.journal ?? [];
  const player = game.player;
  const outcome = game.outcome;
  const industry = game.industry;
  const titles = industry.titles;
  const peak = Math.max(game.peakLevel, player.level);
  const years = Math.max(0, Math.round(player.age - 22));
  const paragraphs = [];

  // Opening.
  const joined = first(journal, 'joined');
  paragraphs.push(`${player.name}, ${game.character.mbti} and ${game.character.archetype.toLowerCase()}, `
    + `${pick(game, 1, ['walked off the graduation stage', 'left university', 'threw the cap and kept walking'])} into ${industry.name.toLowerCase()}`
    + `${joined ? `, starting as ${joined.title} at ${joined.company}` : ''}.`);

  // The climb.
  const promotions = journal.filter((entry) => entry.kind === 'promoted');
  if (promotions.length === 0) {
    paragraphs.push(pick(game, 2, [
      `The ladder never moved. ${years} years in, the title on the badge was still ${titles[player.level]}.`,
      `No promotion ever came. Others climbed past while ${player.name.split(' ')[0]} stayed on the first rung.`,
    ]));
  } else {
    const firstUp = promotions[0];
    const pace = firstUp.age < 24.5 ? 'fast' : firstUp.age < 27 ? 'steady' : 'slow';
    const opener = {
      fast: pick(game, 3, ['The first promotion came quickly', 'Early on, the climb looked effortless']),
      steady: pick(game, 3, ['The first promotion arrived on schedule', 'The early years went to plan']),
      slow: pick(game, 3, ['The first promotion took its time', 'It was a slow start']),
    }[pace];
    const peakEntry = promotions.filter((entry) => entry.level === peak)[0];
    const peakText = peakEntry ? `${titles[peak]} by ${Math.floor(peakEntry.age)}` : titles[peak];
    paragraphs.push(`${opener}, at ${Math.floor(firstUp.age)}. Over ${plural(promotions.length, 'promotion')} the climb reached ${peakText}`
      + `${peak >= titles.length - 1 ? ', the top of the ladder.' : peak >= 5 ? ', higher than most ever get.' : peak >= 3 ? ', a solid middle of the ladder.' : '.'}`);
  }

  // Setbacks: leapfrogs, PIPs, lost jobs, unemployment.
  const setbacks = [];
  const leapfrogs = count(journal, 'leapfrogged');
  if (leapfrogs) setbacks.push(`was leapfrogged ${leapfrogs === 1 ? 'once' : `${leapfrogs} times`} by someone more junior`);
  const pips = count(journal, 'pip');
  if (pips) setbacks.push(`survived ${pips === 1 ? 'a PIP' : `${pips} PIPs`}`);
  const losses = journal.filter((entry) => entry.kind === 'lostJob');
  const reasons = { 'laid off': 'laid off', fired: 'fired', 'counselled out': 'counselled out', 'contract ended': 'let go at a contract\'s end', 'denied tenure': 'denied tenure', quit: 'quit without an offer' };
  for (const loss of losses.slice(0, 3)) setbacks.push(`was ${reasons[loss.reason] ?? 'let go'} from ${loss.company} at ${Math.floor(loss.age)}`);
  if (losses.length > 3) setbacks.push(`lost ${losses.length - 3} more jobs after that`);
  const outOfWork = journal.filter((entry) => entry.kind === 'rehired').reduce((sum, entry) => sum + (entry.quartersOut ?? 0), 0);
  if (setbacks.length) {
    const sentence = setbacks.length === 1 ? setbacks[0] : `${setbacks.slice(0, -1).join(', ')} and ${setbacks[setbacks.length - 1]}`;
    paragraphs.push(`Along the way, ${player.name.split(' ')[0]} ${sentence}.`
      + (outOfWork ? ` In all, ${plural(outOfWork, 'quarter')} ${outOfWork === 1 ? 'was' : 'were'} spent out of work, sending applications into the void.` : ''));
  } else {
    paragraphs.push(pick(game, 4, [
      'There were no firings, no layoffs, no PIPs: a rare, clean record.',
      'Not one PIP, layoff or firing in the whole career. Few can say that.',
    ]));
  }

  // Moves between employers.
  const moves = journal.filter((entry) => entry.kind === 'joined').length - 1;
  if (moves >= 3) paragraphs.push(`${capitalise(plural(moves, 'move'))} between employers: ${journal.filter((entry) => entry.kind === 'joined').map((entry) => entry.company).join(', ')}.`);
  else if (moves > 0) paragraphs.push(`${moves === 1 ? 'One move' : 'Two moves'} between employers changed the trajectory: ${journal.filter((entry) => entry.kind === 'joined').slice(1).map((entry) => `${entry.company} at ${Math.floor(entry.age)}`).join(' and ')}.`);
  else if (years >= 10) paragraphs.push(`${player.name.split(' ')[0]} stayed at ${joined?.company ?? 'one company'} the whole way: a lifer.`);

  // Body and mind.
  const life = [];
  const burnouts = count(journal, 'burnout');
  const leaves = count(journal, 'fmla');
  const scares = count(journal, 'healthScare');
  const wellbeing = [];
  if (burnouts) wellbeing.push(`burned out ${burnouts === 1 ? 'once' : `${burnouts} times`}`);
  if (leaves) wellbeing.push(`took FMLA leave ${leaves === 1 ? 'once' : `${leaves} times`}`);
  const holidays = journal.filter((entry) => entry.kind === 'holiday');
  const longest = holidays.reduce((most, entry) => Math.max(most, entry.days ?? 0), 0);
  if (scares) wellbeing.push(`had ${plural(scares, 'health scare')}`);
  if (holidays.length >= 3) life.push(`took ${plural(holidays.length, 'real holiday')}${longest >= 20 ? ', once a whole month away' : ''}`);
  if (wellbeing.length) {
    paragraphs.push(`The work took its toll: ${player.name.split(' ')[0]} ${wellbeing.join(', ')}.`);
  } else if (years >= 10) {
    paragraphs.push(pick(game, 5, ['Through all of it, body and mind held up. The pace was sustainable.', 'Never burned out, never broke down: a career run at a pace a person can keep.']));
  }

  // Life outside.
  const married = first(journal, 'married');
  const divorce = first(journal, 'divorce');
  const spouse = married?.partner ?? null;
  if (married) life.push(`married${spouse ? ` ${spouse}` : ''} at ${Math.floor(married.age)}`);
  else if (first(journal, 'dating')) life.push(`found love with ${first(journal, 'dating').partner ?? 'someone'}, though it never reached a wedding`);
  const breakups = count(journal, 'breakup');
  if (breakups) life.push(`${breakups === 1 ? 'went through a breakup' : `went through ${plural(breakups, 'breakup')}`}`);
  const children = count(journal, 'child');
  if (children) life.push(`raised ${plural(children, 'child', 'children')}`);
  if (first(journal, 'parentalLeave')) life.push('stepped away from work for a new baby');
  const house = first(journal, 'house');
  if (house) life.push(`bought a house at ${Math.floor(house.age)}`);
  if (first(journal, 'startupWin')) life.push('got rich on a friend\'s startup');
  const bereavements = count(journal, 'bereaved');
  if (bereavements) life.push(bereavements === 1 ? 'lost someone close' : `buried ${plural(bereavements, 'person', 'people')} they loved`);
  const crashes = journal.filter((entry) => entry.kind === 'carCrash');
  if (crashes.some((entry) => entry.severity === 'severe')) life.push('survived a car crash that should have ended differently');
  else if (crashes.length) life.push(crashes.length === 1 ? 'was in a car crash' : `was in ${plural(crashes.length, 'car crash', 'car crashes')}`);
  if (first(journal, 'houseFire')) life.push('lost a home to fire');
  const ill = first(journal, 'cancer');
  if (ill && first(journal, 'cancerCleared')) life.push(ill.who === 'partner' ? `saw ${ill.partner ?? 'a partner'} through cancer and out the other side` : 'beat cancer');
  else if (ill && ill.who === 'partner' && first(journal, 'widowed')) life.push(`lost ${ill.partner ?? 'a partner'} to cancer`);
  if (first(journal, 'ipo')) life.push('rode a company to its IPO');
  if (divorce) {
    life.push(divorce.reason === 'strain'
      ? `divorced at ${Math.floor(divorce.age)}: the hours had left no home to come back to${divorce.kids ? `, with ${plural(divorce.kids, 'child', 'children')} to raise between two houses` : ''}`
      : `divorced at ${Math.floor(divorce.age)}, when a long search out of work broke the marriage and took half of everything`);
  }
  if (life.length) paragraphs.push(`Outside the office, ${player.name.split(' ')[0]} ${life.join(', ')}.`);

  // Industry colour.
  const state = player.industry;
  if (industry.subStat === 'citations' && state.papers) {
    paragraphs.push(`The research record: ${plural(state.papers, 'paper')}, ${Math.round(state.citations)} citations and ${plural(state.grants, 'grant')}.`);
  } else if (industry.subStat === 'dealFlow' && count(journal, 'deal')) {
    paragraphs.push(`${capitalise(plural(count(journal, 'deal'), 'deal'))} closed with ${player.name.split(' ')[0]} on the team.`);
  }

  // Startups.
  const exits = journal.filter((entry) => entry.kind === 'startupExit');
  const folds = journal.filter((entry) => entry.kind === 'startupFolded');
  if (exits.length) {
    const best = exits.reduce((top, entry) => ((entry.payout ?? 0) > (top.payout ?? 0) ? entry : top));
    paragraphs.push(`${best.company} was bought while ${player.name.split(' ')[0]} was there${best.payout ? `, and the equity paid ${money(best.payout)}` : ''}.${folds.length ? ` ${folds.map((entry) => entry.company).join(' and ')} folded.` : ''}`);
  } else if (folds.length) {
    paragraphs.push(`The startup bets did not pay: ${folds.map((entry) => entry.company).join(' and ')} ran out of runway, and the equity with ${folds.length === 1 ? 'it' : 'them'}.`);
  }

  // Money.
  const worth = outcome?.netWorth ?? 0;
  paragraphs.push(worth >= 20e6 ? `The money was extraordinary: ${money(worth)} at the end, from ${money(game.lifetimeEarnings)} earned.`
    : worth >= 3e6 ? `Financially, it worked: ${money(worth)} at the end.`
      : worth >= 500e3 ? `A comfortable sum, ${money(worth)}, was put away.`
        : worth > 0 ? `Savings stayed thin: ${money(worth)} at the end.`
          : 'Nothing was left in the bank at the end.');

  // The ending.
  const age = Math.floor(outcome?.age ?? player.age);
  paragraphs.push({
    retired: pick(game, 6, [`At ${age}, the badge went back in a drawer for good.`, `Retirement came at ${age}, with a cake in the break room.`]),
    death: outcome?.cause === 'cancer' ? `It ended at ${age}, after a long fight with cancer, in a room with the people who mattered.` : `It ended at ${age}, in a hospital, the job still on the phone. The hours had been too long for too long.`,
    homeless: `It ended at ${age} with the savings gone and the apartment lost, the job search still running.`,
    breakdown: `It ended at ${age}: months of burnout with no rest, until there was nothing left to give, and ${player.name.split(' ')[0]} could not go on.`,
    fire: `At ${age}, financially independent, ${player.name.split(' ')[0]} walked away from the ladder for good: a backpack, a one-way ticket, and no alarm clock.`,
  }[outcome?.kind] ?? '');

  return { verdict: careerVerdict(game, { peak, promotions: promotions.length, losses: losses.length, burnouts, moves }), paragraphs: paragraphs.filter(Boolean) };
}

/** A name for the shape of the career. */
export function careerVerdict(game, { peak, promotions, losses, burnouts, moves }) {
  const outcome = game.outcome?.kind;
  const top = game.industry.titles.length - 1;
  if (outcome === 'death') return 'The Hours Won';
  if (outcome === 'homeless') return 'The Fall';
  if (outcome === 'breakdown') return 'Running on Empty';
  if (outcome === 'fire') return 'Financially Independent';
  if (peak >= top) return 'To the Top';
  if (peak >= 5 && burnouts === 0) return 'The Steady Climber';
  if (peak >= 5) return 'The Hard Climb';
  if (losses >= 3) return 'The Survivor';
  if (moves >= 3) return 'The Wanderer';
  if (burnouts >= 2) return 'The Burnout Years';
  if (promotions === 0) return 'The Long Wait';
  return 'A Working Life';
}
