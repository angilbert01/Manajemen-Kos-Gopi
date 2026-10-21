-- 002_admin_profile.sql
-- Tabel profil admin / pengelola kos (mendukung CRUD penuh: tambah, lihat, ubah, aktifkan, hapus).

CREATE TABLE admin_profile (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  nama        TEXT    NOT NULL CHECK (length(trim(nama)) > 0),
  peran       TEXT    NOT NULL DEFAULT 'Pemilik Kos',
  email       TEXT    NOT NULL,
  no_hp       TEXT    NOT NULL,
  nama_kos    TEXT    NOT NULL DEFAULT 'Kos Gopi',
  alamat_kos  TEXT    NOT NULL DEFAULT '',
  avatar_url  TEXT    NOT NULL DEFAULT '/img/user.jpg',
  aktif       INTEGER NOT NULL DEFAULT 0 CHECK (aktif IN (0, 1)),
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Seed profil default Gopi jika belum ada
INSERT INTO admin_profile (nama, peran, email, no_hp, nama_kos, alamat_kos, avatar_url, aktif)
VALUES ('Gopi', 'Pemilik Kos', 'gopi@kosgopi.id', '081234567800', 'Kos Gopi', 'Jl. Veteran No. 12, Malang', '/img/user.jpg', 1);
