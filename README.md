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
| `npm run test:api` | Uji API kamar, penghuni, tagihan, pembayaran, tanggal WIB, dan startup |
| `npm run test:web` | Uji utilitas frontend |
| `npm run build` | Typecheck frontend/backend + build frontend |

Database: `server/data/kos.db` (otomatis dibuat & di-migrate, tidak di-commit). Gunakan `DB_PATH` untuk database demo/pengujian terpisah.

## Struktur

```
server/
  migrations/001–005  kamar, penghuni, admin, tagihan, cicilan, perlindungan pembayaran
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
| POST · PUT · DELETE | `/api/kamar[/:id]` | Kelola kamar (409 bila nomor duplikat, kamar terisi, atau memiliki riwayat tagihan) |
| GET | `/api/penghuni[?semua=1]` | Penghuni aktif (atau + riwayat) |
| POST | `/api/penghuni` | Registrasi → kamar otomatis "Terisi" |
| PATCH | `/api/penghuni/:id/keluar` | Catat keluar → kamar "Kosong" |
| POST | `/api/tagihan/generate` | Buat tagihan periode `{ "bulan": "2026-11" }`; aman diulang |
| GET | `/api/tagihan?bulan=&status=&q=` | Daftar dan filter tagihan; status Lunas, Belum Lunas, atau Dicicil |
| GET | `/api/tagihan/rekap?bulan=` | Total ditagihkan, pembayaran diterima, sisa, dan daftar lunas/belum lunas |
| PATCH | `/api/tagihan/:id/lunas` | Catat pembayaran sebesar sisa tagihan, tanggal, metode, dan catatan |
| GET · POST | `/api/tagihan/:id/pembayaran` | Riwayat pembayaran / catat cicilan `{ "jumlah": 300000 }` |
| DELETE | `/api/pembayaran/:id` | Koreksi satu pembayaran; status dan sisa dihitung ulang |
| PATCH | `/api/tagihan/:id/batal` | Batalkan seluruh pembayaran pada tagihan; status kembali Belum Lunas |
| DELETE | `/api/tagihan/:id` | Hanya tagihan tanpa pembayaran yang dapat dihapus |

## Sprint 3: tagihan dan pembayaran

Buka **Tagihan** dari sidebar atau lonceng notifikasi. Pilih periode, lalu **Buat Tagihan** bila perlu. Cari penghuni, filter status, dan tekan **Catat Bayar** untuk pembayaran penuh atau sebagian. **Kuitansi** menampilkan rincian transaksi dan dapat dicetak/disimpan sebagai PDF melalui dialog cetak browser. Tombol WhatsApp hanya menyiapkan pesan; pengguna tetap menekan kirim di WhatsApp.

- Nominal tagihan memakai harga kamar saat tagihan dibuat; perubahan harga tidak mengubah tagihan sebelumnya. Tarif sebulan penuh, tanpa prorata.
- Jatuh tempo mengikuti tanggal masuk; tanggal 29–31 disesuaikan dengan hari terakhir bulan target.
- Registrasi menyimpan penghuni, status kamar, dan tagihan dalam satu transaksi. Tagihan bulan masuk dibuat; untuk pencatatan penghuni lama, periode berjalan juga disiapkan. Bulan di antaranya tidak diisi otomatis.
- `npm run dev` / `npm run start:api` memeriksa tagihan periode berjalan saat startup dan setiap jam berdasarkan **Asia/Jakarta (WIB)**. Server harus berjalan agar pemeriksaan berkala aktif. Jika server mati melewati satu periode, periode yang terlewat dapat dibuat lewat tombol Buat Tagihan.
- Unique index mencegah tagihan ganda. Pembayaran tidak boleh melebihi sisa, termasuk pada level database. Rekap pembayaran diterima termasuk cicilan; sisa = total ditagihkan − pembayaran diterima.
- Kamar yang memiliki tagihan tidak dapat dihapus. Tagihan dengan pembayaran juga dilindungi dari penghapusan. Koreksi pembayaran tetap tersedia melalui undo dengan konfirmasi di UI.
- Dashboard membedakan potensi sewa kamar terisi dari rekap pembayaran aktual. Notifikasi memakai jumlah tagihan belum lunas bulan berjalan.

Pengujian otomatis belum menggantikan UAT klien atau pemeriksaan visual HP dan hasil cetak di browser. Autentikasi, keluhan, pengingat terjadwal ke penghuni, dan payment gateway berada di luar perubahan Sprint 3 ini. Deployment produksi belum dikonfigurasi.
