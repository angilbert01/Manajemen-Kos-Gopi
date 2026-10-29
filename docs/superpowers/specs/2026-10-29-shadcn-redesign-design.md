# Redesign Tampilan ala shadcn-admin

Tanggal: 2026-10-29 · Penyusun: Akhmad (FE) · Status: disetujui di chat, menunggu review spec

## Tujuan

Mengganti tampilan frontend dari port template react-reduction (Poppins, foto sidebar, gradien, warna Bootstrap 4) menjadi gaya [shadcn-admin](https://github.com/satnaing/shadcn-admin): netral, rapi, tidak terkesan "AI slop", dan tetap nyaman dicek lewat HP (permintaan klien di Dokumen Inisiasi 1.5).

## Cakupan

**Termasuk:** tampilan saja. Halaman dan fitur tetap: Dashboard, Kamar, Penghuni, Profil Admin. Menu Tagihan dan Keluhan tetap memunculkan toast "Sprint berikutnya".

**Tidak termasuk:** router baru, dark mode toggle, command palette (⌘K), tabel dengan sort/filter/pagination, AlertDialog, perubahan backend/API, test otomatis FE.

## Pendekatan

Tailwind v4 + shadcn/ui asli (style `new-york`, base color `zinc`), ikon `lucide-react`. Dipilih daripada CSS manual (kemiripan ±80%, setiap komponen baru harus di-styling sendiri) dan Tailwind tanpa shadcn (membuat ulang yang sudah tersedia).

## Bagian 1 · Fondasi + shell

### Fondasi
- Tambah `tailwindcss` + `@tailwindcss/vite`; jalankan `npx shadcn init` (new-york, zinc).
- Alias `@/` → `src/` di `vite.config.ts`, `tsconfig.json`, `tsconfig.app.json`.
- Komponen shadcn yang di-generate ke `src/components/ui/`: `button card input label dialog badge table dropdown-menu sidebar separator tooltip avatar sonner progress breadcrumb alert`.
- `src/style.css` diganti `src/index.css` (token shadcn + font Inter). Hapus Poppins, `public/img/sidebar-4.jpg`, semua kelas `cr-*` dan kelas Bootstrap.
- Hapus `react-icons`, ganti `lucide-react`.

### Shell (`src/main.tsx`)
- Navigasi tetap berbasis state (`nav` / `go`), tanpa router.
- `SidebarProvider` + `Sidebar collapsible="icon"`:
  - Header sidebar: logo + nama kos (`admin.nama_kos`, default "Kos Gopi").
  - Grup "Umum": Dashboard, Kamar, Penghuni, Tagihan, Keluhan.
  - Footer sidebar: avatar + nama admin dengan `DropdownMenu` (Profil Admin, Data Kamar, Data Penghuni), menggantikan popover lama.
- Header atas: `SidebarTrigger`, input cari (fokus → lompat ke Kamar, perilaku lama), tombol notifikasi dengan badge.
- Judul halaman `h1` + `Breadcrumb` (Home › halaman).
- Footer "Template based on Reduction Admin" dihapus.
- Toast buatan sendiri diganti `sonner`; signature `notify(message: string)` tetap.
- Di HP sidebar menjadi sheet (bawaan komponen sidebar shadcn).

## Bagian 2 · Komponen bersama + halaman

### `src/components.tsx` (nama export tetap)
| Komponen | Sesudah |
| :-- | :-- |
| `Stat` | `Card`: judul kecil muted, angka `text-2xl font-semibold`, hint, `Progress`. Prop `color` dihapus. |
| `IconWidget` | `Card` putih, ikon lucide dalam kotak `bg-muted`, dirender sebagai `<button>` bila `onClick` ada. Prop `bgColor` dihapus. |
| `Field` | `Label` + child + error `text-destructive` (atau hint muted). API tetap. |
| `Modal` | Membungkus `Dialog`; API tetap (`title`, `onClose`, `children`). |
| `StatusPill` | `Badge`: Kosong = outline + titik hijau, Terisi = `secondary`. |
| `Complaint`, `ThemeColor` | Dihapus (tidak dipakai di luar `components.tsx`). |

### Select
Tetap `<select>` native yang distyle seperti `Input` (bukan Radix Select): filter memakai value `""` yang ditolak Radix Select, handler `onChange` tidak perlu diubah, dan HP mendapat picker native.

### Halaman (markup saja; state, API, validasi, teks tetap)
- **Dashboard:** baris 4 `Stat` (grid 1 / md:2 / lg:4) → katalog kamar ringkas + form daftar penghuni (2 kolom) → 3 kartu aksi cepat → tabel penghuni + distribusi tipe dengan `Progress`.
- **Kamar:** toolbar (cari, filter status, filter harga, tombol Tambah) di `Card` → grid kartu kamar dengan foto `aspect-video`, placeholder ikon `BedDouble`, tombol aksi `size="sm"`.
- **Penghuni / Profil:** `Table` shadcn, form di `Card`, avatar pakai `Avatar`.
- Error → `Alert variant="destructive"`. Kosong/loading → teks muted di tengah kartu.
- Konfirmasi hapus tetap `window.confirm`.

## Bagian 3 · Verifikasi

Dikerjakan di branch `feat/shadcn-ui`.

1. `npm run build` lolos (`tsc -b` + `vite build`).
2. `npm run test:api` tetap lolos (backend tidak disentuh).
3. Grep `cr-`, `btn-`, `form-control`, `badge-`, `react-icons` di `src/` kosong.
4. Uji manual `npm run db:seed` + `npm run dev`, lebar desktop dan 375px:
   - tambah / ubah / hapus kamar;
   - "Isi Penghuni" dari kartu kamar → form Penghuni terisi kamar → status kamar jadi Terisi;
   - catat keluar penghuni → kamar Kosong;
   - CRUD Profil Admin → nama/avatar di sidebar ikut berubah;
   - Escape menutup dialog; sidebar bisa diciutkan; toast muncul.

## Risiko

- Sekitar 10 dependency baru (tailwindcss, @tailwindcss/vite, paket Radix, class-variance-authority, clsx, tailwind-merge, lucide-react, sonner, tw-animate-css).
- Semua markup halaman ditulis ulang: regresi perilaku hanya tertangkap uji manual karena FE tidak punya test otomatis.
