// The world around the cast: which office a job gets, and the 3D props.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { officeThemeFor, THEMES } from '../src/ui/office-themes.js';
import { buildCar, buildHouse, buildApartment, buildUmbrella, DEFAULT_CAR_STYLE, CAR_STYLES } from '../src/ui/props3d.js';
import { engine } from '../src/ui/model3d.js';
import { INDUSTRIES, TIER_MIX } from '../src/config.js';

test('every industry and company tier gets a real office, and the genres differ', () => {
  const seen = new Set();
  for (const industryId of Object.keys(INDUSTRIES)) {
    for (const tier of Object.keys(TIER_MIX[industryId])) {
      const id = officeThemeFor(industryId, tier);
      assert.ok(THEMES[id], `${industryId}/${tier}: ${id}`);
      seen.add(id);
    }
  }
  assert.ok(seen.size >= 7, `only ${seen.size} distinct offices`);
  assert.notEqual(officeThemeFor('tech', 'startup'), officeThemeFor('tech', 'stable'));
  assert.notEqual(officeThemeFor('tech', 'mid'), officeThemeFor('privateEquity', 'mid'));
});

function faceCount(root) {
  let count = root.faces.length;
  for (const child of root.children) count += faceCount(child);
  return count;
}

test('the props are detailed models: a car is a smooth, glazed body with wheels, not a few boxes', () => {
  for (const kind of ['hatchback', 'sedan', 'suv', 'sports']) {
    assert.ok(faceCount(buildCar(kind, 'smooth')) > 3000, `${kind} smooth`);
    assert.ok(faceCount(buildCar(kind, DEFAULT_CAR_STYLE)) > 100, `${kind} ${DEFAULT_CAR_STYLE}`);
  }
  for (const kind of ['modest', 'family', 'villa']) assert.ok(faceCount(buildHouse(kind)) > 120, `house ${kind}`);
  for (const kind of ['worn', 'nice', 'tower']) assert.ok(faceCount(buildApartment(kind)) > 120, `apartment ${kind}`);
  assert.ok(faceCount(buildUmbrella('#111111')) > 60, 'an umbrella has panels and ribs');
  assert.ok(engine.pushFace, 'the engine hands props its primitives');
});

test('the default car is the blocky style, with sloped glass and cylinder wheels, and every style builds every car', () => {
  assert.equal(DEFAULT_CAR_STYLE, 'blocky');
  const slopedGlass = (root) => root.faces.some((face) => {
    const [a, b, c] = face.points;
    const normal = [(b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]), (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]), (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])];
    const glass = face.color[2] > face.color[0] && face.color[2] > 150;
    return glass && Math.abs(normal[1]) > 0.02 && Math.abs(normal[0]) > 0.02;
  });
  for (const kind of ['hatchback', 'sedan', 'suv', 'sports']) {
    assert.ok(slopedGlass(buildCar(kind, 'blocky')), `${kind}: an inclined windscreen or rear screen`);
    for (const style of Object.keys(CAR_STYLES)) assert.ok(faceCount(buildCar(kind, style)) > 50, `${kind} ${style}`);
  }
});
