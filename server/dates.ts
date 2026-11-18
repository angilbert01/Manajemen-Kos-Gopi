/** Tanggal bisnis kos selalu memakai WIB, termasuk ketika server berada di UTC. */
export function tanggalJakarta(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const get = (type: string) => parts.find((part) => part.type === type)!.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function isIsoDate(value: string): boolean {
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value) || value.startsWith('0000')) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** Selisih hari kalender dari tanggal `dari` ke `ke` (keduanya YYYY-MM-DD); negatif bila `ke` lebih awal. */
export function selisihHari(dari: string, ke: string): number {
  return Math.round((Date.parse(`${ke}T00:00:00Z`) - Date.parse(`${dari}T00:00:00Z`)) / 86_400_000);
}

export type PeriodeSewa = 'Harian' | 'Mingguan' | 'Bulanan' | 'Tahunan';
export const PERIODE_SEWA_LIST: PeriodeSewa[] = ['Harian', 'Mingguan', 'Bulanan', 'Tahunan'];

/** Hitung tanggal berakhir sewa berdasarkan tanggal mulai, periode (Harian/Mingguan/Bulanan/Tahunan), dan durasi. */
export function hitungTanggalSelesaiSewa(tanggalMulai: string, periode: PeriodeSewa, durasi: number): string {
  if (!isIsoDate(tanggalMulai)) return tanggalMulai;
  const safeDurasi = Math.max(1, Math.trunc(durasi));
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
  const clampedDay = Math.min(d!, daysInMonth);
  return `${String(targetYear).padStart(4, '0')}-${String(targetMonth).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`;
}
