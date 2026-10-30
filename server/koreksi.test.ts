// Koreksi hasil audit Sprint 1-4: integritas data, validasi batas API, dan alur status.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

const dir = mkdtempSync(join(tmpdir(), 'kos-koreksi-'));
process.env.DB_PATH = join(dir, 'test.db');
const { migrate, db } = await import('./db.ts');
const { createApp } = await import('./app.ts');
const { tanggalJakarta } = await import('./dates.ts');

let server: Server;
let base = '';
before(() => {
  migrate();
  server = createApp().listen(0);
  base = `http://localhost:${(server.address() as AddressInfo).port}/api`;
});
after(() => { server.close(); db.close(); rmSync(dir, { recursive: true, force: true }); });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const call = async (method: string, path: string, body?: unknown): Promise<{ status: number; body: any }> => {
  const r = await fetch(base + path, {
    method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, body: r.status === 204 ? null : await r.json() };
};

const hariIni = tanggalJakarta();
const bulanIni = hariIni.slice(0, 7);
let nomor = 0;
const kamarBaru = async () => (await call('POST', '/kamar', { nomor: `K${++nomor}`, tipe: 'AC', harga: 1000000 })).body;
const penghuniBaru = async (kamarId: number, extra: Record<string, unknown> = {}) =>
  call('POST', '/penghuni', { nama: `Uji ${nomor}`, no_hp: `0812000${String(nomor).padStart(5, '0')}`, kamar_id: kamarId, tanggal_masuk: hariIni, ...extra });

test('registrasi penghuni lama hanya menagih bulan berjalan, tidak menagih bulan masuk bertahun lalu', async () => {
  const k = await kamarBaru();
  const p = await penghuniBaru(k.id, { tanggal_masuk: '2020-01-31' });
  assert.equal(p.status, 201);
  const rows = db.prepare('SELECT bulan FROM tagihan WHERE penghuni_id = ?').all(p.body.id) as { bulan: string }[];
  assert.deepEqual(rows.map((r) => r.bulan), [bulanIni]);
});

test('satu nomor HP tidak boleh aktif di dua kamar', async () => {
  const k1 = await kamarBaru();
  const k2 = await kamarBaru();
  assert.equal((await penghuniBaru(k1.id, { no_hp: '081277778888' })).status, 201);
  const dua = await penghuniBaru(k2.id, { no_hp: '081277778888' });
  assert.equal(dua.status, 409);
  assert.ok(dua.body.errors.no_hp);
});

test('catat keluar memvalidasi tanggal dan penghuni memuat jumlah tagihan belum lunas', async () => {
  const k = await kamarBaru();
  const p = (await penghuniBaru(k.id)).body;
  const daftar = (await call('GET', '/penghuni')).body as { id: number; tagihan_belum_lunas: number }[];
  assert.equal(daftar.find((x) => x.id === p.id)!.tagihan_belum_lunas, 1);
  assert.equal((await call('PATCH', `/penghuni/${p.id}/keluar`, { tanggal_keluar: '2026-02-30' })).status, 422);
  assert.equal((await call('PATCH', `/penghuni/${p.id}/keluar`, { tanggal_keluar: '2019-01-01' })).status, 422);
  assert.equal((await call('PATCH', `/penghuni/${p.id}/keluar`, { tanggal_keluar: hariIni })).status, 200);
});

test('generate tagihan untuk bulan setelah bulan berjalan ditolak', async () => {
  const [y, m] = bulanIni.split('-').map(Number);
  const depan = m === 12 ? `${y! + 1}-01` : `${y}-${String(m! + 1).padStart(2, '0')}`;
  assert.equal((await call('POST', '/tagihan/generate', { bulan: depan })).status, 422);
  assert.equal((await call('POST', '/tagihan/generate', { bulan: bulanIni })).status, 200);
});

test('tanggal bayar di masa depan ditolak', async () => {
  const k = await kamarBaru();
  const p = (await penghuniBaru(k.id)).body;
  const t = (await call('GET', `/tagihan?bulan=${bulanIni}`)).body.find((x: { penghuni_id: number }) => x.penghuni_id === p.id);
  assert.equal((await call('POST', `/tagihan/${t.id}/pembayaran`, { jumlah: 1000, tanggal_bayar: '2999-01-01' })).status, 422);
});

test('batal & hapus pembayaran tidak menghapus riwayat, dan field basi dibersihkan', async () => {
  const k = await kamarBaru();
  const p = (await penghuniBaru(k.id)).body;
  const t = (await call('GET', `/tagihan?bulan=${bulanIni}`)).body.find((x: { penghuni_id: number }) => x.penghuni_id === p.id);
  assert.equal((await call('PATCH', `/tagihan/${t.id}/batal`)).status, 409, 'tidak ada pembayaran untuk dibatalkan');

  await call('PATCH', `/tagihan/${t.id}/lunas`, { metode_pembayaran: 'QRIS', catatan: 'lunas via QR' });
  const batal = await call('PATCH', `/tagihan/${t.id}/batal`);
  assert.equal(batal.status, 200);
  assert.equal(batal.body.status, 'Belum Lunas');
  assert.equal(batal.body.terbayar, 0);
  assert.equal(batal.body.metode_pembayaran, null);
  assert.equal(batal.body.catatan, null);
  assert.equal((await call('GET', `/tagihan/${t.id}/pembayaran`)).body.length, 0);
  const tersimpan = db.prepare('SELECT COUNT(*) AS n FROM pembayaran WHERE tagihan_id = ? AND dibatalkan_at IS NOT NULL').get(t.id) as { n: number };
  assert.equal(tersimpan.n, 1, 'pembayaran dibatalkan tetap tercatat untuk audit');

  const bayar = await call('POST', `/tagihan/${t.id}/pembayaran`, { jumlah: 1000000 });
  assert.equal(bayar.status, 201, 'pembayaran batal tidak dihitung ke batas nominal');
  const pid = (await call('GET', `/tagihan/${t.id}/pembayaran`)).body[0].id;
  assert.equal((await call('DELETE', `/pembayaran/${pid}`)).status, 200);
  assert.equal((await call('DELETE', `/pembayaran/${pid}`)).status, 404);
  assert.equal((db.prepare('SELECT COUNT(*) AS n FROM pembayaran WHERE tagihan_id = ?').get(t.id) as { n: number }).n, 2);
});

test('keluhan: penghuni harus penghuni aktif kamar itu; kamar kosong tidak meminjam nama penghuni lain', async () => {
  const k1 = await kamarBaru();
  const k2 = await kamarBaru();
  const p1 = (await penghuniBaru(k1.id)).body;
  const salah = await call('POST', '/keluhan', { kamar_id: k2.id, penghuni_id: p1.id, judul: 'Lampu', deskripsi: 'Mati' });
  assert.equal(salah.status, 422);
  assert.ok(salah.body.errors.penghuni_id);

  const kosong = await call('POST', '/keluhan', { kamar_id: k2.id, judul: 'Atap bocor', deskripsi: 'Kamar kosong' });
  assert.equal(kosong.status, 201);
  assert.equal(kosong.body.penghuni_id, null);
  await penghuniBaru(k2.id);
  const sesudah = (await call('GET', `/keluhan/${kosong.body.id}`)).body;
  assert.equal(sesudah.penghuni_nama, 'Tanpa penghuni');
  assert.equal(sesudah.penghuni_no_hp, '');
});

test('keluhan: status harus berurutan dan tanggal selesai tidak tertimpa saat edit catatan', async () => {
  const k = await kamarBaru();
  await penghuniBaru(k.id);
  const kl = (await call('POST', '/keluhan', { kamar_id: k.id, judul: 'Keran', deskripsi: 'Bocor', tanggal_lapor: '2026-10-01' })).body;
  assert.equal((await call('PATCH', `/keluhan/${kl.id}/status`, { status: 'Selesai' })).status, 409, 'Pending tidak boleh langsung Selesai');
  assert.equal((await call('PATCH', `/keluhan/${kl.id}/status`, { status: 'Diproses' })).status, 200);
  assert.equal((await call('PATCH', `/keluhan/${kl.id}/status`, { status: 'Selesai', tanggal_selesai: '2026-09-01' })).status, 422, 'selesai sebelum dilapor');
  assert.equal((await call('PATCH', `/keluhan/${kl.id}/status`, { status: 'Selesai', tanggal_selesai: '2026-10-05' })).status, 200);
  const edit = await call('PATCH', `/keluhan/${kl.id}/status`, { status: 'Selesai', catatan_penanganan: 'Ganti seal' });
  assert.equal(edit.status, 200);
  assert.equal(edit.body.tanggal_selesai, '2026-10-05');
  assert.equal((await call('PATCH', `/keluhan/${kl.id}/status`, { status: 'Pending' })).status, 409, 'Selesai hanya bisa dibuka kembali ke Diproses');
  const buka = await call('PATCH', `/keluhan/${kl.id}/status`, { status: 'Diproses' });
  assert.equal(buka.status, 200);
  assert.equal(buka.body.tanggal_selesai, null);
});

test('keluhan tidak bisa dihapus, dan kamar dengan riwayat keluhan tidak bisa dihapus', async () => {
  const k = await kamarBaru();
  const kl = (await call('POST', '/keluhan', { kamar_id: k.id, judul: 'Pintu', deskripsi: 'Seret' })).body;
  assert.equal((await call('DELETE', `/keluhan/${kl.id}`)).status, 404);
  assert.equal((await call('DELETE', `/kamar/${k.id}`)).status, 409);
  assert.ok((await call('GET', `/keluhan/${kl.id}`)).body.id);
  assert.throws(() => db.prepare('DELETE FROM kamar WHERE id = ?').run(k.id), /KAMAR_PUNYA_KELUHAN/);
});

test('filter tagihan "Belum Bayar" tidak mencampur yang sedang dicicil', async () => {
  const k = await kamarBaru();
  const p = (await penghuniBaru(k.id)).body;
  const t = (await call('GET', `/tagihan?bulan=${bulanIni}`)).body.find((x: { penghuni_id: number }) => x.penghuni_id === p.id);
  await call('POST', `/tagihan/${t.id}/pembayaran`, { jumlah: 1000 });
  const belumBayar = (await call('GET', `/tagihan?bulan=${bulanIni}&status=Belum Bayar`)).body as { id: number; status_bayar: string }[];
  assert.ok(belumBayar.length > 0);
  assert.ok(belumBayar.every((x) => x.status_bayar === 'Belum Bayar'));
  assert.ok(!belumBayar.some((x) => x.id === t.id));
});
