import test from 'node:test';
import assert from 'node:assert/strict';
import {ZenAudio, normalizeZenSettings, breathTiming, MUSIC_TRACKS, AMBIENCE_SOUNDS} from '../zen.js';

test('Zen preferences accept only approved recordings and effect levels', () => {
  assert.deepEqual(normalizeZenSettings(null),
    {music: false, ambience: false, musicTrack: 'cozyPuzzle', ambienceSound: 'rain',
      breath: 'off', effects: 'normal'});
  assert.deepEqual(normalizeZenSettings({music: 'true', ambience: true, breath: 'quick', effects: 'flash'}),
    {music: false, ambience: true, musicTrack: 'cozyPuzzle', ambienceSound: 'rain',
      breath: 'off', effects: 'normal'});
  assert.deepEqual(breathTiming('balanced'), [4, 4]);
  assert.deepEqual(breathTiming('slow'), [4, 6]);
  assert.equal(breathTiming('off'), null);
});

function fakeMedia(run) {
  const created = [];
  const previous = globalThis.Audio;
  globalThis.Audio = class {
    constructor(src) { this.src = src; this.paused = true; this.plays = 0; created.push(this); }
    play() { this.plays++; this.paused = false; return Promise.resolve(); }
    pause() { this.paused = true; }
    removeAttribute() { this.released = true; }
    load() {}
  };
  return Promise.resolve().then(() => run(created)).finally(() => {
    if (previous === undefined) delete globalThis.Audio;
    else globalThis.Audio = previous;
  });
}

const tick = () => new Promise(resolve => setImmediate(resolve));

test('recordings start independently, preserve the other channel, and release media on pause', () => fakeMedia(async created => {
  const audio = new ZenAudio(() => { throw new Error('recordings do not need Web Audio'); });
  audio.setVolumes({music: 40, ambience: 30});
  audio.sync({active: true, music: true, ambience: true});
  assert.equal(created.length, 0, 'restored preferences never autoplay');
  audio.armed = true;
  audio.sync({active: true, music: true, ambience: true, musicTrack: 'cozyPuzzle', ambienceSound: 'stream'});
  await tick();
  assert.deepEqual(created.map(sound => sound.src), ['audio/music/cozy-puzzle.ogg', 'audio/ambience/stream.mp3']);
  assert.equal(created.every(sound => sound.loop), true);
  assert.deepEqual(created.map(sound => sound.volume), [.4, .3]);
  const stream = audio.ambienceSource.audio;
  audio.sync({active: true, music: true, ambience: true, musicTrack: 'spaceCity', ambienceSound: 'stream'});
  assert.equal(audio.ambienceSource.audio, stream, 'changing music does not restart ambience');
  assert.equal(created[0].released, true);
  audio.setVolumes({music: 0, ambience: 15});
  assert.equal(audio.musicSource.volume, 0);
  assert.equal(stream.volume, .15);
  audio.sync({active: false, music: true, ambience: true});
  assert.equal(created.every(sound => sound.paused && sound.released), true);
  assert.equal(audio.musicSource, null);
  assert.equal(audio.ambienceSource, null);
}));

test('a mobile autoplay rejection is reported and retried on the next interaction', () => fakeMedia(async created => {
  const reports = [];
  const audio = new ZenAudio(null, (channel, error) => { if (error) reports.push([channel, error.name]); });
  audio.armed = true;
  audio.sync({active: true, music: true, ambience: false});
  await tick();
  const media = created[0];
  media.paused = true;
  media.play = () => Promise.reject(Object.assign(new Error('gesture required'), {name: 'NotAllowedError'}));
  audio.sync({active: true, music: true, ambience: false});
  await tick();
  assert.deepEqual(reports, [['music', 'NotAllowedError']]);
  let retried = false;
  media.play = () => { retried = true; media.paused = false; return Promise.resolve(); };
  audio.sync({active: true, music: true, ambience: false});
  await tick();
  assert.equal(retried, true);
  audio.stop();
}));

test('obsolete playback failures cannot overwrite the status of a replacement track', () => fakeMedia(async created => {
  const reports = [];
  const audio = new ZenAudio(null, (channel, error) => { if (error) reports.push(channel); });
  audio.armed = true;
  audio.sync({active: true, music: true, ambience: false});
  const media = created[0];
  let reject;
  media.paused = true;
  media.play = () => new Promise((_resolve, fail) => { reject = fail; });
  audio.sync({active: true, music: true, ambience: false});
  audio.sync({active: true, music: true, ambience: false, musicTrack: 'spaceCity'});
  reject(new Error('old load failed'));
  await tick();
  assert.deepEqual(reports, []);
  audio.stop();
}));
