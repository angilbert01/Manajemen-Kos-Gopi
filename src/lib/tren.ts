const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

export type BucketBulan = { bulan: string; label: string; jumlah: number };

/** Jumlah penghuni masuk per bulan untuk `months` bulan terakhir (termasuk bulan `today`), bulan kosong = 0. */
export function trenMasuk(penghuni: { tanggal_masuk: string }[], today: Date, months = 6): BucketBulan[] {
  const buckets: BucketBulan[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    buckets.push({
      bulan: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: BULAN[d.getMonth()]!,
      jumlah: 0,
    });
  }
  const byKey = new Map(buckets.map((b) => [b.bulan, b]));
  for (const p of penghuni) {
    const b = byKey.get(p.tanggal_masuk.slice(0, 7));
    if (b) b.jumlah++;
  }
  return buckets;
}
