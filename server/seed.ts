// Isi data contoh untuk demo. Jalankan: npm run db:seed  (aman diulang)
import { db, migrate, transaction } from './db.ts';

migrate();
const { n } = db.prepare('SELECT COUNT(*) AS n FROM kamar').get() as { n: number };

if (n === 0) {
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
} else {
  console.log(`[seed] Kamar sudah ada (${n} kamar).`);
}

// Seed tagihan untuk demo Sprint 3 jika belum ada
const { nTagihan } = db.prepare('SELECT COUNT(*) AS nTagihan FROM tagihan').get() as { nTagihan: number };
if (nTagihan === 0) {
  const activePenghuni = db.prepare(`
    SELECT p.id, p.nama, p.kamar_id, p.tanggal_masuk, k.harga, k.nomor
    FROM penghuni p
    JOIN kamar k ON k.id = p.kamar_id
    WHERE p.aktif = 1
  `).all() as { id: number; nama: string; kamar_id: number; tanggal_masuk: string; harga: number; nomor: string }[];

  transaction(() => {
    const insTagihan = db.prepare(`
      INSERT INTO tagihan (penghuni_id, kamar_id, bulan, nominal, status, jatuh_tempo, tanggal_bayar, metode_pembayaran, catatan)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Bulan lalu (2026-09) - semua lunas
    for (const p of activePenghuni) {
      const day = p.tanggal_masuk.slice(8, 10);
      insTagihan.run(
        p.id,
        p.kamar_id,
        '2026-09',
        p.harga,
        'Lunas',
        `2026-09-${day}`,
        `2026-09-${day}`,
        'Transfer',
        'Pembayaran tepat waktu',
      );
    }

    // Bulan ini (2026-10) - 3 lunas, 2 belum lunas
    for (const [idx, p] of activePenghuni.entries()) {
      const day = p.tanggal_masuk.slice(8, 10);
      const isLunas = idx < 3;
      insTagihan.run(
        p.id,
        p.kamar_id,
        '2026-10',
        p.harga,
        isLunas ? 'Lunas' : 'Belum Lunas',
        `2026-10-${day}`,
        isLunas ? `2026-10-${day}` : null,
        isLunas ? (idx === 0 ? 'Tunai' : 'Transfer BCA') : null,
        isLunas ? 'Lunas awal bulan' : null,
      );
    }
  });
  console.log(`[seed] Tagihan contoh bulan September dan Oktober 2026 berhasil ditambahkan.`);
} else {
  console.log(`[seed] Tagihan sudah ada (${nTagihan} tagihan).`);
}
