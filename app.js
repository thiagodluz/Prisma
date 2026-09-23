import {Game, SIZE} from './engine.js?v=4';

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
const combo = $('#combo');
const toast = $('#toast');
const game = new Game();
const names = ['rubi', 'âmbar', 'sol', 'jade', 'água', 'safira', 'ametista'];
try {
  const saved = JSON.parse(localStorage.getItem('prisma.session'));
  game.restore(saved);
} catch { /* A corrupted or unavailable save starts a new game. */ }
let selected = null;
let pointerStart = null;
let busy = false;
let soundOn = true;
try { soundOn = localStorage.getItem('prisma.sound') !== 'off'; } catch { /* Some local file views deny storage. */ }
let audioContext;

function safeBest(mode) {
  try { return Number(localStorage.getItem('prisma.best.' + mode)) || 0; }
  catch { return 0; }
}

function save() {
  try { localStorage.setItem('prisma.session', JSON.stringify({mode: game.mode, score: game.score, board: game.board})); } catch {}
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

function hud() {
  scoreElement.textContent = game.score.toLocaleString('pt-BR');
  const best = Math.max(game.score, safeBest(game.mode));
  bestElement.textContent = best.toLocaleString('pt-BR');
  try { if (best > safeBest(game.mode)) localStorage.setItem('prisma.best.' + game.mode, String(best)); } catch {}
  levelElement.textContent = game.mode === 'zen' ? 'ZEN' : String(game.level);
  modeLabel.textContent = game.mode === 'zen' ? 'MODO' : 'NÍVEL';
  progress.hidden = game.mode === 'zen';
  progressFill.style.width = `${(game.score % 2000) / 20}%`;
  for (const button of document.querySelectorAll('.mode')) button.classList.toggle('selected', button.dataset.mode === game.mode);
  $('#sound').textContent = soundOn ? '♫' : '♪';
  $('#sound').setAttribute('aria-label', soundOn ? 'Desativar sons' : 'Ativar sons');
}

const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

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
  await Promise.all(animations.map(animation => animation.finished.catch(() => {})));
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
  await Promise.all(animations.map(animation => animation.finished.catch(() => {})));
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
  try { await Promise.all(effects.map(animation => animation.finished.catch(() => {}))); }
  finally { overlays.forEach(element => element.remove()); }
}

async function attempt(a, b) {
  if (busy) return;
  selected = null;
  const result = game.move(a, b);
  busy = true;
  boardElement.classList.add('busy');
  await animateSwap(a, b, result.valid);
  if (!result.valid) {
    draw();
    boardElement.classList.remove('busy');
    busy = false;
    return;
  }
  for (const frame of result.events) {
    draw(frame.board, frame.type === 'clear' ? frame.cells : []);
    if (frame.type === 'clear') {
      playTone(frame.chain);
      combo.textContent = frame.activated.some(effect => effect.type === 'spectrum') ? 'Explosão de cores!' :
        frame.activated.length ? 'Reação em cadeia!' :
        frame.creations.length ? 'Nova pedra especial!' :
        frame.chain > 1 ? `Cascata ×${frame.chain}!` : 'Boa combinação!';
      await animateClear(frame);
    } else if (frame.type === 'fall') await animateFall(frame.falls);
    else if (frame.type === 'shuffle' && !reducedMotion()) await pause(120);
  }
  draw();
  hud();
  save();
  showToast(`+${result.earned.toLocaleString('pt-BR')}${result.chain > 1 ? ` · ${result.chain} cascatas` : ''}`);
  if (result.shuffled) combo.textContent = 'Novas jogadas disponíveis';
  else setTimeout(() => { if (!busy) combo.textContent = 'Combine três ou mais'; }, 1500);
  boardElement.classList.remove('busy');
  busy = false;
}

function handleIndex(index) {
  if (busy || index < 0) return;
  if (selected === null) selected = index;
  else if (selected === index) selected = null;
  else if (game.adjacent(selected, index)) { attempt(selected, index); return; }
  else selected = index;
  draw();
}

boardElement.addEventListener('pointerdown', event => {
  const cell = event.target.closest('.cell');
  if (!cell || busy) return;
  pointerStart = {index: Number(cell.dataset.index), x: event.clientX, y: event.clientY};
});
boardElement.addEventListener('pointerup', event => {
  if (!pointerStart || busy) return;
  const start = pointerStart;
  pointerStart = null;
  const dx = event.clientX - start.x, dy = event.clientY - start.y;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 15) return handleIndex(start.index);
  const step = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : -1) : (dy > 0 ? SIZE : -SIZE);
  const end = start.index + step;
  if (game.adjacent(start.index, end)) attempt(start.index, end);
});
boardElement.addEventListener('pointercancel', () => { pointerStart = null; });
boardElement.addEventListener('keydown', event => {
  const index = Number(event.target.closest('.cell')?.dataset.index);
  if (!Number.isInteger(index)) return;
  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); handleIndex(index); }
});

$('#shuffle').addEventListener('click', () => {
  if (busy) return;
  selected = null;
  game.shuffle();
  draw();
  save();
  showToast('Tabuleiro embaralhado');
});
$('#new-game').addEventListener('click', () => {
  if (busy) return;
  selected = null;
  game.newGame();
  combo.textContent = 'Combine três ou mais';
  draw(); hud(); save();
});
document.querySelectorAll('.mode').forEach(button => button.addEventListener('click', () => {
  if (busy || game.mode === button.dataset.mode) return;
  selected = null;
  game.newGame(button.dataset.mode);
  combo.textContent = 'Combine três ou mais';
  draw(); hud(); save();
}));
$('#sound').addEventListener('click', () => {
  soundOn = !soundOn;
  try { localStorage.setItem('prisma.sound', soundOn ? 'on' : 'off'); } catch {}
  hud();
});

draw(); hud();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
