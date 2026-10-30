-- 008_chatbot_pembayaran_online.sql
-- Sprint 4-5 / EP-05: Chatbot penagihan (WBS 5.1-5.2) & pembayaran online (WBS 5.3-5.4).

-- Penghuni menghubungkan akun chat lewat kode sekali pakai dari panel pemilik (bukan nomor HP,
-- agar orang lain tidak bisa mengaku sebagai penghuni dan melihat tagihannya).
ALTER TABLE penghuni ADD COLUMN chat_id TEXT;
ALTER TABLE penghuni ADD COLUMN kode_hubung TEXT;
CREATE UNIQUE INDEX ux_penghuni_chat_id ON penghuni(chat_id) WHERE chat_id IS NOT NULL;
CREATE UNIQUE INDEX ux_penghuni_kode_hubung ON penghuni(kode_hubung) WHERE kode_hubung IS NOT NULL;

-- Satu link pembayaran online untuk satu tagihan. Saat berhasil, dicatat sebagai 1 baris pembayaran.
CREATE TABLE transaksi_online (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  tagihan_id    INTEGER NOT NULL REFERENCES tagihan(id) ON DELETE RESTRICT,
  order_id      TEXT    NOT NULL UNIQUE,
  provider      TEXT    NOT NULL CHECK (provider IN ('midtrans', 'simulasi')),
  jumlah        INTEGER NOT NULL CHECK (jumlah > 0),
  payment_url   TEXT    NOT NULL,
  status        TEXT    NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'berhasil', 'gagal', 'kedaluwarsa', 'perlu_refund')),
  pembayaran_id INTEGER REFERENCES pembayaran(id),
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX ix_transaksi_online_tagihan ON transaksi_online(tagihan_id);
CREATE INDEX ix_transaksi_online_pending ON transaksi_online(status) WHERE status = 'pending';
