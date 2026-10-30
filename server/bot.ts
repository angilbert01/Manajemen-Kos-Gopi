// EP-05 WBS 5.1-5.2: chatbot penagihan. Logika tidak bergantung platform; server/telegram.ts menyambungkannya ke Telegram.
import { db } from './db.ts';
import { getTagihan } from './app.ts';
import { buatLinkPembayaran, PembayaranError } from './pembayaran-online.ts';

type Row = Record<string, unknown>;
export type Tombol = { teks: string; url?: string; data?: string };
export type Kirim = (chatId: string, teks: string, tombol?: Tombol[]) => Promise<void>;
/** Pesan masuk yang sudah dinormalkan: teks biasa, atau data tombol yang ditekan. */
export type PesanMasuk = { chatId: string; teks?: string; data?: string };

const rp = (n: unknown) => `Rp ${Number(n).toLocaleString('id-ID')}`;
const namaKos = () =>
  ((db.prepare('SELECT nama_kos FROM admin_profile WHERE aktif = 1 LIMIT 1').get() as Row | undefined)?.nama_kos as string) || 'Kos Gopi';

const penghuniDariChat = (chatId: string) =>
  db.prepare('SELECT id, nama, kamar_id FROM penghuni WHERE chat_id = ?').get(chatId) as Row | undefined;

const tagihanTerbuka = (penghuniId: number) =>
  (db.prepare(`SELECT id FROM tagihan WHERE penghuni_id = ? AND status = 'Belum Lunas' ORDER BY bulan ASC`).all(penghuniId) as { id: number }[])
    .map((r) => getTagihan(r.id) as Row);

const BANTUAN = [
  'Perintah yang tersedia:',
  '/tagihan — lihat tagihan yang belum lunas',
  '/bayar — bayar tagihan secara online',
  '/putus — putuskan akun chat ini dari data penghuni',
].join('\n');

/** Kode 6 digit sekali pakai yang diberikan pemilik kos kepada penghuni untuk menghubungkan chat. */
export function buatKodeHubung(penghuniId: number) {
  for (let i = 0; i < 20; i++) {
    const kode = String(Math.floor(100000 + Math.random() * 900000));
    try {
      db.prepare('UPDATE penghuni SET kode_hubung = ? WHERE id = ?').run(kode, penghuniId);
      return kode;
    } catch (err) {
      if (!(err instanceof Error && err.message.includes('kode_hubung'))) throw err;
    }
  }
  throw new Error('Gagal membuat kode unik.');
}

async function kirimDaftarTagihan(chatId: string, penghuniId: number, kirim: Kirim, untukBayar: boolean) {
  const daftar = tagihanTerbuka(penghuniId);
  if (!daftar.length) return kirim(chatId, 'Tidak ada tagihan yang belum lunas. Terima kasih!');
  if (untukBayar && daftar.length === 1) return kirimLinkBayar(chatId, penghuniId, daftar[0]!.id as number, kirim);
  const baris = daftar.map((t) => `• ${t.kamar_nomor} periode ${t.bulan}: sisa ${rp(t.sisa)}, jatuh tempo ${t.jatuh_tempo}`);
  return kirim(chatId, `Tagihan belum lunas:\n${baris.join('\n')}\n\nPilih tagihan yang ingin dibayar:`,
    daftar.map((t) => ({ teks: `Bayar ${t.bulan} (${rp(t.sisa)})`, data: `bayar:${t.id}` })));
}

async function kirimLinkBayar(chatId: string, penghuniId: number, tagihanId: number, kirim: Kirim) {
  const t = getTagihan(tagihanId) as Row | undefined;
  if (!t || t.penghuni_id !== penghuniId) return kirim(chatId, 'Tagihan tidak ditemukan.');
  try {
    const trx = await buatLinkPembayaran(tagihanId);
    return kirim(chatId, `Tagihan ${t.kamar_nomor} periode ${t.bulan} sebesar ${rp(trx.jumlah)}.\nSilakan bayar lewat tombol di bawah. Status akan diperbarui otomatis setelah pembayaran berhasil.`,
      [{ teks: `Bayar ${rp(trx.jumlah)}`, url: trx.payment_url as string }]);
  } catch (err) {
    if (err instanceof PembayaranError) return kirim(chatId, err.message);
    throw err;
  }
}

/** Tangani satu pesan masuk. */
export async function tanganiPesan({ chatId, teks = '', data }: PesanMasuk, kirim: Kirim) {
  const penghuni = penghuniDariChat(chatId);
  const perintah = teks.trim().toLowerCase();

  const hubung = /^\/?hubung\s+(\d{6})$/i.exec(teks.trim());
  if (hubung) {
    const p = db.prepare('SELECT id, nama FROM penghuni WHERE kode_hubung = ? AND aktif = 1').get(hubung[1]) as Row | undefined;
    if (!p) return kirim(chatId, 'Kode tidak valid atau sudah dipakai. Minta kode baru ke pemilik kos.');
    db.prepare('UPDATE penghuni SET chat_id = NULL WHERE chat_id = ?').run(chatId);
    db.prepare('UPDATE penghuni SET chat_id = ?, kode_hubung = NULL WHERE id = ?').run(chatId, p.id as number);
    return kirim(chatId, `Terhubung sebagai ${p.nama}. Anda akan menerima pengingat tagihan di sini.\n\n${BANTUAN}`);
  }

  if (!penghuni) {
    return kirim(chatId, `Halo! Ini bot tagihan ${namaKos()}.\nUntuk mulai, minta kode 6 digit ke pemilik kos lalu kirim:\n/hubung 123456`);
  }
  const pid = penghuni.id as number;

  if (data?.startsWith('bayar:')) return kirimLinkBayar(chatId, pid, Number(data.slice(6)), kirim);
  if (perintah === '/putus') {
    db.prepare('UPDATE penghuni SET chat_id = NULL WHERE id = ?').run(pid);
    return kirim(chatId, 'Akun chat ini sudah diputus dari data penghuni.');
  }
  // Kenali perintah bayar dalam bahasa sehari-hari juga ("mau bayar", "bayar kos").
  if (perintah === '/bayar' || /\bbayar\b/.test(perintah)) return kirimDaftarTagihan(chatId, pid, kirim, true);
  if (perintah === '/tagihan' || /\btagihan\b/.test(perintah)) return kirimDaftarTagihan(chatId, pid, kirim, false);
  return kirim(chatId, `Halo ${penghuni.nama}!\n${BANTUAN}`);
}

/** Kirim pengingat H-3/H-0/terlambat ke penghuni yang chat-nya terhubung. Mengembalikan jumlah terkirim. */
export async function kirimPengingatChat(daftar: Row[], kirim: Kirim) {
  let terkirim = 0;
  for (const t of daftar) {
    const p = db.prepare('SELECT chat_id FROM penghuni WHERE id = ? AND chat_id IS NOT NULL').get(t.penghuni_id as number) as Row | undefined;
    if (!p) continue;
    const kapan = t.pengingat === 'Terlambat' ? `sudah terlambat ${-(t.hari as number)} hari` : t.pengingat === 'H-0' ? 'jatuh tempo hari ini' : 'jatuh tempo 3 hari lagi';
    await kirim(p.chat_id as string, `Pengingat ${namaKos()}: tagihan ${t.kamar_nomor} periode ${t.bulan} sebesar ${rp(t.sisa)} ${kapan} (${t.jatuh_tempo}).`,
      [{ teks: `Bayar ${rp(t.sisa)}`, data: `bayar:${t.id}` }]);
    terkirim++;
  }
  return terkirim;
}

/** Konfirmasi ke penghuni setelah pembayaran online tercatat. */
export async function kirimKonfirmasiBayar(tagihan: Row, kirim: Kirim) {
  const p = db.prepare('SELECT chat_id FROM penghuni WHERE id = ? AND chat_id IS NOT NULL').get(tagihan.penghuni_id as number) as Row | undefined;
  if (!p) return;
  const sisa = tagihan.sisa as number;
  await kirim(p.chat_id as string, `Pembayaran diterima untuk ${tagihan.kamar_nomor} periode ${tagihan.bulan}. ${sisa > 0 ? `Sisa tagihan ${rp(sisa)}.` : 'Tagihan sudah LUNAS. Terima kasih!'}`);
}
