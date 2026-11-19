const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  ExhaleDetector,
  BlinkDetector,
  marginalia,
  Manuscript,
} = require('../signals.cjs');
test('smooth noisy breathing yields one break per trough, not per sample', () => {
  const d = new ExhaleDetector();
  const hits = [];
  for (let t = 0; t < 30000; t += 40)
    if (d.push(Math.cos((t / 4000) * 2 * Math.PI) + 0.025 * Math.sin(t), t))
      hits.push(t);
  assert.equal(hits.length, 7);
  for (const t of hits) assert.ok(t % 4000 > 2000 && t % 4000 < 3000);
});
test('flat, missing, invalid and duplicate samples never produce breaks', () => {
  const d = new ExhaleDetector();
  for (let t = 0; t < 5000; t += 40) assert.equal(d.push(1, t), false);
  assert.equal(d.push(NaN, 6000), false);
  assert.equal(d.push(0, 0), false);
  assert.equal(d.push(1, 10000), false);
});
test('blink gesture: single ignored, double within one second accepted', () => {
  const d = new BlinkDetector();
  assert.equal(d.push(true, 0), false);
  assert.equal(d.push(false, 120), false);
  assert.equal(d.push(true, 400), false);
  assert.equal(d.push(false, 520), true);
  assert.equal(d.push(false, 520), false);
});
test('long blink fires only once; separated blinks, missing and glitches do not', () => {
  const d = new BlinkDetector();
  assert.equal(d.push(undefined, 0), false);
  d.push(true, 10);
  assert.equal(d.push(false, 20), false);
  d.push(true, 100);
  assert.equal(d.push(true, 800), true);
  assert.equal(d.push(true, 900), false);
  assert.equal(d.push(false, 1000), false);
  d.push(true, 3000);
  assert.equal(d.push(false, 3120), false);
  d.push(true, 4500);
  assert.equal(d.push(false, 4620), false);
});
test('notes gate confidence and HRV warmup; decode expression scores and stable talking', () => {
  const m = {
    cardio: {
      pulseRate: [{ value: 72, confidence: 80 }],
      hrv: [{ rmssd: 38, confidence: 90 }],
    },
    breathing: { rate: [{ value: 12, confidence: 0 }] },
    face: {
      expression: [
        {
          scores: [
            { type: 5, confidence: 84 },
            { type: 6, confidence: 16 },
          ],
        },
      ],
      talking: [{ detected: true, stable: true }],
    },
  };
  const n = marginalia(m, 59999);
  assert.equal(n.pulse.value, 72);
  assert.equal(n.pulse.confidence, 0.8);
  assert.equal(n.breathing, null);
  assert.equal(n.hrv, null);
  assert.equal(n.expression.value, 'happy');
  assert.equal(n.expression.confidence, 0.84);
  assert.equal(n.talking.value, 'talking');
  assert.equal(marginalia(m, 60000).hrv.value, 38);
  assert.equal(marginalia({}, 60000).pulse, null);
});
test('manuscript never emits empty lines; stanza requests persist and notes are snapshots', () => {
  const m = new Manuscript();
  const notes = { pulse: { value: 70 } };
  assert.equal(m.finish(' ', notes, true), false);
  m.trace.push(0.2, 0.3);
  assert.equal(m.finish('first line', notes), true);
  m.finish('', notes, true);
  m.finish('second', notes);
  notes.pulse.value = 100;
  assert.equal(m.lines[0].notes.pulse.value, 70);
  assert.equal(m.lines[1].stanza, true);
  assert.deepEqual(m.lines[0].trace, [0.2, 0.3]);
});
