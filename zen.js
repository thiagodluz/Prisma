export const ZEN_DEFAULTS = Object.freeze({music: false, ambience: false, breath: 'off', effects: 'normal'});

export function normalizeZenSettings(value) {
  return {
    music: value?.music === true,
    ambience: value?.ambience === true,
    breath: ['off', 'balanced', 'slow'].includes(value?.breath) ? value.breath : 'off',
    effects: ['soft', 'normal', 'vivid'].includes(value?.effects) ? value.effects : 'normal'
  };
}

export const breathTiming = mode => mode === 'balanced' ? [4, 4] : mode === 'slow' ? [4, 6] : null;

// A four-phrase original soundscape; no downloaded audio files or active timer while paused.
export class ZenAudio {
  constructor(getContext) {
    this.getContext = getContext;
    this.armed = false;
    this.musicTimer = null;
    this.voices = new Set();
    this.ambienceSource = null;
    this.chord = 0;
  }

  sync({active, music, ambience}) {
    if (!this.armed || !active || (!music && !ambience)) { this.stop(); return; }
    try {
      const ctx = this.getContext();
      if (ctx.state === 'suspended') ctx.resume().catch?.(() => {});
      if (music && !this.musicTimer) {
        this.playChord(ctx);
        this.musicTimer = setInterval(() => this.playChord(ctx), 7600);
      } else if (!music) this.stopMusic();
      if (ambience && !this.ambienceSource) this.startAmbience(ctx);
      else if (!ambience) this.stopAmbience();
    } catch { this.stop(); /* Audio can be unavailable in local-file views. */ }
  }

  playChord(ctx) {
    const phrase = [
      {pad: [130.81, 196, 261.63], melody: [523.25, 392, 440, 523.25]},
      {pad: [174.61, 220, 261.63], melody: [440, 523.25, 659.25, 523.25]},
      {pad: [164.81, 196, 246.94], melody: [493.88, 392, 329.63, 392]},
      {pad: [146.83, 220, 293.66], melody: [440, 587.33, 523.25, 392]}
    ][this.chord++ % 4];
    const now = ctx.currentTime;
    phrase.pad.forEach(frequency => this.scheduleVoice(ctx, frequency, now, 7.6, .013, 1.1));
    phrase.melody.forEach((frequency, i) =>
      this.scheduleVoice(ctx, frequency, now + [.55, 2.25, 4.15, 6.05][i], .92, .009, .07));
  }

  scheduleVoice(ctx, frequency, time, duration, peak, attack) {
    const voice = ctx.createOscillator();
    const volume = ctx.createGain();
    voice.type = 'sine';
    voice.frequency.value = frequency;
    volume.gain.setValueAtTime(.0001, time);
    volume.gain.linearRampToValueAtTime(peak, time + attack);
    volume.gain.setValueAtTime(peak, time + duration * .7);
    volume.gain.exponentialRampToValueAtTime(.0001, time + duration);
    voice.connect(volume).connect(ctx.destination);
    const entry = {voice, volume};
    voice.onended = () => { this.voices.delete(entry); voice.disconnect(); volume.disconnect(); };
    this.voices.add(entry);
    voice.start(time);
    voice.stop(time + duration + .05);
  }

  startAmbience(ctx) {
    const length = Math.floor(ctx.sampleRate * 3);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      const edge = Math.min(1, i / 512, (length - i - 1) / 512);
      samples[i] = (Math.random() * 2 - 1) * edge;
    }
    const source = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const volume = ctx.createGain();
    source.buffer = buffer;
    source.loop = true;
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    volume.gain.value = .019;
    source.connect(filter).connect(volume).connect(ctx.destination);
    source.onended = () => { source.disconnect(); filter.disconnect(); volume.disconnect(); };
    source.start();
    this.ambienceSource = {source, volume, ctx};
  }

  stopMusic() {
    clearInterval(this.musicTimer);
    this.musicTimer = null;
    for (const {voice, volume} of this.voices) {
      volume.gain.cancelScheduledValues?.(voice.context?.currentTime ?? 0);
      volume.gain.setTargetAtTime(.0001, voice.context?.currentTime ?? 0, .04);
      try { voice.stop((voice.context?.currentTime ?? 0) + .22); } catch {}
    }
    this.voices.clear();
  }

  stopAmbience() {
    if (!this.ambienceSource) return;
    const {source, volume, ctx} = this.ambienceSource;
    volume.gain.setTargetAtTime(.0001, ctx.currentTime, .04);
    try { source.stop(ctx.currentTime + .22); } catch {}
    this.ambienceSource = null;
  }

  stop() {
    this.stopMusic();
    this.stopAmbience();
  }
}
