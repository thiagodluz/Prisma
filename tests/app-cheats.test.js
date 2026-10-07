import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('secret controls persist cheat status, protect records, block concurrent actions and isolate modes', async () => {
  const data = new Map();
  globalThis.localStorage = {getItem: key => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, String(value))};
  const elements = new Map();
  const makeElement = () => {
    const classes = new Set();
    return {children: [], dataset: {}, handlers: {}, attributes: {}, hidden: true,
      style: {setProperty() {}}, classList: {
        add: name => classes.add(name), remove: name => classes.delete(name),
        toggle(name, value) {if (value) classes.add(name); else classes.delete(name);},
        contains: name => classes.has(name)
      },
      addEventListener(name, listener) {this.handlers[name] = listener;},
      setAttribute(name, value) {this.attributes[name] = value;},
      append(child) {this.children.push(child);},
      replaceChildren(...children) {this.children = children;},
      closest(selector) {return selector === '.cell' ? this : null;},
      close() {},
      querySelectorAll(selector) {return selector === '.cell' ? this.children : [];}
    };
  };
  const modes = ['zen', 'classic'].map(mode => {const element = makeElement(); element.dataset.mode = mode; return element;});
  globalThis.document = {documentElement: {dataset: {}}, visibilityState: 'visible',
    querySelector(selector) {if (!elements.has(selector)) elements.set(selector, makeElement()); return elements.get(selector);},
    querySelectorAll: selector => selector === '.mode' ? modes : [],
    createElement: makeElement};
  globalThis.window = {matchMedia: () => ({matches: true})};
  Object.defineProperty(globalThis, 'navigator', {value: {}, configurable: true});
  await import('../app.js?cheats');
  const el = id => elements.get('#' + id);
  const click = id => el(id).handlers.click();
  const session = mode => JSON.parse(data.get('prisma.session.' + mode));
  assert.equal(el('developer-menu').hidden, true);
  for (let tap = 0; tap < 6; tap++) click('developer-menu-trigger');
  assert.equal(el('developer-menu').hidden, true);
  click('developer-menu-trigger');
  assert.equal(el('developer-menu').hidden, false);
  assert.equal(data.get('prisma.session.zen'), undefined, 'opening menu does not taint or mutate session');
  click('cheat-points-100');
  assert.equal(session('zen').score, 100);
  assert.equal(session('zen').cheatsUsed, true);
  assert.equal(JSON.parse(data.get('prisma.records.zen') || '{}').bestScore || 0, 0);
  click('cheat-points-1000');
  click('undo-last-move');
  assert.equal(session('zen').score, 100);
  click('undo-last-move');
  assert.equal(session('zen').score, 0);
  assert.equal(session('zen').cheatsUsed, true);
  assert.equal(el('undo-last-move').disabled, true);
  el('cheat-points').value = 'invalid';
  const unchanged = data.get('prisma.session.zen');
  click('cheat-add-points');
  assert.equal(data.get('prisma.session.zen'), unchanged);
  el('cheat-row').value = '4'; el('cheat-column').value = '4'; el('cheat-special').value = 'spectrum';
  click('cheat-spawn');
  assert.equal(session('zen').board[3][3].type, 'spectrum');
  const pending = click('cheat-auto-move');
  assert.equal(el('cheat-points-100').disabled, true);
  const scoreDuringMove = session('zen').score;
  click('cheat-points-100');
  assert.equal(session('zen').score, scoreDuringMove, 'busy actions cannot change the committed board');
  await pending;
  assert.equal(el('cheat-points-100').disabled, false);
  assert.equal(JSON.parse(data.get('prisma.records.zen') || '{}').bestScore || 0, 0);
  const savedCheat = data.get('prisma.session.zen');
  modes[1].handlers.click();
  assert.equal(session('classic').cheatsUsed, false);
  assert.equal(el('shuffle').hidden, true);
  el('cheat-no-defeat').checked = true;
  el('cheat-no-defeat').handlers.change({target: el('cheat-no-defeat')});
  click('cheat-shuffle');
  assert.equal(session('classic').noDefeat, true);
  assert.equal(session('classic').cheatsUsed, true);
  assert.equal(data.get('prisma.session.zen'), savedCheat);
  modes[0].handlers.click();
  assert.equal(session('zen').cheatsUsed, true);
  assert.equal(el('undo-last-move').disabled, true);
  click('developer-close');
  assert.equal(el('developer-menu').hidden, true);
  await import('../app.js?cheats-reopened');
  assert.equal(el('developer-menu').hidden, true);
  assert.match(el('developer-status').textContent, /com cheats/);
  assert.equal(JSON.parse(data.get('prisma.records.zen') || '{}').bestScore || 0, 0);
  assert.equal(el('undo-last-move').disabled, true);
  click('confirm-new-game');
  assert.equal(session('zen').cheatsUsed, false);
  assert.equal(session('zen').noDefeat, false);

  // A normal move records its score; undo removes only that move's records.
  const {version} = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)));
  const {Game} = await import(`../engine.js?v=${version}`);
  const seed = new Game(); seed.restore(session('zen'));
  const hint = seed.hint();
  const board = el('board');
  for (const index of [hint.a, hint.b]) board.handlers.keydown({target: board.children[index], key: 'Enter', preventDefault() {}});
  await new Promise(resolve => setImmediate(resolve));
  assert.ok(JSON.parse(data.get('prisma.records.zen')).bestScore > 0);
  click('undo-last-move');
  assert.equal(JSON.parse(data.get('prisma.records.zen')).bestScore, 0);
  assert.equal(session('zen').cheatsUsed, true);
});

test('every cheat control is contained in the hidden credits menu', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const section = html.match(/<section class="developer-menu"[^>]* hidden>([\s\S]*?)<\/section>/)?.[1];
  assert.ok(section);
  const controls = [...html.matchAll(/id="(cheat-[^"]+|undo-last-move|developer-close|developer-status|developer-history)"/g)].map(match => match[1]);
  assert.ok(controls.length > 15);
  for (const id of controls) assert.ok(section.includes(`id="${id}"`), id);
});
