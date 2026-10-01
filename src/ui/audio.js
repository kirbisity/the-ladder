// Sound, synthesised with Web Audio so the game ships no audio files.
// Ambient office noise turns into clatter and a fluorescent hum on long
// hours; burnout muffles everything under a tinnitus drone; readiness at
// 100 rings a glass chime; layoffs land on a low dissonant brass swell.
// Browsers only allow sound after a click, so nothing starts until enable().

export function createAudio() {
  let context = null;
  let master = null;
  let muffle = null;
  let ambientGain = null;
  let humGain = null;
  let tinnitusGain = null;
  let clatterTimer = 0;
  let enabled = false;
  let state = { hours: 8, burnout: false, running: false };

  function enable() {
    if (enabled) return true;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return false;
    context = new AudioContext();
    master = context.createGain();
    master.gain.value = 0.55;
    muffle = context.createBiquadFilter();
    muffle.type = 'lowpass';
    muffle.frequency.value = 18000;
    muffle.connect(master);
    master.connect(context.destination);

    // Office room tone: filtered brown noise.
    const noise = context.createBufferSource();
    noise.buffer = brownNoise(context, 4);
    noise.loop = true;
    const roomFilter = context.createBiquadFilter();
    roomFilter.type = 'bandpass';
    roomFilter.frequency.value = 420;
    roomFilter.Q.value = 0.5;
    ambientGain = context.createGain();
    ambientGain.gain.value = 0;
    noise.connect(roomFilter).connect(ambientGain).connect(muffle);
    noise.start();

    // Fluorescent hum: mains fundamental and its harmonic.
    humGain = context.createGain();
    humGain.gain.value = 0;
    for (const frequency of [60, 120, 180]) {
      const oscillator = context.createOscillator();
      oscillator.frequency.value = frequency;
      const partial = context.createGain();
      partial.gain.value = frequency === 120 ? 0.5 : 0.25;
      oscillator.connect(partial).connect(humGain);
      oscillator.start();
    }
    humGain.connect(muffle);

    // Tinnitus bypasses the muffle: it is inside your head.
    const ring = context.createOscillator();
    ring.frequency.value = 6400;
    tinnitusGain = context.createGain();
    tinnitusGain.gain.value = 0;
    ring.connect(tinnitusGain).connect(master);
    ring.start();

    enabled = true;
    apply();
    return true;
  }

  function disable() {
    if (!enabled) return;
    context.close();
    enabled = false;
    context = null;
  }

  function apply() {
    if (!enabled) return;
    const now = context.currentTime;
    const overtime = Math.max(0, Math.min(1, (state.hours - 9) / 5));
    const running = state.running ? 1 : 0.4;
    ambientGain.gain.setTargetAtTime(0.18 * running, now, 0.4);
    humGain.gain.setTargetAtTime(0.05 * overtime * running, now, 0.6);
    muffle.frequency.setTargetAtTime(state.burnout ? 380 : 18000, now, state.burnout ? 0.05 : 0.8);
    tinnitusGain.gain.setTargetAtTime(state.burnout ? 0.012 : 0, now, 0.8);
  }

  /** Update the soundscape: hours a day, burnout, whether the clock runs. */
  function setState(next) {
    const wasBurnedOut = state.burnout;
    state = { ...state, ...next };
    if (enabled && state.burnout && !wasBurnedOut) cutout();
    apply();
  }

  // The moment burnout lands: a brief silence before the drone.
  function cutout() {
    const now = context.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(0.0001, now);
    master.gain.setTargetAtTime(0.55, now + 0.6, 0.4);
  }

  /** Called every frame while the clock runs: keyboard clatter at the work rate. */
  function tick(seconds) {
    if (!enabled || !state.running) return;
    clatterTimer -= seconds;
    if (clatterTimer > 0) return;
    const busy = Math.max(0.2, (state.hours - 6) / 10);
    clatterTimer = 0.05 + Math.random() * 0.3 / busy;
    key(state.hours > 11 ? 0.05 : 0.03);
    if (state.hours >= 13 && Math.random() < 0.01) breath();
  }

  function key(volume) {
    const now = context.currentTime;
    const click = context.createBufferSource();
    click.buffer = whiteNoise(context, 0.03);
    const filter = context.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 2000 + Math.random() * 2000;
    const gain = context.createGain();
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.03);
    click.connect(filter).connect(gain).connect(muffle);
    click.start(now);
  }

  function breath() {
    const now = context.currentTime;
    const air = context.createBufferSource();
    air.buffer = whiteNoise(context, 1.4);
    const filter = context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 700;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.05, now + 0.6);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.4);
    air.connect(filter).connect(gain).connect(muffle);
    air.start(now);
  }

  /** A clear glass chime: readiness has reached 100. */
  function chime() {
    if (!enabled) return;
    const now = context.currentTime;
    [1568, 2093, 3136, 4186].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      const gain = context.createGain();
      gain.gain.setValueAtTime(0.0001, now + index * 0.04);
      gain.gain.exponentialRampToValueAtTime(0.12 / (index + 1), now + index * 0.04 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.2);
      oscillator.connect(gain).connect(master);
      oscillator.start(now + index * 0.04);
      oscillator.stop(now + 2.3);
    });
  }

  /** Low dissonant brass swell for structural layoffs. */
  function brass() {
    if (!enabled) return;
    const now = context.currentTime;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(200, now);
    filter.frequency.exponentialRampToValueAtTime(1400, now + 1.2);
    filter.frequency.exponentialRampToValueAtTime(300, now + 2.6);
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.16, now + 1);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.8);
    filter.connect(gain).connect(muffle);
    for (const frequency of [65.4, 69.3, 98, 103.8]) {
      const oscillator = context.createOscillator();
      oscillator.type = 'sawtooth';
      oscillator.frequency.value = frequency;
      oscillator.detune.value = Math.random() * 12 - 6;
      oscillator.connect(filter);
      oscillator.start(now);
      oscillator.stop(now + 2.9);
    }
  }

  return { enable, disable, setState, tick, chime, brass, isEnabled: () => enabled };
}

function brownNoise(context, seconds) {
  const buffer = context.createBuffer(1, Math.floor(context.sampleRate * seconds), context.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let index = 0; index < data.length; index += 1) {
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
    data[index] = last * 3.5;
  }
  return buffer;
}

function whiteNoise(context, seconds) {
  const buffer = context.createBuffer(1, Math.floor(context.sampleRate * seconds), context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < data.length; index += 1) data[index] = Math.random() * 2 - 1;
  return buffer;
}
