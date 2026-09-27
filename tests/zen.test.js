import test from 'node:test';
import assert from 'node:assert/strict';
import {ZenAudio, normalizeZenSettings, breathTiming, MUSIC_TRACKS, AMBIENCE_SOUNDS} from '../zen.js';

test('Zen preferences accept only known rhythms and effect levels', () => {
  assert.deepEqual(normalizeZenSettings(null),
    {music: false, ambience: false, musicTrack: 'sereno', ambienceSound: 'white',
      breath: 'off', effects: 'normal'});
  assert.deepEqual(normalizeZenSettings({music: 'true', ambience: true, breath: 'quick', effects: 'flash'}),
    {music: false, ambience: true, musicTrack: 'sereno', ambienceSound: 'white',
      breath: 'off', effects: 'normal'});
  assert.equal(MUSIC_TRACKS.length, 5);
  assert.equal(AMBIENCE_SOUNDS.length, 5);
  assert.equal(normalizeZenSettings({musicTrack: 'unknown', ambienceSound: 'unknown'}).musicTrack, 'sereno');
  assert.deepEqual(breathTiming('balanced'), [4, 4]);
  assert.deepEqual(breathTiming('slow'), [4, 6]);
  assert.equal(breathTiming('off'), null);
});

test('music and ambience start independently and both stop outside Zen', () => {
  const notes = [];
  const noises = [];
  const node = () => ({connect() { return this; }, disconnect() {}, start() { this.started = true; },
    stop(time) { this.stopAt = time; if (time === undefined) { this.stopped = true; this.onended?.(); } }});
  const param = () => ({value: 0, setValueAtTime() {}, linearRampToValueAtTime() {},
    exponentialRampToValueAtTime() {}, setTargetAtTime(value) { this.target = value; }});
  const ctx = {
    state: 'running', currentTime: 0, sampleRate: 32, destination: {},
    createOscillator() { const voice = {...node(), frequency: {value: 0}}; notes.push(voice); return voice; },
    createGain() { return {...node(), context: ctx, gain: param()}; },
    createBuffer(_channels, length) { return {getChannelData: () => new Float32Array(length)}; },
    createBufferSource() { const source = node(); noises.push(source); return source; },
    createBiquadFilter() { return {...node(), frequency: {value: 0}}; }
  };
  const audio = new ZenAudio(() => ctx);
  try {
    audio.sync({active: true, music: true, ambience: true});
    assert.equal(notes.length, 0); // Restored choices never autoplay on page load.
    audio.armed = true;
    audio.sync({active: true, music: true, ambience: false});
    assert.equal(notes.length, 7);
    assert.equal(noises.length, 0);
    audio.sync({active: true, music: false, ambience: true});
    assert.equal(audio.musicTimer, null);
    assert.equal(notes.every(note => note.stopAt === .22), true);
    assert.equal(noises.length, 1);
    audio.setVolumes({music: 40, ambience: 30});
    assert.equal(audio.musicOutput.gain.target, .8);
    assert.equal(audio.ambienceSource.volume.gain.target, 30 / 65 * .024);
    for (const sound of AMBIENCE_SOUNDS) {
      audio.sync({active: true, music: false, ambience: true, ambienceSound: sound});
      assert.equal(audio.ambienceSound, sound);
      assert.equal(audio.ambienceSource.source.started, true);
    }
    assert.equal(noises.length, 5);
    audio.sync({active: true, music: true, ambience: true, musicTrack: 'cidade', ambienceSound: 'field'});
    assert.equal(audio.musicTrack, 'cidade');
    assert.equal(notes.at(-1).type, 'triangle');
    const oldVoice = notes.at(-1);
    audio.sync({active: true, music: true, ambience: true, musicTrack: 'estrelas', ambienceSound: 'field'});
    assert.equal(oldVoice.stopAt, .22);
    assert.equal(audio.musicTrack, 'estrelas');
    assert.equal(noises.length, 5); // Changing music does not restart the ambience.
    audio.sync({active: false, music: true, ambience: true});
    assert.equal(noises[0].stopAt, .22);
    assert.equal(audio.ambienceSource, null);
  } finally { audio.stop(); }
});
