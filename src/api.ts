// Klien API sederhana untuk server Express (/api, di-proxy Vite saat dev).

export type StatusKamar = 'Kosong' | 'Terisi';
export type PeriodeSewa = 'Harian' | 'Mingguan' | 'Bulanan' | 'Tahunan';
export const PERIODE_SEWA_LIST: PeriodeSewa[] = ['Harian', 'Mingguan', 'Bulanan', 'Tahunan'];

export interface Kamar {
  id: number;
  nomor: string;
  tipe: string;
  harga: number;
  status: StatusKamar;
  foto_url: string | null;
  periode_default?: PeriodeSewa;
  harga_harian?: number | null;
  harga_mingguan?: number | null;
  harga_tahunan?: number | null;
  created_at: string;
  updated_at: string;
  penghuni_id?: number | null;
  penghuni_nama?: string | null;
  penghuni_no_hp?: string | null;
  penghuni_masuk?: string | null;
  penghuni_periode_sewa?: PeriodeSewa | null;
  penghuni_durasi_sewa?: number | null;
  penghuni_harga_sewa?: number | null;
  penghuni_selesai_sewa?: string | null;
}

export interface Penghuni {
  id: number;
  nama: string;
  no_hp: string;
  kamar_id: number;
  kamar_nomor: string;
  kamar_tipe?: string;
  kamar_harga?: number;
  periode_sewa?: PeriodeSewa;
  durasi_sewa?: number;
  harga_sewa?: number;
  harga_sewa_kustom?: number | null;
  tanggal_selesai_sewa?: string | null;
  tanggal_masuk: string;
  tanggal_keluar: string | null;
  aktif: 0 | 1;
  created_at: string;
  tagihan_belum_lunas: number;
  /** 1 bila penghuni sudah menghubungkan chatbot (Telegram). */
  chat_terhubung: 0 | 1;
}

export interface AdminProfile {
  id: number;
  nama: string;
  peran: string;
  email: string;
  no_hp: string;
  nama_kos: string;
  alamat_kos: string;
  avatar_url: string;
  aktif: 0 | 1;
  created_at: string;
  updated_at: string;
}

export interface Ringkasan {
  total_kamar: number;
  kamar_terisi: number;
  kamar_kosong: number;
  total_penghuni: number;
  pendapatan_bulanan: number;
  potensi_pendapatan: number;
  tagihan_bulan?: string;
  tagihan_total?: number;
  tagihan_total_nominal?: number;
  tagihan_lunas?: number;
  tagihan_nominal_lunas?: number;
  tagihan_belum_lunas?: number;
  tagihan_nominal_belum_lunas?: number;
  tagihan_dicicil?: number;
  keluhan_total?: number;
  keluhan_pending?: number;
  keluhan_diproses?: number;
  keluhan_selesai?: number;
  keluhan_aktif?: number;
}

export type StatusTagihan = 'Belum Lunas' | 'Lunas';
export type StatusBayar = 'Belum Bayar' | 'Dicicil' | 'Lunas';

export interface Tagihan {
  id: number;
  penghuni_id: number;
  kamar_id: number;
  bulan: string; // YYYY-MM
  nominal: number;
  periode_sewa?: PeriodeSewa;
  durasi_sewa?: number;
  status: StatusTagihan;
  jatuh_tempo: string; // YYYY-MM-DD
  tanggal_bayar: string | null;
  metode_pembayaran: string | null;
  catatan: string | null;
  created_at: string;
  updated_at: string;
  terbayar: number;
  sisa: number;
  jumlah_pembayaran: number;
  status_bayar: StatusBayar;
  penghuni_nama: string;
  penghuni_no_hp: string;
  penghuni_masuk: string;
  penghuni_selesai_sewa?: string | null;
  kamar_nomor: string;
  kamar_tipe: string;
  kamar_harga: number;
}

/** Tagihan yang perlu diingatkan hari ini (WBS 4.1). `hari` = selisih hari ke jatuh tempo (negatif = terlambat). */
export interface PengingatTagihan extends Tagihan {
  pengingat: 'H-3' | 'H-0' | 'Terlambat';
  hari: number;
}

export interface Pembayaran {
  id: number;
  tagihan_id: number;
  jumlah: number;
  tanggal_bayar: string;
  metode_pembayaran: string;
  catatan: string | null;
  created_at: string;
}

export interface RekapTagihan {
  bulan: string;
  total_tagihan: number;
  total_nominal: number;
  total_lunas: number;
  nominal_lunas: number;
  total_belum_lunas: number;
  nominal_belum_lunas: number;
  total_dicicil?: number;
  nominal_dicicil?: number;
  daftar_lunas: Tagihan[];
  daftar_belum_lunas: Tagihan[];
  bulan_tersedia: string[];
}

export interface GenerateTagihanResult {
  bulan: string;
  total_penghuni_aktif: number;
  dibuat: number;
  dilewati: number;
  total_tagihan: number;
  tagihan: Tagihan[];
}

export interface LunasPayload {
  tanggal_bayar?: string;
  metode_pembayaran?: string;
  catatan?: string;
}

export interface PembayaranPayload {
  jumlah: number;
  tanggal_bayar?: string;
  metode_pembayaran?: string;
  catatan?: string;
}

// ---------- EP-03: Sistem Manajemen Keluhan Fasilitas (WBS 3.1 & 3.2) ----------

export type StatusKeluhan = 'Pending' | 'Diproses' | 'Selesai';
export type PrioritasKeluhan = 'Rendah' | 'Sedang' | 'Tinggi';

export interface Keluhan {
  id: number;
  kamar_id: number;
  penghuni_id: number | null;
  judul: string;
  deskripsi: string;
  kategori: string;
  prioritas: PrioritasKeluhan;
  foto_url: string | null;
  status: StatusKeluhan;
  catatan_penanganan: string | null;
  tanggal_lapor: string;
  tanggal_selesai: string | null;
  created_at: string;
  updated_at: string;
  kamar_nomor: string;
  kamar_tipe: string;
  penghuni_nama: string;
  penghuni_no_hp: string;
}

export interface RekapKeluhan {
  total: number;
  pending: number;
  diproses: number;
  selesai: number;
  aktif: number;
}

export interface KeluhanForm {
  kamar_id: string | number;
  penghuni_id?: string | number | null;
  judul: string;
  deskripsi: string;
  kategori?: string;
  prioritas?: PrioritasKeluhan;
  foto_url?: string;
  tanggal_lapor?: string;
}

export interface UpdateStatusKeluhanPayload {
  status: StatusKeluhan;
  catatan_penanganan?: string;
  tanggal_selesai?: string;
}

export type KamarForm = {
  nomor: string;
  tipe?: string;
  harga: string;
  foto_url: string;
  periode_default?: PeriodeSewa;
  harga_harian?: string;
  harga_mingguan?: string;
  harga_tahunan?: string;
};
export type PenghuniForm = {
  nama: string;
  no_hp: string;
  kamar_id: string;
  tanggal_masuk: string;
  periode_sewa?: PeriodeSewa;
  durasi_sewa?: string;
  harga_sewa?: string;
  tanggal_selesai_sewa?: string;
};
export interface SewaPenghuniPayload {
  periode_sewa: PeriodeSewa;
  durasi_sewa: number;
  harga_sewa: number;
  tanggal_selesai_sewa?: string;
  update_tagihan?: boolean;
}
export interface UpdateTagihanPayload {
  nominal?: number;
  periode_sewa?: PeriodeSewa;
  durasi_sewa?: number;
  jatuh_tempo?: string;
  catatan?: string | null;
}
export interface CreateTagihanManualPayload {
  penghuni_id: number;
  nominal: number;
  periode_sewa: PeriodeSewa;
  durasi_sewa: number;
  bulan?: string;
  jatuh_tempo?: string;
  catatan?: string | null;
}
export type AdminForm = {
  nama: string;
  peran: string;
  email: string;
  no_hp: string;
  nama_kos: string;
  alamat_kos: string;
  avatar_url: string;
  aktif?: boolean;
};

/** Error dari API, membawa pesan per-field (422/409) bila ada. */
export class ApiError extends Error {
  status: number;
  errors: Record<string, string>;
  constructor(status: number, message: string, errors: Record<string, string> = {}) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Tidak dapat terhubung ke server. Pastikan API berjalan (npm run dev).');
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.message ?? 'Terjadi kesalahan.', data.errors);
  return data as T;
}

const qs = (params: Record<string, string | undefined>) => {
  const s = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]).toString();
  return s ? `?${s}` : '';
};

const payloadPenghuni = (f: PenghuniForm) => ({
  ...f,
  kamar_id: Number(f.kamar_id),
  periode_sewa: f.periode_sewa || 'Bulanan',
  durasi_sewa: f.durasi_sewa ? Number(f.durasi_sewa) : 1,
  harga_sewa: f.harga_sewa ? Number(f.harga_sewa) : undefined,
  tanggal_selesai_sewa: f.tanggal_selesai_sewa || undefined,
});

export const api = {
  ringkasan: () => request<Ringkasan>('GET', '/ringkasan'),
  admin: {
    list: () => request<AdminProfile[]>('GET', '/admin'),
    aktif: () => request<AdminProfile>('GET', '/admin/aktif'),
    create: (f: AdminForm) => request<AdminProfile>('POST', '/admin', f),
    update: (id: number, f: AdminForm) => request<AdminProfile>('PUT', `/admin/${id}`, f),
    aktifkan: (id: number) => request<AdminProfile>('PATCH', `/admin/${id}/aktifkan`, {}),
    remove: (id: number) => request<void>('DELETE', `/admin/${id}`),
  },
  kamar: {
    list: (f: { status?: string; harga_max?: string; q?: string } = {}) => request<Kamar[]>('GET', `/kamar${qs(f)}`),
    create: (f: KamarForm) =>
      request<Kamar>('POST', '/kamar', {
        ...f,
        tipe: f.periode_default || f.tipe || 'Bulanan',
        harga: f.harga ? Number(f.harga) : 1000000,
        periode_default: f.periode_default || 'Bulanan',
        harga_harian: f.harga_harian ? Number(f.harga_harian) : null,
        harga_mingguan: f.harga_mingguan ? Number(f.harga_mingguan) : null,
        harga_tahunan: f.harga_tahunan ? Number(f.harga_tahunan) : null,
      }),
    update: (id: number, f: KamarForm) =>
      request<Kamar>('PUT', `/kamar/${id}`, {
        ...f,
        tipe: f.periode_default || f.tipe || 'Bulanan',
        harga: f.harga ? Number(f.harga) : 1000000,
        periode_default: f.periode_default || 'Bulanan',
        harga_harian: f.harga_harian ? Number(f.harga_harian) : null,
        harga_mingguan: f.harga_mingguan ? Number(f.harga_mingguan) : null,
        harga_tahunan: f.harga_tahunan ? Number(f.harga_tahunan) : null,
      }),
    remove: (id: number) => request<void>('DELETE', `/kamar/${id}`),
  },
  penghuni: {
    list: (semua = false) => request<Penghuni[]>('GET', `/penghuni${semua ? '?semua=1' : ''}`),
<<<<<<< Updated upstream
    create: (f: PenghuniForm) =>
      request<Penghuni>('POST', '/penghuni', {
        ...f,
        kamar_id: Number(f.kamar_id),
        periode_sewa: f.periode_sewa || 'Bulanan',
        durasi_sewa: f.durasi_sewa ? Number(f.durasi_sewa) : 1,
        harga_sewa: f.harga_sewa ? Number(f.harga_sewa) : undefined,
        tanggal_selesai_sewa: f.tanggal_selesai_sewa || undefined,
      }),
=======
    create: (f: PenghuniForm) => request<Penghuni>('POST', '/penghuni', payloadPenghuni(f)),
    update: (id: number, f: PenghuniForm) => request<Penghuni>('PUT', `/penghuni/${id}`, payloadPenghuni(f)),
>>>>>>> Stashed changes
    aturSewa: (id: number, payload: SewaPenghuniPayload) =>
      request<Penghuni>('PATCH', `/penghuni/${id}/sewa`, payload),
    keluar: (id: number) => request<Penghuni>('PATCH', `/penghuni/${id}/keluar`, {}),
    kodeChat: (id: number) => request<{ kode: string }>('POST', `/penghuni/${id}/kode-chat`, {}),
  },
  tagihan: {
    list: (f: { bulan?: string; status?: string; q?: string } = {}) => request<Tagihan[]>('GET', `/tagihan${qs(f)}`),
    rekap: (bulan?: string) => request<RekapTagihan>('GET', `/tagihan/rekap${qs({ bulan })}`),
    generate: (bulan?: string) => request<GenerateTagihanResult>('POST', '/tagihan/generate', { bulan }),
    create: (payload: CreateTagihanManualPayload) => request<Tagihan>('POST', '/tagihan', payload),
    update: (id: number, payload: UpdateTagihanPayload) => request<Tagihan>('PATCH', `/tagihan/${id}`, payload),
    lunas: (id: number, payload: LunasPayload = {}) => request<Tagihan>('PATCH', `/tagihan/${id}/lunas`, payload),
    batal: (id: number) => request<Tagihan>('PATCH', `/tagihan/${id}/batal`, {}),
    pembayaran: (id: number) => request<Pembayaran[]>('GET', `/tagihan/${id}/pembayaran`),
    bayar: (id: number, payload: PembayaranPayload) => request<Tagihan>('POST', `/tagihan/${id}/pembayaran`, payload),
    hapusPembayaran: (pembayaranId: number) => request<Tagihan>('DELETE', `/pembayaran/${pembayaranId}`),
    pengingat: () => request<PengingatTagihan[]>('GET', '/tagihan/pengingat'),
<<<<<<< Updated upstream
=======
    kirimTelegram: (id: number) => request<{ terkirim: boolean }>('POST', `/tagihan/${id}/kirim-telegram`, {}),
    kirimKuitansiTelegram: (id: number) => request<{ terkirim: boolean }>('POST', `/tagihan/${id}/kirim-kuitansi-telegram`, {}),
>>>>>>> Stashed changes
    linkBayar: (id: number) =>
      request<{ order_id: string; payment_url: string; jumlah: number; provider: 'midtrans' | 'simulasi' }>('POST', `/tagihan/${id}/link-bayar`, {}),
  },
  keluhan: {
    list: (f: { status?: string; prioritas?: string; kamar_id?: string; penghuni_id?: string; q?: string } = {}) =>
      request<Keluhan[]>('GET', `/keluhan${qs(f)}`),
    rekap: () => request<RekapKeluhan>('GET', '/keluhan/rekap'),
    create: (f: KeluhanForm) =>
      request<Keluhan>('POST', '/keluhan', {
        ...f,
        kamar_id: f.kamar_id === '' ? 0 : Number(f.kamar_id),
        penghuni_id: f.penghuni_id === undefined || f.penghuni_id === '' || f.penghuni_id === null ? null : Number(f.penghuni_id),
      }),
    updateStatus: (id: number, payload: UpdateStatusKeluhanPayload) =>
      request<Keluhan>('PATCH', `/keluhan/${id}/status`, payload),
<<<<<<< Updated upstream
=======
    kirimTelegram: (id: number) => request<{ terkirim: boolean }>('POST', `/keluhan/${id}/kirim-telegram`, {}),
    remove: (id: number) => request<void>('DELETE', `/keluhan/${id}`),
    clearRiwayat: () => request<{ dihapus: number }>('DELETE', '/keluhan/riwayat'),
>>>>>>> Stashed changes
  },
};

export const rupiah = (amount: number) => `Rp ${amount.toLocaleString('id-ID')}`;
export const tanggal = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
<<<<<<< Updated upstream
/** Link wa.me dengan pesan terisi. Nomor 08xx / +628xx / 628xx dinormalkan ke 628xx. */
export const waLink = (noHp: string, pesan: string) =>
  `https://wa.me/${noHp.replace(/\D/g, '').replace(/^0/, '62')}?text=${encodeURIComponent(pesan)}`;
=======
>>>>>>> Stashed changes

export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export const namaBulan = (bulanIso: string) => {
  if (!bulanIso) return '';
  const [y, m] = bulanIso.split('-');
  const date = new Date(Number(y), Number(m) - 1, 1);
  return date.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
};

export const satuanPeriode = (periode: PeriodeSewa = 'Bulanan') => {
  switch (periode) {
    case 'Harian': return 'hari';
    case 'Mingguan': return 'minggu';
    case 'Tahunan': return 'tahun';
    default: return 'bulan';
  }
};

export const formatPeriodeSewa = (periode: PeriodeSewa = 'Bulanan', durasi = 1) => {
  const d = Number.isFinite(durasi) && durasi > 0 ? Math.trunc(durasi) : 1;
  return `${d} ${satuanPeriode(periode).replace(/^./, (c) => c.toUpperCase())}`;
};

export const hitungAkhirSewa = (tanggalMulai: string, periode: PeriodeSewa, durasi: number): string => {
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(tanggalMulai)) return tanggalMulai;
  const safeDurasi = Number.isFinite(durasi) && durasi > 0 ? Math.trunc(durasi) : 1;
  if (periode === 'Harian' || periode === 'Mingguan') {
    const addDays = periode === 'Mingguan' ? safeDurasi * 7 : safeDurasi;
    const ms = Date.parse(`${tanggalMulai}T00:00:00Z`) + addDays * 86_400_000;
    return new Date(ms).toISOString().slice(0, 10);
  }
  const [y, m, d] = tanggalMulai.split('-').map(Number);
  const addMonths = periode === 'Tahunan' ? safeDurasi * 12 : safeDurasi;
  const totalMonths = y! * 12 + (m! - 1) + addMonths;
  const targetYear = Math.floor(totalMonths / 12);
  const targetMonth = (totalMonths % 12) + 1;
  const daysInMonth = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate();
  return `${String(targetYear).padStart(4, '0')}-${String(targetMonth).padStart(2, '0')}-${String(Math.min(d!, daysInMonth)).padStart(2, '0')}`;
};

export const tarifSatuanKamar = (kamar: Kamar | undefined, periode: PeriodeSewa): number => {
  if (!kamar) return 0;
  const def = kamar.periode_default ?? 'Bulanan';
  if (periode === def) return kamar.harga;
  if (periode === 'Harian') return kamar.harga_harian ?? Math.max(1000, Math.round(kamar.harga / 30 / 1000) * 1000);
  if (periode === 'Mingguan') return kamar.harga_mingguan ?? Math.max(1000, Math.round(kamar.harga / 4 / 1000) * 1000);
  if (periode === 'Tahunan') return kamar.harga_tahunan ?? kamar.harga * 12;
  return kamar.harga;
};

export const estimasiHargaSewa = (kamar: Kamar | undefined, periode: PeriodeSewa, durasi: number): number => {
  if (!kamar) return 0;
  const d = Number.isFinite(durasi) && durasi > 0 ? Math.trunc(durasi) : 1;
  return tarifSatuanKamar(kamar, periode) * d;
};
