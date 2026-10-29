# Redesign Tampilan ala shadcn-admin · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ganti tampilan frontend dari port react-reduction menjadi gaya shadcn-admin tanpa mengubah perilaku, data, atau backend.

**Architecture:** Tailwind v4 + komponen shadcn/ui (di-generate ke `src/components/ui/`). `src/components.tsx` tetap jadi lapisan komponen proyek (nama export sama) tapi dibangun di atas shadcn. Shell dipecah: `src/main.tsx` (state + provider) dan `src/app-sidebar.tsx` (sidebar). Navigasi tetap berbasis state `nav`/`go`.

**Tech Stack:** React 19, Vite 7, TypeScript 5.8, Tailwind CSS v4 (`@tailwindcss/vite`), shadcn/ui (style new-york, base color zinc), Radix, `lucide-react`, `sonner`.

**Spec:** `docs/superpowers/specs/2026-10-29-shadcn-redesign-design.md`

## Global Constraints

- Tampilan saja: state, panggilan `api.*`, validasi lokal, dan teks UI (Bahasa Indonesia) tidak berubah kecuali disebut di task.
- Tidak menambah router, dark mode toggle, ⌘K, AlertDialog, atau test otomatis FE.
- Backend (`server/`) tidak disentuh; `npm run test:api` harus tetap lolos.
- `<select>` tetap native, distyle dengan kelas yang sama seperti `Input` shadcn; value `""` untuk "Semua ..." tetap.
- Konfirmasi hapus tetap `window.confirm`.
- Signature `notify(message: string): void` dan `go(page, action?, kamarId?)` tidak berubah.
- Font Inter lewat Google Fonts `@import` di `src/index.css` (pola yang sama dengan Poppins sekarang, tanpa dependency font).
- Tidak ada test runner FE. Bukti tiap task = `npm run build` lolos + cek manual yang ditulis di task.
- **Data asli tidak boleh disentuh.** `server/data/kos.db` (beserta `-shm`/`-wal`) tidak boleh dihapus, di-seed, atau diubah lewat UI. Semua uji manual memakai database terpisah lewat env `DB_PATH` (sudah didukung `server/db.ts:7`; folder `server/data/` sudah di-gitignore):
  - DB uji berisi data: `DB_PATH=server/data/uji/kos.db npm run db:seed`, lalu `DB_PATH=server/data/uji/kos.db npm run dev`.
  - DB uji kosong: `DB_PATH=server/data/uji-kosong/kos.db npm run dev`.
  - Untuk reset, hapus folder `server/data/uji*` saja.
  - `npm run test:api` sudah memakai DB sementara sendiri (`server/api.test.ts:26`), jadi aman.
  - Di akhir eksekusi, timestamp dan ukuran `server/data/kos.db` harus sama dengan sebelum Task 1.

## Review Focus

1. **Layar HP 375px**: tidak boleh ada scroll horizontal di halaman. Tabel boleh scroll di dalam wadahnya sendiri, dan sidebar sheet harus tertutup setelah menu dipilih. Dicek di Task 3, 5, 6, dan 7.
2. **Database kosong (tanpa `db:seed`)**: semua halaman tampil dengan pesan kosong, `Stat` menampilkan `–`, dan progress tidak boleh `NaN%`. Dicek di Task 2 dan 7.
3. **`avatar_url` admin kosong atau rusak**: `Avatar` menampilkan inisial nama, bukan ikon gambar rusak. Dicek di Task 3 dan 6.
4. **Nama atau nomor kamar panjang** (≥40 karakter): teks terpotong `truncate` di kartu dan tidak merusak grid. Dicek di Task 4 dan 7.
5. **Keyboard**: `IconWidget` bisa difokus (ring terlihat) dan diaktifkan dengan Enter, dialog tertutup dengan Escape, dan fokus kembali ke tombol pemicu. Dicek di Task 2 dan 4.

---

### Task 1: Fondasi Tailwind v4 + shadcn

**Files:**
- Modify: `package.json`, `vite.config.ts`, `tsconfig.json`, `tsconfig.app.json`, `src/main.tsx:14`
- Create: `components.json`, `src/index.css`, `src/lib/utils.ts`, `src/components/ui/*`, `src/hooks/use-mobile.ts`

**Interfaces:**
- Produces: alias `@/*` → `src/*`; `cn(...inputs: ClassValue[]): string` dari `@/lib/utils`; komponen shadcn `button card input label dialog badge table dropdown-menu sidebar separator tooltip avatar sonner progress breadcrumb alert` (sidebar ikut membawa `sheet skeleton` + `use-mobile`).

- [ ] **Step 0: Catat kondisi data asli**
  Run: `ls -l --time-style=full-iso server/data/kos.db*` dan simpan hasilnya untuk dibandingkan di Task 8.
- [ ] **Step 1: Pasang Tailwind**
  Run: `npm i tailwindcss @tailwindcss/vite lucide-react`
- [ ] **Step 2: Alias + plugin**
  `vite.config.ts`: tambah `tailwindcss()` ke `plugins` dan `resolve.alias: { '@': path.resolve(import.meta.dirname, './src') }`. Proxy `/api` tetap.
  `tsconfig.json` dan `tsconfig.app.json`: `compilerOptions.baseUrl: "."`, `paths: { "@/*": ["./src/*"] }`.
- [ ] **Step 3: `src/index.css` awal**
  Isi: `@import url(Google Fonts Inter 400;500;600;700)` lalu `@import "tailwindcss";`. Di `src/main.tsx` impor `./index.css` **sebelum** `./style.css`. `style.css` lama tetap dipakai sampai Task 8, jadi tampilan transisi boleh agak berantakan.
- [ ] **Step 4: Init shadcn**
  Run: `npx shadcn@latest init --base-color zinc`. Jawab style new-york bila ditanya, dan biarkan `src/index.css` diisi token. Setelah selesai, set `--font-sans: 'Inter', ui-sans-serif, system-ui, sans-serif;` di blok `@theme inline`.
- [ ] **Step 5: Generate komponen**
  Run: `npx shadcn@latest add button card input label dialog badge table dropdown-menu sidebar separator tooltip avatar sonner progress breadcrumb alert`
- [ ] **Step 6: Verifikasi**
  Run: `npm run build`. Expected: lolos tanpa error TS.
  Run: `npm run dev`. Expected: aplikasi masih terbuka dan semua halaman masih bisa diklik.
- [ ] **Step 7: Commit**
  `git add package.json package-lock.json vite.config.ts tsconfig.json tsconfig.app.json components.json src/index.css src/lib src/components/ui src/hooks src/main.tsx` lalu `git commit -m "build: pasang Tailwind v4 + shadcn/ui"`

---

### Task 2: Komponen proyek di atas shadcn

**Files:**
- Modify: `src/components.tsx` (tulis ulang), `src/pages/Dashboard.tsx:142-176,361-383` (call site `Stat`/`IconWidget`), dan semua impor ikon `Md*` yang dioper ke `IconWidget`

**Interfaces:**
- Consumes: `Card*`, `Progress`, `Label`, `Dialog*`, `Badge` dari `@/components/ui/*`; `cn` dari `@/lib/utils`.
- Produces (export dari `src/components.tsx`):
  - `Stat({ title: string; value: ReactNode; hint: ReactNode; progress?: number /* default 75 */; progressLabel?: ReactNode })`: prop `color` dan `icon` dihapus.
  - `IconWidget({ Icon: LucideIcon; title: ReactNode; subtitle: ReactNode; onClick?: () => void })`: prop `bgColor` dihapus. Dirender sebagai `<button type="button">` bila `onClick` ada, selain itu `<div>`.
  - `Field({ label, error?, hint?, children })`: API tetap. Pakai `Label`, error `text-sm text-destructive` dengan `role="alert"`.
  - `Modal({ title, onClose, children })`: API tetap. `<Dialog open onOpenChange={(o) => !o && onClose()}>` + `DialogContent` + `DialogHeader/DialogTitle`.
  - `StatusPill({ status: 'Kosong' | 'Terisi' })`: Kosong = `Badge variant="outline"` dengan titik `bg-emerald-500`, Terisi = `Badge variant="secondary"`.
  - `selectClass: string`: kelas Tailwind yang sama dengan `Input` shadcn (h-9, rounded-md, border-input, px-3, text-sm, focus-visible ring) untuk `<select>` native.
  - `Complaint` dan `ThemeColor` dihapus.

- [ ] **Step 1: Tulis ulang `src/components.tsx`** sesuai Interfaces. `Stat` memakai clamp yang sama (`Math.max(0, Math.min(100, Math.round(progress)))`), dengan tambahan `Number.isFinite(progress) ? … : 0` agar tidak menghasilkan `NaN%`.
- [ ] **Step 2: Perbarui call site di Dashboard**: hapus prop `color`/`bgColor`. Ganti ikon `MdBusiness`, `MdPersonAdd`, `MdViewModule` menjadi lucide `Building2`, `UserPlus`, `LayoutGrid`.
- [ ] **Step 3: Verifikasi**
  Run: `npm run build`. Expected: lolos.
  Manual (DB uji kosong, lihat Global Constraints): kartu Stat menampilkan `–` dan `0%`, bukan `NaN%`. Tekan Tab sampai ke kartu aksi cepat: ring fokus terlihat, dan Enter membuka dialog Tambah Kamar. Escape menutup dialog.
- [ ] **Step 4: Commit**: `git commit -am "refactor(ui): komponen proyek memakai shadcn"`

---

### Task 3: Shell (sidebar, header, toast)

**Files:**
- Create: `src/app-sidebar.tsx`
- Modify: `src/main.tsx` (tulis ulang JSX shell; logika `nav`, `go`, `loadAdmin`, dan `READY` tetap)

**Interfaces:**
- Consumes: `Sidebar*`, `useSidebar`, `DropdownMenu*`, `Avatar*`, `Breadcrumb*`, `Input`, `Button`, `Badge`, `Toaster` + `toast` dari `sonner`.
- Produces: `AppSidebar({ page: string; go: (page: string) => void; admin: AdminProfile | null })` di `src/app-sidebar.tsx`.
  - `navItems` dipindah ke file ini dengan ikon lucide: Dashboard=`LayoutDashboard`, Kamar=`BedDouble`, Penghuni=`Users`, Tagihan=`Receipt`, Keluhan=`MessageSquareWarning`. "Profil Admin" pindah ke dropdown footer.
  - Setiap klik menu memanggil `go(name)` lalu `setOpenMobile(false)` (dari `useSidebar`). Ini menggantikan cek `window.innerWidth < 768`.
  - `SidebarMenuButton isActive={page === name} tooltip={name}`.
  - Header: logo `/img/logo_200.png` + `admin?.nama_kos || 'Kos Gopi'`.
  - Footer: `Avatar` (`AvatarImage src={admin?.avatar_url}`, `AvatarFallback` = inisial dari `admin?.nama ?? 'Gopi'`) + nama + peran, membuka `DropdownMenu` berisi email, lalu item "Profil Admin", "Data Kamar", "Data Penghuni".

- [ ] **Step 1: Buat `src/app-sidebar.tsx`** sesuai Interfaces, dengan `<Sidebar collapsible="icon">`.
- [ ] **Step 2: Tulis ulang shell `src/main.tsx`**
  - `notify = (m: string) => toast(m)`. Hapus state `toast`, `timer`, `sidebarOpen`, dan `userOpen`.
  - Struktur: `<SidebarProvider><AppSidebar …/><SidebarInset>` → header `h-14 border-b` berisi `SidebarTrigger`, `Separator` vertikal, input cari (`type="search"`, perilaku `onFocus`/`onSubmit` lama ke Kamar), dan `Button variant="ghost" size="icon"` ikon `Bell` dengan badge `4` yang memanggil `notify('4 tagihan belum dibayar bulan ini.')`.
  - `<main className="p-4 md:p-6">` berisi `h1 text-2xl font-semibold tracking-tight` + `Breadcrumb` (Home › page) + halaman (render kondisional lama tetap) + kartu "Modul … dijadwalkan pada Sprint berikutnya." untuk yang belum READY.
  - `<Toaster />` di akhir. Footer lama dan atribut `data-image` dihapus.
- [ ] **Step 3: Verifikasi**
  Run: `npm run build`. Expected: lolos.
  Manual desktop: sidebar bisa diciutkan menjadi ikon dan tooltip muncul. Klik Tagihan memunculkan toast. Dropdown avatar menuju Profil Admin.
  Manual 375px (DevTools): trigger membuka sheet, memilih menu menutup sheet, dan tidak ada scroll horizontal.
  Manual: kosongkan `avatar_url` admin di Profil → sidebar menampilkan inisial.
- [ ] **Step 4: Commit**: `git add src/app-sidebar.tsx src/main.tsx && git commit -m "feat(ui): shell sidebar + header ala shadcn-admin"`

---

### Task 4: Halaman Kamar

**Files:**
- Modify: `src/pages/Kamar.tsx` (markup `KamarPage` + `KamarModal`)

**Interfaces:**
- Consumes: `Field`, `Modal`, `StatusPill`, `selectClass` (Task 2); `Card*`, `Button`, `Input`, `Alert`; lucide `Plus`, `BedDouble`.

- [ ] **Step 1: Toolbar.** `Card` berisi baris `flex flex-col gap-2 sm:flex-row`: `Input` cari (`flex-1`), 2 `<select className={selectClass}>`, dan `Button` (ikon `Plus`) "Tambah Kamar". Ringkasan jumlah di bawahnya `text-sm text-muted-foreground`, angka kosong `text-emerald-600`.
- [ ] **Step 2: Grid kartu.** `grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`. Tiap kartu: foto `aspect-video object-cover rounded-t-xl` atau placeholder `bg-muted` + `BedDouble`. Nomor `font-semibold truncate` + `StatusPill`, tipe muted, harga `text-lg font-semibold` + "/ bulan" muted, baris penghuni `truncate`, tombol `size="sm"` (Isi Penghuni = default, Ubah = `outline`, Hapus = `outline` + `text-destructive`). Kartu Terisi tidak diberi warna khusus.
- [ ] **Step 3: Error/kosong/loading.** `Alert variant="destructive"`. Kartu muted `py-10 text-center` dengan teks lama.
- [ ] **Step 4: `KamarModal`.** Form `grid gap-4`. Baris tipe+harga `grid sm:grid-cols-2 gap-4`. `Input` untuk teks/angka/url, `<select className={selectClass}>` untuk tipe. Aksi `flex justify-end gap-2` (Batal `outline`, Simpan default).
- [ ] **Step 5: Verifikasi**
  Run: `npm run build`. Expected: lolos.
  Manual (DB uji berisi data): tambah kamar → toast muncul. Ubah harga lalu simpan. Simpan dengan nomor duplikat → pesan 409 muncul di dialog. Hapus kamar kosong lewat confirm. Filter status dan harga bekerja. Buat kamar bernomor 40 karakter → teks terpotong dan grid tetap rapi. Escape menutup dialog dan fokus kembali ke tombol pemicu.
- [ ] **Step 6: Commit**: `git commit -am "feat(ui): halaman Kamar ala shadcn"`

---

### Task 5: Halaman Penghuni

**Files:**
- Modify: `src/pages/Penghuni.tsx`

**Interfaces:**
- Consumes: `Field`, `selectClass`; `Card*`, `Table*`, `Button`, `Input`, `Badge`, `Alert`.

- [ ] **Step 1: Ubah markup.** Form registrasi di `Card` (`CardHeader` + `CardTitle`), tabel di `Card` memakai `Table`/`TableHeader`/`TableRow`/`TableCell`. Nama `font-medium` + no HP muted di bawahnya. Tombol aksi `size="sm" variant="outline"`. `<select>` native pakai `selectClass`. Kelas Bootstrap yang tersisa diganti utilitas Tailwind.
- [ ] **Step 2: Verifikasi**
  Run: `npm run build`. Expected: lolos.
  Manual: dari kartu kamar Kosong klik "Isi Penghuni" → halaman Penghuni terbuka dengan kamar terpilih. Simpan → kamar jadi Terisi. "Catat keluar" → kamar kembali Kosong. Toggle riwayat (`semua=1`) tetap jalan. Di 375px tabel scroll di dalam kartu, bukan seluruh halaman.
- [ ] **Step 3: Commit**: `git commit -am "feat(ui): halaman Penghuni ala shadcn"`

---

### Task 6: Halaman Profil Admin

**Files:**
- Modify: `src/pages/Profil.tsx` (`ProfilPage` + `TambahAdminModal`)

**Interfaces:**
- Consumes: `Field`, `Modal`; `Card*`, `Table*`, `Avatar*`, `Button`, `Input`, `Badge`, `Alert`; lucide `Plus`, `Pencil`, `Trash2`, `CheckCircle2` (pengganti `MdAdd`, `MdEdit`, `MdDelete`, `MdCheckCircle`).

- [ ] **Step 1: Ubah markup.** Kartu profil aktif berisi `Avatar` besar (`size-16`, fallback inisial) + form ubah. Tabel daftar admin pakai `Table` dengan `Avatar` kecil (`size-8`). Badge "Aktif" `secondary` + ikon `CheckCircle2`. Modal tambah memakai pola form Task 4.
- [ ] **Step 2: Verifikasi**
  Run: `npm run build`. Expected: lolos.
  Manual: tambah admin, aktifkan, ubah nama dan nama kos → sidebar ikut berubah (via `onProfileChanged`). Hapus admin non-aktif. Admin dengan `avatar_url` kosong → inisial tampil di tabel dan sidebar.
- [ ] **Step 3: Commit**: `git commit -am "feat(ui): halaman Profil Admin ala shadcn"`

---

### Task 7: Dashboard

**Files:**
- Modify: `src/pages/Dashboard.tsx` (markup baris 2–4 + modal; baris 1 dan 3 sudah disentuh di Task 2)

**Interfaces:**
- Consumes: semua dari Task 2; pola kartu kamar Task 4; pola tabel Task 5; `Progress`; lucide `Plus`, `BedDouble`.

- [ ] **Step 1: Grid.**
  - Baris 1: `grid gap-4 sm:grid-cols-2 lg:grid-cols-4`.
  - Baris 2: `grid gap-4 lg:grid-cols-3`. Katalog `lg:col-span-2`, form daftar penghuni di sisi kanan.
  - Baris 3: `grid gap-4 sm:grid-cols-3`.
  - Baris 4: `grid gap-4 lg:grid-cols-3`. Tabel `lg:col-span-2`, distribusi tipe di sisi kanan.
- [ ] **Step 2: Isi kartu.** Katalog ringkas memakai markup kartu kamar Task 4 versi kecil (foto `aspect-[16/9]`, `grid sm:grid-cols-2 xl:grid-cols-3`). Header kartu: `CardTitle` + ringkasan muted + tombol `size="sm"`. Distribusi tipe pakai `Progress`. Daftar terisi/kosong/total pakai baris `flex justify-between text-sm` + `Badge`. Tombol `btn-link` diganti `Button variant="link"`.
- [ ] **Step 3: Verifikasi**
  Run: `npm run build`. Expected: lolos.
  Manual (DB uji berisi data): angka Stat sesuai `/api/ringkasan`. Daftarkan penghuni dari form Dashboard → katalog dan tabel ter-refresh. Kartu aksi cepat menuju halaman yang benar. DB uji kosong: semua kartu menampilkan pesan kosong. Di 375px tidak ada scroll horizontal.
- [ ] **Step 4: Commit**: `git commit -am "feat(ui): Dashboard ala shadcn"`

---

### Task 8: Bersih-bersih + verifikasi akhir

**Files:**
- Delete: `src/style.css`, `public/img/sidebar-4.jpg`
- Modify: `src/main.tsx` (hapus `import './style.css'`), `package.json` (hapus `react-icons`), `README.md` (baris stack + struktur `src/`)

- [ ] **Step 1: Hapus sisa gaya lama.** Hapus file dan impor di atas, lalu jalankan `npm uninstall react-icons`. Di README, perbarui stack menjadi "React 19 + Vite + Tailwind v4 + shadcn/ui" dan sesuaikan struktur `src/` (`components/ui/`, `app-sidebar.tsx`, `index.css`).
- [ ] **Step 2: Grep sisa kelas lama**
  Run: `grep -rnE "cr-|btn-|form-control|badge-|react-icons|d-flex|text-muted\b" src`
  Expected: tidak ada hasil. Hasil di dalam `src/components/ui/` diabaikan.
- [ ] **Step 3: Build + test API**
  Run: `npm run build`. Expected: lolos.
  Run: `npm run test:api`. Expected: semua TC lolos.
- [ ] **Step 4: Uji manual penuh** di desktop dan 375px pada DB uji, sesuai daftar di spec bagian 3 poin 4. Setelah itu cek `server/data/kos.db`: timestamp dan ukurannya harus sama dengan catatan sebelum Task 1.
- [ ] **Step 5: Commit**: `git add -A src public README.md package.json package-lock.json && git commit -m "chore(ui): hapus style lama react-reduction"`
