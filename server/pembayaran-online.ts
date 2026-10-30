// EP-05 WBS 5.3-5.4: link pembayaran online (Midtrans Snap sandbox, atau simulasi tanpa akun)
// dan sinkronisasi status ke tagihan/panel admin.
import { createHash, randomBytes } from 'node:crypto';
import { db, transaction } from './db.ts';
import { tanggalJakarta } from './dates.ts';
import { getTagihan, syncStatusTagihan } from './app.ts';

type Row = Record<string, unknown>;
type StatusTransaksi = 'pending' | 'berhasil' | 'gagal' | 'kedaluwarsa' | 'perlu_refund';

const serverKey = () => process.env.MIDTRANS_SERVER_KEY ?? '';
const isProduction = () => process.env.MIDTRANS_PRODUCTION === 'true';
const snapUrl = () => (isProduction() ? 'https://app.midtrans.com' : 'https://app.sandbox.midtrans.com') + '/snap/v1/transactions';
const apiUrl = () => (isProduction() ? 'https://api.midtrans.com' : 'https://api.sandbox.midtrans.com') + '/v2';
const basicAuth = () => 'Basic ' + Buffer.from(serverKey() + ':').toString('base64');
/** Alamat API yang bisa dibuka pembayar untuk mode simulasi. */
const publicUrl = () => (process.env.PUBLIC_URL ?? `http://127.0.0.1:${process.env.PORT ?? 3001}`).replace(/\/$/, '');

export const providerAktif = () => (serverKey() ? 'midtrans' : 'simulasi') as 'midtrans' | 'simulasi';

/** Dipanggil setelah pembayaran online berhasil dicatat (mis. kirim konfirmasi ke chat penghuni). */
export const hooks: { berhasil: (tagihan: Row) => void } = { berhasil: () => {} };

export class PembayaranError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Buat (atau pakai ulang) link bayar untuk sisa tagihan. */
export async function buatLinkPembayaran(tagihanId: number) {
  const t = getTagihan(tagihanId) as Row | undefined;
  if (!t) throw new PembayaranError(404, 'Tagihan tidak ditemukan.');
  const sisa = t.sisa as number;
  if (sisa <= 0) throw new PembayaranError(409, 'Tagihan ini sudah lunas.');

  const provider = providerAktif();
  // Link Snap berlaku 24 jam; pakai ulang selama nominal masih sama agar tidak ada dua link aktif.
  const lama = db.prepare(`SELECT * FROM transaksi_online
    WHERE tagihan_id = ? AND status = 'pending' AND provider = ? AND jumlah = ? AND created_at > datetime('now', '-23 hours')
    ORDER BY id DESC LIMIT 1`).get(tagihanId, provider, sisa) as Row | undefined;
  if (lama) return lama;

  const orderId = `KOS-${tagihanId}-${Date.now().toString(36)}${randomBytes(2).toString('hex')}`;
  let paymentUrl = `${publicUrl()}/api/pembayaran-online/simulasi/${orderId}`;
  if (provider === 'midtrans') {
    const res = await fetch(snapUrl(), {
      method: 'POST',
      headers: { Authorization: basicAuth(), 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        transaction_details: { order_id: orderId, gross_amount: sisa },
        item_details: [{ id: `TAGIHAN-${tagihanId}`, price: sisa, quantity: 1, name: `Sewa ${t.kamar_nomor} ${t.bulan}`.slice(0, 50) }],
        customer_details: { first_name: String(t.penghuni_nama).slice(0, 50), phone: t.penghuni_no_hp },
      }),
    });
    const body = (await res.json().catch(() => ({}))) as { redirect_url?: string; error_messages?: string[] };
    if (!res.ok || !body.redirect_url)
      throw new PembayaranError(502, `Gagal membuat link Midtrans: ${body.error_messages?.join('; ') ?? res.status}`);
    paymentUrl = body.redirect_url;
  }
  const r = db.prepare(`INSERT INTO transaksi_online (tagihan_id, order_id, provider, jumlah, payment_url)
    VALUES (?, ?, ?, ?, ?)`).run(tagihanId, orderId, provider, sisa, paymentUrl);
  return db.prepare('SELECT * FROM transaksi_online WHERE id = ?').get(r.lastInsertRowid) as Row;
}

/** Peta status Midtrans -> status transaksi kita. */
export function petaStatusMidtrans(transactionStatus: string, fraudStatus?: string): StatusTransaksi {
  if (transactionStatus === 'settlement') return 'berhasil';
  if (transactionStatus === 'capture') return fraudStatus === 'accept' || !fraudStatus ? 'berhasil' : 'pending';
  if (transactionStatus === 'expire') return 'kedaluwarsa';
  if (['cancel', 'deny', 'failure'].includes(transactionStatus)) return 'gagal';
  return 'pending';
}

/**
 * Terapkan status akhir transaksi. Idempoten: notifikasi ganda/polling berulang tidak mencatat pembayaran dua kali.
 * Bila tagihan sudah dibayar lewat cara lain sehingga uang online melebihi sisa, transaksi ditandai perlu_refund.
 */
export function terapkanStatus(orderId: string, statusBaru: StatusTransaksi) {
  const trx = db.prepare('SELECT * FROM transaksi_online WHERE order_id = ?').get(orderId) as Row | undefined;
  if (!trx) throw new PembayaranError(404, 'Transaksi tidak ditemukan.');
  if (trx.status !== 'pending' || statusBaru === 'pending') return trx;

  let berhasil = false;
  transaction(() => {
    if (statusBaru !== 'berhasil') {
      db.prepare(`UPDATE transaksi_online SET status = ?, updated_at = datetime('now') WHERE id = ?`).run(statusBaru, trx.id as number);
      return;
    }
    const t = getTagihan(trx.tagihan_id as number) as Row;
    if ((t.sisa as number) < (trx.jumlah as number)) {
      db.prepare(`UPDATE transaksi_online SET status = 'perlu_refund', updated_at = datetime('now') WHERE id = ?`).run(trx.id as number);
      return;
    }
    const metode = trx.provider === 'midtrans' ? 'Online (Midtrans)' : 'Online (Simulasi)';
    const p = db.prepare(`INSERT INTO pembayaran (tagihan_id, jumlah, tanggal_bayar, metode_pembayaran, catatan)
      VALUES (?, ?, ?, ?, ?)`).run(trx.tagihan_id as number, trx.jumlah as number, tanggalJakarta(), metode, `Order ${orderId}`);
    syncStatusTagihan(trx.tagihan_id as number);
    db.prepare(`UPDATE transaksi_online SET status = 'berhasil', pembayaran_id = ?, updated_at = datetime('now') WHERE id = ?`)
      .run(p.lastInsertRowid, trx.id as number);
    berhasil = true;
  });
  if (berhasil) {
    try { hooks.berhasil(getTagihan(trx.tagihan_id as number) as Row); } catch (err) { console.error('[bayar] hook gagal', err); }
  }
  return db.prepare('SELECT * FROM transaksi_online WHERE order_id = ?').get(orderId) as Row;
}

/** Verifikasi signature_key notifikasi Midtrans: sha512(order_id + status_code + gross_amount + server_key). */
export function signatureValid(body: Record<string, unknown>, key = serverKey()) {
  if (!key || typeof body.signature_key !== 'string') return false;
  const expected = createHash('sha512').update(`${body.order_id}${body.status_code}${body.gross_amount}${key}`).digest('hex');
  return expected === body.signature_key;
}

/** Cek ulang transaksi Midtrans yang masih pending (tanpa URL publik webhook tidak sampai saat lokal). */
export async function periksaTransaksiPending() {
  if (providerAktif() !== 'midtrans') return 0;
  const pending = db.prepare(`SELECT order_id FROM transaksi_online WHERE provider = 'midtrans' AND status = 'pending'`).all() as { order_id: string }[];
  let berubah = 0;
  for (const { order_id } of pending) {
    const res = await fetch(`${apiUrl()}/${order_id}/status`, { headers: { Authorization: basicAuth(), Accept: 'application/json' } });
    if (res.status === 404) continue; // pembayar belum memilih metode bayar
    const body = (await res.json().catch(() => ({}))) as { transaction_status?: string; fraud_status?: string };
    if (!body.transaction_status) continue;
    const status = petaStatusMidtrans(body.transaction_status, body.fraud_status);
    if (status !== 'pending') { terapkanStatus(order_id, status); berubah++; }
  }
  return berubah;
}

/** Halaman bayar tiruan untuk demo tanpa akun payment gateway. */
export function halamanSimulasi(orderId: string, selesai = false) {
  const trx = db.prepare('SELECT * FROM transaksi_online WHERE order_id = ?').get(orderId) as Row | undefined;
  const t = trx ? (getTagihan(trx.tagihan_id as number) as Row) : undefined;
  const esc = (v: unknown) => String(v).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  const rp = (n: unknown) => `Rp ${Number(n).toLocaleString('id-ID')}`;
  const isi = !trx || trx.provider !== 'simulasi'
    ? '<p>Transaksi tidak ditemukan.</p>'
    : trx.status !== 'pending' || selesai
      ? `<p>Status pembayaran: <b>${esc(trx.status)}</b>.</p><p>Anda dapat menutup halaman ini.</p>`
      : `<p>${esc(t?.penghuni_nama)} · ${esc(t?.kamar_nomor)} · periode ${esc(t?.bulan)}</p>
         <p style="font-size:1.6rem;font-weight:600">${rp(trx.jumlah)}</p>
         <form method="post"><button style="font:inherit;padding:.7rem 1.4rem;border-radius:.5rem;border:0;background:#18181b;color:#fff">Bayar (simulasi)</button></form>
         <p style="color:#71717a;font-size:.85rem">Mode simulasi: tidak ada uang yang ditarik.</p>`;
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Pembayaran Kos</title></head><body style="font-family:system-ui,sans-serif;max-width:420px;margin:3rem auto;padding:0 1rem">
<h1 style="font-size:1.2rem">Pembayaran sewa kos</h1>${isi}</body></html>`;
}
