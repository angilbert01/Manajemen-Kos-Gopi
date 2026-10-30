// Klien API sederhana untuk server Express (/api, di-proxy Vite saat dev).

export type StatusKamar = 'Kosong' | 'Terisi';

export interface Kamar {
  id: number;
  nomor: string;
  tipe: string;
  harga: number;
  status: StatusKamar;
  foto_url: string | null;
  created_at: string;
  updated_at: string;
  penghuni_id?: number | null;
  penghuni_nama?: string | null;
  penghuni_no_hp?: string | null;
  penghuni_masuk?: string | null;
}

export interface Penghuni {
  id: number;
  nama: string;
  no_hp: string;
  kamar_id: number;
  kamar_nomor: string;
  kamar_tipe?: string;
  kamar_harga?: number;
  tanggal_masuk: string;
  tanggal_keluar: string | null;
  aktif: 0 | 1;
  created_at: string;
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
}

export type StatusTagihan = 'Belum Lunas' | 'Lunas';
export type StatusBayar = 'Belum Bayar' | 'Dicicil' | 'Lunas';

export interface Tagihan {
  id: number;
  penghuni_id: number;
  kamar_id: number;
  bulan: string; // YYYY-MM
  nominal: number;
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
  kamar_nomor: string;
  kamar_tipe: string;
  kamar_harga: number;
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

export type KamarForm = { nomor: string; tipe: string; harga: string; foto_url: string };
export type PenghuniForm = { nama: string; no_hp: string; kamar_id: string; tanggal_masuk: string };
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
    create: (f: KamarForm) => request<Kamar>('POST', '/kamar', { ...f, harga: f.harga === '' ? '' : Number(f.harga) }),
    update: (id: number, f: KamarForm) =>
      request<Kamar>('PUT', `/kamar/${id}`, { ...f, harga: f.harga === '' ? '' : Number(f.harga) }),
    remove: (id: number) => request<void>('DELETE', `/kamar/${id}`),
  },
  penghuni: {
    list: (semua = false) => request<Penghuni[]>('GET', `/penghuni${semua ? '?semua=1' : ''}`),
    create: (f: PenghuniForm) => request<Penghuni>('POST', '/penghuni', { ...f, kamar_id: Number(f.kamar_id) }),
    keluar: (id: number) => request<Penghuni>('PATCH', `/penghuni/${id}/keluar`, {}),
  },
  tagihan: {
    list: (f: { bulan?: string; status?: string; q?: string } = {}) => request<Tagihan[]>('GET', `/tagihan${qs(f)}`),
    rekap: (bulan?: string) => request<RekapTagihan>('GET', `/tagihan/rekap${qs({ bulan })}`),
    generate: (bulan?: string) => request<GenerateTagihanResult>('POST', '/tagihan/generate', { bulan }),
    lunas: (id: number, payload: LunasPayload = {}) => request<Tagihan>('PATCH', `/tagihan/${id}/lunas`, payload),
    batal: (id: number) => request<Tagihan>('PATCH', `/tagihan/${id}/batal`, {}),
    pembayaran: (id: number) => request<Pembayaran[]>('GET', `/tagihan/${id}/pembayaran`),
    bayar: (id: number, payload: PembayaranPayload) => request<Tagihan>('POST', `/tagihan/${id}/pembayaran`, payload),
    hapusPembayaran: (pembayaranId: number) => request<Tagihan>('DELETE', `/pembayaran/${pembayaranId}`),
    remove: (id: number) => request<void>('DELETE', `/tagihan/${id}`),
  },
};

export const rupiah = (amount: number) => `Rp ${amount.toLocaleString('id-ID')}`;
export const tanggal = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
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
