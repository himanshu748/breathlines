const { test } = require('node:test');
const assert = require('node:assert/strict');
const { wrapText } = require('../text-layout.cjs');
const measure = (text) => Array.from(text).length * 16.8;

test('PNG wraps the evening line before stars, never sta / rs', () => {
  const text = 'as the evening settles outside the window before the stars';
  assert.deepEqual(wrapText(text, 920, measure), [
    'as the evening settles outside the window before the',
    'stars',
  ]);
  assert.deepEqual(wrapText(text, 960, measure), [
    'as the evening settles outside the window before the',
    'stars',
  ]);
  assert.deepEqual(wrapText(text, 1040, measure), [text]);
});

test('wrapping splits only oversized words and never emits empty rows', () => {
  assert.deepEqual(
    wrapText('a abcdef z', 3, (text) => text.length),
    ['a', 'abc', 'def', 'z'],
  );
  assert.deepEqual(wrapText('', 3, measure), []);
  assert.deepEqual(wrapText('   \t ', 3, measure), []);
  assert.deepEqual(
    wrapText('one\t two\nthree', 9, (text) => text.length),
    ['one two', 'three'],
  );
  assert.deepEqual(
    wrapText('😀😀', 1, (text) => Array.from(text).length),
    ['😀', '😀'],
  );
  assert.deepEqual(
    wrapText('W', 1, () => 2),
    ['W'],
  );
  assert.throws(
    () =>
      wrapText('word', 3, () => {
        throw new Error('measurement failed');
      }),
    /measurement failed/,
  );
});
