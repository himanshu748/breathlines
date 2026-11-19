const {
  SmartSpectraSDK,
  ProcessingStatus,
  ValidationCode,
  FrameTransform,
  SmartSpectraErrorCode,
  MetricType,
  breathingMetrics,
  cardioMetrics,
  faceMetrics,
} = require('@smartspectra/node-sdk/renderer');
const { decodeMetrics } = require('@smartspectra/node-sdk/messages');
const {
  ExhaleDetector,
  marginalia,
  Manuscript,
  timestampMs,
  EyeClosureDetector,
  DoubleBlinkDetector,
  WordBoundaryBreak,
} = require('./signals.cjs');
const { nextRecovery } = require('./recovery.cjs');
const $ = (id) => document.getElementById(id);
const manuscript = new Manuscript();
const wordBreak = new WordBoundaryBreak();
let breath = new ExhaleDetector(),
  blink = new DoubleBlinkDetector(),
  eyes = new EyeClosureDetector();
let checking = false;
let landmarksAt = -Infinity;
let sdk = null,
  stream = null,
  started = 0,
  starting = false,
  generation = 0,
  approved = false;
let notes = marginalia({}, 0),
  source = null,
  chestAt = -Infinity;
const cache = {},
  seen = {},
  waves = { chest: [], abdomen: [], pulse: [] };
const names = (object) =>
  Object.fromEntries(
    Object.entries(object)
      .filter(([, v]) => typeof v === 'number')
      .map(([k, v]) => [
        v,
        k.replace(/^k/, '').replace(/([a-z])([A-Z])/g, '$1 $2'),
      ]),
  );
const statuses = names(ProcessingStatus),
  validations = names(ValidationCode);
const escape = (text) =>
  String(text).replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ],
  );
const fmt = (n) => Number(n).toFixed(0);
function show(screen) {
  for (const id of ['consent', 'key-screen', 'desk'])
    $(id).hidden = id !== screen;
}
function feedback(message) {
  $('feedback').textContent = message;
}
function pathFor(values, w, h) {
  if (values.length < 2) return '';
  const min = Math.min(...values),
    range = Math.max(0.001, Math.max(...values) - min);
  return values
    .map(
      (v, i) =>
        `${i ? 'L' : 'M'}${((i / (values.length - 1)) * w).toFixed(1)},${(h - 3 - ((v - min) / range) * (h - 6)).toFixed(1)}`,
    )
    .join(' ');
}
function draw(id, series) {
  const canvas = $(id),
    c = canvas.getContext('2d');
  c.clearRect(0, 0, canvas.width, canvas.height);
  c.strokeStyle = '#d6dccd';
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(0, canvas.height / 2);
  c.lineTo(canvas.width, canvas.height / 2);
  c.stroke();
  for (const [values, color] of series) {
    const p = pathFor(values, canvas.width, canvas.height);
    if (p) {
      c.strokeStyle = color;
      c.lineWidth = 2;
      c.stroke(new Path2D(p));
    }
  }
}
function noteText(n) {
  return (
    [
      n.pulse && `${fmt(n.pulse.value)} bpm`,
      n.breathing && `${fmt(n.breathing.value)} breaths/min`,
      n.hrv && `RMSSD ${fmt(n.hrv.value)} ms`,
      n.expression?.value,
      n.talking?.value,
    ]
      .filter(Boolean)
      .join(' · ') || 'no confident estimates'
  );
}
function warmth(n) {
  return n.pulse
    ? `hsl(${Math.max(12, Math.min(38, 38 - (n.pulse.value - 50) * 0.35))} 34% 36%)`
    : '#354b3d';
}
function lineHTML(line, index) {
  return [
    `<div class="poem-line${line.stanza ? ' stanza' : ''}">`,
    `<span class="line-num">${String(index + 1).padStart(2, '0')}</span>`,
    `<div class="line-text" style="color:${warmth(line.notes)}">`,
    `${escape(line.text)}</div>`,
    '<aside class="line-notes">',
    '<svg viewBox="0 0 100 22" aria-label="Breathing trace for this line">',
    `<path d="${pathFor(line.trace, 100, 22)}" fill="none" stroke="#819177" stroke-width="1"/>`,
    `</svg>${escape(noteText(line.notes))}</aside></div>`,
  ].join('');
}
function renderLines() {
  $('finished').innerHTML = manuscript.lines.map(lineHTML).join('');
  $('line-count').textContent =
    `${String(manuscript.lines.length).padStart(2, '0')} LINES`;
  $('next-number').textContent = String(manuscript.lines.length + 1).padStart(
    2,
    '0',
  );
}
function commitBreak(text, remainder, lineNotes, stanza = false) {
  if (manuscript.finish(text, lineNotes, stanza)) {
    $('writing').value = remainder;
    renderLines();
    feedback(
      stanza ? 'A stanza, held in a blink.' : 'A line, held in an exhale.',
    );
  } else if (stanza) feedback('A little space before the next line.');
}
function finish(stanza = false) {
  if (stanza) {
    wordBreak.pending = null;
    commitBreak($('writing').value, '', notes, true);
    return;
  }
  const result = wordBreak.request($('writing').value, Date.now(), notes);
  if (result) commitBreak(result.text, result.remainder, result.notes);
}
function flushWordBreak() {
  const result = wordBreak.update($('writing').value, Date.now());
  if (result) commitBreak(result.text, result.remainder, result.notes);
}
function renderValues() {
  const fields = [
    ['Pulse', notes.pulse, 'bpm'],
    ['Breathing', notes.breathing, '/ min'],
    ['HRV · RMSSD', notes.hrv, 'ms'],
    ['Expression', notes.expression, ''],
  ];
  $('values').innerHTML = fields
    .map(
      ([label, n, unit]) =>
        `<div><dt>${label}</dt><dd>${n ? `${escape(typeof n.value === 'number' ? fmt(n.value) : n.value)} <span style="font-size:10px">${unit}</span><small>${fmt(n.confidence * 100)}% confidence</small>` : `—<small>${label.startsWith('HRV') ? 'needs 60s + confidence' : 'awaiting confidence'}</small>`}</dd></div>`,
    )
    .join('');
  if (notes.talking)
    $('values').innerHTML +=
      `<div><dt>Talking detection</dt><dd style="font-size:14px">${notes.talking.value}<small>stable SDK detection · no confidence field</small></dd></div>`;
}
function refreshNotes() {
  const current = {};
  for (const [key, entry] of Object.entries(cache))
    if (Date.now() - entry.at < 10000) {
      const [group, field] = key.split('.');
      (current[group] ||= {})[field] = entry.samples;
    }
  notes = marginalia(current, started ? Date.now() - started : 0);
  renderValues();
}
function handleMetrics(metrics) {
  for (const [group, fields] of Object.entries(metrics))
    if (fields && typeof fields === 'object')
      for (const [field, samples] of Object.entries(fields))
        if (Array.isArray(samples) && samples.length)
          cache[`${group}.${field}`] = { samples, at: Date.now() };
  refreshNotes();
  const ingest = (key, samples) => {
    const fresh = [];
    for (const sample of samples || []) {
      const ts = Number(sample.timestamp);
      if (!Number.isFinite(ts) || ts <= (seen[key] ?? -Infinity)) continue;
      seen[key] = ts;
      if (
        Number.isFinite(sample.value) &&
        (sample.confidence === undefined || sample.confidence > 0)
      ) {
        waves[key].push(sample.value);
        fresh.push(sample);
      }
    }
    waves[key] = waves[key].slice(-240);
    return fresh;
  };
  const chest = ingest('chest', metrics.breathing?.upperTrace),
    abdomen = ingest('abdomen', metrics.breathing?.lowerTrace);
  ingest('pulse', metrics.cardio?.arterialPressureTrace);
  if (chest.length) chestAt = Date.now();
  const nextSource = chest.length
    ? 'chest'
    : Date.now() - chestAt > 1500 && abdomen.length
      ? 'abdomen'
      : source;
  if (nextSource !== source) {
    breath.reset();
    source = nextSource;
  }
  $('source').textContent =
    source === 'abdomen' ? 'ABDOMEN FALLBACK' : 'EXHALE → NEW LINE';
  for (const s of source === 'chest'
    ? chest
    : source === 'abdomen'
      ? abdomen
      : []) {
    manuscript.trace.push(s.value);
    manuscript.trace = manuscript.trace.slice(-160);
    if (breath.push(s.value, timestampMs(s.timestamp))) finish();
  }
  for (const s of metrics.face?.landmarks || []) {
    const previousTime = eyes.lastTime;
    if (eyes.push(s, timestampMs(s.timestamp))) finish(true);
    if (eyes.available && eyes.lastTime > previousTime)
      landmarksAt = Date.now();
  }
  for (const s of metrics.face?.blinking || [])
    if (s.stable && blink.push(s.detected, timestampMs(s.timestamp)))
      if (Date.now() - landmarksAt > 1500) finish(true);
  draw('breath-wave', [
    [waves.chest, '#5c795d'],
    [waves.abdomen, '#b28c6a'],
  ]);
  draw('pulse-wave', [[waves.pulse, '#b17859']]);
}
function reportError(code, message) {
  const lowFps = Number(code) === SmartSpectraErrorCode.kSustainedLowFrameRate;
  $('error').hidden = false;
  $('error').textContent = lowFps
    ? 'Measurement stopped because the camera frame rate stayed too low. Your manuscript is preserved. Close other camera apps, then choose a breathing-only restart when you are ready.'
    : Number(code) === 13
      ? `Some requested metrics are not authorized by this key. No estimates are invented. Retry with breathing only. (${message})`
      : `Camera session could not continue: ${message}. Stop, check your key and camera, then retry.`;
  $('fallback').hidden = !lowFps && Number(code) !== 13;
}
function rotatePreview() {
  const angle = Number($('rotation').value);
  $('preview').style.transform =
    `rotate(${angle}deg) scale(${angle % 180 ? 0.5 : 1})`;
}
function selectedTransform() {
  return {
    0: FrameTransform.kNone,
    90: FrameTransform.kRotate90CW,
    180: FrameTransform.kRotate180,
    270: FrameTransform.kRotate90CCW,
  }[$('rotation').value];
}
async function openPreview(token) {
  stream?.getTracks().forEach((track) => track.stop());
  stream = null;
  const deviceId = $('camera-picker').value;
  const next = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      width: { ideal: 1280 },
      height: { ideal: 720 },
      frameRate: { ideal: 30 },
      ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
    },
  });
  if (token !== generation) {
    next.getTracks().forEach((track) => track.stop());
    return;
  }
  stream = next;
  const selected = next.getVideoTracks()[0].getSettings().deviceId;
  const cameras = (await navigator.mediaDevices.enumerateDevices()).filter(
    (item) => item.kind === 'videoinput',
  );
  if (token !== generation) return;
  $('camera-picker').replaceChildren(
    ...cameras.map((camera, index) => {
      const option = document.createElement('option');
      option.value = camera.deviceId;
      option.textContent = camera.label || `Camera ${index + 1}`;
      return option;
    }),
  );
  $('camera-picker').value = selected || deviceId;
  $('preview').srcObject = stream;
  await $('preview').play();
  if (token !== generation) return;
  $('preview-empty').hidden = true;
  $('session-tag').textContent = 'PREVIEW ONLY · CAMERA ON';
  rotatePreview();
}
async function prepare() {
  if (checking || starting || sdk) return;
  const token = generation + 1;
  await stop();
  if (token !== generation) return;
  if (!approved) return show('consent');
  try {
    await window.breathlines.consent(true);
    if (token !== generation) return;
    $('camera-setup').hidden = false;
    $('measurement-options').hidden = true;
    $('readiness-result').textContent =
      'Preview your framing, then check readiness.';
    await openPreview(token);
    if (token === generation)
      $('status').textContent = 'Camera preview only · not measuring.';
  } catch (error) {
    if (token === generation) {
      reportError(error.code, error.message);
      await stop();
    }
  }
}
async function checkReadiness(breathingOnly = false) {
  if (checking || sdk || !stream) return;
  checking = true;
  const token = generation;
  const cameraName = stream.getVideoTracks()[0].label;
  stream.getTracks().forEach((track) => track.stop());
  stream = null;
  $('preview').srcObject = null;
  $('preview-empty').hidden = false;
  for (const id of ['camera-picker', 'rotation', 'check-readiness'])
    $(id).disabled = true;
  $('measurement-options').hidden = true;
  $('readiness-result').textContent =
    'Checking camera readiness… Stop camera cancels this check.';
  $('session-tag').textContent = 'CAMERA CHECK · NOT MEASURING';
  try {
    const result = await window.breathlines.readiness({
      apiKey: $('api-key').value.trim(),
      cameraName,
      breathingOnly,
      enableTelemetry: $('telemetry').checked,
      frameTransform: selectedTransform(),
    });
    if (token !== generation) return;
    const verdict = ['ready', 'limited', 'blocked', 'inconclusive'].includes(
      result.verdict,
    )
      ? result.verdict
      : 'inconclusive';
    $('readiness-result').textContent =
      `${verdict.toUpperCase()} — ${result.reason}${verdict !== 'ready' ? ' Try breathing only to reduce processing demand. An inconclusive check is not a pass; blocked full measurement must be resolved first.' : ''}`;
    $('measure-full').disabled = verdict === 'blocked' || breathingOnly;
    await openPreview(token);
    if (token === generation) $('measurement-options').hidden = false;
    return token === generation ? verdict : null;
  } catch (error) {
    if (token === generation)
      $('readiness-result').textContent =
        `INCONCLUSIVE — ${error.message}. Prepare the camera again to retry.`;
  } finally {
    checking = false;
    for (const id of ['camera-picker', 'rotation', 'check-readiness'])
      $(id).disabled = false;
  }
}
async function stop() {
  generation++;
  wordBreak.pending = null;
  starting = false;
  const previous = sdk;
  sdk = null;
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
  $('preview').srcObject = null;
  $('preview-empty').hidden = false;
  $('camera-setup').hidden = true;
  $('session-tag').textContent = 'CAMERA OFF';
  $('start').disabled = false;
  $('start').hidden = false;
  $('status').textContent = 'Camera stopped. Your words are still here.';
  for (const key of Object.keys(cache)) delete cache[key];
  refreshNotes();
  await window.breathlines.consent(false);
  if (previous) {
    try {
      await previous.stop();
    } catch {}
    try {
      await previous.destroy();
    } catch {}
  }
}
async function start(breathingOnly = false, excluded = []) {
  if (starting || checking || sdk || !stream) return;
  if (!approved) {
    show('consent');
    return;
  }
  const key = $('api-key').value.trim();
  if (!key) {
    await stop();
    show('key-screen');
    $('key-hint').textContent =
      'Add your API key to start the camera. It stays in memory only.';
    return;
  }
  starting = true;
  $('start').disabled = true;
  $('start').hidden = true;
  $('error').hidden = true;
  $('fallback').hidden = true;
  const token = ++generation;
  let handlingFailure = false;
  const unavailable = () =>
    excluded
      .map((metric) =>
        metric === MetricType.ARTERIAL_PRESSURE_TRACE
          ? 'arterial waveform'
          : 'expression',
      )
      .join(', ');
  const failure = async (code, message) => {
    if (token !== generation || handlingFailure) return;
    handlingFailure = true;
    const next = breathingOnly
      ? null
      : nextRecovery(code, message, excluded, MetricType);
    if (!next) {
      reportError(code, message);
      await stop();
      return;
    }
    $('error').hidden = false;
    $('error').textContent =
      'An optional model failed. Your words are preserved. Retrying with one fewer optional metric; the SDK may not identify which model failed.';
    await stop();
    if (generation !== token + 1 || !approved) return;
    await prepare();
    const verdict = await checkReadiness(false);
    if (verdict && verdict !== 'blocked') await start(false, next);
  };
  try {
    await window.breathlines.consent(true);
    if (token !== generation) return;
    breath = new ExhaleDetector();
    blink = new DoubleBlinkDetector();
    eyes = new EyeClosureDetector();
    landmarksAt = -Infinity;
    source = null;
    chestAt = -Infinity;
    manuscript.trace = [];
    for (const key of Object.keys(seen)) delete seen[key];
    for (const key of Object.keys(cache)) delete cache[key];
    for (const key of Object.keys(waves)) waves[key] = [];
    started = Date.now();
    const current = new SmartSpectraSDK({
      apiKey: key,
      requestedMetrics: breathingOnly
        ? [...breathingMetrics]
        : [...breathingMetrics, ...cardioMetrics, ...faceMetrics].filter(
            (metric) => !excluded.includes(metric),
          ),
      enableTelemetry: $('telemetry').checked,
      enableAccumulatedOutput: false,
    });
    sdk = current;
    if (excluded.length) {
      $('error').hidden = false;
      $('error').textContent =
        `Recovery session: ${unavailable()} unavailable (disabled after a processing failure). Your manuscript is preserved. Stop and prepare again to request all signals.`;
    }
    current.useMediaStream(stream, { frameTransform: selectedTransform() });
    $('camera-setup').hidden = true;
    current.on('streamAvailable', (s) => {
      if (token !== generation) {
        s.getTracks().forEach((t) => t.stop());
        return;
      }
      stream = s;
      $('preview').srcObject = s;
      $('preview')
        .play()
        .catch(() => {});
      $('preview-empty').hidden = true;
    });
    current.on('metrics', (buf) => {
      if (token === generation) {
        try {
          handleMetrics(decodeMetrics(buf));
        } catch (e) {
          reportError('decode', e.message);
        }
      }
    });
    current.on('processingStatus', (status) => {
      if (token === generation) {
        $('status').textContent =
          `Processing: ${statuses[status] || status}${breathingOnly ? ' · breathing only; cardio & face disabled' : ''}${excluded.length ? ` · unavailable: ${unavailable()}` : ''}`;
        $('session-tag').textContent =
          status === ProcessingStatus.kRunning
            ? 'CAMERA ON · LOCAL'
            : 'SESSION ' + (statuses[status] || status).toUpperCase();
      }
    });
    current.on('validationStatus', (code, ts, hint) => {
      if (token === generation)
        $('validation').textContent =
          hint || validations[code] || `Validation ${code}`;
    });
    current.on('error', (code, message) => {
      void failure(code, message);
    });
    await current.start();
    if (token !== generation) {
      try {
        await current.destroy();
      } catch {}
    }
  } catch (e) {
    await failure(e.code, e.message);
  } finally {
    if (token === generation) starting = false;
  }
}
$('consent-next').onclick = async () => {
  approved = true;
  show('key-screen');
  $('api-key').value = await window.breathlines.key();
  if ($('api-key').value)
    $('key-hint').textContent =
      'Loaded from SMARTSPECTRA_API_KEY. Kept in memory, not saved.';
};
$('back').onclick = () => {
  approved = false;
  show('consent');
};
$('open-desk').onclick = () => {
  show('desk');
  $('writing').focus();
};
$('change-key').onclick = async () => {
  await stop();
  show('key-screen');
};
$('stop').onclick = () => void stop();
$('start').onclick = () => void prepare();
$('check-readiness').onclick = () => void checkReadiness();
$('measure-full').onclick = () => void start();
$('measure-breathing').onclick = async () => {
  const verdict = await checkReadiness(true);
  if (verdict && verdict !== 'blocked') await start(true);
};
$('camera-picker').onchange = async () => {
  $('measurement-options').hidden = true;
  $('readiness-result').textContent = 'Camera changed. Check readiness again.';
  const token = ++generation;
  try {
    await openPreview(token);
  } catch (error) {
    if (token === generation) {
      reportError(error.code, error.message);
      await stop();
    }
  }
};
$('rotation').onchange = () => {
  rotatePreview();
  $('measurement-options').hidden = true;
  $('readiness-result').textContent =
    'Rotation changed. Check readiness again.';
};
$('fallback').onclick = async () => {
  await stop();
  await prepare();
  await checkReadiness(true);
};
$('writing').onkeydown = (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    feedback('The return key is resting. Your exhale will end the line.');
  }
};
$('writing').oninput = () => {
  $('writing').value = $('writing').value.replace(/[\r\n]+/g, ' ');
  flushWordBreak();
};
function exportLines() {
  return [
    ...manuscript.lines,
    ...($('writing').value.trim()
      ? [
          {
            text: $('writing').value.trim(),
            notes: {},
            trace: [],
            stanza: manuscript.pendingStanza,
          },
        ]
      : []),
  ];
}
async function exportManuscript(type) {
  const lines = exportLines(),
    title = $('title').value.trim() || 'An untitled becoming';
  if (!lines.length) {
    feedback('Write a few words before exporting.');
    return;
  }
  try {
    let data;
    if (type === 'html') data = manuscriptHTML(title, lines);
    else {
      const canvas = document.createElement('canvas'),
        c = canvas.getContext('2d');
      canvas.width = 1600;
      c.font = '28px monospace';
      const wrap = (text, width) => {
        const rows = [];
        let row = '';
        for (const char of Array.from(text)) {
          if (c.measureText(row + char).width > width) {
            rows.push(row);
            row = '';
          }
          row += char;
        }
        if (row) rows.push(row);
        return rows;
      };
      const blocks = lines.map((line) => ({
        line,
        rows: wrap(line.text, 960),
      }));
      const height =
        350 +
        blocks.reduce(
          (h, b) =>
            h +
            Math.max(160, b.rows.length * 46 + 35) +
            (b.line.stanza ? 55 : 0),
          0,
        );
      if (height > 30000)
        throw new Error(
          'This manuscript is too long for a PNG. Please use HTML export.',
        );
      canvas.height = height;
      c.fillStyle = '#f8f5ee';
      c.fillRect(0, 0, 1600, height);
      c.fillStyle = '#354b3d';
      c.font = '18px monospace';
      c.fillText('BREATHLINES / A BREATH MANUSCRIPT', 90, 70);
      c.font = '48px Georgia';
      c.fillText(title, 90, 150, 1400);
      let y = 245;
      for (const { line, rows } of blocks) {
        if (line.stanza) y += 55;
        c.fillStyle = warmth(line.notes);
        c.font = '28px monospace';
        for (const row of rows) {
          c.fillText(row, 90, y);
          y += 46;
        }
        const top = y - rows.length * 46;
        c.save();
        c.translate(1180, top - 15);
        const p = pathFor(line.trace, 220, 35);
        if (p) {
          c.strokeStyle = '#819177';
          c.lineWidth = 2;
          c.stroke(new Path2D(p));
        }
        c.restore();
        c.fillStyle = '#75826b';
        c.font = '15px monospace';
        for (const [i, s] of noteText(line.notes).split(' · ').entries())
          c.fillText(s, 1180, top + 45 + i * 21, 320);
        y = top + Math.max(160, rows.length * 46 + 35);
      }
      c.font = '17px monospace';
      c.fillStyle = '#75826b';
      c.fillText(
        'Camera estimates, not medical. Unmeasured draft words carry no estimates.',
        90,
        height - 60,
      );
      data = canvas.toDataURL('image/png');
    }
    const saved = await window.breathlines.export(type, data);
    feedback(
      saved
        ? `Your ${type.toUpperCase()} manuscript was saved.`
        : 'Export cancelled. Nothing was saved.',
    );
  } catch (e) {
    feedback(`Export failed: ${e.message}`);
  }
}
function manuscriptHTML(title, lines) {
  return [
    '<!doctype html><html lang="en"><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width">',
    '<meta http-equiv="Content-Security-Policy" ',
    "content=\"default-src 'none'; style-src 'unsafe-inline'\">",
    `<title>${escape(title)} — Breathlines</title><style>`,
    'body{background:#f8f5ee;color:#354b3d;max-width:900px;',
    'margin:60px auto;padding:30px;font-family:Georgia,serif}',
    'h1{font-size:40px;font-weight:normal}',
    '.poem-line{display:grid;grid-template-columns:25px 1fr 160px;',
    'gap:20px;margin:24px 0}',
    '.stanza{margin-top:55px}',
    '.line-text{font:18px/1.8 monospace;overflow-wrap:anywhere}',
    '.line-num,.line-notes,footer{font:11px/1.7 monospace;color:#75826b}',
    '.line-notes svg{width:100px;display:block}',
    'footer{border-top:1px solid #ddd;margin-top:60px;padding-top:20px}',
    '</style><body><p>BREATHLINES / A BREATH MANUSCRIPT</p>',
    `<h1>${escape(title)}</h1>${lines.map(lineHTML).join('')}`,
    '<footer>Camera estimates, not medical. Not a medical device. ',
    'Unmeasured draft words carry no estimates.<br>',
    `Saved by your choice · ${escape(new Date().toLocaleDateString())}`,
    '</footer></body></html>',
  ].join('');
}
$('export-html').onclick = () => void exportManuscript('html');
$('export-png').onclick = () => void exportManuscript('png');
$('date').textContent = new Date()
  .toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  })
  .toUpperCase();
setInterval(refreshNotes, 1000);
setInterval(flushWordBreak, 100);
renderValues();
draw('breath-wave', []);
draw('pulse-wave', []);
window.addEventListener('beforeunload', () => {
  stream?.getTracks().forEach((t) => t.stop());
  if (sdk)
    try {
      sdk.destroy();
    } catch {}
});
