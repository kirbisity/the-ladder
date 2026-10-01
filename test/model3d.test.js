// The 3D cast, drawn onto a recording stand-in for a canvas: what matters is
// that each look makes its own model, and that the build, hair and pose show.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drawFigure3D, drawHead3D } from '../src/ui/model3d.js';
import { CHARACTERS } from '../src/config.js';

function recorder() {
  const log = { polygons: 0, minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity, colours: new Set() };
  const note = (x, y) => {
    log.minX = Math.min(log.minX, x);
    log.maxX = Math.max(log.maxX, x);
    log.minY = Math.min(log.minY, y);
    log.maxY = Math.max(log.maxY, y);
  };
  const context = {
    beginPath() {}, closePath() {}, stroke() {}, save() {}, restore() {},
    moveTo: note, lineTo: note,
    set fillStyle(value) { log.colours.add(value); },
    fill() { log.polygons += 1; },
    set strokeStyle(value) {}, set lineWidth(value) {}, set lineJoin(value) {},
  };
  return { context, log };
}

function figure(id, options = {}) {
  const { context, log } = recorder();
  const look = CHARACTERS.find((character) => character.id === id).look;
  drawFigure3D(context, 200, 400, 30, look, options);
  return log;
}

test('every character is a real model: hundreds of lit faces, standing above the feet', () => {
  for (const character of CHARACTERS) {
    const log = figure(character.id);
    assert.ok(log.polygons > 300, `${character.id}: ${log.polygons} faces`);
    assert.ok(log.colours.size > 20, `${character.id}: lit in many shades`);
    assert.ok(log.maxY <= 400 + 2 && log.minY < 400 - 8 * 30, `${character.id}: feet at the baseline, head about nine head-radii up`);
  }
});

test('the look card shows in the model: a thin build is narrower, hair and faces differ', () => {
  const widthOf = (look) => {
    const { context, log } = recorder();
    drawFigure3D(context, 200, 400, 30, look, { pose: 'standing' });
    return log.maxX - log.minX;
  };
  const base = { ...CHARACTERS.find((character) => character.id === 'simon').look, hairStyle: 'cleanShort' };
  assert.ok(widthOf({ ...base, build: 'thin' }) < widthOf(base) * 0.93, 'a slight build is narrower');
  assert.ok(widthOf({ ...base, hairStyle: 'long' }) !== widthOf(base) || figure('christian').polygons !== figure('adam').polygons, 'hair changes the model');
  const chloe = figure('chloe');
  const jennifer = figure('jennifer');
  assert.notEqual([...chloe.colours].join(), [...jennifer.colours].join(), 'different people, different shades');
  assert.notEqual(chloe.polygons, jennifer.polygons, 'a ponytail is not a shoulder-length cut');
});

test('poses change the picture: lying is wide and low, standing is tall', () => {
  const standing = figure('simon');
  const lying = figure('simon', { pose: 'lying', expression: 'sleep' });
  assert.ok(standing.maxY - standing.minY > (standing.maxX - standing.minX) * 2, 'standing is tall');
  assert.ok(lying.maxX - lying.minX > (lying.maxY - lying.minY) * 1.8, 'lying is wide');
});

test('expressions change the face, and a head can be drawn on its own', () => {
  const happy = figure('joseph', { expression: 'happy' });
  const sad = figure('joseph', { expression: 'sad' });
  assert.notEqual([...happy.colours].join(), [...sad.colours].join());
  const { context, log } = recorder();
  drawHead3D(context, 100, 100, 50, CHARACTERS[0].look, {});
  assert.ok(log.polygons > 100 && log.maxY - log.minY < 50 * 4);
});

test('every character has a face style from the config, and styles and tweaks change the model', async () => {
  const { FACE_STYLES } = await import('../src/config.js');
  for (const character of CHARACTERS) assert.ok(FACE_STYLES[character.look.faceStyle], `${character.id}: ${character.look.faceStyle}`);
  const base = CHARACTERS.find((character) => character.id === 'simon').look;
  const heightOf = (look) => {
    const { context, log } = recorder();
    drawFigure3D(context, 200, 400, 30, look, { pose: 'standing' });
    return log.minY;
  };
  assert.ok(heightOf({ ...base, faceStyle: 'glossy' }) < heightOf({ ...base, faceStyle: 'small' }), 'a bigger head stands taller');
  assert.ok(heightOf({ ...base, faceStyle: 'small', faceTweaks: { head: 1.3 } }) < heightOf({ ...base, faceStyle: 'small' }), 'a tweak overrides one field of the style');
  const eyes = (style) => { const { context, log } = recorder(); drawFigure3D(context, 200, 400, 30, { ...base, faceStyle: style }, {}); return [...log.colours].join(); };
  assert.notEqual(eyes('glossy'), eyes('dots'), 'different eyes, different shades');
});
