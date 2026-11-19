const {
  SmartSpectraSDK,
  ProcessingStatus,
  ValidationCode,
  breathingMetrics,
  cardioMetrics,
  faceMetrics,
} = require('@smartspectra/node-sdk/renderer');
const { decodeMetrics } = require('@smartspectra/node-sdk/messages');
const {
  ExhaleDetector,
  BlinkDetector,
  marginalia,
  Manuscript,
  timestampMs,
} = require('./signals.cjs');
const $ = (id) => document.getElementById(id);
const manuscript = new Manuscript();
let breath = new ExhaleDetector(),
  blink = new BlinkDetector();
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
function finish(stanza = false) {
  if (manuscript.finish($('writing').value, notes, stanza)) {
    $('writing').value = '';
    renderLines();
    feedback(
      stanza ? 'A stanza, held in a blink.' : 'A line, held in an exhale.',
    );
  } else if (stanza) feedback('A little space before the next line.');
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
  for (const s of metrics.face?.blinking || [])
    if (s.stable && blink.push(s.detected, timestampMs(s.timestamp)))
      finish(true);
  draw('breath-wave', [
    [waves.chest, '#5c795d'],
    [waves.abdomen, '#b28c6a'],
  ]);
  draw('pulse-wave', [[waves.pulse, '#b17859']]);
}
function reportError(code, message) {
  $('error').hidden = false;
  $('error').textContent =
    Number(code) === 13
      ? `Some requested metrics are not authorized by this key. No estimates are invented. Retry with breathing only. (${message})`
      : `Camera session could not continue: ${message}. Stop, check your key and camera, then retry.`;
  $('fallback').hidden = Number(code) !== 13;
}
async function stop() {
  generation++;
  starting = false;
  const previous = sdk;
  sdk = null;
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
  $('preview').srcObject = null;
  $('preview-empty').hidden = false;
  $('session-tag').textContent = 'CAMERA OFF';
  $('start').disabled = false;
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
async function start(breathingOnly = false) {
  if (starting || sdk) return;
  if (!approved) {
    show('consent');
    return;
  }
  const key = $('api-key').value.trim();
  if (!key) {
    show('key-screen');
    $('key-hint').textContent =
      'Add your API key to start the camera. It stays in memory only.';
    return;
  }
  starting = true;
  $('start').disabled = true;
  $('error').hidden = true;
  $('fallback').hidden = true;
  const token = ++generation;
  try {
    await window.breathlines.consent(true);
    if (token !== generation) return;
    breath = new ExhaleDetector();
    blink = new BlinkDetector();
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
        : [...breathingMetrics, ...cardioMetrics, ...faceMetrics],
      enableTelemetry: $('telemetry').checked,
      enableAccumulatedOutput: false,
    });
    sdk = current;
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
          `Processing: ${statuses[status] || status}${breathingOnly ? ' · breathing only; cardio & face disabled' : ''}`;
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
      if (token === generation) {
        reportError(code, message);
        void stop();
      }
    });
    await current.start();
    if (token !== generation) {
      try {
        await current.destroy();
      } catch {}
    }
  } catch (e) {
    if (token === generation) {
      reportError(e.code, e.message);
      await stop();
    }
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
$('start').onclick = () => void start();
$('fallback').onclick = async () => {
  await stop();
  await start(true);
};
$('writing').onkeydown = (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    feedback('The return key is resting. Your exhale will end the line.');
  }
};
$('writing').oninput = () => {
  $('writing').value = $('writing').value.replace(/[\r\n]+/g, ' ');
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
