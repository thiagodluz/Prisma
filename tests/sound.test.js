import test from 'node:test';
import assert from 'node:assert/strict';
import {SoundDesign, cueForFrame} from '../sound.js';

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
