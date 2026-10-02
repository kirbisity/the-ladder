// The four retirements, from a flat and an old hatchback to a villa on a
// lake with a yacht at the dock. The camera sits close to the building so
// the home fills the picture; traffic moves on the road (some cars parked,
// some driving, more of both the better off the retiree is).

import { drawCar, drawHouse, drawApartment, drawUmbrella } from './props3d.js';
import { glow, hash, cloud, birds, waterShine, fillPolygon } from './scenes-world.js';

const TAU = Math.PI * 2;

// The road runs along y; two lanes, one each way, and a kerb on the house side.
const ROAD = { x0: 3.6, x1: 6.6, lanes: [4.45, 5.75] };
const HEADING_DOWN = Math.PI / 2;
const HEADING_UP = -Math.PI / 2;

const CAR_KINDS = ['hatchback', 'sedan', 'suv', 'sports'];

export function retirementScenes(tools) {
  const { kit, sky, tree, mixColor, peerLook } = tools;

  /** A car driving the length of the road, looping, in the lane for its direction. */
  const driving = (context, k, time, kind, direction, offset, speed) => {
    const span = 34;
    const travel = ((time * speed + offset) % span) - span / 2;
    const y = direction > 0 ? travel : -travel;
    drawCar(context, k, ROAD.lanes[direction > 0 ? 0 : 1], y, kind, 0, 'lowpoly', direction > 0 ? HEADING_DOWN : HEADING_UP);
  };

  // The retiree's own car is drawn at full detail; every other car in the picture, which is most
  // of them, uses a lighter model: five smooth cars cost more than the rest of the scene together.
  const parked = (context, k, x, y, kind, heading = HEADING_DOWN, style = 'lowpoly') => drawCar(context, k, x, y, kind, 0, style, heading);

  /** Kerb, road markings and street lamps along the road. */
  const street = (context, k, time, lamps = [-4, 3, 10]) => {
    k.ground(ROAD.x0 - 0.9, -60, ROAD.x0, 60, '#b9bcc0');
    k.ground(ROAD.x0, -60, ROAD.x1, 60, '#6d7178');
    k.ground(ROAD.x1, -60, ROAD.x1 + 0.7, 60, '#b9bcc0');
    for (let dash = -14; dash < 14; dash += 1) k.ground((ROAD.x0 + ROAD.x1) / 2 - 0.05, dash * 2, (ROAD.x0 + ROAD.x1) / 2 + 0.05, dash * 2 + 1, '#e8dfa6');
    for (const y of lamps) {
      k.box(ROAD.x0 - 0.6, y, 0, 0.1, 0.1, 3.4, '#33373d');
      k.box(ROAD.x0 - 0.6, y - 0.05, 3.3, 0.6, 0.08, 0.08, '#33373d');
      const bulb = k.iso(ROAD.x0 - 0.05, y, 3.25);
      glow(context, bulb.x, bulb.y, k.unit * 1.4, 'rgba(255,224,160,0.35)');
    }
  };

  const walker = (context, k, data, time, x, seed, speed, direction = 1) => {
    const y = ((time * speed + seed * 7) % 30) - 15;
    k.person(x, direction > 0 ? y : -y, peerLook((data.seed ?? 1) + seed), { pose: 'walking', expression: 'happy', time: time * 2, size: 0.2, facing: direction });
  };

  const modest = (context, width, height, time, data, k) => {
    context.fillStyle = '#a9ada3';
    k.ground(-40, -40, 3.6, 40, '#9aa092');
    // Pavement and a worn forecourt for the flats.
    k.ground(-9, 2.4, 3.6, 4.6, '#b0b3b0');
    drawApartment(context, k, -5.2, -3.4, data.home === 'nice' || data.home === 'luxury' ? 'nice' : 'worn');
    // Washing on a balcony line, a bike, bins, a bus shelter.
    const lineA = k.iso(-3.2, -0.2, 2.6);
    const lineB = k.iso(-0.6, -0.2, 2.6);
    context.strokeStyle = 'rgba(40,40,40,0.6)';
    context.beginPath();
    context.moveTo(lineA.x, lineA.y);
    context.quadraticCurveTo((lineA.x + lineB.x) / 2, lineA.y + 14, lineB.x, lineB.y);
    context.stroke();
    ['#e8d9a6', '#a8c8e8', '#e8a8a8', '#ffffff'].forEach((color, index) => {
      const t = (index + 0.5) / 4;
      const x = lineA.x + (lineB.x - lineA.x) * t;
      const y = lineA.y + (lineB.y - lineA.y) * t + Math.sin(t * Math.PI) * 14;
      context.fillStyle = color;
      context.fillRect(x - 7, y, 14 + Math.sin(time * 2 + index) * 2, 17);
    });
    k.box(1.4, 1.0, 0, 0.5, 0.5, 0.8, '#3f5a46');
    k.box(2.0, 1.0, 0, 0.5, 0.5, 0.8, '#2f4a6a');
    // The bike against the wall.
    k.box(-5.4, 0.6, 0, 0.9, 0.05, 0.5, '#3a3f47');
    k.box(-5.4, 0.62, 0.45, 0.5, 0.04, 0.05, '#c8352f');
    // A bus shelter with a bench.
    k.box(0.4, 3.1, 0, 0.08, 0.08, 2.2, '#4a5560');
    k.box(2.4, 3.1, 0, 0.08, 0.08, 2.2, '#4a5560');
    k.box(0.3, 3.0, 2.2, 2.3, 1.1, 0.1, '#6a7480');
    k.box(0.7, 3.5, 0, 1.4, 0.4, 0.5, '#8a6a46');
    k.person(-2.4, 2.4, data.look, { pose: 'sitting', expression: null, outfit: { top: '#7b7568', bottom: '#4b4740', shirt: '#7b7568' }, time, z: 2.1, size: 0.2 });
    street(context, k, time, [-6, 0, 6]);
    parked(context, k, ROAD.x0 - 0.35, 3.6, data.car ?? 'hatchback', HEADING_DOWN, 'smooth');
    driving(context, k, time, 'sedan', 1, 4, 1.4);
    walker(context, k, data, time, 3.0, 30, 0.7, -1);
    for (let bush = 0; bush < 6; bush += 1) tree(k, context, -8 + bush * 1.6, 2.2, { height: 1.4 + hash(bush) * 0.8, crown: '#6c8c58' });
  };

  const comfortable = (context, width, height, time, data, k) => {
    k.ground(-40, -40, 3.6, 40, '#76b35f');
    k.ground(-3.0, 1.8, -1.4, 3.6, '#cfd2d4');
    k.ground(-1.8, 3.6, 3.6, 5.4, '#a9acb0');
    drawHouse(context, k, -6.0, -3.2, 'modest');
    // A picket fence along the lawn, a mailbox, vegetable beds, a bird bath.
    for (let post = 0; post < 14; post += 1) {
      k.box(-7 + post * 0.7, 3.7, 0, 0.1, 0.08, 0.7, '#f1f1ec');
    }
    k.box(-7, 3.72, 0.4, 9.4, 0.04, 0.07, '#f1f1ec');
    k.box(2.6, 3.0, 0, 0.1, 0.1, 0.9, '#6b4a30');
    k.box(2.45, 2.95, 0.9, 0.4, 0.26, 0.26, '#3b5f8a');
    for (let row = 0; row < 3; row += 1) {
      k.box(-6.0, 1.0 + row * 0.6, 0, 2.0, 0.35, 0.18, '#4a3526');
      for (let plant = 0; plant < 5; plant += 1) k.box(-5.8 + plant * 0.4, 1.1 + row * 0.6, 0.18, 0.12, 0.12, 0.28, ['#d6443a', '#4f9a4a', '#e0a050'][row]);
    }
    tree(k, context, 1.4, -2.4, { height: 4.2, crown: '#4f9a4f' });
    tree(k, context, -8.4, 0.2, { height: 3.6, crown: '#5faa5a' });
    k.person(-1.1, 2.2, data.look, { pose: 'standing', expression: 'happy', outfit: { top: '#5b7f9a', bottom: '#c9b48a', shirt: '#ffffff' }, time, size: 0.22 });
    street(context, k, time, [-5, 2, 9]);
    parked(context, k, 1.2, 4.5, data.car ?? 'sedan', HEADING_DOWN, 'smooth');
    parked(context, k, ROAD.x0 - 0.35, -5.5, 'hatchback');
    driving(context, k, time, 'suv', 1, 8, 1.8);
    driving(context, k, time, 'sedan', -1, 20, 1.5);
    walker(context, k, data, time, 3.0, 31, 0.6, 1);
    // A cat on the wall, because why not.
    const cat = k.iso(-4.2, 3.7, 0.8);
    context.fillStyle = '#d98a3a';
    context.beginPath();
    context.ellipse(cat.x, cat.y, 8, 5, 0, 0, TAU);
    context.fill();
    context.beginPath();
    context.arc(cat.x + 8, cat.y - 4, 4, 0, TAU);
    context.fill();
  };

  const wealthy = (context, width, height, time, data, k) => {
    k.ground(-40, -40, 3.6, 40, '#6aa85a');
    k.ground(-5.4, 3.2, 3.6, 6.2, '#b4b6ba');
    drawHouse(context, k, -8.2, -3.8, 'family');
    // Hedges and a line of poplars, a pergola with a table, a swing.
    for (let index = 0; index < 8; index += 1) k.box(-9 + index * 1.4, 7.0, 0, 1.3, 0.5, 0.9, '#3f8a4a');
    for (let index = 0; index < 5; index += 1) tree(k, context, -9 + index * 3.2, -6.4, { height: 5.2, crown: '#3f8f4f' });
    k.box(-2.4, 0.4, 0, 0.1, 0.1, 2.4, '#8a6a46');
    k.box(0.6, 0.4, 0, 0.1, 0.1, 2.4, '#8a6a46');
    k.box(-2.4, 2.4, 0, 0.1, 0.1, 2.4, '#8a6a46');
    k.box(0.6, 2.4, 0, 0.1, 0.1, 2.4, '#8a6a46');
    k.box(-2.6, 0.2, 2.4, 3.4, 2.4, 0.1, '#a8845a');
    k.box(-1.4, 1.0, 0, 1.2, 0.9, 0.7, '#6a4c30');
    drawUmbrella(context, k, -1.0, 1.4, 0, '#2f6f4e', '#f6efe4');
    k.person(-0.6, 2.6, data.look, { pose: 'waving', expression: 'happy', outfit: { top: '#9a4a5a', bottom: '#2f3a4a', shirt: '#ffffff' }, time });
    k.person(0.5, 3.0, peerLook((data.seed ?? 1) + 21), { pose: 'waving', expression: 'happy', time, size: 0.15 });
    k.person(1.1, 2.0, peerLook((data.seed ?? 1) + 22), { pose: 'standing', expression: 'happy', time, size: 0.13 });
    const dog = k.iso(1.9, 3.8, 0);
    context.fillStyle = '#b07a3a';
    context.beginPath();
    context.ellipse(dog.x, dog.y - k.unit * 0.25, k.unit * 0.35, k.unit * 0.18, 0, 0, TAU);
    context.fill();
    context.beginPath();
    context.arc(dog.x + k.unit * 0.35, dog.y - k.unit * 0.42 + Math.sin(time * 8) * 2, k.unit * 0.14, 0, TAU);
    context.fill();
    street(context, k, time, [-6, 1, 8]);
    parked(context, k, -0.6, 4.6, data.car ?? 'suv', HEADING_UP, 'smooth');
    parked(context, k, 1.6, 4.6, 'sedan', HEADING_UP);
    parked(context, k, ROAD.x0 - 0.35, 7.5, 'sports');
    driving(context, k, time, 'sedan', 1, 5, 2.0);
    driving(context, k, time, 'hatchback', -1, 14, 1.7);
    driving(context, k, time, 'suv', 1, 22, 1.6);
    walker(context, k, data, time, 3.0, 32, 0.6, 1);
    walker(context, k, data, time, 2.9, 33, 0.8, -1);
  };

  /** A yacht, moored: a long white hull, a cabin with windows, a flybridge and a mast, bobbing. */
  const yacht = (context, k, x, y, time) => {
    const bob = Math.sin(time * 1.4) * 0.05;
    const z = bob;
    // Hull along y, bow toward +y.
    k.box(x, y, z, 1.6, 6.4, 0.8, '#f6f6f2');
    k.box(x - 0.02, y, z + 0.5, 1.64, 6.4, 0.1, '#1f3a5f');
    k.box(x + 0.15, y + 6.4, z + 0.4, 1.3, 0.8, 0.4, '#f6f6f2');
    k.box(x + 0.4, y + 7.2, z + 0.3, 0.8, 0.5, 0.3, '#f6f6f2');
    // The deck, cabin and windows.
    k.box(x + 0.1, y + 0.4, z + 0.8, 1.4, 5.4, 0.08, '#b98f5a');
    k.box(x + 0.25, y + 1.2, z + 0.88, 1.1, 3.0, 0.8, '#f9f9f6');
    for (let window = 0; window < 4; window += 1) k.box(x + 1.34, y + 1.5 + window * 0.7, z + 1.1, 0.04, 0.45, 0.28, '#3a6a8f');
    k.box(x + 0.3, y + 1.6, z + 1.68, 1.0, 1.8, 0.1, '#e9e9e4');
    k.box(x + 0.4, y + 1.8, z + 1.78, 0.8, 1.2, 0.5, '#f9f9f6');
    k.box(x + 0.7, y + 2.2, z + 2.3, 0.1, 0.1, 1.6, '#c9ccd0');
    k.box(x + 0.4, y + 2.2, z + 3.2, 0.7, 0.05, 0.05, '#c9ccd0');
    // Railings and a tender off the stern.
    for (let post = 0; post < 7; post += 1) k.box(x + 1.5, y + 0.5 + post * 0.8, z + 0.88, 0.04, 0.04, 0.45, '#d8dadd');
    // A red ensign.
    const flag = k.iso(x + 0.8, y + 0.3, z + 2.6);
    fillPolygon(context, [[flag.x, flag.y], [flag.x + 14 + Math.sin(time * 5) * 3, flag.y + 5], [flag.x, flag.y + 10]], '#c8352f');
    // Its wake.
    const stern = k.iso(x + 0.8, y - 0.2, 0);
    context.strokeStyle = 'rgba(255,255,255,0.5)';
    context.lineWidth = 2;
    for (let ring = 0; ring < 3; ring += 1) {
      context.beginPath();
      context.ellipse(stern.x, stern.y + ring * 6, k.unit * (1 + ring * 0.5), k.unit * (0.3 + ring * 0.15), 0, 0, TAU);
      context.stroke();
    }
  };

  const luxury = (context, width, height, time, data, k) => {
    // The lake, in front of the house: shore line, water, a dock reaching out.
    k.ground(-40, -40, 3.6, 40, '#74b25c');
    k.ground(-40, 3.0, 3.0, 60, '#2a8fc7');
    k.ground(-40, 3.0, 3.0, 3.3, '#e8dcb4');
    k.ground(3.0, 3.0, 3.6, 60, '#74b25c');
    waterShine(context, width, height * 0.62, height, time, 'rgba(255,255,255,0.35)', 30);
    // The villa on its terrace, with a pool.
    k.ground(-9, -2.2, 2.6, 3.0, '#e3dcc8');
    drawHouse(context, k, -8.0, -4.2, 'villa');
    k.ground(-1.8, -1.0, 2.0, 1.8, '#4fc3d8');
    waterShine(context, width, height * 0.5, height * 0.62, time, 'rgba(255,255,255,0.5)', 8);
    for (let lounger = 0; lounger < 3; lounger += 1) {
      k.box(-1.4 + lounger * 1.2, 2.0, 0, 0.6, 1.0, 0.18, '#ffffff');
      k.box(-1.4 + lounger * 1.2, 2.9, 0.18, 0.6, 0.1, 0.4, '#ffffff');
    }
    k.person(-0.2, 2.4, data.look, { pose: 'sitting', expression: 'happy', outfit: { top: '#ffffff', bottom: '#d9c7a8', shirt: '#ffffff' }, time, z: 0.2, size: 0.22 });
    // The dock: planks on pilings, a lamp, a life ring.
    k.box(0.8, 3.0, 0.1, 1.0, 6.4, 0.12, '#a07a4a');
    for (let piling = 0; piling < 7; piling += 1) {
      k.box(0.75, 3.2 + piling, -0.5, 0.1, 0.1, 0.9, '#5a4028');
      k.box(1.75, 3.2 + piling, -0.5, 0.1, 0.1, 0.9, '#5a4028');
    }
    k.box(0.9, 8.6, 0.22, 0.08, 0.08, 1.2, '#33373d');
    const bulb = k.iso(0.94, 8.6, 1.5);
    glow(context, bulb.x, bulb.y, k.unit * 1.2, 'rgba(255,224,160,0.5)');
    // The yacht moored on the dock's far side.
    yacht(context, k, -1.2, 3.8, time);
    // Palms around the terrace and a speedboat's ripples in the distance.
    for (const [x, y] of [[-9.4, 2.4], [-3, -2.8], [2.4, -1.6]]) tree(k, context, x, y, { palm: true, crown: '#2f7d3b', trunk: '#8a6a42', height: 4.6 });
    // The road behind the house, with cars at the gate and cars passing.
    street(context, k, time, [-6, 1, 8]);
    parked(context, k, ROAD.x0 - 0.35, 4.6, data.car ?? 'sports', HEADING_DOWN, 'smooth');
    parked(context, k, ROAD.x0 - 0.35, 7.4, 'suv');
    parked(context, k, ROAD.x0 - 0.35, -3.2, 'sedan');
    driving(context, k, time, 'sports', 1, 4, 2.6);
    driving(context, k, time, 'sedan', -1, 12, 2.0);
    driving(context, k, time, 'suv', 1, 20, 1.9);
    driving(context, k, time, 'hatchback', -1, 28, 1.6);
    // A sailboat far out on the lake.
    const sail = k.iso(-4, 14, 0);
    fillPolygon(context, [[sail.x - 20, sail.y], [sail.x + 22, sail.y], [sail.x + 14, sail.y + 7], [sail.x - 14, sail.y + 7]], '#f6efe4');
    fillPolygon(context, [[sail.x + 2, sail.y - 40], [sail.x + 2, sail.y - 2], [sail.x + 22, sail.y - 4]], '#ffffff');
  };

  const SCENES = [
    {
      draw: modest,
      lawn: '#9aa092',
      captions: (data) => [`At ${data.age}, ${data.firstName} retires on what there is.`, 'A small flat, an old hatchback, coupons on the fridge.', 'The view from the balcony is of the car park. The coffee is good, though.'],
    },
    {
      draw: comfortable,
      captions: (data) => [`At ${data.age}, ${data.firstName} retires to a quiet street.`, 'A paid-off house, a reliable sedan, tomatoes in the garden.', 'Mornings without meetings. It turns out that was all anyone wanted.'],
    },
    {
      draw: wealthy,
      captions: (data) => [`At ${data.age}, ${data.firstName} retires well.`, 'A big house on a leafy street, an SUV for the grandchildren, the dog.', 'Forty years of hours, turned into all the hours in the world.'],
    },
    {
      draw: luxury,
      captions: (data) => [`At ${data.age}, ${data.firstName} retires very, very well.`, 'A villa on the lake, a pool, a red sports car, a yacht at the dock.', 'The ladder had a top after all, and the view from it is extraordinary.'],
    },
  ];

  return SCENES.map((entry) => ({
    duration: 13,
    captions: entry.captions,
    draw(context, width, height, time, data) {
      const evening = Math.min(1, time / 13);
      sky(context, width, height, mixColor('#7fb7ea', '#e98a5a', evening * 0.8), mixColor('#cfe6f8', '#f8c58e', evening * 0.8));
      cloud(context, width * 0.25 + Math.sin(time * 0.15) * 20, height * 0.12, 60, 'rgba(255,255,255,0.7)');
      cloud(context, width * 0.7 - Math.sin(time * 0.1) * 20, height * 0.08, 46, 'rgba(255,255,255,0.6)');
      // Close in: the building fills the picture.
      const k = kit(context, width, height, Math.min(width, height * 1.6) / 24, width / 2 + width * 0.05, height * 0.66);
      entry.draw(context, width, height, time, data, k);
      birds(context, width, height, time, 4, 'rgba(40,40,50,0.6)');
      // The low evening sun warms everything a little.
      context.fillStyle = `rgba(255,170,90,${0.04 + 0.1 * evening})`;
      context.fillRect(0, 0, width, height);
    },
  }));
}
