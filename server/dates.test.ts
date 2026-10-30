import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isIsoDate, tanggalJakarta } from './dates.ts';

test('tanggal bisnis berpindah bulan/tahun mengikuti WIB walaupun server memakai UTC', () => {
  assert.equal(tanggalJakarta(new Date('2026-10-31T16:59:59Z')), '2026-10-31');
  assert.equal(tanggalJakarta(new Date('2026-10-31T17:00:00Z')), '2026-11-01');
  assert.equal(tanggalJakarta(new Date('2026-12-31T17:00:00Z')), '2027-01-01');
});

test('validasi kalender menolak tanggal semu dan menerima tahun kabisat', () => {
  for (const date of ['2026-02-29', '2026-04-31', '2026-13-01', '0000-01-01', '2026-1-01']) {
    assert.equal(isIsoDate(date), false, date);
  }
  for (const date of ['2028-02-29', '2026-04-30', '2026-12-31']) assert.equal(isIsoDate(date), true, date);
});
