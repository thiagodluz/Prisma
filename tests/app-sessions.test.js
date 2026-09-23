import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../engine.js';

test('old Endless session opens as Classic and switching modes keeps both sessions', async () => {
  const data = new Map();
  const old = new Game();
  data.set('prisma.session', JSON.stringify({
    mode: 'endless', score: 2500, board: old.board.map(row => row.map(tile => tile.color))
  }));
  globalThis.localStorage = {
    getItem(key) { return data.get(key) ?? null; },
    setItem(key, value) { data.set(key, String(value)); }
  };
  const elements = new Map();
  const makeElement = () => {
    const classes = new Set();
    return {
      children: [], dataset: {}, style: {setProperty(name, value) { this[name] = value; }}, handlers: {},
      classList: {
        add(name) { classes.add(name); },
        remove(name) { classes.delete(name); },
        toggle(name, value) { if (value) classes.add(name); else classes.delete(name); },
        contains(name) { return classes.has(name); }
      },
      setAttribute() {},
      addEventListener(name, listener) { this.handlers[name] = listener; },
      append(child) { this.children.push(child); },
      replaceChildren(...children) { this.children = children; }
    };
  };
  const modes = ['zen', 'classic'].map(mode => {
    const element = makeElement();
    element.dataset.mode = mode;
    return element;
  });
  globalThis.document = {
    querySelector(selector) {
      if (!elements.has(selector)) elements.set(selector, makeElement());
      return elements.get(selector);
    },
    querySelectorAll(selector) { return selector === '.mode' ? modes : []; },
    createElement() { return makeElement(); }
  };
  Object.defineProperty(globalThis, 'navigator', {value: {}, configurable: true});

  await import('../app.js?sessions');
  assert.equal(elements.get('#score').textContent, '2.500');
  assert.equal(elements.get('#level').textContent, '2');
  assert.equal(elements.get('#shuffle').hidden, true);
  assert.equal(elements.get('#zen-panel').hidden, true);
  assert.equal(modes[1].classList.contains('selected'), true);
  assert.equal(JSON.parse(data.get('prisma.session.classic')).score, 2500);

  modes[0].handlers.click();
  assert.equal(elements.get('#score').textContent, '0');
  assert.equal(elements.get('#shuffle').hidden, false);
  assert.equal(elements.get('#zen-panel').hidden, false);
  const effects = elements.get('#zen-effects');
  effects.value = 'soft';
  effects.handlers.change({target: effects});
  assert.equal(JSON.parse(data.get('prisma.zen.settings')).effects, 'soft');
  assert.equal(elements.get('.board-frame').dataset.effects, 'soft');
  const breath = elements.get('#zen-breath');
  breath.value = 'balanced';
  breath.handlers.change({target: breath});
  assert.equal(elements.get('#breath-guide').hidden, false);
  assert.equal(elements.get('#breath-phase').textContent, 'Inspire');
  modes[1].handlers.click();
  assert.equal(elements.get('#score').textContent, '2.500');
  assert.equal(elements.get('#zen-panel').hidden, true);
  assert.equal(elements.get('#breath-guide').hidden, true);
  assert.equal(elements.get('.board-frame').dataset.effects, 'normal');
  assert.equal(data.get('prisma.activeMode'), 'classic');
  assert.equal(JSON.parse(data.get('prisma.session.zen')).score, 0);
  breath.value = 'off';
  breath.handlers.change({target: breath});
});
