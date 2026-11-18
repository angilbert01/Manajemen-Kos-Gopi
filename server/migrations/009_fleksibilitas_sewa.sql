-- 009_fleksibilitas_sewa.sql
-- Revisi klien: fleksibilitas pemilik mengatur sendiri harga sewa dan jangka waktu sewa
-- (Harian, Mingguan, Bulanan, Tahunan) pada kamar, penghuni, dan tagihan.

ALTER TABLE kamar ADD COLUMN periode_default TEXT NOT NULL DEFAULT 'Bulanan'
  CHECK (periode_default IN ('Harian', 'Mingguan', 'Bulanan', 'Tahunan'));
ALTER TABLE kamar ADD COLUMN harga_harian INTEGER CHECK (harga_harian IS NULL OR harga_harian > 0);
ALTER TABLE kamar ADD COLUMN harga_mingguan INTEGER CHECK (harga_mingguan IS NULL OR harga_mingguan > 0);
ALTER TABLE kamar ADD COLUMN harga_tahunan INTEGER CHECK (harga_tahunan IS NULL OR harga_tahunan > 0);

ALTER TABLE penghuni ADD COLUMN periode_sewa TEXT NOT NULL DEFAULT 'Bulanan'
  CHECK (periode_sewa IN ('Harian', 'Mingguan', 'Bulanan', 'Tahunan'));
ALTER TABLE penghuni ADD COLUMN durasi_sewa INTEGER NOT NULL DEFAULT 1
  CHECK (durasi_sewa > 0);
ALTER TABLE penghuni ADD COLUMN harga_sewa INTEGER
  CHECK (harga_sewa IS NULL OR harga_sewa > 0);
ALTER TABLE penghuni ADD COLUMN tanggal_selesai_sewa TEXT;

ALTER TABLE tagihan ADD COLUMN periode_sewa TEXT NOT NULL DEFAULT 'Bulanan'
  CHECK (periode_sewa IN ('Harian', 'Mingguan', 'Bulanan', 'Tahunan'));
ALTER TABLE tagihan ADD COLUMN durasi_sewa INTEGER NOT NULL DEFAULT 1
  CHECK (durasi_sewa > 0);

