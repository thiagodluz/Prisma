import {Game, SIZE, levelGoal} from './engine.js?v=7';

const $ = selector => document.querySelector(selector);
const boardElement = $('#board');
const boardFrame = $('.board-frame');
const effectLayer = document.createElement('div');
effectLayer.className = 'effect-layer';
effectLayer.setAttribute('aria-hidden', 'true');
boardFrame.append(effectLayer);
const scoreElement = $('#score');
const bestElement = $('#best');
const levelElement = $('#level');
const modeLabel = $('#mode-label');
const progress = $('#progress');
const progressFill = $('#progress-fill');
const progressLabel = $('#progress-label');
const combo = $('#combo');
const toast = $('#toast');
const gameOver = $('#game-over');
const levelUp = $('#level-up');
const game = new Game();
const names = ['rubi', 'âmbar', 'sol', 'jade', 'água', 'safira', 'ametista'];
const sessionKey = mode => 'prisma.session.' + mode;
try {
  const legacy = JSON.parse(localStorage.getItem('prisma.session'));
  const legacyMode = legacy?.mode === 'endless' ? 'classic' : legacy?.mode;
  if (['zen', 'classic'].includes(legacyMode) && !localStorage.getItem(sessionKey(legacyMode))) {
    localStorage.setItem(sessionKey(legacyMode), JSON.stringify({...legacy, mode: legacyMode}));
    if (!localStorage.getItem('prisma.activeMode')) localStorage.setItem('prisma.activeMode', legacyMode);
  }
  const active = localStorage.getItem('prisma.activeMode');
  const mode = ['zen', 'classic'].includes(active) ? active : 'zen';
  if (!game.restore(JSON.parse(localStorage.getItem(sessionKey(mode))))) game.newGame(mode);
} catch { /* A corrupted or unavailable save starts a new game. */ }
let selected = null;
let pointerStart = null;
let busy = false;
let hintTimer;
let soundOn = true;
try { soundOn = localStorage.getItem('prisma.sound') !== 'off'; } catch { /* Some local file views deny storage. */ }
let vibrationOn = false;
try { vibrationOn = localStorage.getItem('prisma.vibration') === 'on'; } catch {}
const canVibrate = typeof navigator.vibrate === 'function';
$('#vibration').hidden = !canVibrate;
let audioContext;

function safeRecord(mode) {
  try {
    const saved = JSON.parse(localStorage.getItem('prisma.records.' + mode)) || {};
    const legacy = Number(localStorage.getItem('prisma.best.' + mode)) ||
      (mode === 'classic' ? Number(localStorage.getItem('prisma.best.endless')) : 0) || 0;
    const safe = value => Number.isSafeInteger(value) && value >= 0 ? value : 0;
    return {bestScore: Math.max(safe(saved.bestScore), safe(legacy)),
      bestLevel: Math.max(1, safe(saved.bestLevel)), bestMove: safe(saved.bestMove),
      finished: safe(saved.finished)};
  } catch { return {bestScore: 0, bestLevel: 1, bestMove: 0, finished: 0}; }
}

function save() {
  try {
    localStorage.setItem(sessionKey(game.mode), JSON.stringify({
      mode: game.mode, score: game.score, board: game.board, ended: game.ended,
      progressionVersion: 2, level: game.level, levelStartScore: game.levelStartScore
    }));
    localStorage.setItem('prisma.activeMode', game.mode);
  } catch {}
}

function playTone(chain = 1) {
  if (!soundOn) return;
  try {
    audioContext ??= new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === 'suspended') audioContext.resume();
    const now = audioContext.currentTime;
    for (let i = 0; i < 3; i++) {
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440 * 2 ** ((i * 4 + Math.min(chain, 5) * 2) / 12), now + i * .07);
      gain.gain.setValueAtTime(.0001, now + i * .07);
      gain.gain.exponentialRampToValueAtTime(.05, now + i * .07 + .015);
      gain.gain.exponentialRampToValueAtTime(.0001, now + i * .07 + .19);
      osc.connect(gain).connect(audioContext.destination);
      osc.start(now + i * .07);
      osc.stop(now + i * .07 + .2);
    }
  } catch { /* Audio is optional. */ }
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('visible'), 1250);
}

function draw(board = game.board, matched = []) {
  const hits = new Set(matched);
  boardElement.replaceChildren(...board.flatMap((row, r) => row.map((tile, c) => {
    const index = r * SIZE + c;
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'cell';
    if (index === selected) cell.classList.add('selected');
    if (hits.has(index)) cell.classList.add('matched');
    cell.dataset.index = String(index);
    cell.setAttribute('role', 'gridcell');
    const specialName = {burst: 'Pulso', cross: 'Raio', spectrum: 'Espectro'}[tile.type];
    cell.setAttribute('aria-label', `Linha ${r + 1}, coluna ${c + 1}: ${specialName ? `pedra ${specialName}${tile.color === null ? '' : ` ${names[tile.color]}`}` : names[tile.color]}`);
    cell.dataset.tileId = String(tile.id);
    const mover = document.createElement('span');
    mover.className = 'mover';
    const gem = document.createElement('span');
    gem.className = `gem gem-${tile.color === null ? 'spectrum' : tile.color}${specialName ? ` special special-${tile.type}` : ''}`;
    if (specialName) gem.setAttribute('data-symbol', {burst: '✺', cross: '✦', spectrum: '✶'}[tile.type]);
    mover.append(gem);
    cell.append(mover);
    return cell;
  })));
}

function hud(moveEarned = 0, finishedGame = false) {
  scoreElement.textContent = game.score.toLocaleString('pt-BR');
  const record = safeRecord(game.mode);
  record.bestScore = Math.max(record.bestScore, game.score);
  record.bestLevel = Math.max(record.bestLevel, game.level);
  record.bestMove = Math.max(record.bestMove, moveEarned);
  if (finishedGame && game.mode === 'classic') record.finished++;
  try {
    localStorage.setItem('prisma.records.' + game.mode, JSON.stringify(record));
    localStorage.setItem('prisma.best.' + game.mode, String(record.bestScore));
  } catch {}
  bestElement.textContent = record.bestScore.toLocaleString('pt-BR');
  levelElement.textContent = String(game.level);
  modeLabel.textContent = 'NÍVEL';
  progress.hidden = false;
  const gained = game.score - game.levelStartScore;
  const goal = levelGoal(game.level);
  progressFill.style.width = `${Math.min(100, gained / goal * 100)}%`;
  progress.setAttribute('aria-valuenow', String(gained));
  progress.setAttribute('aria-valuemax', String(goal));
  progressLabel.textContent = `${gained.toLocaleString('pt-BR')} / ${goal.toLocaleString('pt-BR')} para o próximo nível`;
  for (const mode of ['zen', 'classic']) {
    const value = mode === game.mode ? record : safeRecord(mode);
    $('#record-' + mode + '-score').textContent = value.bestScore.toLocaleString('pt-BR');
    $('#record-' + mode + '-level').textContent = String(value.bestLevel);
    $('#record-' + mode + '-move').textContent = value.bestMove.toLocaleString('pt-BR');
    if (mode === 'classic') $('#record-classic-finished').textContent = String(value.finished);
  }
  for (const button of document.querySelectorAll('.mode')) button.classList.toggle('selected', button.dataset.mode === game.mode);
  $('#shuffle').hidden = game.mode === 'classic';
  $('#hint').disabled = game.ended;
  boardElement.classList.toggle('finished', game.ended);
  gameOver.hidden = !game.ended;
  $('#final-score').textContent = game.score.toLocaleString('pt-BR');
  $('#final-level').textContent = String(game.level);
  $('#sound').textContent = soundOn ? '♫' : '♪';
  $('#sound').setAttribute('aria-label', soundOn ? 'Desativar sons' : 'Ativar sons');
  $('#vibration').setAttribute('aria-pressed', String(vibrationOn));
  $('#vibration').setAttribute('aria-label', vibrationOn ? 'Desativar vibração' : 'Ativar vibração');
}

function clearHint() {
  clearTimeout(hintTimer);
  for (const cell of boardElement.querySelectorAll?.('.cell.hinted') ?? []) cell.classList.remove('hinted');
}

const reducedMotion = () => document.visibilityState === 'hidden' ||
  (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
const activeAnimations = new Set();
async function waitAnimations(animations) {
  if (!animations.length) return;
  animations.forEach(animation => activeAnimations.add(animation));
  let watchdog;
  try {
    await Promise.race([
      Promise.all(animations.map(animation => animation.finished.catch(() => {}))),
      new Promise(resolve => { watchdog = setTimeout(resolve, 650); })
    ]);
  } finally {
    clearTimeout(watchdog);
    animations.forEach(animation => { activeAnimations.delete(animation); animation.cancel?.(); });
  }
}
document.addEventListener?.('visibilitychange', () => {
  if (document.visibilityState === 'hidden')
    for (const animation of activeAnimations) animation.cancel?.();
});
function vibrate(pattern) {
  if (vibrationOn && canVibrate) try { navigator.vibrate(pattern); } catch {}
}

async function animateSwap(a, b, valid) {
  if (reducedMotion()) return;
  const cells = boardElement.querySelectorAll('.cell');
  const first = cells[a]?.getBoundingClientRect();
  const second = cells[b]?.getBoundingClientRect();
  if (!first || !second) return;
  const dx = second.left - first.left, dy = second.top - first.top;
  const options = {duration: valid ? 170 : 260, easing: 'ease-in-out'};
  const paths = valid
    ? [[{transform: 'translate(0, 0)'}, {transform: `translate(${dx}px, ${dy}px)`}],
       [{transform: 'translate(0, 0)'}, {transform: `translate(${-dx}px, ${-dy}px)`}]]
    : [[{transform: 'translate(0, 0)'}, {transform: `translate(${dx}px, ${dy}px)`, offset: .48}, {transform: 'translate(0, 0)'}],
       [{transform: 'translate(0, 0)'}, {transform: `translate(${-dx}px, ${-dy}px)`, offset: .48}, {transform: 'translate(0, 0)'}]];
  const animations = [a, b].map((index, i) => cells[index].querySelector('.mover').animate(paths[i], options));
  await waitAnimations(animations);
}

async function animateFall(falls) {
  if (reducedMotion()) return;
  const cells = boardElement.querySelectorAll('.cell');
  const pitch = cells[SIZE].getBoundingClientRect().top - cells[0].getBoundingClientRect().top;
  const animations = [];
  for (let index = 0; index < falls.length; index++) {
    const distance = (Math.floor(falls[index] / SIZE) - Math.floor(index / SIZE)) * pitch;
    if (!distance) continue;
    const spawned = falls[index] < 0;
    animations.push(cells[index].querySelector('.mover').animate(
      [{transform: `translateY(${distance}px)`, opacity: spawned ? .45 : 1},
       {transform: 'translateY(0)', opacity: 1}],
      {duration: Math.min(400, 210 + Math.abs(distance / pitch) * 27), easing: 'cubic-bezier(.2, .78, .24, 1)', fill: 'both'}));
  }
  await waitAnimations(animations);
}

async function animateClear(frame) {
  if (reducedMotion()) return;
  const cells = boardElement.querySelectorAll('.cell');
  const boardRect = boardElement.getBoundingClientRect();
  const frameRect = boardFrame.getBoundingClientRect();
  const pitch = cells[1]?.getBoundingClientRect().left - cells[0]?.getBoundingClientRect().left || 40;
  const effects = [];
  const overlays = [];
  const addOverlay = (className, style, keyframes, options) => {
    const element = document.createElement('span');
    element.className = className;
    Object.assign(element.style, style);
    effectLayer.append(element);
    overlays.push(element);
    effects.push(element.animate(keyframes, {fill: 'both', ...options}));
  };
  for (const effect of frame.activated) {
    const rect = cells[effect.index]?.getBoundingClientRect();
    if (!rect) continue;
    const x = rect.left + rect.width / 2 - frameRect.left;
    const y = rect.top + rect.height / 2 - frameRect.top;
    if (effect.type === 'burst' || effect.type === 'cross') {
      const size = pitch * 1.15;
      addOverlay('effect-wave', {left: `${x - size / 2}px`, top: `${y - size / 2}px`,
        width: `${size}px`, height: `${size}px`},
      [{transform: 'scale(.3)', opacity: 0}, {transform: 'scale(1.2)', opacity: .9, offset: .35},
        {transform: effect.type === 'burst' ? 'scale(3)' : 'scale(2)', opacity: 0}],
      {duration: 360, easing: 'ease-out'});
    }
    if (effect.type === 'cross') {
      const left = boardRect.left - frameRect.left;
      const top = boardRect.top - frameRect.top;
      addOverlay('effect-beam', {left: `${left}px`, top: `${y - 4}px`,
        width: `${boardRect.width}px`, height: '8px'},
      [{transform: 'scaleX(0)', opacity: 0}, {transform: 'scaleX(1)', opacity: 1, offset: .45},
        {transform: 'scaleX(1)', opacity: 0}], {duration: 330, easing: 'ease-out'});
      addOverlay('effect-beam', {left: `${x - 4}px`, top: `${top}px`,
        width: '8px', height: `${boardRect.height}px`},
      [{transform: 'scaleY(0)', opacity: 0}, {transform: 'scaleY(1)', opacity: 1, offset: .45},
        {transform: 'scaleY(1)', opacity: 0}], {duration: 330, easing: 'ease-out'});
    }
    if (effect.type === 'spectrum')
      addOverlay('effect-glow', {}, [{opacity: 0}, {opacity: .9, offset: .35}, {opacity: 0}],
        {duration: 370, easing: 'ease-out'});
  }
  for (const index of frame.cells) {
    const mover = cells[index]?.querySelector('.mover');
    if (!mover) continue;
    const distance = frame.activated.length ? Math.min(...frame.activated.map(effect =>
      Math.abs(Math.floor(index / SIZE) - Math.floor(effect.index / SIZE)) +
      Math.abs(index % SIZE - effect.index % SIZE))) : 0;
    const delay = frame.activated.length ? Math.min(100, distance * 22) : 0;
    effects.push(mover.animate(
      [{transform: 'scale(1)', opacity: 1, filter: 'brightness(1)'},
        {transform: 'scale(1.12)', opacity: 1, filter: 'brightness(1.8)', offset: .38},
        {transform: 'scale(.72)', opacity: 0, filter: 'brightness(1.5)'}],
      {duration: frame.activated.length ? 300 : 225, delay, easing: 'ease-out', fill: 'both'}));
  }
  try { await waitAnimations(effects); }
  finally { overlays.forEach(element => element.remove()); }
}

async function animateLevel() {
  levelUp.textContent = `Nível ${game.level}`;
  if (reducedMotion()) return;
  levelUp.hidden = false;
  try {
    await waitAnimations([levelUp.animate([
      {opacity: 0, transform: 'translate(-50%, -42%) scale(.82)'},
      {opacity: 1, transform: 'translate(-50%, -50%) scale(1)', offset: .25},
      {opacity: 1, transform: 'translate(-50%, -50%) scale(1)', offset: .7},
      {opacity: 0, transform: 'translate(-50%, -58%) scale(1.08)'}
    ], {duration: 580, easing: 'ease-out'})]);
  } finally { levelUp.hidden = true; }
}

async function attempt(a, b) {
  if (busy) return;
  selected = null;
  const result = game.move(a, b);
  busy = true;
  boardElement.classList.add('busy');
  if (result.valid) {
    // The engine has already committed all cascades; persist before any visual delay.
    save();
    hud(result.earned, result.ended);
    vibrate(result.levelsGained ? [12, 45, 18] : result.events.some(frame => frame.activated?.length) ? 18 : 10);
  }
  try {
    await animateSwap(a, b, result.valid);
    if (!result.valid) return;
    for (const frame of result.events) {
      if (document.visibilityState === 'hidden') break;
      draw(frame.board, frame.type === 'clear' ? frame.cells : []);
      if (frame.type === 'clear') {
        playTone(frame.chain);
        combo.textContent = frame.activated.some(effect => effect.type === 'spectrum') ? 'Explosão de cores!' :
          frame.activated.length ? 'Reação em cadeia!' :
          frame.creations.length ? 'Nova pedra especial!' :
          frame.chain > 1 ? `Cascata ×${frame.chain}!` : 'Boa combinação!';
        await animateClear(frame);
      } else if (frame.type === 'fall') await animateFall(frame.falls);
      else if (frame.type === 'rescue') {
        combo.textContent = 'Um Espectro abriu uma nova jogada';
        if (!reducedMotion()) {
          const mover = boardElement.querySelectorAll('.cell')[frame.index]?.querySelector('.mover');
          if (mover) await waitAnimations([mover.animate([{transform: 'scale(.25)', opacity: 0},
            {transform: 'scale(1.16)', opacity: 1, offset: .65},
            {transform: 'scale(1)', opacity: 1}], {duration: 300, easing: 'ease-out'})]);
        }
      }
    }
    if (result.levelsGained) await animateLevel();
  } catch { /* Visual effects are optional; the committed board remains playable. */ }
  finally {
    effectLayer.replaceChildren();
    levelUp.hidden = true;
    draw();
    if (result.valid) {
      showToast(`+${result.earned.toLocaleString('pt-BR')}${result.levelsGained ? ` · Nível ${game.level}!` :
        result.chain > 1 ? ` · ${result.chain} cascatas` : ''}`);
      if (result.ended) combo.textContent = 'Sem jogadas restantes';
      else if (result.levelsGained) combo.textContent = `Nível ${game.level}!`;
      else if (!result.rescued) setTimeout(() => { if (!busy) combo.textContent = 'Combine três ou mais'; }, 1500);
    }
    boardElement.classList.remove('busy');
    busy = false;
  }
}

function handleIndex(index) {
  if (busy || game.ended || index < 0) return;
  clearHint();
  if (selected === null) selected = index;
  else if (selected === index) selected = null;
  else if (game.adjacent(selected, index)) { attempt(selected, index); return; }
  else selected = index;
  draw();
}

function gestureTarget(start, x, y) {
  const dx = x - start.x, dy = y - start.y;
  const width = boardElement.querySelectorAll('.cell')[start.index]?.getBoundingClientRect().width || 48;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < Math.max(12, Math.min(24, width * .28))) return null;
  const step = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : -1) : (dy > 0 ? SIZE : -SIZE);
  const end = start.index + step;
  return game.adjacent(start.index, end) ? end : null;
}
function clearGesture() {
  for (const cell of boardElement.querySelectorAll('.cell.pressed, .cell.drag-target'))
    cell.classList.remove('pressed', 'drag-target');
  pointerStart = null;
}
boardElement.addEventListener('pointerdown', event => {
  const cell = event.target.closest('.cell');
  if (!cell || pointerStart || busy || game.ended) return;
  clearHint();
  pointerStart = {index: Number(cell.dataset.index), x: event.clientX, y: event.clientY, id: event.pointerId};
  cell.classList.add('pressed');
  try { boardElement.setPointerCapture?.(event.pointerId); } catch {}
});
boardElement.addEventListener('pointermove', event => {
  if (!pointerStart || event.pointerId !== pointerStart.id) return;
  const end = gestureTarget(pointerStart, event.clientX, event.clientY);
  for (const cell of boardElement.querySelectorAll('.cell.drag-target')) cell.classList.remove('drag-target');
  if (end !== null) boardElement.querySelectorAll('.cell')[end]?.classList.add('drag-target');
});
boardElement.addEventListener('pointerup', event => {
  if (!pointerStart || event.pointerId !== pointerStart.id) return;
  const start = pointerStart;
  const end = gestureTarget(start, event.clientX, event.clientY);
  clearGesture();
  try { boardElement.releasePointerCapture?.(event.pointerId); } catch {}
  if (busy) return;
  if (end !== null) attempt(start.index, end);
  else if (Math.max(Math.abs(event.clientX - start.x), Math.abs(event.clientY - start.y)) < 12)
    handleIndex(start.index);
});
boardElement.addEventListener('pointercancel', event => {
  if (pointerStart && event.pointerId === pointerStart.id) clearGesture();
});
boardElement.addEventListener('keydown', event => {
  const index = Number(event.target.closest('.cell')?.dataset.index);
  if (!Number.isInteger(index)) return;
  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); handleIndex(index); }
});

$('#hint').addEventListener('click', () => {
  if (busy || game.ended) return;
  clearHint();
  const hint = game.hint();
  if (!hint) return;
  const cells = boardElement.querySelectorAll('.cell');
  cells[hint.a]?.classList.add('hinted');
  cells[hint.b]?.classList.add('hinted');
  combo.textContent = 'Troque as pedras destacadas';
  hintTimer = setTimeout(() => {
    clearHint();
    if (!busy) combo.textContent = 'Combine três ou mais';
  }, 2600);
});
$('#shuffle').addEventListener('click', () => {
  if (busy) return;
  clearHint();
  selected = null;
  if (!game.shuffle()) return;
  draw();
  save();
  showToast('Tabuleiro embaralhado');
});
$('#new-game').addEventListener('click', () => {
  if (busy) return;
  clearHint();
  selected = null;
  game.newGame();
  combo.textContent = 'Combine três ou mais';
  draw(); hud(); save();
});
$('#play-again').addEventListener('click', () => {
  if (busy) return;
  clearHint();
  selected = null;
  game.newGame();
  combo.textContent = 'Combine três ou mais';
  draw(); hud(); save();
});
document.querySelectorAll('.mode').forEach(button => button.addEventListener('click', () => {
  if (busy || game.mode === button.dataset.mode) return;
  clearHint();
  selected = null;
  save();
  try {
    const saved = JSON.parse(localStorage.getItem(sessionKey(button.dataset.mode)));
    if (!game.restore(saved)) game.newGame(button.dataset.mode);
  } catch { game.newGame(button.dataset.mode); }
  combo.textContent = game.ended ? 'Sem jogadas restantes' : 'Combine três ou mais';
  draw(); hud(); save();
}));
$('#sound').addEventListener('click', () => {
  soundOn = !soundOn;
  try { localStorage.setItem('prisma.sound', soundOn ? 'on' : 'off'); } catch {}
  hud();
});
$('#vibration').addEventListener('click', () => {
  vibrationOn = !vibrationOn;
  try { localStorage.setItem('prisma.vibration', vibrationOn ? 'on' : 'off'); } catch {}
  hud();
  vibrate(8);
});

draw(); hud();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
