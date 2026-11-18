// Validasi input sesuai acceptance criteria EP-01 (lihat Konteks/Dokumen BA & QA Sprint 1).
import { hitungTanggalSelesaiSewa, isIsoDate, PERIODE_SEWA_LIST, tanggalJakarta } from './dates.ts';
import type { PeriodeSewa } from './dates.ts';

export type Errors = Record<string, string>;

export interface KamarInput {
  nomor: string;
  tipe: string;
  harga: number;
  foto_url: string | null;
  periode_default: PeriodeSewa;
  harga_harian: number | null;
  harga_mingguan: number | null;
  harga_tahunan: number | null;
}
export interface PenghuniInput {
  nama: string;
  no_hp: string;
  kamar_id: number;
  tanggal_masuk: string;
  periode_sewa: PeriodeSewa;
  durasi_sewa: number;
  harga_sewa: number | null;
  tanggal_selesai_sewa: string;
}
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

function parseOptionalPrice(val: unknown, fieldLabel: string, key: string, errors: Errors): number | null {
  if (val === undefined || val === null || val === '') return null;
  if (!positiveInteger(val)) {
    errors[key] = `${fieldLabel} harus bilangan bulat lebih dari 0.`;
    return null;
  }
  return Number(val);
}

export function validateKamar(body: Record<string, unknown>): { data?: KamarInput; errors?: Errors } {
  const errors: Errors = {};
  const nomor = str(body.nomor);
  const periodeRaw = body.periode_default === undefined || body.periode_default === null || body.periode_default === ''
    ? 'Bulanan'
    : str(body.periode_default);
  const tipe = str(body.tipe) || periodeRaw;
  const harga = Number(body.harga);
  const foto = str(body.foto_url);
  if (!nomor) errors.nomor = 'Nomor kamar wajib diisi.';
  else if (nomor.length > 20) errors.nomor = 'Nomor kamar maksimal 20 karakter.';
  if (body.harga === undefined || body.harga === null || body.harga === '') errors.harga = 'Harga wajib diisi.';
  else if (!positiveInteger(body.harga)) errors.harga = 'Harga harus bilangan bulat lebih dari 0.';
  if (!PERIODE_SEWA_LIST.includes(periodeRaw as PeriodeSewa)) {
    errors.periode_default = 'Jangka waktu harus Harian, Mingguan, Bulanan, atau Tahunan.';
  }
  const harga_harian = parseOptionalPrice(body.harga_harian, 'Tarif harian', 'harga_harian', errors);
  const harga_mingguan = parseOptionalPrice(body.harga_mingguan, 'Tarif mingguan', 'harga_mingguan', errors);
  const harga_tahunan = parseOptionalPrice(body.harga_tahunan, 'Tarif tahunan', 'harga_tahunan', errors);
  if (foto && !/^https?:\/\//i.test(foto)) errors.foto_url = 'URL foto harus diawali http:// atau https://';
  if (Object.keys(errors).length) return { errors };
  return {
    data: {
      nomor,
      tipe,
      harga,
      foto_url: foto || null,
      periode_default: periodeRaw as PeriodeSewa,
      harga_harian,
      harga_mingguan,
      harga_tahunan,
    },
  };
}

export function validatePenghuni(body: Record<string, unknown>): { data?: PenghuniInput; errors?: Errors } {
  const errors: Errors = {};
  const nama = str(body.nama);
  const no_hp = normalizePhone(str(body.no_hp));
  const kamar_id = Number(body.kamar_id);
  const tanggal_masuk = str(body.tanggal_masuk);
  const periodeRaw = body.periode_sewa === undefined || body.periode_sewa === null || body.periode_sewa === ''
    ? 'Bulanan'
    : str(body.periode_sewa);
  const durasiRaw = body.durasi_sewa === undefined || body.durasi_sewa === null || body.durasi_sewa === ''
    ? 1
    : body.durasi_sewa;
  const selesaiRaw = str(body.tanggal_selesai_sewa);

  if (!nama) errors.nama = 'Nama wajib diisi.';
  else if (nama.length > 100) errors.nama = 'Nama maksimal 100 karakter.';
  if (!no_hp) errors.no_hp = 'Nomor HP wajib diisi.';
  else if (!PHONE_RE.test(no_hp)) errors.no_hp = 'Nomor HP tidak valid (contoh: 081234567890).';
  if (!Number.isInteger(kamar_id) || kamar_id <= 0) errors.kamar_id = 'Pilih kamar.';
  if (!tanggal_masuk) errors.tanggal_masuk = 'Tanggal masuk wajib diisi.';
  else if (!isIsoDate(tanggal_masuk)) errors.tanggal_masuk = 'Format tanggal tidak valid.';

  if (!PERIODE_SEWA_LIST.includes(periodeRaw as PeriodeSewa)) {
    errors.periode_sewa = 'Jangka waktu sewa harus Harian, Mingguan, Bulanan, atau Tahunan.';
  }
  if (!positiveInteger(durasiRaw) || Number(durasiRaw) > 3650) {
    errors.durasi_sewa = 'Lama sewa harus bilangan bulat antara 1 sampai 3650.';
  }
  const harga_sewa = parseOptionalPrice(body.harga_sewa, 'Harga sewa', 'harga_sewa', errors);
  if (selesaiRaw) {
    if (!isIsoDate(selesaiRaw)) errors.tanggal_selesai_sewa = 'Format tanggal selesai sewa tidak valid.';
    else if (isIsoDate(tanggal_masuk) && selesaiRaw < tanggal_masuk) {
      errors.tanggal_selesai_sewa = 'Tanggal selesai sewa tidak boleh sebelum tanggal masuk.';
    }
  }

  if (Object.keys(errors).length) return { errors };
  const periode_sewa = periodeRaw as PeriodeSewa;
  const durasi_sewa = Number(durasiRaw);
  const tanggal_selesai_sewa = selesaiRaw || hitungTanggalSelesaiSewa(tanggal_masuk, periode_sewa, durasi_sewa);
  return {
    data: {
      nama,
      no_hp,
      kamar_id,
      tanggal_masuk,
      periode_sewa,
      durasi_sewa,
      harga_sewa,
      tanggal_selesai_sewa,
    },
  };
}

export interface SewaPenghuniInput {
  periode_sewa: PeriodeSewa;
  durasi_sewa: number;
  harga_sewa: number;
  tanggal_selesai_sewa: string;
  update_tagihan: boolean;
}

export function validateSewaPenghuni(
  body: Record<string, unknown>,
  tanggalMasuk: string,
): { data?: SewaPenghuniInput; errors?: Errors } {
  const errors: Errors = {};
  const periodeRaw = body.periode_sewa === undefined || body.periode_sewa === null || body.periode_sewa === ''
    ? 'Bulanan'
    : str(body.periode_sewa);
  const durasiRaw = body.durasi_sewa === undefined || body.durasi_sewa === null || body.durasi_sewa === ''
    ? 1
    : body.durasi_sewa;
  const selesaiRaw = str(body.tanggal_selesai_sewa);

  if (!PERIODE_SEWA_LIST.includes(periodeRaw as PeriodeSewa)) {
    errors.periode_sewa = 'Jangka waktu sewa harus Harian, Mingguan, Bulanan, atau Tahunan.';
  }
  if (!positiveInteger(durasiRaw) || Number(durasiRaw) > 3650) {
    errors.durasi_sewa = 'Lama sewa harus bilangan bulat antara 1 sampai 3650.';
  }
  if (body.harga_sewa === undefined || body.harga_sewa === null || body.harga_sewa === '') {
    errors.harga_sewa = 'Harga sewa wajib diisi.';
  } else if (!positiveInteger(body.harga_sewa)) {
    errors.harga_sewa = 'Harga sewa harus bilangan bulat lebih dari 0.';
  }
  if (selesaiRaw) {
    if (!isIsoDate(selesaiRaw)) errors.tanggal_selesai_sewa = 'Format tanggal selesai sewa tidak valid.';
    else if (selesaiRaw < tanggalMasuk) errors.tanggal_selesai_sewa = 'Tanggal selesai tidak boleh sebelum tanggal masuk.';
  }

  if (Object.keys(errors).length) return { errors };
  const periode_sewa = periodeRaw as PeriodeSewa;
  const durasi_sewa = Number(durasiRaw);
  const tanggal_selesai_sewa = selesaiRaw || hitungTanggalSelesaiSewa(tanggalMasuk, periode_sewa, durasi_sewa);
  return {
    data: {
      periode_sewa,
      durasi_sewa,
      harga_sewa: Number(body.harga_sewa),
      tanggal_selesai_sewa,
      update_tagihan: body.update_tagihan !== false,
    },
  };
}

export interface UpdateTagihanInput {
  nominal?: number;
  periode_sewa?: PeriodeSewa;
  durasi_sewa?: number;
  jatuh_tempo?: string;
  catatan?: string | null;
}

export function validateUpdateTagihan(body: Record<string, unknown>): { data?: UpdateTagihanInput; errors?: Errors } {
  const errors: Errors = {};
  const data: UpdateTagihanInput = {};

  if (body.nominal !== undefined) {
    if (body.nominal === null || body.nominal === '' || !positiveInteger(body.nominal)) {
      errors.nominal = 'Nominal tagihan harus bilangan bulat lebih dari 0.';
    } else {
      data.nominal = Number(body.nominal);
    }
  }

  if (body.periode_sewa !== undefined) {
    const p = str(body.periode_sewa);
    if (!PERIODE_SEWA_LIST.includes(p as PeriodeSewa)) {
      errors.periode_sewa = 'Jangka waktu sewa harus Harian, Mingguan, Bulanan, atau Tahunan.';
    } else {
      data.periode_sewa = p as PeriodeSewa;
    }
  }

  if (body.durasi_sewa !== undefined) {
    if (!positiveInteger(body.durasi_sewa) || Number(body.durasi_sewa) > 3650) {
      errors.durasi_sewa = 'Lama sewa harus bilangan bulat antara 1 sampai 3650.';
    } else {
      data.durasi_sewa = Number(body.durasi_sewa);
    }
  }

  if (body.jatuh_tempo !== undefined) {
    const jt = str(body.jatuh_tempo);
    if (!isIsoDate(jt)) errors.jatuh_tempo = 'Format jatuh tempo harus YYYY-MM-DD.';
    else data.jatuh_tempo = jt;
  }

  if (body.catatan !== undefined) {
    if (body.catatan !== null && typeof body.catatan !== 'string') {
      errors.catatan = 'Catatan harus berupa teks.';
    } else {
      const c = str(body.catatan);
      if (c.length > 500) errors.catatan = 'Catatan maksimal 500 karakter.';
      else data.catatan = c || null;
    }
  }

  if (Object.keys(errors).length) return { errors };
  if (Object.keys(data).length === 0) {
    return { errors: { nominal: 'Minimal ubah satu data tagihan (nominal, jangka sewa, jatuh tempo, atau catatan).' } };
  }
  return { data };
}

export interface CreateTagihanManualInput {
  penghuni_id: number;
  nominal: number;
  periode_sewa: PeriodeSewa;
  durasi_sewa: number;
  bulan: string;
  jatuh_tempo: string;
  catatan: string | null;
}

export function validateCreateTagihanManual(body: Record<string, unknown>): {
  data?: CreateTagihanManualInput;
  errors?: Errors;
} {
  const errors: Errors = {};
  const penghuni_id = Number(body.penghuni_id);
  const periodeRaw = body.periode_sewa === undefined || body.periode_sewa === null || body.periode_sewa === ''
    ? 'Bulanan'
    : str(body.periode_sewa);
  const durasiRaw = body.durasi_sewa === undefined || body.durasi_sewa === null || body.durasi_sewa === ''
    ? 1
    : body.durasi_sewa;
  const bulanRaw = body.bulan === undefined || body.bulan === '' ? tanggalJakarta().slice(0, 7) : str(body.bulan);
  const jatuhTempoRaw = str(body.jatuh_tempo) || tanggalJakarta();
  const catatanRaw = body.catatan !== undefined ? str(body.catatan) : '';

  if (!Number.isInteger(penghuni_id) || penghuni_id <= 0) {
    errors.penghuni_id = 'Pilih penghuni terlebih dahulu.';
  }
  if (body.nominal === undefined || body.nominal === null || body.nominal === '') {
    errors.nominal = 'Nominal tagihan wajib diisi.';
  } else if (!positiveInteger(body.nominal)) {
    errors.nominal = 'Nominal tagihan harus bilangan bulat lebih dari 0.';
  }
  if (!PERIODE_SEWA_LIST.includes(periodeRaw as PeriodeSewa)) {
    errors.periode_sewa = 'Jangka penyewaan harus Harian, Mingguan, Bulanan, atau Tahunan.';
  }
  if (!positiveInteger(durasiRaw) || Number(durasiRaw) > 3650) {
    errors.durasi_sewa = 'Lama penyewaan harus bilangan bulat antara 1 sampai 3650.';
  }
  if (!BULAN_RE.test(bulanRaw)) {
    errors.bulan = 'Format bulan harus YYYY-MM.';
  }
  if (!isIsoDate(jatuhTempoRaw)) {
    errors.jatuh_tempo = 'Format jatuh tempo harus YYYY-MM-DD.';
  }
  if (catatanRaw.length > 500) {
    errors.catatan = 'Catatan maksimal 500 karakter.';
  }

  if (Object.keys(errors).length) return { errors };
  return {
    data: {
      penghuni_id,
      nominal: Number(body.nominal),
      periode_sewa: periodeRaw as PeriodeSewa,
      durasi_sewa: Number(durasiRaw),
      bulan: bulanRaw,
      jatuh_tempo: jatuhTempoRaw,
      catatan: catatanRaw || null,
    },
  };
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
