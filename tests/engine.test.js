import test from 'node:test';
import assert from 'node:assert/strict';
import {Game, SIZE} from '../engine.js';

test('new boards have no automatic matches and at least one move', () => {
  for (let i = 0; i < 200; i++) {
    const game = new Game();
    assert.equal(game.board.length, SIZE);
    assert.equal(game.matches().cells.length, 0);
    assert.equal(game.hasMove(), true);
  }
});

test('all legal swaps settle to a playable board and score', () => {
  const game = new Game();
  for (let turn = 0; turn < 100; turn++) {
    let move;
    for (let a = 0; a < SIZE * SIZE && !move; a++) for (const b of [a + 1, a + SIZE]) {
      if (!game.adjacent(a, b)) continue;
      game.swap(a, b);
      const isMatch = game.matches().cells.length > 0;
      game.swap(a, b);
      if (isMatch) { move = [a, b]; break; }
    }
    assert.ok(move);
    const oldScore = game.score;
    const result = game.move(...move);
    assert.equal(result.valid, true);
    assert.ok(game.score > oldScore);
    for (let i = 0; i < result.frames.length - 1; i++) {
      const before = result.frames[i];
      const after = result.frames[i + 1];
      if (!before.matched.length || !after.falls) continue;
      const cleared = new Set(before.matched);
      assert.equal(after.falls.length, SIZE * SIZE);
      const origins = new Set();
      for (let target = 0; target < after.falls.length; target++) {
        const source = after.falls[target];
        if (source < 0) continue;
        assert.ok(!cleared.has(source), 'a cleared gem cannot fall');
        assert.ok(!origins.has(source), 'a surviving gem has one destination');
        origins.add(source);
        assert.equal(before.board[Math.floor(source / SIZE)][source % SIZE],
          after.board[Math.floor(target / SIZE)][target % SIZE]);
      }
    }
    assert.equal(game.matches().cells.length, 0);
    assert.equal(game.hasMove(), true);
  }
});

test('invalid and diagonal swaps do not alter board or score', () => {
  const game = new Game();
  const before = JSON.stringify(game.board);
  assert.equal(game.move(0, 9).valid, false);
  assert.equal(game.move(7, 8).valid, false);
  assert.equal(JSON.stringify(game.board), before);
  assert.equal(game.score, 0);
});

test('new modes reset score and Endless levels up', () => {
  const game = new Game();
  game.newGame('endless');
  assert.equal(game.level, 1);
  assert.equal(game.mode, 'endless');
  game.score = 1999;
  for (let a = 0; a < 64; a++) {
    let found = false;
    for (const b of [a + 1, a + 8]) {
      if (!game.adjacent(a, b)) continue;
      game.swap(a, b);
      found = game.matches().cells.length > 0;
      game.swap(a, b);
      if (found) { game.move(a, b); break; }
    }
    if (found) break;
  }
  assert.ok(game.level >= 2);
  game.newGame('zen');
  assert.equal(game.score, 0);
  assert.equal(game.level, 1);
});
