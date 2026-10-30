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
const { createApp, generateTagihanBulan, hitungJatuhTempo } = await import('./app.ts');
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

test('kamar Terisi tidak bisa dihapus; setelah keluar riwayat tagihan tetap dilindungi', async () => {
  assert.equal((await call('DELETE', `/kamar/${kamarId}`)).status, 409);
  const p = (await call('GET', '/penghuni')).body[0];
  assert.equal((await call('PATCH', `/penghuni/${p.id}/keluar`, {})).status, 200);
  assert.equal((await call('GET', `/kamar/${kamarId}`)).body.status, 'Kosong');
  assert.equal((await call('DELETE', `/kamar/${kamarId}`)).status, 409);
  assert.ok((await call('GET', '/penghuni?semua=1')).body.some((row: { id: number }) => row.id === p.id));
  const empty = await call('POST', '/kamar', { nomor: 'TANPA-RIWAYAT', tipe: 'AC', harga: 1000000 });
  assert.equal((await call('DELETE', `/kamar/${empty.body.id}`)).status, 204);
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

// ---------- Sprint 3: EP-02 Sistem Tagihan Bulanan & Status Pembayaran ----------

let tPenghuni1Id = 0;
let tPenghuni2Id = 0;
let tagihan1Id = 0;

test('Sprint 3: Setup kamar dan penghuni untuk pengujian tagihan', async () => {
  const k1 = await call('POST', '/kamar', { nomor: 'B01', tipe: 'VIP', harga: 1500000 });
  const k2 = await call('POST', '/kamar', { nomor: 'B02', tipe: 'Standar', harga: 900000 });
  assert.equal(k1.status, 201);
  assert.equal(k2.status, 201);

  const p1 = await call('POST', '/penghuni', {
    nama: 'Budi Santoso',
    no_hp: '081234567811',
    kamar_id: k1.body.id,
    tanggal_masuk: '2026-10-10',
  });
  const p2 = await call('POST', '/penghuni', {
    nama: 'Siti Rahma',
    no_hp: '081234567812',
    kamar_id: k2.body.id,
    tanggal_masuk: '2026-10-15',
  });
  assert.equal(p1.status, 201);
  assert.equal(p2.status, 201);
  tPenghuni1Id = p1.body.id;
  tPenghuni2Id = p2.body.id;
});

test('TC-Tagihan-01 [WBS 2.1]: Generate tagihan bulanan otomatis berdasarkan harga kamar terisi', async () => {
  const r = await call('POST', '/tagihan/generate', { bulan: '2026-10' });
  assert.equal(r.status, 200);
  assert.equal(r.body.bulan, '2026-10');
  // Tagihan bulan 2026-10 untuk penghuni aktif sudah terbuat
  assert.ok(r.body.total_tagihan >= 2);

  const list = await call('GET', '/tagihan?bulan=2026-10');
  assert.equal(list.status, 200);
  const t1 = list.body.find((t: { penghuni_id: number }) => t.penghuni_id === tPenghuni1Id);
  const t2 = list.body.find((t: { penghuni_id: number }) => t.penghuni_id === tPenghuni2Id);

  assert.ok(t1, 'Tagihan penghuni 1 harus ada');
  assert.ok(t2, 'Tagihan penghuni 2 harus ada');
  assert.equal(t1.nominal, 1500000, 'Nominal tagihan 1 sesuai harga kamar VIP (Rp 1.500.000)');
  assert.equal(t2.nominal, 900000, 'Nominal tagihan 2 sesuai harga kamar Standar (Rp 900.000)');
  assert.equal(t1.status, 'Belum Lunas');
  assert.equal(t1.jatuh_tempo, '2026-10-10');
  assert.equal(t2.jatuh_tempo, '2026-10-15');

  tagihan1Id = t1.id;
});

test('TC-Tagihan-02 [WBS 2.1]: Idempotency - generate ulang tidak membuat tagihan ganda', async () => {
  const r = await call('POST', '/tagihan/generate', { bulan: '2026-10' });
  assert.equal(r.status, 200);
  assert.equal(r.body.dibuat, 0, 'Tidak boleh ada tagihan ganda yang dibuat');
  assert.ok(r.body.dilewati >= 2, 'Tagihan yang sudah ada dilewati');
});

test('TC-Tagihan-03 [WBS 2.2]: Rekap tagihan menampilkan daftar lunas vs belum lunas & total nominal', async () => {
  const rekap = await call('GET', '/tagihan/rekap?bulan=2026-10');
  assert.equal(rekap.status, 200);
  assert.equal(rekap.body.bulan, '2026-10');
  assert.ok(rekap.body.total_tagihan >= 2);
  assert.equal(rekap.body.total_lunas, 0);
  assert.equal(rekap.body.nominal_lunas, 0);
  assert.equal(rekap.body.total_belum_lunas, rekap.body.total_tagihan);
  assert.equal(rekap.body.nominal_belum_lunas, rekap.body.total_nominal);
  assert.equal(rekap.body.daftar_lunas.length, 0);
  assert.equal(rekap.body.daftar_belum_lunas.length, rekap.body.total_tagihan);
});

test('TC-Tagihan-04 [WBS 2.3]: Konfirmasi pembayaran lunas mengubah status & mencatat tanggal bayar', async () => {
  const lunasRes = await call('PATCH', `/tagihan/${tagihan1Id}/lunas`, {
    tanggal_bayar: '2026-10-25',
    metode_pembayaran: 'Transfer',
    catatan: 'Transfer via BCA',
  });
  assert.equal(lunasRes.status, 200);
  assert.equal(lunasRes.body.status, 'Lunas');
  assert.equal(lunasRes.body.tanggal_bayar, '2026-10-25');
  assert.equal(lunasRes.body.metode_pembayaran, 'Transfer');
  assert.equal(lunasRes.body.catatan, 'Transfer via BCA');

  // Rekap terupdate secara akurat
  const rekap = await call('GET', '/tagihan/rekap?bulan=2026-10');
  assert.equal(rekap.body.total_lunas, 1);
  assert.equal(rekap.body.nominal_lunas, 1500000);
  assert.ok(rekap.body.nominal_belum_lunas > 0);
  assert.equal(rekap.body.daftar_lunas.length, 1);
  assert.equal(rekap.body.daftar_lunas[0].id, tagihan1Id);
});

test('TC-Tagihan-05: Filter tagihan status Lunas dan Belum Lunas', async () => {
  const lunasList = await call('GET', '/tagihan?bulan=2026-10&status=Lunas');
  assert.equal(lunasList.status, 200);
  assert.ok(lunasList.body.every((t: { status: string }) => t.status === 'Lunas'));

  const belumList = await call('GET', '/tagihan?bulan=2026-10&status=Belum Lunas');
  assert.equal(belumList.status, 200);
  assert.ok(belumList.body.every((t: { status: string }) => t.status === 'Belum Lunas'));
});

test('TC-Tagihan-06: Batal status lunas (opsi pembatalan/undo)', async () => {
  const batalRes = await call('PATCH', `/tagihan/${tagihan1Id}/batal`);
  assert.equal(batalRes.status, 200);
  assert.equal(batalRes.body.status, 'Belum Lunas');
  assert.equal(batalRes.body.tanggal_bayar, null);

  const rekap = await call('GET', '/tagihan/rekap?bulan=2026-10');
  assert.equal(rekap.body.total_lunas, 0);
});

// ---------- Request klien: Pembayaran Cicilan vs Bayar Langsung 1 Bulan ----------

test('TC-Cicilan-01: Cicilan pertama -> status Dicicil, sisa berkurang, rekap akurat', async () => {
  // Tagihan 1 = Rp 1.500.000 (sudah di-reset oleh TC-Tagihan-06)
  const r = await call('POST', `/tagihan/${tagihan1Id}/pembayaran`, {
    jumlah: 500000,
    tanggal_bayar: '2026-10-05',
    metode_pembayaran: 'Tunai',
    catatan: 'Cicilan ke-1',
  });
  assert.equal(r.status, 201);
  assert.equal(r.body.status, 'Belum Lunas');
  assert.equal(r.body.status_bayar, 'Dicicil');
  assert.equal(r.body.terbayar, 500000);
  assert.equal(r.body.sisa, 1000000);
  assert.equal(r.body.tanggal_bayar, null);

  const rekap = await call('GET', '/tagihan/rekap?bulan=2026-10');
  assert.equal(rekap.body.total_dicicil, 1);
  assert.equal(rekap.body.nominal_lunas, 500000, 'Uang terkumpul termasuk cicilan');
  assert.equal(rekap.body.nominal_belum_lunas, rekap.body.total_nominal - 500000, 'Tertunggak = sisa tagihan');
});

test('TC-Cicilan-02: Bayar melebihi sisa ditolak (422)', async () => {
  const r = await call('POST', `/tagihan/${tagihan1Id}/pembayaran`, { jumlah: 2000000, tanggal_bayar: '2026-10-06' });
  assert.equal(r.status, 422);
  assert.ok(r.body.errors.jumlah);

  const nol = await call('POST', `/tagihan/${tagihan1Id}/pembayaran`, { jumlah: 0 });
  assert.equal(nol.status, 422);
});

test('TC-Cicilan-03: Cicilan pelunasan -> otomatis Lunas & riwayat tercatat', async () => {
  const r = await call('POST', `/tagihan/${tagihan1Id}/pembayaran`, {
    jumlah: 1000000,
    tanggal_bayar: '2026-10-20',
    metode_pembayaran: 'Transfer BCA',
  });
  assert.equal(r.status, 201);
  assert.equal(r.body.status, 'Lunas');
  assert.equal(r.body.status_bayar, 'Lunas');
  assert.equal(r.body.sisa, 0);
  assert.equal(r.body.tanggal_bayar, '2026-10-20', 'Tanggal lunas = tanggal cicilan terakhir');
  assert.equal(r.body.metode_pembayaran, 'Transfer BCA');

  const riwayat = await call('GET', `/tagihan/${tagihan1Id}/pembayaran`);
  assert.equal(riwayat.status, 200);
  assert.equal(riwayat.body.length, 2);

  // Tagihan lunas tidak bisa dibayar lagi
  assert.equal((await call('POST', `/tagihan/${tagihan1Id}/pembayaran`, { jumlah: 1000 })).status, 409);
});

test('TC-Cicilan-04: Hapus 1 cicilan (undo) -> status kembali Dicicil', async () => {
  const riwayat = await call('GET', `/tagihan/${tagihan1Id}/pembayaran`);
  const terakhir = riwayat.body[riwayat.body.length - 1];
  const r = await call('DELETE', `/pembayaran/${terakhir.id}`);
  assert.equal(r.status, 200);
  assert.equal(r.body.status, 'Belum Lunas');
  assert.equal(r.body.status_bayar, 'Dicicil');
  assert.equal(r.body.sisa, 1000000);
});

test('TC-Cicilan-05: Bayar langsung 1 bulan (PATCH /lunas) = 1 pembayaran sebesar nominal', async () => {
  const list = await call('GET', '/tagihan?bulan=2026-10&status=Belum Lunas');
  const t2 = list.body.find((t: { penghuni_id: number }) => t.penghuni_id === tPenghuni2Id);
  const r = await call('PATCH', `/tagihan/${t2.id}/lunas`, { tanggal_bayar: '2026-10-15', metode_pembayaran: 'QRIS' });
  assert.equal(r.status, 200);
  assert.equal(r.body.status, 'Lunas');
  assert.equal(r.body.terbayar, 900000);
  assert.equal(r.body.jumlah_pembayaran, 1);

  // PATCH /lunas pada tagihan yang dicicil hanya melunasi SISA-nya
  const r1 = await call('PATCH', `/tagihan/${tagihan1Id}/lunas`, { tanggal_bayar: '2026-10-21' });
  assert.equal(r1.status, 200);
  assert.equal(r1.body.status, 'Lunas');
  assert.equal(r1.body.terbayar, 1500000);
  assert.equal(r1.body.jumlah_pembayaran, 2);
});

test('Sprint 3: tagihan periode berikutnya memakai harga saat dibuat dan tidak mengubah riwayat', async () => {
  const generated = generateTagihanBulan('2026-11');
  const first = generated.tagihan.find((row) => row.penghuni_id === tPenghuni1Id)!;
  assert.equal(first.nominal, 1500000);
  assert.equal(first.jatuh_tempo, '2026-11-10');
  const update = await call('PUT', `/kamar/${first.kamar_id}`, { nomor: 'B01', tipe: 'VIP', harga: 1700000 });
  assert.equal(update.status, 200);
  assert.equal(generateTagihanBulan('2026-11').dibuat, 0);
  assert.equal((await call('GET', `/tagihan/${first.id}`)).body.nominal, 1500000);
  const next = generateTagihanBulan('2026-12').tagihan.find((row) => row.penghuni_id === tPenghuni1Id)!;
  assert.equal(next.nominal, 1700000);
  assert.equal((await call('GET', `/tagihan/${tagihan1Id}`)).body.nominal, 1500000);
});

test('Sprint 3: registrasi lama menyiapkan tagihan berjalan dan tidak membuat tagihan sebelum masuk', async () => {
  const kamar = await call('POST', '/kamar', { nomor: 'AUTO', tipe: 'Standar', harga: 800000 });
  const penghuni = await call('POST', '/penghuni', {
    nama: 'Penghuni Lama', no_hp: '081234567890', kamar_id: kamar.body.id, tanggal_masuk: '2020-01-31',
  });
  assert.equal(penghuni.status, 201);
  const current = await call('GET', `/tagihan?bulan=${tanggalJakarta().slice(0, 7)}`);
  assert.ok(current.body.some((row: { penghuni_id: number }) => row.penghuni_id === penghuni.body.id));
  generateTagihanBulan('2019-12');
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM tagihan WHERE penghuni_id = ? AND bulan = '2019-12'").get(penghuni.body.id)!.n, 0);
  assert.equal(hitungJatuhTempo('2020-01-31', '2027-02'), '2027-02-28');
  assert.equal(hitungJatuhTempo('2020-01-31', '2028-02'), '2028-02-29');
  assert.equal(hitungJatuhTempo('2020-01-31', '2026-04'), '2026-04-30');
});

test('Sprint 3: pendaftaran penghuni dan tagihannya rollback bersama jika penyimpanan tagihan gagal', async (t) => {
  const kamar = await call('POST', '/kamar', { nomor: 'ROLLBACK', tipe: 'AC', harga: 1100000 });
  db.exec(`CREATE TEMP TRIGGER test_gagal_tagihan BEFORE INSERT ON tagihan
    WHEN (SELECT nama FROM penghuni WHERE id = NEW.penghuni_id) = 'Uji Rollback'
    BEGIN SELECT RAISE(ABORT, 'TEST_BILL_FAILURE'); END;`);
  t.mock.method(console, 'error', () => {});
  try {
    const result = await call('POST', '/penghuni', {
      nama: 'Uji Rollback', no_hp: '081234567890', kamar_id: kamar.body.id, tanggal_masuk: '2026-10-10',
    });
    assert.equal(result.status, 500);
    assert.equal((await call('GET', `/kamar/${kamar.body.id}`)).body.status, 'Kosong');
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM penghuni WHERE nama = 'Uji Rollback'").get()!.n, 0);
  } finally { db.exec('DROP TRIGGER test_gagal_tagihan'); }
});

test('Sprint 3: parameter periode, nominal, dan tanggal kalender yang tidak valid ditolak', async () => {
  for (const bulan of ['2026-13', '2026-00', '0000-01', '2026-1', 202610, null, {}]) {
    assert.equal((await call('POST', '/tagihan/generate', { bulan })).status, 422, JSON.stringify(bulan));
  }
  assert.equal((await call('GET', '/tagihan?bulan=2026-99')).status, 422);
  assert.equal((await call('GET', '/tagihan/rekap?bulan=2026-99')).status, 422);
  assert.equal((await call('GET', '/tagihan?bulan=2026-10&bulan=2026-11')).status, 422);
  assert.equal((await call('GET', '/tagihan?status=TidakValid')).status, 422);
  const bill = generateTagihanBulan('2027-01').tagihan.find((row) => row.penghuni_id === tPenghuni1Id)!;
  for (const date of ['2027-02-29', '2026-04-31', null, 20261010]) {
    assert.equal((await call('PATCH', `/tagihan/${bill.id}/lunas`, { tanggal_bayar: date })).status, 422);
  }
  for (const jumlah of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, true, [1], {}]) {
    assert.equal((await call('POST', `/tagihan/${bill.id}/pembayaran`, { jumlah })).status, 422);
  }
  assert.equal((await call('GET', `/tagihan/${bill.id}/pembayaran`)).body.length, 0);
});

test('Sprint 3: request pembayaran bersamaan tidak boleh melebihi nominal tagihan', async () => {
  const bill = generateTagihanBulan('2027-02').tagihan.find((row) => row.penghuni_id === tPenghuni2Id)!;
  const results = await Promise.all([
    call('POST', `/tagihan/${bill.id}/pembayaran`, { jumlah: 600000 }),
    call('POST', `/tagihan/${bill.id}/pembayaran`, { jumlah: 600000 }),
  ]);
  assert.deepEqual(results.map((result) => result.status).sort(), [201, 422]);
  const updated = (await call('GET', `/tagihan/${bill.id}`)).body;
  assert.equal(updated.terbayar, 600000);
  assert.equal(updated.sisa, 300000);
  assert.throws(() => db.prepare('INSERT INTO pembayaran (tagihan_id, jumlah, tanggal_bayar) VALUES (?, ?, ?)')
    .run(bill.id as number, 400000, '2027-02-15'), /PEMBAYARAN_MELEBIHI_SISA/);
  assert.equal((await call('GET', `/tagihan/${bill.id}/pembayaran`)).body.length, 1);
});

test('Sprint 3: tagihan berbayar dan kamar terkait tidak boleh menghapus riwayat keuangan', async () => {
  const before = (await call('GET', `/tagihan/${tagihan1Id}/pembayaran`)).body;
  assert.equal((await call('DELETE', `/tagihan/${tagihan1Id}`)).status, 409);
  assert.equal((await call('PATCH', `/penghuni/${tPenghuni1Id}/keluar`)).status, 200);
  const bill = (await call('GET', `/tagihan/${tagihan1Id}`)).body;
  assert.equal((await call('DELETE', `/kamar/${bill.kamar_id}`)).status, 409);
  assert.deepEqual((await call('GET', `/tagihan/${tagihan1Id}/pembayaran`)).body, before);
  assert.equal((await call('GET', `/tagihan/${tagihan1Id}`)).body.status, 'Lunas');
});

test('Sprint 3: rekap dan dashboard konsisten dengan pembayaran aktual serta sisa', async () => {
  const bulan = tanggalJakarta().slice(0, 7);
  const summary = (await call('GET', `/tagihan/rekap?bulan=${bulan}`)).body;
  const dashboard = (await call('GET', '/ringkasan')).body;
  assert.equal(summary.total_nominal, summary.nominal_lunas + summary.nominal_belum_lunas);
  assert.equal(dashboard.tagihan_bulan, bulan);
  assert.equal(dashboard.tagihan_nominal_lunas, summary.nominal_lunas);
  assert.equal(dashboard.tagihan_nominal_belum_lunas, summary.nominal_belum_lunas);
  assert.equal(dashboard.tagihan_belum_lunas, summary.total_belum_lunas);
});
