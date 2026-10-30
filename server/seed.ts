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

    // Riwayat pembayaran: tagihan Lunas = 1x bayar penuh
    db.prepare(`
      INSERT INTO pembayaran (tagihan_id, jumlah, tanggal_bayar, metode_pembayaran, catatan)
      SELECT id, nominal, tanggal_bayar, COALESCE(metode_pembayaran, 'Tunai'), catatan
      FROM tagihan WHERE status = 'Lunas'
    `).run();

    // Contoh cicilan: penghuni ke-4 baru membayar separuh tagihan bulan ini
    const cicil = activePenghuni[3];
    if (cicil) {
      const t = db.prepare(`SELECT id, nominal FROM tagihan WHERE penghuni_id = ? AND bulan = '2026-10'`).get(cicil.id) as
        | { id: number; nominal: number }
        | undefined;
      if (t) {
        db.prepare(`
          INSERT INTO pembayaran (tagihan_id, jumlah, tanggal_bayar, metode_pembayaran, catatan)
          VALUES (?, ?, ?, 'Tunai', 'Cicilan ke-1')
        `).run(t.id, Math.round(t.nominal / 2), `2026-10-${cicil.tanggal_masuk.slice(8, 10)}`);
      }
    }
  });
  console.log(`[seed] Tagihan contoh bulan September dan Oktober 2026 (termasuk 1 contoh cicilan) berhasil ditambahkan.`);
} else {
  console.log(`[seed] Tagihan sudah ada (${nTagihan} tagihan).`);
}

// Seed keluhan untuk demo Sprint 4 (EP-03) jika belum ada
const { nKeluhan } = db.prepare('SELECT COUNT(*) AS nKeluhan FROM keluhan').get() as { nKeluhan: number };
if (nKeluhan === 0) {
  const p1 = db.prepare(`SELECT p.id, p.kamar_id FROM penghuni p JOIN kamar k ON k.id = p.kamar_id WHERE k.nomor = 'Kamar 01'`).get() as { id: number; kamar_id: number } | undefined;
  const p2 = db.prepare(`SELECT p.id, p.kamar_id FROM penghuni p JOIN kamar k ON k.id = p.kamar_id WHERE k.nomor = 'Kamar 04'`).get() as { id: number; kamar_id: number } | undefined;
  const p3 = db.prepare(`SELECT p.id, p.kamar_id FROM penghuni p JOIN kamar k ON k.id = p.kamar_id WHERE k.nomor = 'Kamar 06'`).get() as { id: number; kamar_id: number } | undefined;

  if (p1 && p2 && p3) {
    transaction(() => {
      const insKeluhan = db.prepare(`
        INSERT INTO keluhan (kamar_id, penghuni_id, judul, deskripsi, kategori, prioritas, status, catatan_penanganan, tanggal_lapor, tanggal_selesai)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      // 1. Pending (prioritas tinggi)
      insKeluhan.run(
        p1.kamar_id,
        p1.id,
        'AC kamar menetes dan kurang dingin',
        'AC bocor air di bagian bawah unit indoor, pipa freon mengeluarkan suara berdesis sejak kemarin sore.',
        'Elektronik & AC',
        'Tinggi',
        'Pending',
        null,
        '2026-10-28',
        null,
      );

      // 2. Diproses (prioritas sedang)
      insKeluhan.run(
        p2.kamar_id,
        p2.id,
        'Kran air wastafel kamar mandi macet',
        'Putaran kran air wastafel doll dan air hanya menetes kecil.',
        'Plumbing & Sanitasi',
        'Sedang',
        'Diproses',
        'Teknisi pipa dijadwalkan datang jam 14.00 WIB untuk penggantian seal kran.',
        '2026-10-27',
        null,
      );

      // 3. Selesai (prioritas rendah)
      insKeluhan.run(
        p3.kamar_id,
        p3.id,
        'Lampu utama kamar redup/berkedip',
        'Lampu LED plafon kamar sering berkedip saat dinyalakan malam hari.',
        'Kelistrikan',
        'Rendah',
        'Selesai',
        'Sudah diganti dengan lampu LED Phillips 14W baru oleh pengelola.',
        '2026-10-25',
        '2026-10-26',
      );
    });
    console.log(`[seed] Keluhan contoh untuk demo Sprint 4 (Pending, Diproses, Selesai) berhasil ditambahkan.`);
  }
} else {
  console.log(`[seed] Keluhan sudah ada (${nKeluhan} keluhan).`);
}
