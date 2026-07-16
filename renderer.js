// ---------------------------------------------------------------------------
// Turtle — three desktop pets that eat sounds and turn them into a beat.
//   GREEN  chops dropped samples into 16 slices and sequences them (as before).
//   BLUE   plays dropped samples back whole, in order, tempo-matched to the
//          shared BPM so they land on-beat with Green — no chopping.
//   RED    chops samples like Green, but replaces every slice with a
//          synthesized sub-bass hit — turns anything into bass.
// All three share one clock/tempo and mix together on playback and export.
// ---------------------------------------------------------------------------

const STEP_COUNT = 16;
const MAX_SOUNDS_PER_TURTLE = 6;

// ----- DOM refs -------------------------------------------------------------
const stageWrapGreen = document.getElementById('stageWrapGreen');
const stageWrapBlue = document.getElementById('stageWrapBlue');
const stageWrapRed = document.getElementById('stageWrapRed');

const dropHintGreen = document.getElementById('dropHintGreen');
const dropHintBlue = document.getElementById('dropHintBlue');
const dropHintRed = document.getElementById('dropHintRed');

const dropOverlayGreen = document.getElementById('dropOverlayGreen');
const dropOverlayBlue = document.getElementById('dropOverlayBlue');
const dropOverlayRed = document.getElementById('dropOverlayRed');

const winMinBtn = document.getElementById('winMin');
const winMaxBtn = document.getElementById('winMax');
const winCloseBtn = document.getElementById('winClose');

const stepsGreenEl = document.getElementById('stepsGreen');
const playlistBlueEl = document.getElementById('playlistBlue');
const barsBlueEl = document.getElementById('barsBlue');
const barsRedEl = document.getElementById('barsRed');

const playBtn = document.getElementById('playBtn');
const shuffleBtn = document.getElementById('shuffleBtn');
const exportBtn = document.getElementById('exportBtn');
const loopsInput = document.getElementById('loopsInput');
const tempoEl = document.getElementById('tempo');
const bpmLabel = document.getElementById('bpmLabel');
const statusEl = document.getElementById('status');

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

// ---------------------------------------------------------------------------
// Personalities — same drawing engine, different palette/shape/expression.
// ---------------------------------------------------------------------------
const PALETTES = {
  green: {
    body: '#4f9a71',
    ring: '#eef5ea',
    disc: '#1e3a24',
    face: '#8fd6a6',
    feature: '#1e3a24',
    glow: '143,214,166',
    mouthCurve: 1,
  },
  blue: {
    body: '#5b9fd6',
    ring: '#eef5ea',
    disc: '#1a3350',
    face: '#bfe3fb',
    feature: '#173049',
    glow: '150,205,240',
    mouthCurve: 1.8,
    cute: true,
  },
  red: {
    body: '#c65b4a',
    ring: '#f5d9c9',
    disc: '#3a1611',
    face: '#e5897a',
    feature: '#2a0f0c',
    glow: '224,120,100',
    mouthCurve: 1,
    angry: true,
  },
};

const NOTE_CHARS = ['♪', '♫', '♬'];
const MOUTH_SHAPES = ['O', 'A', 'E'];

function createTurtleRig(key, canvasEl, palette) {
  const ctx = canvasEl.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const LOW_RES = 90;
  const off = document.createElement('canvas');
  off.width = LOW_RES;
  off.height = LOW_RES;
  const octx = off.getContext('2d');

  return {
    key,
    canvas: canvasEl,
    ctx,
    off,
    octx,
    palette,
    state: {
      blink: 0,
      mouthOpen: 0,
      mouthShape: 'O',
      bob: 0,
      sway: 0,
      squash: 0,
      mode: 'idle', // idle | eating
      nextBlinkAt: performance.now() + 1500 + Math.random() * 2500,
      eating: null,
      mouthPulse: 0,
      singPulse: 0,
      notes: [],
      phaseOffset: Math.random() * Math.PI * 2,
    },
  };
}

const rigs = {
  green: createTurtleRig('green', document.getElementById('stageGreen'), PALETTES.green),
  blue: createTurtleRig('blue', document.getElementById('stageBlue'), PALETTES.blue),
  red: createTurtleRig('red', document.getElementById('stageRed'), PALETTES.red),
};

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function updateTurtle(rig, now, opts) {
  const state = rig.state;

  if (state.mode !== 'eating') {
    if (now >= state.nextBlinkAt) {
      state.blinking = true;
      state.blinkStart = now;
      state.nextBlinkAt = now + 2200 + Math.random() * 3200;
    }
    if (state.blinking) {
      const t = (now - state.blinkStart) / 220;
      if (t >= 1) {
        state.blinking = false;
        state.blink = 0;
      } else {
        state.blink = t < 0.5 ? easeInOut(t * 2) : 1 - easeInOut((t - 0.5) * 2);
      }
    }
  }

  const idleBob = Math.sin(now / 900 + state.phaseOffset) * 2.2;

  if (state.mode === 'eating' && state.eating) {
    const { start, chomps, chompDur } = state.eating;
    const elapsed = now - start;
    const totalDur = chomps * chompDur;
    if (elapsed >= totalDur) {
      state.mode = 'idle';
      state.eating = null;
      state.mouthOpen = 0;
      state.squash = 0;
    } else {
      const chompT = (elapsed % chompDur) / chompDur;
      state.mouthOpen = Math.sin(chompT * Math.PI);
      state.squash = Math.sin(chompT * Math.PI) * 3.5;
      state.bob = idleBob * 0.3;
    }
  } else {
    state.bob = idleBob;
    state.mouthPulse *= 0.82;
    state.singPulse *= 0.88;
    state.mouthOpen = Math.max(state.mouthPulse, 0.05 + Math.sin(now / 900 + state.phaseOffset) * 0.03);
    state.squash *= 0.85;

    const swayAmp = opts.playing ? 2.6 : 0.5;
    state.sway = Math.sin(now / 240 + state.phaseOffset) * swayAmp;
  }
}

function pickMouthShape(current) {
  let next = MOUTH_SHAPES[Math.floor(Math.random() * MOUTH_SHAPES.length)];
  if (next === current) {
    next = MOUTH_SHAPES[(MOUTH_SHAPES.indexOf(next) + 1) % MOUTH_SHAPES.length];
  }
  return next;
}

function triggerMouthPulse(rig, strength) {
  const state = rig.state;
  state.mouthPulse = Math.max(state.mouthPulse, strength);
  state.singPulse = 1;
  state.mouthShape = pickMouthShape(state.mouthShape);
  if (Math.random() < 0.45) spawnNote(rig);
}

function spawnNote(rig) {
  rig.state.notes.push({
    x: rig.canvas.width / 2 + (Math.random() - 0.5) * (rig.canvas.width * 0.25),
    y: rig.canvas.height * 0.56,
    vx: (Math.random() - 0.5) * 10,
    vy: -22 - Math.random() * 10,
    life: 0,
    maxLife: 900 + Math.random() * 300,
    char: NOTE_CHARS[Math.floor(Math.random() * NOTE_CHARS.length)],
    size: 10 + Math.random() * 5,
  });
}

function updateNotes(rig, dtMs) {
  const dt = dtMs / 1000;
  const notes = rig.state.notes;
  for (let i = notes.length - 1; i >= 0; i--) {
    const n = notes[i];
    n.life += dtMs;
    n.x += n.vx * dt;
    n.y += n.vy * dt;
    if (n.life >= n.maxLife) notes.splice(i, 1);
  }
}

function drawNotes(rig) {
  rig.state.notes.forEach((n) => {
    const alpha = Math.max(0, 1 - n.life / n.maxLife);
    rig.ctx.font = `${n.size}px sans-serif`;
    rig.ctx.fillStyle = `rgba(238, 245, 234, ${alpha})`;
    rig.ctx.fillText(n.char, n.x, n.y);
  });
}

function startEating(rig, count = 1) {
  rig.state.mode = 'eating';
  rig.state.eating = {
    start: performance.now(),
    chomps: Math.min(4 + count * 2, 12),
    chompDur: count > 1 ? 160 : 190,
  };
}

// ---------------------------------------------------------------------------
// Drawing — same engine for all three, differentiated by palette:
//   Green: original look. Blue: rounder face, bigger eyes, blush, big smile.
//   Red: angular face, narrower eyes, furrowed brows, jagged beak, shell spikes.
// ---------------------------------------------------------------------------
function drawTurtle(rig, now) {
  const { ctx, off, octx, canvas, state, palette } = rig;
  const LOW_RES = off.width;
  octx.clearRect(0, 0, LOW_RES, LOW_RES);

  const cx = LOW_RES / 2 + state.sway * 0.5;
  const cy = LOW_RES / 2 + state.bob * 0.4;
  const squashY = 1 - state.squash * 0.01;
  const squashX = 1 + state.squash * 0.01;

  octx.save();
  octx.translate(cx, cy);
  octx.scale(squashX, squashY);
  octx.translate(-cx, -cy);

  const bodyRX = LOW_RES * 0.46;
  const bodyRY = LOW_RES * 0.33;
  octx.fillStyle = palette.body;
  octx.beginPath();
  octx.ellipse(cx, cy, bodyRX, bodyRY, 0, 0, Math.PI * 2);
  octx.fill();

  if (palette.angry) {
    // snapping-turtle shell ridge along the top edge
    octx.fillStyle = palette.body;
    const spikeCount = 5;
    for (let i = 0; i < spikeCount; i++) {
      const t = (i + 0.5) / spikeCount;
      const angle = Math.PI + Math.PI * (1 - t);
      const px = cx + Math.cos(angle) * bodyRX * 0.85;
      const py = cy + Math.sin(angle) * bodyRY * 0.85;
      octx.beginPath();
      octx.moveTo(px - 3, py);
      octx.lineTo(px, py - 6);
      octx.lineTo(px + 3, py);
      octx.closePath();
      octx.fill();
    }
  }

  octx.strokeStyle = palette.ring;
  octx.lineWidth = 1.6;
  octx.setLineDash([2.4, 2.6]);
  octx.beginPath();
  octx.ellipse(cx, cy, bodyRX - 2.2, bodyRY - 2.2, 0, 0, Math.PI * 2);
  octx.stroke();
  octx.setLineDash([]);

  const discR = LOW_RES * 0.235;
  octx.fillStyle = palette.disc;
  octx.beginPath();
  octx.arc(cx, cy, discR, 0, Math.PI * 2);
  octx.fill();

  const faceR = LOW_RES * (palette.cute ? 0.125 : 0.115);
  octx.fillStyle = palette.face;
  if (palette.cute) {
    roundedBlob(octx, cx, cy, faceR, 10, 0.98);
  } else {
    roundedBlob(octx, cx, cy, faceR, 6, palette.angry ? 0.82 : 0.92);
  }
  octx.fill();

  const eyeScale = palette.cute ? 1.35 : palette.angry ? 0.85 : 1;
  const eyeOffsetX = faceR * 0.42;
  const eyeOffsetY = -faceR * 0.12;
  const eyeR = Math.max(0.6, faceR * 0.16 * eyeScale * (1 - state.blink * 0.85));
  octx.fillStyle = palette.feature;
  [-1, 1].forEach((side) => {
    octx.beginPath();
    if (state.blink > 0.7) {
      octx.fillRect(cx + side * eyeOffsetX - eyeR, cy + eyeOffsetY - 0.4, eyeR * 2, 0.9);
    } else {
      octx.arc(cx + side * eyeOffsetX, cy + eyeOffsetY, eyeR, 0, Math.PI * 2);
      octx.fill();
    }
  });

  if (palette.cute) {
    octx.fillStyle = 'rgba(255, 170, 180, 0.55)';
    [-1, 1].forEach((side) => {
      octx.beginPath();
      octx.ellipse(cx + side * faceR * 0.75, cy + faceR * 0.15, faceR * 0.22, faceR * 0.13, 0, 0, Math.PI * 2);
      octx.fill();
    });
  }

  octx.strokeStyle = palette.feature;
  octx.lineWidth = Math.max(0.6, faceR * 0.07);
  octx.lineCap = 'round';
  if (palette.angry) {
    const jitter = state.singPulse * 1.2;
    [-1, 1].forEach((side) => {
      const bx = cx + side * eyeOffsetX;
      const byOuter = cy + eyeOffsetY - faceR * 0.44;
      const byInner = cy + eyeOffsetY - faceR * 0.2 - jitter * 0.3;
      octx.beginPath();
      octx.moveTo(bx - side * eyeR * 1.3, byOuter);
      octx.lineTo(bx + side * eyeR * 0.2, byInner);
      octx.stroke();
    });
  } else {
    const browLift = state.singPulse * faceR * 0.16 + (palette.cute ? faceR * 0.08 : 0);
    [-1, 1].forEach((side) => {
      const bx = cx + side * eyeOffsetX;
      const by = cy + eyeOffsetY - faceR * 0.34 - browLift;
      octx.beginPath();
      octx.moveTo(bx - eyeR * 1.3, by + faceR * 0.05);
      octx.quadraticCurveTo(bx, by - faceR * 0.06, bx + eyeR * 1.3, by + faceR * 0.05);
      octx.stroke();
    });
  }

  const mouthShape = state.mode === 'eating' ? 'O' : state.mouthShape;
  drawMouth(octx, cx, cy + faceR * 0.48, faceR, state.mouthOpen, mouthShape, palette);

  octx.restore();

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (state.singPulse > 0.02) {
    const glowR = canvas.width * 0.5;
    const gradient = ctx.createRadialGradient(
      canvas.width / 2, canvas.height / 2, glowR * 0.2,
      canvas.width / 2, canvas.height / 2, glowR
    );
    const a = state.singPulse * 0.35;
    gradient.addColorStop(0, `rgba(${palette.glow}, ${a})`);
    gradient.addColorStop(1, `rgba(${palette.glow}, 0)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  ctx.drawImage(off, 0, 0, canvas.width, canvas.height);
  drawNotes(rig);
}

function roundedBlob(c, cx, cy, r, sides, altRatio) {
  c.beginPath();
  for (let i = 0; i < sides; i++) {
    const angle = (Math.PI * 2 * i) / sides - Math.PI / 2;
    const rr = r * (i % 2 === 0 ? 1 : altRatio);
    const x = cx + Math.cos(angle) * rr;
    const y = cy + Math.sin(angle) * rr;
    if (i === 0) c.moveTo(x, y);
    else c.lineTo(x, y);
  }
  c.closePath();
}

function drawMouth(c, x, y, faceR, open, shape, palette) {
  const wBase = faceR * 0.62;
  c.fillStyle = palette.feature;
  c.strokeStyle = palette.feature;

  if (open < 0.08) {
    c.lineWidth = Math.max(0.7, faceR * 0.09);
    c.lineCap = 'round';

    if (palette.angry) {
      // jagged snapping-turtle beak line
      const segments = 5;
      c.beginPath();
      c.moveTo(x - wBase * 0.6, y);
      for (let i = 1; i <= segments; i++) {
        const t = i / segments;
        const zx = x - wBase * 0.6 + t * wBase * 1.2;
        const zy = y + (i % 2 === 0 ? faceR * 0.1 : -faceR * 0.02);
        c.lineTo(zx, zy);
      }
      c.stroke();
      return;
    }

    const curveDepth = faceR * 0.14 * (palette.mouthCurve || 1);
    c.beginPath();
    c.moveTo(x - wBase * 0.55, y);
    c.quadraticCurveTo(x, y + curveDepth, x + wBase * 0.55, y);
    c.stroke();
    return;
  }

  let wScale = 1;
  let hScale = 1;
  let yOffset = 0.25;
  if (shape === 'A') {
    wScale = 0.8;
    hScale = 1.25;
  } else if (shape === 'E') {
    wScale = 1.25;
    hScale = 0.55;
    yOffset = 0.1;
  }

  const w = wBase * wScale;
  const h = faceR * 0.55 * open * hScale;
  c.beginPath();
  c.ellipse(x, y + h * yOffset, w * 0.5, h * 0.5 + 0.6, 0, 0, Math.PI * 2);
  c.fill();
}

// ---------------------------------------------------------------------------
// Main animation loop
// ---------------------------------------------------------------------------
let lastFrameTime = performance.now();

function isEngineActive(key) {
  if (key === 'green') return playing && greenLayers.length > 0;
  if (key === 'red') return playing && redLayers.length > 0;
  if (key === 'blue') return playing && blueQueue.length > 0;
  return false;
}

function loop(now) {
  const dt = now - lastFrameTime;
  lastFrameTime = now;

  Object.keys(rigs).forEach((key) => {
    const rig = rigs[key];
    updateTurtle(rig, now, { playing: isEngineActive(key) });
    updateNotes(rig, dt);
  });

  checkScheduledVisuals();

  Object.keys(rigs).forEach((key) => drawTurtle(rigs[key], now));

  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// ---------------------------------------------------------------------------
// Window is moved via the custom titlebar's drag region (see style.css) —
// a frameless-but-resizable window gets no OS-drawn titlebar, so the
// minimize/maximize/close buttons up there call back into main.js over IPC.
// Right-click anywhere still opens the small context menu.
// ---------------------------------------------------------------------------
window.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  window.turtleAPI.showContextMenu();
});

winMinBtn.addEventListener('click', () => window.turtleAPI.minimizeWindow());
winMaxBtn.addEventListener('click', () => window.turtleAPI.toggleMaximizeWindow());
winCloseBtn.addEventListener('click', () => window.turtleAPI.closeWindow());

// ---------------------------------------------------------------------------
// Shared audio engine — one clock, one tempo, three instruments mixing in.
// ---------------------------------------------------------------------------
let audioCtx = null;
let sharedNoiseBuffer = null;

let greenLayers = []; // { id, name, buffer, sliceDuration, pattern, energy }
let greenIdCounter = 0;

let redLayers = []; // { id, name, sliceDuration, pattern, slicePitches: [{freq, energy}] }
let redIdCounter = 0;

let blueQueue = []; // { id, name, buffer, bpm }
let blueIdCounter = 0;
let blueCurrentIndex = 0;
let blueActiveSource = null;

let playing = false;
let bpm = 120;
let currentStep = 0;
let nextStepTime = 0;
const scheduleAheadTime = 0.12;
const lookaheadMs = 25;
let schedulerTimer = null;
let visualQueue = []; // { time, active, stepIdx, turtle }

function getAudioCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

function getNoiseBuffer() {
  if (!sharedNoiseBuffer) {
    const ctxAudio = getAudioCtx();
    const len = Math.floor(ctxAudio.sampleRate * 0.05);
    sharedNoiseBuffer = ctxAudio.createBuffer(1, len, ctxAudio.sampleRate);
    const data = sharedNoiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  }
  return sharedNoiseBuffer;
}

function stepInterval() {
  return 60 / bpm / 4; // 16th notes
}

function nextBarBoundaryTime() {
  if (currentStep === 0) return nextStepTime;
  return nextStepTime + (STEP_COUNT - currentStep) * stepInterval();
}

// Green: plays a raw slice of a decoded buffer with a short fade envelope.
// Shared between live playback and offline export.
function scheduleSlicePlayback(ctxOrOffline, buffer, time, offset, duration) {
  const src = ctxOrOffline.createBufferSource();
  src.buffer = buffer;

  const gain = ctxOrOffline.createGain();
  const fade = Math.min(0.006, duration * 0.2);
  gain.gain.setValueAtTime(0, time);
  gain.gain.linearRampToValueAtTime(1, time + fade);
  gain.gain.setValueAtTime(1, Math.max(time, time + duration - fade));
  gain.gain.linearRampToValueAtTime(0, time + duration);

  src.connect(gain).connect(ctxOrOffline.destination);
  src.start(time, offset, duration);
}

// Red: synthesizes an 808-style sub-bass hit (pitch-drop sine + short
// filtered click) instead of playing the original slice back.
function scheduleBassHit(ctxOrOffline, time, freq, energy, sliceDuration) {
  const peak = clamp(energy * 3, 0.25, 0.95);
  const decay = clamp(sliceDuration * 0.9, 0.12, 0.45);

  const osc = ctxOrOffline.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq * 1.7, time);
  osc.frequency.exponentialRampToValueAtTime(freq, time + 0.035);

  const gain = ctxOrOffline.createGain();
  gain.gain.setValueAtTime(0, time);
  gain.gain.linearRampToValueAtTime(peak, time + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.001, time + decay);

  osc.connect(gain).connect(ctxOrOffline.destination);
  osc.start(time);
  osc.stop(time + decay + 0.05);

  const noiseBuf = getNoiseBuffer();
  const click = ctxOrOffline.createBufferSource();
  click.buffer = noiseBuf;
  const clickFilter = ctxOrOffline.createBiquadFilter();
  clickFilter.type = 'bandpass';
  clickFilter.frequency.value = Math.max(200, freq * 4);
  clickFilter.Q.value = 0.8;
  const clickGain = ctxOrOffline.createGain();
  clickGain.gain.setValueAtTime(peak * 0.35, time);
  clickGain.gain.exponentialRampToValueAtTime(0.001, time + 0.02);
  click.connect(clickFilter).connect(clickGain).connect(ctxOrOffline.destination);
  click.start(time);
  click.stop(time + 0.03);
}

function scheduler() {
  const ctxAudio = getAudioCtx();
  while (nextStepTime < ctxAudio.currentTime + scheduleAheadTime) {
    scheduleStep(currentStep, nextStepTime);
    nextStepTime += stepInterval();
    currentStep = (currentStep + 1) % STEP_COUNT;
  }
}

function scheduleStep(stepIdx, time) {
  const ctxAudio = getAudioCtx();

  let greenActive = false;
  greenLayers.forEach((layer) => {
    if (!layer.pattern[stepIdx]) return;
    greenActive = true;
    scheduleSlicePlayback(ctxAudio, layer.buffer, time, stepIdx * layer.sliceDuration, layer.sliceDuration);
  });
  visualQueue.push({ time, active: greenActive, stepIdx, turtle: 'green' });

  let redActive = false;
  redLayers.forEach((layer) => {
    if (!layer.pattern[stepIdx]) return;
    redActive = true;
    const p = layer.slicePitches[stepIdx];
    scheduleBassHit(ctxAudio, time, p.freq, p.energy, layer.sliceDuration);
  });
  visualQueue.push({ time, active: redActive, stepIdx, turtle: 'red' });

  // Blue isn't step-sequenced, but since its playback rate is tempo-matched
  // to the shared BPM, its perceived beat lands exactly on quarter notes —
  // pulse its mouth on those without scheduling any audio here.
  if (stepIdx % 4 === 0) {
    visualQueue.push({ time, active: !!blueActiveSource, stepIdx, turtle: 'blue' });
  }
}

function checkScheduledVisuals() {
  if (!audioCtx) return;
  while (visualQueue.length && visualQueue[0].time <= audioCtx.currentTime) {
    const evt = visualQueue.shift();
    if (evt.turtle === 'green') highlightStep(stepsGreenEl, evt.stepIdx);
    else if (evt.turtle === 'red') highlightStep(barsRedEl, evt.stepIdx);
    if (evt.active) triggerMouthPulse(rigs[evt.turtle], evt.turtle === 'blue' ? 0.7 : 0.85);
  }
}

function highlightStep(containerEl, idx) {
  containerEl.querySelectorAll('.step').forEach((el) => {
    el.classList.toggle('playhead', Number(el.dataset.step) === idx);
  });
}

// Blue: plays each track whole and uncut, but a 16-segment mute pattern
// (like Green/Red's step toggles, just applied as gain automation instead
// of re-slicing audio) lets you silence pieces of it without touching the
// underlying buffer. Shared between live playback and offline export so
// both hear the same mute pattern.
function scheduleBlueBuffer(ctxOrOffline, track, time, rate) {
  const src = ctxOrOffline.createBufferSource();
  src.buffer = track.buffer;
  src.playbackRate.value = rate;

  const baseGain = 0.85;
  const playDur = track.buffer.duration / rate;
  const segDur = playDur / STEP_COUNT;
  const mute = track.mute && track.mute.length === STEP_COUNT ? track.mute : new Array(STEP_COUNT).fill(true);
  const fade = Math.min(0.008, segDur * 0.25);

  const gain = ctxOrOffline.createGain();
  gain.gain.setValueAtTime(mute[0] ? baseGain : 0, time);
  for (let i = 1; i < STEP_COUNT; i++) {
    if (mute[i] === mute[i - 1]) continue; // value already holds, no new event needed
    const segStart = time + i * segDur;
    const rampStart = Math.max(time, segStart - fade / 2);
    gain.gain.setValueAtTime(mute[i - 1] ? baseGain : 0, rampStart);
    gain.gain.linearRampToValueAtTime(mute[i] ? baseGain : 0, segStart + fade / 2);
  }

  src.connect(gain).connect(ctxOrOffline.destination);
  return { src, gain, playDur };
}

// Chains full-length tracks back to back via onended, each one quantized to
// start on the next bar boundary of the shared clock, at a playbackRate
// that fits its detected tempo to the shared BPM.
function scheduleBlueTrack(index) {
  if (!blueQueue.length || !playing) return;
  const idx = ((index % blueQueue.length) + blueQueue.length) % blueQueue.length;
  const track = blueQueue[idx];
  blueCurrentIndex = idx;

  const ctxAudio = getAudioCtx();
  const startTime = Math.max(nextBarBoundaryTime(), ctxAudio.currentTime + 0.02);
  const rate = track.bpm ? clamp(bpm / track.bpm, 0.5, 2) : 1;

  const { src } = scheduleBlueBuffer(ctxAudio, track, startTime, rate);

  src.onended = () => {
    if (blueActiveSource === src) blueActiveSource = null;
    if (playing) scheduleBlueTrack(idx + 1);
  };

  src.start(startTime);
  blueActiveSource = src;
}

function startPlayback() {
  if (!greenLayers.length && !redLayers.length && !blueQueue.length) return;
  const ctxAudio = getAudioCtx();
  if (ctxAudio.state === 'suspended') ctxAudio.resume();
  playing = true;
  currentStep = 0;
  nextStepTime = ctxAudio.currentTime + 0.05;
  visualQueue = [];
  schedulerTimer = setInterval(scheduler, lookaheadMs);
  if (blueQueue.length) scheduleBlueTrack(blueCurrentIndex);
  playBtn.textContent = '■';
  playBtn.classList.add('active');
}

function stopPlayback() {
  playing = false;
  if (schedulerTimer) clearInterval(schedulerTimer);
  schedulerTimer = null;
  visualQueue = [];
  if (blueActiveSource) {
    blueActiveSource.onended = null;
    try {
      blueActiveSource.stop();
    } catch (err) {
      // already stopped — fine
    }
    blueActiveSource = null;
  }
  playBtn.textContent = '▶';
  playBtn.classList.remove('active');
  highlightStep(stepsGreenEl, -1);
  highlightStep(barsRedEl, -1);
}

playBtn.addEventListener('click', () => {
  if (playing) stopPlayback();
  else startPlayback();
});

tempoEl.addEventListener('input', () => {
  bpm = parseInt(tempoEl.value, 10);
  bpmLabel.textContent = `${bpm} BPM`;
});

shuffleBtn.addEventListener('click', () => {
  let did = false;
  if (greenLayers.length) {
    greenLayers.forEach((layer) => {
      layer.pattern = generatePattern(layer.energy, true);
    });
    renderGreenGrid();
    did = true;
  }
  if (redLayers.length) {
    redLayers.forEach((layer) => {
      layer.pattern = generatePattern(layer.slicePitches.map((p) => p.energy), true);
    });
    renderRedBars();
    did = true;
  }
  statusEl.textContent = did
    ? "shuffled Green & Red's patterns"
    : 'nothing to shuffle yet — Blue just plays samples in order';
});

// ---------------------------------------------------------------------------
// Green's pads — one block per dropped sound, arranged as a 4x4 MIDI-pad
// grid (still the same 16-step pattern underneath, just laid out square
// instead of in a single row, since Green leans more drum-machine).
// ---------------------------------------------------------------------------
function renderGreenGrid() {
  stepsGreenEl.innerHTML = '';
  if (!greenLayers.length) {
    const msg = document.createElement('div');
    msg.className = 'emptyMsg';
    msg.textContent = 'drop a sound on Green above to get pads here';
    stepsGreenEl.appendChild(msg);
    return;
  }
  greenLayers.forEach((layer) => stepsGreenEl.appendChild(buildPadBlock(layer)));
}

function buildPadBlock(layer) {
  const block = document.createElement('div');
  block.className = 'padBlock';

  const labelRow = document.createElement('div');
  labelRow.className = 'padBlockLabel';

  const name = document.createElement('span');
  name.className = 'padName';
  name.textContent = layer.name;
  name.title = layer.name;
  labelRow.appendChild(name);

  const removeBtn = document.createElement('button');
  removeBtn.className = 'padRemove';
  removeBtn.type = 'button';
  removeBtn.textContent = '✕';
  removeBtn.title = `Remove ${layer.name} from Green`;
  removeBtn.addEventListener('click', () => {
    greenLayers = greenLayers.filter((l) => l.id !== layer.id);
    renderGreenGrid();
  });
  labelRow.appendChild(removeBtn);
  block.appendChild(labelRow);

  const grid = document.createElement('div');
  grid.className = 'padGrid';
  for (let i = 0; i < STEP_COUNT; i++) {
    const cell = document.createElement('div');
    cell.className = 'step' + (layer.pattern[i] ? ' on' : '');
    cell.dataset.step = i;
    cell.addEventListener('click', () => {
      layer.pattern[i] = !layer.pattern[i];
      cell.classList.toggle('on', layer.pattern[i]);
    });
    grid.appendChild(cell);
  }
  block.appendChild(grid);

  return block;
}

// ---------------------------------------------------------------------------
// Blue + Red's segmented bars — one horizontal 16-segment bar per dropped
// sound. Clicking a segment mutes/unmutes that piece. Red's segments are
// literally its existing slice on/off pattern (same data, new look); Blue's
// segments mute pieces of an otherwise whole, uncut sample via the gain
// automation in scheduleBlueBuffer().
// ---------------------------------------------------------------------------
function buildSegBarRow(name, segStates, onRemove) {
  const row = document.createElement('div');
  row.className = 'segTrackRow';

  const meta = document.createElement('div');
  meta.className = 'segTrackMeta';

  const nameEl = document.createElement('span');
  nameEl.className = 'segName';
  nameEl.textContent = name;
  nameEl.title = name;
  meta.appendChild(nameEl);

  if (onRemove) {
    const removeBtn = document.createElement('button');
    removeBtn.className = 'segRemove';
    removeBtn.type = 'button';
    removeBtn.textContent = 'remove';
    removeBtn.addEventListener('click', onRemove);
    meta.appendChild(removeBtn);
  }
  row.appendChild(meta);

  const bar = document.createElement('div');
  bar.className = 'segBar';
  for (let i = 0; i < STEP_COUNT; i++) {
    const cell = document.createElement('div');
    cell.className = 'step seg ' + (segStates[i] ? 'on' : 'off');
    cell.dataset.step = i;
    cell.addEventListener('click', () => {
      segStates[i] = !segStates[i];
      cell.classList.toggle('on', segStates[i]);
      cell.classList.toggle('off', !segStates[i]);
    });
    bar.appendChild(cell);
  }
  row.appendChild(bar);

  return row;
}

function renderRedBars() {
  barsRedEl.innerHTML = '';
  if (!redLayers.length) {
    const msg = document.createElement('div');
    msg.className = 'emptyMsg';
    msg.textContent = 'drop a sound on Red above to get a bar here';
    barsRedEl.appendChild(msg);
    return;
  }
  redLayers.forEach((layer) => {
    barsRedEl.appendChild(
      buildSegBarRow(layer.name, layer.pattern, () => {
        redLayers = redLayers.filter((l) => l.id !== layer.id);
        renderRedBars();
      })
    );
  });
}

function renderBlueBars() {
  barsBlueEl.innerHTML = '';
  if (!blueQueue.length) return;
  blueQueue.forEach((track) => {
    barsBlueEl.appendChild(buildSegBarRow(track.name, track.mute));
  });
}

function renderBluePlaylist() {
  playlistBlueEl.innerHTML = '';
  if (!blueQueue.length) {
    const empty = document.createElement('div');
    empty.className = 'playlistEmpty';
    empty.textContent = 'no samples queued yet';
    playlistBlueEl.appendChild(empty);
    return;
  }

  blueQueue.forEach((track, idx) => {
    const item = document.createElement('div');
    item.className = 'playlistItem';

    const order = document.createElement('span');
    order.className = 'order';
    order.textContent = `${idx + 1}.`;
    item.appendChild(order);

    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = track.name;
    name.title = track.name;
    item.appendChild(name);

    const badge = document.createElement('span');
    badge.className = 'bpmBadge';
    badge.textContent = track.bpm ? `${track.bpm} BPM` : '—';
    item.appendChild(badge);

    const removeBtn = document.createElement('button');
    removeBtn.className = 'removeBtn';
    removeBtn.type = 'button';
    removeBtn.textContent = '✕';
    removeBtn.title = 'Remove from playlist';
    removeBtn.addEventListener('click', () => {
      blueQueue = blueQueue.filter((t) => t.id !== track.id);
      renderBluePlaylist();
      renderBlueBars();
    });
    item.appendChild(removeBtn);

    playlistBlueEl.appendChild(item);
  });
}

renderGreenGrid();
renderRedBars();
renderBluePlaylist();
renderBlueBars();

// ---------------------------------------------------------------------------
// Slicing + auto pattern generation (Green + Red both chop into 16 slices)
// ---------------------------------------------------------------------------
function computeSliceEnergy(buffer) {
  const data = buffer.getChannelData(0);
  const samplesPerSlice = Math.floor(data.length / STEP_COUNT);
  const energies = [];
  for (let i = 0; i < STEP_COUNT; i++) {
    const start = i * samplesPerSlice;
    const end = i === STEP_COUNT - 1 ? data.length : start + samplesPerSlice;
    let sum = 0;
    for (let s = start; s < end; s++) sum += data[s] * data[s];
    energies.push(Math.sqrt(sum / Math.max(1, end - start)));
  }
  return energies;
}

function generatePattern(energies, randomize) {
  const withNoise = energies.map((e, i) => ({
    i,
    score: e + (randomize ? Math.random() * (Math.max(...energies) || 1) * 0.6 : 0),
  }));
  withNoise.sort((a, b) => b.score - a.score);

  const density = 6 + Math.floor(Math.random() * 5);
  const chosen = new Set(withNoise.slice(0, density).map((e) => e.i));
  chosen.add(0);

  const result = new Array(STEP_COUNT).fill(false);
  chosen.forEach((idx) => (result[idx] = true));
  return result;
}

// ---------------------------------------------------------------------------
// Red's per-slice pitch analysis — lightweight autocorrelation pitch
// detector, folded down into sub-bass range (~40-100Hz). Falls back to a
// default bass note for noisy/percussive/silent slices so everything still
// produces a solid thump.
// ---------------------------------------------------------------------------
function detectPitch(data, sampleRate) {
  const minFreq = 50;
  const maxFreq = 1000;
  const maxLag = Math.floor(sampleRate / minFreq);
  const minLag = Math.max(2, Math.floor(sampleRate / maxFreq));
  const n = Math.min(data.length, 4096);
  if (n < minLag * 2 || maxLag >= n) return null;

  let energy = 0;
  for (let i = 0; i < n; i++) energy += data[i] * data[i];
  const rms = Math.sqrt(energy / n);
  if (rms < 0.01) return null;

  // Properly energy-normalized cross-correlation at each lag (NOT just
  // divided by sample count — that length-bias is what caused octave/
  // harmonic confusion on clean tones during testing).
  const corrs = new Float32Array(maxLag + 2);
  for (let lag = minLag; lag <= maxLag; lag++) {
    let cross = 0;
    let e1 = 0;
    let e2 = 0;
    for (let i = 0; i < n - lag; i++) {
      cross += data[i] * data[i + lag];
      e1 += data[i] * data[i];
      e2 += data[i + lag] * data[i + lag];
    }
    corrs[lag] = cross / (Math.sqrt(e1 * e2) || 1);
  }

  // Walk from the shortest lag and take the first STRICT local maximum
  // with strong positive correlation. Requiring a strict local max rules
  // out points still on the trivial near-zero-lag decay slope; requiring
  // a high positive value rules out the half-period anti-phase trough
  // periodic signals pass through on the way to the true fundamental.
  const CONFIDENCE = 0.7;
  for (let lag = minLag + 1; lag < maxLag; lag++) {
    if (corrs[lag] >= CONFIDENCE && corrs[lag] > corrs[lag - 1] && corrs[lag] >= corrs[lag + 1]) {
      return sampleRate / lag;
    }
  }
  return null;
}

function foldToBassRange(freq) {
  let f = freq;
  while (f > 100) f /= 2;
  while (f < 40) f *= 2;
  return f;
}

function analyzeSlicesForBass(buffer) {
  const data = buffer.getChannelData(0);
  const samplesPerSlice = Math.floor(data.length / STEP_COUNT);
  const energies = computeSliceEnergy(buffer);
  const pitches = [];
  for (let i = 0; i < STEP_COUNT; i++) {
    const start = i * samplesPerSlice;
    const end = i === STEP_COUNT - 1 ? data.length : start + samplesPerSlice;
    const slice = data.subarray(start, end);
    const freq = detectPitch(slice, buffer.sampleRate);
    pitches.push({
      freq: foldToBassRange(freq || 55), // fallback: A1, so silence/noise still thumps
      energy: energies[i],
    });
  }
  return pitches;
}

// ---------------------------------------------------------------------------
// Blue's BPM detector — onset-detection + median inter-onset-interval. Not
// studio-grade, just a "best guess" so playback can tempo-match to the
// shared BPM via playbackRate. (An earlier autocorrelation version was
// tested and turned out to reliably lock onto half the true tempo — a
// steady pulse train autocorrelates almost as strongly at 2x its real
// period. Picking actual onset peaks and taking the median gap between
// them sidesteps that ambiguity and tested accurately across 60-200 BPM.)
// ---------------------------------------------------------------------------
function detectBpm(buffer) {
  const data = buffer.getChannelData(0);
  const sr = buffer.sampleRate;
  const hop = Math.floor(sr * 0.01); // ~10ms windows
  const numWindows = Math.floor(data.length / hop);
  if (numWindows < 20) return null;

  const envelope = new Float32Array(numWindows);
  for (let w = 0; w < numWindows; w++) {
    let sum = 0;
    const start = w * hop;
    const end = Math.min(data.length, start + hop);
    for (let i = start; i < end; i++) sum += Math.abs(data[i]);
    envelope[w] = sum / (end - start);
  }

  const flux = new Float32Array(numWindows);
  for (let w = 1; w < numWindows; w++) {
    const d = envelope[w] - envelope[w - 1];
    flux[w] = d > 0 ? d : 0;
  }

  const maxFlux = Math.max(...flux);
  if (maxFlux <= 0) return null;

  const threshold = maxFlux * 0.25;
  const minSpacingWindows = 5; // ~50ms — avoid double-counting one hit's rise
  const peaks = [];
  let lastPeak = -Infinity;
  for (let i = 1; i < numWindows - 1; i++) {
    if (flux[i] >= threshold && flux[i] > flux[i - 1] && flux[i] >= flux[i + 1] && i - lastPeak >= minSpacingWindows) {
      peaks.push(i);
      lastPeak = i;
    }
  }
  if (peaks.length < 4) return null; // too few onsets to trust an estimate

  const iois = [];
  for (let i = 1; i < peaks.length; i++) iois.push((peaks[i] - peaks[i - 1]) * 0.01);
  iois.sort((a, b) => a - b);
  const median = iois[Math.floor(iois.length / 2)];
  if (median <= 0) return null;

  let bpm = 60 / median;
  while (bpm < 60) bpm *= 2; // fold into a musically useful 60-200 range
  while (bpm > 200) bpm /= 2;
  return Math.round(bpm);
}

// ---------------------------------------------------------------------------
// Drag & drop — each turtle is its own drop zone feeding its own engine.
// ---------------------------------------------------------------------------
function isAudioFile(file) {
  return file.type.startsWith('audio/') || /\.(wav|mp3|ogg|flac|aiff|m4a)$/i.test(file.name);
}

function setupDropZone(wrapEl, hintEl, overlayEl, defaultHintText, onDrop) {
  let counter = 0;

  wrapEl.addEventListener('dragenter', (e) => {
    e.preventDefault();
    counter++;
    overlayEl.classList.add('active');
    hintEl.textContent = 'drop it!';
  });

  wrapEl.addEventListener('dragover', (e) => e.preventDefault());

  wrapEl.addEventListener('dragleave', (e) => {
    e.preventDefault();
    counter = Math.max(0, counter - 1);
    if (counter === 0) {
      overlayEl.classList.remove('active');
      hintEl.textContent = defaultHintText;
    }
  });

  wrapEl.addEventListener('drop', async (e) => {
    e.preventDefault();
    counter = 0;
    overlayEl.classList.remove('active');

    const incoming = e.dataTransfer.files ? Array.from(e.dataTransfer.files) : [];
    const audioFiles = incoming.filter(isAudioFile);

    if (!audioFiles.length) {
      if (incoming.length) statusEl.textContent = "that doesn't look like audio";
      return;
    }

    hintEl.classList.add('hidden');
    await onDrop(audioFiles);
    hintEl.classList.remove('hidden');
    hintEl.textContent = defaultHintText;
  });
}

async function handleGreenDrop(audioFiles) {
  const room = MAX_SOUNDS_PER_TURTLE - greenLayers.length;
  if (room <= 0) {
    statusEl.textContent = `Green is full (${MAX_SOUNDS_PER_TURTLE} max) — remove one first`;
    return;
  }
  const accepted = audioFiles.slice(0, room);
  const overflow = audioFiles.length - accepted.length;

  statusEl.textContent =
    accepted.length === 1 ? `Green is eating ${accepted[0].name}...` : `Green is eating ${accepted.length} sounds...`;
  startEating(rigs.green, accepted.length);

  const ctxAudio = getAudioCtx();
  const results = await Promise.allSettled(
    accepted.map(async (file) => {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = await ctxAudio.decodeAudioData(arrayBuffer.slice(0));
      const energy = computeSliceEnergy(buffer);
      return {
        id: greenIdCounter++,
        name: file.name,
        buffer,
        sliceDuration: buffer.duration / STEP_COUNT,
        energy,
        pattern: generatePattern(energy, false),
      };
    })
  );

  const added = [];
  const failedNames = [];
  results.forEach((r, idx) => {
    if (r.status === 'fulfilled') added.push(r.value);
    else failedNames.push(accepted[idx].name);
  });

  greenLayers.push(...added);
  renderGreenGrid();
  statusEl.textContent = summarizeDrop('Green', added.length, overflow, failedNames, greenLayers.length);

  scheduleAutoStart(accepted.length);
}

async function handleRedDrop(audioFiles) {
  const room = MAX_SOUNDS_PER_TURTLE - redLayers.length;
  if (room <= 0) {
    statusEl.textContent = `Red is full (${MAX_SOUNDS_PER_TURTLE} max) — remove one first`;
    return;
  }
  const accepted = audioFiles.slice(0, room);
  const overflow = audioFiles.length - accepted.length;

  statusEl.textContent =
    accepted.length === 1 ? `Red is chomping ${accepted[0].name}...` : `Red is chomping ${accepted.length} sounds...`;
  startEating(rigs.red, accepted.length);

  const ctxAudio = getAudioCtx();
  const results = await Promise.allSettled(
    accepted.map(async (file) => {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = await ctxAudio.decodeAudioData(arrayBuffer.slice(0));
      const slicePitches = analyzeSlicesForBass(buffer);
      return {
        id: redIdCounter++,
        name: file.name,
        sliceDuration: buffer.duration / STEP_COUNT,
        slicePitches,
        pattern: generatePattern(slicePitches.map((p) => p.energy), false),
      };
    })
  );

  const added = [];
  const failedNames = [];
  results.forEach((r, idx) => {
    if (r.status === 'fulfilled') added.push(r.value);
    else failedNames.push(accepted[idx].name);
  });

  redLayers.push(...added);
  renderRedBars();
  statusEl.textContent = summarizeDrop('Red', added.length, overflow, failedNames, redLayers.length);

  scheduleAutoStart(accepted.length);
}

async function handleBlueDrop(audioFiles) {
  const room = MAX_SOUNDS_PER_TURTLE - blueQueue.length;
  if (room <= 0) {
    statusEl.textContent = `Blue is full (${MAX_SOUNDS_PER_TURTLE} max) — remove one first`;
    return;
  }
  const accepted = audioFiles.slice(0, room);
  const overflow = audioFiles.length - accepted.length;

  statusEl.textContent =
    accepted.length === 1 ? `Blue is eating ${accepted[0].name}...` : `Blue is eating ${accepted.length} sounds...`;
  startEating(rigs.blue, accepted.length);

  const ctxAudio = getAudioCtx();
  const results = await Promise.allSettled(
    accepted.map(async (file) => {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = await ctxAudio.decodeAudioData(arrayBuffer.slice(0));
      const detected = detectBpm(buffer);
      return {
        id: blueIdCounter++,
        name: file.name,
        buffer,
        bpm: detected,
        mute: new Array(STEP_COUNT).fill(true),
      };
    })
  );

  const added = [];
  const failedNames = [];
  results.forEach((r, idx) => {
    if (r.status === 'fulfilled') added.push(r.value);
    else failedNames.push(accepted[idx].name);
  });

  blueQueue.push(...added);
  renderBluePlaylist();
  renderBlueBars();
  statusEl.textContent = summarizeDrop('Blue', added.length, overflow, failedNames, blueQueue.length);

  scheduleAutoStart(accepted.length);
}

function summarizeDrop(turtleName, addedCount, overflow, failedNames, totalNow) {
  let msg = addedCount
    ? `${turtleName}: added ${addedCount} sound${addedCount > 1 ? 's' : ''} (${totalNow}/${MAX_SOUNDS_PER_TURTLE})`
    : `${turtleName}: could not read that file`;
  if (overflow > 0) msg += ` — ${overflow} skipped, max ${MAX_SOUNDS_PER_TURTLE} reached`;
  if (failedNames.length) msg += ` — failed: ${failedNames.join(', ')}`;
  return msg;
}

function scheduleAutoStart(fileCount) {
  setTimeout(() => {
    if (!playing) startPlayback();
  }, 900 + fileCount * 120);
}

setupDropZone(stageWrapGreen, dropHintGreen, dropOverlayGreen, 'chop me a beat', handleGreenDrop);
setupDropZone(stageWrapBlue, dropHintBlue, dropOverlayBlue, 'play me whole', handleBlueDrop);
setupDropZone(stageWrapRed, dropHintRed, dropOverlayRed, 'feed me bass', handleRedDrop);

// ---------------------------------------------------------------------------
// Export — offline-renders Green + Red's step patterns and Blue's chained
// playlist together for N loops, writes a 16-bit PCM .wav via a native
// Save dialog (main process).
// ---------------------------------------------------------------------------
function audioBufferToWav(buffer) {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const numFrames = buffer.length;
  const dataSize = numFrames * blockAlign;

  const arrBuf = new ArrayBuffer(44 + dataSize);
  const view = new DataView(arrBuf);

  const writeStr = (offset, str) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);

  const channelData = [];
  for (let ch = 0; ch < numChannels; ch++) channelData.push(buffer.getChannelData(ch));

  let offset = 44;
  for (let i = 0; i < numFrames; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      let sample = Math.max(-1, Math.min(1, channelData[ch][i]));
      sample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, sample, true);
      offset += 2;
    }
  }

  return arrBuf;
}

async function exportMix() {
  if (!greenLayers.length && !redLayers.length && !blueQueue.length) {
    statusEl.textContent = 'nothing to export yet — drop a sound on someone first';
    return;
  }

  const loops = clamp(parseInt(loopsInput.value, 10) || 4, 1, 32);
  const prevStatus = statusEl.textContent;
  exportBtn.disabled = true;
  statusEl.textContent = `rendering ${loops} loop${loops > 1 ? 's' : ''}...`;

  try {
    const sampleRate = getAudioCtx().sampleRate;
    const interval = stepInterval();
    const barLength = STEP_COUNT * interval;
    const totalSeconds = loops * barLength + 1.0;
    const offlineCtx = new OfflineAudioContext(2, Math.ceil(totalSeconds * sampleRate), sampleRate);

    for (let r = 0; r < loops; r++) {
      for (let s = 0; s < STEP_COUNT; s++) {
        const time = r * barLength + s * interval;

        greenLayers.forEach((layer) => {
          if (!layer.pattern[s]) return;
          scheduleSlicePlayback(offlineCtx, layer.buffer, time, s * layer.sliceDuration, layer.sliceDuration);
        });

        redLayers.forEach((layer) => {
          if (!layer.pattern[s]) return;
          const p = layer.slicePitches[s];
          scheduleBassHit(offlineCtx, time, p.freq, p.energy, layer.sliceDuration);
        });
      }
    }

    if (blueQueue.length) {
      let t = 0;
      let idx = blueCurrentIndex;
      while (t < loops * barLength) {
        const track = blueQueue[idx % blueQueue.length];
        const rate = track.bpm ? clamp(bpm / track.bpm, 0.5, 2) : 1;

        const { src, playDur } = scheduleBlueBuffer(offlineCtx, track, t, rate);
        src.start(t);

        const barsUsed = Math.max(1, Math.ceil(playDur / barLength));
        t += barsUsed * barLength;
        idx++;
      }
    }

    const rendered = await offlineCtx.startRendering();
    const wavBuffer = audioBufferToWav(rendered);
    const suggestedName = `turtle-mix-${Date.now()}.wav`;
    const result = await window.turtleAPI.exportWav(wavBuffer, suggestedName);

    if (result && result.success) {
      const fileName = result.filePath.split(/[\\/]/).pop();
      statusEl.textContent = `saved ${fileName}`;
    } else if (result && result.canceled) {
      statusEl.textContent = prevStatus;
    } else {
      statusEl.textContent = 'export failed';
    }
  } catch (err) {
    console.error(err);
    statusEl.textContent = 'export failed';
  } finally {
    exportBtn.disabled = false;
  }
}

exportBtn.addEventListener('click', exportMix);
