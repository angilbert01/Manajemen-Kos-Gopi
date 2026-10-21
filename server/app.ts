import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import { db, migrate, transaction } from './db.ts';
import { validateAdmin, validateKamar, validatePenghuni } from './validation.ts';

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

const ADMIN_COLS = 'id, nama, peran, email, no_hp, nama_kos, alamat_kos, avatar_url, aktif, created_at, updated_at';

const getKamar = (id: number | bigint) => db.prepare(`${KAMAR_SELECT} WHERE k.id = ?`).get(id);
const getPenghuni = (id: number | bigint) => db.prepare(`${PENGHUNI_SELECT} WHERE p.id = ?`).get(id);
const getAdmin = (id: number | bigint) => db.prepare(`SELECT ${ADMIN_COLS} FROM admin_profile WHERE id = ?`).get(id);

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
    res.json({
      total_kamar: r.total,
      kamar_terisi: r.terisi,
      kamar_kosong: r.kosong,
      total_penghuni,
      pendapatan_bulanan: r.pendapatan_bulanan,
      potensi_pendapatan: r.potensi_pendapatan,
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
        // Riwayat penghuni non-aktif ikut dihapus agar FK tidak menghalangi.
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
