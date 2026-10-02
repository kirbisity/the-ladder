// The panels and dialogs: events, the quarter review, the org chart with
// its fog of war, performance, skills and life, help, and the end. Each
// returns HTML for the modal card; main.js wires the buttons.

import { RATING_LABELS, RATINGS, dailyCoreOutput, stagnationYears, projectSpec, projectsOpenTo, CORE, POLITICS } from '../sim/agent.js';
import { employedAgents, agentsAtLevel, TEAM_COUNT } from '../sim/org.js';
import { titleOf, formatMoney, netWorth, managerOf, teamHappiness, quarterlyExpenses, dryPowder, fmlaStatus, holidayStatus, employerIndustry, fireNumber, fireProgress, vitalsBreakdown } from '../sim/game.js';
import { careerSummary, careerSoFar } from '../sim/story.js';
import { SIM_RESULTS } from '../data/sim-results.js';
import { ADJUSTABLE, MAX_STEPS, adjustmentPoints, applyAdjustments } from '../sim/adjust.js';
import { startYearOf, payFactor, calendarYear } from '../sim/era.js';
import { drawPerson } from './figures.js';
import { PROJECTS, READINESS, INDUSTRY_STATS, ORG, TIME, MOTIVATION, RELATIONSHIP, CHARACTERS, INDUSTRIES, HOLIDAY, COMPANY_TIERS, MONEY, TIER_MIX, FACE_STYLES, DIFFICULTY, ERA } from '../config.js';

export function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
}

const RATING_COLORS = {
  greatlyExceeds: '#46b96b', exceeds: '#8fd36f', meetAll: '#f5c542', meetMost: '#f0a24a', meetSome: '#e5484d', onLeave: '#7d899c',
};

const portraitCache = new Map();

/** A head-and-shoulders portrait, drawn with the same features as the office and the cut scenes. */
export function portrait(look, size = 64) {
  const key = `${JSON.stringify(look)}|${size}`;
  if (!portraitCache.has(key) && typeof document !== 'undefined') {
    const ratio = 2;
    const canvas = document.createElement('canvas');
    canvas.width = size * ratio;
    canvas.height = size * ratio;
    const context = canvas.getContext('2d');
    context.scale(ratio, ratio);
    context.fillStyle = '#223047';
    context.beginPath();
    context.roundRect(0, 0, size, size, size * 0.22);
    context.fill();
    context.save();
    context.beginPath();
    context.roundRect(0, 0, size, size, size * 0.22);
    context.clip();
    // Head and shoulders: the figure scaled so the head fills the frame.
    drawPerson(context, size * 0.5, size * 3.38, size * 0.36, look, { pose: 'standing' });
    context.restore();
    portraitCache.set(key, canvas.toDataURL());
  }
  return `<img class="portrait" src="${portraitCache.get(key) ?? ''}" width="${size}" height="${size}" alt="">`;
}

export function figure(label, value) {
  return `<div class="figure"><span>${label}</span><strong>${value}</strong></div>`;
}

export function head(kicker, title, closable = true) {
  return `<div class="modal-head"><div><div class="modal-kicker">${kicker}</div><h2>${title}</h2></div>
    ${closable ? '<button class="modal-close" data-action="close-modal" aria-label="Close">×</button>' : ''}</div>`;
}

// ── Events ─────────────────────────────────────────────────────────────

export function eventPanel(game) {
  const current = game.currentEvent;
  const categoryNames = { macro: 'Corporate', interpersonal: 'Office politics', lifestyle: 'Life', industry: game.industry.name, arc: 'Follow-up', career: 'Career' };
  const choices = current.choices.map((choice, index) => `<button class="choice" data-choice="${index}">${escapeHtml(choice.label)}</button>`).join('');
  return `${head(categoryNames[current.event.category] ?? 'Event', escapeHtml(current.event.title), false)}
    <p class="lead">${escapeHtml(current.text)}</p>
    <div class="choices">${choices}</div>`;
}

// ── Quarter review ─────────────────────────────────────────────────────

export function reviewPanel(game, report) {
  const player = game.player;
  const checkIn = !report.unemployed && !report.review && !report.lostJob;
  const title = report.unemployed ? 'Out of work' : checkIn ? 'Check-in' : RATING_LABELS[report.rating] ?? 'Quarter closed';
  const ladder = report.rating && report.rating !== 'onLeave' ? ratingLadder(report.rating) : '';
  const figures = [];
  if (report.rank) figures.push(figure('Rank', `${report.rank} / ${report.poolSize}`));
  if (checkIn && report.checkInRank) figures.push(figure('Running rank', `${report.checkInRank} / ${report.checkInPool}`));
  if (report.performance !== undefined && report.median) figures.push(figure('Score vs median', `${Math.round(report.performance)} / ${Math.round(report.median)}`));
  figures.push(figure('Readiness', `${Math.round(player.readiness)} / ${READINESS.threshold}`));
  const cash = (report.income ?? 0) - (report.expenses ?? 0);
  figures.push(figure('Cash this quarter', `${cash >= 0 ? '+' : ''}${formatMoney(cash)}`));
  const notes = [];
  if (report.project) {
    notes.push(`<li class="${report.project.success ? 'good' : 'bad'}">${escapeHtml(report.project.name)}: ${report.project.success ? 'delivered' : `missed (${Math.round(report.project.progress * 100)}% done)`}.</li>`);
  }
  for (const note of report.notes) {
    const tone = /Promoted|granted|bonus|good word|closes|funded|offer|cleared/i.test(note) ? 'good'
      : /PIP|Leapfrog|let go|laid off|counselled|ER|denied|recession|undercuts|poorly|Layoffs/i.test(note) ? 'bad' : '';
    notes.push(`<li class="${tone}">${escapeHtml(note)}</li>`);
  }
  if (checkIn && report.nextReviewIn) {
    notes.unshift(`<li>No formal review this quarter: ${escapeHtml(game.org?.companyName ?? 'the company')} reviews every ${employerIndustry(game).reviewEvery} quarters. The next one, in ${report.nextReviewIn} quarter${report.nextReviewIn === 1 ? '' : 's'}, averages the whole period.</li>`);
  }
  const kicker = `Q${report.quarterOfYear} · Year ${report.year} ${checkIn ? 'check-in' : 'review'}`;
  return `${head(kicker, report.promoted ? `Promoted: ${escapeHtml(titleOf(game, player.level))}` : escapeHtml(title), false)}
    ${ladder}
    <div class="figures">${figures.join('')}</div>
    ${notes.length ? `<ul class="notes">${notes.join('')}</ul>` : '<p>A quiet quarter.</p>'}
    <div class="actions"><button class="button primary" data-action="review-continue">Next quarter</button></div>`;
}

function ratingLadder(current) {
  return `<div class="rating-ladder">${RATINGS.slice().reverse().map((rating) => `<div class="rating-step ${rating === current ? `current ${rating}` : ''}">${RATING_LABELS[rating]}</div>`).join('')}</div>`;
}

// ── Org chart ──────────────────────────────────────────────────────────

/**
 * The org as a tree: company, divisions, the player's division's
 * departments and teams. Visible: your chain up, your node, and the level
 * directly below it; informants un-grey more.
 */
export function buildOrgTree(game) {
  const org = game.org;
  const player = game.player;
  const teamsPerDepartment = 3;
  const company = { id: 'company', kind: 'company', name: org.companyName, children: [] };
  org.divisionNames.forEach((name, index) => {
    const division = { id: `division-${index}`, kind: 'division', name, children: [], simulated: index === org.divisionIndex, parent: company };
    company.children.push(division);
    if (!division.simulated) {
      division.stats = org.otherDivisions.find((entry) => entry.name === name);
      return;
    }
    for (let department = 0; department < TEAM_COUNT / teamsPerDepartment; department += 1) {
      const departmentNode = { id: `department-${department}`, kind: 'department', name: `${name} ${['North', 'Central', 'South'][department]}`, children: [], parent: division };
      division.children.push(departmentNode);
      for (let team = 0; team < teamsPerDepartment; team += 1) {
        const teamId = department * teamsPerDepartment + team;
        departmentNode.children.push({ id: `team-${teamId}`, kind: 'team', teamId, name: org.teamNames[teamId], children: [], parent: departmentNode });
      }
    }
  });
  const departmentOf = (teamId) => Math.floor(teamId / teamsPerDepartment);
  const playerNodeId = player.level <= 4 ? `team-${player.teamId}`
    : player.level === 5 ? `department-${departmentOf(player.teamId)}`
      : player.level === 6 ? `division-${org.divisionIndex}` : 'company';
  const all = [];
  (function collect(node) {
    all.push(node);
    node.children.forEach(collect);
  }(company));
  const byId = new Map(all.map((node) => [node.id, node]));
  const visible = new Set();
  let cursor = byId.get(playerNodeId);
  const playerNode = cursor;
  while (cursor) {
    visible.add(cursor.id);
    cursor = cursor.parent;
  }
  for (const child of playerNode.children) visible.add(child.id);
  // Informants reveal, in order: sibling teams, other departments, other divisions.
  const revealOrder = [];
  if (playerNode.parent) for (const sibling of playerNode.parent.children) revealOrder.push(sibling.id);
  for (const node of all) if (node.kind === 'department') revealOrder.push(node.id);
  for (const node of all) if (node.kind === 'team') revealOrder.push(node.id);
  for (const node of all) if (node.kind === 'division') revealOrder.push(node.id);
  let reveals = Math.floor(player.informants);
  for (const id of revealOrder) {
    if (reveals <= 0) break;
    if (visible.has(id)) continue;
    visible.add(id);
    reveals -= 1;
  }
  for (const node of all) node.visible = visible.has(node.id);
  playerNode.you = true;
  return { company, byId, playerNode, departmentOf };
}

function nodeAgents(game, node, departmentOf) {
  const agents = employedAgents(game.org);
  const divisionLevelFrom = 6;
  if (node.kind === 'team') return agents.filter((agent) => agent.level <= 4 && agent.teamId === node.teamId);
  if (node.kind === 'department') {
    const department = Number(node.id.split('-')[1]);
    return agents.filter((agent) => agent.level <= 5 && departmentOf(agent.teamId) === department);
  }
  if (node.kind === 'division' && node.simulated) return agents;
  if (node.kind === 'company') return agents.filter((agent) => agent.level >= divisionLevelFrom);
  return [];
}

export function nodeStats(game, node, departmentOf) {
  if (node.kind === 'division' && !node.simulated) {
    const stats = node.stats;
    return { headcount: stats.headcount, revenue: stats.revenue, happiness: stats.happiness, attrition: stats.attrition };
  }
  if (node.kind === 'company') {
    const own = nodeAgents(game, { kind: 'division', simulated: true }, departmentOf);
    const others = game.org.otherDivisions;
    const headcount = own.length + others.reduce((sum, entry) => sum + entry.headcount, 0);
    const revenue = own.reduce((sum, agent) => sum + (agent.quarter.performance || 80), 0) / 100 + others.reduce((sum, entry) => sum + entry.revenue, 0);
    return { headcount, revenue, happiness: 65, attrition: 0.12 };
  }
  const agents = nodeAgents(game, node, departmentOf);
  const headcount = agents.length;
  const happiness = agents.reduce((sum, agent) => sum + agent.motivation, 0) / Math.max(1, headcount);
  const revenue = agents.reduce((sum, agent) => sum + (agent.quarter.performance || 80), 0) / 100;
  const clock = game.org.clock ?? 0;
  const recent = game.org.departures.filter((entry) => clock - entry.clock < 4 && (node.kind !== 'team' || entry.teamId === node.teamId)
    && (node.kind !== 'department' || departmentOf(entry.teamId) === Number(node.id.split('-')[1])));
  return { headcount, revenue, happiness, attrition: recent.length / Math.max(1, headcount) };
}

export function orgPanel(game, tab = 'chart', selectedId = null) {
  if (!game.org) {
    return `${head('Org tree', 'Between jobs')}
      <p class="lead">No badge, no org chart. Raise the Open slider to widen the search; each quarter out of work makes the next offer harder to get.</p>`;
  }
  const tabs = `<div class="tabs"><button class="button small ${tab === 'chart' ? 'primary' : ''}" data-org-tab="chart">Org chart</button>
    <button class="button small ${tab === 'peers' ? 'primary' : ''}" data-org-tab="peers">Peer tracking</button>
    <button class="button small ${tab === 'ladder' ? 'primary' : ''}" data-org-tab="ladder">Career ladder</button></div>`;
  const body = tab === 'peers' ? peerTracking(game) : tab === 'ladder' ? careerLadder(game) : orgChart(game, selectedId);
  const tier = COMPANY_TIERS[game.org.tier];
  return `${head(`${escapeHtml(game.org.companyName)} · ${escapeHtml(tier?.name ?? '')} · ${escapeHtml(game.org.divisionNames[game.org.divisionIndex])}`, 'Org tree')}${tabs}${body}`;
}

/**
 * Every rung of this employer's ladder, top down: the title on each track,
 * the pay band, how many chairs are filled, and where you stand.
 */
export function careerLadder(game) {
  const industry = employerIndustry(game);
  const player = game.player;
  const fork = industry.trackFromLevel;
  const tier = COMPANY_TIERS[game.org.tier];
  const rows = [];
  for (let level = industry.seats.length - 1; level >= 0; level -= 1) {
    const seated = agentsAtLevel(game.org, level).length;
    const you = level === player.level;
    const management = titleOf(game, level, 'management');
    const expert = fork !== undefined && level > fork ? titleOf(game, level, 'expert') : null;
    const base = industry.salaries[level];
    const band = `${formatMoney(base)}–${formatMoney(base * MONEY.bandTop)}`;
    const titles = expert && expert !== management
      ? `<span class="${player.track === 'expert' ? 'muted' : ''}">${escapeHtml(management)}</span> <span class="track-or">or</span> <span class="${player.track === 'management' ? 'muted' : ''}">${escapeHtml(expert)}</span>`
      : escapeHtml(management);
    rows.push(`<tr class="${you ? 'you' : ''}"><td>${level + 1}</td><td>${titles}${you ? ' <strong>· you</strong>' : ''}${fork !== undefined && level === fork + 1 ? '<div class="fork-note">The fork: management or expert</div>' : ''}</td>
      <td>${band}</td><td>${seated} / ${industry.seats[level]}</td></tr>`);
  }
  const reviews = { 1: 'every quarter', 2: 'twice a year', 4: 'once a year' }[industry.reviewEvery] ?? `every ${industry.reviewEvery} quarters`;
  const track = player.track ? ` You are on the <strong>${player.track}</strong> track.` : '';
  return `<p class="explain"><strong>${escapeHtml(tier?.name ?? 'Company')}</strong> employer: ${escapeHtml(tier?.blurb ?? '')} Reviews ${reviews}.${track}</p>
    <div class="table-wrap"><table class="peer-table ladder-table"><thead><tr><th>#</th><th>Title</th><th>Pay band</th><th>Chairs</th></tr></thead>
    <tbody>${rows.join('')}</tbody></table></div>
    <p class="explain">A promotion needs readiness ${READINESS.threshold}, strong recent ratings and an empty chair; senior chairs often go to outside hires. Pay moves within the band with your standing, a few years behind it.</p>`;
}

function orgChart(game, selectedId) {
  const { company, byId, playerNode, departmentOf } = buildOrgTree(game);
  const division = company.children.find((node) => node.simulated);
  const nodeButton = (node) => {
    const label = node.kind === 'company' ? 'Company' : node.kind === 'division' ? 'Division' : node.kind === 'department' ? 'Dept' : 'Team';
    const stats = node.visible ? nodeStats(game, node, departmentOf) : null;
    const classes = ['org-node', node.visible ? '' : 'fog', node.you ? 'you' : '', node.id === selectedId ? 'selected' : ''].join(' ');
    return `<button class="${classes}" data-node="${node.id}" ${node.visible ? '' : 'disabled'}>
      <strong>${escapeHtml(node.name)}</strong>${label}${stats ? ` · ${stats.headcount}` : ' · ?'}${node.you ? ' · you' : ''}</button>`;
  };
  const rows = [
    `<div class="org-level">${nodeButton(company)}</div>`,
    '<div class="org-connector"></div>',
    `<div class="org-level">${company.children.map(nodeButton).join('')}</div>`,
    '<div class="org-connector"></div>',
    `<div class="org-level">${division.children.map(nodeButton).join('')}</div>`,
    '<div class="org-connector"></div>',
    `<div class="org-level">${division.children.flatMap((department) => department.children).map(nodeButton).join('')}</div>`,
  ];
  const selected = byId.get(selectedId ?? playerNode.id);
  let detail = '';
  if (selected && selected.visible) {
    const stats = nodeStats(game, selected, departmentOf);
    detail = `<div class="node-detail"><div class="figures">
      ${figure('Headcount', stats.headcount)}${figure('Revenue', `$${stats.revenue.toFixed(1)}M`)}
      ${figure('Happiness', `${Math.round(stats.happiness)}%`)}${figure('Attrition', `${Math.round(stats.attrition * 100)}%`)}
    </div></div>`;
  }
  const informants = Math.floor(game.player.informants);
  return `<div class="org-layout"><div class="org-tree">${rows.join('')}</div>${detail}</div>
    <p class="explain">You see your own chain and one level below you. ${informants > 0 ? `${informants} informant${informants > 1 ? 's' : ''} un-grey more.` : 'Cross-team networking and alliances recruit informants who un-grey the rest.'}</p>`;
}

function peerTracking(game) {
  const player = game.player;
  const days = Math.max(1, player.quarter.days);
  const pool = agentsAtLevel(game.org, player.level).map((agent) => ({
    agent,
    projected: agent.quarter.days ? (agent.quarter.core + agent.quarter.political) / Math.max(1, agent.quarter.days) * 12 : agent.lastPerformance ?? 0,
  })).sort((a, b) => b.projected - a.projected);
  const rows = pool.map((entry, index) => {
    const agent = entry.agent;
    const you = agent === player;
    const relation = you ? '' : agent.relationship >= RELATIONSHIP.loyalLine ? 'ally' : agent.relationship <= RELATIONSHIP.hostileLine ? 'enemy' : '';
    const rating = agent.lastRating ? RATING_LABELS[agent.lastRating] : '—';
    return `<tr class="${you ? 'you' : ''}"><td>${index + 1}</td><td>${escapeHtml(you ? `${agent.name} (you)` : agent.name)}</td><td>${agent.mbti}</td>
      <td>${Math.round(entry.projected)}</td><td>${rating}</td>
      <td>${you ? '' : `<span class="relation ${relation}">${agent.relationship > 0 ? '+' : ''}${Math.round(agent.relationship)}</span>`}</td></tr>`;
  }).join('');
  return `<p class="explain">Everyone at your level, ranked by ${days < 2 ? 'last quarter\'s score (this quarter has not started)' : 'this quarter\'s pace so far'}. The last column is their ledger with you: +40 is an ally who warns you; −40 is someone who will undercut you.</p>
    <div class="table-wrap"><table class="peer-table"><thead><tr><th>#</th><th>Name</th><th>Type</th><th>Score</th><th>Last rating</th><th>Ledger</th></tr></thead>
    <tbody>${rows}</tbody></table></div>`;
}

// ── Performance ────────────────────────────────────────────────────────

const EXPECTATIONS = [
  'Deliver what you are given, on time.',
  'Own features end to end without supervision.',
  'Lead projects and lift the people around you.',
  'Set technical or client direction for a group.',
  'Run a team: hire, coach, and hit the numbers.',
  'Own a department\'s results and its politics.',
  'Set strategy for a whole division.',
  'Answer to the board for the company.',
];

export function performancePanel(game) {
  const player = game.player;
  const industry = game.industry;
  const topLevel = industry.seats.length - 1;
  const nextTitle = player.level < topLevel ? titleOf(game, player.level + 1) : null;
  const readiness = Math.min(100, player.readiness / READINESS.threshold * 100);
  const dots = player.ratings.map((rating) => `<span title="${RATING_LABELS[rating]}" style="background:${RATING_COLORS[rating]}"></span>`).join('');
  const stagnation = stagnationYears(player);
  const chairsAbove = game.org && nextTitle ? agentsAtLevel(game.org, player.level + 1).length : 0;
  const notes = [];
  if (player.pip.active) notes.push('<li class="bad">PIP: one quarter to get out of the bottom bracket, or you are let go.</li>');
  if (stagnation > 0) notes.push(`<li class="bad">Stagnating: ${stagnation.toFixed(1)} years past the usual time at this level. It is eating your motivation.</li>`);
  if (industry.upOrOutQuarters && player.level < industry.upOrOutBelowLevel) {
    const left = industry.upOrOutQuarters - player.quartersAtLevel;
    notes.push(`<li class="${left <= 4 ? 'bad' : ''}">Up or out: ${left} quarter${left === 1 ? '' : 's'} left at this level.</li>`);
  }
  if (industry.tenureClockQuarters && player.level === industry.tenureFromLevel - 1) {
    notes.push(`<li>Tenure clock: ${industry.tenureClockQuarters - player.quartersAtLevel} quarters to review. Bar: readiness ${READINESS.threshold * 0.8} and ${INDUSTRY_STATS.citations.tenureCitationBar} citations.</li>`);
  }
  if (industry.contractQuarters && player.level === 0) notes.push(`<li>Postdoc contract: ${industry.contractQuarters - player.quartersAtLevel} quarters left.</li>`);
  if (player.tenured) notes.push('<li class="good">Tenured: no PIPs, no layoffs.</li>');
  return `${head('Performance', RATING_LABELS[player.lastRating] ?? 'Not yet rated')}
    ${ratingLadder(player.lastRating)}
    <p class="explain">Ratings are a percentile among everyone at your level: top 5% Greatly Exceeds, top 20% Exceeds, bottom 15% (and well behind) Meets Some, which is a PIP.</p>
    ${nextTitle ? `<div><div class="panel-heading"><h3>Promotion readiness</h3><span class="panel-figure">${Math.round(player.readiness)} / ${READINESS.threshold}</span></div>
      <div class="progress"><div style="width:${readiness}%"></div></div>
      <p>Next: <strong>${escapeHtml(nextTitle)}</strong>. ${EXPECTATIONS[player.level + 1]} Readiness comes from mentoring, networking and strong ratings, and you also need an empty chair: ${chairsAbove} of ${industry.seats[player.level + 1]} are filled now.</p></div>` : '<p class="lead">You are at the top. There is no next rung.</p>'}
    <div class="figures">${figure('Title', escapeHtml(titleOf(game, player.level)))}${figure('Years at level', (player.quartersAtLevel / 4).toFixed(1))}${figure('Manager alignment', `${Math.round(player.alignment * 100)}%`)}</div>
    ${dots ? `<div><div class="modal-kicker">Recent ratings</div><div class="history-dots">${dots}</div></div>` : ''}
    ${notes.length ? `<ul class="notes">${notes.join('')}</ul>` : ''}`;
}

// ── Skills and life ────────────────────────────────────────────────────

export function careerPanel(game, tab = 'profile') {
  const player = game.player;
  const character = game.character;
  const manager = managerOf(game);
  const allies = game.org ? employedAgents(game.org).filter((agent) => agent !== player && agent.relationship >= RELATIONSHIP.loyalLine).length : 0;
  const enemies = game.org ? employedAgents(game.org).filter((agent) => agent !== player && agent.relationship <= RELATIONSHIP.hostileLine).length : 0;
  const team = teamHappiness(game);
  const tabs = `<div class="tabs">${[['profile', 'Profile'], ['career', 'Chart'], ['money', 'Money']].map(([id, label]) => `<button class="button small ${tab === id ? 'primary' : ''}" data-career-tab="${id}">${label}</button>`).join('')}</div>`;
  const heading = head(`${character.mbti} · ${escapeHtml(character.archetype)}`, escapeHtml(player.name));
  if (tab === 'career') return `${heading}${tabs}${historyChart(game) || '<p class="explain">The chart fills in as the quarters go by.</p>'}`;
  if (tab === 'money') return `${heading}${tabs}${wealthChart(game) || '<p class="explain">The chart fills in as the quarters go by.</p>'}${moneyFacts(game)}`;
  return `${heading}${tabs}
    <div class="project-tile career-blurb" style="grid-template-columns:auto minmax(0,1fr)">${portrait(player.look, 64)}
      <div><p class="lead">${escapeHtml(character.blurb)}</p></div></div>
    <div class="figures">${figure('IQ', player.iq)}${figure('Political skill', player.pol)}${figure('Skill', Math.round(player.skill))}${figure('Informants', Math.floor(player.informants))}</div>
    <div class="figures">${figure('Salary', formatMoney(player.salary))}${figure('Savings', formatMoney(game.savings))}${figure('Home equity', formatMoney(game.homeEquity))}${figure('Earned so far', formatMoney(game.lifetimeEarnings))}</div>
    <div class="figures">${figure('Allies', allies)}${figure('Enemies', enemies)}${figure('Manager', manager ? escapeHtml(manager.name.split(' ')[0]) : '—')}${team !== null ? figure('Team mood', `${Math.round(team)}%`) : figure('Spending / qtr', formatMoney(quarterlyExpenses(game)))}</div>
    <p>${game.married ? 'Married' : 'Single'}${game.dependents ? `, ${game.dependents} child${game.dependents > 1 ? 'ren' : ''}` : ''}${game.homeEquity > 0 ? ', homeowner' : ', renting'}. Market: ${game.market}.</p>`;
}

/** The numbers behind the money chart: where pay sits in its band, and the FIRE number. */
function moneyFacts(game) {
  const player = game.player;
  const industry = employerIndustry(game);
  const facts = [figure('Net worth', formatMoney(netWorth(game))), figure('Spending / yr', formatMoney(quarterlyExpenses(game) * 4)), figure('FIRE number', formatMoney(fireNumber(game)))];
  if (game.employment.employed) {
    const base = industry.salaries[player.level];
    const position = Math.round((player.salary / base - 1) / (MONEY.bandTop - 1) * 100);
    facts.push(figure('Pay in band', `${Math.max(0, Math.min(100, position))}%`));
  }
  return `<div class="figures">${facts.join('')}</div>
    <p class="explain">Raises follow your standing in the stack rank toward a target in the band, a few years behind it. A slump never cuts pay, but it leaves you expensive for what you deliver, and that is who a layoff list finds first.</p>`;
}

/** Health, motivation and level over the career, as an SVG chart. */
export function historyChart(game) {
  const history = game.history;
  if (history.length < 2) return '';
  const width = 600;
  const height = 150;
  const pad = 6;
  const x = (index) => pad + index / (history.length - 1) * (width - 2 * pad);
  const y = (value) => height - pad - value / 100 * (height - 2 * pad);
  const path = (key) => history.map((entry, index) => `${index ? 'L' : 'M'}${x(index).toFixed(1)},${y(Math.max(0, Math.min(100, entry[key]))).toFixed(1)}`).join(' ');
  const levelPath = history.map((entry, index) => `${index ? 'L' : 'M'}${x(index).toFixed(1)},${y((entry.level + 1) / 8 * 100).toFixed(1)}`).join(' ');
  return `<div><div class="modal-kicker">Career so far: <span style="color:#5fd081">health</span> · <span style="color:#5c9bff">motivation</span> · <span style="color:#f4c542">level</span></div>
    <svg class="chart" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-label="Career chart">
      <rect width="${width}" height="${height}" rx="10" fill="rgba(255,255,255,0.04)"/>
      <path d="${path('health')}" fill="none" stroke="#5fd081" stroke-width="2" vector-effect="non-scaling-stroke"/>
      <path d="${path('motivation')}" fill="none" stroke="#5c9bff" stroke-width="2" vector-effect="non-scaling-stroke"/>
      <path d="${levelPath}" fill="none" stroke="#f4c542" stroke-width="3" vector-effect="non-scaling-stroke"/>
    </svg></div>`;
}

/**
 * Money over the career: net worth (area) and salary (line), each on its own
 * scale with its peak labelled, so a modest salary still reads next to a
 * large net worth.
 */
export function wealthChart(game) {
  const history = game.history.filter((entry) => entry.netWorth !== undefined);
  if (history.length < 2) return '';
  const width = 600;
  const height = 150;
  const pad = 8;
  const top = 18;
  const x = (index) => pad + index / (history.length - 1) * (width - 2 * pad);
  const worthValues = history.map((entry) => entry.netWorth);
  const fireValues = history.map((entry) => entry.fire ?? 0);
  const worthMax = Math.max(1, ...worthValues, ...fireValues);
  const worthMin = Math.min(0, ...worthValues);
  const salaryMax = Math.max(1, ...history.map((entry) => entry.salary ?? 0));
  const yWorth = (value) => height - pad - (value - worthMin) / (worthMax - worthMin) * (height - pad - top);
  const ySalary = (value) => height - pad - value / salaryMax * (height - pad - top);
  const worthLine = history.map((entry, index) => `${index ? 'L' : 'M'}${x(index).toFixed(1)},${yWorth(entry.netWorth).toFixed(1)}`).join(' ');
  const worthArea = `${worthLine} L${x(history.length - 1).toFixed(1)},${yWorth(0).toFixed(1)} L${x(0).toFixed(1)},${yWorth(0).toFixed(1)} Z`;
  const fireLine = history.map((entry, index) => `${index ? 'L' : 'M'}${x(index).toFixed(1)},${yWorth(entry.fire ?? 0).toFixed(1)}`).join(' ');
  const salaryLine = history.map((entry, index) => `${index ? 'L' : 'M'}${x(index).toFixed(1)},${ySalary(entry.salary ?? 0).toFixed(1)}`).join(' ');
  const last = history[history.length - 1];
  return `<div><div class="modal-kicker">Money: <span style="color:#46b96b">net worth</span> (peak ${formatMoney(worthMax)}, now ${formatMoney(last.netWorth)}) · <span style="color:#f4c542">salary</span> (peak ${formatMoney(salaryMax)}, now ${last.salary ? formatMoney(last.salary) : 'none'}) · <span style="color:#c78bff">FIRE number</span></div>
    <svg class="chart" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-label="Net worth and salary over the career">
      <rect width="${width}" height="${height}" rx="10" fill="rgba(255,255,255,0.04)"/>
      ${worthMin < 0 ? `<line x1="${pad}" x2="${width - pad}" y1="${yWorth(0).toFixed(1)}" y2="${yWorth(0).toFixed(1)}" stroke="rgba(255,255,255,0.25)" stroke-dasharray="4 4" vector-effect="non-scaling-stroke"/>` : ''}
      <path d="${worthArea}" fill="rgba(70,185,107,0.25)" stroke="none"/>
      <path d="${worthLine}" fill="none" stroke="#46b96b" stroke-width="2" vector-effect="non-scaling-stroke"/>
      <path d="${fireLine}" fill="none" stroke="#c78bff" stroke-width="2" stroke-dasharray="6 4" vector-effect="non-scaling-stroke"/>
      <path d="${salaryLine}" fill="none" stroke="#f4c542" stroke-width="2.5" vector-effect="non-scaling-stroke"/>
    </svg></div>`;
}

// ── Money popup and the FIRE tracker ───────────────────────────────────

/** Click the money: the net worth and salary history, and how close FIRE is. */
export function moneyPanel(game) {
  const progress = fireProgress(game);
  const ready = progress.worth >= progress.number;
  const pace = progress.projectedAge === null
    ? 'At the pace of the last two years you would not get there by 70.'
    : ready ? 'You are there: the game will offer you the door.'
      : `At the pace of the last two years: about age ${Math.round(progress.projectedAge)}.`;
  const player = game.player;
  return `${head('Money', `${escapeHtml(formatMoney(progress.worth))} net worth`)}
    ${wealthChart(game) || '<p class="explain">The chart fills in as the quarters go by.</p>'}
    <div class="fire-tracker">
      <div class="panel-heading"><h3>Financial independence</h3><span class="panel-figure">${Math.round(progress.share * 100)}%</span></div>
      <div class="progress fire"><div style="width:${progress.share * 100}%"></div></div>
      <p>Your FIRE number is <strong>${escapeHtml(formatMoney(progress.number))}</strong> at ${Math.floor(player.age)}: what your retired life would cost, for as many years as you may have left (25 years of it at 60, more the earlier you go). ${pace}</p>
    </div>
    <div class="figures">${[
      figure('Net worth', formatMoney(progress.worth)),
      figure('FIRE number', formatMoney(progress.number)),
      figure('Still to save', formatMoney(Math.max(0, progress.number - progress.worth))),
      figure('Saved a year', `${progress.annualGain >= 0 ? '+' : '−'}${formatMoney(Math.abs(progress.annualGain))}`),
    ].join('')}</div>
    ${game.married && game.partner ? `<p class="explain">You are saving as a household: ${escapeHtml(game.partner.name.split(' ')[0])}'s pay, their share of living costs and the children are all in these numbers, so the FIRE number covers both of you.</p>` : ''}
    <p class="explain">When you reach it you can retire, which ends the career as a win, or keep working. A startup that sells, or a stock that soars, can get you there overnight.</p>`;
}

// ── Vitals popup ───────────────────────────────────────────────────────

function signed(value) {
  const rounded = Math.round(value * 10) / 10;
  return `${rounded > 0 ? '+' : rounded < 0 ? '−' : ''}${Math.abs(rounded).toFixed(rounded % 1 === 0 ? 0 : 1)}`;
}

function describeSensitivity(sensitivity) {
  if (sensitivity <= 0.6) return 'a gentle workplace for age';
  if (sensitivity < 0.95) return 'a steady workplace; age bites a little less';
  if (sensitivity < 1.15) return 'a typical workplace for age';
  return 'a hard-driving workplace; age bites harder';
}

/**
 * What moves a bar. Each bar drifts toward a target made of the listed
 * terms; age lowers the target, makes long days cost more, and, for mood,
 * softens bad news. The last events that moved either bar are listed.
 */
export function vitalsPanel(game, tab = 'health') {
  const vitals = vitalsBreakdown(game);
  if (tab === 'events') return vitalsEvents(game, vitals);
  const bar = vitals[tab];
  const tabs = `<div class="tabs">${[['health', 'Health'], ['motivation', 'Motivation'], ['events', 'Events']].map(([id, label]) => `<button class="button small ${tab === id ? 'primary' : ''}" data-vitals-tab="${id}">${label}</button>`).join('')}</div>`;
  const rows = bar.terms.map((term, index) => `<tr class="${term.value < 0 ? 'bad' : index === 0 ? '' : 'good'}"><td>${escapeHtml(term.label)}</td><td>${signed(term.value)}</td></tr>`).join('');
  const heading = tab === 'health' ? 'Health' : 'Motivation';
  const ageNote = tab === 'health'
    ? `Age costs you ${Math.max(0, bar.ageCost).toFixed(1)} points of health target today, and a long day hurts ${Math.round((vitals.strainFactor - 1) * 100)}% more than it did at 35. The longest day your body can sustain is about <strong>${vitals.comfortableHours} hours</strong>.`
    : `Age costs you ${Math.max(0, bar.ageCost).toFixed(1)} points of mood target today: enthusiasm mellows, and long days drain more. But bad news lands softer: <strong>${Math.round(vitals.resilience * 100)}%</strong> of its size now, down from 100% at 30.`;
  return `${head(`${heading}: ${Math.round(bar.value)}%`, `Where ${heading.toLowerCase()} is headed`)}${tabs}
    <p class="lead">It drifts toward <strong>${Math.round(bar.target)}%</strong>${bar.value > bar.target ? ' (slowly, when it is falling)' : tab === 'health' ? ', and recovers faster than it wears' : ''}. At age ${Math.floor(vitals.age)} you are in ${describeSensitivity(vitals.sensitivity)}.</p>
    <div class="table-wrap"><table class="peer-table vitals-table"><tbody>${rows}<tr class="total"><td>Target</td><td>${Math.round(bar.target)}</td></tr></tbody></table></div>
    <p class="explain">${ageNote}</p>`;
}

/** The events that last moved either bar, and how age softens their blows. */
function vitalsEvents(game, vitals) {
  const tabs = `<div class="tabs">${[['health', 'Health'], ['motivation', 'Motivation'], ['events', 'Events']].map(([id, label]) => `<button class="button small ${id === 'events' ? 'primary' : ''}" data-vitals-tab="${id}">${label}</button>`).join('')}</div>`;
  const log = vitals.log.length
    ? vitals.log.map((entry) => {
      const parts = [];
      if (entry.health) parts.push(`health ${signed(entry.health)}`);
      if (entry.motivation) parts.push(`motivation ${signed(entry.motivation)}`);
      return `<li class="${entry.health < 0 || entry.motivation < 0 ? 'bad' : ''}"><span>${escapeHtml(entry.label)}</span><em>age ${Math.floor(entry.age)} · ${parts.join(', ')}</em></li>`;
    }).join('')
    : '<li><span>Nothing yet: events that move your health or mood are listed here.</span></li>';
  return `${head('Events', 'What moved the bars')}${tabs}
    <ul class="notes vitals-log">${log}</ul>
    <p class="explain">Bad news to your mood lands at <strong>${Math.round(vitals.resilience * 100)}%</strong> of its size at your age (100% until 30). Illness, accidents and a body that has aged hit health at full size.</p>`;
}

/** The age button: the career so far, told in plain sentences. */
export function journeyPanel(game) {
  const progress = fireProgress(game);
  const { headline, paragraphs } = careerSoFar(game, { worth: progress.worth, fireShare: progress.share });
  return `${head(`Age ${Math.floor(game.player.age)} · ${calendarYear(game)}`, headline)}
    <div class="story-body">${paragraphs.map((text) => `<p>${escapeHtml(text)}</p>`).join('')}</div>`;
}

// ── Project picker ─────────────────────────────────────────────────────

export function availableProjects(game) {
  return projectsOpenTo(game.player, game.industry).map((project) => project.id);
}

/** Share of a project this plan would finish in a quarter, at today's state. */
export function projectedCompletion(game, projectId) {
  const player = game.player;
  const project = projectSpec(projectId, game.industry);
  if (!project) return 0;
  const context = { industry: game.industry, outputModifier: game.flags.outputModifier };
  if (project.usesCitizenship) {
    return TIME.daysPerQuarter * totalBandwidthShare(player, 1) / project.effort;
  }
  return TIME.daysPerQuarter * dailyCoreOutput(player, context) / PROJECTS.standardDayOutput / project.effort;
}

function totalBandwidthShare(player, index) {
  const hours = Math.min(player.plan.hours, 8) + 0.75 * Math.max(0, player.plan.hours - 8);
  const iq = 1 + (player.iq - 100) / 200;
  return hours * iq * Math.sqrt(Math.max(0, player.health) / 100) * Math.pow(Math.max(0, player.motivation) / 100, 0.3) * player.plan.shares[index] * (player.burnout.active ? 0.5 : 1);
}

export function projectPanel(game) {
  const current = game.player.plan.project;
  const open = new Set(availableProjects(game));
  const landing = Math.round(Math.min(1, PROJECTS.riskyLanding * (game.player.traits.moonshotLanding ?? 1)) * 100);
  const locked = game.industry.projects.filter((project) => !open.has(project.id))
    .map((project) => `${escapeHtml(project.name)} (at ${escapeHtml(titleOf(game, project.unlockLevel))})`);
  const rows = game.industry.projects.filter((project) => open.has(project.id)).map((project) => {
    const odds = Math.min(1, projectedCompletion(game, project.id));
    const risk = project.risky ? `<span class="tag hot">Lands ${landing}% if done</span>` : '';
    const runsOn = project.usesCitizenship ? '<span class="tag blue">Mentoring</span>' : '';
    return `<button class="choice" data-project="${project.id}" ${project.id === current ? 'style="border-color:#5f9bff"' : ''}>
      <span class="choice-line"><span>${escapeHtml(project.name)}</span>
      <span class="tag-row"><span class="tag ${project.impact === 'high' ? 'hot' : project.impact === 'medium' ? 'warn' : 'blue'}">Impact: ${project.impact}</span>${risk}${runsOn}
      <span class="tag pace ${odds >= 1 ? 'good' : 'bad'}">On pace: ${Math.round(odds * 100)}%</span></span></span>
      <span class="choice-blurb">${escapeHtml(project.blurb ?? '')}</span></button>`;
  }).join('');
  return `${head(`${escapeHtml(game.industry.name)} · this quarter's project`, 'Project selection')}
    <p class="explain">Finishing it by the deadline lifts your review; missing it costs you. "On pace" is how much your current plan would get done this quarter.</p>
    <div class="choices project-choices">${rows}</div>
    ${locked.length ? `<p class="locked-line">Later: ${locked.join(' · ')}</p>` : ''}`;
}

// ── Help ───────────────────────────────────────────────────────────────

export const HELP_PAGES = [
  { title: 'The turn', items: [
    'Each turn is a quarter: 60 workdays. Set your plan, press Start, and watch the days run. You can change sliders while the clock runs.',
    'At the end of each quarter you are reviewed against everyone at your level, paid, and maybe promoted.',
    'Events arrive between quarters. Your choices change your relationships, your health and your future.',
  ] },
  { title: 'Bandwidth and hours', items: [
    'Daily bandwidth = hours × IQ × √health × motivation^0.3. Split it four ways: Delivery, Mentoring, Networking, Recovery.',
    'Delivery drives your review. Mentoring and Networking build promotion readiness and relationships. Recovery protects health and teaches skill.',
    'Long hours buy output now and cost health and motivation later. Past about 12 hours a day, the cost wins.',
  ] },
  { title: 'Climbing', items: [
    'A promotion needs two things at once: readiness of 100, and an empty chair above you.',
    'Readiness without a chair fades. Peers want the same chairs; someone junior jumping past you hurts.',
    'Past the fork you choose a track: management (judged more and more on influence and your team) or expert (judged on your own work). The Org tree\'s Career ladder shows both.',
    'Raises follow your standing a few years behind it, and are never cut. Paid more than your recent work is worth, you are first on a layoff list unless someone above vouches for you.',
  ] },
  { title: 'Employers', items: [
    'You choose the kind of employer for your first job; later offers come from the whole market. High-growth companies review every quarter, PIP the most and pay the most; established ones review twice a year; steady ones once, with fewer PIPs and more politics.',
    'Startups pay less plus equity: most fold, a few sell. Companies drift between tiers over the years.',
    'Higher tiers lose people their jobs more often, and reach financial independence sooner. A smaller employer may round your title up; a bigger one may down-level you.',
    'The Dedicated–Open slider trades focus and layoff protection for recruiter calls and a faster job search.',
  ] },
  { title: 'Age', items: [
    'Past 35 the body and mood fade: the same long day costs more, and the mood you settle at falls. Click the health or motivation bar to see exactly why.',
    'But bad news lands softer each year: older people shrug off blows to their mood that would have flattened them at 25.',
    'It varies by workplace: a university is gentle on age; high-growth tech and finance grind people down, and push older people out.',
    'Autopilot runs whole quarters on your last plan and answers events as you last did. It asks only about kinds of events it has not seen, and stops for burnout, a PIP or a lost job.',
  ] },
  { title: 'Burnout and time off', items: [
    'Motivation under 20% is burnout: the screen greys, bandwidth halves, and productivity drains toward nothing as motivation falls.',
    'Put Recovery at 35% or more and it counts as sick leave (no rating, no PIP), and the more you rest the faster you climb back.',
    'Time off: holidays of one, two or four weeks (15 paid days a year), or after a year with an employer, FMLA: twelve unpaid, job-protected weeks.',
  ] },
  { title: 'How it ends', items: [
    'Retire at 62 with the highest title and the most wealth you can, and read the story of your career.',
    'Or retire early: once your net worth covers your retired spending for life (the FIRE number: about 25 years of it at 60, more the earlier you go), the game offers you the door. Click the money to track it. High-growth tech can get you there by 35, steady tech by 50, a university rarely.',
    'Health at zero is death. Out of work, a long search costs more than money: stress and illness, a strained marriage, and, past the debt you can carry, homelessness.',
    'Motivation at zero is a breakdown, but the last 10% resists: only a long stretch of burnout with no rest gets you there.',
  ] },
];

export function helpPanel(page) {
  const entry = HELP_PAGES[page];
  const dots = HELP_PAGES.map((_, index) => `<span class="${index === page ? 'on' : ''}"></span>`).join('');
  return `${head(`How to play · ${page + 1} / ${HELP_PAGES.length}`, entry.title)}
    <div class="help-page"><ul>${entry.items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div>
    <div class="pager"><button class="button small" data-help="${page - 1}" ${page === 0 ? 'disabled' : ''}>Back</button>
      <div class="pager-dots">${dots}</div>
      ${page < HELP_PAGES.length - 1 ? `<button class="button small primary" data-help="${page + 1}">Next</button>` : '<button class="button small primary" data-action="close-modal">Got it</button>'}</div>`;
}

// ── Time off ───────────────────────────────────────────────────────────

export function timeOffPanel(game) {
  const holiday = holidayStatus(game);
  const fmla = fmlaStatus(game);
  const options = HOLIDAY.options.map((days) => {
    const paid = game.employment.employed ? Math.min(days, holiday.paidLeft) : 0;
    const unpaid = game.employment.employed ? days - paid : 0;
    const label = { 5: 'A week away', 10: 'Two weeks away', 20: 'A month away' }[days];
    const detail = game.employment.employed
      ? `${unpaid ? `${unpaid} unpaid days · ` : 'Paid time off · '}travel ${formatMoney(days * HOLIDAY.costPerDay)}${days > 10 ? ' · your manager will notice' : ''}`
      : `Travel ${formatMoney(days * HOLIDAY.costPerDay)} · the job search slows`;
    return `<button class="choice" data-action="holiday" data-days="${days}" ${holiday.allowed ? '' : 'disabled'}>
      <span class="choice-line"><span>${label}</span><span class="tag ${unpaid ? 'warn' : 'good'}">${days} workdays</span></span>
      <span class="choice-blurb">${escapeHtml(detail)}</span></button>`;
  }).join('');
  return `${head('Recovery', 'Time off')}
    <p class="lead">${escapeHtml(holiday.reason)}</p>
    <div class="choices">${options}
      <button class="choice" data-action="fmla" ${fmla.eligible ? '' : 'disabled'}>
        <span class="choice-line"><span>FMLA leave</span><span class="tag blue">60 workdays</span></span>
        <span class="choice-blurb">${escapeHtml(fmla.reason)}</span></button>
    </div>
    <p class="explain">Days away recover health and motivation faster than resting at your desk. You are rated on the days you work; a month or more away counts as leave.</p>`;
}

// ── Settings ───────────────────────────────────────────────────────────

/** The simulation behind every character's rating: difficulty, best ladder, and reach and ruin in each industry. */
function simulationTable() {
  const rows = charactersByDifficulty().map((character) => {
    const result = SIM_RESULTS.characters[character.id];
    if (!result) return '';
    const cells = Object.keys(INDUSTRIES).map((industry) => {
      const row = result.industries[industry];
      const heat = Math.min(1, row.reach / 1.2);
      return `<td style="background:rgba(70,185,107,${(0.08 + heat * 0.5).toFixed(2)})" title="Reach Director/VP ${Math.round(row.reach * 100)}% · management ${Math.round(row.management * 100)}% · expert ${Math.round(row.expert * 100)}% · ruin ${Math.round(row.ruin * 100)}% · retires early at ${row.fireAge ?? '-'}">${Math.round(row.reach * 100)}%${row.ruin >= 0.05 ? `<small class="ruin"> ✕${Math.round(row.ruin * 100)}%</small>` : ''}</td>`;
    }).join('');
    return `<tr><td><strong>${escapeHtml(character.name)}</strong><br>${difficultyBadge(character.difficulty)}</td><td>${result.index.toFixed(2)}</td><td>${TRACK_NAMES[result.fit.track].replace(' ladder', '')}</td>${cells}</tr>`;
  }).join('');
  return `<div class="modal-kicker">Character simulation · ${SIM_RESULTS.careers} careers per cell</div>
    <div class="table-wrap"><table class="peer-table sim-table"><thead><tr><th>Character</th><th>Index</th><th>Best ladder</th>${Object.keys(INDUSTRIES).map((id) => `<th>${{ tech: 'Tech', consulting: 'Consulting', privateEquity: 'Private equity', academia: 'Academia' }[id] ?? id}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>
    <p class="explain">Cells show the share of careers reaching Director or VP in that industry; ✕ marks the share ending in breakdown or homelessness when played at a fixed pace. Hover a cell for the management and expert ladders. Index is 0 (easy) to 1 (brutal).</p>`;
}

export function settingsPanel(settings, soundOn, endScenes, interimScenes) {
  const sceneButtons = (scenes) => Object.entries(scenes)
    .map(([id, label]) => `<button class="button small" data-scene="${id}">${escapeHtml(label)}</button>`).join('');
  return `${head('Menu', 'Settings')}
    <div class="settings-rows">
      <div class="settings-row"><span>Sound</span><button class="button small" data-action="sound">${soundOn ? 'On' : 'Off'}</button></div>
      <div class="settings-row"><span>Music for big moments</span><button class="button small" data-action="toggle-music">${settings.music !== false ? 'On' : 'Off'}</button></div>
      <div class="settings-row"><span>Cut scenes for big moments</span><button class="button small" data-action="toggle-cutscenes">${settings.cutscenes ? 'On' : 'Off'}</button></div>
    </div>
    <details class="developer"><summary>Developer</summary>
      <div class="developer-body">
        ${simulationTable()}
        <p class="explain">Replay any cut scene with the current character. Nothing in the career changes.</p>
        <div class="modal-kicker">Endings</div>
        <div class="scene-grid">${sceneButtons(endScenes)}</div>
        <div class="modal-kicker">Moments</div>
        <div class="scene-grid">${sceneButtons(interimScenes)}</div>
      </div>
    </details>`;
}

export function menuPanel(hasGame) {
  return `${head('Paused', 'Menu')}
    <div class="choices">
      ${hasGame ? '<button class="choice" data-action="close-modal">Resume</button>' : ''}
      <button class="choice" data-action="help">How to play</button>
      <button class="choice" data-action="settings">Settings</button>
      ${hasGame ? '<button class="choice" data-action="save-quit">Save and return to title</button>' : ''}
      <button class="choice" data-action="new-career">Start a new career</button>
    </div>`;
}

// ── The end ────────────────────────────────────────────────────────────

const OUTCOMES = {
  retired: { title: 'Retirement', line: (game, outcome) => `At ${Math.floor(outcome.age)} you hand in your badge. The highest chair you held: ${outcome.title}.` },
  death: { title: 'Death', line: (game, outcome) => outcome.cause === 'cancer' ? `Cancer took you at ${Math.floor(outcome.age)}, after a long fight. The ${game.industry.name.toLowerCase()} world sent flowers.` : `Your heart gave out at ${Math.floor(outcome.age)}. The ${game.industry.name.toLowerCase()} world sent flowers and posted the role the next week.` },
  breakdown: { title: 'Breakdown', line: (game, outcome) => `At ${Math.floor(outcome.age)} you could not go on. Burnout ran on with no rest until nothing was left.` },
  fire: { title: 'Financial independence', line: (game, outcome) => `At ${Math.floor(outcome.age)} you walk away from the ladder with ${formatMoney(outcome.netWorth)} and a one-way ticket.` },
  homeless: { title: 'Homeless', line: (game, outcome) => `At ${Math.floor(outcome.age)} the savings ran out before the job search did. You lost the apartment.` },
};

// Three paragraphs a page keeps the story readable without scrolling, even
// on a phone.
const STORY_PARAGRAPHS_PER_PAGE = 3;

export function storyPageCount(game) {
  return Math.ceil(careerSummary(game).paragraphs.length / STORY_PARAGRAPHS_PER_PAGE);
}

/** The career story, a page at a time. */
export function storyPanel(game, page) {
  const story = careerSummary(game);
  const pages = Math.ceil(story.paragraphs.length / STORY_PARAGRAPHS_PER_PAGE);
  const shown = story.paragraphs.slice(page * STORY_PARAGRAPHS_PER_PAGE, (page + 1) * STORY_PARAGRAPHS_PER_PAGE);
  const dots = Array.from({ length: pages }, (_, index) => `<span class="${index === page ? 'on' : ''}"></span>`).join('');
  return `${head(`Your story · ${page + 1} / ${pages}`, escapeHtml(story.verdict), false)}
    <div class="story">${shown.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('')}</div>
    <div class="pager"><button class="button small" data-story="${page - 1}">${page === 0 ? 'Summary' : 'Back'}</button>
      <div class="pager-dots">${dots}</div>
      ${page < pages - 1 ? `<button class="button small primary" data-story="${page + 1}">Next</button>` : '<button class="button small primary" data-story="-1">Finish</button>'}</div>`;
}

/** The ending's title and one-line telling, for the end panel and the shareable page. */
export function outcomeText(game) {
  const entry = OUTCOMES[game.outcome.kind];
  return { title: entry.title, line: entry.line(game, game.outcome) };
}

export function gameOverPanel(game) {
  const outcome = game.outcome;
  const entry = OUTCOMES[outcome.kind];
  const verdict = careerSummary(game).verdict;
  const support = outcome.kind === 'breakdown'
    ? '<p class="support">This is a game. If work is wearing you down in real life, please talk to someone: in the US call or text 988; elsewhere, findahelpline.com lists free, confidential lines.</p>'
    : '';
  return `${head(outcome.kind === 'retired' ? 'Career complete' : 'Career over', entry.title, false).replace('<h2>', '<h2 class="outcome-title">')}
    <p class="lead">${escapeHtml(entry.line(game, outcome))}</p>
    <div class="figures">${figure('Highest title', escapeHtml(outcome.title))}${figure('Net worth', formatMoney(outcome.netWorth))}${figure('Earned', formatMoney(outcome.lifetimeEarnings))}${figure('Score', outcome.score.toLocaleString())}</div>
    ${historyChart(game)}
    ${support}
    <div class="actions"><button class="button primary" data-story="0">Read your story: ${escapeHtml(verdict)}</button>
      <button class="button" data-action="share-story">Show my shareable page</button>
      <button class="button" data-action="same-again">Same person again</button><button class="button" data-action="new-career">New career</button></div>`;
}

const DIFFICULTY_NOTES = {
  1: 'In our simulations this person reaches Director or higher in most careers, and often VP.',
  2: 'Reaches Director or higher in many careers, if they play to their strengths and watch their health.',
  3: 'Director is possible in the right field with care; VP is rare, and the wrong field is a struggle.',
  4: 'A steady, stable life almost anywhere. The top chairs are a long shot.',
  5: 'The hardest climb: a few thrive in just the right role, but many careers end badly without careful rest.',
};

/** Five dots and a word: how hard this character\'s climb is, from simulation (1 easy to 5 brutal). */
export function difficultyBadge(level) {
  const pips = [1, 2, 3, 4, 5].map((pip) => `<i class="${pip <= level ? 'on' : ''}"></i>`).join('');
  return `<span class="difficulty d${level}" title="${escapeHtml(DIFFICULTY_NOTES[level])}"><span class="pips">${pips}</span>${DIFFICULTY.labels[level]}</span>`;
}

const TRACK_NAMES = { management: 'Management ladder', expert: 'Expert ladder', hybrid: 'Either ladder' };

/** Where a character does best, from the simulation: the ladder (management or expert) and the field. */
function bestFit(characterId) {
  const result = SIM_RESULTS.characters[characterId];
  if (!result) return null;
  return { track: TRACK_NAMES[result.fit.track], industry: INDUSTRIES[result.fit.bestIndustry]?.name ?? result.fit.bestIndustry, worst: INDUSTRIES[result.fit.worstIndustry]?.name ?? result.fit.worstIndustry };
}

/** The selection screens go by first name only; the surname initial is for the story. */
const firstNameOf = (character) => character.name.split(' ')[0];

/** The roster, easiest climb first. */
export function charactersByDifficulty() {
  return [...CHARACTERS].sort((a, b) => (a.difficultyIndex ?? a.difficulty / 5) - (b.difficultyIndex ?? b.difficulty / 5));
}

/** Compact cards for the roster; clicking one opens that character's stats page. */
export function characterCards() {
  return charactersByDifficulty().map((character) => `<button class="pick-card character" data-character="${character.id}">
    ${portrait(character.look, 64)}
    <h3>${escapeHtml(firstNameOf(character))}</h3>
    <div class="tag-row"><span class="tag blue">${character.mbti}</span><span class="tag">IQ ${character.iq}</span><span class="tag">Pol ${character.pol}</span>${bestFit(character.id) ? `<span class="tag good">${bestFit(character.id).track.replace(' ladder', '')}</span>` : ''}</div>
    <p class="archetype">${escapeHtml(character.archetype)}</p>
    ${difficultyBadge(character.difficulty)}
  </button>`).join('');
}

function ratioWord(ratio) {
  if (ratio >= 1.6) return 'far above average';
  if (ratio >= 1.15) return 'above average';
  if (ratio >= 0.87) return 'average';
  if (ratio >= 0.6) return 'below average';
  return 'far below average';
}

/** One stat as a bar (1 = average, at the tick) with its plain-words reading. */
function statRow(label, ratio, detail = '') {
  const width = Math.max(4, Math.min(100, ratio / 2.5 * 100));
  return `<div class="stat-row"><div class="stat-top"><span>${label}</span><strong>${ratioWord(ratio)}</strong></div>
    <div class="stat-bar"><div style="width:${width}%"></div><i style="left:${1 / 2.5 * 100}%"></i></div>${detail ? `<small>${detail}</small>` : ''}</div>`;
}

// Intelligence and political skill, drawn on a wide scale so the differences between the cast are
// visible: the bar runs from an ordinary person to the far end of the cast, and the ticks mark the
// average person and the typical colleague at work.
const WIDE_SCALES = {
  iq: { low: 100, high: 155, marks: [[100, 'average person'], [130, 'typical colleague']] },
  pol: { low: 50, high: 150, marks: [[100, 'typical colleague']] },
};

function iqWord(iq) {
  if (iq >= 148) return 'exceptional';
  if (iq >= 140) return 'far above average';
  if (iq >= 130) return 'well above average';
  return 'above average';
}

function polWord(pol) {
  if (pol >= 135) return 'exceptional';
  if (pol >= 115) return 'far above average';
  if (pol >= 100) return 'above average';
  if (pol >= 85) return 'a little below a typical colleague';
  return 'well below a typical colleague';
}

/** Share of ordinary people at or above this IQ, from a normal curve of mean 100 and spread 15. */
function iqTopShare(iq) {
  const z = (iq - 100) / 15;
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const tail = 0.3989423 * Math.exp(-z * z / 2) * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  const share = z >= 0 ? tail : 1 - tail;
  return share < 0.001 ? `1 in ${Math.round(1 / share).toLocaleString('en-US')}` : `top ${(share * 100).toFixed(share < 0.01 ? 1 : 0)}%`;
}

function wideRow(label, value, scale, word, detail) {
  const width = Math.max(3, Math.min(100, (value - scale.low) / (scale.high - scale.low) * 100));
  const ticks = scale.marks.map(([at, name]) => `<i style="left:${(at - scale.low) / (scale.high - scale.low) * 100}%" title="${name}"></i>`).join('');
  const marks = scale.marks.map(([at, name]) => {
    const left = (at - scale.low) / (scale.high - scale.low) * 100;
    return `<span style="left:${left}%${left < 8 ? ';transform:none' : ''}">${name}</span>`;
  }).join('');
  return `<div class="stat-row wide"><div class="stat-top"><span>${label}</span><strong>${value} · ${word}</strong></div>
    <div class="stat-bar wide"><div style="width:${width}%"></div>${ticks}</div><div class="stat-marks">${marks}</div><small>${detail}</small></div>`;
}

/** Everything about a character: stats, traits, quirks, difficulty, and the button that begins. */
export function characterProfile(characterId, faceStyle = null, adjust = {}, birthYear = ERA.defaultBirthYear) {
  const base = CHARACTERS.find((entry) => entry.id === characterId);
  if (!base) return '';
  // The numbers shown are the character's with the player's small adjustments applied.
  const adjusted = applyAdjustments(base, adjust);
  const character = { ...base, iq: adjusted.iq, pol: adjusted.pol };
  const t = adjusted.traits;
  const hoursBody = 1 / (t.strainResistance ?? 1);
  const hoursMood = 1 / (t.exhaustionResistance ?? 1);
  const rows = [
    wideRow('Intelligence', character.iq, WIDE_SCALES.iq, iqWord(character.iq), `${iqTopShare(character.iq)} of people: more output from every hour of focus.`),
    wideRow('Political skill', character.pol, WIDE_SCALES.pol, polWord(character.pol), 'How far networking, calibration and gambles in events pay off.'),
    statRow('Body under long hours', hoursBody, 'How well health holds when the days get long.'),
    statRow('Mood under long hours', hoursMood, 'How well motivation holds when the days get long.'),
    statRow('Shrugs off bad news', 1 + (t.steadiness ?? 0) * 2, t.steadiness ? `Takes ${Math.round((1 - t.steadiness) * 100)}% of every blow to mood.` : 'Takes blows to mood in full.'),
    statRow('Leadership', t.leadership ?? 1, 'Pull toward manager and director chairs.'),
    statRow('Reads the room in events', t.eventSavvy ?? 1, 'Odds on political gambles in events.'),
    statRow('Output at the desk', t.coreBonus ?? 1),
    statRow('Networking pays back', t.politicsBonus ?? 1),
    statRow('Builds relationships', t.relationshipBonus ?? 1),
    statRow('Need for freedom', 1 + (t.autonomyNeed ?? 0), t.autonomyNeed ? 'Motivation tracks how much say the job gives: best in a university, worst in finance.' : ''),
    statRow('Lift from exciting projects', t.noveltyLift ?? 1),
  ].join('');
  const quirks = [];
  if (t.networkingDrain) quirks.push('Networking drains mood: every hour past the first tenth of the day costs.');
  if (t.networkingHealthDrain) quirks.push('Networking also costs health.');
  if (t.deskWorkDrain) quirks.push(`Gets restless when more than ${Math.round(t.deskWorkLimit * 100)}% of the day is heads-down delivery.`);
  if (t.moonshotUnlocked) quirks.push(`Can take moonshot projects from the first day, and lands them ${Math.round((t.moonshotLanding - 1) * 100)}% more often.`);
  if (t.rigidManagerClash) quirks.push('Clashes with rigid, demanding managers.');
  if (quirks.length === 0) quirks.push('No quirks: a plain, balanced profile.');
  return `<div class="profile-head">
      ${portrait({ ...character.look, faceStyle: faceStyle ?? character.look.faceStyle }, 96)}
      <div class="profile-title"><div class="modal-kicker">${character.mbti} · ${escapeHtml(character.archetype)}</div>
        <h2>${escapeHtml(firstNameOf(character))}</h2>${difficultyBadge(character.difficulty)}</div>
    </div>
    <p class="profile-blurb">${escapeHtml(character.blurb)} <span class="muted">${escapeHtml(DIFFICULTY_NOTES[character.difficulty])}</span></p>
    ${bestFit(character.id) ? `<p class="best-fit"><strong>Best fit:</strong> ${bestFit(character.id).track} · strongest in ${escapeHtml(bestFit(character.id).industry)} · hardest in ${escapeHtml(bestFit(character.id).worst)}</p>` : ''}
    <div class="face-picker"><span>Face</span>${Object.entries(FACE_STYLES).map(([id, entry]) => `<button class="face-chip ${id === (faceStyle ?? character.look.faceStyle) ? 'on' : ''}" data-face-style="${id}">${escapeHtml(entry.label)}</button>`).join('')}</div>
    ${birthYearPicker(birthYear)}
    <div class="profile-stats">${rows}</div>
    <ul class="quirks">${quirks.map((quirk) => `<li>${escapeHtml(quirk)}</li>`).join('')}</ul>
    ${adjustPanel(adjust)}`;
}

/** The birth year: when the career starts, what it pays, and how soon the Super Intelligence Revolution arrives in each field. */
function birthYearPicker(birthYear) {
  const start = startYearOf(birthYear);
  const factor = payFactor(birthYear);
  const fields = Object.entries(ERA.sirYear).map(([id, year]) => {
    const name = { tech: 'Tech', consulting: 'Consulting', privateEquity: 'Private equity', academia: 'Academia' }[id];
    const at = Math.max(year, start);
    const age = at - birthYear;
    return `<span class="${start >= year ? 'already' : ''}">${name}: ${start >= year ? 'already here' : `${year}, at ${age}`}</span>`;
  }).join('');
  return `<div class="birth-year">
    <label for="birth-year"><strong>Born ${birthYear}</strong> · graduates ${start} · starting pay ${factor >= 1 ? '+' : '−'}${Math.abs(Math.round((factor - 1) * 100))}%</label>
    <input type="range" id="birth-year" min="${ERA.birthYears[0]}" max="${ERA.birthYears[1]}" step="1" value="${birthYear}" aria-label="Birth year">
    <div class="birth-scale"><span>${ERA.birthYears[0]}</span><span>${ERA.birthYears[1]}</span></div>
    <div class="sir-years"><em>Super Intelligence Revolution</em>${fields}</div>
  </div>`;
}

/** The trade-off controls: up to two small steps on each skill, every step up paid for by a step down. */
function adjustPanel(adjust) {
  const points = adjustmentPoints(adjust);
  const rows = ADJUSTABLE.map((entry) => {
    const steps = adjust[entry.id] ?? 0;
    const label = entry.field ? `${steps > 0 ? '+' : ''}${steps * entry.step} ${entry.unit}` : `${steps > 0 ? '+' : ''}${Math.round(steps * entry.step * 100)}%`;
    return `<div class="adjust-row"><span>${entry.label}</span><button class="button small" data-adjust="${entry.id}" data-dir="-1" ${steps <= -MAX_STEPS ? 'disabled' : ''}>−</button><strong class="${steps > 0 ? 'up' : steps < 0 ? 'down' : ''}">${steps ? label : '0'}</strong><button class="button small" data-adjust="${entry.id}" data-dir="1" ${steps >= MAX_STEPS || points <= 0 ? 'disabled' : ''}>+</button></div>`;
  }).join('');
  return `<details class="adjust" ${Object.keys(adjust).length ? 'open' : ''}><summary>Tune the skills <small>${points ? `${points} point${points > 1 ? 's' : ''} to spend` : 'balanced'}</small></summary>
    <p class="explain">Small trade-offs. Every step up on one skill is paid for by a step down on another, two steps at most on any, and the changes are tiny: they sharpen who this person is, they do not change it.</p>
    <div class="adjust-grid">${rows}</div>
    <button class="button ghost small" data-adjust-reset>Reset</button></details>`;
}

const INDUSTRY_BLURBS = {
  tech: { line: 'Fast ladders, real money, and a pager. Tech debt wakes you at 2 AM until you pay it down.', tags: ['9 h culture', 'Tech debt'] },
  consulting: { line: 'Up or out: four years at a level below Principal and you are counselled out. Travel wears you down.', tags: ['10.5 h culture', 'Utilization'] },
  privateEquity: { line: 'The most money and the longest days. Face time counts. Deals close on deal flow.', tags: ['12 h culture', 'Deal flow'] },
  academia: { line: 'Low pay and a tenure clock. Publish, win grants, and earn a job nobody can take away.', tags: ['9.5 h culture', 'Citations'] },
};

export function industryCards() {
  return Object.values(INDUSTRIES).map((industry) => {
    const blurb = INDUSTRY_BLURBS[industry.id];
    return `<button class="pick-card industry" data-industry="${industry.id}">
      <h3>${escapeHtml(industry.name)}</h3>
      <div class="tag-row">${blurb.tags.map((tag) => `<span class="tag">${tag}</span>`).join('')}<span class="tag good">${formatMoney(industry.salaries[0])} start</span></div>
      <p>${escapeHtml(blurb.line)}</p>
      <p class="blurb">${escapeHtml(industry.titles[0])} → ${escapeHtml(industry.titles[industry.titles.length - 1])}</p>
    </button>`;
  }).join('');
}

const TIER_ORDER = ['startup', 'aggressive', 'mid', 'stable'];
const TIER_TAGS = {
  startup: ['Reviews twice a year', 'Equity, may fold'],
  aggressive: ['Quarterly reviews', 'Fast promotions'],
  mid: ['Reviews twice a year', 'Some politics'],
  stable: ['Annual reviews', 'Politics count'],
};

/** The kinds of employer an industry has, plus a random one, for the first-job pick. */
export function employerCards(industryId) {
  const industry = INDUSTRIES[industryId];
  const tiers = TIER_ORDER.filter((tier) => TIER_MIX[industryId]?.[tier]);
  const cards = tiers.map((tier) => {
    const entry = Math.round(industry.salaries[0] * COMPANY_TIERS[tier].pay / 1000) * 1000;
    const risk = tier === 'startup' ? 'Highest risk' : tier === 'aggressive' ? 'High risk, high reward' : tier === 'mid' ? 'Balanced' : 'Safest';
    return `<button class="pick-card employer" data-employer="${tier}">
      <h3>${escapeHtml(COMPANY_TIERS[tier].name)}</h3>
      <div class="tag-row"><span class="tag good">${formatMoney(entry)} start</span><span class="tag">${risk}</span>${TIER_TAGS[tier].map((tag) => `<span class="tag">${tag}</span>`).join('')}</div>
      <p>${escapeHtml(COMPANY_TIERS[tier].blurb)}</p>
    </button>`;
  });
  cards.push(`<button class="pick-card employer" data-employer="random">
    <h3>Surprise me</h3>
    <div class="tag-row"><span class="tag blue">Drawn by the industry's mix</span></div>
    <p>Take whatever the market offers a new graduate. Later job hops draw from the whole market either way.</p>
  </button>`);
  return cards.join('');
}

export function industryMeter(game) {
  const player = game.player;
  const state = player.industry;
  const industry = game.industry;
  const rows = [];
  const bar = (value, color) => `<div class="meter-bar"><div style="width:${Math.max(0, Math.min(100, value))}%;background:${color}"></div></div>`;
  if (industry.subStat === 'techDebt') {
    const color = state.techDebt > 65 ? '#e5484d' : state.techDebt > 40 ? '#f5c542' : '#46b96b';
    rows.push(`<div class="meter-row"><span>${INDUSTRY_STATS.techDebt.label}</span><strong>${Math.round(state.techDebt)}</strong>${bar(state.techDebt, color)}</div>`);
  } else if (industry.subStat === 'utilization') {
    const live = player.plan.shares[CORE] * player.plan.hours / 8;
    rows.push(`<div class="meter-row"><span>${INDUSTRY_STATS.utilization.label}</span><strong>${Math.round(live * 100)}%</strong>${bar(live * 100, live < 0.75 ? '#e5484d' : '#46b96b')}</div>`);
    rows.push(`<div class="meter-row"><span>Client score</span><strong>${Math.round(state.clientScore)}</strong>${bar(state.clientScore, state.clientScore < 40 ? '#e5484d' : '#5c9bff')}</div>`);
  } else if (industry.subStat === 'dealFlow') {
    rows.push(`<div class="meter-row"><span>${INDUSTRY_STATS.dealFlow.label}</span><strong>${Math.round(state.dealFlow)}</strong>${bar(state.dealFlow, '#46b96b')}</div>`);
    rows.push(`<div class="meter-row"><span>Dry powder</span><strong>${Math.round(dryPowder(game))}%</strong>${bar(dryPowder(game), '#f5c542')}</div>`);
  } else if (industry.subStat === 'citations') {
    rows.push(`<div class="meter-row"><span>${INDUSTRY_STATS.citations.label}</span><strong>${Math.round(state.citations)} · ${state.papers} papers</strong>${bar(state.researchProgress / INDUSTRY_STATS.citations.researchPerPaper * 100, '#8b7cf6')}</div>`);
    rows.push(`<div class="meter-row"><span>Grants</span><strong>${state.grants}${state.grantQuarters ? ` (active ${state.grantQuarters} q)` : ''}</strong></div>`);
  }
  return rows.join('');
}

export { POLITICS, MOTIVATION, ORG };
