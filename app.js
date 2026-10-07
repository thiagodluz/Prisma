import {Game, SIZE, levelGoal} from './engine.js?v=1.4.1';
import {ZenAudio, normalizeZenSettings, breathTiming} from './zen.js?v=1.4.1';
import {SoundDesign, normalizeAudioSettings, cueForFrame} from './sound.js?v=1.4.1';

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
const toast = $('#toast');
const gameOver = $('#game-over');
const levelUp = $('#level-up');
const developerMenu = $('#developer-menu');
const developerMenuTrigger = $('#developer-menu-trigger');
const undoLastMoveButton = $('#undo-last-move');
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
function restoreMode(mode) {
  try {
    const raw = localStorage.getItem(sessionKey(mode));
    if (!raw) { game.newGame(mode); return; }
    const saved = JSON.parse(raw);
    if ((saved?.mode === 'endless' ? 'classic' : saved?.mode) === mode && game.restore(saved)) return;
    try { localStorage.setItem(sessionKey(mode) + '.corrupt', raw); } catch {}
  } catch {
    // Keep the original bytes for diagnosis if JSON parsing failed.
    try {
      const raw = localStorage.getItem(sessionKey(mode));
      if (raw) localStorage.setItem(sessionKey(mode) + '.corrupt', raw);
    } catch {}
  }
  game.newGame(mode);
}
try {
  const legacy = JSON.parse(localStorage.getItem('prisma.session'));
  const legacyMode = legacy?.mode === 'endless' ? 'classic' : legacy?.mode;
  if (['zen', 'classic'].includes(legacyMode) && !localStorage.getItem(sessionKey(legacyMode))) {
    localStorage.setItem(sessionKey(legacyMode), JSON.stringify({...legacy, mode: legacyMode}));
    if (!localStorage.getItem('prisma.activeMode')) localStorage.setItem('prisma.activeMode', legacyMode);
  }
} catch { /* Storage can be denied; the game still starts. */ }
let activeMode = 'zen';
try {
  const active = localStorage.getItem('prisma.activeMode');
  if (['zen', 'classic'].includes(active)) activeMode = active;
} catch {}
restoreMode(activeMode);
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
const zenPlaybackErrors = new Map();
const zenAudio = new ZenAudio(getAudioContext, (channel, error) => {
  if (error) zenPlaybackErrors.set(channel, error);
  else zenPlaybackErrors.delete(channel);
  const status = $('#zen-audio-status');
  status.hidden = !zenPlaybackErrors.size;
  status.textContent = zenPlaybackErrors.size
    ? 'O áudio não começou. Toque novamente em Música ou Ambiente para tentar de novo.' : '';
});
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
    music: zenSettings.music, ambience: zenSettings.ambience,
    musicTrack: zenSettings.musicTrack, ambienceSound: zenSettings.ambienceSound});
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
  $('#zen-track').value = zenSettings.musicTrack;
  $('#zen-soundscape').value = zenSettings.ambienceSound;
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

const records = new Map();
let recordHistory = [];
function safeRecord(mode) {
  if (records.has(mode)) return records.get(mode);
  try {
    const saved = JSON.parse(localStorage.getItem('prisma.records.' + mode)) || {};
    const legacy = Number(localStorage.getItem('prisma.best.' + mode)) ||
      (mode === 'classic' ? Number(localStorage.getItem('prisma.best.endless')) : 0) || 0;
    const safe = value => Number.isSafeInteger(value) && value >= 0 ? value : 0;
    const record = {bestScore: Math.max(safe(saved.bestScore), safe(legacy)),
      bestLevel: Math.max(1, safe(saved.bestLevel)), bestMove: safe(saved.bestMove),
      finished: safe(saved.finished)};
    records.set(mode, record);
    return record;
  } catch {
    const record = {bestScore: 0, bestLevel: 1, bestMove: 0, finished: 0};
    records.set(mode, record);
    return record;
  }
}

function save() {
  try {
    localStorage.setItem(sessionKey(game.mode), JSON.stringify({
      mode: game.mode, score: game.score, board: game.board, ended: game.ended,
      progressionVersion: 4, level: game.level, levelStartScore: game.levelStartScore,
      progressionOffset: game.progressionOffset, cheatsUsed: game.cheatsUsed, noDefeat: game.noDefeat
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

let cells;
let focusedIndex = 0;
function draw(board = game.board, matched = []) {
  if (!cells) {
    cells = Array.from({length: SIZE * SIZE}, (_, index) => {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'cell';
      cell.dataset.index = String(index);
      cell.tabIndex = index === 0 ? 0 : -1;
      const mover = document.createElement('span');
      mover.className = 'mover';
      mover.append(document.createElement('span'));
      cell.append(mover);
      return cell;
    });
    boardElement.replaceChildren(...cells);
  }
  const hits = new Set(matched);
  board.forEach((row, r) => row.forEach((tile, c) => {
    const index = r * SIZE + c;
    const cell = cells[index];
    if (index === selected) cell.classList.add('selected');
    else cell.classList.remove('selected');
    if (hits.has(index)) cell.classList.add('matched');
    else cell.classList.remove('matched');
    const specialName = {burst: 'Pulso', cross: 'Raio', spectrum: 'Espectro'}[tile.type];
    cell.setAttribute('aria-label', `Linha ${r + 1}, coluna ${c + 1}: ${specialName ? `pedra ${specialName}${tile.color === null ? '' : ` ${names[tile.color]}`}` : names[tile.color]}`);
    cell.dataset.tileId = String(tile.id);
    const gem = cell.children[0].children[0];
    gem.className = `gem gem-${tile.color === null ? 'spectrum' : tile.color}${specialName ? ` special special-${tile.type}` : ''}`;
    if (specialName) gem.setAttribute('data-symbol', {burst: '✺', cross: '✦', spectrum: '✶'}[tile.type]);
    else gem.removeAttribute?.('data-symbol');
  }));
}

function commitRecords(moveEarned = 0, finishedGame = false) {
  const record = safeRecord(game.mode);
  if (game.cheatsUsed) return record;
  const previous = {...record};
  record.bestScore = Math.max(record.bestScore, game.score);
  record.bestLevel = Math.max(record.bestLevel, game.level);
  record.bestMove = Math.max(record.bestMove, moveEarned);
  if (finishedGame && game.mode === 'classic') record.finished++;
  if (Object.keys(record).some(key => record[key] !== previous[key])) {
    try {
      localStorage.setItem('prisma.records.' + game.mode, JSON.stringify(record));
      localStorage.setItem('prisma.best.' + game.mode, String(record.bestScore));
    } catch {}
  }
  return record;
}

function hud() {
  scoreElement.textContent = game.score.toLocaleString('pt-BR');
  const record = commitRecords();
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
  syncDeveloperMenu();
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
  const novas = frame.activated.filter(effect => effect.type === 'supernova');
  const novaColors = ['#ff5774', '#ffad48', '#ffe36b', '#69ef98', '#6deeff', '#6d9fff', '#d795ff'];
  const center = index => {
    const rect = cells[index]?.getBoundingClientRect();
    return rect && {x: rect.left + rect.width / 2 - frameRect.left,
      y: rect.top + rect.height / 2 - frameRect.top};
  };
  if (novas.length) {
    for (const nova of novas) {
      const target = center(nova.index);
      if (!target) continue;
      for (const index of nova.sources) {
        const source = center(index);
        if (!source) continue;
        const dx = target.x - source.x, dy = target.y - source.y;
        const angle = Math.atan2(dy, dx);
        if (index !== nova.index) addOverlay('effect-fusion', {
          left: `${source.x}px`, top: `${source.y - 2}px`,
          width: `${Math.hypot(dx, dy)}px`, height: '4px', '--nova-color': novaColors[nova.color]},
        [{transform: `rotate(${angle}rad) scaleX(0)`, opacity: 0},
          {transform: `rotate(${angle}rad) scaleX(1)`, opacity: 1, offset: .6},
          {transform: `rotate(${angle}rad) scaleX(1)`, opacity: .6}],
        {duration: 240 * scale, easing: 'ease-in'});
        const mover = cells[index]?.querySelector('.mover');
        if (mover) effects.push(mover.animate([
          {transform: 'scale(1)', filter: 'brightness(1)'},
          {transform: 'scale(1.16)', filter: 'brightness(1.8)', offset: .6},
          {transform: 'scale(.9)', filter: 'brightness(2)'}],
        {duration: 240 * scale, fill: 'both'}));
      }
    }
    try { await waitAnimations(effects); }
    finally { overlays.forEach(element => element.remove()); }
    effects.length = 0;
    overlays.length = 0;
    if (reducedMotion()) return;
  }
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
  for (const effect of [...novas, ...frame.activated.filter(effect => effect.type !== 'supernova').slice(0, 3)]) {
    const rect = cells[effect.index]?.getBoundingClientRect();
    if (!rect) continue;
    const x = rect.left + rect.width / 2 - frameRect.left;
    const y = rect.top + rect.height / 2 - frameRect.top;
    if (effect.type === 'supernova') {
      const size = pitch * 5;
      addOverlay('effect-supernova', {left: `${x - size / 2}px`, top: `${y - size / 2}px`,
        width: `${size}px`, height: `${size}px`, '--nova-color': novaColors[effect.color]},
      [{transform: 'scale(.08)', opacity: 0},
        {transform: 'scale(.35)', opacity: .9, offset: .18},
        {transform: 'scale(1)', opacity: .7, offset: .65},
        {transform: 'scale(1)', opacity: 0}],
      {duration: 480 * scale, easing: 'ease-out'});
    }
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

async function animateShuffle(board) {
  if (!reducedMotion()) await waitAnimations([boardElement.animate(
    [{opacity: 1}, {opacity: .12}], {duration: 190, easing: 'ease-in', fill: 'both'})]);
  draw(board);
  if (!reducedMotion()) await waitAnimations([boardElement.animate(
    [{opacity: .12}, {opacity: 1}], {duration: 250, easing: 'ease-out'})]);
}

async function attempt(a, b, cheat = false) {
  if (busy) return;
  selected = null;
  clearScoreGain();
  const stage = {score: game.score, level: game.level, levelStartScore: game.levelStartScore};
  const recordBeforeMove = {...safeRecord(game.mode)};
  const result = game.move(a, b);
  if (cheat && result.valid) game.cheatsUsed = true;
  return animateResult(result, stage, recordBeforeMove, {a, b});
}

function rememberRecord(record) {
  recordHistory.push({mode: game.mode, record});
  recordHistory = recordHistory.slice(-game.undoHistory.length);
}

async function animateResult(result, stage, recordBeforeMove, swap = null) {
  busy = true;
  syncDeveloperMenu();
  boardElement.classList.add('busy');
  if (result.valid) {
    // Keep score records reversible along with the game state for developer testing.
    rememberRecord(recordBeforeMove);
    // The engine has already committed all cascades; persist before any visual delay.
    save();
    commitRecords(result.earned, result.ended);
    vibrate(result.levelsGained ? [28, 55, 35] : result.events.some(frame => frame.activated?.length) ? 45 : 28);
  } else playTone('invalid');
  try {
    if (swap) await animateSwap(swap.a, swap.b, result.valid);
    if (!result.valid) return;
    for (const frame of result.events) {
      if (document.visibilityState === 'hidden') break;
      if (frame.type === 'shuffle') {
        await animateShuffle(frame.board);
        continue;
      }
      draw(frame.board, frame.type === 'clear' ? frame.cells : []);
      if (frame.type === 'clear') {
        if (frame.activated.some(effect => effect.type === 'supernova')) showToast('Supernova');
        playTone(cueForFrame(frame), frame.chain);
        await animateClear(frame);
        stage.score += frame.earned;
        while (stage.score - stage.levelStartScore >= levelGoal(stage.level)) {
          stage.levelStartScore += levelGoal(stage.level);
          stage.level++;
        }
        scoreElement.textContent = stage.score.toLocaleString('pt-BR');
        levelElement.textContent = String(stage.level);
        const progressPoints = stage.score - stage.levelStartScore;
        const goal = levelGoal(stage.level);
        progressFill.style.width = `${Math.min(100, progressPoints / goal * 100)}%`;
        progress.setAttribute('aria-valuenow', String(progressPoints));
        progress.setAttribute('aria-valuemax', String(goal));
        progressLabel.textContent = `${progressPoints.toLocaleString('pt-BR')} / ${goal.toLocaleString('pt-BR')} para o próximo nível`;
        showScoreGain(frame.earned);
        if (frame.creations.length) playTone('create');
      } else if (frame.type === 'fall') await animateFall(frame.falls);
      else if (frame.type === 'rescue') {
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
    boardElement.classList.remove('busy');
    busy = false;
    hud();
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
boardElement.addEventListener('focusin', event => {
  const cell = event.target.closest('.cell');
  if (!cell) return;
  cells[focusedIndex].tabIndex = -1;
  focusedIndex = Number(cell.dataset.index);
  cell.tabIndex = 0;
});
boardElement.addEventListener('keydown', event => {
  const target = event.target.closest('.cell');
  if (!target) return;
  const index = Number(target.dataset.index);
  const step = {ArrowLeft: -1, ArrowRight: 1, ArrowUp: -SIZE, ArrowDown: SIZE}[event.key];
  if (step && !busy) {
    event.preventDefault();
    const next = index + step;
    if (next >= 0 && next < SIZE * SIZE && (Math.abs(step) === SIZE ||
      Math.floor(index / SIZE) === Math.floor(next / SIZE))) {
      target.tabIndex = -1;
      cells[next].tabIndex = 0;
      focusedIndex = next;
      cells[next].focus();
    }
    return;
  }
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
  hintTimer = setTimeout(clearHint, 2600);
});
$('#shuffle').addEventListener('click', async () => {
  if (busy) return;
  clearHint();
  selected = null;
  if (!game.shuffle()) return;
  recordHistory = [];
  save();
  busy = true;
  syncDeveloperMenu();
  boardElement.classList.add('busy');
  try { await animateShuffle(game.board); }
  finally {
    draw();
    boardElement.classList.remove('busy');
    busy = false;
    hud();
  }
  showToast('Tabuleiro reorganizado');
});
function startNewGame() {
  if (busy) return;
  clearScoreGain();
  clearHint();
  selected = null;
  game.newGame();
  recordHistory = [];
  draw(); hud(); save();
}
const newGameDialog = $('#new-game-dialog');
function askNewGame() {
  if (!busy && !newGameDialog.open) newGameDialog.showModal();
}
$('#new-game').addEventListener('click', askNewGame);
$('#play-again').addEventListener('click', askNewGame);
$('#cancel-new-game').addEventListener('click', () => newGameDialog.close());
$('#confirm-new-game').addEventListener('click', () => {
  newGameDialog.close();
  startNewGame();
});
document.querySelectorAll('.mode').forEach(button => button.addEventListener('click', () => {
  if (busy || game.mode === button.dataset.mode) return;
  clearScoreGain();
  clearHint();
  selected = null;
  save();
  recordHistory = [];
  restoreMode(button.dataset.mode);
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
$('#zen-track').addEventListener('change', event => {
  zenSettings.musicTrack = normalizeZenSettings({musicTrack: event.target.value}).musicTrack;
  saveZenSettings();
  zenAudio.armed = true;
  syncZenAudio();
});
$('#zen-soundscape').addEventListener('change', event => {
  zenSettings.ambienceSound = normalizeZenSettings({ambienceSound: event.target.value}).ambienceSound;
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
    showToast('Confira o volume desta aba e do aparelho');
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
    else showToast('Confira o volume desta aba e do aparelho');
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

const developerControls = ['undo-last-move', 'cheat-points-100', 'cheat-points-1000',
  'cheat-add-points', 'cheat-points', 'cheat-next-level', 'cheat-set-level', 'cheat-level',
  'cheat-row', 'cheat-column', 'cheat-special', 'cheat-spawn', 'cheat-shuffle',
  'cheat-no-defeat', 'cheat-explode', 'cheat-supernova', 'cheat-auto-move'];
function syncDeveloperMenu() {
  for (const id of developerControls) $('#' + id).disabled = busy;
  undoLastMoveButton.disabled = busy || !game.canUndoLastMove();
  $('#cheat-no-defeat').checked = game.noDefeat;
  $('#developer-status').textContent = game.cheatsUsed ?
    'Partida com cheats: os recordes normais estão protegidos.' :
    'Partida normal. Usar um cheat desativa os recordes nesta partida.';
  $('#developer-history').textContent = `${game.undoHistory.length} de 50 ações disponíveis para desfazer`;
}
function developerPosition() {
  const row = Number($('#cheat-row').value), column = Number($('#cheat-column').value);
  return Number.isInteger(row) && row >= 1 && row <= SIZE &&
    Number.isInteger(column) && column >= 1 && column <= SIZE ? (row - 1) * SIZE + column - 1 : -1;
}
function developerEdit(action, message) {
  if (busy) return;
  const previousRecord = {...safeRecord(game.mode)};
  if (!action()) { showToast('Confira os valores ou tente outra ação'); syncDeveloperMenu(); return; }
  rememberRecord(previousRecord);
  selected = null;
  clearHint(); clearScoreGain(); effectLayer.replaceChildren();
  draw(); hud(); save();
  showToast(message);
}
async function developerCascade(action) {
  if (busy) return;
  const stage = {score: game.score, level: game.level, levelStartScore: game.levelStartScore};
  const previousRecord = {...safeRecord(game.mode)};
  const result = action();
  if (!result.valid) { showToast('Escolha uma linha e coluna de 1 a 8'); return; }
  selected = null;
  clearHint(); clearScoreGain();
  await animateResult(result, stage, previousRecord);
}
$('#cheat-points-100').addEventListener('click', () => developerEdit(() => game.cheatAddPoints(100), '+100 pontos'));
$('#cheat-points-1000').addEventListener('click', () => developerEdit(() => game.cheatAddPoints(1000), '+1.000 pontos'));
$('#cheat-add-points').addEventListener('click', () => developerEdit(
  () => game.cheatAddPoints(Number($('#cheat-points').value)), 'Pontos adicionados'));
$('#cheat-next-level').addEventListener('click', () => developerEdit(() => game.cheatSetLevel(game.level + 1), 'Nível avançado'));
$('#cheat-set-level').addEventListener('click', () => developerEdit(
  () => game.cheatSetLevel(Number($('#cheat-level').value)), 'Nível alterado'));
$('#cheat-spawn').addEventListener('click', () => developerEdit(
  () => game.cheatSpawnSpecial(developerPosition(), $('#cheat-special').value), 'Especial criado'));
$('#cheat-shuffle').addEventListener('click', () => developerEdit(() => game.cheatShuffle(), 'Tabuleiro reorganizado'));
$('#cheat-no-defeat').addEventListener('change', event => developerEdit(
  () => game.cheatNoDefeat(event.target.checked), 'Proteção contra derrota atualizada'));
$('#cheat-explode').addEventListener('click', () => developerCascade(() => game.cheatExplode()));
$('#cheat-supernova').addEventListener('click', () => developerCascade(() => game.cheatSupernova(developerPosition())));
$('#cheat-auto-move').addEventListener('click', () => {
  if (busy) return;
  const move = game.hint();
  if (!move) { showToast('Embaralhe ou ative a proteção contra derrota'); return; }
  clearHint();
  return attempt(move.a, move.b, true);
});
$('#developer-close').addEventListener('click', () => {
  developerMenu.hidden = true;
  developerMenuTrigger.setAttribute('aria-expanded', 'false');
});

let developerTapCount = 0;
let developerTapTimer;
developerMenuTrigger.addEventListener('click', () => {
  developerTapCount++;
  clearTimeout(developerTapTimer);
  if (developerTapCount >= 7) {
    developerMenu.hidden = false;
    developerMenuTrigger.setAttribute('aria-expanded', 'true');
    developerTapCount = 0;
    showToast('Ferramentas do desenvolvedor ativadas');
  } else developerTapTimer = setTimeout(() => { developerTapCount = 0; }, 2200);
});
undoLastMoveButton.addEventListener('click', () => {
  if (busy || !game.undoLastMove()) return;
  const recordSnapshot = recordHistory.pop();
  if (recordSnapshot?.mode === game.mode) {
    const previous = {...recordSnapshot.record};
    records.set(game.mode, previous);
    try {
      localStorage.setItem('prisma.records.' + game.mode, JSON.stringify(previous));
      localStorage.setItem('prisma.best.' + game.mode, String(previous.bestScore));
    } catch {}
  }
  selected = null;
  clearHint();
  clearScoreGain();
  effectLayer.replaceChildren();
  draw();
  hud();
  save();
  showToast('Última ação revertida');
});

draw(); hud(); syncAudioSettingsUI(); syncZenUI(true);
if (!new URLSearchParams(globalThis.location?.search ?? '').has('android') && 'serviceWorker' in navigator)
  navigator.serviceWorker.register('./sw.js', {updateViaCache: 'none'}).catch(() => {});
