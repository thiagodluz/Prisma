import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../engine.js';

test('drag commits before animation and settles on Android pause or page hide', async () => {
  const seed = new Game();
  const hint = seed.hint();
  assert.ok(hint);
  const saved = {mode: seed.mode, score: seed.score, board: seed.board,
    level: seed.level, levelStartScore: seed.levelStartScore, progressionVersion: 2};
  const expected = new Game();
  assert.ok(expected.restore(saved));
  assert.equal(expected.move(hint.a, hint.b).valid, true);
  const storage = new Map([['prisma.session.zen', JSON.stringify(saved)]]);
  globalThis.localStorage = {
    getItem(key) { return storage.get(key) ?? null; },
    setItem(key, value) { storage.set(key, String(value)); }
  };
  const elements = new Map();
  const animations = [];
  const makeElement = () => {
    const classes = new Set();
    return {
      children: [], dataset: {}, style: {}, handlers: {}, hidden: false,
      classList: {
        add(...names) { names.forEach(name => classes.add(name)); },
        remove(...names) { names.forEach(name => classes.delete(name)); },
        toggle(name, value) { if (value) classes.add(name); else classes.delete(name); },
        contains(name) { return classes.has(name); }
      },
      setAttribute() {},
      addEventListener(name, listener) { this.handlers[name] = listener; },
      append(child) { this.children.push(child); },
      replaceChildren(...children) { this.children = children; },
      querySelector(selector) { return selector === '.mover' ? this.children[0] : null; },
      getBoundingClientRect() {
        const index = Number(this.dataset.index || 0);
        return {left: index % 8 * 50, top: Math.floor(index / 8) * 50,
          width: 48, height: 48};
      },
      animate() {
        let reject;
        const finished = new Promise((_, fail) => { reject = fail; });
        const animation = {finished, cancel() { reject(new Error('cancelled')); }};
        animations.push(animation);
        return animation;
      },
      remove() {}
    };
  };
  const modes = ['zen', 'classic'].map(mode => {
    const button = makeElement(); button.dataset.mode = mode; return button;
  });
  const board = makeElement();
  board.querySelectorAll = selector => selector === '.cell' ? board.children :
    board.children.filter(cell => selector.includes('.cell.') &&
      (cell.classList.contains('pressed') || cell.classList.contains('drag-target')));
  board.setPointerCapture = () => {};
  board.releasePointerCapture = () => {};
  elements.set('#board', board);
  globalThis.document = {
    documentElement: {dataset: {}},
    visibilityState: 'visible', handlers: {},
    addEventListener(name, listener) { this.handlers[name] = listener; },
    querySelector(selector) {
      if (!elements.has(selector)) elements.set(selector, makeElement());
      return elements.get(selector);
    },
    querySelectorAll(selector) { return selector === '.mode' ? modes : []; },
    createElement() { return makeElement(); }
  };
  globalThis.window = {matchMedia: () => ({matches: false})};
  const vibrations = [];
  Object.defineProperty(globalThis, 'navigator', {value: {vibrate: value => vibrations.push(value)}, configurable: true});
  await import('../app.js?touch-resume');

  elements.get('#vibration').handlers.click();
  assert.equal(storage.get('prisma.vibration'), 'on');
  const from = board.children[hint.a];
  const dx = (hint.b % 8 - hint.a % 8) * 50;
  const dy = (Math.floor(hint.b / 8) - Math.floor(hint.a / 8)) * 50;
  const start = {pointerId: 1, clientX: 0, clientY: 0, target: {closest: () => from}};
  board.handlers.pointerdown(start);
  board.handlers.pointermove({...start, clientX: dx, clientY: dy});
  assert.equal(board.children[hint.b].classList.contains('drag-target'), true);
  board.handlers.pointerup({...start, clientX: dx, clientY: dy});
  assert.equal(board.children[hint.b].classList.contains('drag-target'), false);
  const committed = JSON.parse(storage.get('prisma.session.zen'));
  assert.ok(committed.score > saved.score);
  assert.equal(elements.get('#score-gain').textContent,
    `+${(committed.score - saved.score).toLocaleString('pt-BR')}`);
  assert.equal(elements.get('#score-gain').classList.contains('visible'), true);
  assert.notDeepEqual(committed.board, saved.board);
  assert.equal(board.classList.contains('busy'), true);
  assert.ok(vibrations.length >= 2);
  assert.ok(animations.length > 0);

  document.handlers['prisma:pause']();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(board.classList.contains('busy'), false);
  assert.equal(elements.get('#score-gain').classList.contains('visible'), true);
  assert.deepEqual(JSON.parse(storage.get('prisma.session.zen')).board, committed.board);
  document.handlers['prisma:resume']();
  document.visibilityState = 'hidden';
  document.handlers.visibilitychange();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(board.classList.contains('busy'), false);
  assert.deepEqual(board.children.map(cell => Number(cell.dataset.tileId)), committed.board.flat().map(tile => tile.id));
});
