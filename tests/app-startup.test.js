import test from 'node:test';
import assert from 'node:assert/strict';

test('the board initializes when local file storage is denied', async () => {
  const elements = new Map();
  const makeElement = () => ({
    children: [],
    classList: {add() {}, remove() {}, toggle() {}},
    style: {},
    dataset: {},
    setAttribute() {},
    addEventListener() {},
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
  Object.defineProperty(globalThis, 'navigator', {value: {}, configurable: true});
  globalThis.localStorage = {
    getItem() { throw new DOMException('Storage disabled', 'SecurityError'); },
    setItem() { throw new DOMException('Storage disabled', 'SecurityError'); }
  };
  await import('../app.js');
  assert.equal(elements.get('#board').children.length, 64);
  assert.equal(elements.get('#progress').hidden, false);
  assert.equal(elements.get('#game-over').hidden, true);
});
