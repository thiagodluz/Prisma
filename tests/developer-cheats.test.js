import test from 'node:test';
import assert from 'node:assert/strict';
import {Game, SIZE, levelGoal} from '../engine.js';
const saved = game => ({...game.snapshot(), progressionVersion: 4, cheatsUsed: game.cheatsUsed});
const validBoard = game => {
  assert.equal(game.board.flat().length, SIZE * SIZE);
  assert.equal(new Set(game.board.flat().map(tile => tile.id)).size, SIZE * SIZE);
  assert.equal(game.matches().cells.length, 0);
  assert.ok(game.hasMove() || game.ended);
};

test('points and level cheats preserve valid progress and reject invalid input without side effects', () => {
  const game = new Game();
  const before = game.snapshot();
  for (const amount of [NaN, 0, -1, 1.5, 1000001]) assert.equal(game.cheatAddPoints(amount), false);
  for (const level of [NaN, 0, -1, 1.5, 10001]) assert.equal(game.cheatSetLevel(level), false);
  assert.deepEqual(game.snapshot(), before);
  assert.equal(game.cheatsUsed, false);
  assert.ok(game.cheatAddPoints(1000000));
  assert.ok(game.score - game.levelStartScore < levelGoal(game.level));
  assert.ok(game.cheatSetLevel(10000));
  const reopened = new Game();
  assert.ok(reopened.restore(saved(game)));
  assert.equal(reopened.level, 10000);
  assert.equal(reopened.score, game.score);
  assert.equal(reopened.cheatsUsed, true);
});

test('special cheats preserve other tiles and resolve Spectrum color safely', () => {
  const game = new Game();
  const before = game.snapshot();
  assert.equal(game.cheatSpawnSpecial(-1, 'burst'), false);
  assert.equal(game.cheatSpawnSpecial(64, 'burst'), false);
  assert.equal(game.cheatSpawnSpecial(0, 'invalid'), false);
  assert.equal(game.cheatsUsed, false);
  for (const type of ['spectrum', 'burst', 'cross']) {
    assert.ok(game.cheatSpawnSpecial(27, type));
    assert.equal(game.tile(27).type, type);
    validBoard(game);
    for (let cell = 0; cell < 64; cell++) if (cell !== 27)
      assert.deepEqual(game.tile(cell), before.board[Math.floor(cell / 8)][cell % 8]);
  }
});

test('secret shuffle resumes Classic, preserves tiles, and remains reversible', () => {
  const game = new Game();
  game.newGame('classic');
  game.cheatSpawnSpecial(0, 'cross');
  game.ended = true;
  const before = game.snapshot();
  assert.equal(game.shuffle(), false);
  assert.ok(game.cheatShuffle());
  assert.equal(game.ended, false);
  assert.deepEqual(game.board.flat().map(tile => tile.id).sort(), before.board.flat().map(tile => tile.id).sort());
  validBoard(game);
  assert.ok(game.undoLastMove());
  assert.deepEqual(game.snapshot(), before);
});

test('no defeat recovers a deadlocked Classic and survives saving; normal Classic still ends', () => {
  const game = new Game();
  game.newGame('classic');
  game.board.forEach((row, r) => row.forEach((tile, c) => {tile.color = (r * 2 + c) % 7;}));
  assert.equal(game.hasMove(), false);
  game.ended = true;
  assert.ok(game.cheatNoDefeat(true));
  assert.equal(game.ended, false);
  assert.ok(game.hasMove());
  const reopened = new Game();
  assert.ok(reopened.restore(saved(game)));
  assert.equal(reopened.noDefeat, true);
  assert.equal(reopened.cheatsUsed, true);
  const hint = game.hint();
  const realHasMove = game.hasMove;
  game.hasMove = () => false;
  const result = game.move(hint.a, hint.b);
  assert.equal(result.ended, false);
  assert.equal(result.rescued, true);
  game.hasMove = realHasMove;
  assert.ok(game.cheatNoDefeat(false));
  assert.ok(game.undoLastMove());
  assert.equal(game.noDefeat, true);
});

test('explode activates every special once, refills and undoes the complete cascade', () => {
  const game = new Game();
  for (const [index, type] of [[0, 'burst'], [27, 'cross'], [63, 'spectrum']]) game.cheatSpawnSpecial(index, type);
  const before = game.snapshot();
  const ids = [0, 27, 63].map(index => game.tile(index).id);
  const result = game.cheatExplode();
  assert.equal(result.valid, true);
  assert.equal(result.events[0].cells.length, 64);
  const activated = result.events[0].activated.map(effect => effect.id);
  for (const id of ids) assert.equal(activated.filter(value => value === id).length, 1);
  assert.ok(result.earned >= 1600);
  validBoard(game);
  assert.ok(game.undoLastMove());
  assert.deepEqual(game.snapshot(), before);
});

test('forced Supernova uses real fusion at every corner and is reversible', () => {
  for (const index of [0, 7, 56, 63, 27]) {
    const game = new Game();
    const before = game.snapshot();
    const result = game.cheatSupernova(index);
    const nova = result.events[0].activated.find(effect => effect.type === 'supernova');
    assert.ok(nova);
    assert.equal(nova.sources.length, 3);
    assert.equal(result.events[0].creations.length, 0);
    validBoard(game);
    game.undoLastMove();
    assert.deepEqual(game.snapshot(), before);
  }
});

test('history mixes normal moves and cheats, retains 50 actions, and keeps cheat status after undo', () => {
  const game = new Game();
  const before = game.snapshot();
  const hint = game.hint();
  assert.ok(game.move(hint.a, hint.b).valid);
  const moved = game.snapshot();
  game.cheatAddPoints(100);
  game.cheatSetLevel(8);
  game.undoLastMove();
  assert.equal(game.score, moved.score + 100);
  game.undoLastMove();
  assert.deepEqual(game.snapshot(), moved);
  game.undoLastMove();
  assert.deepEqual(game.snapshot(), before);
  assert.equal(game.cheatsUsed, true);
  for (let i = 0; i < 60; i++) game.cheatAddPoints(100);
  assert.equal(game.undoHistory.length, 50);
  for (let i = 0; i < 50; i++) assert.ok(game.undoLastMove());
  assert.equal(game.score, 1000);
  assert.equal(game.undoLastMove(), false);
  const reopened = new Game();
  assert.ok(reopened.restore(saved(game)));
  assert.equal(reopened.undoHistory.length, 0);
  assert.equal(reopened.cheatsUsed, true);
  game.newGame();
  assert.equal(game.cheatsUsed, false);
  assert.equal(game.noDefeat, false);
});
