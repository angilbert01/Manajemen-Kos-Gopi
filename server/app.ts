import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import { db, migrate, transaction } from './db.ts';
import {
  validateAdmin,
  validateGenerateTagihan,
  validateKamar,
  validateLunas,
  validatePembayaran,
  validatePenghuni,
} from './validation.ts';

type Row = Record<string, unknown>;

const KAMAR_SELECT = `
  SELECT k.id, k.nomor, k.tipe, k.harga, k.status, k.foto_url, k.created_at, k.updated_at,
         p.id AS penghuni_id, p.nama AS penghuni_nama, p.no_hp AS penghuni_no_hp, p.tanggal_masuk AS penghuni_masuk
  FROM kamar k
  LEFT JOIN penghuni p ON p.kamar_id = k.id AND p.aktif = 1`;

const PENGHUNI_SELECT = `
  SELECT p.id, p.nama, p.no_hp, p.kamar_id, k.nomor AS kamar_nomor, k.tipe AS kamar_tipe, k.harga AS kamar_harga,
         p.tanggal_masuk, p.tanggal_keluar, p.aktif, p.created_at
  FROM penghuni p JOIN kamar k ON k.id = p.kamar_id`;

// Agregat pembayaran per tagihan (mendukung cicilan): total terbayar & jumlah transaksi.
const PEMBAYARAN_AGG = `
  LEFT JOIN (
    SELECT tagihan_id, SUM(jumlah) AS terbayar, COUNT(*) AS jumlah_pembayaran
    FROM pembayaran GROUP BY tagihan_id
  ) pb ON pb.tagihan_id = t.id`;

const TAGIHAN_SELECT = `
  SELECT t.id, t.penghuni_id, t.kamar_id, t.bulan, t.nominal, t.status,
         t.jatuh_tempo, t.tanggal_bayar, t.metode_pembayaran, t.catatan,
         t.created_at, t.updated_at,
         COALESCE(pb.terbayar, 0) AS terbayar,
         MAX(t.nominal - COALESCE(pb.terbayar, 0), 0) AS sisa,
         COALESCE(pb.jumlah_pembayaran, 0) AS jumlah_pembayaran,
         CASE WHEN t.status = 'Lunas' THEN 'Lunas'
              WHEN COALESCE(pb.terbayar, 0) > 0 THEN 'Dicicil'
              ELSE 'Belum Bayar' END AS status_bayar,
         p.nama AS penghuni_nama, p.no_hp AS penghuni_no_hp, p.tanggal_masuk AS penghuni_masuk,
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

const getKamar = (id: number | bigint) => db.prepare(`${KAMAR_SELECT} WHERE k.id = ?`).get(id);
const getPenghuni = (id: number | bigint) => db.prepare(`${PENGHUNI_SELECT} WHERE p.id = ?`).get(id);
const getAdmin = (id: number | bigint) => db.prepare(`SELECT ${ADMIN_COLS} FROM admin_profile WHERE id = ?`).get(id);
const getTagihan = (id: number | bigint) => db.prepare(`${TAGIHAN_SELECT} WHERE t.id = ?`).get(id);
const getPembayaranList = (tagihanId: number | bigint) =>
  db.prepare(`SELECT id, tagihan_id, jumlah, tanggal_bayar, metode_pembayaran, catatan, created_at
              FROM pembayaran WHERE tagihan_id = ? ORDER BY tanggal_bayar ASC, id ASC`).all(tagihanId);

/**
 * Hitung ulang status tagihan dari total pembayaran:
 * total >= nominal -> 'Lunas' (tanggal_bayar = tanggal pembayaran terakhir), selain itu 'Belum Lunas'.
 */
function syncStatusTagihan(tagihanId: number | bigint) {
  const t = db.prepare('SELECT nominal FROM tagihan WHERE id = ?').get(tagihanId) as { nominal: number } | undefined;
  if (!t) return;
  const agg = db.prepare(
    'SELECT COALESCE(SUM(jumlah), 0) AS terbayar, MAX(tanggal_bayar) AS terakhir FROM pembayaran WHERE tagihan_id = ?',
  ).get(tagihanId) as { terbayar: number; terakhir: string | null };
  const last = db.prepare(
    'SELECT metode_pembayaran FROM pembayaran WHERE tagihan_id = ? ORDER BY tanggal_bayar DESC, id DESC LIMIT 1',
  ).get(tagihanId) as { metode_pembayaran: string } | undefined;
  const lunas = agg.terbayar >= t.nominal;
  db.prepare(`
    UPDATE tagihan
    SET status = ?, tanggal_bayar = ?, metode_pembayaran = COALESCE(?, metode_pembayaran), updated_at = datetime('now')
    WHERE id = ?
  `).run(lunas ? 'Lunas' : 'Belum Lunas', lunas ? agg.terakhir : null, last?.metode_pembayaran ?? null, tagihanId);
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
    SELECT p.id AS penghuni_id, p.kamar_id, p.tanggal_masuk, k.harga, k.nomor AS kamar_nomor, p.nama AS penghuni_nama
    FROM penghuni p
    JOIN kamar k ON k.id = p.kamar_id
    WHERE p.aktif = 1
  `).all() as {
    penghuni_id: number;
    kamar_id: number;
    tanggal_masuk: string;
    harga: number;
    kamar_nomor: string;
    penghuni_nama: string;
  }[];

  let dibuat = 0;
  let dilewati = 0;

  transaction(() => {
    const checkStmt = db.prepare('SELECT id FROM tagihan WHERE penghuni_id = ? AND bulan = ?');
    const insStmt = db.prepare(`
      INSERT INTO tagihan (penghuni_id, kamar_id, bulan, nominal, status, jatuh_tempo)
      VALUES (?, ?, ?, ?, 'Belum Lunas', ?)
    `);

    for (const p of activePenghuni) {
      // Lewati jika penghuni baru mulai masuk setelah bulan target
      const bulanMasuk = p.tanggal_masuk.slice(0, 7);
      if (bulanMasuk > targetBulan) continue;

      const existing = checkStmt.get(p.penghuni_id, targetBulan);
      if (existing) {
        dilewati++;
      } else {
        const jatuhTempo = hitungJatuhTempo(p.tanggal_masuk, targetBulan);
        insStmt.run(p.penghuni_id, p.kamar_id, targetBulan, p.harga, jatuhTempo);
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
  if (msg.includes('FOREIGN KEY constraint failed'))
    throw new HttpError(409, 'Data masih dipakai oleh data lain.');
  throw err;
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
        COALESCE(SUM(status = 'Terisi'), 0) AS terisi,
        COALESCE(SUM(status = 'Kosong'), 0) AS kosong,
        COALESCE(SUM(CASE WHEN status = 'Terisi' THEN harga ELSE 0 END), 0) AS pendapatan_bulanan,
        COALESCE(SUM(harga), 0) AS potensi_pendapatan
      FROM kamar
    `).get() as Row;
    const { total_penghuni } = db.prepare('SELECT COUNT(*) AS total_penghuni FROM penghuni WHERE aktif = 1').get() as {
      total_penghuni: number;
    };
    const d = new Date();
    const currentBulan = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const tagihanRekap = db.prepare(REKAP_SELECT).get(currentBulan) as Row;

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
      const r = db.prepare('INSERT INTO kamar (nomor, tipe, harga, foto_url) VALUES (?, ?, ?, ?)')
        .run(data.nomor, data.tipe, data.harga, data.foto_url);
      res.status(201).json(getKamar(r.lastInsertRowid));
    } catch (err) { mapDbError(err); }
  });

  app.put('/api/kamar/:id', (req, res) => {
    const id = idParam(req);
    if (!getKamar(id)) throw new HttpError(404, 'Kamar tidak ditemukan.');
    const { data, errors } = validateKamar(req.body ?? {});
    if (!data) throw new HttpError(422, 'Data kamar tidak valid.', errors);
    try {
      db.prepare(`UPDATE kamar SET nomor = ?, tipe = ?, harga = ?, foto_url = ?, updated_at = datetime('now')
                  WHERE id = ?`).run(data.nomor, data.tipe, data.harga, data.foto_url, id);
      res.json(getKamar(id));
    } catch (err) { mapDbError(err); }
  });

  app.delete('/api/kamar/:id', (req, res) => {
    const id = idParam(req);
    if (!getKamar(id)) throw new HttpError(404, 'Kamar tidak ditemukan.');
    try {
      transaction(() => {
        // Tagihan & riwayat penghuni non-aktif kamar ini ikut dibersihkan.
        db.prepare('DELETE FROM tagihan WHERE kamar_id = ?').run(id);
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
                         ORDER BY p.aktif DESC, p.nama COLLATE NOCASE`).all());
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
      const r = db.prepare('INSERT INTO penghuni (nama, no_hp, kamar_id, tanggal_masuk) VALUES (?, ?, ?, ?)')
        .run(data.nama, data.no_hp, data.kamar_id, data.tanggal_masuk);

      // WBS 2.1: Otomatis buat tagihan bulan berjalan untuk penghuni baru
      const targetBulan = data.tanggal_masuk.slice(0, 7);
      const jatuhTempo = hitungJatuhTempo(data.tanggal_masuk, targetBulan);
      try {
        db.prepare(`
          INSERT OR IGNORE INTO tagihan (penghuni_id, kamar_id, bulan, nominal, status, jatuh_tempo)
          VALUES (?, ?, ?, ?, 'Belum Lunas', ?)
        `).run(r.lastInsertRowid, data.kamar_id, targetBulan, kamar.harga as number, jatuhTempo);
      } catch {
        // Abaikan jika sudah ada
      }

      res.status(201).json(getPenghuni(r.lastInsertRowid));
    } catch (err) { mapDbError(err); }
  });

  app.patch('/api/penghuni/:id/keluar', (req, res) => {
    const id = idParam(req);
    const p = getPenghuni(id) as Row | undefined;
    if (!p) throw new HttpError(404, 'Penghuni tidak ditemukan.');
    if (p.aktif !== 1) throw new HttpError(409, 'Penghuni sudah tidak aktif.');
    const tanggal = typeof req.body?.tanggal_keluar === 'string' && req.body.tanggal_keluar
      ? req.body.tanggal_keluar : new Date().toISOString().slice(0, 10);
    // Trigger trg_penghuni_keluar otomatis mengubah status kamar menjadi "Kosong".
    db.prepare('UPDATE penghuni SET aktif = 0, tanggal_keluar = ? WHERE id = ?').run(tanggal, id);
    res.json(getPenghuni(id));
  });

  // ---------- Tagihan Bulanan & Status Pembayaran (WBS 2.1 - 2.3) ----------
  app.post('/api/tagihan/generate', (req, res) => {
    const { data, errors } = validateGenerateTagihan(req.body ?? {});
    if (!data) throw new HttpError(422, 'Parameter bulan tidak valid.', errors);
    const result = generateTagihanBulan(data.bulan);
    res.json(result);
  });

  app.get('/api/tagihan', (req, res) => {
    const where: string[] = [];
    const params: (string | number)[] = [];
    const { bulan, status, q } = req.query;
    if (typeof bulan === 'string' && bulan.trim()) {
      where.push('t.bulan = ?');
      params.push(bulan.trim());
    }
    if (status === 'Lunas' || status === 'Belum Lunas') {
      where.push('t.status = ?');
      params.push(status);
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
    let bulan = typeof req.query.bulan === 'string' && req.query.bulan.trim() ? req.query.bulan.trim() : '';
    if (!bulan) {
      const d = new Date();
      bulan = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }

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

  app.get('/api/tagihan/:id', (req, res) => {
    const row = getTagihan(idParam(req));
    if (!row) throw new HttpError(404, 'Tagihan tidak ditemukan.');
    res.json(row);
  });

  // WBS 2.3 (jalan pintas): lunasi SISA tagihan dalam 1 pembayaran. Bayar langsung 1 bulan = cukup ini.
  app.patch('/api/tagihan/:id/lunas', (req, res) => {
    const id = idParam(req);
    const row = getTagihan(id) as Row | undefined;
    if (!row) throw new HttpError(404, 'Tagihan tidak ditemukan.');
    if ((row.sisa as number) <= 0) throw new HttpError(409, 'Tagihan ini sudah lunas.');
    const { data, errors } = validateLunas(req.body ?? {});
    if (!data) throw new HttpError(422, 'Data konfirmasi pembayaran tidak valid.', errors);

    transaction(() => {
      db.prepare(
        'INSERT INTO pembayaran (tagihan_id, jumlah, tanggal_bayar, metode_pembayaran, catatan) VALUES (?, ?, ?, ?, ?)',
      ).run(id, row.sisa as number, data.tanggal_bayar, data.metode_pembayaran, data.catatan ?? null);
      if (data.catatan) db.prepare('UPDATE tagihan SET catatan = ? WHERE id = ?').run(data.catatan, id);
      syncStatusTagihan(id);
    });

    res.json(getTagihan(id));
  });

  // Undo: hapus SEMUA pembayaran tagihan ini -> kembali 'Belum Lunas'.
  app.patch('/api/tagihan/:id/batal', (req, res) => {
    const id = idParam(req);
    const row = getTagihan(id) as Row | undefined;
    if (!row) throw new HttpError(404, 'Tagihan tidak ditemukan.');

    transaction(() => {
      db.prepare('DELETE FROM pembayaran WHERE tagihan_id = ?').run(id);
      syncStatusTagihan(id);
    });

    res.json(getTagihan(id));
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

    transaction(() => {
      db.prepare(
        'INSERT INTO pembayaran (tagihan_id, jumlah, tanggal_bayar, metode_pembayaran, catatan) VALUES (?, ?, ?, ?, ?)',
      ).run(id, data.jumlah, data.tanggal_bayar, data.metode_pembayaran, data.catatan ?? null);
      syncStatusTagihan(id);
    });

    res.status(201).json(getTagihan(id));
  });

  // Undo 1 pembayaran (mis. salah input nominal cicilan).
  app.delete('/api/pembayaran/:id', (req, res) => {
    const id = idParam(req);
    const pb = db.prepare('SELECT tagihan_id FROM pembayaran WHERE id = ?').get(id) as { tagihan_id: number } | undefined;
    if (!pb) throw new HttpError(404, 'Pembayaran tidak ditemukan.');

    transaction(() => {
      db.prepare('DELETE FROM pembayaran WHERE id = ?').run(id);
      syncStatusTagihan(pb.tagihan_id);
    });

    res.json(getTagihan(pb.tagihan_id));
  });

  app.delete('/api/tagihan/:id', (req, res) => {
    const id = idParam(req);
    const row = getTagihan(id) as Row | undefined;
    if (!row) throw new HttpError(404, 'Tagihan tidak ditemukan.');
    db.prepare('DELETE FROM tagihan WHERE id = ?').run(id);
    res.status(204).end();
  });

  // ---------- Error handling ----------
  app.use('/api', (_req, _res, next) => next(new HttpError(404, 'Endpoint tidak ditemukan.')));
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof HttpError) {
      res.status(err.status).json({ message: err.message, errors: err.errors });
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
