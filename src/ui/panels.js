// The panels and dialogs: events, the quarter review, the org chart with
// its fog of war, performance, skills and life, help, and the end. Each
// returns HTML for the modal card; main.js wires the buttons.

import { RATING_LABELS, RATINGS, dailyCoreOutput, stagnationYears, projectSpec, CORE, POLITICS } from '../sim/agent.js';
import { employedAgents, agentsAtLevel, TEAM_COUNT } from '../sim/org.js';
import { titleOf, formatMoney, netWorth, managerOf, teamHappiness, quarterlyExpenses, dryPowder } from '../sim/game.js';
import { PROJECTS, READINESS, INDUSTRY_STATS, ORG, TIME, MOTIVATION, RELATIONSHIP, CHARACTERS, INDUSTRIES } from '../config.js';

export function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
}

const RATING_COLORS = {
  greatlyExceeds: '#46b96b', exceeds: '#8fd36f', meetAll: '#f5c542', meetMost: '#f0a24a', meetSome: '#e5484d', onLeave: '#7d899c',
};

export function portrait(look, size = 64) {
  return `<svg class="portrait" viewBox="0 0 64 64" width="${size}" height="${size}" aria-hidden="true">
    <rect width="64" height="64" rx="14" fill="#223047"/>
    <path d="M12 64 C 14 46, 22 42, 32 42 C 42 42, 50 46, 52 64 Z" fill="${look.suit}"/>
    <path d="M28 43 L32 52 L36 43 Z" fill="#ffffff"/>
    <circle cx="32" cy="28" r="12" fill="${look.skin}"/>
    <path d="M19 27 C 19 14, 45 12, 45 27 C 41 21, 26 21, 19 27 Z" fill="${look.hair}"/>
  </svg>`;
}

function figure(label, value) {
  return `<div class="figure"><span>${label}</span><strong>${value}</strong></div>`;
}

function head(kicker, title, closable = true) {
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
  const title = report.unemployed ? 'Out of work' : RATING_LABELS[report.rating] ?? 'Quarter closed';
  const ladder = report.rating && report.rating !== 'onLeave' ? ratingLadder(report.rating) : '';
  const figures = [];
  if (report.rank) figures.push(figure('Rank', `${report.rank} / ${report.poolSize}`));
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
  const kicker = `Q${report.quarterOfYear} · Year ${report.year} review`;
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
    <button class="button small ${tab === 'peers' ? 'primary' : ''}" data-org-tab="peers">Peer tracking</button></div>`;
  const body = tab === 'peers' ? peerTracking(game) : orgChart(game, selectedId);
  return `${head(`${escapeHtml(game.org.companyName)} · ${escapeHtml(game.org.divisionNames[game.org.divisionIndex])}`, 'Org tree')}${tabs}${body}`;
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

export function careerPanel(game) {
  const player = game.player;
  const character = game.character;
  const manager = managerOf(game);
  const allies = game.org ? employedAgents(game.org).filter((agent) => agent !== player && agent.relationship >= RELATIONSHIP.loyalLine).length : 0;
  const enemies = game.org ? employedAgents(game.org).filter((agent) => agent !== player && agent.relationship <= RELATIONSHIP.hostileLine).length : 0;
  const team = teamHappiness(game);
  return `${head(`${character.mbti} · ${escapeHtml(character.archetype)}`, escapeHtml(player.name))}
    <div class="project-tile career-blurb" style="grid-template-columns:auto minmax(0,1fr)">${portrait(player.look, 64)}
      <div><p class="lead">${escapeHtml(character.blurb)}</p></div></div>
    <div class="figures">${figure('IQ', player.iq)}${figure('Political skill', player.pol)}${figure('Skill', Math.round(player.skill))}${figure('Informants', Math.floor(player.informants))}</div>
    <div class="figures">${figure('Salary', formatMoney(player.salary))}${figure('Savings', formatMoney(game.savings))}${figure('Home equity', formatMoney(game.homeEquity))}${figure('Earned so far', formatMoney(game.lifetimeEarnings))}</div>
    <div class="figures">${figure('Allies', allies)}${figure('Enemies', enemies)}${figure('Manager', manager ? escapeHtml(manager.name.split(' ')[0]) : '—')}${team !== null ? figure('Team mood', `${Math.round(team)}%`) : figure('Spending / qtr', formatMoney(quarterlyExpenses(game)))}</div>
    <p>${game.married ? 'Married' : 'Single'}${game.dependents ? `, ${game.dependents} child${game.dependents > 1 ? 'ren' : ''}` : ''}${game.homeEquity > 0 ? ', homeowner' : ', renting'}. Market: ${game.market}.</p>
    ${historyChart(game)}`;
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

// ── Project picker ─────────────────────────────────────────────────────

export function availableProjects(game) {
  const player = game.player;
  const list = ['maintenance', 'demo', 'workshop'];
  if (player.level >= PROJECTS.catalog.moonshot.unlockLevel || player.traits.moonshotUnlocked) list.splice(2, 0, 'moonshot');
  list.push(game.industry.project.id);
  return list;
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
  const rows = availableProjects(game).map((id) => {
    const project = projectSpec(id, game.industry);
    const odds = Math.min(1, projectedCompletion(game, id));
    const risk = project.risky ? `<span class="tag hot">Lands ${Math.round(PROJECTS.moonshotLanding * (game.player.traits.moonshotLanding ?? 1) * 100)}% if done</span>` : '';
    return `<button class="choice" data-project="${id}" ${id === current ? 'style="border-color:#5f9bff"' : ''}>
      <span style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><span>${escapeHtml(project.name)}</span>
      <span class="tag-row"><span class="tag ${project.impact === 'high' ? 'hot' : project.impact === 'medium' ? 'warn' : 'blue'}">Impact: ${project.impact}</span>${risk}
      <span class="tag ${odds >= 1 ? 'good' : 'bad'}">On pace: ${Math.round(odds * 100)}%</span></span></span>
      <span class="choice-blurb">${projectBlurb(id)}</span></button>`;
  }).join('');
  return `${head('Choose this quarter\'s project', 'Project selection')}
    <p class="explain">Finishing it by the deadline lifts your review; missing it costs you. "On pace" is how much your current plan would get done this quarter.</p>
    <div class="choices">${rows}</div>`;
}

function projectBlurb(id) {
  return {
    maintenance: 'Low effort, low risk, small credit. Hard to fail.',
    demo: 'A visible deliverable. Success lifts motivation and readiness.',
    moonshot: 'Huge credit and readiness if it lands. Often it does not.',
    workshop: 'Runs on Mentoring bandwidth. Builds readiness and goodwill.',
    refactor: 'Pays down tech debt: fewer 2 AM pages.',
    pitch: 'Win new client work. Readiness if it lands.',
    deck: 'Feeds deal flow: more deals close.',
    grant: 'A proposal; if it is done, a chance of funding that boosts research output for two years.',
  }[id] ?? '';
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
    'The Dedicated–Open slider trades focus and layoff protection for recruiter calls and a faster job search.',
  ] },
  { title: 'How it ends', items: [
    'Retire at 62 with the highest title and the most wealth you can.',
    'Health at zero is death. Motivation at zero is a breakdown. Out of work with no savings left is homelessness.',
    'Burnout greys the screen. Rest it out (35%+ Recovery, 9 hours or fewer) and it counts as leave; work through it and you will break down.',
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

export function menuPanel(hasGame) {
  return `${head('Paused', 'Menu')}
    <div class="choices">
      ${hasGame ? '<button class="choice" data-action="close-modal">Resume</button>' : ''}
      <button class="choice" data-action="help">How to play</button>
      ${hasGame ? '<button class="choice" data-action="save-quit">Save and return to title</button>' : ''}
      <button class="choice" data-action="new-career">Start a new career</button>
    </div>`;
}

// ── The end ────────────────────────────────────────────────────────────

const OUTCOMES = {
  retired: { title: 'Retirement', line: (game, outcome) => `At ${Math.floor(outcome.age)} you hand in your badge. The highest chair you held: ${outcome.title}.` },
  death: { title: 'Death', line: (game, outcome) => `Your heart gave out at ${Math.floor(outcome.age)}. The ${game.industry.name.toLowerCase()} world sent flowers and posted the role the next week.` },
  breakdown: { title: 'Breakdown', line: (game, outcome) => `At ${Math.floor(outcome.age)} you could not go on. You worked on through burnout until nothing was left.` },
  homeless: { title: 'Homeless', line: (game, outcome) => `At ${Math.floor(outcome.age)} the savings ran out before the job search did. You lost the apartment.` },
};

export function gameOverPanel(game) {
  const outcome = game.outcome;
  const entry = OUTCOMES[outcome.kind];
  const support = outcome.kind === 'breakdown'
    ? '<p class="support">This is a game. If work is wearing you down in real life, please talk to someone: in the US call or text 988; elsewhere, findahelpline.com lists free, confidential lines.</p>'
    : '';
  return `${head(outcome.kind === 'retired' ? 'Career complete' : 'Career over', entry.title, false).replace('<h2>', '<h2 class="outcome-title">')}
    <p class="lead">${escapeHtml(entry.line(game, outcome))}</p>
    <div class="figures">${figure('Highest title', escapeHtml(outcome.title))}${figure('Net worth', formatMoney(outcome.netWorth))}${figure('Earned', formatMoney(outcome.lifetimeEarnings))}${figure('Score', outcome.score.toLocaleString())}</div>
    ${historyChart(game)}
    ${support}
    <div class="actions"><button class="button" data-action="same-again">Same person, new career</button><button class="button primary" data-action="new-career">New career</button></div>`;
}

export function characterCards() {
  return CHARACTERS.map((character) => `<button class="pick-card" data-character="${character.id}">
    ${portrait(character.look, 64)}
    <h3>${escapeHtml(character.name)}</h3>
    <div class="tag-row"><span class="tag blue">${character.mbti}</span><span class="tag">IQ ${character.iq}</span><span class="tag">Pol ${character.pol}</span></div>
    <p><strong>${escapeHtml(character.archetype)}.</strong></p>
    <p class="blurb">${escapeHtml(character.blurb)}</p>
  </button>`).join('');
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
