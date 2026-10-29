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
| `npm run test:api` | Uji API (TC-01 s/d TC-07 dokumen QA) |
| `npm run build` | Typecheck + build frontend |

Database: `server/data/kos.db` (otomatis dibuat & di-migrate, tidak di-commit). Hapus file ini untuk reset.

## Struktur

```
server/
  migrations/001_kamar_penghuni.sql  skema + trigger status kamar (WBS 1.1)
  db.ts  app.ts  validation.ts  index.ts  seed.ts  api.test.ts
src/
  pages/  Dashboard.tsx  Kamar.tsx (WBS 1.2)  Penghuni.tsx (WBS 1.3)  Profil.tsx
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
| POST · PUT · DELETE | `/api/kamar[/:id]` | Kelola kamar (409 bila nomor duplikat / kamar terisi) |
| GET | `/api/penghuni[?semua=1]` | Penghuni aktif (atau + riwayat) |
| POST | `/api/penghuni` | Registrasi → kamar otomatis "Terisi" |
| PATCH | `/api/penghuni/:id/keluar` | Catat keluar → kamar "Kosong" |
