// Background music for the big moments: one track per kind of moment, played
// once from the start when its cut scene begins (see audio/music/README.md).
// A new track replaces the one playing; a missing or blocked file is silence.

const BASE = 'audio/music/';

// Which track plays for which cut scene.
export const MUSIC_FOR_SCENE = {
  retiredModest: 'good_ending', retiredComfortable: 'good_ending', retiredWealthy: 'good_ending', retiredLuxury: 'good_ending', fire: 'good_ending',
  death: 'bad_ending', homeless: 'bad_ending', breakdown: 'bad_ending', burnout: 'bad_ending',
  promoted: 'big_moment', startupWin: 'big_moment',
  dating: 'life', married: 'life', newborn: 'life', child: 'life',
  sir: 'agi',
};

export function createMusic() {
  let current = null;
  let enabled = true;

  function stop() {
    if (!current) return;
    current.pause();
    current = null;
  }

  /** Play a track by name once; returns the element, or null when music is off or the name is unknown. */
  function play(name) {
    if (!enabled || !name) return null;
    stop();
    const track = new Audio(`${BASE}${name}.mp3`);
    track.volume = 0.7;
    track.addEventListener('ended', () => { if (current === track) current = null; });
    track.play().catch((error) => console.warn(`The Ladder: music ${name} did not play`, error));
    current = track;
    return track;
  }

  return {
    play,
    stop,
    playForScene: (sceneId) => play(MUSIC_FOR_SCENE[sceneId]),
    setEnabled(on) {
      enabled = on;
      if (!on) stop();
    },
    isEnabled: () => enabled,
    playing: () => (current ? current.src.split('/').pop() : null),
  };
}
