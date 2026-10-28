# **Dokumen BA & QA Sprint 3 - Kos Gopi**

Disusun untuk: BA & QA (Dewa) · Tim Pengembang (Angilbert & Akhmad) · PM (Hasan) | Proyek: Manajemen Kos Gopi  
Periode Sprint: **22 Oktober 2026 – 28 Oktober 2026** (Sprint 3)  
Deliverable: **2.0 Sistem Tagihan Bulanan & Status Pembayaran** (WBS 2.1 – 2.3)

---

## **1. Ringkasan Deliverable Sprint 3**

| Epic | User Story | WBS | Penanggung Jawab | Estimasi | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **EP-02** | **US-01:** Generate tagihan bulanan otomatis | 2.1 | Angilbert Yohanes Sirait (BE) | 5h | **Deployed** |
| **EP-02** | **US-02:** Dashboard rekap tagihan (sederhana & HP-friendly) | 2.2 | Akhmad Syafiul Anam (FE) | 6h | **Deployed** |
| **EP-02** | **US-03:** Update konfirmasi pembayaran lunas | 2.3 | Akhmad Syafiul Anam & Angilbert (FE & BE) | 4h | **Deployed** |

---

## **2. User Story & Kriteria Penerimaan (Acceptance Criteria)**

### **EP-02 US-01: Generate Tagihan Bulanan Otomatis (WBS 2.1)**
> **Sebagai** pemilik kos,  
> **saya ingin** tagihan bulanan terbuat otomatis berdasarkan harga kamar yang terisi,  
> **agar** tidak perlu lagi merekap dan menghitung manual setiap bulan.

* **Kriteria Selesai (Acceptance Criteria):**
  1. *Given* ada penghuni kos yang aktif menghuni kamar pada bulan berjalan, *When* proses generate dipicu (atau saat penghuni baru didaftarkan), *Then* tagihan dibuat otomatis dengan nominal persis sesuai harga sewa kamar yang terisi.
  2. *Given* tagihan bulan berjalan untuk seorang penghuni sudah dibuat, *When* generate tagihan dipanggil kembali untuk bulan yang sama, *Then* sistem tidak membuat tagihan ganda (*idempotent*, dijamin oleh *unique index* `ux_tagihan_penghuni_bulan`).
  3. Jatuh tempo dihitung secara otomatis berdasarkan tanggal masuk penghuni pada bulan target.

### **EP-02 US-02: Dashboard Rekap Tagihan (WBS 2.2)**
> **Sebagai** pemilik kos,  
> **saya ingin** dashboard rekap tagihan yang sederhana dan mudah dicek lewat HP (permintaan klien Gopi),  
> **agar** saya cepat tahu siapa yang sudah bayar dan siapa yang perlu ditagih.

* **Kriteria Selesai (Acceptance Criteria):**
  1. Halaman menampilkan ringkasan total nominal ditagihkan, total nominal lunas (terkumpul), dan total nominal tertunggak (belum lunas) secara akurat.
  2. Daftar tagihan memisahkan penghuni "Lunas" dan "Belum Lunas" dengan status yang jelas dan kontras warna yang mudah dibaca.
  3. Tampilan responsif optimal di layar HP (*viewport* 360 px ke atas), tanpa elemen yang terpotong atau *overflow* horizontal.
  4. Tersedia tombol pengingat cepat via WhatsApp (*1-click WhatsApp reminder*) dengan pesan pengingat sopan yang otomatis terisi.

### **EP-02 US-03: Update Konfirmasi Pembayaran Lunas (WBS 2.3)**
> **Sebagai** pemilik kos,  
> **saya ingin** mengubah status tagihan menjadi "Lunas" setelah penghuni membayar,  
> **agar** rekap selalu akurat dan saya bisa menerbitkan bukti kuitansi.

* **Kriteria Selesai (Acceptance Criteria):**
  1. *Given* tagihan berstatus "Belum Lunas", *When* pemilik menekan tombol "Tandai Lunas" dan mengonfirmasi tanggal serta metode pembayaran, *Then* status tagihan diperbarui menjadi "Lunas", tanggal bayar tercatat, dan nominal tertunggak berkurang seketika.
  2. Tersedia opsi pembatalan/undo ("Batal Lunas") jika terjadi kesalahan input atau salah klik.
  3. Tersedia fitur cetak / unduh kuitansi digital resmi Kos Gopi untuk tagihan yang telah lunas.

---

## **3. QA Test Plan & Hasil Pengujian Otomatis (Automated Test Suite)**

Pengujian otomatis dijalankan melalui test runner Node.js (`npm run test:api`) pada file `server/api.test.ts`.

### **Matriks Hasil Pengujian API & Backend**

| ID Test | Skenario Uji | Modul / WBS | Hasil Diharapkan | Status | Waktu Eksekusi |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-Tagihan-01** | Generate tagihan bulanan otomatis berdasarkan harga kamar terisi | WBS 2.1 | Tagihan terbuat dengan nominal kamar terisi & jatuh tempo presisi | **PASS** | 5.4 ms |
| **TC-Tagihan-02** | Idempotency generate tagihan | WBS 2.1 | Panggilan kedua melewati tagihan yang ada, tidak ada duplikat | **PASS** | 2.2 ms |
| **TC-Tagihan-03** | Rekap tagihan lunas vs belum lunas & nominal | WBS 2.2 | Total nominal & pemisahan daftar cocok dengan database | **PASS** | 1.9 ms |
| **TC-Tagihan-04** | Update konfirmasi pembayaran lunas | WBS 2.3 | Status menjadi 'Lunas', tanggal bayar & metode tersimpan | **PASS** | 4.4 ms |
| **TC-Tagihan-05** | Filter tagihan status Lunas dan Belum Lunas | WBS 2.2 | Filter API mengembalikan data sesuai status yang diminta | **PASS** | 3.2 ms |
| **TC-Tagihan-06** | Batal status lunas (opsi undo) | WBS 2.3 | Status kembali 'Belum Lunas' & tanggal bayar menjadi null | **PASS** | 3.9 ms |

*Total pengujian API (TC-01 s/d TC-07 Sprint 1-2 + TC-Tagihan-01 s/d TC-Tagihan-06 Sprint 3 + Admin CRUD):* **16/16 lulus (100%)** dalam waktu < 0.5 detik.

---

## **4. Pengujian UI & Responsivitas HP (Mobile Viewport 360–375 px)**

Sesuai permintaan khusus klien Gopi (*wawancara inisiasi*): dashboard rekap harus nyaman dioperasikan dari layar ponsel pemilik kos saat sedang mengecek kos.

| Skenario Pengujian UI | Langkah Uji | Hasil Aktual | Status |
| :--- | :--- | :--- | :--- |
| **Uji HP 375 px (Dashboard)** | Buka dashboard rekap tagihan pada lebar 375 px | Kartu rekap (Total, Lunas, Belum Lunas) tertata rapi, tombol tab mudah disentuh | **LULUS** |
| **Uji HP: Tombol Tandai Lunas** | Tekan tombol 'Tandai Lunas' pada kartu tagihan | Modal pop-up responsif, form pengisian tanggal & metode bayar pas di layar | **LULUS** |
| **Uji HP: Tab Filter** | Beralih tab antara "Belum Lunas", "Sudah Lunas", dan "Semua" | Transisi instan, tidak ada lonjakan tata letak (*layout shift*) | **LULUS** |
| **Uji Halaman Tagihan Lengkap** | Buka halaman 'Tagihan' dari sidebar / link navigasi | Toolbar filter bulan, tabel/kartu data, dan modal kuitansi berfungsi penuh | **LULUS** |
| **Uji Kuitansi Digital** | Tekan tombol 'Kuitansi' pada tagihan lunas | Format kuitansi resmi Kos Gopi tampil rapi lengkap dengan tombol cetak | **LULUS** |

---

## **5. BA: Checklist Validasi & Serah Terima Klien**

| Butir Validasi Klien | Kriteria | Hasil Validasi |
| :--- | :--- | :--- |
| **Otomasi Tagihan** | Tagihan tidak perlu direkap manual per kamar | **Disetujui** (terbuat otomatis saat registrasi & via tombol generate) |
| **Kemudahan Cek di HP** | Rekap nominal lunas vs belum lunas terbaca jelas dalam 1 layar | **Disetujui** (kartu ringkasan + tab segmented) |
| **Pencatatan Pelunasan** | Pemilik bisa menandai lunas saat penghuni transfer atau bayar tunai | **Disetujui** (modal konfirmasi dengan pilihan metode transfer/tunai) |
| **Pencegahan Human Error** | Bisa membatalkan tanda lunas jika salah klik | **Disetujui** (tombol Batal Lunas tersedia) |

Dokumen ini menyatakan bahwa seluruh kriteria penerimaan **Sprint 3 (Deliverable 2.0)** telah terpenuhi dan siap diuji coba ke tahap operasional.
