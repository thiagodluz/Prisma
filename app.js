import {Game, SIZE, levelGoal} from './engine.js?v=16';
import {ZenAudio, normalizeZenSettings, breathTiming} from './zen.js?v=16';
import {SoundDesign, normalizeAudioSettings, cueForFrame} from './sound.js?v=16';

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
const scoreGain = $('#score-gain');
const combo = $('#combo');
const toast = $('#toast');
const gameOver = $('#game-over');
const levelUp = $('#level-up');
const game = new Game();
const names = ['rubi', 'âmbar', 'sol', 'jade', 'água', 'safira', 'ametista'];
let visualStyle = 'illustrated';
try { if (localStorage.getItem('prisma.visualStyle') === 'original') visualStyle = 'original'; } catch {}
function syncVisualStyle() {
  document.documentElement.dataset.visualStyle = visualStyle;
  for (const button of document.querySelectorAll('.visual-option')) {
    const active = button.dataset.visual === visualStyle;
    button.classList.toggle('selected', active);
    button.setAttribute('aria-pressed', String(active));
  }
}
syncVisualStyle();
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
let audioSettings;
try { audioSettings = normalizeAudioSettings(JSON.parse(localStorage.getItem('prisma.audio.settings'))); }
catch { audioSettings = normalizeAudioSettings(null); }
let zenSettings;
try { zenSettings = normalizeZenSettings(JSON.parse(localStorage.getItem('prisma.zen.settings'))); }
catch { zenSettings = normalizeZenSettings(null); }
let vibrationOn = false;
try { vibrationOn = localStorage.getItem('prisma.vibration') === 'on'; } catch {}
const nativeHaptics = globalThis.window?.PrismaHaptics;
let canVibrate = false;
try { canVibrate = nativeHaptics ? nativeHaptics.isAvailable() : typeof navigator.vibrate === 'function'; } catch {}
$('#vibration').hidden = !canVibrate;
let audioContext;
const getAudioContext = () => audioContext ??= new (window.AudioContext || window.webkitAudioContext)();
const zenAudio = new ZenAudio(getAudioContext);
const soundDesign = new SoundDesign(getAudioContext);
soundDesign.setVolume(audioSettings.effects);
zenAudio.setVolumes(audioSettings);
async function unlockAudio(force = false) {
  if (!force && !soundOn && !(game.mode === 'zen' && (zenSettings.music || zenSettings.ambience))) return false;
  try {
    const context = getAudioContext();
    if (context.state !== 'running') await context.resume();
    return context.state === 'running';
  } catch { return false; /* The game stays playable without Web Audio. */ }
}
let breathTimer;
let breathStart = 0;
let breathStage = '';
let nativePaused = false;
const appPaused = () => nativePaused || document.visibilityState === 'hidden';

function syncZenAudio() {
  zenAudio.sync({active: game.mode === 'zen' && !appPaused(),
    music: zenSettings.music, ambience: zenSettings.ambience});
}

function updateBreathStep() {
  const timing = breathTiming(zenSettings.breath);
  if (!timing) return;
  const seconds = (Date.now() - breathStart) / 1000;
  const position = seconds % (timing[0] + timing[1]);
  const inhale = position < timing[0];
  const phase = inhale ? 'in' : 'out';
  const length = inhale ? timing[0] : timing[1];
  const remaining = Math.max(1, Math.ceil(length - (inhale ? position : position - timing[0])));
  $('#breath-count').textContent = `${remaining} ${remaining === 1 ? 'segundo' : 'segundos'}`;
  if (phase !== breathStage) {
    breathStage = phase;
    $('#breath-phase').textContent = inhale ? 'Inspire' : 'Expire';
    const orb = $('#breath-orb');
    orb.className = `breath-orb phase-${phase}`;
    orb.style.setProperty('--breath-duration', `${length}s`);
  }
}

function syncBreath(reset = false) {
  clearInterval(breathTimer);
  breathTimer = null;
  const active = game.mode === 'zen' && !appPaused() &&
    breathTiming(zenSettings.breath);
  $('#breath-guide').hidden = !active;
  if (!active) { breathStage = ''; return; }
  if (reset || !breathStart) { breathStart = Date.now(); breathStage = ''; }
  updateBreathStep();
  breathTimer = setInterval(updateBreathStep, 250);
}

function syncZenUI(resetBreath = false) {
  $('#zen-panel').hidden = game.mode !== 'zen';
  $('#zen-music').checked = zenSettings.music;
  $('#zen-ambience').checked = zenSettings.ambience;
  $('#zen-breath').value = zenSettings.breath;
  $('#zen-effects').value = zenSettings.effects;
  boardFrame.dataset.effects = game.mode === 'zen' ? zenSettings.effects : 'normal';
  syncBreath(resetBreath);
  syncZenAudio();
}

function saveZenSettings() {
  try { localStorage.setItem('prisma.zen.settings', JSON.stringify(zenSettings)); } catch {}
}

function syncAudioSettingsUI() {
  for (const channel of ['effects', 'music', 'ambience']) {
    $('#volume-' + channel).value = String(audioSettings[channel]);
    $('#volume-' + channel + '-value').textContent = `${audioSettings[channel]}%`;
  }
}

function saveAudioSettings() {
  try { localStorage.setItem('prisma.audio.settings', JSON.stringify(audioSettings)); } catch {}
}

const effectScale = () => game.mode !== 'zen' ? 1 : zenSettings.effects === 'soft' ? .82 :
  zenSettings.effects === 'vivid' ? 1.1 : 1;

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

function playTone(kind, chain = 1) {
  if (soundOn && !appPaused()) soundDesign.play(kind, chain);
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('visible'), 1250);
}

function showScoreGain(points) {
  scoreGain.textContent = `+${points.toLocaleString('pt-BR')}`;
  scoreGain.classList.add('visible');
  clearTimeout(showScoreGain.timer);
  showScoreGain.timer = setTimeout(() => scoreGain.classList.remove('visible'), 1250);
}

function clearScoreGain() {
  clearTimeout(showScoreGain.timer);
  scoreGain.textContent = '';
  scoreGain.classList.remove('visible');
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
  const effectsAudible = soundOn && audioSettings.effects > 0;
  $('#sound').textContent = effectsAudible ? '♫' : '♪';
  $('#sound').setAttribute('aria-pressed', String(effectsAudible));
  $('#sound').setAttribute('aria-label', effectsAudible ? 'Desativar sons do jogo' : 'Ativar sons do jogo');
  $('#vibration').setAttribute('aria-pressed', String(vibrationOn));
  $('#vibration').setAttribute('aria-label', vibrationOn ? 'Desativar vibração' : 'Ativar vibração');
}

function clearHint() {
  clearTimeout(hintTimer);
  for (const cell of boardElement.querySelectorAll?.('.cell.hinted') ?? []) cell.classList.remove('hinted');
}

const reducedMotion = () => appPaused() ||
  (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
const activeAnimations = new Set();
async function waitAnimations(animations) {
  if (!animations.length) return;
  animations.forEach(animation => activeAnimations.add(animation));
  let watchdog;
  try {
    await Promise.race([
      Promise.all(animations.map(animation => animation.finished.catch(() => {}))),
      new Promise(resolve => { watchdog = setTimeout(resolve, 900); })
    ]);
  } finally {
    clearTimeout(watchdog);
    animations.forEach(animation => { activeAnimations.delete(animation); animation.cancel?.(); });
  }
}
document.addEventListener?.('visibilitychange', () => {
  if (appPaused())
    for (const animation of activeAnimations) animation.cancel?.();
  syncZenAudio();
  syncBreath(!appPaused());
});
document.addEventListener?.('prisma:pause', () => {
  nativePaused = true;
  save();
  for (const animation of activeAnimations) animation.cancel?.();
  syncZenAudio();
  syncBreath();
});
document.addEventListener?.('prisma:resume', () => {
  nativePaused = false;
  syncZenAudio();
  syncBreath(true);
});
globalThis.window?.addEventListener?.('pagehide', save);
function vibrate(pattern) {
  if (!vibrationOn || !canVibrate) return false;
  try {
    if (nativeHaptics) return nativeHaptics.vibrate(JSON.stringify(Array.isArray(pattern) ? pattern : [pattern]));
    return navigator.vibrate(pattern) !== false;
  } catch { return false; }
}

async function animateSwap(a, b, valid) {
  if (reducedMotion()) return;
  const cells = boardElement.querySelectorAll('.cell');
  const first = cells[a]?.getBoundingClientRect();
  const second = cells[b]?.getBoundingClientRect();
  if (!first || !second) return;
  const dx = second.left - first.left, dy = second.top - first.top;
  const options = {duration: valid ? 225 : 300, easing: 'ease-in-out'};
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
      {duration: Math.min(470, 250 + Math.abs(distance / pitch) * 32), easing: 'cubic-bezier(.2, .78, .24, 1)', fill: 'both'}));
  }
  await waitAnimations(animations);
}

async function animateClear(frame) {
  if (reducedMotion()) return;
  const scale = effectScale();
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
  const spray = (x, y, type, count) => {
    for (let i = 0; i < count; i++) {
      const angle = Math.PI * 2 * i / count + .18;
      const radius = pitch * (type === 'spectrum' ? 2.2 : type === 'cross' ? 1.65 : 1.25);
      const dx = Math.cos(angle) * radius;
      const dy = Math.sin(angle) * radius;
      addOverlay(`effect-spark${type === 'cross' ? ' cool' : type === 'spectrum' ? ' rainbow' : ''}`,
        {left: `${x - 3}px`, top: `${y - 3}px`,
          ...(type === 'spectrum' ? {background: `hsl(${i * 360 / count} 100% 77%)`} : {})},
        [{transform: 'translate(0,0) scale(.35)', opacity: 0},
          {transform: `translate(${dx * .32}px,${dy * .32}px) scale(1.15)`, opacity: 1, offset: .25},
          {transform: `translate(${dx}px,${dy}px) scale(.35)`, opacity: 0}],
        {duration: 380 * scale, easing: 'cubic-bezier(.13,.65,.27,1)'});
    }
  };
  for (const effect of frame.activated.slice(0, 3)) {
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
      {duration: 360 * scale, easing: 'ease-out'});
    }
    if (effect.type === 'cross') {
      const left = boardRect.left - frameRect.left;
      const top = boardRect.top - frameRect.top;
      addOverlay('effect-beam', {left: `${left}px`, top: `${y - 4}px`,
        width: `${boardRect.width}px`, height: '8px'},
      [{transform: 'scaleX(0)', opacity: 0}, {transform: 'scaleX(1)', opacity: 1, offset: .45},
        {transform: 'scaleX(1)', opacity: 0}], {duration: 330 * scale, easing: 'ease-out'});
      addOverlay('effect-beam', {left: `${x - 4}px`, top: `${top}px`,
        width: '8px', height: `${boardRect.height}px`},
      [{transform: 'scaleY(0)', opacity: 0}, {transform: 'scaleY(1)', opacity: 1, offset: .45},
        {transform: 'scaleY(1)', opacity: 0}], {duration: 330 * scale, easing: 'ease-out'});
    }
    if (effect.type === 'spectrum')
      addOverlay('effect-glow', {}, [{opacity: 0}, {opacity: .9, offset: .35}, {opacity: 0}],
        {duration: 370 * scale, easing: 'ease-out'});
    spray(x, y, effect.type, zenSettings.effects === 'soft' && game.mode === 'zen' ? 5 :
      effect.type === 'spectrum' ? 12 : 8);
  }
  if (!frame.activated.length && frame.cells.length) {
    const rect = cells[frame.cells[Math.floor(frame.cells.length / 2)]]?.getBoundingClientRect();
    if (rect) spray(rect.left + rect.width / 2 - frameRect.left,
      rect.top + rect.height / 2 - frameRect.top, 'match', zenSettings.effects === 'soft' && game.mode === 'zen' ? 3 : 5);
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
        {transform: `scale(${zenSettings.effects === 'vivid' && game.mode === 'zen' ? 1.18 : 1.1})`, opacity: 1,
          filter: `brightness(${zenSettings.effects === 'soft' && game.mode === 'zen' ? 1.35 :
            zenSettings.effects === 'vivid' && game.mode === 'zen' ? 2.1 : 1.8})`, offset: .38},
        {transform: 'scale(.72)', opacity: 0, filter: 'brightness(1.5)'}],
      {duration: (frame.activated.length ? 340 : 270) * scale, delay,
        easing: 'ease-out', fill: 'both'}));
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
    ], {duration: 580 * effectScale(), easing: 'ease-out'})]);
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
    showScoreGain(result.earned);
    vibrate(result.levelsGained ? [28, 55, 35] : result.events.some(frame => frame.activated?.length) ? 45 : 28);
  } else playTone('invalid');
  try {
    await animateSwap(a, b, result.valid);
    if (!result.valid) return;
    for (const frame of result.events) {
      if (document.visibilityState === 'hidden') break;
      draw(frame.board, frame.type === 'clear' ? frame.cells : []);
      if (frame.type === 'clear') {
        playTone(cueForFrame(frame), frame.chain);
        combo.textContent = frame.activated.some(effect => effect.type === 'spectrum') ? 'Explosão de cores!' :
          frame.activated.length ? 'Reação em cadeia!' :
          frame.creations.length ? 'Nova pedra especial!' :
          frame.chain > 1 ? `Cascata ×${frame.chain}!` : 'Boa combinação!';
        await animateClear(frame);
        if (frame.creations.length) playTone('create');
      } else if (frame.type === 'fall') await animateFall(frame.falls);
      else if (frame.type === 'rescue') {
        combo.textContent = 'Um Espectro abriu uma nova jogada';
        playTone('rescue');
        if (!reducedMotion()) {
          const mover = boardElement.querySelectorAll('.cell')[frame.index]?.querySelector('.mover');
          if (mover) await waitAnimations([mover.animate([{transform: 'scale(.25)', opacity: 0},
            {transform: 'scale(1.16)', opacity: 1, offset: .65},
            {transform: 'scale(1)', opacity: 1}], {duration: 300, easing: 'ease-out'})]);
        }
      }
    }
    if (result.levelsGained) { playTone('level'); await animateLevel(); }
  } catch { /* Visual effects are optional; the committed board remains playable. */ }
  finally {
    effectLayer.replaceChildren();
    levelUp.hidden = true;
    draw();
    if (result.valid) {
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
  unlockAudio();
  zenAudio.armed = true;
  syncZenAudio();
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
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    unlockAudio();
    zenAudio.armed = true;
    syncZenAudio();
    handleIndex(index);
  }
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
  clearScoreGain();
  clearHint();
  selected = null;
  game.newGame();
  combo.textContent = 'Combine três ou mais';
  draw(); hud(); save();
});
$('#play-again').addEventListener('click', () => {
  if (busy) return;
  clearScoreGain();
  clearHint();
  selected = null;
  game.newGame();
  combo.textContent = 'Combine três ou mais';
  draw(); hud(); save();
});
document.querySelectorAll('.mode').forEach(button => button.addEventListener('click', () => {
  if (busy || game.mode === button.dataset.mode) return;
  clearScoreGain();
  clearHint();
  selected = null;
  save();
  try {
    const saved = JSON.parse(localStorage.getItem(sessionKey(button.dataset.mode)));
    if (!game.restore(saved)) game.newGame(button.dataset.mode);
  } catch { game.newGame(button.dataset.mode); }
  combo.textContent = game.ended ? 'Sem jogadas restantes' : 'Combine três ou mais';
  draw(); hud(); save();
  zenAudio.armed = true;
  syncZenUI(true);
}));
document.querySelectorAll('.visual-option').forEach(button => button.addEventListener('click', () => {
  if (button.dataset.visual === visualStyle) return;
  visualStyle = button.dataset.visual;
  syncVisualStyle();
  try { localStorage.setItem('prisma.visualStyle', visualStyle); } catch {}
}));
$('#zen-music').addEventListener('change', event => {
  zenSettings.music = event.target.checked;
  saveZenSettings();
  zenAudio.armed = true;
  syncZenAudio();
});
$('#zen-ambience').addEventListener('change', event => {
  zenSettings.ambience = event.target.checked;
  saveZenSettings();
  zenAudio.armed = true;
  syncZenAudio();
});
$('#zen-breath').addEventListener('change', event => {
  zenSettings.breath = normalizeZenSettings({breath: event.target.value}).breath;
  saveZenSettings();
  syncBreath(true);
});
$('#zen-effects').addEventListener('change', event => {
  zenSettings.effects = normalizeZenSettings({effects: event.target.value}).effects;
  saveZenSettings();
  boardFrame.dataset.effects = game.mode === 'zen' ? zenSettings.effects : 'normal';
});
for (const channel of ['effects', 'music', 'ambience']) {
  $('#volume-' + channel).addEventListener('input', event => {
    audioSettings[channel] = normalizeAudioSettings({[channel]: Number(event.target.value)})[channel];
    if (channel === 'effects') soundDesign.setVolume(audioSettings.effects);
    else zenAudio.setVolumes(audioSettings);
    saveAudioSettings();
    syncAudioSettingsUI();
    if (channel === 'effects') hud();
  });
}
$('#audio-test').addEventListener('click', async () => {
  if (audioSettings.effects === 0) { showToast('Aumente o volume dos efeitos'); return; }
  if (!await unlockAudio(true) || !soundDesign.play('match'))
    showToast('Verifique o som desta aba e do aparelho');
});
$('#sound').addEventListener('click', () => {
  if (soundOn && audioSettings.effects === 0) {
    audioSettings.effects = 80;
    soundDesign.setVolume(audioSettings.effects);
    saveAudioSettings();
    syncAudioSettingsUI();
  } else soundOn = !soundOn;
  try { localStorage.setItem('prisma.sound', soundOn ? 'on' : 'off'); } catch {}
  hud();
  if (soundOn) unlockAudio(true).then(ready => {
    if (ready) soundDesign.play('match');
    else showToast('Verifique o som desta aba e do aparelho');
  });
});
$('#vibration').addEventListener('click', () => {
  vibrationOn = !vibrationOn;
  try { localStorage.setItem('prisma.vibration', vibrationOn ? 'on' : 'off'); } catch {}
  hud();
  if (vibrationOn && !vibrate(55)) {
    vibrationOn = false;
    try { localStorage.setItem('prisma.vibration', 'off'); } catch {}
    hud();
    showToast('Vibração indisponível neste aparelho');
  }
});

draw(); hud(); syncAudioSettingsUI(); syncZenUI(true);
if (!new URLSearchParams(globalThis.location?.search ?? '').has('android') && 'serviceWorker' in navigator)
  navigator.serviceWorker.register('./sw.js').catch(() => {});
