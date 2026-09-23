export const SIZE = 8;
export const COLORS = 7;
export const SPECIALS = ['burst', 'cross', 'spectrum'];
const copy = board => board.map(row => [...row]);
const position = index => [Math.floor(index / SIZE), index % SIZE];

export class Game {
  constructor(random = Math.random) {
    this.random = random;
    this.nextId = 1;
    this.board = [];
    this.score = 0;
    this.level = 1;
    this.mode = 'zen';
    this.ended = false;
    this.newGame();
  }

  gem(color = Math.floor(this.random() * COLORS), type = 'normal') {
    return {id: this.nextId++, color: type === 'spectrum' ? null : color, type};
  }

  newGame(mode = this.mode) {
    this.mode = mode;
    this.score = 0;
    this.level = 1;
    this.ended = false;
    this.board = this.freshBoard();
  }

  freshBoard() {
    for (let attempt = 0; attempt < 1000; attempt++) {
      const board = Array.from({length: SIZE}, () => Array(SIZE).fill(null));
      for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
        const choices = Array.from({length: COLORS}, (_, color) => color).filter(color =>
          !(c >= 2 && board[r][c - 1].color === color && board[r][c - 2].color === color) &&
          !(r >= 2 && board[r - 1][c].color === color && board[r - 2][c].color === color));
        board[r][c] = this.gem(choices[Math.floor(this.random() * choices.length)]);
      }
      if (this.hasMove(board)) return board;
    }
    throw new Error('Não foi possível criar um tabuleiro jogável');
  }

  tile(index, board = this.board) {
    const [r, c] = position(index);
    return board[r]?.[c] ?? null;
  }

  set(index, tile) {
    const [r, c] = position(index);
    this.board[r][c] = tile;
  }

  matches(board = this.board) {
    const runs = [];
    const scan = points => {
      let start = 0;
      while (start < SIZE) {
        let end = start + 1;
        const gem = this.tile(points[start], board);
        while (gem && gem.color !== null && end < SIZE && this.tile(points[end], board)?.color === gem.color) end++;
        if (gem && gem.color !== null && end - start >= 3)
          runs.push({cells: points.slice(start, end), color: gem.color, length: end - start});
        start = end;
      }
    };
    for (let r = 0; r < SIZE; r++) scan(Array.from({length: SIZE}, (_, c) => r * SIZE + c));
    for (let c = 0; c < SIZE; c++) scan(Array.from({length: SIZE}, (_, r) => r * SIZE + c));
    return {cells: [...new Set(runs.flatMap(run => run.cells))], runs};
  }

  adjacent(a, b) {
    return Number.isInteger(a) && Number.isInteger(b) && a >= 0 && b >= 0 && a < SIZE * SIZE && b < SIZE * SIZE &&
      Math.abs(Math.floor(a / SIZE) - Math.floor(b / SIZE)) + Math.abs(a % SIZE - b % SIZE) === 1;
  }

  swap(a, b, board = this.board) {
    const [ar, ac] = position(a), [br, bc] = position(b);
    [board[ar][ac], board[br][bc]] = [board[br][bc], board[ar][ac]];
  }

  hasMove(board = this.board) {
    for (let a = 0; a < SIZE * SIZE; a++) for (const b of [a + 1, a + SIZE]) {
      if (!this.adjacent(a, b)) continue;
      if (this.tile(a, board)?.type === 'spectrum' || this.tile(b, board)?.type === 'spectrum') return true;
      this.swap(a, b, board);
      const found = this.matches(board).cells.length > 0;
      this.swap(a, b, board);
      if (found) return true;
    }
    return false;
  }

  // Connected same-color runs make one special. Prefer the destination of the
  // player's swap; cascades use the lowest matching cell.
  creations(match, preferred = []) {
    const components = [];
    for (const run of match.runs) {
      const overlapping = components.filter(component => component.color === run.color &&
        run.cells.some(cell => component.cells.has(cell)));
      for (const component of overlapping) components.splice(components.indexOf(component), 1);
      const cells = new Set([...run.cells, ...overlapping.flatMap(component => [...component.cells])]);
      components.push({color: run.color, cells, runs: [run, ...overlapping.flatMap(component => component.runs)]});
    }
    return components.flatMap(component => {
      const hasFive = component.runs.some(run => run.length >= 5);
      const intersects = component.runs.length > 1 &&
        component.cells.size < component.runs.reduce((sum, run) => sum + run.length, 0);
      const hasFour = component.runs.some(run => run.length >= 4);
      const type = hasFive ? 'spectrum' : intersects ? 'cross' : hasFour ? 'burst' : null;
      if (!type) return [];
      const candidates = [...component.cells].filter(cell => this.tile(cell)?.type === 'normal');
      if (!candidates.length) return [];
      return [{index: preferred.find(cell => candidates.includes(cell)) ?? Math.max(...candidates),
        type, color: component.color}];
    });
  }

  move(a, b) {
    if (this.ended || !this.adjacent(a, b)) return {valid: false, events: []};
    this.swap(a, b);
    let match = this.matches();
    const spectrum = [a, b].filter(index => this.tile(index)?.type === 'spectrum');
    if (!match.cells.length && !spectrum.length) {
      this.swap(a, b);
      return {valid: false, events: []};
    }
    const events = [];
    let chain = 0;
    let earned = 0;
    let direct = spectrum.length ? {spectrum, target: spectrum.length === 1 ? (spectrum[0] === a ? b : a) : null} : null;
    while (match.cells.length || direct) {
      chain++;
      const creations = (direct ? [] : this.creations(match, chain === 1 ? [b, a] : []))
        .map(creation => ({...creation, tile: this.gem(creation.color, creation.type)}));
      const protectedCells = new Set(creations.map(creation => creation.index));
      const cleared = new Set(match.cells.filter(index => !protectedCells.has(index)));
      const activated = [];
      const queue = [];
      const seen = new Set();
      const enqueue = index => {
        const tile = this.tile(index);
        if (!protectedCells.has(index) && tile && tile.type !== 'normal' && !seen.has(tile.id)) queue.push(index);
      };
      for (const index of cleared) enqueue(index);
      if (direct) {
        for (const index of direct.spectrum) { cleared.add(index); enqueue(index); }
        if (direct.target !== null) { cleared.add(direct.target); enqueue(direct.target); }
      }
      while (queue.length) {
        const index = queue.shift();
        const tile = this.tile(index);
        if (!tile || seen.has(tile.id)) continue;
        seen.add(tile.id);
        activated.push({index, type: tile.type, id: tile.id});
        const add = cell => {
          if (cell < 0 || cell >= SIZE * SIZE || protectedCells.has(cell) || !this.tile(cell)) return;
          cleared.add(cell);
          enqueue(cell);
        };
        if (tile.type === 'burst') {
          const [r, c] = position(index);
          for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++)
            if (r + dr >= 0 && r + dr < SIZE && c + dc >= 0 && c + dc < SIZE) add((r + dr) * SIZE + c + dc);
        } else if (tile.type === 'cross') {
          const [r, c] = position(index);
          for (let i = 0; i < SIZE; i++) { add(r * SIZE + i); add(i * SIZE + c); }
        } else if (tile.type === 'spectrum') {
          const color = direct?.spectrum.length === 2 ? 'all' :
            direct?.spectrum.includes(index) ? this.tile(direct.target)?.color : this.nearbyColor(index);
          if (color === 'all' || color !== null && color !== undefined) for (let i = 0; i < SIZE * SIZE; i++)
            if (color === 'all' || this.tile(i)?.color === color) add(i);
        }
      }
      events.push({type: 'clear', board: copy(this.board), cells: [...cleared], activated, creations, chain});
      earned += (cleared.size * 20 + creations.length * 80) * chain;
      for (const index of cleared) this.set(index, null);
      for (const creation of creations) this.set(creation.index, creation.tile);
      const falls = Array(SIZE * SIZE);
      for (let c = 0; c < SIZE; c++) {
        const remaining = [];
        for (let r = SIZE - 1; r >= 0; r--) if (this.board[r][c]) remaining.push({tile: this.board[r][c], row: r});
        const missing = SIZE - remaining.length;
        for (let r = SIZE - 1; r >= 0; r--) {
          const existing = remaining[SIZE - 1 - r];
          this.board[r][c] = existing?.tile ?? this.gem();
          falls[r * SIZE + c] = (existing?.row ?? r - missing) * SIZE + c;
        }
      }
      events.push({type: 'fall', board: copy(this.board), falls, chain});
      direct = null;
      match = this.matches();
    }
    this.score += earned;
    this.level = 1 + Math.floor(this.score / 2000);
    let rescued = false;
    if (!this.hasMove()) {
      if (this.mode === 'classic') {
        this.ended = true;
        events.push({type: 'gameover', board: copy(this.board), chain});
      } else {
        const index = this.rescue();
        events.push({type: 'rescue', board: copy(this.board), index, chain});
        rescued = true;
      }
    }
    return {valid: true, events, earned, chain, rescued, ended: this.ended};
  }

  rescue() {
    // A new Espectro guarantees a move and keeps every other tile in place.
    const index = [27, 28, 35, 36, ...Array.from({length: SIZE * SIZE}, (_, i) => i)]
      .find(cell => this.tile(cell)?.type === 'normal');
    if (index === undefined) throw new Error('Não há posição para recuperar o tabuleiro');
    this.set(index, this.gem(null, 'spectrum'));
    return index;
  }

  nearbyColor(index) {
    const [r, c] = position(index);
    for (let distance = 1; distance < SIZE; distance++)
      for (const next of [r * SIZE + c - distance, r * SIZE + c + distance])
        if (Math.floor(next / SIZE) === r && this.tile(next)?.color != null) return this.tile(next).color;
    return null;
  }

  shuffle() {
    if (this.mode === 'classic' || this.ended) return false;
    this.board = this.freshBoard();
    return true;
  }

  restore(saved) {
    const validTile = tile => Number.isInteger(tile) && tile >= 0 && tile < COLORS ||
      tile && typeof tile === 'object' && Number.isInteger(tile.id) && tile.id > 0 &&
      (tile.type === 'spectrum' && tile.color === null ||
        ['normal', 'burst', 'cross'].includes(tile.type) && Number.isInteger(tile.color) && tile.color >= 0 && tile.color < COLORS);
    if (!saved || !['zen', 'classic', 'endless'].includes(saved.mode) ||
      !Number.isSafeInteger(saved.score) || saved.score < 0 ||
      !Array.isArray(saved.board) || saved.board.length !== SIZE ||
      !saved.board.every(row => Array.isArray(row) && row.length === SIZE && row.every(validTile))) return false;
    const ids = new Set();
    const board = saved.board.map(row => row.map(tile => {
      const gem = typeof tile === 'number' ? this.gem(tile) : {...tile};
      if (ids.has(gem.id)) throw new Error('Pedras duplicadas no save');
      ids.add(gem.id);
      this.nextId = Math.max(this.nextId, gem.id + 1);
      return gem;
    }));
    this.board = board;
    this.mode = saved.mode === 'endless' ? 'classic' : saved.mode;
    this.score = saved.score;
    this.level = 1 + Math.floor(this.score / 2000);
    this.ended = false;
    if (this.matches().cells.length) this.board = this.freshBoard();
    if (!this.hasMove()) {
      if (this.mode === 'classic') this.ended = true;
      else this.rescue();
    } else if (this.mode === 'classic' && saved.ended === true) this.ended = true;
    return true;
  }
}
