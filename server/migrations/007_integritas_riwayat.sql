-- 007_integritas_riwayat.sql
-- Koreksi audit: riwayat pembayaran & keluhan tidak boleh hilang (MOV "zero-loss data").

-- Pembayaran tidak lagi dihapus; pembatalan dicatat (audit trail) dan diabaikan dalam perhitungan.
ALTER TABLE pembayaran ADD COLUMN dibatalkan_at TEXT;
CREATE INDEX ix_pembayaran_aktif ON pembayaran(tagihan_id) WHERE dibatalkan_at IS NULL;

DROP TRIGGER IF EXISTS trg_pembayaran_batas;
CREATE TRIGGER trg_pembayaran_batas
BEFORE INSERT ON pembayaran
WHEN NEW.jumlah + COALESCE((SELECT SUM(jumlah) FROM pembayaran
                            WHERE tagihan_id = NEW.tagihan_id AND dibatalkan_at IS NULL), 0)
     > (SELECT nominal FROM tagihan WHERE id = NEW.tagihan_id)
BEGIN
  SELECT RAISE(ABORT, 'PEMBAYARAN_MELEBIHI_SISA');
END;

-- Kamar yang punya riwayat keluhan tidak boleh dihapus (FK keluhan memakai CASCADE).
CREATE TRIGGER trg_kamar_hapus_berkeluhan
BEFORE DELETE ON kamar
WHEN EXISTS (SELECT 1 FROM keluhan WHERE kamar_id = OLD.id)
BEGIN
  SELECT RAISE(ABORT, 'KAMAR_PUNYA_KELUHAN');
END;

-- Satu orang (nomor HP) hanya boleh aktif di satu kamar.
CREATE UNIQUE INDEX ux_penghuni_no_hp_aktif ON penghuni(no_hp) WHERE aktif = 1;
