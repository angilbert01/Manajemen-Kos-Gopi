-- 003_tagihan.sql
-- Deliverable: 2.0 Sistem Tagihan Bulanan & Status Pembayaran
-- WBS 2.1 (EP-02 US-01): Generate tagihan bulanan otomatis
-- WBS 2.2 (EP-02 US-02): Dashboard rekap tagihan
-- WBS 2.3 (EP-02 US-03): Update konfirmasi pembayaran lunas

CREATE TABLE tagihan (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  penghuni_id       INTEGER NOT NULL REFERENCES penghuni(id) ON DELETE RESTRICT,
  kamar_id          INTEGER NOT NULL REFERENCES kamar(id) ON DELETE RESTRICT,
  bulan             TEXT    NOT NULL CHECK (bulan GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]'), -- YYYY-MM
  nominal           INTEGER NOT NULL CHECK (nominal > 0),
  status            TEXT    NOT NULL DEFAULT 'Belum Lunas'
                            CHECK (status IN ('Belum Lunas', 'Lunas')),
  jatuh_tempo       TEXT    NOT NULL,                                                      -- YYYY-MM-DD
  tanggal_bayar     TEXT,                                                                  -- YYYY-MM-DD
  metode_pembayaran TEXT    DEFAULT 'Tunai',                                               -- Tunai / Transfer
  catatan           TEXT,
  created_at        TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Aturan bisnis: Tidak ada tagihan ganda untuk penghuni dan bulan yang sama
CREATE UNIQUE INDEX ux_tagihan_penghuni_bulan ON tagihan(penghuni_id, bulan);
CREATE INDEX ix_tagihan_status ON tagihan(status);
CREATE INDEX ix_tagihan_bulan ON tagihan(bulan);
CREATE INDEX ix_tagihan_jatuh_tempo ON tagihan(jatuh_tempo);
CREATE INDEX ix_tagihan_kamar_id ON tagihan(kamar_id);
