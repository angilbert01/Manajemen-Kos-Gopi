// WBS 4.1: filter tagihan H-3 & H-0 (dan yang sudah lewat jatuh tempo) secara presisi.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

const dir = mkdtempSync(join(tmpdir(), 'kos-pengingat-'));
process.env.DB_PATH = join(dir, 'test.db');
const { migrate, db } = await import('./db.ts');
const { createApp } = await import('./app.ts');
const { selisihHari } = await import('./dates.ts');

let server: Server;
let base = '';
before(() => {
  migrate();
  server = createApp().listen(0);
  base = `http://localhost:${(server.address() as AddressInfo).port}/api`;
});
after(() => { server.close(); db.close(); rmSync(dir, { recursive: true, force: true }); });

test('selisihHari menghitung hari kalender, termasuk lintas bulan/tahun', () => {
  assert.equal(selisihHari('2026-10-30', '2026-11-02'), 3);
  assert.equal(selisihHari('2026-10-30', '2026-10-30'), 0);
  assert.equal(selisihHari('2026-12-30', '2027-01-02'), 3);
  assert.equal(selisihHari('2026-03-01', '2026-02-26'), -3);
});

test('TC-Pengingat-01 hanya tagihan belum lunas H-3, H-0, dan terlambat yang muncul', async () => {
  const kamar = db.prepare("INSERT INTO kamar (nomor, tipe, harga) VALUES ('P01', 'AC', 1000000)").run().lastInsertRowid;
  const penghuni = (nama: string, hp: string) =>
    db.prepare("INSERT INTO penghuni (nama, no_hp, kamar_id, tanggal_masuk, aktif) VALUES (?, ?, ?, '2026-01-01', 0)")
      .run(nama, hp, kamar).lastInsertRowid;
  const tagihan = (pid: number | bigint, bulan: string, jatuhTempo: string, status = 'Belum Lunas') =>
    db.prepare('INSERT INTO tagihan (penghuni_id, kamar_id, bulan, nominal, status, jatuh_tempo) VALUES (?, ?, ?, 1000000, ?, ?)')
      .run(pid, kamar, bulan, status, jatuhTempo);

  const a = penghuni('H Tiga', '081200000001');
  const b = penghuni('H Nol', '081200000002');
  const c = penghuni('Telat', '081200000003');
  const d = penghuni('Masih Jauh', '081200000004');
  const e = penghuni('Sudah Lunas', '081200000005');
  tagihan(a, '2026-11', '2026-11-02');
  tagihan(b, '2026-10', '2026-10-30');
  tagihan(c, '2026-09', '2026-10-05');
  tagihan(d, '2026-11', '2026-11-03');
  tagihan(e, '2026-11', '2026-11-02', 'Lunas');

  const r = await fetch(`${base}/tagihan/pengingat?tanggal=2026-10-30`);
  assert.equal(r.status, 200);
  const rows = (await r.json()) as { penghuni_nama: string; pengingat: string; hari: number }[];
  assert.deepEqual(
    rows.map((x) => [x.penghuni_nama, x.pengingat, x.hari]),
    [
      ['Telat', 'Terlambat', -25],
      ['H Nol', 'H-0', 0],
      ['H Tiga', 'H-3', 3],
    ],
  );
});

test('TC-Pengingat-02 parameter tanggal tidak valid ditolak', async () => {
  const r = await fetch(`${base}/tagihan/pengingat?tanggal=2026-02-30`);
  assert.equal(r.status, 422);
});
