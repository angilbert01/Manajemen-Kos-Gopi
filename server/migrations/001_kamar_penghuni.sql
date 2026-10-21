-- 001_kamar_penghuni.sql
-- WBS 1.1 · EP-01 US-01: Penyimpanan data Kamar & Penghuni terstruktur.
-- Aturan status kamar (Kosong/Terisi) dijaga di level database lewat trigger,
-- sehingga tetap konsisten walau data diubah di luar API.

CREATE TABLE kamar (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  nomor       TEXT    NOT NULL UNIQUE COLLATE NOCASE,          -- AC: nomor kamar tidak boleh duplikat
  tipe        TEXT    NOT NULL,                                -- mis. Standar / AC / VIP (dikonfirmasi ke klien)
  harga       INTEGER NOT NULL CHECK (harga > 0),              -- Rupiah per bulan, dasar tagihan (EP-02)
  status      TEXT    NOT NULL DEFAULT 'Kosong'
                      CHECK (status IN ('Kosong', 'Terisi')),
  foto_url    TEXT,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE penghuni (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  nama            TEXT    NOT NULL CHECK (length(trim(nama)) > 0),
  no_hp           TEXT    NOT NULL,
  kamar_id        INTEGER NOT NULL REFERENCES kamar(id) ON DELETE RESTRICT,
  tanggal_masuk   TEXT    NOT NULL,                            -- ISO YYYY-MM-DD
  tanggal_keluar  TEXT,
  aktif           INTEGER NOT NULL DEFAULT 1 CHECK (aktif IN (0, 1)),
  created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Satu kamar maksimal satu penghuni aktif (kos single-occupancy).
CREATE UNIQUE INDEX ux_penghuni_kamar_aktif ON penghuni(kamar_id) WHERE aktif = 1;
CREATE INDEX ix_penghuni_aktif ON penghuni(aktif);
CREATE INDEX ix_kamar_status ON kamar(status);

-- Aturan status kamar ------------------------------------------------------

-- Tolak registrasi ke kamar yang sudah Terisi.
CREATE TRIGGER trg_penghuni_cek_kamar_kosong
BEFORE INSERT ON penghuni
WHEN NEW.aktif = 1 AND (SELECT status FROM kamar WHERE id = NEW.kamar_id) = 'Terisi'
BEGIN
  SELECT RAISE(ABORT, 'KAMAR_TERISI');
END;

-- Penghuni aktif masuk -> kamar Terisi.
CREATE TRIGGER trg_penghuni_masuk
AFTER INSERT ON penghuni
WHEN NEW.aktif = 1
BEGIN
  UPDATE kamar SET status = 'Terisi', updated_at = datetime('now') WHERE id = NEW.kamar_id;
END;

-- Penghuni keluar (aktif 1 -> 0) -> kamar Kosong.
CREATE TRIGGER trg_penghuni_keluar
AFTER UPDATE OF aktif ON penghuni
WHEN OLD.aktif = 1 AND NEW.aktif = 0
BEGIN
  UPDATE kamar SET status = 'Kosong', updated_at = datetime('now') WHERE id = NEW.kamar_id;
END;

-- Kamar Terisi tidak boleh dihapus.
CREATE TRIGGER trg_kamar_hapus_terisi
BEFORE DELETE ON kamar
WHEN OLD.status = 'Terisi'
BEGIN
  SELECT RAISE(ABORT, 'KAMAR_TERISI');
END;
