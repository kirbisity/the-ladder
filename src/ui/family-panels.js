// The panels for life outside the office: the social circle (which becomes
// the family bar once married), and the partner's own page.

import { SOCIAL, FAMILY } from '../config.js';
import { formatMoney, quarterlyExpenses } from '../sim/game.js';
import {
  socialGain, socialNeed, socialEquilibrium, isExtrovert, familyTarget, kidsAtHome, childAge, quartersTogether, partnerIncome, partnerTakeHome, dateNightStatus, isDating,
} from '../sim/family.js';
import { portrait, escapeHtml, head, figure } from './panels.js';

function signed(value) {
  const rounded = Math.round(value * 10) / 10;
  return `${rounded > 0 ? '+' : rounded < 0 ? '−' : ''}${Math.abs(rounded).toFixed(rounded % 1 === 0 ? 0 : 1)}`;
}

function termRows(terms) {
  return terms.map((term, index) => `<tr class="${term.value < 0 ? 'bad' : index === 0 ? '' : 'good'}"><td>${escapeHtml(term.label)}</td><td>${signed(term.value)}</td></tr>`).join('');
}

function bar(value, kind) {
  return `<div class="progress ${kind}"><div style="width:${Math.max(0, Math.min(100, value))}%"></div></div>`;
}

const firstName = (person) => person.name.split(' ')[0];

function describeWarmth(warmth) {
  if (warmth >= 0.7) return 'patient and forgiving';
  if (warmth >= 0.4) return 'fair, with limits';
  return 'needs time and attention';
}

/** Their story in a line: how long, and how it is going. */
function relationshipLine(game) {
  const partner = game.partner;
  const years = quartersTogether(game) / 4;
  const months = Math.max(1, Math.round(years * 12));
  const span = years < 1 ? `${months} month${months > 1 ? 's' : ''}` : `${years.toFixed(years % 1 ? 1 : 0)} years`;
  return partner.stage === 'married' ? `Married, ${span} together` : `Dating, ${span} in`;
}

function circleSection(game) {
  const player = game.player;
  const gain = socialGain(game);
  const need = socialNeed(player);
  const mood = Math.max(-SOCIAL.motivationCap, Math.min(SOCIAL.motivationCap, (game.social - need) * SOCIAL.motivationWeight));
  const rows = gain.parts.map((part, index) => `<tr class="${index ? 'good' : ''}"><td>${escapeHtml(part.label)}</td><td>${signed(part.value)}</td></tr>`).join('');
  const temperament = isExtrovert(player) ? `extroverts fill up ${Math.round((SOCIAL.extrovertGain - 1) * 100)}% faster` : `introverts fill up ${Math.round((1 - SOCIAL.introvertGain) * 100)}% slower`;
  return `<div class="panel-heading"><h3>Your circle</h3><span class="panel-figure">${Math.round(game.social)}%</span></div>
    ${bar(game.social, 'social')}
    <p class="lead">${isExtrovert(player) ? 'As an extrovert' : 'As an introvert'}, you need a circle of about <strong>${need}</strong> to feel settled. At ${Math.round(game.social)} it moves your mood by <strong>${signed(mood)}</strong>${game.married ? ` (a smaller share, now that family comes first)` : ''}.</p>
    <div class="table-wrap"><table class="peer-table vitals-table"><tbody>${rows}
      <tr class="total"><td>Per quarter, after temperament, hours and work (${temperament})</td><td>${signed(gain.total)}</td></tr></tbody></table></div>
    <p class="explain">The circle is accumulated: it gains each quarter from time given to people and loses ${Math.round(SOCIAL.decayPerQuarter * 100)}% of itself to neglect, so on today's plan it settles near <strong>${Math.round(socialEquilibrium(game))}</strong>. Long days eat the evenings (${Math.round(gain.evenings * 100)}% of the gain today). A bigger circle also means you meet someone sooner.</p>`;
}

/** The social circle, or the family when married. */
export function socialPanel(game) {
  if (!game.married || !game.family || !game.partner) {
    return `${head('Social', 'Your social network')}${circleSection(game)}`;
  }
  const family = game.family;
  const partner = game.partner;
  const { terms, target } = familyTarget(game);
  const line = partner.divorceLine;
  const kids = kidsAtHome(game).length;
  const danger = family.quality < line + FAMILY.warnMargin;
  const status = family.below > 0
    ? `<strong>${firstName(partner)} is past patience.</strong> The bar has been under their line for ${family.below} quarter${family.below > 1 ? 's' : ''}; ${FAMILY.divorceQuarters} in a row ends the marriage.`
    : danger ? `Close to ${firstName(partner)}'s line. They are not saying much, which is not good.` : `Safe: ${Math.round(family.quality - line)} points above ${firstName(partner)}'s breaking line.`;
  return `${head(`Family: ${Math.round(family.quality)}%`, 'Your family')}
    ${bar(family.quality, 'family')}
    <p class="lead">It drifts toward <strong>${Math.round(target)}%</strong>. ${status}</p>
    <div class="table-wrap"><table class="peer-table vitals-table"><tbody>${termRows(terms)}<tr class="total"><td>Target</td><td>${Math.round(target)}</td></tr></tbody></table></div>
    <p class="explain">Your work-life balance is your marriage: every hour a day past what ${escapeHtml(firstName(partner))} tolerates (<strong>${partner.workTolerance}</strong>) costs ${FAMILY.hoursPenaltyPerHour} points of target${kids ? `, more with ${kids === 1 ? 'a young child' : 'children'} at home` : ''}. Rest, holidays and date nights lift it. ${escapeHtml(firstName(partner))} is ${describeWarmth(partner.warmth)}; they leave if it sits under <strong>${line}</strong> for two quarters in a row. It also feeds your mood, at ${Math.round(FAMILY.moodWeight * 100)}% of its distance from ${FAMILY.moodReference}.</p>
    ${circleSection(game)}`;
}

function kidsLine(game) {
  const kids = kidsAtHome(game);
  if (kids.length === 0) return game.flags.childFree ? 'No children, by choice.' : 'No children yet.';
  const ages = kids.map((child) => Math.floor(childAge(game, child))).sort((a, b) => b - a);
  return `${kids.length} ${kids.length === 1 ? 'child' : 'children'}, aged ${ages.join(', ')}. Each adds a steady lift to your mood, and a large bill.`;
}

/** The partner's page: who they are, how they are, what holds the two of you together. */
export function partnerPanel(game) {
  const partner = game.partner;
  if (!partner) return `${head('Partner', 'Nobody, for now')}<p class="lead">You are not seeing anyone. A bigger circle of friends means you meet someone sooner.</p>`;
  const married = partner.stage === 'married';
  const date = dateNightStatus(game);
  const income = partnerIncome(game);
  const finances = married ? `<div class="figures">${[
    figure('Their income', income > 0 ? `${formatMoney(income)} / yr` : partner.laidOffQuarters > 0 ? 'Between jobs' : 'On leave'),
    figure('Household spending', `${formatMoney(quarterlyExpenses(game) * 4)} / yr`),
    figure('They add, after tax', `${formatMoney(partnerTakeHome(game))} / yr`),
  ].join('')}</div>` : '';
  const bond = married
    ? `<div class="panel-heading"><h3>The marriage</h3><span class="panel-figure">${Math.round(game.family.quality)}%</span></div>${bar(game.family.quality, 'family')}`
    : `<div class="panel-heading"><h3>How close you are</h3><span class="panel-figure">${Math.round(partner.bond)}%</span></div>${bar(partner.bond, 'family')}
       <p class="explain">${partner.waited > 0 ? `You have put off the question ${partner.waited} time${partner.waited > 1 ? 's' : ''}. ` : ''}Closeness grows with time together and falls when you work past ${partner.workTolerance} hours a day. Below ${FAMILY.breakupLine} they may end it; a good run of ${FAMILY.proposalAfterQuarters / 4} years or more can lead to a proposal.</p>`;
  return `${head(relationshipLine(game), escapeHtml(partner.name))}
    <div class="partner-card">${portrait(partner.look, 84)}
      <div class="partner-facts">
        <p><strong>${escapeHtml(partner.career)}</strong>, age ${Math.floor(partner.age)}, ${escapeHtml(partner.mbti)}</p>
        <p>Tolerates about <strong>${partner.workTolerance} hours</strong> a day of you working. ${describeWarmth(partner.warmth)[0].toUpperCase()}${describeWarmth(partner.warmth).slice(1)}.</p>
        ${married ? `<p>Leaves if the family bar stays under <strong>${partner.divorceLine}</strong> for two quarters.</p>` : ''}
      </div>
    </div>
    <div class="panel-heading"><h3>Their health</h3><span class="panel-figure">${Math.round(partner.health)}%</span></div>${bar(partner.health, 'health')}
    <div class="panel-heading"><h3>Their mood</h3><span class="panel-figure">${Math.round(partner.motivation)}%</span></div>${bar(partner.motivation, 'motivation')}
    ${bond}
    ${finances}
    <p class="explain">${escapeHtml(kidsLine(game))}</p>
    <div class="profile-actions">
      <button class="button primary" data-action="date-night" ${date.allowed ? '' : 'disabled'} title="${escapeHtml(date.reason)}">Date night · ${formatMoney(FAMILY.dateNightCost)}</button>
      ${isDating(game) ? '<button class="button ghost" data-action="end-relationship">End it</button>' : ''}
    </div>
    <p class="explain">${escapeHtml(date.reason)}</p>`;
}
