# Skema Database Kamar & Penghuni (WBS 1.1 · EP-01 US-01)

Status: **Draf siap review BA (Dewa)** · Penyusun: DEV BE · DBMS: SQLite (`node:sqlite`)
Migration: [`server/migrations/001_kamar_penghuni.sql`](../server/migrations/001_kamar_penghuni.sql)

## ERD

```mermaid
erDiagram
    KAMAR ||--o{ PENGHUNI : "dihuni oleh"
    PENGHUNI ||--o{ TAGIHAN : "ditagih kepada"
    KAMAR ||--o{ TAGIHAN : "objek sewa"
    TAGIHAN ||--o{ PEMBAYARAN : "dibayar melalui"
    KAMAR {
        INTEGER id PK
        TEXT nomor UK "unik, case-insensitive"
        TEXT tipe "Standar / AC / VIP"
        INTEGER harga "Rp per bulan, > 0"
        TEXT status "Kosong | Terisi"
        TEXT foto_url "opsional"
        TEXT created_at
        TEXT updated_at
    }
    PENGHUNI {
        INTEGER id PK
        TEXT nama
        TEXT no_hp "08xx / 628xx"
        INTEGER kamar_id FK
        TEXT tanggal_masuk "YYYY-MM-DD"
        TEXT tanggal_keluar "null bila masih aktif"
        INTEGER aktif "1 = aktif, 0 = keluar"
        TEXT created_at
    }
    TAGIHAN {
        INTEGER id PK
        INTEGER penghuni_id FK
        INTEGER kamar_id FK
        TEXT bulan "YYYY-MM"
        INTEGER nominal "harga sewa kamar"
        TEXT status "Belum Lunas | Lunas"
        TEXT jatuh_tempo "YYYY-MM-DD"
        TEXT tanggal_bayar "null bila belum"
        TEXT metode_pembayaran "Tunai / Transfer"
        TEXT catatan "opsional"
        TEXT created_at
        TEXT updated_at
    }
    PEMBAYARAN {
        INTEGER id PK
        INTEGER tagihan_id FK
        INTEGER jumlah "nominal bayar > 0"
        TEXT tanggal_bayar "YYYY-MM-DD"
        TEXT metode_pembayaran "Tunai / Transfer BCA / dll"
        TEXT catatan "opsional"
        TEXT created_at
    }
```

**Kardinalitas:**
- 1 kamar memiliki 0..N penghuni sepanjang waktu (riwayat), tetapi **maksimal 1 penghuni aktif** pada satu waktu (`ux_penghuni_kamar_aktif`).
- 1 penghuni memiliki 0..N tagihan bulanan (1 tagihan per bulan kalender, dicegah ganda oleh `ux_tagihan_penghuni_bulan`).
- 1 tagihan memiliki 0..N pembayaran (mendukung bayar langsung sebulan penuh = 1 transaksi, atau dicicil = beberapa transaksi).

## Aturan tagihan & pembayaran cicilan (Sprint 3 & Request Klien)

| Kejadian | Aturan | Implementasi |
| :-- | :-- | :-- |
| Generate tagihan bulanan | 1 tagihan per penghuni aktif per bulan dengan nominal = harga kamar | `POST /api/tagihan/generate` + `ux_tagihan_penghuni_bulan` |
| Idempotency tagihan | Tidak ada tagihan ganda untuk penghuni dan bulan yang sama | `UNIQUE (penghuni_id, bulan)` |
| Tanggal jatuh tempo | Dihitung dari tanggal masuk penghuni pada bulan target | Fungsi `hitungJatuhTempo(tanggalMasuk, bulan)` |
| Bayar langsung 1 bulan | Otomatis melunasi sisa tagihan dalam 1 transaksi penuh | `PATCH /api/tagihan/:id/lunas` |
| Bayar sebagian (cicilan) | Jumlah bayar dicatat sebagai cicilan (tidak boleh melebihi sisa) | `POST /api/tagihan/:id/pembayaran` |
| Status tagihan otomatis | Jika total pembayaran >= nominal, otomatis 'Lunas'. Jika ada cicilan, status bayar 'Dicicil' | Fungsi `syncStatusTagihan(id)` |
| Pembatalan / Undo cicilan | Hapus 1 transaksi cicilan yang keliru, status tagihan otomatis disesuaikan | `DELETE /api/pembayaran/:id` |
| Pembatalan konfirmasi | Hapus semua pembayaran tagihan ini, status kembali menjadi 'Belum Lunas' | `PATCH /api/tagihan/:id/batal` |

## Pertanyaan untuk BA / klien

1. Apakah tipe kamar cukup `Standar / AC / VIP`, atau perlu tabel master tipe?
2. Apakah satu kamar bisa dihuni lebih dari satu orang? (Saat ini diasumsikan **tidak**.)
3. Apakah perlu menyimpan data identitas lain (no. KTP, kontak darurat)?

## Checklist persetujuan BA

- [ ] Entitas & atribut sesuai kebutuhan klien
- [ ] Aturan status kamar disetujui
- [ ] Siap di-migrate (otomatis saat `npm run dev`)
