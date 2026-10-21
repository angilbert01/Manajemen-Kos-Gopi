// Isi data contoh untuk demo. Jalankan: npm run db:seed  (aman diulang: hanya mengisi bila tabel kamar kosong)
import { db, migrate, transaction } from './db.ts';

migrate();
const { n } = db.prepare('SELECT COUNT(*) AS n FROM kamar').get() as { n: number };
if (n > 0) {
  console.log(`[seed] dilewati: sudah ada ${n} kamar.`);
  process.exit(0);
}

const kamar = Array.from({ length: 12 }, (_, i) => {
  const no = String(i + 1).padStart(2, '0');
  const tipe = i < 4 ? 'VIP' : i < 8 ? 'AC' : 'Standar';
  const harga = tipe === 'VIP' ? 1_500_000 : tipe === 'AC' ? 1_200_000 : 900_000;
  return { nomor: `Kamar ${no}`, tipe, harga };
});
const penghuni = [
  { nama: 'Andi Pratama', no_hp: '081234567801', kamar: 'Kamar 01', masuk: '2026-01-05' },
  { nama: 'Siti Rahma', no_hp: '081234567802', kamar: 'Kamar 04', masuk: '2026-03-10' },
  { nama: 'Budi Santoso', no_hp: '081234567803', kamar: 'Kamar 06', masuk: '2026-05-12' },
  { nama: 'Dewi Lestari', no_hp: '081234567804', kamar: 'Kamar 09', masuk: '2026-07-15' },
  { nama: 'Rina Putri', no_hp: '081234567805', kamar: 'Kamar 11', masuk: '2026-08-15' },
];

transaction(() => {
  const insK = db.prepare('INSERT INTO kamar (nomor, tipe, harga) VALUES (?, ?, ?)');
  for (const k of kamar) insK.run(k.nomor, k.tipe, k.harga);
  const insP = db.prepare(`INSERT INTO penghuni (nama, no_hp, kamar_id, tanggal_masuk)
                           VALUES (?, ?, (SELECT id FROM kamar WHERE nomor = ?), ?)`);
  for (const p of penghuni) insP.run(p.nama, p.no_hp, p.kamar, p.masuk);
});
console.log(`[seed] ${kamar.length} kamar & ${penghuni.length} penghuni ditambahkan.`);
