import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeKit, CAMERAS } from '../src/ui/scene-camera.js';

/** A canvas context that only remembers the polygons it was asked to fill. */
function recorder() {
  const polygons = [];
  let current = [];
  return {
    polygons,
    beginPath() { current = []; },
    moveTo(x, y) { current.push([x, y]); },
    lineTo(x, y) { current.push([x, y]); },
    closePath() {},
    fill() { polygons.push(current); },
  };
}

const span = (polygon) => Math.max(...polygon.map((p) => p[0])) - Math.min(...polygon.map((p) => p[0]));

test('both cameras put the scene origin at the same screen point and scale it the same there', () => {
  const iso = makeKit(recorder(), 80, 640, 400, CAMERAS.iso);
  const perspective = makeKit(recorder(), 80, 640, 400, CAMERAS.perspective);
  const at = (kit) => kit.iso(0, 0, 0);
  assert.ok(Math.abs(at(iso).x - at(perspective).x) < 1e-6 && Math.abs(at(iso).y - at(perspective).y) < 1e-6);
  const stepIso = iso.iso(1, 0, 0).x - iso.iso(0, 0, 0).x;
  const stepPerspective = perspective.iso(1, 0, 0).x - perspective.iso(0, 0, 0).x;
  assert.ok(Math.abs(stepIso - stepPerspective) / stepIso < 0.08, 'a unit step at the origin looks the same');
});

test('perspective shrinks what is farther away and enlarges what is nearer; iso never does', () => {
  const width = (camera, x, y) => {
    const context = recorder();
    makeKit(context, 80, 640, 400, camera).box(x, y, 0, 1, 1, 1, '#808080');
    return Math.max(...context.polygons.map(span));
  };
  assert.ok(width(CAMERAS.perspective, -8, -8) < width(CAMERAS.perspective, 0, 0));
  assert.ok(width(CAMERAS.perspective, 0, 0) < width(CAMERAS.perspective, 8, 8));
  assert.ok(Math.abs(width(CAMERAS.iso, -8, -8) - width(CAMERAS.iso, 8, 8)) < 1e-6);
});

test('a box shows only the sides that face the camera', () => {
  const left = recorder();
  const right = recorder();
  makeKit(left, 80, 640, 400, CAMERAS.perspective).box(-12, 0, 0, 1, 1, 2, '#808080');
  makeKit(right, 80, 640, 400, CAMERAS.perspective).box(12, 0, 0, 1, 1, 2, '#808080');
  assert.ok(left.polygons.length >= 2 && right.polygons.length >= 2);
  assert.ok(left.polygons.length <= 3 && right.polygons.length <= 3, 'never the faces turned away');
  const edge = (context) => {
    const sides = context.polygons.find((polygon) => polygon.length === 4);
    return sides;
  };
  assert.ok(edge(left) && edge(right));
});

test('ground that reaches behind the camera is cut at the near plane instead of exploding', () => {
  const context = recorder();
  const kit = makeKit(context, 80, 640, 400, CAMERAS.perspective);
  kit.ground(-40, -40, 40, 40, '#336633');
  assert.equal(context.polygons.length, 1);
  for (const [x, y] of context.polygons[0]) assert.ok(Number.isFinite(x) && Number.isFinite(y) && Math.abs(x) < 1e6 && Math.abs(y) < 1e6);
});

test('a prop is viewed from the camera\'s side: the iso camera leaves it as it was, perspective turns it by where it stands', () => {
  const iso = makeKit(recorder(), 80, 640, 400, CAMERAS.iso).view(5, -5, 0);
  assert.equal(iso.yaw, 0);
  assert.equal(iso.scale, 1);
  const perspective = makeKit(recorder(), 80, 640, 400, CAMERAS.perspective);
  const centre = perspective.view(0, 0, 0);
  const side = perspective.view(8, -8, 0);
  assert.ok(Math.abs(centre.yaw) < 1e-6, 'at the centre it is seen as in iso');
  assert.ok(Math.abs(side.yaw) > 0.1, 'off to one side it is seen from another angle');
  assert.ok(perspective.view(-8, -8, 0).scale < 1 && perspective.view(8, 8, 0).scale > 1);
});
