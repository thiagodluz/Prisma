import test from 'node:test';
import assert from 'node:assert/strict';
import {Game, SIZE} from '../engine.js';

function fixture() {
  let seed = 7654321;
  const game = new Game(() => ((seed = (1664525 * seed + 1013904223) >>> 0) / 2 ** 32));
  game.board = Array.from({length: SIZE}, (_, r) =>
    Array.from({length: SIZE}, (_, c) => game.gem((r * 3 + c * 2) % 7)));
  return game;
}
const at = (r, c) => r * SIZE + c;
function place(game, r, c, color, type = 'normal') {
  game.set(at(r, c), game.gem(color, type));
}
function matchMove(game) {
  for (let a = 0; a < SIZE * SIZE; a++) for (const b of [a + 1, a + SIZE]) {
    if (!game.adjacent(a, b)) continue;
    game.swap(a, b);
    const valid = !!game.matches().cells.length || [a, b].some(index => game.tile(index)?.type === 'spectrum');
    game.swap(a, b);
    if (valid) return [a, b];
  }
  throw new Error('Sem jogadas');
}

test('starting boards have unique stable IDs, no matches and at least one move', () => {
  for (let i = 0; i < 100; i++) {
    const game = new Game();
    assert.equal(game.board.flat().length, 64);
    assert.equal(new Set(game.board.flat().map(tile => tile.id)).size, 64);
    assert.equal(game.matches().cells.length, 0);
    assert.equal(game.hasMove(), true);
  }
});

test('a long sequence keeps falling IDs, events and board consistent', () => {
  let seed = 7654321;
  const game = new Game(() => ((seed = (1664525 * seed + 1013904223) >>> 0) / 2 ** 32));
  for (let turn = 0; turn < 100; turn++) {
    const result = game.move(...matchMove(game));
    assert.ok(result.valid && result.earned > 0);
    for (let i = 0; i < result.events.length; i++) {
      const event = result.events[i];
      if (event.type !== 'fall') continue;
      const before = result.events[i - 1];
      assert.equal(before.type, 'clear');
      assert.equal(event.falls.length, 64);
      const sources = new Set();
      for (let target = 0; target < 64; target++) {
        const source = event.falls[target];
        if (source < 0) continue;
        assert.ok(!before.cells.includes(source), 'cleared tile never falls');
        assert.ok(!sources.has(source), 'tile has only one destination');
        sources.add(source);
        const created = before.creations.find(creation => creation.index === source);
        assert.equal(created?.tile.id ?? before.board.flat()[source].id, event.board.flat()[target].id);
      }
    }
    assert.equal(game.matches().cells.length, 0);
    assert.equal(game.hasMove(), true);
    assert.equal(new Set(game.board.flat().map(tile => tile.id)).size, 64);
  }
});

test('invalid swaps preserve board and score', () => {
  const game = fixture();
  const before = JSON.stringify(game.board);
  assert.equal(game.move(0, 9).valid, false);
  assert.equal(game.move(7, 8).valid, false);
  assert.equal(game.move(0, 1).valid, false);
  assert.equal(JSON.stringify(game.board), before);
  assert.equal(game.score, 0);
});

test('four, five and L/T shapes create one special at the swapped destination', () => {
  for (const [length, expected] of [[4, 'burst'], [5, 'spectrum']]) {
    const game = fixture();
    for (let c = 0; c < length - 1; c++) place(game, 3, c, 0);
    place(game, 3, length - 1, 1);
    place(game, 2, length - 1, 0);
    const result = game.move(at(2, length - 1), at(3, length - 1));
    assert.equal(result.valid, true);
    assert.equal(result.events[0].creations.length, 1);
    assert.equal(result.events[0].creations[0].type, expected);
    assert.equal(result.events[0].creations[0].index, at(3, length - 1));
    assert.equal(result.events[0].cells.length, length - 1);
    assert.ok(result.events[1].board.flat().some(tile => tile.type === expected));
  }
  const game = fixture();
  place(game, 3, 2, 1);
  place(game, 2, 2, 0);
  place(game, 3, 3, 0);
  place(game, 3, 4, 0);
  place(game, 4, 2, 0);
  place(game, 5, 2, 0);
  const result = game.move(at(2, 2), at(3, 2));
  assert.equal(result.events[0].creations[0].type, 'cross');
  assert.equal(result.events[0].creations[0].index, at(3, 2));
});

test('burst and cross chain reactions clear each cell once', () => {
  const game = fixture();
  place(game, 3, 1, 0);
  place(game, 3, 2, 0, 'burst');
  place(game, 3, 3, 1);
  place(game, 2, 3, 0);
  place(game, 2, 2, 3, 'cross');
  const result = game.move(at(2, 3), at(3, 3));
  const clear = result.events[0];
  assert.deepEqual(clear.activated.map(effect => effect.type), ['burst', 'cross']);
  assert.equal(new Set(clear.cells).size, clear.cells.length);
  for (let c = 0; c < SIZE; c++) assert.ok(clear.cells.includes(at(2, c)));
  for (let r = 0; r < SIZE; r++) assert.ok(clear.cells.includes(at(r, 2)));
});

test('creating a special never replaces an existing special in the same match', () => {
  const game = fixture();
  for (let c = 0; c < 3; c++) place(game, 3, c, 0);
  place(game, 3, 3, 1);
  place(game, 2, 3, 0, 'burst');
  const result = game.move(at(2, 3), at(3, 3));
  const clear = result.events[0];
  assert.equal(clear.creations.length, 1);
  assert.notEqual(clear.creations[0].index, at(3, 3));
  assert.ok(clear.activated.some(effect => effect.type === 'burst'));
});

test('spectrum swaps clear target color, and two spectra clear all', () => {
  const game = fixture();
  place(game, 1, 1, null, 'spectrum');
  place(game, 1, 2, 4);
  const count = game.board.flat().filter(tile => tile.color === 4).length;
  const result = game.move(at(1, 1), at(1, 2));
  assert.equal(result.events[0].activated[0].type, 'spectrum');
  assert.ok(result.events[0].cells.length >= count + 1);
  const both = fixture();
  place(both, 1, 1, null, 'spectrum');
  place(both, 1, 2, null, 'spectrum');
  assert.equal(both.move(at(1, 1), at(1, 2)).events[0].cells.length, 64);
});

test('old numeric save migrates, specials persist, IDs remain unique', () => {
  const old = fixture();
  const game = new Game();
  assert.ok(game.restore({mode: 'endless', score: 2120,
    board: old.board.map(row => row.map(tile => tile.color))}));
  assert.equal(game.level, 2);
  const special = game.gem(2, 'burst');
  game.set(0, special);
  const copy = new Game();
  assert.ok(copy.restore({mode: game.mode, score: game.score, board: game.board}));
  assert.equal(copy.tile(0).id, special.id);
  assert.equal(copy.tile(0).type, 'burst');
  assert.ok(copy.gem().id > Math.max(...copy.board.flat().map(tile => tile.id)));
});
