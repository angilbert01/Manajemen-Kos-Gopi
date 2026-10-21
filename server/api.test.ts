// Uji API sesuai test case QA (TC-01 s/d TC-07). Jalankan: npm run test:api
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

const dir = mkdtempSync(join(tmpdir(), 'kos-gopi-'));
process.env.DB_PATH = join(dir, 'test.db');
const { migrate, db } = await import('./db.ts');
const { createApp } = await import('./app.ts');

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

let kamarId = 0;

test('TC-01 tambah kamar valid tersimpan & tampil di daftar', async () => {
  const r = await call('POST', '/kamar', { nomor: 'A01', tipe: 'AC', harga: 1200000 });
  assert.equal(r.status, 201);
  assert.equal(r.body.status, 'Kosong');
  kamarId = r.body.id;
  const list = await call('GET', '/kamar');
  assert.ok(list.body.some((k: { nomor: string }) => k.nomor === 'A01'));
});

test('TC-02 nomor kamar duplikat ditolak (case-insensitive)', async () => {
  const r = await call('POST', '/kamar', { nomor: 'a01', tipe: 'AC', harga: 1000000 });
  assert.equal(r.status, 409);
  assert.ok(r.body.errors.nomor);
});

test('TC-03 field wajib kosong (harga) ditolak', async () => {
  const r = await call('POST', '/kamar', { nomor: 'A02', tipe: 'AC' });
  assert.equal(r.status, 422);
  assert.ok(r.body.errors.harga);
});

test('TC-06 nomor HP berisi huruf ditolak', async () => {
  const r = await call('POST', '/penghuni', { nama: 'Uji', no_hp: '08abc', kamar_id: kamarId, tanggal_masuk: '2026-10-18' });
  assert.equal(r.status, 422);
  assert.ok(r.body.errors.no_hp);
});

test('TC-04 registrasi penghuni valid -> kamar menjadi Terisi', async () => {
  const r = await call('POST', '/penghuni', { nama: 'Andi', no_hp: '0812-3456-7890', kamar_id: kamarId, tanggal_masuk: '2026-10-18' });
  assert.equal(r.status, 201);
  assert.equal(r.body.no_hp, '081234567890');
  const k = await call('GET', `/kamar/${kamarId}`);
  assert.equal(k.body.status, 'Terisi');
});

test('TC-05 kamar Terisi tidak bisa dipilih lagi', async () => {
  const r = await call('POST', '/penghuni', { nama: 'Budi', no_hp: '081234567891', kamar_id: kamarId, tanggal_masuk: '2026-10-18' });
  assert.equal(r.status, 409);
});

test('TC-07 filter katalog status Kosong hanya menampilkan kamar kosong', async () => {
  await call('POST', '/kamar', { nomor: 'A03', tipe: 'Standar', harga: 900000 });
  const r = await call('GET', '/kamar?status=Kosong');
  assert.ok(r.body.length > 0);
  assert.ok(r.body.every((k: { status: string }) => k.status === 'Kosong'));
});

test('kamar Terisi tidak bisa dihapus; penghuni keluar -> kamar Kosong & bisa dihapus', async () => {
  assert.equal((await call('DELETE', `/kamar/${kamarId}`)).status, 409);
  const p = (await call('GET', '/penghuni')).body[0];
  assert.equal((await call('PATCH', `/penghuni/${p.id}/keluar`, {})).status, 200);
  assert.equal((await call('GET', `/kamar/${kamarId}`)).body.status, 'Kosong');
  assert.equal((await call('DELETE', `/kamar/${kamarId}`)).status, 204);
});

test('CRUD profil admin (get aktif, tambah, ubah, aktifkan, hapus)', async () => {
  const awal = await call('GET', '/admin/aktif');
  assert.equal(awal.status, 200);
  assert.equal(awal.body.nama, 'Gopi');

  // Minimal 1 admin tidak boleh dihapus
  assert.equal((await call('DELETE', `/admin/${awal.body.id}`)).status, 409);

  // Tambah admin baru
  const baru = await call('POST', '/admin', {
    nama: 'Hasan Huzaifi',
    peran: 'Pengelola Kos',
    email: 'hasan@kosgopi.id',
    no_hp: '081234567899',
    nama_kos: 'Kos Gopi',
    alamat_kos: 'Malang',
    aktif: false,
  });
  assert.equal(baru.status, 201);

  // Ubah admin
  const ubah = await call('PUT', `/admin/${baru.body.id}`, {
    nama: 'Hasan H.',
    peran: 'Pengelola Kos',
    email: 'hasan@kosgopi.id',
    no_hp: '081234567899',
    nama_kos: 'Kos Gopi 2',
    alamat_kos: 'Malang',
  });
  assert.equal(ubah.status, 200);
  assert.equal(ubah.body.nama, 'Hasan H.');

  // Aktifkan admin baru
  const aktifkan = await call('PATCH', `/admin/${baru.body.id}/aktifkan`);
  assert.equal(aktifkan.status, 200);
  assert.equal((await call('GET', '/admin/aktif')).body.id, baru.body.id);

  // Hapus admin baru -> kembali ke admin pertama
  assert.equal((await call('DELETE', `/admin/${baru.body.id}`)).status, 204);
  assert.equal((await call('GET', '/admin/aktif')).body.id, awal.body.id);
});
