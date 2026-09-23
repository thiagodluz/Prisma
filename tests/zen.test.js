import test from 'node:test';
import assert from 'node:assert/strict';
import {ZenAudio, normalizeZenSettings, breathTiming} from '../zen.js';

test('Zen preferences accept only known rhythms and effect levels', () => {
  assert.deepEqual(normalizeZenSettings(null),
    {music: false, ambience: false, breath: 'off', effects: 'normal'});
  assert.deepEqual(normalizeZenSettings({music: 'true', ambience: true, breath: 'quick', effects: 'flash'}),
    {music: false, ambience: true, breath: 'off', effects: 'normal'});
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
    exponentialRampToValueAtTime() {}, setTargetAtTime() {}});
  const ctx = {
    state: 'running', currentTime: 0, sampleRate: 32, destination: {},
    createOscillator() { const voice = {...node(), frequency: {value: 0}}; notes.push(voice); return voice; },
    createGain() { return {...node(), gain: param()}; },
    createBuffer() { return {getChannelData: () => new Float32Array(96)}; },
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
    audio.sync({active: false, music: true, ambience: true});
    assert.equal(noises[0].stopAt, .22);
    assert.equal(audio.ambienceSource, null);
  } finally { audio.stop(); }
});
