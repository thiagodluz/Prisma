import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Game} from '../engine.js';

test('Classic records survive closing during a finishing move without counting it twice', async () => {
  const seed = new Game();
  seed.newGame('classic');
  const hint = seed.hint();
  assert.ok(hint);
  const storage = new Map([
    ['prisma.activeMode', 'classic'],
    ['prisma.session.classic', JSON.stringify({mode: seed.mode, score: seed.score,
      board: seed.board, ended: false, progressionVersion: 4, level: seed.level,
      levelStartScore: seed.levelStartScore, progressionOffset: seed.progressionOffset})]
  ]);
  globalThis.localStorage = {
    getItem(key) { return storage.get(key) ?? null; },
    setItem(key, value) { storage.set(key, String(value)); }
  };

  const elements = new Map();
  const makeElement = () => {
    const classes = new Set();
    return {
      children: [], dataset: {}, handlers: {}, hidden: false,
      style: {setProperty() {}},
      classList: {
        add(name) { classes.add(name); },
        remove(name) { classes.delete(name); },
        toggle(name, enabled) { if (enabled) classes.add(name); else classes.delete(name); },
        contains(name) { return classes.has(name); }
      },
      setAttribute() {},
      addEventListener(name, handler) { this.handlers[name] = handler; },
      append(child) { this.children.push(child); },
      replaceChildren(...children) { this.children = children; },
      closest(selector) { return selector === '.cell' ? this : null; },
      querySelector(selector) { return selector === '.mover' ? this.children[0] : null; },
      getBoundingClientRect() {
        const index = Number(this.dataset.index || 0);
        return {left: index % 8 * 50, top: Math.floor(index / 8) * 50,
          width: 48, height: 48};
      },
      animate() {
        let reject;
        const finished = new Promise((_, fail) => { reject = fail; });
        return {finished, cancel() { reject(new Error('cancelled')); }};
      }
    };
  };
  const board = makeElement();
  board.querySelectorAll = selector => selector === '.cell' ? board.children : [];
  elements.set('#board', board);
  globalThis.document = {
    documentElement: {dataset: {}}, visibilityState: 'visible', handlers: {},
    addEventListener(name, handler) { this.handlers[name] = handler; },
    querySelector(selector) {
      if (!elements.has(selector)) elements.set(selector, makeElement());
      return elements.get(selector);
    },
    querySelectorAll() { return []; },
    createElement() { return makeElement(); }
  };
  globalThis.window = {matchMedia: () => ({matches: false})};
  Object.defineProperty(globalThis, 'navigator', {value: {}, configurable: true});
  await import('../app.js?records-first');

  const {version} = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)));
  const {Game: AppGame} = await import(`../engine.js?v=${version}`);
  const originalHasMove = AppGame.prototype.hasMove;
  try {
    // Leave the real move and cascade intact, but make their resulting board end Classic.
    AppGame.prototype.hasMove = () => false;
    for (const index of [hint.a, hint.b]) board.handlers.keydown({
      target: board.children[index], key: 'Enter', preventDefault() {}
    });

    const session = JSON.parse(storage.get('prisma.session.classic'));
    const record = JSON.parse(storage.get('prisma.records.classic'));
    assert.equal(session.ended, true);
    assert.ok(session.score > 0);
    assert.equal(record.bestMove, session.score);
    assert.equal(record.bestScore, session.score);
    assert.equal(record.finished, 1);
    assert.equal(board.classList.contains('busy'), true, 'animation is still pending');
    assert.equal(elements.get('#score').textContent, '0', 'HUD has not finished');
  } finally {
    AppGame.prototype.hasMove = originalHasMove;
    document.handlers['prisma:pause']();
  }
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(JSON.parse(storage.get('prisma.records.classic')).finished, 1);

  // A fresh module import models reopening the app with only persisted storage.
  await import('../app.js?records-reopened');
  assert.equal(JSON.parse(storage.get('prisma.records.classic')).finished, 1);
  assert.equal(elements.get('#record-classic-finished').textContent, '1');
});
