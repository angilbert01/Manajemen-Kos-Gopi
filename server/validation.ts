// Validasi input sesuai acceptance criteria EP-01 (lihat Konteks/Dokumen BA & QA Sprint 1).

export type Errors = Record<string, string>;

export interface KamarInput { nomor: string; tipe: string; harga: number; foto_url: string | null }
export interface PenghuniInput { nama: string; no_hp: string; kamar_id: number; tanggal_masuk: string }
export interface AdminInput {
  nama: string;
  peran: string;
  email: string;
  no_hp: string;
  nama_kos: string;
  alamat_kos: string;
  avatar_url: string;
}

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const isIsoDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));

/** Normalisasi no HP: buang spasi/strip/titik. Format valid: 08xx / 628xx / +628xx, 10–15 digit. */
export const normalizePhone = (v: string) => v.replace(/[\s.-]/g, '');
export const PHONE_RE = /^(\+62|62|0)8\d{7,12}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateKamar(body: Record<string, unknown>): { data?: KamarInput; errors?: Errors } {
  const errors: Errors = {};
  const nomor = str(body.nomor);
  const tipe = str(body.tipe);
  const harga = Number(body.harga);
  const foto = str(body.foto_url);
  if (!nomor) errors.nomor = 'Nomor kamar wajib diisi.';
  else if (nomor.length > 20) errors.nomor = 'Nomor kamar maksimal 20 karakter.';
  if (!tipe) errors.tipe = 'Tipe kamar wajib diisi.';
  if (body.harga === undefined || body.harga === null || body.harga === '') errors.harga = 'Harga wajib diisi.';
  else if (!Number.isInteger(harga) || harga <= 0) errors.harga = 'Harga harus bilangan bulat lebih dari 0.';
  if (foto && !/^https?:\/\//i.test(foto)) errors.foto_url = 'URL foto harus diawali http:// atau https://';
  if (Object.keys(errors).length) return { errors };
  return { data: { nomor, tipe, harga, foto_url: foto || null } };
}

export function validatePenghuni(body: Record<string, unknown>): { data?: PenghuniInput; errors?: Errors } {
  const errors: Errors = {};
  const nama = str(body.nama);
  const no_hp = normalizePhone(str(body.no_hp));
  const kamar_id = Number(body.kamar_id);
  const tanggal_masuk = str(body.tanggal_masuk);
  if (!nama) errors.nama = 'Nama wajib diisi.';
  else if (nama.length > 100) errors.nama = 'Nama maksimal 100 karakter.';
  if (!no_hp) errors.no_hp = 'Nomor HP wajib diisi.';
  else if (!PHONE_RE.test(no_hp)) errors.no_hp = 'Nomor HP tidak valid (contoh: 081234567890).';
  if (!Number.isInteger(kamar_id) || kamar_id <= 0) errors.kamar_id = 'Pilih kamar.';
  if (!tanggal_masuk) errors.tanggal_masuk = 'Tanggal masuk wajib diisi.';
  else if (!isIsoDate(tanggal_masuk)) errors.tanggal_masuk = 'Format tanggal tidak valid.';
  if (Object.keys(errors).length) return { errors };
  return { data: { nama, no_hp, kamar_id, tanggal_masuk } };
}

export function validateAdmin(body: Record<string, unknown>): { data?: AdminInput; errors?: Errors } {
  const errors: Errors = {};
  const nama = str(body.nama);
  const peran = str(body.peran) || 'Pemilik Kos';
  const email = str(body.email);
  const no_hp = normalizePhone(str(body.no_hp));
  const nama_kos = str(body.nama_kos) || 'Kos Gopi';
  const alamat_kos = str(body.alamat_kos);
  const avatar_url = str(body.avatar_url) || '/img/user.jpg';

  if (!nama) errors.nama = 'Nama admin wajib diisi.';
  if (!email) errors.email = 'Email wajib diisi.';
  else if (!EMAIL_RE.test(email)) errors.email = 'Format email tidak valid.';
  if (!no_hp) errors.no_hp = 'Nomor HP wajib diisi.';
  else if (!PHONE_RE.test(no_hp)) errors.no_hp = 'Nomor HP tidak valid (contoh: 081234567890).';
  if (!nama_kos) errors.nama_kos = 'Nama kos wajib diisi.';

  if (Object.keys(errors).length) return { errors };
  return { data: { nama, peran, email, no_hp, nama_kos, alamat_kos, avatar_url } };
}

export interface GenerateTagihanInput {
  bulan: string; // YYYY-MM
}

export interface LunasInput {
  tanggal_bayar: string;
  metode_pembayaran: string;
  catatan?: string;
}

const BULAN_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export function validateGenerateTagihan(body: Record<string, unknown>): { data?: GenerateTagihanInput; errors?: Errors } {
  const errors: Errors = {};
  let bulan = str(body.bulan);
  if (!bulan) {
    const d = new Date();
    bulan = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  } else if (!BULAN_RE.test(bulan)) {
    errors.bulan = 'Format bulan harus YYYY-MM (contoh: 2026-10).';
  }
  if (Object.keys(errors).length) return { errors };
  return { data: { bulan } };
}

export function validateLunas(body: Record<string, unknown>): { data?: LunasInput; errors?: Errors } {
  const errors: Errors = {};
  let tanggal_bayar = str(body.tanggal_bayar);
  if (!tanggal_bayar) {
    const d = new Date();
    tanggal_bayar = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  } else if (!isIsoDate(tanggal_bayar)) {
    errors.tanggal_bayar = 'Format tanggal bayar harus YYYY-MM-DD.';
  }
  const metode = str(body.metode_pembayaran) || 'Tunai';
  const catatan = str(body.catatan);

  if (Object.keys(errors).length) return { errors };
  return { data: { tanggal_bayar, metode_pembayaran: metode, catatan: catatan || undefined } };
}
