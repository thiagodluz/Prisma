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

function novaMove(game, row = 3, column = 2, vertical = false, types = ['burst', 'burst', 'burst']) {
  const indices = Array.from({length: 3}, (_, i) => at(row + (vertical ? i : 0), column + (vertical ? 0 : i)));
  const source = vertical ? indices[2] + (column === 0 ? 1 : -1) : indices[2] - SIZE;
  game.set(indices[0], game.gem(2, types[0]));
  game.set(indices[1], game.gem(2, types[1]));
  game.set(indices[2], game.gem(1));
  game.set(source, game.gem(2, types[2]));
  return game.move(source, indices[2]);
}

test('three colored specials fuse into one centered 5x5 blast in either direction', () => {
  for (const vertical of [false, true]) for (const types of [
    ['burst', 'burst', 'burst'], ['cross', 'burst', 'cross']]) {
    const game = fixture();
    const result = novaMove(game, 3, 2, vertical, types);
    const first = result.events[0];
    const center = vertical ? at(4, 2) : at(3, 3);
    assert.equal(result.valid, true);
    assert.deepEqual(first.activated.map(effect => effect.type), ['supernova']);
    assert.equal(first.activated[0].index, center);
    assert.equal(first.activated[0].color, 2);
    assert.equal(first.activated[0].sources.length, 3);
    assert.equal(first.creations.length, 0);
    const expected = [];
    for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++)
      expected.push(center + dr * SIZE + dc);
    assert.deepEqual([...first.cells].sort((a, b) => a - b), expected.sort((a, b) => a - b));
    assert.equal(first.earned, 625);
    assert.equal(result.earned, result.events.filter(event => event.type === 'clear')
      .reduce((sum, event) => sum + event.earned, 0));
    assert.equal(game.matches().cells.length, 0);
    assert.equal(new Set(game.board.flat().map(tile => tile.id)).size, 64);
  }
});

test('Supernova clips at the edge without wrapping to the opposite side', () => {
  const game = fixture();
  const first = novaMove(game, 0, 0, true).events[0];
  assert.deepEqual(first.activated.map(effect => effect.type), ['supernova']);
  const expected = [];
  for (let r = 0; r <= 3; r++) for (let c = 0; c <= 2; c++) expected.push(at(r, c));
  assert.deepEqual([...first.cells].sort((a, b) => a - b), expected);
});

test('Supernova activates other specials once, including a Spectrum beyond the fusion', () => {
  const game = fixture();
  place(game, 2, 2, 3, 'cross');
  place(game, 2, 7, null, 'spectrum');
  const first = novaMove(game).events[0];
  assert.deepEqual(first.activated.map(effect => effect.type), ['supernova', 'cross', 'spectrum']);
  assert.equal(new Set(first.cells).size, first.cells.length);
  assert.ok(first.cells.includes(at(2, 7)));
  assert.ok(first.cells.includes(at(7, 2)));
});

test('a later cascade can align three specials and trigger Supernova', () => {
  const game = fixture();
  place(game, 3, 2, 2, 'burst');
  place(game, 3, 3, 2, 'cross');
  place(game, 4, 4, 2, 'burst');
  place(game, 4, 1, 0);
  place(game, 4, 2, 0);
  place(game, 4, 3, 1);
  place(game, 5, 3, 0);
  const result = game.move(at(5, 3), at(4, 3));
  const clears = result.events.filter(event => event.type === 'clear');
  assert.equal(clears[0].activated.length, 0);
  assert.ok(clears.slice(1).some(event => event.chain > 1 &&
    event.activated.some(effect => effect.type === 'supernova')));
});

test('two specials or specials separated by a normal gem keep their own effects', () => {
  for (const types of [['burst', 'burst', 'normal'], ['burst', 'normal', 'cross']]) {
    const first = novaMove(fixture(), 3, 2, false, types).events[0];
    assert.ok(!first.activated.some(effect => effect.type === 'supernova'));
    assert.equal(first.activated.length, 2);
  }
  const game = fixture();
  for (let c = 1; c <= 5; c++) place(game, 3, c, 2, c % 2 ? 'burst' : 'normal');
  assert.equal(game.supernovas(game.matches()).length, 0);
});

test('long and crossing runs fuse each special at most once', () => {
  const long = fixture();
  for (let c = 1; c <= 4; c++) place(long, 3, c, 2, 'cross');
  const nova = long.supernovas(long.matches());
  assert.equal(nova.length, 1);
  assert.equal(nova[0].index, at(3, 2));
  assert.equal(nova[0].sources.length, 4);
  assert.deepEqual(long.creations(long.matches(), [], new Set(nova[0].sources)), []);
  const crossing = fixture();
  for (const [r, c] of [[3, 2], [3, 3], [3, 4], [2, 3], [4, 3]]) place(crossing, r, c, 2, 'burst');
  const sources = crossing.supernovas(crossing.matches()).flatMap(effect => effect.sources);
  assert.equal(sources.length, 3);
  assert.equal(new Set(sources).size, sources.length);
});

test('an indirectly triggered Spectrum clears a surviving color after surrounding bursts', () => {
  const game = fixture();
  place(game, 3, 1, 0);
  place(game, 3, 2, 0, 'burst');
  place(game, 3, 3, 1);
  place(game, 2, 3, 0);
  place(game, 2, 2, null, 'spectrum');
  place(game, 2, 1, 3, 'burst');
  place(game, 4, 2, 5, 'burst');

  const result = game.move(at(2, 3), at(3, 3));
  const clear = result.events[0];
  assert.equal(result.valid, true);
  assert.deepEqual(clear.activated.map(effect => effect.type),
    ['burst', 'burst', 'burst', 'spectrum']);
  assert.ok(clear.cells.includes(at(7, 7)),
    'the Spectrum removes a distant stone of a color still present after the bursts');
  assert.equal(new Set(clear.cells).size, clear.cells.length);
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

test('level goals grow gradually to 6,000 and progress can cross multiple levels', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 10, 19, 20, 21, 22, 23, 28, 29, 100].map(levelGoal),
    [1800, 1950, 2100, 2250, 2400, 3150, 4500, 4650, 4800, 4950, 5100, 5850, 6000, 6000]);
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

test('v2 and v3 progression migrate to 6,000 without losing level, points or progress', () => {
  const original = fixture();
  const copy = new Game();
  assert.ok(copy.restore({mode: 'zen', score: 4321, board: original.board,
    progressionVersion: 2, level: 3, levelStartScore: 3750}));
  assert.equal(copy.level, 3);
  assert.equal(copy.levelStartScore, 3750);
  assert.equal(copy.score - copy.levelStartScore, 571);
  const high = new Game();
  const legacyStart = 19 * 1800 + 19 * 18 * 75 + 5 * 4650;
  assert.ok(high.restore({mode: 'zen', score: legacyStart + 4400, board: original.board,
    progressionVersion: 2, level: 25, levelStartScore: legacyStart}));
  assert.equal(high.level, 25);
  assert.equal(high.score - high.levelStartScore, 4400);
  const resumed = new Game();
  assert.ok(resumed.restore({mode: high.mode, score: high.score, board: high.board,
    progressionVersion: 4, level: high.level, levelStartScore: high.levelStartScore,
    progressionOffset: high.progressionOffset}));
  assert.equal(resumed.level, high.level);
  assert.equal(resumed.levelStartScore, high.levelStartScore);
  assert.equal(resumed.progressionOffset, high.progressionOffset);
  const oldCapStart = 22 * 1800 + 22 * 21 * 75 + 6 * 5000;
  const v3 = new Game();
  assert.ok(v3.restore({mode: 'zen', score: oldCapStart + 4900, board: original.board,
    progressionVersion: 3, level: 29, levelStartScore: oldCapStart, progressionOffset: 0}));
  assert.equal(v3.level, 29);
  assert.equal(v3.score - v3.levelStartScore, 4900);
  assert.equal(levelGoal(v3.level), 6000);
  const next = new Game();
  assert.ok(next.restore({mode: v3.mode, score: v3.score, board: v3.board,
    progressionVersion: 4, level: v3.level, levelStartScore: v3.levelStartScore,
    progressionOffset: v3.progressionOffset}));
  assert.equal(next.levelStartScore, oldCapStart);
  assert.equal(next.progressionOffset, v3.progressionOffset);
});

test('corrupt saves leave the current game untouched', () => {
  const game = new Game();
  const before = {board: JSON.stringify(game.board), nextId: game.nextId,
    mode: game.mode, score: game.score};
  const duplicate = game.board.map(row => row.map(tile => ({...tile})));
  duplicate[7][7].id = duplicate[0][0].id;
  assert.equal(game.restore({mode: 'classic', score: 20, board: duplicate}), false);
  assert.equal(game.restore({mode: 'classic', score: 10, board: game.board,
    progressionVersion: 2, level: 999, levelStartScore: 0}), false);
  assert.deepEqual({board: JSON.stringify(game.board), nextId: game.nextId,
    mode: game.mode, score: game.score}, before);
});


test('developer undo restores the complete state before the last valid move', () => {
  const game = new Game();
  const [a, b] = matchMove(game);
  const before = () => ({
    nextId: game.nextId, board: JSON.parse(JSON.stringify(game.board)),
    score: game.score, level: game.level, levelStartScore: game.levelStartScore,
    progressionOffset: game.progressionOffset, mode: game.mode, ended: game.ended
  });
  const original = before();
  assert.equal(game.canUndoLastMove(), false);
  assert.equal(game.move(a, b).valid, true);
  assert.equal(game.canUndoLastMove(), true);
  assert.equal(game.move(0, 63).valid, false);
  assert.equal(game.undoLastMove(), true);
  assert.deepEqual(before(), original);
  assert.equal(game.canUndoLastMove(), false);
  assert.equal(game.undoLastMove(), false);
});

test('new games and restores clear developer undo', () => {
  const game = new Game();
  const [a, b] = matchMove(game);
  assert.equal(game.move(a, b).valid, true);
  game.newGame();
  assert.equal(game.canUndoLastMove(), false);

  const [nextA, nextB] = matchMove(game);
  assert.equal(game.move(nextA, nextB).valid, true);
  const saved = {mode: game.mode, score: game.score, board: game.board,
    progressionVersion: 4, level: game.level, levelStartScore: game.levelStartScore,
    progressionOffset: game.progressionOffset};
  const restored = new Game();
  assert.equal(restored.restore(saved), true);
  assert.equal(restored.canUndoLastMove(), false);
});
