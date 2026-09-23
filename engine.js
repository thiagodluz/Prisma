export const SIZE = 8;
export const COLORS = 7;
const copy = board => board.map(row => [...row]);

export class Game {
  constructor(random = Math.random) {
    this.random = random;
    this.board = [];
    this.score = 0;
    this.level = 1;
    this.mode = 'zen';
    this.newGame();
  }

  gem() { return Math.floor(this.random() * COLORS); }

  newGame(mode = this.mode) {
    this.mode = mode;
    this.score = 0;
    this.level = 1;
    this.board = this.freshBoard();
  }

  freshBoard() {
    // Seed a board without automatic matches and with at least one legal move.
    for (let attempt = 0; attempt < 1000; attempt++) {
      const board = Array.from({length: SIZE}, () => Array(SIZE).fill(null));
      for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
        const choices = Array.from({length: COLORS}, (_, i) => i).filter(v =>
          !(c >= 2 && board[r][c - 1] === v && board[r][c - 2] === v) &&
          !(r >= 2 && board[r - 1][c] === v && board[r - 2][c] === v));
        board[r][c] = choices[Math.floor(this.random() * choices.length)];
      }
      if (this.hasMove(board)) return board;
    }
    throw new Error('Não foi possível criar um tabuleiro jogável');
  }

  matches(board = this.board) {
    const cells = new Set();
    let groups = 0;
    let longest = 0;
    const scan = (points) => {
      let start = 0;
      while (start < SIZE) {
        let end = start + 1;
        while (end < SIZE && board[points[start][0]][points[start][1]] !== null &&
          board[points[end][0]][points[end][1]] === board[points[start][0]][points[start][1]]) end++;
        if (end - start >= 3 && board[points[start][0]][points[start][1]] !== null) {
          groups++;
          longest = Math.max(longest, end - start);
          for (let i = start; i < end; i++) cells.add(points[i][0] * SIZE + points[i][1]);
        }
        start = end;
      }
    };
    for (let r = 0; r < SIZE; r++) scan(Array.from({length: SIZE}, (_, c) => [r, c]));
    for (let c = 0; c < SIZE; c++) scan(Array.from({length: SIZE}, (_, r) => [r, c]));
    return {cells: [...cells], groups, longest};
  }

  adjacent(a, b) {
    return a >= 0 && b >= 0 && a < SIZE * SIZE && b < SIZE * SIZE &&
      Math.abs(Math.floor(a / SIZE) - Math.floor(b / SIZE)) + Math.abs(a % SIZE - b % SIZE) === 1;
  }

  swap(a, b, board = this.board) {
    const ar = Math.floor(a / SIZE), ac = a % SIZE, br = Math.floor(b / SIZE), bc = b % SIZE;
    [board[ar][ac], board[br][bc]] = [board[br][bc], board[ar][ac]];
  }

  hasMove(board = this.board) {
    for (let a = 0; a < SIZE * SIZE; a++) for (const b of [a + 1, a + SIZE]) {
      if (!this.adjacent(a, b)) continue;
      this.swap(a, b, board);
      const found = this.matches(board).cells.length > 0;
      this.swap(a, b, board);
      if (found) return true;
    }
    return false;
  }

  move(a, b) {
    if (!this.adjacent(a, b)) return {valid: false, frames: []};
    this.swap(a, b);
    let match = this.matches();
    if (!match.cells.length) {
      this.swap(a, b);
      return {valid: false, frames: []};
    }
    const frames = [];
    let chain = 0;
    let earned = 0;
    while (match.cells.length) {
      chain++;
      frames.push({board: copy(this.board), matched: match.cells, chain});
      earned += (match.cells.length * 20 + Math.max(0, match.longest - 3) * 40) * chain;
      for (const index of match.cells) this.board[Math.floor(index / SIZE)][index % SIZE] = null;
      const falls = Array(SIZE * SIZE);
      for (let c = 0; c < SIZE; c++) {
        const remaining = [];
        for (let r = SIZE - 1; r >= 0; r--) if (this.board[r][c] !== null) remaining.push({kind: this.board[r][c], row: r});
        const missing = SIZE - remaining.length;
        for (let r = SIZE - 1; r >= 0; r--) {
          const existing = remaining[SIZE - 1 - r];
          this.board[r][c] = existing?.kind ?? this.gem();
          falls[r * SIZE + c] = (existing?.row ?? r - missing) * SIZE + c;
        }
      }
      frames.push({board: copy(this.board), matched: [], falls, chain});
      match = this.matches();
    }
    this.score += earned;
    if (this.mode === 'endless') this.level = 1 + Math.floor(this.score / 2000);
    let shuffled = false;
    if (!this.hasMove()) {
      this.board = this.freshBoard();
      frames.push({board: copy(this.board), matched: [], chain, reshuffled: true});
      shuffled = true;
    }
    return {valid: true, frames, earned, chain, shuffled};
  }

  shuffle() { this.board = this.freshBoard(); }
}
