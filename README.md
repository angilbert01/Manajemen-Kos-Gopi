# Manajemen Kos Gopi

Sistem manajemen kos (MPTI Kelompok 2). React 19 + Vite + Tailwind v4 + shadcn/ui (frontend) · Express 5 + SQLite bawaan Node (`node:sqlite`) (backend).

## Menjalankan

Butuh **Node.js ≥ 22.13** (disarankan 24).

```bash
npm install
npm run db:seed   # opsional: isi 12 kamar + 5 penghuni contoh
npm run dev       # API di :3001 + web di http://localhost:5173
```

| Script | Fungsi |
| :-- | :-- |
| `npm run dev` | Jalankan API + web sekaligus |
| `npm run test:api` | Uji API kamar, penghuni, tagihan, pembayaran, keluhan, pengingat, tanggal WIB, dan startup |
| `npm run test:web` | Uji utilitas frontend |
| `npm run build` | Typecheck frontend/backend + build frontend |

Database: `server/data/kos.db` (otomatis dibuat & di-migrate, tidak di-commit). Gunakan `DB_PATH` untuk database demo/pengujian terpisah.

## Struktur

```
server/
  migrations/001–007  kamar, penghuni, admin, tagihan, cicilan, perlindungan pembayaran, keluhan, integritas riwayat
  db.ts  app.ts  dates.ts  validation.ts  index.ts  seed.ts  *.test.ts
src/
  pages/  Dashboard.tsx  Kamar.tsx  Penghuni.tsx  Tagihan.tsx  Profil.tsx
  components/ui/  komponen shadcn/ui (tambah: npx shadcn@latest add <nama>)
  api.ts  components.tsx  app-sidebar.tsx  main.tsx  index.css
docs/skema-database.md   ERD & aturan status kamar
Konteks/                 dokumen proyek (inisiasi, backlog, sprint)
```

## API

| Method | Endpoint | Keterangan |
| :-- | :-- | :-- |
| GET | `/api/ringkasan` | Total / terisi / kosong |
| GET | `/api/kamar?status=&harga_max=&q=` | Katalog + filter |
| POST · PUT · DELETE | `/api/kamar[/:id]` | Kelola kamar (409 bila nomor duplikat, kamar terisi, atau memiliki riwayat tagihan/keluhan) |
| GET | `/api/penghuni[?semua=1]` | Penghuni aktif (atau + riwayat) |
| POST | `/api/penghuni` | Registrasi → kamar otomatis "Terisi"; 409 bila nomor HP masih aktif di kamar lain |
| PATCH | `/api/penghuni/:id/keluar` | Catat keluar → kamar "Kosong"; tanggal antara tanggal masuk dan hari ini |
| POST | `/api/tagihan/generate` | Buat tagihan periode `{ "bulan": "2026-11" }` (bulan berjalan atau sebelumnya); aman diulang |
| GET | `/api/tagihan?bulan=&status=&q=` | Daftar dan filter tagihan; status Lunas, Belum Lunas (termasuk dicicil), Belum Bayar, atau Dicicil |
| GET | `/api/tagihan/pengingat[?tanggal=]` | Tagihan belum lunas yang jatuh tempo H-3, H-0, atau sudah terlambat (WBS 4.1) |
| GET | `/api/tagihan/rekap?bulan=` | Total ditagihkan, pembayaran diterima, sisa, dan daftar lunas/belum lunas |
| PATCH | `/api/tagihan/:id/lunas` | Catat pembayaran sebesar sisa tagihan, tanggal, metode, dan catatan |
| GET · POST | `/api/tagihan/:id/pembayaran` | Riwayat pembayaran / catat cicilan `{ "jumlah": 300000 }` |
| DELETE | `/api/pembayaran/:id` | Koreksi satu pembayaran (ditandai batal, riwayat tetap tersimpan); status dan sisa dihitung ulang |
| PATCH | `/api/tagihan/:id/batal` | Batalkan seluruh pembayaran pada tagihan (ditandai batal); status kembali Belum Lunas |
| DELETE | `/api/tagihan/:id` | Hanya tagihan tanpa pembayaran yang dapat dihapus |
| GET | `/api/keluhan[/:id]`, `/api/keluhan/rekap` | Daftar, detail, dan rekap keluhan |
| POST | `/api/keluhan` | Lapor keluhan; penghuni harus penghuni aktif kamar tersebut |
| PATCH | `/api/keluhan/:id/status` | Alur berurutan Pending → Diproses → Selesai; Selesai dapat dibuka kembali ke Diproses. Keluhan tidak dapat dihapus |

API hanya mendengarkan `127.0.0.1` karena belum ada login; web Vite mem-proxy `/api`. Set `HOST=0.0.0.0` hanya bila sengaja dibuka ke jaringan.

## Sprint 3: tagihan dan pembayaran

Buka **Tagihan** dari sidebar atau lonceng notifikasi. Pilih periode, lalu **Buat Tagihan** bila perlu. Cari penghuni, filter status, dan tekan **Catat Bayar** untuk pembayaran penuh atau sebagian. **Kuitansi** menampilkan rincian transaksi dan dapat dicetak/disimpan sebagai PDF melalui dialog cetak browser. Tombol WhatsApp hanya menyiapkan pesan; pengguna tetap menekan kirim di WhatsApp.

- Nominal tagihan memakai harga kamar saat tagihan dibuat; perubahan harga tidak mengubah tagihan sebelumnya. Tarif sebulan penuh, tanpa prorata.
- Jatuh tempo mengikuti tanggal masuk; tanggal 29–31 disesuaikan dengan hari terakhir bulan target.
- Registrasi menyimpan penghuni, status kamar, dan tagihan dalam satu transaksi. Tagihan bulan berjalan dibuat (atau bulan masuk bila tanggal masuk di bulan depan). Penghuni lama yang baru dicatat tidak ditagih bulan-bulan sebelumnya; tunggakan lama dicatat manual lewat Buat Tagihan.
- `npm run dev` / `npm run start:api` memeriksa tagihan periode berjalan saat startup dan setiap jam berdasarkan **Asia/Jakarta (WIB)**. Server harus berjalan agar pemeriksaan berkala aktif. Jika server mati melewati satu periode, periode yang terlewat dapat dibuat lewat tombol Buat Tagihan.
- Unique index mencegah tagihan ganda. Pembayaran tidak boleh melebihi sisa, termasuk pada level database. Rekap pembayaran diterima termasuk cicilan; sisa = total ditagihkan − pembayaran diterima.
- Kamar yang memiliki tagihan tidak dapat dihapus. Tagihan dengan pembayaran juga dilindungi dari penghapusan. Koreksi pembayaran tetap tersedia melalui undo dengan konfirmasi di UI.
- Dashboard membedakan potensi sewa kamar terisi dari rekap pembayaran aktual. Notifikasi memakai jumlah tagihan belum lunas bulan berjalan.

Pengujian otomatis belum menggantikan UAT klien atau pemeriksaan visual HP dan hasil cetak di browser. Autentikasi, pengiriman pengingat otomatis (saat ini lewat tombol WhatsApp di halaman Tagihan), chatbot, dan payment gateway belum dibuat. Deployment produksi belum dikonfigurasi.

## Sprint 4–5: chatbot penagihan & pembayaran online (EP-05, WBS 5.1–5.4)

Salin `.env.example` menjadi `.env`, lalu isi:

| Variabel | Fungsi |
| :-- | :-- |
| `TELEGRAM_BOT_TOKEN` | Token bot dari @BotFather. Kosong = chatbot nonaktif. |
| `MIDTRANS_SERVER_KEY` | Server Key **sandbox** Midtrans. Kosong = mode simulasi (halaman bayar tiruan, tanpa uang). |

Alur:

1. Pemilik membuka **Penghuni → Kode Chatbot**, lalu memberi kode 6 digit kepada penghuni. Penghuni mengirim `/hubung 123456` ke bot. Kode hanya bisa dipakai sekali, sehingga orang lain tidak bisa mengaku sebagai penghuni.
2. Penghuni bisa mengirim `/tagihan`, `/bayar`, atau kalimat biasa seperti "mau bayar kos". Bot membalas dengan rincian tagihan dan tombol bayar (link Midtrans Snap atau halaman simulasi).
3. Setelah pembayaran berhasil, server mencatatnya sebagai pembayaran (metode `Online (Midtrans)` / `Online (Simulasi)`). Status tagihan berubah otomatis, halaman Tagihan memuat ulang tiap 15 detik, dan penghuni menerima konfirmasi lewat chat.
4. Pengingat H-3/H-0/terlambat dikirim otomatis sekali sehari ke penghuni yang chat-nya terhubung.

Catatan:

- Bot memakai long polling, jadi tidak butuh domain publik.
- Notifikasi Midtrans (`POST /api/pembayaran-online/notifikasi`, signature diverifikasi) baru bisa sampai bila API punya URL publik. Tanpa itu, server mengecek status transaksi pending tiap menit.
- Uang online yang masuk setelah tagihan sudah dilunasi dengan cara lain ditandai `perlu_refund`, tidak dicatat dobel.
- Link mode simulasi hanya bisa dibuka dari komputer server (API di `127.0.0.1`). Link Midtrans bisa dibuka dari HP.
