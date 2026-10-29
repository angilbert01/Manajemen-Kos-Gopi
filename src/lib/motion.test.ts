import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countValue, easeOutCubic } from './motion.ts';

test('easeOutCubic: 0 → 0, 1 → 1, di luar rentang di-clamp', () => {
  assert.equal(easeOutCubic(0), 0);
  assert.equal(easeOutCubic(1), 1);
  assert.equal(easeOutCubic(-0.5), 0);
  assert.equal(easeOutCubic(2), 1);
});

test('easeOutCubic: monoton naik dan lebih cepat di awal', () => {
  let prev = -1;
  for (let i = 0; i <= 20; i++) {
    const v = easeOutCubic(i / 20);
    assert.ok(v >= prev, `turun di t=${i / 20}`);
    prev = v;
  }
  assert.ok(easeOutCubic(0.5) > 0.5);
});

test('countValue: mulai dari nilai lama, berakhir tepat di target', () => {
  assert.equal(countValue(0, 12, 0, 800), 0);
  assert.equal(countValue(0, 12, 800, 800), 12);
  assert.equal(countValue(0, 12, 5000, 800), 12);
  assert.equal(countValue(5, 7, 800, 800), 7);
  const mid = countValue(0, 6_000_000, 400, 800);
  assert.ok(mid > 3_000_000 && mid < 6_000_000);
});

test('countValue: durasi 0 langsung target (reduced motion)', () => {
  assert.equal(countValue(0, 12, 0, 0), 12);
});
