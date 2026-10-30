import { createApp, generateTagihanBulan } from './app.ts';
import { DB_PATH, migrate } from './db.ts';
import { tanggalJakarta } from './dates.ts';

const applied = migrate();
if (applied.length) console.log(`[db] migration dijalankan: ${applied.join(', ')}`);

const PORT = Number(process.env.PORT ?? 3001);
const app = createApp();
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
generateBulanBerjalan();
setInterval(generateBulanBerjalan, 60 * 60 * 1000).unref();
app.listen(PORT, () => {
  console.log(`[api] Kos Gopi API jalan di http://localhost:${PORT} (db: ${DB_PATH})`);
});
