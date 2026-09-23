// Original short cues assembled at playback time. No network request or sample decoding.
export const AUDIO_DEFAULTS = Object.freeze({effects: 80, music: 70, ambience: 65});

export function normalizeAudioSettings(value) {
  return Object.fromEntries(Object.entries(AUDIO_DEFAULTS).map(([channel, fallback]) => {
    const level = value?.[channel];
    return [channel, Number.isFinite(level) ? Math.max(0, Math.min(100, Math.round(level))) : fallback];
  }));
}

export class SoundDesign {
  constructor(getContext) {
    this.getContext = getContext;
    this.master = null;
    this.volume = AUDIO_DEFAULTS.effects;
  }

  outputGain() { return this.volume / 100 * 1.25; }

  setVolume(level) {
    this.volume = Math.max(0, Math.min(100, Number(level) || 0));
    if (!this.master) return;
    const {gain, context} = this.master;
    if (typeof gain.setTargetAtTime === 'function') gain.setTargetAtTime(this.outputGain(), context.currentTime, .02);
    else gain.value = this.outputGain();
  }

  note(ctx, frequency, time, duration, volume, type = 'sine', endFrequency = frequency) {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, time);
    if (endFrequency !== frequency)
      oscillator.frequency.exponentialRampToValueAtTime(endFrequency, time + duration);
    gain.gain.setValueAtTime(.0001, time);
    gain.gain.exponentialRampToValueAtTime(volume, time + Math.min(.018, duration / 4));
    gain.gain.exponentialRampToValueAtTime(.0001, time + duration);
    oscillator.connect(gain).connect(this.master);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    oscillator.start(time);
    oscillator.stop(time + duration + .01);
  }

  play(kind, chain = 1) {
    if (!this.volume) return false;
    try {
      const ctx = this.getContext();
      if (ctx.state !== 'running') ctx.resume().catch?.(() => {});
      if (!this.master || this.master.context !== ctx) {
        this.master = ctx.createGain();
        this.master.gain.value = this.outputGain();
        this.master.connect(ctx.destination);
      }
      const now = ctx.currentTime;
      const lift = Math.min(Math.max(chain - 1, 0), 5);
      if (kind === 'invalid') {
        this.note(ctx, 235, now, .09, .028, 'triangle', 205);
        return true;
      }
      if (kind === 'match' || kind === 'cascade') {
        const notes = [523.25, 659.25, 783.99];
        notes.forEach((frequency, i) => this.note(ctx, frequency * 2 ** (lift / 12),
          now + i * .057, .21, kind === 'cascade' ? .055 : .047, 'triangle'));
      } else if (kind === 'burst') {
        this.note(ctx, 190, now, .31, .085, 'sine', 63);
        [740, 988, 1318].forEach((frequency, i) =>
          this.note(ctx, frequency, now + .045 + i * .035, .17, .042, 'triangle'));
      } else if (kind === 'cross') {
        [392, 587.33, 783.99, 1174.66].forEach((frequency, i) =>
          this.note(ctx, frequency, now + i * .052, .32, .056, 'sine'));
      } else if (kind === 'spectrum') {
        [392, 440, 523.25, 587.33, 659.25, 783.99, 1046.5].forEach((frequency, i) =>
          this.note(ctx, frequency, now + i * .046, .3, .042, 'sine'));
        this.note(ctx, 130.81, now, .53, .07, 'triangle', 261.63);
      } else if (kind === 'create') {
        [659.25, 987.77].forEach((frequency, i) =>
          this.note(ctx, frequency, now + i * .065, .29, .04, 'sine'));
      } else if (kind === 'level') {
        [392, 523.25, 659.25, 1046.5].forEach((frequency, i) =>
          this.note(ctx, frequency, now + i * .11, .39, .055, 'triangle'));
      } else if (kind === 'rescue') {
        [587.33, 783.99, 1174.66].forEach((frequency, i) =>
          this.note(ctx, frequency, now + i * .08, .35, .038, 'sine'));
      }
      return true;
    } catch { return false; /* The game stays playable if Web Audio is unavailable. */ }
  }
}

export function cueForFrame(frame) {
  const types = frame.activated?.map(effect => effect.type) ?? [];
  if (types.includes('spectrum')) return 'spectrum';
  if (types.includes('cross')) return 'cross';
  if (types.includes('burst')) return 'burst';
  return frame.chain > 1 ? 'cascade' : 'match';
}
