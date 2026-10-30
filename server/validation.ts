// Validasi input sesuai acceptance criteria EP-01 (lihat Konteks/Dokumen BA & QA Sprint 1).
import { isIsoDate, tanggalJakarta } from './dates.ts';

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
const positiveInteger = (value: unknown) =>
  (typeof value === 'number' || (typeof value === 'string' && value.trim() !== '')) &&
  Number.isSafeInteger(Number(value)) && Number(value) > 0;

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
  else if (!positiveInteger(body.harga)) errors.harga = 'Harga harus bilangan bulat lebih dari 0.';
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

const BULAN_RE = /^(?!0000)[0-9]{4}-(0[1-9]|1[0-2])$/;

export function validateGenerateTagihan(body: Record<string, unknown>): { data?: GenerateTagihanInput; errors?: Errors } {
  const errors: Errors = {};
  const bulan = body.bulan === undefined || body.bulan === '' ? tanggalJakarta().slice(0, 7) : str(body.bulan);
  if (!BULAN_RE.test(bulan)) {
    errors.bulan = 'Format bulan harus YYYY-MM (contoh: 2026-10).';
  }
  if (Object.keys(errors).length) return { errors };
  return { data: { bulan } };
}

export function validateLunas(body: Record<string, unknown>): { data?: LunasInput; errors?: Errors } {
  const errors: Errors = {};
  const tanggal_bayar = body.tanggal_bayar === undefined || body.tanggal_bayar === '' ? tanggalJakarta() : str(body.tanggal_bayar);
  if (!isIsoDate(tanggal_bayar)) {
    errors.tanggal_bayar = 'Format tanggal bayar harus YYYY-MM-DD.';
  } else if (tanggal_bayar > tanggalJakarta()) {
    errors.tanggal_bayar = 'Tanggal bayar tidak boleh di masa depan.';
  }
  const metode = str(body.metode_pembayaran) || 'Tunai';
  const catatan = str(body.catatan);
  if (body.metode_pembayaran !== undefined && typeof body.metode_pembayaran !== 'string')
    errors.metode_pembayaran = 'Metode pembayaran harus berupa teks.';
  else if (metode.length > 100) errors.metode_pembayaran = 'Metode pembayaran maksimal 100 karakter.';
  if (body.catatan !== undefined && typeof body.catatan !== 'string') errors.catatan = 'Catatan harus berupa teks.';
  else if (catatan.length > 500) errors.catatan = 'Catatan maksimal 500 karakter.';

  if (Object.keys(errors).length) return { errors };
  return { data: { tanggal_bayar, metode_pembayaran: metode, catatan: catatan || undefined } };
}

export interface PembayaranInput extends LunasInput {
  jumlah: number;
}

/** Validasi 1 transaksi pembayaran (cicilan atau bayar penuh). Batas sisa tagihan dicek di app.ts. */
export function validatePembayaran(body: Record<string, unknown>): { data?: PembayaranInput; errors?: Errors } {
  const errors: Errors = {};
  const jumlah = Number(body.jumlah);
  if (body.jumlah === undefined || body.jumlah === null || body.jumlah === '') errors.jumlah = 'Jumlah bayar wajib diisi.';
  else if (!positiveInteger(body.jumlah)) errors.jumlah = 'Jumlah bayar harus bilangan bulat lebih dari 0.';

  const base = validateLunas(body);
  if (base.errors) Object.assign(errors, base.errors);
  if (Object.keys(errors).length || !base.data) return { errors };
  return { data: { ...base.data, jumlah } };
}

// ---------- EP-03: Sistem Manajemen Keluhan Fasilitas (WBS 3.1 & 3.2) ----------

export type StatusKeluhan = 'Pending' | 'Diproses' | 'Selesai';
export type PrioritasKeluhan = 'Rendah' | 'Sedang' | 'Tinggi';

export const STATUS_KELUHAN_LIST: StatusKeluhan[] = ['Pending', 'Diproses', 'Selesai'];
export const PRIORITAS_KELUHAN_LIST: PrioritasKeluhan[] = ['Rendah', 'Sedang', 'Tinggi'];

export interface KeluhanInput {
  kamar_id: number;
  penghuni_id: number | null;
  judul: string;
  deskripsi: string;
  kategori: string;
  prioritas: PrioritasKeluhan;
  foto_url: string | null;
  tanggal_lapor: string;
}

export interface UpdateStatusKeluhanInput {
  status: StatusKeluhan;
  catatan_penanganan: string | null;
  tanggal_selesai: string | null;
}

export function validateKeluhan(body: Record<string, unknown>): { data?: KeluhanInput; errors?: Errors } {
  const errors: Errors = {};
  const kamar_id = Number(body.kamar_id);
  const penghuni_id =
    body.penghuni_id !== undefined && body.penghuni_id !== null && body.penghuni_id !== ''
      ? Number(body.penghuni_id)
      : null;
  const judul = str(body.judul);
  const deskripsi = str(body.deskripsi);
  const kategori = str(body.kategori) || 'Fasilitas Kamar';
  if (kategori.length > 60) errors.kategori = 'Kategori maksimal 60 karakter.';
  const prioritasRaw = str(body.prioritas) || 'Sedang';
  const foto = str(body.foto_url);
  const tanggal_lapor = str(body.tanggal_lapor) || tanggalJakarta();

  if (!Number.isInteger(kamar_id) || kamar_id <= 0) {
    errors.kamar_id = 'Pilih kamar yang dilaporkan.';
  }
  if (penghuni_id !== null && (!Number.isInteger(penghuni_id) || penghuni_id <= 0)) {
    errors.penghuni_id = 'Penghuni tidak valid.';
  }
  if (!judul) {
    errors.judul = 'Judul keluhan wajib diisi (contoh: AC bocor / Lampu mati).';
  } else if (judul.length > 120) {
    errors.judul = 'Judul keluhan maksimal 120 karakter.';
  }
  if (!deskripsi) {
    errors.deskripsi = 'Deskripsi detail keluhan wajib diisi.';
  } else if (deskripsi.length > 1000) {
    errors.deskripsi = 'Deskripsi keluhan maksimal 1000 karakter.';
  }
  if (!PRIORITAS_KELUHAN_LIST.includes(prioritasRaw as PrioritasKeluhan)) {
    errors.prioritas = 'Prioritas harus salah satu dari: Rendah, Sedang, Tinggi.';
  }
  if (foto && !/^https?:\/\//i.test(foto)) {
    errors.foto_url = 'URL foto harus diawali http:// atau https://';
  }
  if (!isIsoDate(tanggal_lapor)) {
    errors.tanggal_lapor = 'Format tanggal lapor harus YYYY-MM-DD.';
  } else if (tanggal_lapor > tanggalJakarta()) {
    errors.tanggal_lapor = 'Tanggal lapor tidak boleh di masa depan.';
  }

  if (Object.keys(errors).length) return { errors };
  return {
    data: {
      kamar_id,
      penghuni_id,
      judul,
      deskripsi,
      kategori,
      prioritas: prioritasRaw as PrioritasKeluhan,
      foto_url: foto || null,
      tanggal_lapor,
    },
  };
}

export function validateStatusKeluhan(body: Record<string, unknown>): {
  data?: UpdateStatusKeluhanInput;
  errors?: Errors;
} {
  const errors: Errors = {};
  const statusRaw = str(body.status);
  const catatanRaw = body.catatan_penanganan !== undefined ? str(body.catatan_penanganan) : null;
  const tanggalSelesaiRaw = str(body.tanggal_selesai);

  if (!statusRaw) {
    errors.status = 'Status keluhan wajib diisi.';
  } else if (!STATUS_KELUHAN_LIST.includes(statusRaw as StatusKeluhan)) {
    errors.status = 'Status keluhan harus salah satu dari: Pending, Diproses, Selesai.';
  }

  if (catatanRaw && catatanRaw.length > 500) {
    errors.catatan_penanganan = 'Catatan penanganan maksimal 500 karakter.';
  }

  if (tanggalSelesaiRaw && !isIsoDate(tanggalSelesaiRaw)) {
    errors.tanggal_selesai = 'Format tanggal selesai harus YYYY-MM-DD.';
  } else if (tanggalSelesaiRaw && tanggalSelesaiRaw > tanggalJakarta()) {
    errors.tanggal_selesai = 'Tanggal selesai tidak boleh di masa depan.';
  }

  if (Object.keys(errors).length) return { errors };

  const status = statusRaw as StatusKeluhan;
  const tanggal_selesai = status === 'Selesai' && tanggalSelesaiRaw ? tanggalSelesaiRaw : null;

  return {
    data: {
      status,
      catatan_penanganan: catatanRaw,
      tanggal_selesai,
    },
  };
}
