// EP-05 WBS 5.1-5.5: chatbot penagihan + pembayaran online (mode simulasi, tanpa layanan luar).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

delete process.env.MIDTRANS_SERVER_KEY;
const dir = mkdtempSync(join(tmpdir(), 'kos-chatbot-'));
process.env.DB_PATH = join(dir, 'test.db');
const { migrate, db } = await import('./db.ts');
const { createApp } = await import('./app.ts');
const { tanganiPesan, kirimPengingatChat } = await import('./bot.ts');
const { petaStatusMidtrans, signatureValid, terapkanStatus, hooks } = await import('./pembayaran-online.ts');
const { tanggalJakarta } = await import('./dates.ts');
type Tombol = { teks: string; url?: string; data?: string };

let server: Server;
let base = '';
before(() => {
  migrate();
  server = createApp().listen(0);
  base = `http://localhost:${(server.address() as AddressInfo).port}/api`;
  process.env.PUBLIC_URL = `http://localhost:${(server.address() as AddressInfo).port}`;
});
after(() => { server.close(); db.close(); rmSync(dir, { recursive: true, force: true }); });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const call = async (method: string, path: string, body?: unknown): Promise<{ status: number; body: any }> => {
  const r = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  return { status: r.status, body: text.startsWith('{') || text.startsWith('[') ? JSON.parse(text) : text };
};

const pesan: { chatId: string; teks: string; tombol?: Tombol[] }[] = [];
const kirim = async (chatId: string, teks: string, tombol?: Tombol[]) => { pesan.push({ chatId, teks, tombol }); };
const kirimDan = async (chatId: string, input: { teks?: string; data?: string }) => {
  pesan.length = 0;
  await tanganiPesan({ chatId, ...input }, kirim);
  return pesan[pesan.length - 1]!;
};

let penghuniId = 0;
let tagihanId = 0;
const bulan = tanggalJakarta().slice(0, 7);

test('setup: penghuni aktif dengan satu tagihan bulan berjalan', async () => {
  const k = await call('POST', '/kamar', { nomor: 'B01', tipe: 'AC', harga: 1000000 });
  const p = await call('POST', '/penghuni', { nama: 'Budi', no_hp: '081211112222', kamar_id: k.body.id, tanggal_masuk: tanggalJakarta() });
  penghuniId = p.body.id;
  tagihanId = (await call('GET', `/tagihan?bulan=${bulan}`)).body.find((t: { penghuni_id: number }) => t.penghuni_id === penghuniId).id;
  assert.ok(tagihanId);
});

test('TC-Bot-01 chat belum terhubung hanya mendapat petunjuk, tidak melihat tagihan', async () => {
  const r = await kirimDan('900', { teks: '/tagihan' });
  assert.match(r.teks, /\/hubung/);
  assert.doesNotMatch(r.teks, /Rp/);
});

test('TC-Bot-02 kode hubung dari panel menautkan chat; kode salah/dipakai ulang ditolak', async () => {
  const k = await call('POST', `/penghuni/${penghuniId}/kode-chat`);
  assert.equal(k.status, 200);
  assert.match(k.body.kode, /^\d{6}$/);
  assert.match((await kirimDan('900', { teks: '/hubung 000000' })).teks, /tidak valid/);
  assert.match((await kirimDan('900', { teks: `/hubung ${k.body.kode}` })).teks, /Terhubung sebagai Budi/);
  assert.match((await kirimDan('901', { teks: `/hubung ${k.body.kode}` })).teks, /tidak valid/, 'kode sekali pakai');
  const daftar = (await call('GET', '/penghuni')).body as { id: number; chat_terhubung: number }[];
  assert.equal(daftar.find((p) => p.id === penghuniId)!.chat_terhubung, 1);
  assert.ok(!('chat_id' in daftar[0]!) && !('kode_hubung' in daftar[0]!), 'chat_id/kode tidak dibocorkan API');
});

test('TC-Bot-03 /tagihan menampilkan rincian; "mau bayar kos" dikenali sebagai perintah bayar', async () => {
  const t = await kirimDan('900', { teks: '/tagihan' });
  assert.match(t.teks, /B01/);
  assert.match(t.teks, /Rp 1\.000\.000/);
  assert.equal(t.tombol?.[0]?.data, `bayar:${tagihanId}`);
  const b = await kirimDan('900', { teks: 'mau bayar kos' });
  assert.match(b.tombol?.[0]?.url ?? '', /\/api\/pembayaran-online\/simulasi\/KOS-/);
});

test('TC-Bot-04 link bayar dipakai ulang selama nominal sama (tidak ada dua link aktif)', async () => {
  const a = await call('POST', `/tagihan/${tagihanId}/link-bayar`);
  const b = await call('POST', `/tagihan/${tagihanId}/link-bayar`);
  assert.equal(a.status, 201);
  assert.equal(a.body.order_id, b.body.order_id);
  assert.equal(a.body.provider, 'simulasi');
});

test('TC-Bot-05 tagihan penghuni lain tidak bisa dibayar lewat tombol', async () => {
  const k = await call('POST', '/kamar', { nomor: 'B02', tipe: 'AC', harga: 900000 });
  const p = await call('POST', '/penghuni', { nama: 'Lain', no_hp: '081233334444', kamar_id: k.body.id, tanggal_masuk: tanggalJakarta() });
  const lain = (await call('GET', `/tagihan?bulan=${bulan}`)).body.find((t: { penghuni_id: number }) => t.penghuni_id === p.body.id);
  const r = await kirimDan('900', { data: `bayar:${lain.id}` });
  assert.match(r.teks, /tidak ditemukan/);
});

test('TC-Bayar-01 pembayaran simulasi berhasil -> Lunas di panel, konfirmasi terkirim, idempoten', async () => {
  const konfirmasi: unknown[] = [];
  hooks.berhasil = (t) => { konfirmasi.push(t); };
  const { order_id } = (await call('POST', `/tagihan/${tagihanId}/link-bayar`)).body;
  const halaman = await call('GET', `/pembayaran-online/simulasi/${order_id}`);
  assert.match(halaman.body, /Bayar \(simulasi\)/);
  const r = await fetch(`${base}/pembayaran-online/simulasi/${order_id}`, { method: 'POST' });
  assert.equal(r.status, 200);
  const t = (await call('GET', `/tagihan/${tagihanId}`)).body;
  assert.equal(t.status, 'Lunas');
  assert.equal(t.metode_pembayaran, 'Online (Simulasi)');
  assert.equal(konfirmasi.length, 1);
  terapkanStatus(order_id, 'berhasil');
  assert.equal((await call('GET', `/tagihan/${tagihanId}/pembayaran`)).body.length, 1, 'notifikasi ganda tidak mencatat dua kali');
  assert.equal((await call('POST', `/tagihan/${tagihanId}/link-bayar`)).status, 409, 'tagihan lunas tidak bisa dibuatkan link');
  assert.equal((await call('GET', `/tagihan/${tagihanId}/transaksi-online`)).body[0].status, 'berhasil');
});

test('TC-Bayar-02 uang online masuk setelah tagihan dilunasi tunai -> perlu_refund, tidak melebihi nominal', async () => {
  const k = await call('POST', '/kamar', { nomor: 'B03', tipe: 'AC', harga: 800000 });
  const p = await call('POST', '/penghuni', { nama: 'Cici', no_hp: '081255556666', kamar_id: k.body.id, tanggal_masuk: tanggalJakarta() });
  const t = (await call('GET', `/tagihan?bulan=${bulan}`)).body.find((x: { penghuni_id: number }) => x.penghuni_id === p.body.id);
  const { order_id } = (await call('POST', `/tagihan/${t.id}/link-bayar`)).body;
  await call('PATCH', `/tagihan/${t.id}/lunas`, {});
  assert.equal(terapkanStatus(order_id, 'berhasil').status, 'perlu_refund');
  assert.equal((await call('GET', `/tagihan/${t.id}`)).body.terbayar, 800000);
});

test('TC-Bayar-03 notifikasi Midtrans hanya diterima dengan signature yang benar', async () => {
  const body = { order_id: 'X-1', status_code: '200', gross_amount: '1000.00' };
  const sig = createHash('sha512').update(`X-12001000.00rahasia`).digest('hex');
  assert.equal(signatureValid({ ...body, signature_key: sig }, 'rahasia'), true);
  assert.equal(signatureValid({ ...body, signature_key: sig }, 'kunci-lain'), false);
  assert.equal(signatureValid({ ...body, signature_key: sig }, ''), false);
  const r = await call('POST', '/pembayaran-online/notifikasi', { ...body, transaction_status: 'settlement', signature_key: 'palsu' });
  assert.equal(r.status, 403);
  assert.equal(petaStatusMidtrans('settlement'), 'berhasil');
  assert.equal(petaStatusMidtrans('capture', 'challenge'), 'pending');
  assert.equal(petaStatusMidtrans('expire'), 'kedaluwarsa');
  assert.equal(petaStatusMidtrans('deny'), 'gagal');
});

test('TC-Bot-06 pengingat H-0 terkirim hanya ke penghuni yang chat-nya terhubung; /putus memutus', async () => {
  pesan.length = 0;
  const daftar = [
    { id: tagihanId, penghuni_id: penghuniId, kamar_nomor: 'B01', bulan, sisa: 1000000, jatuh_tempo: tanggalJakarta(), pengingat: 'H-0', hari: 0 },
    { id: 999, penghuni_id: 999999, kamar_nomor: 'X', bulan, sisa: 1, jatuh_tempo: tanggalJakarta(), pengingat: 'H-0', hari: 0 },
  ];
  assert.equal(await kirimPengingatChat(daftar, kirim), 1);
  assert.match(pesan[0]!.teks, /jatuh tempo hari ini/);
  assert.match((await kirimDan('900', { teks: '/putus' })).teks, /diputus/);
  assert.equal(await kirimPengingatChat(daftar, kirim), 0);
});
