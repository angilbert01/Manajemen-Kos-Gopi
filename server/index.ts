import { createApp, daftarPengingat, generateTagihanBulan } from './app.ts';
import { DB_PATH, migrate } from './db.ts';
import { tanggalJakarta } from './dates.ts';
import { kirimKonfirmasiBayar, kirimPengingatChat, tanganiPesan } from './bot.ts';
import type { Kirim } from './bot.ts';
import { hooks, periksaTransaksiPending, providerAktif } from './pembayaran-online.ts';
import { jalankanPolling, kirimTelegram } from './telegram.ts';

const applied = migrate();
if (applied.length) console.log(`[db] migration dijalankan: ${applied.join(', ')}`);

const PORT = Number(process.env.PORT ?? 3001);
const app = createApp();

// EP-05 WBS 5.1: chatbot Telegram aktif bila token diisi di .env (long polling, tanpa URL publik).
const TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? '';
const kirim: Kirim | null = TOKEN ? kirimTelegram(TOKEN) : null;
if (kirim) {
  void jalankanPolling(TOKEN, (pesan) => tanganiPesan(pesan, kirim));
  // WBS 5.4: penghuni langsung menerima konfirmasi saat pembayaran online tercatat.
  hooks.berhasil = (tagihan) => { kirimKonfirmasiBayar(tagihan, kirim).catch((err) => console.error('[telegram] konfirmasi gagal', err)); };
}
console.log(`[chatbot] ${kirim ? 'Telegram aktif' : 'nonaktif (isi TELEGRAM_BOT_TOKEN di .env)'} · pembayaran online: ${providerAktif()}`);

// Aman diulang: unique index menjaga satu tagihan per penghuni/periode.
// Jalankan saat startup dan tiap jam agar tetap bekerja tanpa membuka halaman web.
const generateBulanBerjalan = () => {
  try {
    const result = generateTagihanBulan(tanggalJakarta().slice(0, 7));
    if (result.dibuat) console.log(`[tagihan] ${result.dibuat} tagihan dibuat untuk ${result.bulan}.`);
  } catch (err) {
    console.error('[tagihan] Gagal membuat tagihan; akan dicoba lagi pada pemeriksaan berikutnya.', err);
  }
};
// WBS 4.1: sekali per hari (WIB) picu pengingat H-3/H-0/terlambat. Terkirim lewat chatbot ke penghuni yang
// chat-nya terhubung; sisanya lewat tombol WhatsApp di halaman Tagihan.
let tanggalPengingat = '';
const picuPengingat = async () => {
  const hariIni = tanggalJakarta();
  if (hariIni === tanggalPengingat) return;
  try {
    const daftar = daftarPengingat(hariIni);
    tanggalPengingat = hariIni;
    const hitung = (k: string) => daftar.filter((t) => t.pengingat === k).length;
    const terkirim = kirim ? await kirimPengingatChat(daftar, kirim) : 0;
    console.log(`[pengingat] ${hariIni}: ${hitung('H-3')} H-3, ${hitung('H-0')} H-0, ${hitung('Terlambat')} terlambat; ${terkirim} terkirim via chat.`);
  } catch (err) {
    console.error('[pengingat] Gagal menyusun pengingat; akan dicoba lagi pada pemeriksaan berikutnya.', err);
  }
};
const tiapJam = () => {
  generateBulanBerjalan();
  void picuPengingat();
};
tiapJam();
setInterval(tiapJam, 60 * 60 * 1000).unref();

// WBS 5.4: tanpa URL publik notifikasi Midtrans tidak sampai, jadi status transaksi pending dicek tiap menit.
setInterval(() => {
  periksaTransaksiPending()
    .then((n) => { if (n) console.log(`[bayar] ${n} transaksi online diperbarui.`); })
    .catch((err) => console.error('[bayar] Gagal memeriksa status Midtrans.', err instanceof Error ? err.message : err));
}, 60 * 1000).unref();

// Belum ada login: API hanya didengarkan dari komputer ini (web Vite mem-proxy /api). Set HOST=0.0.0.0 bila sengaja dibuka.
const HOST = process.env.HOST ?? '127.0.0.1';
app.listen(PORT, HOST, () => {
  console.log(`[api] Kos Gopi API jalan di http://${HOST}:${PORT} (db: ${DB_PATH})`);
});
