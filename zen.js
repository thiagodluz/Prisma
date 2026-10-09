export const MUSIC_TRACKS = Object.freeze(['magicPuzzle', 'cozyPuzzle', 'spaceCity']);
export const AMBIENCE_SOUNDS = Object.freeze(['stream', 'rain', 'forest', 'rainforest', 'thunder', 'softNoise']);
export const ZEN_DEFAULTS = Object.freeze({music: false, ambience: false, musicTrack: 'cozyPuzzle',
  ambienceSound: 'rain', breath: 'off', effects: 'normal'});

export function normalizeZenSettings(value) {
  return {
    music: value?.music === true,
    ambience: value?.ambience === true,
    musicTrack: MUSIC_TRACKS.includes(value?.musicTrack) ? value.musicTrack : 'cozyPuzzle',
    ambienceSound: AMBIENCE_SOUNDS.includes(value?.ambienceSound) ? value.ambienceSound : 'rain',
    breath: ['off', 'balanced', 'slow'].includes(value?.breath) ? value.breath : 'off',
    effects: ['soft', 'normal', 'vivid'].includes(value?.effects) ? value.effects : 'normal'
  };
}

export const breathTiming = mode => mode === 'balanced' ? [4, 4] : mode === 'slow' ? [4, 6] : null;

const TRACKS = {
  magicPuzzle: {src: 'audio/music/magic-puzzle.ogg'},
  cozyPuzzle: {src: 'audio/music/cozy-puzzle.ogg'},
  spaceCity: {src: 'audio/music/space-city.ogg'}
};
const AMBIENCE = {
  stream: {src: 'audio/ambience/stream.mp3'},
  rain: {src: 'audio/ambience/rain-soft.ogg'},
  forest: {src: 'audio/ambience/forest-cicadas.ogg'},
  rainforest: {src: 'audio/ambience/rainforest.mp3'},
  thunder: {src: 'audio/ambience/rain-thunder.ogg'},
  softNoise: {src: 'audio/ambience/soft-noise.ogg'}
};

export class ZenAudio {
  constructor(_getContext, onStatus = () => {}) {
    this.onStatus = onStatus;
    this.armed = false;
    this.musicSource = null;
    this.ambienceSource = null;
    this.musicVolume = 70;
    this.ambienceVolume = 65;
    this.musicTrack = null;
    this.ambienceSound = null;
  }

  setVolumes({music, ambience}) {
    this.musicVolume = Math.max(0, Math.min(100, Number(music) || 0));
    this.ambienceVolume = Math.max(0, Math.min(100, Number(ambience) || 0));
    if (this.musicSource) this.musicSource.volume = this.musicVolume / 100;
    if (this.ambienceSource) this.ambienceSource.audio.volume = this.ambienceVolume / 100;
  }

  sync({active, music, ambience, musicTrack = 'cozyPuzzle', ambienceSound = 'rain'}) {
    if (!this.armed || !active || (!music && !ambience)) { this.stop(); return; }
    musicTrack = TRACKS[musicTrack] ? musicTrack : 'cozyPuzzle';
    ambienceSound = AMBIENCE[ambienceSound] ? ambienceSound : 'rain';
    if (music) {
      if (this.musicTrack !== musicTrack || !this.musicSource) {
        this.stopMusic();
        this.musicTrack = musicTrack;
        this.musicSource = this.createLoop(TRACKS[musicTrack].src, this.musicVolume / 100, 'music');
      }
      if (this.musicSource.paused) this.playLoop(this.musicSource, 'music');
    } else this.stopMusic();
    if (ambience) {
      if (this.ambienceSound !== ambienceSound || !this.ambienceSource) {
        this.stopAmbience();
        this.ambienceSound = ambienceSound;
        this.ambienceSource = {audio: this.createLoop(AMBIENCE[ambienceSound].src,
          this.ambienceVolume / 100, 'ambience')};
      }
      if (this.ambienceSource.audio.paused) this.playLoop(this.ambienceSource.audio, 'ambience');
    } else this.stopAmbience();
  }

  currentSource(channel) {
    return channel === 'music' ? this.musicSource : this.ambienceSource?.audio;
  }

  createLoop(src, volume, channel) {
    const audio = new Audio(src);
    audio.preload = 'auto';
    audio.loop = true;
    audio.volume = volume;
    audio.onerror = () => {
      if (this.currentSource(channel) === audio)
        this.onStatus(channel, new Error(audio.error?.message || 'Não foi possível carregar o áudio'));
    };
    return audio;
  }

  playLoop(audio, channel) {
    try {
      Promise.resolve(audio.play()).then(() => {
        if (this.currentSource(channel) === audio) this.onStatus(channel, null);
      }).catch(error => {
        if (this.currentSource(channel) === audio && error.name !== 'AbortError')
          this.onStatus(channel, error);
      });
    } catch (error) { this.onStatus(channel, error); }
  }

  releaseLoop(audio) {
    if (!audio) return;
    audio.onerror = null;
    audio.pause();
    audio.removeAttribute?.('src');
    audio.load?.();
  }

  stopMusic() {
    const audio = this.musicSource;
    this.musicSource = null;
    this.musicTrack = null;
    this.releaseLoop(audio);
    this.onStatus('music', null);
  }

  stopAmbience() {
    const audio = this.ambienceSource?.audio;
    this.ambienceSource = null;
    this.ambienceSound = null;
    this.releaseLoop(audio);
    this.onStatus('ambience', null);
  }

  stop() {
    this.stopMusic();
    this.stopAmbience();
  }
}
