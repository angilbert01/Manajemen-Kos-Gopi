import { test } from 'node:test';
import assert from 'node:assert/strict';
import { trenMasuk } from './tren.ts';

const okt = new Date(2026, 9, 29); // 29 Okt 2026

test('trenMasuk: 6 bucket berurutan, bulan tanpa data = 0', () => {
  const r = trenMasuk([{ tanggal_masuk: '2026-07-15' }, { tanggal_masuk: '2026-08-15' }, { tanggal_masuk: '2026-08-02' }], okt);
  assert.deepEqual(
    r.map((b) => [b.bulan, b.label, b.jumlah]),
    [
      ['2026-05', 'Mei', 0],
      ['2026-06', 'Jun', 0],
      ['2026-07', 'Jul', 1],
      ['2026-08', 'Agu', 2],
      ['2026-09', 'Sep', 0],
      ['2026-10', 'Okt', 0],
    ],
  );
});

test('trenMasuk: data di luar 6 bulan diabaikan', () => {
  const r = trenMasuk([{ tanggal_masuk: '2026-01-05' }, { tanggal_masuk: '2026-04-30' }, { tanggal_masuk: '2026-11-01' }], okt);
  assert.equal(r.reduce((s, b) => s + b.jumlah, 0), 0);
});

test('trenMasuk: melintasi pergantian tahun', () => {
  const r = trenMasuk([{ tanggal_masuk: '2025-12-31' }, { tanggal_masuk: '2026-01-01' }], new Date(2026, 1, 10));
  assert.deepEqual(r.map((b) => b.bulan), ['2025-09', '2025-10', '2025-11', '2025-12', '2026-01', '2026-02']);
  assert.deepEqual(r.map((b) => b.jumlah), [0, 0, 0, 1, 1, 0]);
  assert.equal(r[3]!.label, 'Des');
});

test('trenMasuk: daftar kosong → 6 bucket nol', () => {
  const r = trenMasuk([], okt);
  assert.equal(r.length, 6);
  assert.ok(r.every((b) => b.jumlah === 0));
});
