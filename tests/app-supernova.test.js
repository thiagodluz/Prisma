import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../engine.js';

test('Supernova interface charges before awarding points and settles with reduced motion or pause', async () => {
  for (const mode of ['normal', 'reduced', 'pause']) {
    const game = new Game();
    game.board = Array.from({length: 8}, (_, r) => Array.from({length: 8}, (_, c) => game.gem((r * 3 + c * 2) % 7)));
    for (const [index, color, type] of [[26, 2, 'burst'], [27, 2, 'burst'], [28, 1, 'normal'], [20, 2, 'burst']])
      game.set(index, game.gem(color, type));
    const saved = {mode: 'zen', score: 0, board: game.board, level: 1,
      levelStartScore: 0, progressionVersion: 4, progressionOffset: 0};
    const storage = new Map([['prisma.session.zen', JSON.stringify(saved)]]);
    globalThis.localStorage = {getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value)};
    const elements = new Map(), animations = [];
    let chargeStarted;
    const charge = new Promise(resolve => { chargeStarted = resolve; });
    const makeElement = () => {
      const classes = new Set();
      return {
        children: [], dataset: {}, style: {}, handlers: {}, className: '', hidden: false,
        classList: {add: (...names) => names.forEach(name => classes.add(name)),
          remove: (...names) => names.forEach(name => classes.delete(name)),
          toggle(name, value) { if (value) classes.add(name); else classes.delete(name); },
          contains: name => classes.has(name)},
        setAttribute() {}, addEventListener(name, listener) { this.handlers[name] = listener; },
        append(child) { child.parent = this; this.children.push(child); },
        replaceChildren(...children) { this.children = children; },
        remove() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); },
        closest: function() { return this; },
        querySelector(selector) { return selector === '.mover' ? this.children[0] : null; },
        getBoundingClientRect() { const i = Number(this.dataset.index || 0);
          return {left: i % 8 * 50, top: Math.floor(i / 8) * 50, width: 48, height: 48}; },
        animate(keyframes, options) {
          animations.push({className: this.className, keyframes, options, style: {...this.style},
            score: elements.get('#score').textContent});
          const fusion = this.className === 'effect-fusion';
          if (fusion) chargeStarted();
          let cancel;
          const finished = mode === 'pause' && fusion ? new Promise(resolve => { cancel = resolve; }) : Promise.resolve();
          return {finished, cancel: () => cancel?.()};
        }
      };
    };
    const board = makeElement();
    board.querySelectorAll = selector => selector === '.cell' ? board.children : [];
    elements.set('#board', board);
    globalThis.document = {documentElement: {dataset: {}}, visibilityState: 'visible', handlers: {},
      addEventListener(name, handler) { this.handlers[name] = handler; },
      querySelector(selector) { if (!elements.has(selector)) elements.set(selector, makeElement()); return elements.get(selector); },
      querySelectorAll: () => [], createElement: makeElement};
    globalThis.window = {matchMedia: () => ({matches: mode === 'reduced'})};
    Object.defineProperty(globalThis, 'navigator', {value: {}, configurable: true});
    await import(`../app.js?supernova-${mode}`);
    for (const index of [20, 28]) board.handlers.keydown({target: board.children[index], key: 'Enter', preventDefault() {}});
    if (mode !== 'reduced') {
      await charge;
      assert.equal(elements.get('#score').textContent, '0');
      if (mode === 'pause') document.handlers['prisma:pause']();
    }
    for (let i = 0; i < 20 && board.classList.contains('busy'); i++) await new Promise(resolve => setImmediate(resolve));
    assert.equal(board.classList.contains('busy'), false);
    const session = JSON.parse(storage.get('prisma.session.zen'));
    assert.ok(session.score >= 625);
    assert.equal(elements.get('#score').textContent, session.score.toLocaleString('pt-BR'));
    assert.equal(board.children.length, 64);
    assert.equal(elements.get('.board-frame').children.find(child => child.className === 'effect-layer').children.length, 0);
    const waves = animations.filter(animation => animation.className === 'effect-supernova');
    if (mode === 'normal') {
      assert.equal(waves.length, 1);
      assert.equal(waves[0].style.width, '250px');
      assert.equal(waves[0].style['--nova-color'], '#ffe36b');
      assert.equal(waves[0].score, '0');
      assert.equal(elements.get('#toast').textContent, 'Supernova');
    } else assert.equal(waves.length, 0);
  }
});
