# **Dokumen BA & QA Sprint 1 \- Kos Gopi**

Disusun untuk: BA & QA (Dewa) | Proyek: Manajemen Kos Gopi (ClickUp)

*Revisi 18/10/2026: nama dan isi Epic disamakan dengan Roadmap & Backlog (WBS 1.0–5.0), duplikasi isi dokumen dihapus, dan user story yang belum tercakup (EP-02 US-03, EP-03, EP-04, EP-05 US-01/04/05) ditambahkan. Detail kebutuhan tetap perlu dicocokkan dengan catatan wawancara klien (02/09/2026).*

| Epic | Nama (sesuai Roadmap) | WBS | Sprint |
| :---- | :---- | :---- | :---- |
| EP-01 | Sistem Manajemen Kamar & Penghuni | 1.0 | 1–2 |
| EP-02 | Sistem Tagihan Bulanan & Status Pembayaran | 2.0 | 3 |
| EP-03 | Sistem Manajemen Keluhan Fasilitas | 3.0 | 4 |
| EP-04 | Layanan Pengingat Jatuh Tempo & Dokumentasi Proyek | 4.0 | 4–5 |
| EP-05 | Chatbot Penagihan & Pembayaran Otomatis | 5.0 | 5–6 |

## **Penempatan di ClickUp**

Task PO T-01, PO T-02, QA Test Plan, dan BA Validasi tetap berada di list **Sprint 1**, karena di situlah pekerjaannya dihitung. Hasilnya ditaruh sebagai berikut:

| Hasil | Bentuk | Lokasi |
| :---- | :---- | :---- |
| User story \+ acceptance criteria | Satu user story \= satu task. Acceptance criteria ditulis di deskripsi task atau sebagai checklist | **Backlog**. Epic tetap di **Roadmap** |
| Test Plan & Test Case | ClickUp Doc, dilampirkan ke task QA di Sprint 1 | Doc di folder *2 Manajemen Kos Gopi*, lalu tautkan ke task |
| Catatan validasi klien | ClickUp Doc atau komentar di task BA | Sama seperti di atas |
| Template defect log | Format kosong | **Bugs**. Terisi saat ada temuan QA |

Bugs dan Sprint tidak dipakai untuk menyimpan dokumen. Bugs hanya untuk temuan cacat, Sprint hanya untuk task kerja.

## **1\. PO T-01: User Story per Epic**

Format: *Sebagai ..., saya ingin ..., agar ...*

### **EP-01 Sistem Manajemen Kamar & Penghuni (WBS 1.0)**

* **US-01 (WBS 1.1):** Sebagai pemilik kos, saya ingin data kamar dan penghuni tersimpan terstruktur, agar tidak lagi tercecer di catatan manual (zero-loss data).

* **US-02 (WBS 1.2):** Sebagai pemilik kos / calon penghuni, saya ingin melihat katalog kamar beserta statusnya di HP, agar tahu kamar mana yang kosong.

* **US-03 (WBS 1.3):** Sebagai pemilik kos, saya ingin mendaftarkan penghuni baru ke sebuah kamar dalam waktu kurang dari 2 menit, agar status kamar otomatis berubah menjadi "Terisi".

### **EP-02 Sistem Tagihan Bulanan & Status Pembayaran (WBS 2.0)**

* **US-01 (WBS 2.1):** Sebagai pemilik kos, saya ingin tagihan bulanan terbuat otomatis berdasarkan harga kamar yang terisi, agar tidak perlu direkap manual.

* **US-02 (WBS 2.2):** Sebagai pemilik kos, saya ingin dashboard rekap yang memisahkan penghuni lunas dan belum lunas, agar saya cepat tahu siapa yang perlu ditagih.

* **US-03 (WBS 2.3):** Sebagai pemilik kos, saya ingin mengubah status tagihan menjadi "Lunas" setelah penghuni membayar, agar rekap selalu akurat.

### **EP-03 Sistem Manajemen Keluhan Fasilitas (WBS 3.0)**

* **US-01 (WBS 3.1):** Sebagai penghuni kos, saya ingin mengirim keluhan fasilitas lewat form, agar laporan tercatat resmi.

* **US-02 (WBS 3.2):** Sebagai pemilik kos, saya ingin memperbarui status penanganan keluhan, agar penghuni tahu perkembangannya.

### **EP-04 Layanan Pengingat Jatuh Tempo & Dokumentasi Proyek (WBS 4.0)**

* **US-01 (WBS 4.1):** Sebagai pemilik kos, saya ingin sistem memicu pengingat tagihan H-3 dan H-0 secara otomatis, agar keterlambatan bayar berkurang.

* **US-02 (WBS 4.2):** Sebagai tim, kami ingin pengujian fungsional menyeluruh sebelum rilis, agar bug ditemukan sebelum klien memakai.

* **US-03 (WBS 4.3):** Sebagai pemilik kos dan penghuni, saya ingin buku panduan pengguna, agar bisa memakai sistem tanpa bantuan tim.

### **EP-05 Chatbot Penagihan & Pembayaran Otomatis (WBS 5.0)**

* **US-01 (WBS 5.1):** Sebagai tim, kami ingin chatbot terintegrasi dengan platform messaging, agar bisa menerima dan membalas pesan penghuni.

* **US-02 (WBS 5.2):** Sebagai penghuni, saya ingin menerima rincian tagihan dan bertanya lewat chatbot (info kamar, tagihan), agar tidak perlu menghubungi pemilik terus-menerus.

* **US-03 (WBS 5.3):** Sebagai penghuni, saya ingin membayar tagihan lewat payment gateway dari chatbot, agar pembayaran langsung tercatat (target MOV: ≥ 80% pembayaran via chatbot).

* **US-04 (WBS 5.4):** Sebagai pemilik kos, saya ingin status "Lunas" di panel admin berubah otomatis setelah pembayaran chatbot berhasil.

* **US-05 (WBS 5.5):** Sebagai tim, kami ingin pengujian end-to-end alur tagih – bayar – update status, agar alur chatbot bebas bug kritis.

## **2\. PO T-02: Acceptance Criteria & Prioritas**

Format singkat: *Given / When / Then*, sehingga bisa langsung diuji.

### **EP-01 US-01 (Data Kamar & Penghuni)**

* Given pemilik membuka data kamar, When menambah kamar dengan nomor, tipe, harga, dan status, Then data tersimpan dan muncul di daftar.

* Nomor kamar tidak boleh duplikat, dan sistem menampilkan pesan error bila duplikat.

* Satu penghuni hanya terhubung ke satu kamar aktif.

### **EP-01 US-02 (Katalog Kamar)**

* Katalog tampil dengan baik di layar HP (lebar 360 px ke atas).

* Kamar bisa difilter berdasarkan status (Kosong/Terisi) dan harga.

* Foto, harga, dan status tampil di tiap kartu kamar.

### **EP-01 US-03 (Registrasi Penghuni)**

* Form wajib berisi nama, nomor HP, kamar, dan tanggal masuk.

* Setelah simpan, status kamar berubah menjadi "Terisi".

* Kamar berstatus "Terisi" tidak bisa dipilih lagi di form.

### **EP-02 US-01 (Generate Tagihan)**

* Tagihan bulan berjalan terbuat otomatis untuk setiap penghuni aktif, dengan nominal sesuai harga kamar.

* Tidak ada tagihan ganda untuk penghuni dan bulan yang sama.

### **EP-02 US-02 (Dashboard Rekap)**

* Dashboard menampilkan daftar penghuni Lunas dan Belum Lunas dalam satu layar HP.

* Total nominal terbayar dan tertunggak tampil dan cocok dengan data tagihan.

* Antarmuka sederhana, bisa dipahami pemilik tanpa pelatihan (diverifikasi di UAT).

### **EP-02 US-03 (Konfirmasi Lunas)**

* Given tagihan berstatus Belum dibayar, When pemilik menekan "Tandai Lunas", Then status menjadi Lunas dan tanggal bayar tercatat.

### **EP-03 US-01 / US-02 (Keluhan)**

* Penghuni bisa mengirim keluhan berisi judul, deskripsi, dan kamar; keluhan tercatat dengan status awal Pending.

* Pemilik bisa mengubah status keluhan berurutan: Pending → Diproses → Selesai.

### **EP-04 US-01 (Pengingat)**

* Sistem memfilter tagihan belum lunas yang jatuh tempo tepat H-3 dan H-0 secara presisi.

### **EP-05 US-02 (Chatbot)**

* Chatbot menjawab minimal pertanyaan tentang ketersediaan kamar dan status tagihan.

* Pertanyaan di luar cakupan dijawab dengan pesan fallback yang sopan.

### **EP-05 US-03 / US-04 (Payment Gateway & Sinkronisasi)**

* Pembayaran berhasil mengubah status tagihan menjadi Lunas otomatis di panel admin.

* Pembayaran gagal atau batal tidak mengubah status tagihan.

### **Prioritas (MoSCoW)**

| Prioritas | Item |
| :---- | :---- |
| Must | EP-01 US-01, US-02, US-03; EP-02 US-01, US-02, US-03 |
| Should | EP-03 US-01, US-02; EP-04 US-01, US-02, US-03 |
| Could | EP-05 US-01, US-02 (chatbot) |
| Could/Should (cek ke klien) | EP-05 US-03, US-04, US-05 (payment gateway & sinkronisasi) |

Urutan pengerjaan mengikuti Sprint di Roadmap: data dulu, lalu UI, lalu tagihan, lalu keluhan & pengingat, lalu pengujian, lalu fitur tambahan.

## **3\. QA: Test Plan & Test Case Awal (Kamar & Penghuni)**

**Tujuan:** memastikan fitur data Kamar & Penghuni (EP-01) berfungsi sesuai acceptance criteria.

### **Ruang lingkup**

* Termasuk: CRUD kamar, registrasi penghuni, perubahan status kamar, tampilan katalog di HP.

* Di luar cakupan sprint ini: tagihan, chatbot, payment gateway.

### **Strategi uji**

Uji fungsional manual berdasarkan acceptance criteria, uji tampilan di HP (minimal 2 ukuran layar), dan uji validasi input. Temuan dicatat di list **Bugs** dengan format: judul, langkah reproduksi, hasil diharapkan, hasil aktual, tingkat keparahan, dan screenshot.

TC-01 s/d TC-07 juga sudah diotomasi di level API (`npm run test:api`, file `server/api.test.ts`). TC-08 tetap diuji manual.

### **Kriteria lulus**

Semua test case Must lulus dan tidak ada bug berkeparahan Tinggi yang terbuka.

### **Test case awal**

| ID | Skenario | Langkah singkat | Hasil diharapkan |
| :---- | :---- | :---- | :---- |
| TC-01 | Tambah kamar valid | Isi nomor, tipe, harga, status, lalu simpan | Data tersimpan dan tampil di daftar |
| TC-02 | Nomor kamar duplikat | Tambah kamar dengan nomor yang sudah ada | Ditolak dengan pesan error |
| TC-03 | Field wajib kosong | Simpan form kamar tanpa harga | Validasi muncul, data tidak tersimpan |
| TC-04 | Registrasi penghuni valid | Isi form lengkap, pilih kamar kosong | Penghuni tersimpan, kamar menjadi "Terisi" |
| TC-05 | Pilih kamar terisi | Buka dropdown kamar di form | Kamar "Terisi" tidak bisa dipilih |
| TC-06 | Nomor HP tidak valid | Isi huruf di kolom nomor HP | Validasi menolak input |
| TC-07 | Filter katalog | Filter status "Kosong" | Hanya kamar kosong yang tampil |
| TC-08 | Tampilan di HP | Buka katalog di layar 360 px dan 414 px | Tidak ada elemen terpotong atau tumpang tindih |

### **Template defect log (untuk list Bugs)**

ID Bug, Judul, Modul, Langkah Reproduksi, Hasil Diharapkan, Hasil Aktual, Severity (Tinggi/Sedang/Rendah), Pelapor, Status.

## **4\. BA: Validasi User Story & Acceptance Criteria dengan Klien (Gopi)**

Memvalidasi user story dan acceptance criteria dengan klien agar kebutuhan disepakati sebelum dikerjakan. Estimasi: 30 menit.

### **Persiapan (sebelum bertemu)**

* Kirim atau tunjukkan user story Sprint 1-2 (EP-01) dan Sprint 3 (EP-02) beserta acceptance criteria.

* Siapkan 5 pertanyaan kunci:

  1. Apakah isi data kamar sudah lengkap?

  2. Apakah tipe kamar perlu dibedakan?

  3. Apakah tagihan perlu dibuat per bulan?

  4. Bagaimana pemilik ingin melihat rekap?

  5. Apakah payment gateway memang diinginkan?

### **Checklist validasi**

| Item | Disetujui? | Catatan klien |
| :---- | :---- | :---- |
| EP-01 US-01 Data kamar & penghuni | ☐ |  |
| EP-01 US-02 Katalog kamar | ☐ |  |
| EP-01 US-03 Registrasi penghuni | ☐ |  |
| EP-02 US-01 Generate tagihan bulanan | ☐ |  |
| EP-02 US-02 Dashboard rekap (sederhana, untuk HP) | ☐ |  |
| EP-02 US-03 Konfirmasi pembayaran lunas | ☐ |  |

### **Catatan perubahan klien**

| Tanggal | Permintaan klien | Item terdampak | Keputusan | Tindak lanjut |
| :---- | :---- | :---- | :---- | :---- |
|  | contoh: rekap tagihan cukup sederhana di HP | EP-02 US-02 | Diterima | Perbarui acceptance criteria |

**Selesai bila:** user story Sprint 1-3 disetujui klien dan semua perubahan tercatat di tabel di atas, lalu acceptance criteria di Backlog diperbarui.

## **Cara memakai**

Salin setiap user story ke task Backlog yang sesuai (deskripsi \= user story \+ acceptance criteria). Salin bagian 3 dan 4 ke ClickUp Doc terpisah, lalu tautkan ke task QA dan BA di Sprint 1\. Setelah catatan wawancara dicocokkan, perbarui bagian yang perlu disesuaikan.