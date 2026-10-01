// People, drawn in code. One head and one body, shared by the office, the
// portraits and the cut scenes, so a character looks like themselves
// everywhere. A look carries colours and features:
//   face: round | soft | structured
//   hairStyle: sideSwept | shoulderStraight | bob | cleanShort | long | bald
//   brows: thickCurved | soft | straight
//   eyes: monolid | innerDouble | large | focused
//   nose: soft | delicate | bridge
//   mouth: gentle | smileTeeth | animated | composed
//   glasses: thickBlack | aviator (optional); cheeks: flushed; stubble: true
// Expressions override the mouth and eyes: happy, sad, crying, blank, sleep.

function shade(color, amount) {
  const value = parseInt(color.slice(1), 16);
  const target = amount >= 0 ? 255 : 0;
  const mix = Math.abs(amount);
  const channel = (shift) => Math.round(((value >> shift) & 255) * (1 - mix) + target * mix);
  return `#${((channel(16) << 16) | (channel(8) << 8) | channel(0)).toString(16).padStart(6, '0')}`;
}

function ellipse(context, x, y, rx, ry, fill, rotation = 0) {
  context.beginPath();
  context.ellipse(x, y, Math.max(0.3, rx), Math.max(0.3, ry), rotation, 0, Math.PI * 2);
  context.fillStyle = fill;
  context.fill();
}

function stroke(context, width, color, draw) {
  context.beginPath();
  draw();
  context.lineWidth = Math.max(0.6, width);
  context.strokeStyle = color;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.stroke();
}

// ── Head ───────────────────────────────────────────────────────────────

function facePath(context, x, y, r, face) {
  context.beginPath();
  if (face === 'structured') {
    // A firmer jaw: straighter cheeks narrowing to a defined chin.
    context.moveTo(x - r * 0.92, y - r * 0.2);
    context.quadraticCurveTo(x - r * 0.95, y - r * 1.05, x, y - r * 1.05);
    context.quadraticCurveTo(x + r * 0.95, y - r * 1.05, x + r * 0.92, y - r * 0.2);
    context.lineTo(x + r * 0.78, y + r * 0.55);
    context.quadraticCurveTo(x + r * 0.45, y + r * 1.02, x, y + r * 1.05);
    context.quadraticCurveTo(x - r * 0.45, y + r * 1.02, x - r * 0.78, y + r * 0.55);
    context.closePath();
  } else if (face === 'soft') {
    context.ellipse(x, y + r * 0.03, r * 0.93, r * 1.06, 0, 0, Math.PI * 2);
  } else {
    context.ellipse(x, y + r * 0.04, r * 1.0, r * 1.0, 0, 0, Math.PI * 2);
  }
}

function hairBack(context, x, y, r, look) {
  const color = look.hair;
  if (look.hairStyle === 'shoulderStraight' || look.hairStyle === 'long') {
    // Straight hair falling to the shoulders, ends rounded and tucked in.
    const length = look.hairStyle === 'long' ? 2.5 : 1.95;
    context.beginPath();
    context.moveTo(x - r * 1.1, y - r * 0.2);
    context.quadraticCurveTo(x - r * 1.2, y - r * 1.25, x, y - r * 1.22);
    context.quadraticCurveTo(x + r * 1.2, y - r * 1.25, x + r * 1.1, y - r * 0.2);
    context.quadraticCurveTo(x + r * 1.22, y + r * (length - 0.5), x + r * 1.0, y + r * length);
    context.quadraticCurveTo(x + r * 0.75, y + r * (length + 0.12), x + r * 0.55, y + r * (length - 0.15));
    context.lineTo(x - r * 0.55, y + r * (length - 0.15));
    context.quadraticCurveTo(x - r * 0.75, y + r * (length + 0.12), x - r * 1.0, y + r * length);
    context.quadraticCurveTo(x - r * 1.22, y + r * (length - 0.5), x - r * 1.1, y - r * 0.2);
    context.closePath();
    context.fillStyle = color;
    context.fill();
  } else if (look.hairStyle === 'bob') {
    context.beginPath();
    context.moveTo(x - r * 1.18, y + r * 0.85);
    context.quadraticCurveTo(x - r * 1.3, y - r * 1.3, x, y - r * 1.25);
    context.quadraticCurveTo(x + r * 1.3, y - r * 1.3, x + r * 1.18, y + r * 0.85);
    context.quadraticCurveTo(x, y + r * 0.95, x - r * 1.18, y + r * 0.85);
    context.fillStyle = color;
    context.fill();
  }
}

function hairFront(context, x, y, r, look) {
  const color = look.hair;
  const style = look.hairStyle;
  context.fillStyle = color;
  if (style === 'bald') return;
  if (style === 'sideSwept') {
    // Neat short cap with a fringe swept to one side.
    context.beginPath();
    context.moveTo(x - r * 1.02, y - r * 0.1);
    context.quadraticCurveTo(x - r * 1.1, y - r * 1.2, x + r * 0.1, y - r * 1.18);
    context.quadraticCurveTo(x + r * 1.1, y - r * 1.12, x + r * 1.02, y - r * 0.15);
    context.quadraticCurveTo(x + r * 0.8, y - r * 0.55, x + r * 0.35, y - r * 0.45);
    context.quadraticCurveTo(x - r * 0.25, y - r * 0.35, x - r * 0.7, y - r * 0.6);
    context.quadraticCurveTo(x - r * 0.9, y - r * 0.4, x - r * 1.02, y - r * 0.1);
    context.fill();
    stroke(context, r * 0.035, shade(color, 0.12), () => {
      context.moveTo(x - r * 0.55, y - r * 0.85);
      context.quadraticCurveTo(x + r * 0.1, y - r * 0.75, x + r * 0.7, y - r * 0.6);
    });
  } else if (style === 'shoulderStraight' || style === 'long') {
    // Centre parting, straight curtains framing the face.
    context.beginPath();
    context.moveTo(x - r * 1.05, y + r * 0.3);
    context.quadraticCurveTo(x - r * 1.1, y - r * 1.15, x, y - r * 1.15);
    context.quadraticCurveTo(x + r * 1.1, y - r * 1.15, x + r * 1.05, y + r * 0.3);
    context.lineTo(x + r * 0.82, y + r * 0.3);
    context.quadraticCurveTo(x + r * 0.7, y - r * 0.55, x + r * 0.05, y - r * 0.8);
    context.lineTo(x - r * 0.05, y - r * 0.8);
    context.quadraticCurveTo(x - r * 0.7, y - r * 0.55, x - r * 0.82, y + r * 0.3);
    context.closePath();
    context.fill();
  } else if (style === 'bob') {
    // Blunt fringe.
    context.beginPath();
    context.moveTo(x - r * 1.05, y - r * 0.2);
    context.quadraticCurveTo(x - r * 1.05, y - r * 1.2, x, y - r * 1.2);
    context.quadraticCurveTo(x + r * 1.05, y - r * 1.2, x + r * 1.05, y - r * 0.2);
    context.lineTo(x + r * 0.85, y - r * 0.38);
    context.lineTo(x - r * 0.85, y - r * 0.38);
    context.closePath();
    context.fill();
  } else {
    // Clean short: close cap, tidy edge, short sides.
    context.beginPath();
    context.moveTo(x - r * 0.98, y - r * 0.3);
    context.quadraticCurveTo(x - r * 1.0, y - r * 1.12, x, y - r * 1.12);
    context.quadraticCurveTo(x + r * 1.0, y - r * 1.12, x + r * 0.98, y - r * 0.3);
    context.quadraticCurveTo(x + r * 0.7, y - r * 0.68, x, y - r * 0.7);
    context.quadraticCurveTo(x - r * 0.7, y - r * 0.68, x - r * 0.98, y - r * 0.3);
    context.fill();
  }
}

function eye(context, x, y, r, look, expression, side, time) {
  const width = look.eyes === 'large' ? r * 0.24 : look.eyes === 'focused' ? r * 0.2 : r * 0.22;
  const ink = '#1d1a1a';
  if (expression === 'sleep' || expression === 'blank-closed') {
    stroke(context, r * 0.05, ink, () => {
      context.moveTo(x - width, y);
      context.quadraticCurveTo(x, y + r * 0.08, x + width, y);
    });
    return;
  }
  const open = look.eyes === 'large' ? r * 0.17 : look.eyes === 'focused' ? r * 0.09 : r * 0.11;
  const blink = Math.sin(time * 1.3 + side) > 0.985 ? 0.15 : 1;
  const tilt = look.eyes === 'monolid' ? r * 0.03 * side : 0;
  // White of the eye, an almond.
  context.beginPath();
  context.moveTo(x - width, y + tilt * -1);
  context.quadraticCurveTo(x, y - open * 1.6 * blink, x + width, y + tilt);
  context.quadraticCurveTo(x, y + open * 1.1 * blink, x - width, y + tilt * -1);
  context.fillStyle = '#fbfaf7';
  context.fill();
  if (blink > 0.5) {
    const look_ = expression === 'blank' ? 0 : Math.sin(time * 0.4) * width * 0.15;
    ellipse(context, x + look_, y - open * 0.15, open * (look.eyes === 'large' ? 1.05 : 0.95), open * (look.eyes === 'large' ? 1.05 : 0.95), '#2b1c14');
    ellipse(context, x + look_, y - open * 0.15, open * 0.45, open * 0.45, ink);
    if (look.eyes === 'large') ellipse(context, x + look_ - open * 0.35, y - open * 0.5, open * 0.28, open * 0.28, '#ffffff');
  }
  // Upper lid: a single line for monolids; a fold above for inner-double and large eyes.
  stroke(context, r * (look.eyes === 'monolid' ? 0.07 : 0.05), ink, () => {
    context.moveTo(x - width * 1.05, y + tilt * -1);
    context.quadraticCurveTo(x, y - open * 1.7 * blink, x + width * 1.08, y + tilt - r * 0.01);
  });
  if (look.eyes === 'innerDouble') {
    stroke(context, r * 0.025, shade(look.skin, -0.3), () => {
      context.moveTo(x - width * 0.2 * side, y - open * 1.9);
      context.quadraticCurveTo(x + width * 0.4 * side, y - open * 2.15, x + width * side, y - open * 1.4);
    });
  } else if (look.eyes === 'large' || look.eyes === 'focused') {
    stroke(context, r * 0.025, shade(look.skin, -0.3), () => {
      context.moveTo(x - width * 0.9, y - open * 1.5);
      context.quadraticCurveTo(x, y - open * 2.4, x + width * 0.9, y - open * 1.5);
    });
  }
  if (expression === 'crying') {
    const drop = (time * 0.8 + (side + 1) * 0.37) % 1;
    ellipse(context, x + width * 0.6 * side, y + r * 0.15 + drop * r * 0.7, r * 0.05, r * 0.08, 'rgba(160, 210, 255, 0.85)');
  }
}

function brows(context, x, y, r, look, expression) {
  const style = look.brows;
  const thick = style === 'thickCurved' ? r * 0.12 : style === 'straight' ? r * 0.07 : r * 0.06;
  const sad = expression === 'sad' || expression === 'crying';
  for (const side of [-1, 1]) {
    const cx = x + side * r * 0.38;
    const cy = y - r * 0.3;
    stroke(context, thick, look.hair === '#ffffff' ? '#cfcfcf' : shade(look.hair, 0.05), () => {
      const inner = cx - side * r * 0.2;
      const outer = cx + side * r * 0.22;
      const innerY = cy + (sad ? -r * 0.08 : style === 'straight' ? r * 0.02 : 0);
      const outerY = cy + (sad ? r * 0.06 : style === 'straight' ? -r * 0.01 : r * 0.03);
      context.moveTo(inner, innerY);
      if (style === 'straight') context.lineTo(outer, outerY);
      else context.quadraticCurveTo(cx, cy - r * (style === 'thickCurved' ? 0.12 : 0.09), outer, outerY);
    });
  }
}

function nose(context, x, y, r, look) {
  const color = shade(look.skin, -0.28);
  if (look.nose === 'bridge') {
    stroke(context, r * 0.05, color, () => {
      context.moveTo(x - r * 0.03, y - r * 0.2);
      context.lineTo(x - r * 0.07, y + r * 0.22);
      context.quadraticCurveTo(x, y + r * 0.3, x + r * 0.1, y + r * 0.24);
    });
  } else if (look.nose === 'delicate') {
    stroke(context, r * 0.03, color, () => {
      context.moveTo(x, y - r * 0.05);
      context.lineTo(x - r * 0.03, y + r * 0.2);
    });
    stroke(context, r * 0.035, color, () => {
      context.moveTo(x - r * 0.07, y + r * 0.24);
      context.quadraticCurveTo(x, y + r * 0.28, x + r * 0.07, y + r * 0.24);
    });
  } else {
    stroke(context, r * 0.045, color, () => {
      context.moveTo(x - r * 0.08, y + r * 0.2);
      context.quadraticCurveTo(x, y + r * 0.28, x + r * 0.08, y + r * 0.2);
    });
  }
}

function mouth(context, x, y, r, look, expression, time) {
  const lip = '#a8505a';
  const kind = expression === 'happy' ? 'smileTeeth'
    : expression === 'sad' || expression === 'crying' ? 'sad'
      : expression === 'blank' || expression === 'sleep' ? 'flat' : look.mouth;
  if (kind === 'smileTeeth' || (kind === 'animated' && Math.sin(time * 2) > 0)) {
    context.beginPath();
    context.moveTo(x - r * 0.3, y);
    context.quadraticCurveTo(x, y + r * 0.34, x + r * 0.3, y);
    context.quadraticCurveTo(x, y + r * 0.08, x - r * 0.3, y);
    context.fillStyle = '#7a2e36';
    context.fill();
    // A neat row of teeth along the upper lip.
    context.beginPath();
    context.moveTo(x - r * 0.26, y + r * 0.02);
    context.quadraticCurveTo(x, y + r * 0.12, x + r * 0.26, y + r * 0.02);
    context.quadraticCurveTo(x, y + r * 0.07, x - r * 0.26, y + r * 0.02);
    context.fillStyle = '#ffffff';
    context.fill();
  } else if (kind === 'animated') {
    ellipse(context, x, y + r * 0.06, r * 0.14, r * 0.11, '#7a2e36');
  } else if (kind === 'sad') {
    stroke(context, r * 0.06, lip, () => {
      context.moveTo(x - r * 0.2, y + r * 0.1);
      context.quadraticCurveTo(x, y - r * 0.04, x + r * 0.2, y + r * 0.1);
    });
  } else if (kind === 'flat' || kind === 'composed') {
    stroke(context, r * 0.055, lip, () => {
      context.moveTo(x - r * 0.18, y + r * 0.04);
      context.quadraticCurveTo(x, y + r * (kind === 'composed' ? 0.07 : 0.04), x + r * 0.18, y + r * 0.04);
    });
  } else {
    stroke(context, r * 0.06, lip, () => {
      context.moveTo(x - r * 0.2, y);
      context.quadraticCurveTo(x, y + r * 0.14, x + r * 0.2, y);
    });
  }
}

function glasses(context, x, y, r, kind) {
  if (!kind) return;
  if (kind === 'thickBlack') {
    for (const side of [-1, 1]) {
      context.beginPath();
      context.roundRect(x + side * r * 0.38 - r * 0.3, y - r * 0.24, r * 0.6, r * 0.44, r * 0.14);
      context.lineWidth = Math.max(1, r * 0.11);
      context.strokeStyle = '#0d0d0d';
      context.stroke();
      context.fillStyle = 'rgba(200, 225, 255, 0.12)';
      context.fill();
    }
    stroke(context, r * 0.09, '#0d0d0d', () => {
      context.moveTo(x - r * 0.08, y - r * 0.08);
      context.quadraticCurveTo(x, y - r * 0.14, x + r * 0.08, y - r * 0.08);
    });
  } else {
    // Thin metal aviators: teardrops and a double bridge.
    for (const side of [-1, 1]) {
      context.beginPath();
      const cx = x + side * r * 0.4;
      context.moveTo(cx - r * 0.3, y - r * 0.2);
      context.lineTo(cx + r * 0.3, y - r * 0.2);
      context.quadraticCurveTo(cx + r * 0.34, y + r * 0.22, cx + side * r * 0.02, y + r * 0.26);
      context.quadraticCurveTo(cx - r * 0.34, y + r * 0.22, cx - r * 0.3, y - r * 0.2);
      context.lineWidth = Math.max(0.7, r * 0.04);
      context.strokeStyle = '#b6a27a';
      context.stroke();
      context.fillStyle = 'rgba(120, 140, 120, 0.12)';
      context.fill();
    }
    stroke(context, r * 0.035, '#b6a27a', () => {
      context.moveTo(x - r * 0.1, y - r * 0.18);
      context.lineTo(x + r * 0.1, y - r * 0.18);
      context.moveTo(x - r * 0.1, y - r * 0.05);
      context.quadraticCurveTo(x, y - r * 0.1, x + r * 0.1, y - r * 0.05);
    });
  }
}

/**
 * Draw a head centred at (x, y) with radius r. Small heads skip the fine
 * features so the office stays legible.
 */
export function drawHead(context, x, y, r, look, { expression = null, time = 0, tilt = 0, skipBack = false } = {}) {
  context.save();
  context.translate(x, y);
  context.rotate(tilt);
  if (!skipBack) hairBack(context, 0, 0, r, look);
  // Neck and ears.
  context.fillStyle = shade(look.skin, -0.08);
  context.fillRect(-r * 0.32, r * 0.7, r * 0.64, r * 0.55);
  ellipse(context, -r * 0.95, r * 0.05, r * 0.16, r * 0.24, shade(look.skin, -0.05));
  ellipse(context, r * 0.95, r * 0.05, r * 0.16, r * 0.24, shade(look.skin, -0.05));
  facePath(context, 0, 0, r, look.face);
  context.fillStyle = look.skin;
  context.fill();
  if (r >= 5) {
    if (look.stubble) {
      facePath(context, 0, 0, r, look.face);
      context.save();
      context.clip();
      // A light shadow along the jaw and upper lip, not a beard.
      context.fillStyle = 'rgba(60, 45, 35, 0.1)';
      context.beginPath();
      context.ellipse(0, r * 0.82, r * 0.78, r * 0.36, 0, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = 'rgba(60, 45, 35, 0.16)';
      for (let dot = 0; dot < 40; dot += 1) {
        const angle = Math.PI * (0.15 + 0.7 * ((dot * 37) % 40) / 40);
        const reach = 0.55 + ((dot * 13) % 7) / 18;
        context.fillRect(Math.cos(angle) * r * reach * 0.95 - r * 0.02, Math.sin(angle) * r * reach * 0.95 + r * 0.25, r * 0.04, r * 0.04);
      }
      context.restore();
    }
    if (look.cheeks === 'flushed' || expression === 'crying') {
      ellipse(context, -r * 0.55, r * 0.3, r * 0.2, r * 0.12, 'rgba(240, 120, 130, 0.45)');
      ellipse(context, r * 0.55, r * 0.3, r * 0.2, r * 0.12, 'rgba(240, 120, 130, 0.45)');
    }
    brows(context, 0, 0, r, look, expression);
    for (const side of [-1, 1]) eye(context, side * r * 0.38, -r * 0.04, r, look, expression, side, time);
    nose(context, 0, 0, r, look);
    mouth(context, 0, r * 0.5, r, look, expression, time);
    glasses(context, 0, -r * 0.04, r, look.glasses);
  } else if (look.glasses) {
    context.fillStyle = look.glasses === 'thickBlack' ? '#0d0d0d' : '#b6a27a';
    context.fillRect(-r * 0.7, -r * 0.1, r * 1.4, Math.max(1, r * 0.14));
  }
  hairFront(context, 0, 0, r, look);
  context.restore();
}

// ── Body ───────────────────────────────────────────────────────────────

/**
 * Draw a whole person. (x, y) is the ground point between the feet, or the
 * seat for sitting poses; u is the size unit (a head radius is about u).
 *
 * outfit: { top, bottom, shirt } colours; defaults to the look's suit.
 * pose: standing | walking | mourning | sitting | lying | waving | carrying
 */
export function drawPerson(context, x, y, u, look, { pose = 'standing', outfit = null, expression = null, time = 0, facing = 1 } = {}) {
  const top = outfit?.top ?? look.suit;
  const bottom = outfit?.bottom ?? shade(look.suit, -0.25);
  const shirt = outfit?.shirt ?? look.shirt ?? '#ffffff';
  const shoe = '#1b1b1f';
  context.save();
  context.translate(x, y);
  context.scale(facing, 1);
  if (pose === 'lying') {
    // Lying on the left side, head to the left, knees slightly drawn up.
    ellipse(context, u * 0.6, -u * 0.55, u * 2.6, u * 0.62, top);
    ellipse(context, u * 3.2, -u * 0.45, u * 1.2, u * 0.45, bottom);
    drawHead(context, -u * 2.2, -u * 0.9, u, look, { expression: expression ?? 'sleep', time, tilt: -Math.PI / 2.2 });
    context.restore();
    return;
  }
  const sway = pose === 'mourning' ? Math.sin(time * 6) * u * 0.05 : 0;
  const walk = pose === 'walking' ? Math.sin(time * 6) : 0;
  const sitting = pose === 'sitting';
  const hip = sitting ? -u * 0.2 : -u * 3.6;
  const headY = hip - u * 3.3 + sway - u * 1.25 + (pose === 'mourning' ? u * 0.25 : 0);
  // Long hair hangs behind the shoulders, so it is drawn before the body.
  context.save();
  context.translate(0, headY);
  context.rotate(pose === 'mourning' ? 0.18 : 0);
  hairBack(context, 0, 0, u, look);
  context.restore();
  // Legs.
  context.fillStyle = bottom;
  if (sitting) {
    context.fillRect(-u * 0.75, hip - u * 0.6, u * 2.4, u * 0.75);
    context.fillRect(u * 1.1, hip - u * 0.1, u * 0.65, u * 1.9);
    context.fillStyle = shoe;
    context.fillRect(u * 1.0, hip + u * 1.7, u * 1.0, u * 0.35);
  } else {
    context.save();
    context.translate(-u * 0.35, hip);
    context.rotate(walk * 0.35);
    context.fillRect(-u * 0.32, 0, u * 0.62, u * 3.4);
    context.fillStyle = shoe;
    context.fillRect(-u * 0.38, u * 3.3, u * 0.9, u * 0.35);
    context.restore();
    context.fillStyle = bottom;
    context.save();
    context.translate(u * 0.35, hip);
    context.rotate(-walk * 0.35);
    context.fillRect(-u * 0.3, 0, u * 0.62, u * 3.4);
    context.fillStyle = shoe;
    context.fillRect(-u * 0.3, u * 3.3, u * 0.9, u * 0.35);
    context.restore();
  }
  // Torso: a jacket with shoulders, an open collar showing the shirt.
  const shoulders = hip - u * 3.3 + sway;
  const bow = pose === 'mourning' ? u * 0.25 : 0;
  context.beginPath();
  context.moveTo(-u * 1.05, shoulders + u * 0.35);
  context.quadraticCurveTo(-u * 1.1, shoulders, -u * 0.6, shoulders - u * 0.05);
  context.lineTo(u * 0.6, shoulders - u * 0.05);
  context.quadraticCurveTo(u * 1.1, shoulders, u * 1.05, shoulders + u * 0.35);
  context.lineTo(u * 0.9, hip + u * 0.15);
  context.lineTo(-u * 0.9, hip + u * 0.15);
  context.closePath();
  context.fillStyle = top;
  context.fill();
  context.beginPath();
  context.moveTo(-u * 0.32, shoulders - u * 0.04);
  context.lineTo(u * 0.32, shoulders - u * 0.04);
  context.lineTo(0, shoulders + u * 1.1);
  context.closePath();
  context.fillStyle = shirt;
  context.fill();
  // Arms.
  context.strokeStyle = top;
  context.lineWidth = u * 0.55;
  context.lineCap = 'round';
  const hand = (hx, hy) => ellipse(context, hx, hy, u * 0.28, u * 0.3, look.skin);
  if (pose === 'mourning') {
    // Hands together in front, shoulders shaking.
    stroke(context, u * 0.55, top, () => {
      context.moveTo(-u * 0.95, shoulders + u * 0.3);
      context.quadraticCurveTo(-u * 1.0, shoulders + u * 1.6, -u * 0.15, shoulders + u * 1.9);
      context.moveTo(u * 0.95, shoulders + u * 0.3);
      context.quadraticCurveTo(u * 1.0, shoulders + u * 1.6, u * 0.15, shoulders + u * 1.9);
    });
    hand(0, shoulders + u * 1.95);
  } else if (pose === 'waving') {
    const wave = Math.sin(time * 5) * 0.4;
    stroke(context, u * 0.55, top, () => {
      context.moveTo(-u * 0.95, shoulders + u * 0.3);
      context.lineTo(-u * 1.15, hip);
      context.moveTo(u * 0.95, shoulders + u * 0.3);
      context.lineTo(u * 1.6 + wave * u, shoulders - u * 1.3);
    });
    hand(-u * 1.15, hip + u * 0.1);
    hand(u * 1.6 + wave * u, shoulders - u * 1.45);
  } else if (pose === 'carrying') {
    stroke(context, u * 0.55, top, () => {
      context.moveTo(-u * 0.95, shoulders + u * 0.3);
      context.lineTo(-u * 0.7, shoulders + u * 1.7);
      context.moveTo(u * 0.95, shoulders + u * 0.3);
      context.lineTo(u * 0.7, shoulders + u * 1.7);
    });
    context.fillStyle = '#c8a26a';
    context.fillRect(-u * 1.2, shoulders + u * 1.3, u * 2.4, u * 1.4);
    context.fillStyle = '#a8844f';
    context.fillRect(-u * 1.2, shoulders + u * 1.3, u * 2.4, u * 0.25);
  } else {
    const swing = walk * u * 0.6;
    stroke(context, u * 0.55, top, () => {
      context.moveTo(-u * 0.95, shoulders + u * 0.3);
      context.lineTo(-u * 1.05 - swing * 0.3, hip + (sitting ? -u * 0.4 : 0) + swing);
      context.moveTo(u * 0.95, shoulders + u * 0.3);
      context.lineTo(u * 1.05 + swing * 0.3, hip + (sitting ? -u * 0.4 : 0) - swing);
    });
    hand(-u * 1.05 - swing * 0.3, hip + (sitting ? -u * 0.3 : u * 0.1) + swing);
    hand(u * 1.05 + swing * 0.3, hip + (sitting ? -u * 0.3 : u * 0.1) - swing);
  }
  drawHead(context, 0, shoulders - u * 1.25 + bow, u, look, { expression, time, tilt: pose === 'mourning' ? 0.18 : 0, skipBack: true });
  context.restore();
}

/** A seated worker at a desk, seen from behind and to the side, typing. */
export function drawSeatedWorker(context, seatX, seatY, u, look, { time = 0, typingRate = 1, posture = 'upright' } = {}) {
  const slump = posture === 'slumped' ? u * 0.6 : 0;
  const torsoTop = seatY - u * 3.0 + slump;
  context.fillStyle = look.suit;
  context.beginPath();
  context.moveTo(seatX - u * 0.9, seatY);
  context.lineTo(seatX + u * 0.9, seatY);
  context.lineTo(seatX + u * 0.75, torsoTop);
  context.quadraticCurveTo(seatX, torsoTop - u * 0.25, seatX - u * 0.75, torsoTop);
  context.closePath();
  context.fill();
  context.fillStyle = look.shirt ?? '#ffffff';
  context.beginPath();
  context.moveTo(seatX - u * 0.25, torsoTop);
  context.lineTo(seatX + u * 0.25, torsoTop);
  context.lineTo(seatX, torsoTop + u * 0.9);
  context.closePath();
  context.fill();
  const tap = Math.sin(time * typingRate * 18) * u * 0.18;
  const tapOther = Math.sin(time * typingRate * 18 + 2) * u * 0.18;
  context.strokeStyle = look.suit;
  context.lineWidth = u * 0.42;
  context.lineCap = 'round';
  context.beginPath();
  context.moveTo(seatX - u * 0.6, torsoTop + u * 0.5);
  context.lineTo(seatX - u * 1.5, seatY - u * 0.8 + tap);
  context.moveTo(seatX + u * 0.6, torsoTop + u * 0.5);
  context.lineTo(seatX - u * 0.9, seatY - u * 0.4 + tapOther);
  context.stroke();
  ellipse(context, seatX - u * 1.5, seatY - u * 0.8 + tap, u * 0.22, u * 0.22, look.skin);
  ellipse(context, seatX - u * 0.9, seatY - u * 0.4 + tapOther, u * 0.22, u * 0.22, look.skin);
  drawHead(context, seatX - u * 0.1, torsoTop - u * 0.85 + (posture === 'slumped' ? u * 0.3 : 0), u * 0.72, look, {
    time, expression: posture === 'slumped' ? 'sad' : null, tilt: posture === 'slumped' ? 0.25 : 0,
  });
}

/** Random features for a simulated colleague, stable per id. */
export function peerLook(id) {
  const pick = (list, salt) => list[Math.abs(Math.imul(id + salt, 2654435761)) % list.length];
  return {
    skin: pick(['#f1d2b0', '#e2b893', '#c99a76', '#8d5a3b', '#f4d6b8', '#6b4430'], 1),
    hair: pick(['#121212', '#3a2a1e', '#6b3b23', '#c9a15a', '#5a5a5a', '#1b1512'], 2),
    suit: pick(['#3c4f6e', '#5a3f2e', '#2e4a3d', '#4b3a63', '#444b55', '#6a2e35'], 3),
    shirt: pick(['#ffffff', '#e6eef8', '#f6efe4'], 4),
    face: pick(['round', 'soft', 'structured'], 5),
    hairStyle: pick(['sideSwept', 'shoulderStraight', 'bob', 'cleanShort', 'long', 'cleanShort'], 6),
    brows: pick(['soft', 'straight', 'thickCurved'], 7),
    eyes: pick(['monolid', 'innerDouble', 'large', 'focused'], 8),
    nose: pick(['soft', 'delicate', 'bridge'], 9),
    mouth: pick(['gentle', 'composed', 'smileTeeth'], 10),
    glasses: pick([null, null, null, 'thickBlack', 'aviator'], 11),
    stubble: pick([false, false, true], 12),
  };
}
