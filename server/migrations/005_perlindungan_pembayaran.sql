-- Riwayat keuangan tidak boleh hilang melalui penghapusan tagihan/kamar.
CREATE TRIGGER trg_tagihan_hapus_berbayar
BEFORE DELETE ON tagihan
WHEN EXISTS (SELECT 1 FROM pembayaran WHERE tagihan_id = OLD.id)
BEGIN
  SELECT RAISE(ABORT, 'TAGIHAN_SUDAH_DIBAYAR');
END;

-- Jaga batas pembayaran juga di database, termasuk jika ada beberapa proses penulis.
CREATE TRIGGER trg_pembayaran_batas
BEFORE INSERT ON pembayaran
WHEN NEW.jumlah + COALESCE((SELECT SUM(jumlah) FROM pembayaran WHERE tagihan_id = NEW.tagihan_id), 0)
     > (SELECT nominal FROM tagihan WHERE id = NEW.tagihan_id)
BEGIN
  SELECT RAISE(ABORT, 'PEMBAYARAN_MELEBIHI_SISA');
END;
