// ---------------------------------------------------------------------------
// Turtle — desktop pet that eats a sound and chops it into a beat.
// ---------------------------------------------------------------------------

const STEP_COUNT = 16;

// ----- DOM refs -------------------------------------------------------------
const stageWrap = document.getElementById('stageWrap');
const canvas = document.getElementById('stage');
const ctx = canvas.getContext('2d');
const dropHint = document.getElementById('dropHint');
const dropOverlay = document.getElementById('dropOverlay');

const panel = document.getElementById('panel');
const panelBody = document.getElementById('panelBody');
const panelToggle = document.getElementById('panelToggle');
const stepsEl = document.getElementById('steps');
const playBtn = document.getElementById('playBtn');
const shuffleBtn = document.getElementById('shuffleBtn');
const exportBtn = document.getElementById('exportBtn');
const loopsInput = document.getElementById('loopsInput');
const tempoEl = document.getElementById('tempo');
const bpmLabel = document.getElementById('bpmLabel');
const statusEl = document.getElementById('status');

// ---------------------------------------------------------------------------
// Offscreen low-res canvas for the chunky pixel-art look (vector shapes get
// rasterized small, then blitted up with smoothing disabled).
// ---------------------------------------------------------------------------
const LOW_RES = 90;
const off = document.createElement('canvas');
off.width = LOW_RES;
off.height = LOW_RES;
const octx = off.getContext('2d');
ctx.imageSmoothingEnabled = false;

// ---------------------------------------------------------------------------
// Turtle visual state
// ---------------------------------------------------------------------------
const turtle = {
  blink: 0, // 0 = open, 1 = fully shut
  mouthOpen: 0, // 0 = closed, 1 = fully open
  mouthShape: 'O', // 'O' | 'A' | 'E' — varies while he sings along to the beat
  bob: 0,
  sway: 0, // side-to-side swing while singing
  squash: 0,
  mode: 'idle', // idle | eating
  nextBlinkAt: performance.now() + 1500 + Math.random() * 2500,
  eating: null, // { start, chomps, chompDur }
  mouthPulse: 0, // transient pulse from beat playback
  singPulse: 0, // punchy "into it" pulse — drives brow raise + glow on each beat
};

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function updateTurtle(now) {
  // idle blinking
  if (turtle.mode !== 'eating') {
    if (now >= turtle.nextBlinkAt) {
      turtle.blinking = true;
      turtle.blinkStart = now;
      turtle.nextBlinkAt = now + 2200 + Math.random() * 3200;
    }
    if (turtle.blinking) {
      const t = (now - turtle.blinkStart) / 220;
      if (t >= 1) {
        turtle.blinking = false;
        turtle.blink = 0;
      } else {
        turtle.blink = t < 0.5 ? easeInOut(t * 2) : 1 - easeInOut((t - 0.5) * 2);
      }
    }
  }

  // gentle idle bob (breathing)
  const idleBob = Math.sin(now / 900) * 2.2;

  if (turtle.mode === 'eating' && turtle.eating) {
    const { start, chomps, chompDur } = turtle.eating;
    const elapsed = now - start;
    const totalDur = chomps * chompDur;
    if (elapsed >= totalDur) {
      turtle.mode = 'idle';
      turtle.eating = null;
      turtle.mouthOpen = 0;
      turtle.squash = 0;
    } else {
      const chompT = (elapsed % chompDur) / chompDur;
      turtle.mouthOpen = Math.sin(chompT * Math.PI);
      turtle.squash = Math.sin(chompT * Math.PI) * 3.5;
      turtle.bob = idleBob * 0.3;
    }
  } else {
    turtle.bob = idleBob;
    // decay the beat-triggered pulses
    turtle.mouthPulse *= 0.82;
    turtle.singPulse *= 0.88;
    turtle.mouthOpen = Math.max(turtle.mouthPulse, 0.05 + Math.sin(now / 900) * 0.03);
    turtle.squash *= 0.85;

    // side-to-side sway — subtle while idle, a proper groove while a beat plays
    const swayAmp = playing ? 2.6 : 0.5;
    turtle.sway = Math.sin(now / 240) * swayAmp;
  }
}

const MOUTH_SHAPES = ['O', 'A', 'E'];

function pickMouthShape() {
  let next = MOUTH_SHAPES[Math.floor(Math.random() * MOUTH_SHAPES.length)];
  if (next === turtle.mouthShape) {
    next = MOUTH_SHAPES[(MOUTH_SHAPES.indexOf(next) + 1) % MOUTH_SHAPES.length];
  }
  return next;
}

function triggerMouthPulse(strength) {
  turtle.mouthPulse = Math.max(turtle.mouthPulse, strength);
  turtle.singPulse = 1;
  turtle.mouthShape = pickMouthShape();
  if (Math.random() < 0.45) spawnNote();
}

// ---------------------------------------------------------------------------
// Floating music notes — a little flourish spawned while he sings along
// ---------------------------------------------------------------------------
let notes = [];
const NOTE_CHARS = ['♪', '♫', '♬'];

function spawnNote() {
  notes.push({
    x: canvas.width / 2 + (Math.random() - 0.5) * 30,
    y: canvas.height * 0.56,
    vx: (Math.random() - 0.5) * 10,
    vy: -22 - Math.random() * 10,
    life: 0,
    maxLife: 900 + Math.random() * 300,
    char: NOTE_CHARS[Math.floor(Math.random() * NOTE_CHARS.length)],
    size: 12 + Math.random() * 6,
  });
}

function updateNotes(dtMs) {
  const dt = dtMs / 1000;
  for (let i = notes.length - 1; i >= 0; i--) {
    const n = notes[i];
    n.life += dtMs;
    n.x += n.vx * dt;
    n.y += n.vy * dt;
    if (n.life >= n.maxLife) notes.splice(i, 1);
  }
}

function drawNotes() {
  notes.forEach((n) => {
    const alpha = Math.max(0, 1 - n.life / n.maxLife);
    ctx.font = `${n.size}px sans-serif`;
    ctx.fillStyle = `rgba(238, 245, 234, ${alpha})`;
    ctx.fillText(n.char, n.x, n.y);
  });
}

function startEating(count = 1) {
  turtle.mode = 'eating';
  turtle.eating = {
    start: performance.now(),
    chomps: Math.min(4 + count * 2, 12),
    chompDur: count > 1 ? 160 : 190,
  };
}

// ---------------------------------------------------------------------------
// Drawing — recreates the reference art (green oval body, dotted ring,
// dark inner disc, light face blob with two eyes) and adds an animated mouth.
// ---------------------------------------------------------------------------
function draw(now) {
  octx.clearRect(0, 0, LOW_RES, LOW_RES);

  const cx = LOW_RES / 2 + turtle.sway * 0.5;
  const cy = LOW_RES / 2 + turtle.bob * 0.4;
  const squashY = 1 - turtle.squash * 0.01;
  const squashX = 1 + turtle.squash * 0.01;

  octx.save();
  octx.translate(cx, cy);
  octx.scale(squashX, squashY);
  octx.translate(-cx, -cy);

  // outer body oval (green fill)
  const bodyRX = LOW_RES * 0.46;
  const bodyRY = LOW_RES * 0.33;
  octx.fillStyle = '#4f9a71';
  octx.beginPath();
  octx.ellipse(cx, cy, bodyRX, bodyRY, 0, 0, Math.PI * 2);
  octx.fill();

  // dotted ring outline near the edge
  octx.strokeStyle = '#eef5ea';
  octx.lineWidth = 1.6;
  octx.setLineDash([2.4, 2.6]);
  octx.beginPath();
  octx.ellipse(cx, cy, bodyRX - 2.2, bodyRY - 2.2, 0, 0, Math.PI * 2);
  octx.stroke();
  octx.setLineDash([]);

  // dark inner disc
  const discR = LOW_RES * 0.235;
  octx.fillStyle = '#1e3a24';
  octx.beginPath();
  octx.arc(cx, cy, discR, 0, Math.PI * 2);
  octx.fill();

  // light face blob
  const faceR = LOW_RES * 0.115;
  octx.fillStyle = '#8fd6a6';
  roundedBlob(octx, cx, cy, faceR);
  octx.fill();

  // eyes (dots) — squint when blinking
  const eyeOffsetX = faceR * 0.42;
  const eyeOffsetY = -faceR * 0.12;
  const eyeR = Math.max(0.6, faceR * 0.16 * (1 - turtle.blink * 0.85));
  octx.fillStyle = '#1e3a24';
  [-1, 1].forEach((side) => {
    octx.beginPath();
    if (turtle.blink > 0.7) {
      // shut eyes -> tiny horizontal dash
      octx.fillRect(cx + side * eyeOffsetX - eyeR, cy + eyeOffsetY - 0.4, eyeR * 2, 0.9);
    } else {
      octx.arc(cx + side * eyeOffsetX, cy + eyeOffsetY, eyeR, 0, Math.PI * 2);
      octx.fill();
    }
  });

  // eyebrows — raise a touch on every beat for an "into it" singing look
  const browLift = turtle.singPulse * faceR * 0.16;
  octx.strokeStyle = '#1e3a24';
  octx.lineWidth = Math.max(0.6, faceR * 0.07);
  octx.lineCap = 'round';
  [-1, 1].forEach((side) => {
    const bx = cx + side * eyeOffsetX;
    const by = cy + eyeOffsetY - faceR * 0.34 - browLift;
    octx.beginPath();
    octx.moveTo(bx - eyeR * 1.3, by + faceR * 0.05);
    octx.quadraticCurveTo(bx, by - faceR * 0.06, bx + eyeR * 1.3, by + faceR * 0.05);
    octx.stroke();
  });

  // mouth — animated, sits below the eyes; shape varies while singing
  const mouthShape = turtle.mode === 'eating' ? 'O' : turtle.mouthShape;
  drawMouth(octx, cx, cy + faceR * 0.48, faceR, turtle.mouthOpen, mouthShape);

  octx.restore();

  // blit low-res -> display canvas, pixelated
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // soft glow pulse behind him, synced to the beat while he's singing along
  if (turtle.singPulse > 0.02) {
    const glowR = canvas.width * 0.5;
    const gradient = ctx.createRadialGradient(
      canvas.width / 2, canvas.height / 2, glowR * 0.2,
      canvas.width / 2, canvas.height / 2, glowR
    );
    const a = turtle.singPulse * 0.35;
    gradient.addColorStop(0, `rgba(143, 214, 166, ${a})`);
    gradient.addColorStop(1, 'rgba(143, 214, 166, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  ctx.drawImage(off, 0, 0, canvas.width, canvas.height);
  drawNotes();
}

function roundedBlob(c, cx, cy, r) {
  // soft hexagon-ish blob like the reference center shape
  const sides = 6;
  c.beginPath();
  for (let i = 0; i < sides; i++) {
    const angle = (Math.PI * 2 * i) / sides - Math.PI / 2;
    const rr = r * (0.92 + (i % 2 === 0 ? 0.08 : 0));
    const x = cx + Math.cos(angle) * rr;
    const y = cy + Math.sin(angle) * rr;
    if (i === 0) c.moveTo(x, y);
    else c.lineTo(x, y);
  }
  c.closePath();
}

function drawMouth(c, x, y, faceR, open, shape) {
  const wBase = faceR * 0.62;
  c.fillStyle = '#12241a';
  c.strokeStyle = '#12241a';

  if (open < 0.08) {
    // closed: gentle curved smile line
    c.lineWidth = Math.max(0.7, faceR * 0.09);
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(x - wBase * 0.55, y);
    c.quadraticCurveTo(x, y + faceR * 0.14, x + wBase * 0.55, y);
    c.stroke();
    return;
  }

  // open — the shape varies (O / A / E) so it reads as singing different
  // vowel sounds rather than just chewing on every beat
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

function loop(now) {
  const dt = now - lastFrameTime;
  lastFrameTime = now;
  updateTurtle(now);
  updateNotes(dt);
  checkScheduledVisuals(now / 1000);
  draw(now);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// ---------------------------------------------------------------------------
// Window is moved via native -webkit-app-region: drag (see style.css) on the
// turtle stage and the panel header. Right-click opens a small context menu.
// ---------------------------------------------------------------------------
window.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  window.turtleAPI.showContextMenu();
});

// ---------------------------------------------------------------------------
// Panel collapse toggle
// ---------------------------------------------------------------------------
let collapsed = false;
panelToggle.addEventListener('click', () => {
  collapsed = !collapsed;
  panelBody.classList.toggle('collapsed', collapsed);
  panelToggle.textContent = collapsed ? '▸' : '▾';
});

// ---------------------------------------------------------------------------
// Audio engine
// ---------------------------------------------------------------------------
let audioCtx = null;

// Each dropped sound becomes its own "layer": its own 16-slice buffer,
// energy profile, and independently editable step pattern. They all mix
// together during playback and export.
const MAX_LAYERS = 6;
let layers = []; // { id, name, buffer, sliceDuration, pattern, energy }
let layerIdCounter = 0;

let playing = false;
let bpm = 120;
let currentStep = 0;
let nextStepTime = 0;
const scheduleAheadTime = 0.12;
const lookaheadMs = 25;
let schedulerTimer = null;
let visualQueue = []; // { time, active }

function getAudioCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

function stepInterval() {
  return 60 / bpm / 4; // 16th notes
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
  let anyActive = false;

  layers.forEach((layer) => {
    if (!layer.pattern[stepIdx]) return;
    anyActive = true;

    const src = ctxAudio.createBufferSource();
    src.buffer = layer.buffer;

    const gain = ctxAudio.createGain();
    const fade = Math.min(0.006, layer.sliceDuration * 0.2);
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(1, time + fade);
    gain.gain.setValueAtTime(1, Math.max(time, time + layer.sliceDuration - fade));
    gain.gain.linearRampToValueAtTime(0, time + layer.sliceDuration);

    src.connect(gain).connect(ctxAudio.destination);
    const offset = stepIdx * layer.sliceDuration;
    src.start(time, offset, layer.sliceDuration);
  });

  visualQueue.push({ time, active: anyActive, stepIdx });
}

function checkScheduledVisuals(nowSeconds) {
  if (!audioCtx) return;
  while (visualQueue.length && visualQueue[0].time <= audioCtx.currentTime) {
    const evt = visualQueue.shift();
    highlightStep(evt.stepIdx);
    if (evt.active) triggerMouthPulse(0.85);
  }
}

function highlightStep(idx) {
  stepsEl.querySelectorAll('.step').forEach((el) => {
    el.classList.toggle('playhead', Number(el.dataset.step) === idx);
  });
}

function startPlayback() {
  if (!layers.length) return;
  const ctxAudio = getAudioCtx();
  if (ctxAudio.state === 'suspended') ctxAudio.resume();
  playing = true;
  currentStep = 0;
  nextStepTime = ctxAudio.currentTime + 0.05;
  visualQueue = [];
  schedulerTimer = setInterval(scheduler, lookaheadMs);
  playBtn.textContent = '■';
  playBtn.classList.add('active');
}

function stopPlayback() {
  playing = false;
  if (schedulerTimer) clearInterval(schedulerTimer);
  schedulerTimer = null;
  visualQueue = [];
  playBtn.textContent = '▶';
  playBtn.classList.remove('active');
  highlightStep(-1);
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
  if (!layers.length) return;
  layers.forEach((layer) => {
    layer.pattern = generatePattern(layer.energy, true);
  });
  renderSteps();
});

// ---------------------------------------------------------------------------
// Step grid UI — one row per loaded sound ("layer"). Click a row's number
// label to remove that layer; click a cell to toggle that layer's step.
// ---------------------------------------------------------------------------
function renderSteps() {
  stepsEl.innerHTML = '';

  if (!layers.length) {
    stepsEl.appendChild(buildStepRow(null));
    return;
  }

  layers.forEach((layer, layerIdx) => {
    stepsEl.appendChild(buildStepRow(layer, layerIdx));
  });
}

function buildStepRow(layer, layerIdx) {
  const rowWrap = document.createElement('div');
  rowWrap.className = 'layerRow';

  const label = document.createElement('button');
  label.className = 'layerLabel' + (layer ? '' : ' empty');
  label.type = 'button';
  label.textContent = layer ? String(layerIdx + 1) : '–';
  if (layer) {
    label.title = `${layer.name} — click to remove`;
    label.addEventListener('click', () => {
      layers = layers.filter((l) => l.id !== layer.id);
      renderSteps();
    });
  } else {
    label.disabled = true;
  }
  rowWrap.appendChild(label);

  const row = document.createElement('div');
  row.className = 'layerSteps';
  for (let i = 0; i < STEP_COUNT; i++) {
    const cell = document.createElement('div');
    cell.className = 'step' + (layer && layer.pattern[i] ? ' on' : '');
    cell.dataset.step = i;
    if (!layer) {
      cell.classList.add('empty');
    } else {
      cell.addEventListener('click', () => {
        layer.pattern[i] = !layer.pattern[i];
        cell.classList.toggle('on', layer.pattern[i]);
      });
    }
    row.appendChild(cell);
  }
  rowWrap.appendChild(row);

  return rowWrap;
}
renderSteps();

// ---------------------------------------------------------------------------
// Slicing + auto pattern generation
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

  const density = 6 + Math.floor(Math.random() * 5); // 6..10 active steps
  const chosen = new Set(withNoise.slice(0, density).map((e) => e.i));
  chosen.add(0); // always hit the downbeat

  const result = new Array(STEP_COUNT).fill(false);
  chosen.forEach((idx) => (result[idx] = true));
  return result;
}

// ---------------------------------------------------------------------------
// Drag & drop of an audio sample
// ---------------------------------------------------------------------------
let dragCounter = 0;

window.addEventListener('dragenter', (e) => {
  e.preventDefault();
  dragCounter++;
  dropOverlay.classList.add('active');
  dropHint.textContent = 'drop it!';
});

window.addEventListener('dragover', (e) => {
  e.preventDefault();
});

window.addEventListener('dragleave', (e) => {
  e.preventDefault();
  dragCounter = Math.max(0, dragCounter - 1);
  if (dragCounter === 0) {
    dropOverlay.classList.remove('active');
    dropHint.textContent = 'drop a sound on me';
  }
});

function isAudioFile(file) {
  return file.type.startsWith('audio/') || /\.(wav|mp3|ogg|flac|aiff|m4a)$/i.test(file.name);
}

window.addEventListener('drop', async (e) => {
  e.preventDefault();
  dragCounter = 0;
  dropOverlay.classList.remove('active');

  const incoming = e.dataTransfer.files ? Array.from(e.dataTransfer.files) : [];
  const audioFiles = incoming.filter(isAudioFile);

  if (!audioFiles.length) {
    if (incoming.length) statusEl.textContent = "that doesn't look like audio";
    return;
  }

  const room = MAX_LAYERS - layers.length;
  if (room <= 0) {
    statusEl.textContent = `already full (${MAX_LAYERS} sounds max) — remove one first`;
    return;
  }

  const accepted = audioFiles.slice(0, room);
  const overflow = audioFiles.length - accepted.length;

  dropHint.classList.add('hidden');
  statusEl.textContent =
    accepted.length === 1 ? `eating ${accepted[0].name}...` : `eating ${accepted.length} sounds...`;
  startEating(accepted.length);

  const ctxAudio = getAudioCtx();
  const results = await Promise.allSettled(
    accepted.map(async (file) => {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = await ctxAudio.decodeAudioData(arrayBuffer.slice(0));
      const energy = computeSliceEnergy(buffer);
      return {
        id: layerIdCounter++,
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

  layers.push(...added);
  renderSteps();

  let msg = added.length
    ? `added ${added.length} sound${added.length > 1 ? 's' : ''} (${layers.length}/${MAX_LAYERS})`
    : 'could not read that file';
  if (overflow > 0) msg += ` — ${overflow} skipped, max ${MAX_LAYERS} reached`;
  if (failedNames.length) msg += ` — failed: ${failedNames.join(', ')}`;
  statusEl.textContent = msg;

  // let the chomp animation play out, then auto-start the beat (only if it
  // wasn't already playing — dropping more sounds mid-loop just layers in)
  setTimeout(() => {
    dropHint.classList.remove('hidden');
    dropHint.textContent = 'drop a sound on me';
    if (!playing && layers.length) startPlayback();
  }, 900 + accepted.length * 120);
});

// ---------------------------------------------------------------------------
// Export — offline-renders the current multi-layer pattern for N loops and
// writes it out as a 16-bit PCM .wav via a native Save dialog (main process).
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
  view.setUint16(20, 1, true); // PCM
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
  if (!layers.length) {
    statusEl.textContent = 'nothing to export yet — drop a sound first';
    return;
  }

  const loops = Math.max(1, Math.min(32, parseInt(loopsInput.value, 10) || 4));
  const prevStatus = statusEl.textContent;
  exportBtn.disabled = true;
  statusEl.textContent = `rendering ${loops} loop${loops > 1 ? 's' : ''}...`;

  try {
    const sampleRate = getAudioCtx().sampleRate;
    const interval = stepInterval();
    const totalSeconds = loops * STEP_COUNT * interval + 0.5; // tail room for the last slice
    const offlineCtx = new OfflineAudioContext(2, Math.ceil(totalSeconds * sampleRate), sampleRate);

    for (let r = 0; r < loops; r++) {
      for (let s = 0; s < STEP_COUNT; s++) {
        const time = r * STEP_COUNT * interval + s * interval;
        layers.forEach((layer) => {
          if (!layer.pattern[s]) return;
          const src = offlineCtx.createBufferSource();
          src.buffer = layer.buffer;

          const gain = offlineCtx.createGain();
          const fade = Math.min(0.006, layer.sliceDuration * 0.2);
          gain.gain.setValueAtTime(0, time);
          gain.gain.linearRampToValueAtTime(1, time + fade);
          gain.gain.setValueAtTime(1, Math.max(time, time + layer.sliceDuration - fade));
          gain.gain.linearRampToValueAtTime(0, time + layer.sliceDuration);

          src.connect(gain).connect(offlineCtx.destination);
          src.start(time, s * layer.sliceDuration, layer.sliceDuration);
        });
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
