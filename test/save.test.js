import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, chooseEventOption, finishQuarterDays, closeQuarter } from '../src/sim/game.js';
import { serializeGame, deserializeGame } from '../src/sim/save.js';

function playQuarters(game, count) {
  for (let index = 0; index < count && !game.outcome; index += 1) {
    while (game.currentEvent) chooseEventOption(game, 0);
    finishQuarterDays(game);
    closeQuarter(game);
  }
}

test('a saved career resumes exactly where it was, luck included', () => {
  const original = createGame({ seed: 31, characterId: 'maya', industryId: 'consulting' });
  playQuarters(original, 6);
  const restored = deserializeGame(serializeGame(original));
  assert.ok(restored);
  assert.equal(restored.player, restored.org.agents.find((agent) => agent.isPlayer), 'the player is the seated agent');
  playQuarters(original, 8);
  playQuarters(restored, 8);
  assert.equal(restored.player.level, original.player.level);
  assert.equal(Math.round(restored.savings), Math.round(original.savings));
  assert.equal(restored.player.health.toFixed(6), original.player.health.toFixed(6));
});

test('a damaged or foreign save is refused, not half-loaded', () => {
  assert.equal(deserializeGame('{not json'), null);
  assert.equal(deserializeGame(JSON.stringify({ version: 999 })), null);
});
