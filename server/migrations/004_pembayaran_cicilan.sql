-- 004_pembayaran_cicilan.sql
-- Request klien: penghuni boleh membayar secara mencicil ATAU langsung lunas 1 bulan.
-- Konsep: 1 tagihan (kewajiban) dapat memiliki banyak pembayaran (transaksi uang masuk).
--   * Bayar langsung 1 bulan  = 1 pembayaran sebesar nominal tagihan.
--   * Cicilan                 = beberapa pembayaran yang totalnya = nominal tagihan.
-- Kolom tagihan.status tetap 'Belum Lunas' | 'Lunas' (otomatis menjadi 'Lunas' saat total
-- pembayaran >= nominal). Status tampilan "Dicicil" diturunkan di query (terbayar > 0).

CREATE TABLE pembayaran (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  tagihan_id        INTEGER NOT NULL REFERENCES tagihan(id) ON DELETE CASCADE,
  jumlah            INTEGER NOT NULL CHECK (jumlah > 0),
  tanggal_bayar     TEXT    NOT NULL,                       -- YYYY-MM-DD
  metode_pembayaran TEXT    NOT NULL DEFAULT 'Tunai',
  catatan           TEXT,
  created_at        TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX ix_pembayaran_tagihan_id ON pembayaran(tagihan_id);

-- Migrasi data lama: tagihan yang sudah Lunas dianggap dibayar penuh dalam 1 kali pembayaran.
INSERT INTO pembayaran (tagihan_id, jumlah, tanggal_bayar, metode_pembayaran, catatan)
SELECT id, nominal, COALESCE(tanggal_bayar, date('now')), COALESCE(metode_pembayaran, 'Tunai'), catatan
FROM tagihan
WHERE status = 'Lunas';
