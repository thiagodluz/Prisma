import test from 'node:test';
import assert from 'node:assert/strict';
import {Game, SIZE, levelGoal} from '../engine.js';

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

test('manual Zen shuffle keeps every tile, special type and color without free matches', () => {
  const game = new Game();
  game.board[0][0].type = 'burst';
  game.board[1][1].type = 'cross';
  game.board[2][2] = game.gem(null, 'spectrum');
  const identities = () => game.board.flat().map(tile => [tile.id, tile.type, tile.color])
    .sort((a, b) => a[0] - b[0]);
  const initial = identities();
  const nextId = game.nextId;
  game.score = 175;
  for (let i = 0; i < 100; i++) {
    const positions = game.board.flat().map(tile => tile.id);
    assert.equal(game.shuffle(), true);
    assert.notDeepEqual(game.board.flat().map(tile => tile.id), positions);
    assert.deepEqual(identities(), initial);
    assert.equal(game.nextId, nextId);
    assert.equal(game.score, 175);
    assert.equal(game.matches().cells.length, 0);
    assert.equal(game.hasMove(), true);
  }
  game.mode = 'classic';
  assert.equal(game.shuffle(), false, 'Classic has no manual shuffle');
});

test('both modes reshuffle once when leveling up and keep surviving specials', () => {
  for (const mode of ['classic', 'zen']) {
    let seed = 9921;
    const game = new Game(() => ((seed = (1664525 * seed + 1013904223) >>> 0) / 2 ** 32));
    game.newGame(mode);
    game.board[0][0].type = 'burst';
    game.score = levelGoal(1) - 75;
    const result = game.move(...matchMove(game));
    assert.ok(result.valid && result.levelsGained >= 1);
    assert.equal(result.shuffled, true);
    const shuffles = result.events.filter(event => event.type === 'shuffle');
    assert.equal(shuffles.length, 1);
    const before = shuffles[0].before.flat().map(tile => [tile.id, tile.type, tile.color]);
    const after = shuffles[0].board.flat().map(tile => [tile.id, tile.type, tile.color]);
    assert.deepEqual(after.sort((a, b) => a[0] - b[0]), before.sort((a, b) => a[0] - b[0]));
    assert.notDeepEqual(shuffles[0].before.flat().map(tile => tile.id),
      shuffles[0].board.flat().map(tile => tile.id));
    assert.equal(game.matches().cells.length, 0);
    assert.equal(game.hasMove(), true);
    assert.equal(game.ended, false);
    assert.equal(result.events.at(-1).type, 'shuffle');
    assert.equal(result.events.at(-1).board.flat().map(tile => tile.id).join(','),
      game.board.flat().map(tile => tile.id).join(','));
  }
});

test('low entropy random source still finds a safe permutation without new tiles', () => {
  const game = new Game();
  game.random = () => 0;
  const identities = game.board.flat().map(tile => tile.id).sort((a, b) => a - b);
  assert.equal(game.shuffle(), true);
  assert.deepEqual(game.board.flat().map(tile => tile.id).sort((a, b) => a - b), identities);
  assert.equal(game.matches().cells.length, 0);
  assert.equal(game.hasMove(), true);
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
  const game = new Game();
  const before = JSON.stringify(game.board);
  assert.equal(game.move(0, 9).valid, false);
  assert.equal(game.move(7, 8).valid, false);
  const invalid = Array.from({length: 64}, (_, a) => [a, a + 1])
    .find(([a, b]) => {
      if (!game.adjacent(a, b)) return false;
      game.swap(a, b);
      const matches = game.matches().cells.length;
      game.swap(a, b);
      return matches === 0;
    });
  assert.ok(invalid);
  assert.equal(game.move(...invalid).valid, false);
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
  assert.equal(game.mode, 'classic');
  assert.equal(game.level, 2);
  const special = game.gem(2, 'burst');
  game.set(0, special);
  const copy = new Game();
  assert.ok(copy.restore({mode: game.mode, score: game.score, board: game.board}));
  assert.equal(copy.tile(0).id, special.id);
  assert.equal(copy.tile(0).type, 'burst');
  assert.ok(copy.gem().id > Math.max(...copy.board.flat().map(tile => tile.id)));
});

test('restoring an unsettled save rearranges its specials instead of discarding them', () => {
  const original = new Game();
  original.board[0][0] = original.gem(0, 'burst');
  original.board[0][1] = original.gem(0, 'cross');
  original.board[0][2] = original.gem(0);
  original.board[1][1] = original.gem(null, 'spectrum');
  const expected = original.board.flat().map(tile => [tile.id, tile.type, tile.color])
    .sort((a, b) => a[0] - b[0]);
  const restored = new Game();
  assert.equal(restored.restore({mode: 'zen', score: 200, board: original.board}), true);
  assert.deepEqual(restored.board.flat().map(tile => [tile.id, tile.type, tile.color])
    .sort((a, b) => a[0] - b[0]), expected);
  assert.equal(restored.matches().cells.length, 0);
  assert.equal(restored.hasMove(), true);
});

test('Classic ends without moves, preserves the final board and forbids shuffling', () => {
  const game = fixture();
  game.newGame('classic');
  const move = matchMove(game);
  const originalHasMove = game.hasMove.bind(game);
  game.hasMove = () => false; // A deterministic no-moves state after the cascade.
  const result = game.move(...move);
  assert.equal(result.ended, true);
  assert.equal(result.events.at(-1).type, 'gameover');
  assert.equal(JSON.stringify(result.events.at(-1).board), JSON.stringify(game.board));
  const board = JSON.stringify(game.board);
  assert.equal(game.shuffle(), false);
  assert.equal(game.move(...move).valid, false);
  assert.equal(JSON.stringify(game.board), board);
  game.hasMove = originalHasMove;
  game.newGame();
  assert.equal(game.ended, false);
});

test('Zen recovers a move without resetting progress or other specials', () => {
  const game = fixture();
  game.score = 1990;
  const move = [at(2, 3), at(3, 3)];
  place(game, 3, 1, 0);
  place(game, 3, 2, 0, 'burst');
  place(game, 3, 3, 1);
  place(game, 2, 3, 0);
  const originalHasMove = game.hasMove.bind(game);
  game.hasMove = () => false;
  const result = game.move(...move);
  game.hasMove = originalHasMove;
  assert.equal(result.ended, false);
  assert.equal(result.rescued, true);
  assert.equal(result.events.at(-1).type, 'rescue');
  const previous = result.events.at(-2).board.flat();
  const index = result.events.at(-1).index;
  assert.equal(game.tile(index).type, 'spectrum');
  assert.equal(game.hasMove(), true);
  assert.ok(game.score > 1990 && game.level >= 2);
  for (let i = 0; i < 64; i++) if (i !== index)
    assert.equal(game.board.flat()[i].id, previous[i].id);
});

test('a no-moves save restores as finished Classic or playable Zen', () => {
  const original = fixture();
  assert.equal(original.hasMove(), false);
  const saved = {score: 2400, board: original.board};
  const classic = new Game();
  assert.equal(classic.restore({...saved, mode: 'classic'}), true);
  assert.equal(classic.level, 2);
  assert.equal(classic.ended, true);
  assert.equal(classic.hasMove(), false);
  const zen = new Game();
  assert.equal(zen.restore({...saved, mode: 'zen'}), true);
  assert.equal(zen.level, 2);
  assert.equal(zen.ended, false);
  assert.equal(zen.hasMove(), true);
  assert.equal(zen.board.flat().filter(tile => tile.type === 'spectrum').length, 1);
});

test('score rewards special creation and cascades with a capped multiplier', () => {
  const game = fixture();
  for (let c = 0; c < 3; c++) place(game, 3, c, 0);
  place(game, 3, 3, 1);
  place(game, 2, 3, 0);
  const result = game.move(at(2, 3), at(3, 3));
  const first = result.events[0];
  assert.equal(first.base, 75);
  assert.equal(first.creationBonus, 120);
  assert.equal(first.comboMultiplier, 1);
  assert.equal(first.earned, 195);
  assert.equal(result.earned, result.events.filter(event => event.type === 'clear')
    .reduce((sum, event) => sum + event.earned, 0));
  for (const event of result.events.filter(event => event.type === 'clear'))
    assert.ok(event.comboMultiplier >= 1 && event.comboMultiplier <= 3);
});

test('level goals grow gradually and progress can cross multiple levels', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 10].map(levelGoal), [1800, 2150, 2500, 2850, 3200, 4950]);
  assert.equal(levelGoal(20), 5300);
  const game = new Game();
  game.score = levelGoal(1) - 50;
  const move = matchMove(game);
  const result = game.move(...move);
  assert.ok(result.levelsGained >= 1);
  assert.equal(game.level, 2);
  assert.equal(game.levelStartScore, levelGoal(1));
  assert.equal(game.score - game.levelStartScore, game.score - levelGoal(1));
});

test('hint returns a legal move and prioritizes a pair of spectra', () => {
  const game = fixture();
  place(game, 1, 1, null, 'spectrum');
  place(game, 1, 2, null, 'spectrum');
  assert.deepEqual(game.hint(), {a: at(1, 1), b: at(1, 2)});
  game.ended = true;
  assert.equal(game.hint(), null);
});

test('new progression save restores exact level position', () => {
  const original = fixture();
  const copy = new Game();
  assert.ok(copy.restore({mode: 'zen', score: 4321, board: original.board,
    progressionVersion: 2, level: 3, levelStartScore: 3950}));
  assert.equal(copy.level, 3);
  assert.equal(copy.levelStartScore, 3950);
  assert.equal(copy.score - copy.levelStartScore, 371);
});
