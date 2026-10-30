-- Sprint 4: EP-03 Sistem Manajemen Keluhan Fasilitas (WBS 3.0, WBS 3.1, WBS 3.2)
-- Tabel keluhan mencatat laporan keluhan penghuni dan alur penyelesaiannya oleh pemilik kos.

CREATE TABLE IF NOT EXISTS keluhan (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kamar_id INTEGER NOT NULL REFERENCES kamar(id) ON DELETE CASCADE,
  penghuni_id INTEGER REFERENCES penghuni(id) ON DELETE SET NULL,
  judul TEXT NOT NULL,
  deskripsi TEXT NOT NULL,
  kategori TEXT NOT NULL DEFAULT 'Fasilitas Kamar',
  prioritas TEXT NOT NULL DEFAULT 'Sedang' CHECK(prioritas IN ('Rendah', 'Sedang', 'Tinggi')),
  foto_url TEXT,
  status TEXT NOT NULL DEFAULT 'Pending' CHECK(status IN ('Pending', 'Diproses', 'Selesai')),
  catatan_penanganan TEXT,
  tanggal_lapor TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d', 'now', '+7 hours')),
  tanggal_selesai TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_keluhan_kamar ON keluhan(kamar_id);
CREATE INDEX IF NOT EXISTS idx_keluhan_penghuni ON keluhan(penghuni_id);
CREATE INDEX IF NOT EXISTS idx_keluhan_status ON keluhan(status);
CREATE INDEX IF NOT EXISTS idx_keluhan_prioritas ON keluhan(prioritas);

