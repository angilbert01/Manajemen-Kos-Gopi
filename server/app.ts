import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import { db, migrate, transaction } from './db.ts';
import { hitungTanggalSelesaiSewa, isIsoDate, selisihHari, tanggalJakarta } from './dates.ts';
import {
  validateAdmin,
  validateCreateTagihanManual,
  validateGenerateTagihan,
  validateKamar,
  validateKeluhan,
  validateLunas,
  validatePembayaran,
  validatePenghuni,
  validateSewaPenghuni,
  validateStatusKeluhan,
  validateUpdateTagihan,
} from './validation.ts';
import type { StatusKeluhan } from './validation.ts';
import {
  buatKodeHubung,
  kirimKuitansiTelegram,
  kirimPesanKeluhanPenghuni,
  kirimPesanTagihanPenghuni,
  TelegramBelumTerhubungError,
} from './bot.ts';
import type { Kirim } from './bot.ts';
import {
  buatLinkPembayaran,
  halamanSimulasi,
  PembayaranError,
  petaStatusMidtrans,
  providerAktif,
  signatureValid,
  terapkanStatus,
} from './pembayaran-online.ts';

type Row = Record<string, unknown>;

/** Hook opsional untuk notifikasi Telegram ketika data berubah dari panel pemilik. */
export const appHooks: {
  keluhanStatusChanged: (keluhan: Row) => void;
  tagihanUpdated: (tagihan: Row) => void;
  pembayaranDicatat: (tagihan: Row) => void;
  kirimTelegram: Kirim | null;
} = {
  keluhanStatusChanged: () => {},
  tagihanUpdated: () => {},
  pembayaranDicatat: () => {},
  kirimTelegram: null,
};

const KAMAR_SELECT = `
  SELECT k.id, k.nomor, k.tipe, k.harga, k.status, k.foto_url,
         k.periode_default, k.harga_harian, k.harga_mingguan, k.harga_tahunan,
         k.created_at, k.updated_at,
         p.id AS penghuni_id, p.nama AS penghuni_nama, p.no_hp AS penghuni_no_hp, p.tanggal_masuk AS penghuni_masuk,
         p.periode_sewa AS penghuni_periode_sewa, p.durasi_sewa AS penghuni_durasi_sewa,
         COALESCE(p.harga_sewa, k.harga) AS penghuni_harga_sewa, p.tanggal_selesai_sewa AS penghuni_selesai_sewa
  FROM kamar k
  LEFT JOIN penghuni p ON p.kamar_id = k.id AND p.aktif = 1`;

const PENGHUNI_SELECT = `
  SELECT p.id, p.nama, p.no_hp, p.kamar_id, k.nomor AS kamar_nomor, k.tipe AS kamar_tipe, k.harga AS kamar_harga,
         p.periode_sewa, p.durasi_sewa, COALESCE(p.harga_sewa, k.harga) AS harga_sewa,
         p.harga_sewa AS harga_sewa_kustom, p.tanggal_selesai_sewa,
         p.tanggal_masuk, p.tanggal_keluar, p.aktif, p.created_at,
         (SELECT COUNT(*) FROM tagihan t WHERE t.penghuni_id = p.id AND t.status = 'Belum Lunas') AS tagihan_belum_lunas,
         (p.chat_id IS NOT NULL) AS chat_terhubung
  FROM penghuni p JOIN kamar k ON k.id = p.kamar_id`;

// Agregat pembayaran per tagihan (mendukung cicilan): total terbayar & jumlah transaksi.
const PEMBAYARAN_AGG = `
  LEFT JOIN (
    SELECT tagihan_id, SUM(jumlah) AS terbayar, COUNT(*) AS jumlah_pembayaran
    FROM pembayaran WHERE dibatalkan_at IS NULL GROUP BY tagihan_id
  ) pb ON pb.tagihan_id = t.id`;

const TAGIHAN_SELECT = `
  SELECT t.id, t.penghuni_id, t.kamar_id, t.bulan, t.nominal, t.periode_sewa, t.durasi_sewa, t.status,
         t.jatuh_tempo, t.tanggal_bayar, t.metode_pembayaran, t.catatan,
         t.created_at, t.updated_at,
         COALESCE(pb.terbayar, 0) AS terbayar,
         MAX(t.nominal - COALESCE(pb.terbayar, 0), 0) AS sisa,
         COALESCE(pb.jumlah_pembayaran, 0) AS jumlah_pembayaran,
         CASE WHEN t.status = 'Lunas' THEN 'Lunas'
              WHEN COALESCE(pb.terbayar, 0) > 0 THEN 'Dicicil'
              ELSE 'Belum Bayar' END AS status_bayar,
         p.nama AS penghuni_nama, p.no_hp AS penghuni_no_hp, p.tanggal_masuk AS penghuni_masuk,
         p.tanggal_selesai_sewa AS penghuni_selesai_sewa,
         k.nomor AS kamar_nomor, k.tipe AS kamar_tipe, k.harga AS kamar_harga
  FROM tagihan t
  JOIN penghuni p ON p.id = t.penghuni_id
  JOIN kamar k ON k.id = t.kamar_id
  ${PEMBAYARAN_AGG}`;

/**
 * Rekap nominal per bulan. nominal_lunas = uang yang SUDAH masuk (termasuk cicilan),
 * nominal_belum_lunas = sisa yang masih harus ditagih.
 */
const REKAP_SELECT = `
  SELECT
    COUNT(*) AS total_tagihan,
    COALESCE(SUM(t.nominal), 0) AS total_nominal,
    COALESCE(SUM(CASE WHEN t.status = 'Lunas' THEN 1 ELSE 0 END), 0) AS total_lunas,
    COALESCE(SUM(COALESCE(pb.terbayar, 0)), 0) AS nominal_lunas,
    COALESCE(SUM(CASE WHEN t.status = 'Belum Lunas' THEN 1 ELSE 0 END), 0) AS total_belum_lunas,
    COALESCE(SUM(MAX(t.nominal - COALESCE(pb.terbayar, 0), 0)), 0) AS nominal_belum_lunas,
    COALESCE(SUM(CASE WHEN t.status = 'Belum Lunas' AND COALESCE(pb.terbayar, 0) > 0 THEN 1 ELSE 0 END), 0) AS total_dicicil,
    COALESCE(SUM(CASE WHEN t.status = 'Belum Lunas' THEN COALESCE(pb.terbayar, 0) ELSE 0 END), 0) AS nominal_dicicil
  FROM tagihan t
  ${PEMBAYARAN_AGG}
  WHERE t.bulan = ?`;

const ADMIN_COLS = 'id, nama, peran, email, no_hp, nama_kos, alamat_kos, avatar_url, aktif, created_at, updated_at';

const KELUHAN_SELECT = `
  SELECT kl.id, kl.kamar_id, kl.penghuni_id, kl.judul, kl.deskripsi, kl.kategori,
         kl.prioritas, kl.foto_url, kl.status, kl.catatan_penanganan,
         kl.tanggal_lapor, kl.tanggal_selesai, kl.created_at, kl.updated_at,
         k.nomor AS kamar_nomor, k.tipe AS kamar_tipe,
         COALESCE(p.nama, 'Tanpa penghuni') AS penghuni_nama,
         COALESCE(p.no_hp, '') AS penghuni_no_hp
  FROM keluhan kl
  JOIN kamar k ON k.id = kl.kamar_id
  LEFT JOIN penghuni p ON p.id = kl.penghuni_id`;

const KELUHAN_REKAP_SELECT = `
  SELECT
    COUNT(*) AS total,
    COALESCE(SUM(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END), 0) AS pending,
    COALESCE(SUM(CASE WHEN status = 'Diproses' THEN 1 ELSE 0 END), 0) AS diproses,
    COALESCE(SUM(CASE WHEN status = 'Selesai' THEN 1 ELSE 0 END), 0) AS selesai
  FROM keluhan`;

const getKamar = (id: number | bigint) => db.prepare(`${KAMAR_SELECT} WHERE k.id = ?`).get(id);
const getPenghuni = (id: number | bigint) => db.prepare(`${PENGHUNI_SELECT} WHERE p.id = ?`).get(id);
const getAdmin = (id: number | bigint) => db.prepare(`SELECT ${ADMIN_COLS} FROM admin_profile WHERE id = ?`).get(id);
export const getTagihan = (id: number | bigint) => db.prepare(`${TAGIHAN_SELECT} WHERE t.id = ?`).get(id);
const getKeluhan = (id: number | bigint) => db.prepare(`${KELUHAN_SELECT} WHERE kl.id = ?`).get(id);
const getPembayaranList = (tagihanId: number | bigint) =>
  db.prepare(`SELECT id, tagihan_id, jumlah, tanggal_bayar, metode_pembayaran, catatan, created_at
              FROM pembayaran WHERE tagihan_id = ? AND dibatalkan_at IS NULL ORDER BY tanggal_bayar ASC, id ASC`).all(tagihanId);

/**
 * Hitung ulang status tagihan dari total pembayaran:
 * total >= nominal -> 'Lunas' (tanggal_bayar = tanggal pembayaran terakhir), selain itu 'Belum Lunas'.
 */
export function syncStatusTagihan(tagihanId: number | bigint) {
  const t = db.prepare('SELECT nominal FROM tagihan WHERE id = ?').get(tagihanId) as { nominal: number } | undefined;
  if (!t) return;
  const agg = db.prepare(
    'SELECT COALESCE(SUM(jumlah), 0) AS terbayar, MAX(tanggal_bayar) AS terakhir FROM pembayaran WHERE tagihan_id = ? AND dibatalkan_at IS NULL',
  ).get(tagihanId) as { terbayar: number; terakhir: string | null };
  const last = db.prepare(
    'SELECT metode_pembayaran FROM pembayaran WHERE tagihan_id = ? AND dibatalkan_at IS NULL ORDER BY tanggal_bayar DESC, id DESC LIMIT 1',
  ).get(tagihanId) as { metode_pembayaran: string } | undefined;
  const lunas = agg.terbayar >= t.nominal;
  db.prepare(`
    UPDATE tagihan
    SET status = ?, tanggal_bayar = ?, metode_pembayaran = ?,
        catatan = CASE WHEN ? > 0 THEN catatan END, updated_at = datetime('now')
    WHERE id = ?
  `).run(lunas ? 'Lunas' : 'Belum Lunas', lunas ? agg.terakhir : null, last?.metode_pembayaran ?? null, agg.terbayar, tagihanId);
}

export function hitungJatuhTempo(tanggalMasuk: string, bulan: string): string {
  const [year, month] = bulan.split('-').map(Number);
  const day = Number(tanggalMasuk.slice(8, 10)) || 1;
  const daysInMonth = new Date(year, month, 0).getDate();
  const clampedDay = Math.min(day, daysInMonth);
  return `${year}-${String(month).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`;
}

export function generateTagihanBulan(targetBulan: string) {
  const activePenghuni = db.prepare(`
    SELECT p.id AS penghuni_id, p.kamar_id, p.tanggal_masuk, p.periode_sewa, p.durasi_sewa, p.tanggal_selesai_sewa,
           COALESCE(p.harga_sewa, k.harga) AS harga, k.nomor AS kamar_nomor, p.nama AS penghuni_nama
    FROM penghuni p
    JOIN kamar k ON k.id = p.kamar_id
    WHERE p.aktif = 1
  `).all() as {
    penghuni_id: number;
    kamar_id: number;
    tanggal_masuk: string;
    periode_sewa: string;
    durasi_sewa: number;
    tanggal_selesai_sewa: string | null;
    harga: number;
    kamar_nomor: string;
    penghuni_nama: string;
  }[];

  let dibuat = 0;
  let dilewati = 0;

  transaction(() => {
    const checkStmt = db.prepare('SELECT id FROM tagihan WHERE penghuni_id = ? AND bulan = ?');
    const anyStmt = db.prepare('SELECT 1 FROM tagihan WHERE penghuni_id = ? LIMIT 1');
    const insStmt = db.prepare(`
      INSERT INTO tagihan (penghuni_id, kamar_id, bulan, nominal, periode_sewa, durasi_sewa, status, jatuh_tempo)
      VALUES (?, ?, ?, ?, ?, ?, 'Belum Lunas', ?)
    `);

    for (const p of activePenghuni) {
      // Lewati jika penghuni baru mulai masuk setelah bulan target
      const bulanMasuk = p.tanggal_masuk.slice(0, 7);
      if (bulanMasuk > targetBulan) continue;

      const existing = checkStmt.get(p.penghuni_id, targetBulan);
      if (existing) {
        dilewati++;
      } else {
        // Sewa Harian / Mingguan / Tahunan ditagih sesuai jangka sewa; tidak otomatis ditagih ulang tiap bulan selama masih dalam masa sewa.
        if (p.periode_sewa !== 'Bulanan' && anyStmt.get(p.penghuni_id) && (!p.tanggal_selesai_sewa || `${targetBulan}-01` < p.tanggal_selesai_sewa)) {
          dilewati++;
          continue;
        }
        const jatuhTempo = hitungJatuhTempo(p.tanggal_masuk, targetBulan);
        insStmt.run(p.penghuni_id, p.kamar_id, targetBulan, p.harga, p.periode_sewa, p.durasi_sewa, jatuhTempo);
        dibuat++;
      }
    }
  });

  const list = db.prepare(`${TAGIHAN_SELECT} WHERE t.bulan = ? ORDER BY t.status ASC, t.jatuh_tempo ASC, k.nomor ASC`).all(targetBulan);
  return {
    bulan: targetBulan,
    total_penghuni_aktif: activePenghuni.length,
    dibuat,
    dilewati,
    total_tagihan: list.length,
    tagihan: list,
  };
}

class HttpError extends Error {
  status: number;
  errors?: Record<string, string>;
  constructor(status: number, message: string, errors?: Record<string, string>) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

const idParam = (req: Request) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, 'ID tidak valid.');
  return id;
};

/** Terjemahkan error constraint SQLite ke HTTP error yang ramah pengguna. */
function mapDbError(err: unknown): never {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes('UNIQUE constraint failed: kamar.nomor'))
    throw new HttpError(409, 'Nomor kamar sudah terdaftar.', { nomor: 'Nomor kamar sudah terdaftar.' });
  if (msg.includes('ux_tagihan_penghuni_bulan') || msg.includes('UNIQUE constraint failed: tagihan.penghuni_id, tagihan.bulan'))
    throw new HttpError(409, 'Tagihan untuk penghuni pada bulan ini sudah ada.');
  if (msg.includes('KAMAR_TERISI') || msg.includes('ux_penghuni_kamar_aktif'))
    throw new HttpError(409, 'Kamar sudah terisi.', { kamar_id: 'Kamar sudah terisi, pilih kamar lain.' });
  if (msg.includes('ux_penghuni_no_hp_aktif') || msg.includes('UNIQUE constraint failed: penghuni.no_hp'))
    throw new HttpError(409, 'Nomor HP ini masih terdaftar sebagai penghuni aktif di kamar lain.', {
      no_hp: 'Nomor HP ini masih aktif di kamar lain.',
    });
  if (msg.includes('KAMAR_PUNYA_KELUHAN'))
    throw new HttpError(409, 'Kamar memiliki riwayat keluhan dan tidak boleh dihapus.');
  if (msg.includes('FOREIGN KEY constraint failed'))
    throw new HttpError(409, 'Data masih dipakai oleh data lain.');
  if (msg.includes('TAGIHAN_SUDAH_DIBAYAR'))
    throw new HttpError(409, 'Tagihan yang memiliki pembayaran tidak boleh dihapus.');
  if (msg.includes('PEMBAYARAN_MELEBIHI_SISA'))
    throw new HttpError(409, 'Sisa tagihan telah berubah. Muat ulang sebelum mencatat pembayaran.');
  throw err;
}

/** Tagihan belum lunas yang jatuh tempo H-3, H-0, atau sudah lewat, per `tanggal` (WIB). */
export function daftarPengingat(tanggal: string) {
  const rows = db
    .prepare(`${TAGIHAN_SELECT} WHERE t.status = 'Belum Lunas' AND t.jatuh_tempo <= date(?, '+3 days')
              ORDER BY t.jatuh_tempo ASC, k.nomor COLLATE NOCASE`)
    .all(tanggal) as Row[];
  return rows.flatMap((row) => {
    const hari = selisihHari(tanggal, row.jatuh_tempo as string);
    const pengingat = hari < 0 ? 'Terlambat' : hari === 0 ? 'H-0' : hari === 3 ? 'H-3' : null;
    return pengingat ? [{ ...row, pengingat, hari }] : [];
  });
}

export function createApp() {
  migrate();
  const app = express();
  app.use(express.json());

  // ---------- Ringkasan (dashboard terintegrasi penuh dengan DB) ----------
  app.get('/api/ringkasan', (_req, res) => {
    const r = db.prepare(`
      SELECT
        COUNT(*) AS total,
        COALESCE(SUM(k.status = 'Terisi'), 0) AS terisi,
        COALESCE(SUM(k.status = 'Kosong'), 0) AS kosong,
        COALESCE(SUM(CASE WHEN k.status = 'Terisi' THEN COALESCE(p.harga_sewa, k.harga) ELSE 0 END), 0) AS pendapatan_bulanan,
        COALESCE(SUM(k.harga), 0) AS potensi_pendapatan
      FROM kamar k
      LEFT JOIN penghuni p ON p.kamar_id = k.id AND p.aktif = 1
    `).get() as Row;
    const { total_penghuni } = db.prepare('SELECT COUNT(*) AS total_penghuni FROM penghuni WHERE aktif = 1').get() as {
      total_penghuni: number;
    };
    const currentBulan = tanggalJakarta().slice(0, 7);
    const tagihanRekap = db.prepare(REKAP_SELECT).get(currentBulan) as Row;
    const keluhanRekap = db.prepare(KELUHAN_REKAP_SELECT).get() as Row;

    res.json({
      total_kamar: r.total,
      kamar_terisi: r.terisi,
      kamar_kosong: r.kosong,
      total_penghuni,
      pendapatan_bulanan: r.pendapatan_bulanan,
      potensi_pendapatan: r.potensi_pendapatan,
      tagihan_bulan: currentBulan,
      tagihan_total: tagihanRekap.total_tagihan,
      tagihan_total_nominal: tagihanRekap.total_nominal,
      tagihan_lunas: tagihanRekap.total_lunas,
      tagihan_nominal_lunas: tagihanRekap.nominal_lunas,
      tagihan_belum_lunas: tagihanRekap.total_belum_lunas,
      tagihan_nominal_belum_lunas: tagihanRekap.nominal_belum_lunas,
      tagihan_dicicil: tagihanRekap.total_dicicil,
      keluhan_total: keluhanRekap.total,
      keluhan_pending: keluhanRekap.pending,
      keluhan_diproses: keluhanRekap.diproses,
      keluhan_selesai: keluhanRekap.selesai,
      keluhan_aktif: Number(keluhanRekap.pending ?? 0) + Number(keluhanRekap.diproses ?? 0),
    });
  });

  // ---------- Profil Admin (CRUD) ----------
  app.get('/api/admin', (_req, res) => {
    res.json(db.prepare(`SELECT ${ADMIN_COLS} FROM admin_profile ORDER BY aktif DESC, id ASC`).all());
  });

  app.get('/api/admin/aktif', (_req, res) => {
    let row = db.prepare(`SELECT ${ADMIN_COLS} FROM admin_profile WHERE aktif = 1 ORDER BY id ASC LIMIT 1`).get();
    if (!row) row = db.prepare(`SELECT ${ADMIN_COLS} FROM admin_profile ORDER BY id ASC LIMIT 1`).get();
    res.json(row);
  });

  app.post('/api/admin', (req, res) => {
    const { data, errors } = validateAdmin(req.body ?? {});
    if (!data) throw new HttpError(422, 'Data profil admin tidak valid.', errors);
    const jadikanAktif = req.body?.aktif === 1 || req.body?.aktif === true ? 1 : 0;
    const id = transaction(() => {
      if (jadikanAktif) db.prepare('UPDATE admin_profile SET aktif = 0').run();
      const r = db
        .prepare(
          `INSERT INTO admin_profile (nama, peran, email, no_hp, nama_kos, alamat_kos, avatar_url, aktif)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(data.nama, data.peran, data.email, data.no_hp, data.nama_kos, data.alamat_kos, data.avatar_url, jadikanAktif);
      return r.lastInsertRowid;
    });
    res.status(201).json(getAdmin(id));
  });

  app.put('/api/admin/:id', (req, res) => {
    const id = idParam(req);
    if (!getAdmin(id)) throw new HttpError(404, 'Profil admin tidak ditemukan.');
    const { data, errors } = validateAdmin(req.body ?? {});
    if (!data) throw new HttpError(422, 'Data profil admin tidak valid.', errors);
    db.prepare(
      `UPDATE admin_profile
       SET nama = ?, peran = ?, email = ?, no_hp = ?, nama_kos = ?, alamat_kos = ?, avatar_url = ?, updated_at = datetime('now')
       WHERE id = ?`,
    ).run(data.nama, data.peran, data.email, data.no_hp, data.nama_kos, data.alamat_kos, data.avatar_url, id);
    res.json(getAdmin(id));
  });

  app.patch('/api/admin/:id/aktifkan', (req, res) => {
    const id = idParam(req);
    if (!getAdmin(id)) throw new HttpError(404, 'Profil admin tidak ditemukan.');
    transaction(() => {
      db.prepare('UPDATE admin_profile SET aktif = 0').run();
      db.prepare(`UPDATE admin_profile SET aktif = 1, updated_at = datetime('now') WHERE id = ?`).run(id);
    });
    res.json(getAdmin(id));
  });

  app.delete('/api/admin/:id', (req, res) => {
    const id = idParam(req);
    const target = getAdmin(id) as Row | undefined;
    if (!target) throw new HttpError(404, 'Profil admin tidak ditemukan.');
    const { total } = db.prepare('SELECT COUNT(*) AS total FROM admin_profile').get() as { total: number };
    if (total <= 1) throw new HttpError(409, 'Minimal harus ada 1 profil admin aktif.');
    transaction(() => {
      db.prepare('DELETE FROM admin_profile WHERE id = ?').run(id);
      if (target.aktif === 1) {
        db.prepare('UPDATE admin_profile SET aktif = 1 WHERE id = (SELECT id FROM admin_profile ORDER BY id ASC LIMIT 1)').run();
      }
    });
    res.status(204).end();
  });

  // ---------- Kamar ----------
  app.get('/api/kamar', (req, res) => {
    const where: string[] = [];
    const params: (string | number)[] = [];
    const { status, harga_max, q } = req.query;
    if (status === 'Kosong' || status === 'Terisi') { where.push('k.status = ?'); params.push(status); }
    if (typeof harga_max === 'string' && harga_max !== '' && Number.isFinite(Number(harga_max))) {
      where.push('k.harga <= ?'); params.push(Number(harga_max));
    }
    if (typeof q === 'string' && q.trim()) {
      where.push('(k.nomor LIKE ? OR k.tipe LIKE ? OR p.nama LIKE ?)');
      params.push(`%${q.trim()}%`, `%${q.trim()}%`, `%${q.trim()}%`);
    }
    const sql = `${KAMAR_SELECT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
                 ORDER BY k.nomor COLLATE NOCASE`;
    res.json(db.prepare(sql).all(...params));
  });

  app.get('/api/kamar/:id', (req, res) => {
    const row = getKamar(idParam(req));
    if (!row) throw new HttpError(404, 'Kamar tidak ditemukan.');
    res.json(row);
  });

  app.post('/api/kamar', (req, res) => {
    const { data, errors } = validateKamar(req.body ?? {});
    if (!data) throw new HttpError(422, 'Data kamar tidak valid.', errors);
    try {
      const r = db.prepare(
        `INSERT INTO kamar (nomor, tipe, harga, foto_url, periode_default, harga_harian, harga_mingguan, harga_tahunan)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        data.nomor,
        data.tipe,
        data.harga,
        data.foto_url,
        data.periode_default,
        data.harga_harian,
        data.harga_mingguan,
        data.harga_tahunan,
      );
      res.status(201).json(getKamar(r.lastInsertRowid));
    } catch (err) { mapDbError(err); }
  });

  app.put('/api/kamar/:id', (req, res) => {
    const id = idParam(req);
    if (!getKamar(id)) throw new HttpError(404, 'Kamar tidak ditemukan.');
    const { data, errors } = validateKamar(req.body ?? {});
    if (!data) throw new HttpError(422, 'Data kamar tidak valid.', errors);
    try {
      db.prepare(`UPDATE kamar
                  SET nomor = ?, tipe = ?, harga = ?, foto_url = ?,
                      periode_default = ?, harga_harian = ?, harga_mingguan = ?, harga_tahunan = ?,
                      updated_at = datetime('now')
                  WHERE id = ?`).run(
        data.nomor,
        data.tipe,
        data.harga,
        data.foto_url,
        data.periode_default,
        data.harga_harian,
        data.harga_mingguan,
        data.harga_tahunan,
        id,
      );
      res.json(getKamar(id));
    } catch (err) { mapDbError(err); }
  });

  app.delete('/api/kamar/:id', (req, res) => {
    const id = idParam(req);
    if (!getKamar(id)) throw new HttpError(404, 'Kamar tidak ditemukan.');
    if (db.prepare('SELECT 1 FROM tagihan WHERE kamar_id = ? LIMIT 1').get(id))
      throw new HttpError(409, 'Kamar memiliki riwayat tagihan dan tidak boleh dihapus.');
    if (db.prepare('SELECT 1 FROM keluhan WHERE kamar_id = ? LIMIT 1').get(id))
      throw new HttpError(409, 'Kamar memiliki riwayat keluhan dan tidak boleh dihapus.');
    try {
      transaction(() => {
        // Riwayat keuangan & keluhan tetap disimpan; hanya kamar tanpa riwayat dapat dihapus.
        db.prepare('DELETE FROM penghuni WHERE kamar_id = ? AND aktif = 0').run(id);
        db.prepare('DELETE FROM kamar WHERE id = ?').run(id);
      });
      res.status(204).end();
    } catch (err) {
      if (err instanceof Error && err.message.includes('KAMAR_TERISI'))
        throw new HttpError(409, 'Kamar yang sedang terisi tidak bisa dihapus.');
      mapDbError(err);
    }
  });

  // ---------- Penghuni ----------
  app.get('/api/penghuni', (req, res) => {
    const semua = req.query.semua === '1';
    res.json(db.prepare(`${PENGHUNI_SELECT} ${semua ? '' : 'WHERE p.aktif = 1'}
                         ORDER BY p.aktif DESC, length(k.nomor) ASC, k.nomor COLLATE NOCASE ASC, p.nama COLLATE NOCASE ASC`).all());
  });

  app.post('/api/penghuni', (req, res) => {
    const { data, errors } = validatePenghuni(req.body ?? {});
    if (!data) throw new HttpError(422, 'Data penghuni tidak valid.', errors);
    const kamar = getKamar(data.kamar_id) as Row | undefined;
    if (!kamar) throw new HttpError(422, 'Kamar tidak ditemukan.', { kamar_id: 'Kamar tidak ditemukan.' });
    if (kamar.status === 'Terisi')
      throw new HttpError(409, 'Kamar sudah terisi.', { kamar_id: 'Kamar sudah terisi, pilih kamar lain.' });
    try {
      // Trigger trg_penghuni_masuk otomatis mengubah status kamar menjadi "Terisi".
      const id = transaction(() => {
        const r = db.prepare(
          `INSERT INTO penghuni (nama, no_hp, kamar_id, tanggal_masuk, periode_sewa, durasi_sewa, harga_sewa, tanggal_selesai_sewa)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          data.nama,
          data.no_hp,
          data.kamar_id,
          data.tanggal_masuk,
          data.periode_sewa,
          data.durasi_sewa,
          data.harga_sewa,
          data.tanggal_selesai_sewa,
        );
        // Penghuni lama yang baru dicatat hanya ditagih periode berjalan, bukan bulan masuk bertahun lalu.
        const bulanMasuk = data.tanggal_masuk.slice(0, 7);
        const bulanBerjalan = tanggalJakarta().slice(0, 7);
        const bulan = bulanMasuk > bulanBerjalan ? bulanMasuk : bulanBerjalan;
        const nominalAwal = data.harga_sewa ?? (kamar.harga as number);
        db.prepare(`
          INSERT INTO tagihan (penghuni_id, kamar_id, bulan, nominal, periode_sewa, durasi_sewa, status, jatuh_tempo)
          VALUES (?, ?, ?, ?, ?, ?, 'Belum Lunas', ?)
        `).run(
          r.lastInsertRowid,
          data.kamar_id,
          bulan,
          nominalAwal,
          data.periode_sewa,
          data.durasi_sewa,
          hitungJatuhTempo(data.tanggal_masuk, bulan),
        );
        return r.lastInsertRowid;
      });
      res.status(201).json(getPenghuni(id));
    } catch (err) { mapDbError(err); }
  });

  // Perbarui profil lengkap penghuni aktif (nama, no HP, pindah kamar kosong, tanggal masuk, & pengaturan sewa).
  app.put('/api/penghuni/:id', (req, res) => {
    const id = idParam(req);
    const existing = getPenghuni(id) as Row | undefined;
    if (!existing) throw new HttpError(404, 'Penghuni tidak ditemukan.');
    if (existing.aktif !== 1) throw new HttpError(409, 'Penghuni sudah tidak aktif.');

    const { data, errors } = validatePenghuni(req.body ?? {});
    if (!data) throw new HttpError(422, 'Data profil penghuni tidak valid.', errors);

    const oldKamarId = Number(existing.kamar_id);
    const newKamarId = data.kamar_id;
    const kamarTujuan = getKamar(newKamarId) as Row | undefined;
    if (!kamarTujuan) throw new HttpError(422, 'Kamar tidak ditemukan.', { kamar_id: 'Kamar tidak ditemukan.' });
    if (newKamarId !== oldKamarId && kamarTujuan.status === 'Terisi') {
      throw new HttpError(409, 'Kamar tujuan sudah terisi.', { kamar_id: 'Kamar sudah terisi, pilih kamar lain.' });
    }

    try {
      transaction(() => {
        db.prepare(`
          UPDATE penghuni
          SET nama = ?, no_hp = ?, kamar_id = ?, tanggal_masuk = ?,
              periode_sewa = ?, durasi_sewa = ?, harga_sewa = ?, tanggal_selesai_sewa = ?
          WHERE id = ?
        `).run(
          data.nama,
          data.no_hp,
          newKamarId,
          data.tanggal_masuk,
          data.periode_sewa,
          data.durasi_sewa,
          data.harga_sewa,
          data.tanggal_selesai_sewa,
          id,
        );

        if (newKamarId !== oldKamarId) {
          db.prepare("UPDATE kamar SET status = 'Kosong', updated_at = datetime('now') WHERE id = ?").run(oldKamarId);
          db.prepare("UPDATE kamar SET status = 'Terisi', updated_at = datetime('now') WHERE id = ?").run(newKamarId);
          db.prepare("UPDATE tagihan SET kamar_id = ?, updated_at = datetime('now') WHERE penghuni_id = ? AND status = 'Belum Lunas'")
            .run(newKamarId, id);
        }

        const tagihanAktif = db.prepare(`
          SELECT id, (SELECT COALESCE(SUM(jumlah), 0) FROM pembayaran pb WHERE pb.tagihan_id = tagihan.id AND pb.dibatalkan_at IS NULL) AS terbayar
          FROM tagihan
          WHERE penghuni_id = ? AND status = 'Belum Lunas'
          ORDER BY bulan DESC, id DESC LIMIT 1
        `).get(id) as { id: number; terbayar: number } | undefined;

        if (tagihanAktif && data.harga_sewa !== null) {
          if (data.harga_sewa < tagihanAktif.terbayar) {
            throw new HttpError(
              422,
              `Nominal sewa baru tidak boleh kurang dari jumlah yang sudah dibayar (Rp ${tagihanAktif.terbayar.toLocaleString('id-ID')}).`,
              { harga_sewa: `Minimal Rp ${tagihanAktif.terbayar.toLocaleString('id-ID')} (sudah terbayar).` },
            );
          }
          db.prepare(`
            UPDATE tagihan
            SET nominal = ?, periode_sewa = ?, durasi_sewa = ?, updated_at = datetime('now')
            WHERE id = ?
          `).run(data.harga_sewa, data.periode_sewa, data.durasi_sewa, tagihanAktif.id);
          syncStatusTagihan(tagihanAktif.id);
        }
      });

      res.json(getPenghuni(id));
    } catch (err) {
      if (err instanceof HttpError) throw err;
      mapDbError(err);
    }
  });

  // Atur ulang harga dan jangka waktu sewa (Harian/Mingguan/Bulanan/Tahunan) untuk penghuni aktif.
  app.patch('/api/penghuni/:id/sewa', (req, res) => {
    const id = idParam(req);
    const p = getPenghuni(id) as Row | undefined;
    if (!p) throw new HttpError(404, 'Penghuni tidak ditemukan.');
    if (p.aktif !== 1) throw new HttpError(409, 'Penghuni sudah tidak aktif.');
    const { data, errors } = validateSewaPenghuni(req.body ?? {}, p.tanggal_masuk as string);
    if (!data) throw new HttpError(422, 'Data pengaturan sewa tidak valid.', errors);

    transaction(() => {
      db.prepare(`
        UPDATE penghuni
        SET periode_sewa = ?, durasi_sewa = ?, harga_sewa = ?, tanggal_selesai_sewa = ?
        WHERE id = ?
      `).run(data.periode_sewa, data.durasi_sewa, data.harga_sewa, data.tanggal_selesai_sewa, id);

      if (data.update_tagihan) {
        const tagihanAktif = db.prepare(`
          SELECT id, (SELECT COALESCE(SUM(jumlah), 0) FROM pembayaran pb WHERE pb.tagihan_id = tagihan.id AND pb.dibatalkan_at IS NULL) AS terbayar
          FROM tagihan
          WHERE penghuni_id = ? AND status = 'Belum Lunas'
          ORDER BY bulan DESC, id DESC LIMIT 1
        `).get(id) as { id: number; terbayar: number } | undefined;

        if (tagihanAktif) {
          if (data.harga_sewa < tagihanAktif.terbayar) {
            throw new HttpError(
              422,
              `Harga sewa baru tidak boleh kurang dari nominal yang sudah dibayar (Rp ${tagihanAktif.terbayar.toLocaleString('id-ID')}).`,
              { harga_sewa: `Minimal Rp ${tagihanAktif.terbayar.toLocaleString('id-ID')} (sudah terbayar).` },
            );
          }
          db.prepare(`
            UPDATE tagihan
            SET nominal = ?, periode_sewa = ?, durasi_sewa = ?, updated_at = datetime('now')
            WHERE id = ?
          `).run(data.harga_sewa, data.periode_sewa, data.durasi_sewa, tagihanAktif.id);
          syncStatusTagihan(tagihanAktif.id);
        }
      }
    });

    res.json(getPenghuni(id));
  });

  app.patch('/api/penghuni/:id/keluar', (req, res) => {
    const id = idParam(req);
    const p = getPenghuni(id) as Row | undefined;
    if (!p) throw new HttpError(404, 'Penghuni tidak ditemukan.');
    if (p.aktif !== 1) throw new HttpError(409, 'Penghuni sudah tidak aktif.');
    const tanggal = typeof req.body?.tanggal_keluar === 'string' && req.body.tanggal_keluar
      ? req.body.tanggal_keluar : tanggalJakarta();
    if (!isIsoDate(tanggal) || tanggal < (p.tanggal_masuk as string) || tanggal > tanggalJakarta())
      throw new HttpError(422, 'Tanggal keluar tidak valid.', {
        tanggal_keluar: 'Tanggal keluar harus antara tanggal masuk dan hari ini.',
      });
    // Trigger trg_penghuni_keluar otomatis mengubah status kamar menjadi "Kosong".
    db.prepare('UPDATE penghuni SET aktif = 0, tanggal_keluar = ? WHERE id = ?').run(tanggal, id);
    res.json(getPenghuni(id));
  });

  // EP-05 WBS 5.1: kode sekali pakai untuk menghubungkan chat penghuni ke datanya.
  app.post('/api/penghuni/:id/kode-chat', (req, res) => {
    const id = idParam(req);
    const p = getPenghuni(id) as Row | undefined;
    if (!p) throw new HttpError(404, 'Penghuni tidak ditemukan.');
    if (p.aktif !== 1) throw new HttpError(409, 'Penghuni sudah tidak aktif.');
    res.json({ kode: buatKodeHubung(id) });
  });

  // ---------- Tagihan Bulanan & Status Pembayaran (WBS 2.1 - 2.3) ----------
  app.post('/api/tagihan/generate', (req, res) => {
    const { data, errors } = validateGenerateTagihan(req.body ?? {});
    if (!data) throw new HttpError(422, 'Parameter bulan tidak valid.', errors);
    if (data.bulan > tanggalJakarta().slice(0, 7))
      throw new HttpError(422, 'Tagihan bulan depan belum bisa dibuat.', { bulan: 'Pilih bulan berjalan atau sebelumnya.' });
    const result = generateTagihanBulan(data.bulan);
    res.json(result);
  });

  // Input atau perbarui tagihan langsung oleh pemilik dengan nominal dan jangka penyewaan yang diinginkan.
  app.post('/api/tagihan', (req, res) => {
    const { data, errors } = validateCreateTagihanManual(req.body ?? {});
    if (!data) throw new HttpError(422, 'Data tagihan tidak valid.', errors);

    const p = getPenghuni(data.penghuni_id) as Row | undefined;
    if (!p) throw new HttpError(422, 'Penghuni tidak ditemukan.', { penghuni_id: 'Penghuni tidak ditemukan.' });

    const tglSelesai = hitungTanggalSelesaiSewa(data.jatuh_tempo, data.periode_sewa, data.durasi_sewa);
    const tagihanId = transaction(() => {
      db.prepare(`
        UPDATE penghuni
        SET periode_sewa = ?, durasi_sewa = ?, harga_sewa = ?, tanggal_selesai_sewa = ?
        WHERE id = ?
      `).run(data.periode_sewa, data.durasi_sewa, data.nominal, tglSelesai, data.penghuni_id);

      const existing = db.prepare(`
        SELECT t.id, COALESCE((SELECT SUM(jumlah) FROM pembayaran pb WHERE pb.tagihan_id = t.id AND pb.dibatalkan_at IS NULL), 0) AS terbayar
        FROM tagihan t WHERE t.penghuni_id = ? AND t.bulan = ?
      `).get(data.penghuni_id, data.bulan) as { id: number; terbayar: number } | undefined;

      if (existing) {
        if (data.nominal < existing.terbayar) {
          const msg = `Nominal tagihan tidak boleh kurang dari jumlah yang sudah dibayar (Rp ${existing.terbayar.toLocaleString('id-ID')}).`;
          throw new HttpError(422, msg, { nominal: msg });
        }
        db.prepare(`
          UPDATE tagihan
          SET nominal = ?, periode_sewa = ?, durasi_sewa = ?, jatuh_tempo = ?, updated_at = datetime('now')
          WHERE id = ?
        `).run(data.nominal, data.periode_sewa, data.durasi_sewa, data.jatuh_tempo, existing.id);
        syncStatusTagihan(existing.id);
        if (data.catatan !== null) {
          db.prepare('UPDATE tagihan SET catatan = ? WHERE id = ?').run(data.catatan, existing.id);
        }
        return existing.id;
      }

      const ins = db.prepare(`
        INSERT INTO tagihan (penghuni_id, kamar_id, bulan, nominal, periode_sewa, durasi_sewa, status, jatuh_tempo, catatan)
        VALUES (?, ?, ?, ?, ?, ?, 'Belum Lunas', ?, ?)
      `).run(
        data.penghuni_id,
        p.kamar_id as number,
        data.bulan,
        data.nominal,
        data.periode_sewa,
        data.durasi_sewa,
        data.jatuh_tempo,
        data.catatan,
      );
      return Number(ins.lastInsertRowid);
    });

    const updated = getTagihan(tagihanId) as Row;
    appHooks.tagihanUpdated(updated);
    res.status(201).json(updated);
  });

  app.get('/api/tagihan', (req, res) => {
    const where: string[] = [];
    const params: (string | number)[] = [];
    const { bulan, status, q } = req.query;
    if (bulan !== undefined) {
      const result = validateGenerateTagihan({ bulan });
      if (!result.data) throw new HttpError(422, 'Parameter bulan tidak valid.', result.errors);
    }
    if (status !== undefined && !['', 'Lunas', 'Belum Lunas', 'Belum Bayar', 'Dicicil'].includes(status as string))
      throw new HttpError(422, 'Status tagihan tidak valid.');
    if (typeof bulan === 'string' && bulan.trim()) {
      where.push('t.bulan = ?');
      params.push(bulan.trim());
    }
    if (status === 'Lunas' || status === 'Belum Lunas') {
      where.push('t.status = ?');
      params.push(status);
    } else if (status === 'Belum Bayar') {
      where.push("t.status = 'Belum Lunas' AND COALESCE(pb.terbayar, 0) = 0");
    } else if (status === 'Dicicil') {
      where.push("t.status = 'Belum Lunas' AND COALESCE(pb.terbayar, 0) > 0");
    }
    if (typeof q === 'string' && q.trim()) {
      where.push('(p.nama LIKE ? OR k.nomor LIKE ? OR p.no_hp LIKE ?)');
      const s = `%${q.trim()}%`;
      params.push(s, s, s);
    }
    const sql = `${TAGIHAN_SELECT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
                 ORDER BY t.status ASC, t.jatuh_tempo ASC, k.nomor COLLATE NOCASE`;
    res.json(db.prepare(sql).all(...params));
  });

  app.get('/api/tagihan/rekap', (req, res) => {
    const { data, errors } = validateGenerateTagihan({ bulan: req.query.bulan });
    if (!data) throw new HttpError(422, 'Parameter bulan tidak valid.', errors);
    const { bulan } = data;

    const totals = db.prepare(REKAP_SELECT).get(bulan) as Row;

    const daftarLunas = db.prepare(`
      ${TAGIHAN_SELECT}
      WHERE t.bulan = ? AND t.status = 'Lunas'
      ORDER BY t.tanggal_bayar DESC, k.nomor COLLATE NOCASE
    `).all(bulan);

    const daftarBelumLunas = db.prepare(`
      ${TAGIHAN_SELECT}
      WHERE t.bulan = ? AND t.status = 'Belum Lunas'
      ORDER BY t.jatuh_tempo ASC, k.nomor COLLATE NOCASE
    `).all(bulan);

    const rows = db.prepare('SELECT DISTINCT bulan FROM tagihan ORDER BY bulan DESC').all() as { bulan: string }[];
    const bulanTersedia = rows.map((r) => r.bulan);
    if (!bulanTersedia.includes(bulan)) {
      bulanTersedia.unshift(bulan);
    }

    res.json({
      bulan,
      total_tagihan: totals.total_tagihan,
      total_nominal: totals.total_nominal,
      total_lunas: totals.total_lunas,
      nominal_lunas: totals.nominal_lunas,
      total_belum_lunas: totals.total_belum_lunas,
      nominal_belum_lunas: totals.nominal_belum_lunas,
      total_dicicil: totals.total_dicicil,
      nominal_dicicil: totals.nominal_dicicil,
      daftar_lunas: daftarLunas,
      daftar_belum_lunas: daftarBelumLunas,
      bulan_tersedia: bulanTersedia,
    });
  });

  // WBS 4.1: tagihan belum lunas yang perlu diingatkan hari ini (H-3, H-0) atau sudah terlambat.
  app.get('/api/tagihan/pengingat', (req, res) => {
    const tanggal = typeof req.query.tanggal === 'string' && req.query.tanggal ? req.query.tanggal : tanggalJakarta();
    if (!isIsoDate(tanggal)) throw new HttpError(422, 'Parameter tanggal tidak valid.', { tanggal: 'Format YYYY-MM-DD.' });
    res.json(daftarPengingat(tanggal));
  });

  app.get('/api/tagihan/:id', (req, res) => {
    const row = getTagihan(idParam(req));
    if (!row) throw new HttpError(404, 'Tagihan tidak ditemukan.');
    res.json(row);
  });

  // Atur langsung nominal, jangka sewa (Harian/Mingguan/Bulanan/Tahunan), jatuh tempo, atau catatan pada tagihan.
  app.patch('/api/tagihan/:id', (req, res) => {
    const id = idParam(req);
    const row = getTagihan(id) as Row | undefined;
    if (!row) throw new HttpError(404, 'Tagihan tidak ditemukan.');
    const { data, errors } = validateUpdateTagihan(req.body ?? {});
    if (!data) throw new HttpError(422, 'Data perubahan tagihan tidak valid.', errors);

    const terbayar = Number(row.terbayar ?? 0);
    if (data.nominal !== undefined && data.nominal < terbayar) {
      const msg = `Nominal tagihan tidak boleh kurang dari jumlah yang sudah dibayar (Rp ${terbayar.toLocaleString('id-ID')}).`;
      throw new HttpError(422, msg, { nominal: msg });
    }

    transaction(() => {
      db.prepare(`
        UPDATE tagihan
        SET nominal = COALESCE(?, nominal),
            periode_sewa = COALESCE(?, periode_sewa),
            durasi_sewa = COALESCE(?, durasi_sewa),
            jatuh_tempo = COALESCE(?, jatuh_tempo),
            updated_at = datetime('now')
        WHERE id = ?
      `).run(
        data.nominal ?? null,
        data.periode_sewa ?? null,
        data.durasi_sewa ?? null,
        data.jatuh_tempo ?? null,
        id,
      );
      syncStatusTagihan(id);
      if (data.catatan !== undefined) {
        db.prepare('UPDATE tagihan SET catatan = ? WHERE id = ?').run(data.catatan, id);
      }
    });

    const updated = getTagihan(id) as Row;
    appHooks.tagihanUpdated(updated);
    res.json(updated);
  });

  // WBS 2.3 (jalan pintas): lunasi SISA tagihan dalam 1 pembayaran. Bayar langsung 1 bulan = cukup ini.
  app.patch('/api/tagihan/:id/lunas', (req, res) => {
    const id = idParam(req);
    const row = getTagihan(id) as Row | undefined;
    if (!row) throw new HttpError(404, 'Tagihan tidak ditemukan.');
    if ((row.sisa as number) <= 0) throw new HttpError(409, 'Tagihan ini sudah lunas.');
    const { data, errors } = validateLunas(req.body ?? {});
    if (!data) throw new HttpError(422, 'Data konfirmasi pembayaran tidak valid.', errors);

    try {
      transaction(() => {
        db.prepare(
          'INSERT INTO pembayaran (tagihan_id, jumlah, tanggal_bayar, metode_pembayaran, catatan) VALUES (?, ?, ?, ?, ?)',
        ).run(id, row.sisa as number, data.tanggal_bayar, data.metode_pembayaran, data.catatan ?? null);
        if (data.catatan) db.prepare('UPDATE tagihan SET catatan = ? WHERE id = ?').run(data.catatan, id);
        syncStatusTagihan(id);
      });
    } catch (err) { mapDbError(err); }

    const updated = getTagihan(id) as Row;
    appHooks.pembayaranDicatat(updated);
    res.json(updated);
  });

  // Undo: batalkan SEMUA pembayaran aktif tagihan ini -> kembali 'Belum Lunas' (riwayat tetap tersimpan).
  app.patch('/api/tagihan/:id/batal', (req, res) => {
    const id = idParam(req);
    const row = getTagihan(id) as Row | undefined;
    if (!row) throw new HttpError(404, 'Tagihan tidak ditemukan.');

    if ((row.jumlah_pembayaran as number) === 0) throw new HttpError(409, 'Tagihan ini belum memiliki pembayaran.');
    transaction(() => {
      db.prepare("UPDATE pembayaran SET dibatalkan_at = datetime('now') WHERE tagihan_id = ? AND dibatalkan_at IS NULL").run(id);
      syncStatusTagihan(id);
    });

    res.json(getTagihan(id));
  });

  // ---------- EP-05 WBS 5.3-5.4: pembayaran online ----------
  const tanganiPembayaranError = (err: unknown): never => {
    if (err instanceof PembayaranError) throw new HttpError(err.status, err.message);
    throw err;
  };

  const kirimLangsung: Kirim = async (chatId, teks, tombol) => {
    if (!appHooks.kirimTelegram) {
      throw new HttpError(503, 'Bot Telegram belum aktif. Isi TELEGRAM_BOT_TOKEN di file .env lalu restart server.');
    }
    await appHooks.kirimTelegram(chatId, teks, tombol);
  };

  const tanganiTelegramError = (err: unknown): never => {
    if (err instanceof TelegramBelumTerhubungError) throw new HttpError(409, err.message);
    throw err;
  };

  app.post('/api/tagihan/:id/kirim-telegram', async (req, res) => {
    const row = getTagihan(idParam(req)) as Row | undefined;
    if (!row) throw new HttpError(404, 'Tagihan tidak ditemukan.');
    await kirimPesanTagihanPenghuni(row, kirimLangsung).catch(tanganiTelegramError);
    res.json({ terkirim: true });
  });

  app.post('/api/tagihan/:id/kirim-kuitansi-telegram', async (req, res) => {
    const id = idParam(req);
    const row = getTagihan(id) as Row | undefined;
    if (!row) throw new HttpError(404, 'Tagihan tidak ditemukan.');
    const pembayaranList = getPembayaranList(id) as Row[];
    await kirimKuitansiTelegram(row, pembayaranList, kirimLangsung).catch(tanganiTelegramError);
    res.json({ terkirim: true });
  });

  app.post('/api/tagihan/:id/link-bayar', async (req, res) => {
    const trx = await buatLinkPembayaran(idParam(req)).catch(tanganiPembayaranError);
    res.status(201).json({ order_id: trx.order_id, payment_url: trx.payment_url, jumlah: trx.jumlah, provider: trx.provider });
  });

  app.get('/api/tagihan/:id/transaksi-online', (req, res) => {
    const id = idParam(req);
    if (!getTagihan(id)) throw new HttpError(404, 'Tagihan tidak ditemukan.');
    res.json(db.prepare(`SELECT order_id, provider, jumlah, payment_url, status, created_at, updated_at
      FROM transaksi_online WHERE tagihan_id = ? ORDER BY id DESC`).all(id));
  });

  // Notifikasi HTTP dari Midtrans (butuh URL publik); tanpa itu server memeriksa status berkala.
  app.post('/api/pembayaran-online/notifikasi', (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    if (!signatureValid(body)) throw new HttpError(403, 'Signature tidak valid.');
    try {
      terapkanStatus(String(body.order_id), petaStatusMidtrans(String(body.transaction_status), body.fraud_status as string | undefined));
    } catch (err) { tanganiPembayaranError(err); }
    res.json({ ok: true });
  });

  // Mode simulasi (tanpa akun payment gateway): halaman bayar tiruan.
  app.get('/api/pembayaran-online/simulasi/:orderId', (req, res) => {
    res.type('html').send(halamanSimulasi(req.params.orderId));
  });
  app.post('/api/pembayaran-online/simulasi/:orderId', (req, res) => {
    const trx = db.prepare('SELECT provider FROM transaksi_online WHERE order_id = ?').get(req.params.orderId) as Row | undefined;
    if (!trx || trx.provider !== 'simulasi' || providerAktif() !== 'simulasi') throw new HttpError(404, 'Transaksi simulasi tidak ditemukan.');
    terapkanStatus(req.params.orderId, 'berhasil');
    res.type('html').send(halamanSimulasi(req.params.orderId, true));
  });

  // ---------- Pembayaran / Cicilan (request klien) ----------
  app.get('/api/tagihan/:id/pembayaran', (req, res) => {
    const id = idParam(req);
    if (!getTagihan(id)) throw new HttpError(404, 'Tagihan tidak ditemukan.');
    res.json(getPembayaranList(id));
  });

  // Catat 1 pembayaran (cicilan atau penuh). Status otomatis 'Lunas' bila total >= nominal.
  app.post('/api/tagihan/:id/pembayaran', (req, res) => {
    const id = idParam(req);
    const row = getTagihan(id) as Row | undefined;
    if (!row) throw new HttpError(404, 'Tagihan tidak ditemukan.');
    const sisa = row.sisa as number;
    if (sisa <= 0) throw new HttpError(409, 'Tagihan ini sudah lunas.');
    const { data, errors } = validatePembayaran(req.body ?? {});
    if (!data) throw new HttpError(422, 'Data pembayaran tidak valid.', errors);
    if (data.jumlah > sisa) {
      const msg = `Jumlah bayar melebihi sisa tagihan (sisa Rp ${sisa.toLocaleString('id-ID')}).`;
      throw new HttpError(422, msg, { jumlah: msg });
    }

    try {
      transaction(() => {
        db.prepare(
          'INSERT INTO pembayaran (tagihan_id, jumlah, tanggal_bayar, metode_pembayaran, catatan) VALUES (?, ?, ?, ?, ?)',
        ).run(id, data.jumlah, data.tanggal_bayar, data.metode_pembayaran, data.catatan ?? null);
        syncStatusTagihan(id);
      });
    } catch (err) { mapDbError(err); }

    const updated = getTagihan(id) as Row;
    appHooks.pembayaranDicatat(updated);
    res.status(201).json(updated);
  });

  // Undo 1 pembayaran (mis. salah input nominal cicilan); ditandai batal, tidak dihapus.
  app.delete('/api/pembayaran/:id', (req, res) => {
    const id = idParam(req);
    const pb = db.prepare('SELECT tagihan_id FROM pembayaran WHERE id = ? AND dibatalkan_at IS NULL').get(id) as { tagihan_id: number } | undefined;
    if (!pb) throw new HttpError(404, 'Pembayaran tidak ditemukan.');

    transaction(() => {
      db.prepare("UPDATE pembayaran SET dibatalkan_at = datetime('now') WHERE id = ?").run(id);
      syncStatusTagihan(pb.tagihan_id);
    });

    res.json(getTagihan(pb.tagihan_id));
  });

  app.delete('/api/tagihan/:id', (req, res) => {
    const id = idParam(req);
    const row = getTagihan(id) as Row | undefined;
    if (!row) throw new HttpError(404, 'Tagihan tidak ditemukan.');
    try { db.prepare('DELETE FROM tagihan WHERE id = ?').run(id); }
    catch (err) { mapDbError(err); }
    res.status(204).end();
  });

  // ---------- EP-03: Sistem Manajemen Keluhan Fasilitas (WBS 3.1 & 3.2) ----------
  app.get('/api/keluhan/rekap', (_req, res) => {
    const r = db.prepare(KELUHAN_REKAP_SELECT).get() as Row;
    res.json({
      total: r.total,
      pending: r.pending,
      diproses: r.diproses,
      selesai: r.selesai,
      aktif: Number(r.pending ?? 0) + Number(r.diproses ?? 0),
    });
  });

  app.get('/api/keluhan', (req, res) => {
    const where: string[] = [];
    const params: (string | number)[] = [];
    const { status, prioritas, kamar_id, penghuni_id, q } = req.query;

    if (status !== undefined && !['', 'Pending', 'Diproses', 'Selesai'].includes(status as string))
      throw new HttpError(422, 'Status keluhan tidak valid.');
    if (status === 'Pending' || status === 'Diproses' || status === 'Selesai') {
      where.push('kl.status = ?');
      params.push(status);
    }
    if (prioritas === 'Rendah' || prioritas === 'Sedang' || prioritas === 'Tinggi') {
      where.push('kl.prioritas = ?');
      params.push(prioritas);
    }
    if (typeof kamar_id === 'string' && kamar_id !== '' && Number.isInteger(Number(kamar_id))) {
      where.push('kl.kamar_id = ?');
      params.push(Number(kamar_id));
    }
    if (typeof penghuni_id === 'string' && penghuni_id !== '' && Number.isInteger(Number(penghuni_id))) {
      where.push('kl.penghuni_id = ?');
      params.push(Number(penghuni_id));
    }
    if (typeof q === 'string' && q.trim()) {
      where.push(
        '(kl.judul LIKE ? OR kl.deskripsi LIKE ? OR kl.kategori LIKE ? OR k.nomor LIKE ? OR p.nama LIKE ?)',
      );
      const s = `%${q.trim()}%`;
      params.push(s, s, s, s, s);
    }

    const sql = `${KELUHAN_SELECT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
                 ORDER BY
                   CASE kl.status
                     WHEN 'Pending' THEN 1
                     WHEN 'Diproses' THEN 2
                     WHEN 'Selesai' THEN 3
                   END ASC,
                   CASE kl.prioritas
                     WHEN 'Tinggi' THEN 1
                     WHEN 'Sedang' THEN 2
                     WHEN 'Rendah' THEN 3
                   END ASC,
                   kl.tanggal_lapor DESC,
                   kl.id DESC`;
    res.json(db.prepare(sql).all(...params));
  });

  app.get('/api/keluhan/:id', (req, res) => {
    const row = getKeluhan(idParam(req));
    if (!row) throw new HttpError(404, 'Laporan keluhan tidak ditemukan.');
    res.json(row);
  });

  // WBS 3.1: Endpoint simpan keluhan penghuni (BE)
  app.post('/api/keluhan', (req, res) => {
    const { data, errors } = validateKeluhan(req.body ?? {});
    if (!data) throw new HttpError(422, 'Data laporan keluhan tidak valid.', errors);

    const kamar = getKamar(data.kamar_id) as Row | undefined;
    if (!kamar) throw new HttpError(422, 'Kamar tidak ditemukan.', { kamar_id: 'Kamar tidak ditemukan.' });

    let penghuniId = data.penghuni_id;
    if (penghuniId !== null) {
      const penghuni = getPenghuni(penghuniId) as Row | undefined;
      if (!penghuni) throw new HttpError(422, 'Penghuni tidak ditemukan.', { penghuni_id: 'Penghuni tidak ditemukan.' });
      if (penghuni.aktif !== 1 || penghuni.kamar_id !== data.kamar_id)
        throw new HttpError(422, 'Penghuni bukan penghuni aktif kamar ini.', {
          penghuni_id: 'Penghuni bukan penghuni aktif kamar ini.',
        });
    } else if (kamar.penghuni_id) {
      penghuniId = Number(kamar.penghuni_id);
    }

    try {
      const r = db
        .prepare(
          `INSERT INTO keluhan (kamar_id, penghuni_id, judul, deskripsi, kategori, prioritas, foto_url, status, tanggal_lapor)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'Pending', ?)`,
        )
        .run(
          data.kamar_id,
          penghuniId,
          data.judul,
          data.deskripsi,
          data.kategori,
          data.prioritas,
          data.foto_url,
          data.tanggal_lapor,
        );
      res.status(201).json(getKeluhan(r.lastInsertRowid));
    } catch (err) {
      mapDbError(err);
    }
  });

  // WBS 3.2: Endpoint update status keluhan Pending/Diproses/Selesai (BE)
  const handleUpdateStatusKeluhan = (req: Request, res: Response) => {
    const id = idParam(req);
    const existing = getKeluhan(id) as Row | undefined;
    if (!existing) throw new HttpError(404, 'Laporan keluhan tidak ditemukan.');

    const { data, errors } = validateStatusKeluhan(req.body ?? {});
    if (!data) throw new HttpError(422, 'Data pembaruan status keluhan tidak valid.', errors);

    const catatanFinal =
      data.catatan_penanganan !== null
        ? data.catatan_penanganan || null
        : (existing.catatan_penanganan as string | null);

    const statusLama = existing.status as StatusKeluhan;
    const statusBaru: StatusKeluhan = data.status;
    // Alur berurutan Pending -> Diproses -> Selesai; Selesai hanya bisa dibuka kembali ke Diproses.
    const bolehPindah: Record<StatusKeluhan, StatusKeluhan[]> = {
      Pending: ['Pending', 'Diproses'],
      Diproses: ['Diproses', 'Selesai'],
      Selesai: ['Selesai', 'Diproses'],
    };
    if (!bolehPindah[statusLama].includes(statusBaru)) {
      const tujuan = bolehPindah[statusLama].filter((s) => s !== statusLama).join(', ');
      throw new HttpError(409, `Status keluhan tidak bisa diubah dari ${statusLama} ke ${statusBaru}.`, {
        status: `Dari ${statusLama} hanya bisa ke: ${tujuan}.`,
      });
    }
    const tanggalSelesai =
      statusBaru !== 'Selesai'
        ? null
        : data.tanggal_selesai ?? (statusLama === 'Selesai' ? (existing.tanggal_selesai as string) : tanggalJakarta());
    if (tanggalSelesai && tanggalSelesai < (existing.tanggal_lapor as string))
      throw new HttpError(422, 'Tanggal selesai tidak boleh sebelum tanggal lapor.', {
        tanggal_selesai: 'Tanggal selesai tidak boleh sebelum tanggal lapor.',
      });

    db.prepare(
      `UPDATE keluhan
       SET status = ?,
           catatan_penanganan = ?,
           tanggal_selesai = ?,
           updated_at = datetime('now')
       WHERE id = ?`,
    ).run(statusBaru, catatanFinal, tanggalSelesai, id);

    const updated = getKeluhan(id) as Row;
    appHooks.keluhanStatusChanged(updated);
    res.json(updated);
  };

  app.patch('/api/keluhan/:id/status', handleUpdateStatusKeluhan);
  app.put('/api/keluhan/:id/status', handleUpdateStatusKeluhan);

  app.post('/api/keluhan/:id/kirim-telegram', async (req, res) => {
    const row = getKeluhan(idParam(req)) as Row | undefined;
    if (!row) throw new HttpError(404, 'Laporan keluhan tidak ditemukan.');
    await kirimPesanKeluhanPenghuni(row, kirimLangsung).catch(tanganiTelegramError);
    res.json({ terkirim: true });
  });

  // Hapus seluruh riwayat keluhan yang sudah berstatus 'Selesai'.
  app.delete('/api/keluhan/riwayat', (_req, res) => {
    const r = db.prepare("DELETE FROM keluhan WHERE status = 'Selesai'").run();
    res.json({ dihapus: Number(r.changes) });
  });

  // Hapus satu riwayat keluhan (hanya jika status sudah 'Selesai').
  app.delete('/api/keluhan/:id', (req, res) => {
    const id = idParam(req);
    const row = getKeluhan(id) as Row | undefined;
    if (!row) throw new HttpError(404, 'Laporan keluhan tidak ditemukan.');
    if (row.status !== 'Selesai') {
      throw new HttpError(409, 'Selesaikan keluhan terlebih dahulu sebelum menghapus riwayatnya.');
    }
    db.prepare('DELETE FROM keluhan WHERE id = ?').run(id);
    res.status(204).end();
  });

  // ---------- Error handling & Frontend Produksi ----------
  app.use('/api', (_req, _res, next) => next(new HttpError(404, 'Endpoint tidak ditemukan.')));

  const distDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
  if (existsSync(join(distDir, 'index.html'))) {
    app.use(express.static(distDir));
    app.use((req, res, next) => {
      if (req.method === 'GET' && !req.path.startsWith('/api')) {
        res.sendFile(join(distDir, 'index.html'));
        return;
      }
      next();
    });
  }

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof HttpError) {
      res.status(err.status).json({ message: err.message, errors: err.errors });
      return;
    }
    if ((err as { type?: string })?.type === 'entity.too.large') {
      res.status(413).json({ message: 'Data yang dikirim terlalu besar.' });
      return;
    }
    if (err instanceof SyntaxError) {
      res.status(400).json({ message: 'Body JSON tidak valid.' });
      return;
    }
    console.error(err);
    res.status(500).json({ message: 'Terjadi kesalahan di server.' });
  });

  return app;
}
