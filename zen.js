export const MUSIC_TRACKS = Object.freeze(['sereno', 'cidade', 'jardim', 'horizonte', 'estrelas',
  'magicPuzzle', 'cozyPuzzle', 'spaceCity']);
export const AMBIENCE_SOUNDS = Object.freeze(['white', 'stream', 'rain', 'storm', 'field', 'forest', 'rainforest']);
export const ZEN_DEFAULTS = Object.freeze({music: false, ambience: false, musicTrack: 'cozyPuzzle',
  ambienceSound: 'white', breath: 'off', effects: 'normal'});

export function normalizeZenSettings(value) {
  return {
    music: value?.music === true,
    ambience: value?.ambience === true,
    musicTrack: MUSIC_TRACKS.includes(value?.musicTrack) ? value.musicTrack : 'cozyPuzzle',
    ambienceSound: AMBIENCE_SOUNDS.includes(value?.ambienceSound) ? value.ambienceSound : 'white',
    breath: ['off', 'balanced', 'slow'].includes(value?.breath) ? value.breath : 'off',
    effects: ['soft', 'normal', 'vivid'].includes(value?.effects) ? value.effects : 'normal'
  };
}

export const breathTiming = mode => mode === 'balanced' ? [4, 4] : mode === 'slow' ? [4, 6] : null;

// Five original, procedural compositions. Each has its own progression, pace and melody.
const TRACKS = {
  sereno: {seconds: 7.6, wave: 'sine', pad: .013, lead: .009, attack: 1.1,
    times: [.55, 2.25, 4.15, 6.05], phrases: [
      [[130.81, 196, 261.63], [523.25, 392, 440, 523.25]],
      [[174.61, 220, 261.63], [440, 523.25, 659.25, 523.25]],
      [[164.81, 196, 246.94], [493.88, 392, 329.63, 392]],
      [[146.83, 220, 293.66], [440, 587.33, 523.25, 392]]]},
  cidade: {seconds: 6.4, wave: 'triangle', pad: .008, lead: .005, attack: 1.4,
    times: [.4, 1.85, 3.45, 4.95], phrases: [
      [[146.83, 220, 261.63], [349.23, 440, 523.25, 440]],
      [[130.81, 196, 246.94], [392, 493.88, 587.33, 493.88]],
      [[110, 164.81, 220], [329.63, 392, 440, 329.63]],
      [[116.54, 174.61, 233.08], [349.23, 466.16, 392, 349.23]]]},
  jardim: {seconds: 8.8, wave: 'sine', pad: .011, lead: .007, attack: 1.8,
    times: [.85, 3.05, 5.1, 7.35], phrases: [
      [[146.83, 220, 293.66], [587.33, 523.25, 440, 349.23]],
      [[130.81, 196, 293.66], [392, 440, 523.25, 392]],
      [[174.61, 261.63, 349.23], [698.46, 587.33, 523.25, 440]],
      [[164.81, 246.94, 329.63], [493.88, 392, 329.63, 392]]]},
  horizonte: {seconds: 9.2, wave: 'sine', pad: .012, lead: .007, attack: 2.4,
    times: [1.1, 3.3, 5.55, 7.75], phrases: [
      [[110, 164.81, 220], [440, 329.63, 392, 493.88]],
      [[98, 146.83, 196], [392, 293.66, 329.63, 440]],
      [[130.81, 196, 261.63], [523.25, 392, 440, 587.33]],
      [[123.47, 185, 246.94], [493.88, 369.99, 329.63, 493.88]]]},
  estrelas: {seconds: 7.2, wave: 'sine', pad: .009, lead: .008, attack: 1.5,
    times: [.3, 1.95, 3.9, 5.85], phrases: [
      [[130.81, 196, 293.66], [783.99, 587.33, 659.25, 523.25]],
      [[146.83, 220, 329.63], [880, 659.25, 587.33, 659.25]],
      [[110, 164.81, 246.94], [739.99, 493.88, 554.37, 493.88]],
      [[123.47, 185, 277.18], [554.37, 739.99, 659.25, 554.37]]]},
  magicPuzzle: {src: 'audio/music/magic-puzzle.ogg'},
  cozyPuzzle: {src: 'audio/music/cozy-puzzle.ogg'},
  spaceCity: {src: 'audio/music/space-city.ogg'}
};

const AMBIENCE = {
  white: {filter: 420, gain: .024}, stream: {src: 'audio/ambience/stream.mp3', gain: .7},
  rain: {src: 'audio/ambience/rain.ogg', gain: .7}, storm: {filter: 2300, gain: .038},
  field: {filter: 2700, gain: .032}, forest: {src: 'audio/ambience/forest.mp3', gain: .65},
  rainforest: {src: 'audio/ambience/rainforest.mp3', gain: .65}
};

// Synthetic soundscapes: flowing bubbles, rain, distant thunder, birds and crickets.
function ambienceBuffer(ctx, kind) {
  const length = Math.floor(ctx.sampleRate * 6);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const samples = buffer.getChannelData(0);
  let slow = 0, fast = 0;
  for (let i = 0; i < length; i++) {
    const t = i / ctx.sampleRate;
    const noise = Math.random() * 2 - 1;
    slow += (noise - slow) * .002;
    fast += (noise - fast) * .12;
    let sample;
    if (kind === 'stream') {
      const bubble = Math.sin(2 * Math.PI * (260 + 90 * Math.sin(t * 1.7)) * t) *
        Math.pow(Math.max(0, Math.sin(t * 16)), 12);
      sample = fast * (.34 + .15 * Math.sin(t * 2.4)) + slow * 2 + bubble * .14;
    } else if (kind === 'rain') {
      sample = noise * .42 + fast * .4 + (Math.random() < .0007 ? .75 : 0);
    } else if (kind === 'storm') {
      const thunder = Math.exp(-Math.pow((t - 2.5) / .9, 2)) +
        .7 * Math.exp(-Math.pow((t - 4.4) / .65, 2));
      sample = noise * .42 + fast * .25 + slow * thunder * 14;
    } else if (kind === 'field') {
      const cricket = Math.pow(Math.max(0, Math.sin(t * 25)), 14) *
        Math.sin(2 * Math.PI * 2100 * t);
      const bird = [1.25, 3.1, 4.7].reduce((sum, start) => {
        const s = t - start;
        return sum + (s >= 0 && s < .3 ? Math.sin(2 * Math.PI * (790 * s + 420 * s * s)) *
          Math.sin(Math.PI * s / .3) : 0);
      }, 0);
      sample = slow * 2 + cricket * .2 + bird * .5;
    } else sample = noise * .75 + slow;
    const edge = Math.min(1, i / (ctx.sampleRate * .06), (length - 1 - i) / (ctx.sampleRate * .06));
    samples[i] = sample * Math.max(0, edge);
  }
  return buffer;
}

export class ZenAudio {
  constructor(getContext) {
    this.getContext = getContext;
    this.armed = false;
    this.musicTimer = null;
    this.voices = new Set();
    this.ambienceSource = null;
    this.musicSource = null;
    this.musicOutput = null;
    this.musicVolume = 70;
    this.ambienceVolume = 65;
    this.chord = 0;
    this.musicTrack = null;
    this.ambienceSound = null;
  }

  setVolumes({music, ambience}) {
    this.musicVolume = Math.max(0, Math.min(100, Number(music) || 0));
    this.ambienceVolume = Math.max(0, Math.min(100, Number(ambience) || 0));
    if (this.musicSource) this.musicSource.volume = this.musicVolume / 100;
    else if (this.musicOutput) this.musicOutput.gain.setTargetAtTime(
      this.musicVolume / 50, this.musicOutput.context.currentTime, .04);
    if (this.ambienceSource?.audio) this.ambienceSource.audio.volume = this.ambienceVolume / 100;
    else if (this.ambienceSource) this.ambienceSource.volume.gain.setTargetAtTime(
      this.ambienceVolume / 65 * AMBIENCE[this.ambienceSound].gain,
      this.ambienceSource.ctx.currentTime, .04);
  }

  sync({active, music, ambience, musicTrack = 'sereno', ambienceSound = 'white'}) {
    if (!this.armed || !active || (!music && !ambience)) { this.stop(); return; }
    musicTrack = TRACKS[musicTrack] ? musicTrack : 'cozyPuzzle';
    ambienceSound = AMBIENCE[ambienceSound] ? ambienceSound : 'white';
    try {
      const track = TRACKS[musicTrack];
      const soundscape = AMBIENCE[ambienceSound];
      let ctx;
      const audioContext = () => {
        ctx ??= this.getContext();
        if (ctx.state !== 'running') ctx.resume().catch?.(() => {});
        return ctx;
      };
      if (music && (this.musicTrack !== musicTrack ||
          (track.src ? !this.musicSource : !this.musicTimer))) {
        this.stopMusic();
        this.musicTrack = musicTrack;
        if (track.src) this.musicSource = this.createLoop(track.src, this.musicVolume / 100);
        else {
          const context = audioContext();
          if (!this.musicOutput || this.musicOutput.context !== context) {
            this.musicOutput = context.createGain();
            this.musicOutput.gain.value = this.musicVolume / 50;
            this.musicOutput.connect(context.destination);
          }
          this.playChord(context);
          this.musicTimer = setInterval(() => {
            if (context.state === 'running') this.playChord(context);
          }, track.seconds * 1000);
        }
      } else if (!music) this.stopMusic();
      if (ambience && (this.ambienceSound !== ambienceSound || !this.ambienceSource)) {
        this.stopAmbience();
        this.ambienceSound = ambienceSound;
        this.startAmbience(soundscape.src ? null : audioContext());
      }
      else if (!ambience) this.stopAmbience();
    } catch { this.stop(); /* Audio can be unavailable in local-file views. */ }
  }

  playChord(ctx) {
    const track = TRACKS[this.musicTrack];
    const [pad, melody] = track.phrases[this.chord++ % track.phrases.length];
    const now = ctx.currentTime;
    pad.forEach(frequency => this.scheduleVoice(ctx, frequency, now, track.seconds,
      track.pad, track.attack, 'sine'));
    melody.forEach((frequency, i) => this.scheduleVoice(ctx, frequency,
      now + track.times[i], Math.min(1.25, track.seconds - track.times[i] - .1),
      track.lead, .07, track.wave));
  }

  scheduleVoice(ctx, frequency, time, duration, peak, attack, wave) {
    const voice = ctx.createOscillator();
    const volume = ctx.createGain();
    voice.type = wave;
    voice.frequency.value = frequency;
    volume.gain.setValueAtTime(.0001, time);
    volume.gain.linearRampToValueAtTime(peak, time + attack);
    volume.gain.setValueAtTime(peak, time + duration * .7);
    volume.gain.exponentialRampToValueAtTime(.0001, time + duration);
    voice.connect(volume).connect(this.musicOutput);
    const entry = {voice, volume};
    voice.onended = () => { this.voices.delete(entry); voice.disconnect(); volume.disconnect(); };
    this.voices.add(entry);
    voice.start(time);
    voice.stop(time + duration + .05);
  }

  startAmbience(ctx) {
    if (AMBIENCE[this.ambienceSound].src) {
      this.ambienceSource = {audio: this.createLoop(AMBIENCE[this.ambienceSound].src,
        this.ambienceVolume / 100)};
      return;
    }
    const source = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const volume = ctx.createGain();
    source.buffer = ambienceBuffer(ctx, this.ambienceSound);
    source.loop = true;
    filter.type = 'lowpass';
    filter.frequency.value = AMBIENCE[this.ambienceSound].filter;
    volume.gain.value = this.ambienceVolume / 65 * AMBIENCE[this.ambienceSound].gain;
    source.connect(filter).connect(volume).connect(ctx.destination);
    source.onended = () => { source.disconnect(); filter.disconnect(); volume.disconnect(); };
    source.start();
    this.ambienceSource = {source, volume, ctx};
  }

  stopMusic() {
    clearInterval(this.musicTimer);
    this.musicTimer = null;
    this.musicTrack = null;
    this.musicSource?.pause();
    this.musicSource = null;
    this.chord = 0;
    for (const {voice, volume} of this.voices) {
      volume.gain.cancelScheduledValues?.(voice.context?.currentTime ?? 0);
      volume.gain.setTargetAtTime(.0001, voice.context?.currentTime ?? 0, .04);
      try { voice.stop((voice.context?.currentTime ?? 0) + .22); } catch {}
    }
    this.voices.clear();
  }

  stopAmbience() {
    if (!this.ambienceSource) return;
    if (this.ambienceSource.audio) {
      this.ambienceSource.audio.pause();
      this.ambienceSource = null;
      this.ambienceSound = null;
      return;
    }
    const {source, volume, ctx} = this.ambienceSource;
    volume.gain.setTargetAtTime(.0001, ctx.currentTime, .04);
    try { source.stop(ctx.currentTime + .22); } catch {}
    this.ambienceSource = null;
    this.ambienceSound = null;
  }

  stop() {
    this.stopMusic();
    this.stopAmbience();
  }

  createLoop(src, volume) {
    const audio = new Audio(src);
    audio.preload = 'auto';
    audio.loop = true;
    audio.volume = volume;
    audio.play().catch?.(() => {});
    return audio;
  }
}
