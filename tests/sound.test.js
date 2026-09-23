import test from 'node:test';
import assert from 'node:assert/strict';
import {SoundDesign, normalizeAudioSettings, cueForFrame} from '../sound.js';

test('volume preferences are bounded and existing channels respond to changes', () => {
  assert.deepEqual(normalizeAudioSettings({effects: 160, music: -8, ambience: '80'}),
    {effects: 100, music: 0, ambience: 65});
  assert.deepEqual(normalizeAudioSettings(null), {effects: 80, music: 70, ambience: 65});
  const param = () => ({value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {},
    setTargetAtTime(value) { this.value = value; }});
  const node = () => ({connect() { return this; }, disconnect() {}, start() {}, stop() {}});
  const context = {state: 'running', currentTime: 2, destination: {},
    createGain() { return {...node(), context, gain: param()}; },
    createOscillator() { return {...node(), frequency: param()}; }};
  const design = new SoundDesign(() => context);
  assert.equal(design.play('invalid'), true);
  assert.equal(design.master.gain.value, 1);
  design.setVolume(40);
  assert.equal(design.master.gain.value, .5);
  design.setVolume(0);
  assert.equal(design.play('match'), false);
});

test('special reactions get distinct audio cues before regular cascades', () => {
  assert.equal(cueForFrame({chain: 1, activated: []}), 'match');
  assert.equal(cueForFrame({chain: 3, activated: []}), 'cascade');
  assert.equal(cueForFrame({chain: 2, activated: [{type: 'burst'}]}), 'burst');
  assert.equal(cueForFrame({chain: 2, activated: [{type: 'cross'}, {type: 'burst'}]}), 'cross');
  assert.equal(cueForFrame({chain: 2, activated: [{type: 'cross'}, {type: 'spectrum'}]}), 'spectrum');
});

test('invalid, match, burst and spectrum schedule different original sound shapes', () => {
  const played = [];
  const node = () => ({connect() { return this; }, disconnect() {}, start() {}, stop() { this.onended?.(); }});
  const parameter = () => ({value: 0, setValueAtTime(value) { this.initial = value; },
    exponentialRampToValueAtTime(value) { this.last = value; }});
  const context = {
    currentTime: 2, state: 'running', destination: {},
    createGain() { return {...node(), context, gain: parameter()}; },
    createOscillator() {
      const oscillator = {...node(), frequency: parameter()};
      played.push(oscillator);
      return oscillator;
    }
  };
  const design = new SoundDesign(() => context);
  design.play('invalid');
  assert.equal(played.length, 1);
  assert.equal(played[0].frequency.initial, 235);
  design.play('match', 1);
  assert.equal(played.length, 4);
  design.play('burst');
  assert.equal(played.length, 8);
  assert.equal(played[4].frequency.initial, 190);
  assert.equal(played[4].frequency.last, 63);
  design.play('spectrum');
  assert.equal(played.length, 16);
});
