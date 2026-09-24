import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../engine.js';

test('invalid Classic save cannot overwrite an existing Zen game on page hide', async () => {
  const zen = new Game();
  const zenSave = JSON.stringify({mode: 'zen', score: 12345, board: zen.board,
    progressionVersion: 2, level: 6, levelStartScore: 5 * 1800 + 10 * 150});
  // Use a valid game score but keep the original raw bytes to detect any overwrite.
  const data = new Map([
    ['prisma.activeMode', 'classic'], ['prisma.session.classic', '{corrompido'],
    ['prisma.session.zen', zenSave]
  ]);
  globalThis.localStorage = {
    getItem(key) { return data.get(key) ?? null; },
    setItem(key, value) { data.set(key, String(value)); }
  };
  const elements = new Map();
  const makeElement = () => ({
    children: [], dataset: {}, style: {setProperty() {}},
    classList: {add() {}, remove() {}, toggle() {}},
    setAttribute() {}, addEventListener() {},
    append(child) { this.children.push(child); },
    replaceChildren(...children) { this.children = children; }
  });
  globalThis.document = {
    documentElement: {dataset: {}},
    querySelector(selector) {
      if (!elements.has(selector)) elements.set(selector, makeElement());
      return elements.get(selector);
    },
    querySelectorAll() { return []; },
    createElement() { return makeElement(); }
  };
  const listeners = {};
  globalThis.window = {addEventListener(name, fn) { listeners[name] = fn; }};
  Object.defineProperty(globalThis, 'navigator', {value: {}, configurable: true});
  await import('../app.js?save-recovery');
  listeners.pagehide();
  assert.equal(data.get('prisma.session.zen'), zenSave);
  assert.equal(data.get('prisma.activeMode'), 'classic');
  assert.equal(data.get('prisma.session.classic.corrupt'), '{corrompido');
  assert.equal(JSON.parse(data.get('prisma.session.classic')).mode, 'classic');
});
