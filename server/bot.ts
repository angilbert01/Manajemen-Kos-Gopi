<<<<<<< Updated upstream
// EP-05 WBS 5.1-5.2: chatbot penagihan. Logika tidak bergantung platform; server/telegram.ts menyambungkannya ke Telegram.
import { db } from './db.ts';
import { getTagihan } from './app.ts';
import { buatLinkPembayaran, PembayaranError } from './pembayaran-online.ts';
=======
// EP-05 WBS 5.1-5.2: chatbot penagihan & integrasi keluhan Telegram. Logika tidak bergantung platform; server/telegram.ts menyambungkannya ke Telegram.
import { db } from './db.ts';
import { getTagihan } from './app.ts';
import { tanggalJakarta } from './dates.ts';
import { buatLinkPembayaran, PembayaranError } from './pembayaran-online.ts';
import { validateKeluhan } from './validation.ts';
import type { PrioritasKeluhan } from './validation.ts';
>>>>>>> Stashed changes

type Row = Record<string, unknown>;
export type Tombol = { teks: string; url?: string; data?: string };
export type Kirim = (chatId: string, teks: string, tombol?: Tombol[]) => Promise<void>;
/** Pesan masuk yang sudah dinormalkan: teks biasa, atau data tombol yang ditekan. */
export type PesanMasuk = { chatId: string; teks?: string; data?: string };

const rp = (n: unknown) => `Rp ${Number(n).toLocaleString('id-ID')}`;
const namaKos = () =>
  ((db.prepare('SELECT nama_kos FROM admin_profile WHERE aktif = 1 LIMIT 1').get() as Row | undefined)?.nama_kos as string) || 'Kos Gopi';

const penghuniDariChat = (chatId: string) =>
<<<<<<< Updated upstream
  db.prepare('SELECT id, nama, kamar_id FROM penghuni WHERE chat_id = ?').get(chatId) as Row | undefined;
=======
  db.prepare(`
    SELECT p.id, p.nama, p.kamar_id, p.periode_sewa, p.durasi_sewa,
           COALESCE(p.harga_sewa, k.harga) AS harga_sewa,
           p.tanggal_masuk, p.tanggal_selesai_sewa, k.nomor AS kamar_nomor
    FROM penghuni p
    JOIN kamar k ON k.id = p.kamar_id
    WHERE p.chat_id = ? AND p.aktif = 1
  `).get(chatId) as Row | undefined;
>>>>>>> Stashed changes

const tagihanTerbuka = (penghuniId: number) =>
  (db.prepare(`SELECT id FROM tagihan WHERE penghuni_id = ? AND status = 'Belum Lunas' ORDER BY bulan ASC`).all(penghuniId) as { id: number }[])
    .map((r) => getTagihan(r.id) as Row);

<<<<<<< Updated upstream
=======
const KATEGORI_KELUHAN = [
  'Elektronik & AC',
  'Plumbing & Sanitasi',
  'Furnitur & Kasur',
  'Kelistrikan',
  'Kebersihan',
  'Keamanan & Kunci',
  'Fasilitas Kamar',
  'Lainnya',
];

const NORMALISASI_PRIORITAS: Record<string, PrioritasKeluhan> = {
  rendah: 'Rendah',
  sedang: 'Sedang',
  tinggi: 'Tinggi',
};

const FORMAT_KELUHAN = [
  'Format Lapor Keluhan Fasilitas:',
  '1) Format cepat:',
  '/keluhan Judul | Deskripsi',
  '',
  '2) Format lengkap:',
  '/keluhan Kategori | Judul | Deskripsi | Prioritas',
  '',
  'Contoh:',
  '/keluhan AC kamar bocor | Air menetes deras dari unit indoor dan tidak dingin',
  '/keluhan Elektronik & AC | AC bocor | Air menetes deras sejak semalam | Tinggi',
  '',
  `Pilihan Kategori: ${KATEGORI_KELUHAN.join(', ')}`,
  'Pilihan Prioritas: Rendah, Sedang, Tinggi (default: Sedang)',
].join('\n');

>>>>>>> Stashed changes
const BANTUAN = [
  'Perintah yang tersedia:',
  '/tagihan — lihat tagihan yang belum lunas',
  '/bayar — bayar tagihan secara online',
<<<<<<< Updated upstream
=======
  '/keluhan — lapor keluhan fasilitas kamar (dengan format)',
  '/statuskeluhan — lihat progres keluhan kamar Anda',
  '/info — lihat informasi kamar & masa sewa Anda',
>>>>>>> Stashed changes
  '/putus — putuskan akun chat ini dari data penghuni',
].join('\n');

/** Kode 6 digit sekali pakai yang diberikan pemilik kos kepada penghuni untuk menghubungkan chat. */
export function buatKodeHubung(penghuniId: number) {
  for (let i = 0; i < 20; i++) {
    const kode = String(Math.floor(100000 + Math.random() * 900000));
    try {
      db.prepare('UPDATE penghuni SET kode_hubung = ? WHERE id = ?').run(kode, penghuniId);
      return kode;
    } catch (err) {
      if (!(err instanceof Error && err.message.includes('kode_hubung'))) throw err;
    }
  }
  throw new Error('Gagal membuat kode unik.');
}

async function kirimDaftarTagihan(chatId: string, penghuniId: number, kirim: Kirim, untukBayar: boolean) {
  const daftar = tagihanTerbuka(penghuniId);
  if (!daftar.length) return kirim(chatId, 'Tidak ada tagihan yang belum lunas. Terima kasih!');
  if (untukBayar && daftar.length === 1) return kirimLinkBayar(chatId, penghuniId, daftar[0]!.id as number, kirim);
  const labelSewa = (t: Row) =>
    t.periode_sewa && (t.periode_sewa !== 'Bulanan' || Number(t.durasi_sewa ?? 1) > 1)
      ? ` [${t.durasi_sewa ?? 1} ${t.periode_sewa}]`
      : '';
  const baris = daftar.map((t) => `• ${t.kamar_nomor} periode ${t.bulan}${labelSewa(t)}: sisa ${rp(t.sisa)}, jatuh tempo ${t.jatuh_tempo}`);
  return kirim(chatId, `Tagihan belum lunas:\n${baris.join('\n')}\n\nPilih tagihan yang ingin dibayar:`,
    daftar.map((t) => ({ teks: `Bayar ${t.bulan} (${rp(t.sisa)})`, data: `bayar:${t.id}` })));
}

async function kirimLinkBayar(chatId: string, penghuniId: number, tagihanId: number, kirim: Kirim) {
  const t = getTagihan(tagihanId) as Row | undefined;
  if (!t || t.penghuni_id !== penghuniId) return kirim(chatId, 'Tagihan tidak ditemukan.');
  try {
    const trx = await buatLinkPembayaran(tagihanId);
    return kirim(chatId, `Tagihan ${t.kamar_nomor} periode ${t.bulan} sebesar ${rp(trx.jumlah)}.\nSilakan bayar lewat tombol di bawah. Status akan diperbarui otomatis setelah pembayaran berhasil.`,
      [{ teks: `Bayar ${rp(trx.jumlah)}`, url: trx.payment_url as string }]);
  } catch (err) {
    if (err instanceof PembayaranError) return kirim(chatId, err.message);
    throw err;
  }
}

<<<<<<< Updated upstream
/** Tangani satu pesan masuk. */
export async function tanganiPesan({ chatId, teks = '', data }: PesanMasuk, kirim: Kirim) {
  const penghuni = penghuniDariChat(chatId);
  const perintah = teks.trim().toLowerCase();

  const hubung = /^\/?hubung\s+(\d{6})$/i.exec(teks.trim());
=======
const rapikanKategori = (raw: string) =>
  KATEGORI_KELUHAN.find((k) => k.toLowerCase() === raw.toLowerCase()) ?? raw;

async function tanganiKeluhan(chatId: string, penghuni: Row, isi: string, kirim: Kirim) {
  const kamarNomor =
    (penghuni.kamar_nomor as string | undefined) ||
    ((db.prepare('SELECT nomor FROM kamar WHERE id = ?').get(penghuni.kamar_id as number) as Row | undefined)?.nomor as string | undefined) ||
    `Kamar #${penghuni.kamar_id}`;
  const bersih = isi.trim();
  if (!bersih) return kirim(chatId, FORMAT_KELUHAN);
  if (!bersih.includes('|')) {
    return kirim(
      chatId,
      `Format belum sesuai (gunakan pemisah "|").\n\nContoh siap salin untuk laporan Anda:\n/keluhan ${bersih} | Jelaskan detail kendala di kamar ${kamarNomor}\n\n${FORMAT_KELUHAN}`,
    );
  }

  const parts = bersih.split('|').map((s) => s.trim());
  let kategori = 'Fasilitas Kamar';
  let judul = '';
  let deskripsi = '';
  let prioritas: string = 'Sedang';

  if (parts.length === 2) {
    judul = parts[0] ?? '';
    deskripsi = parts[1] ?? '';
  } else if (parts.length === 3) {
    const p2 = NORMALISASI_PRIORITAS[(parts[2] ?? '').toLowerCase()];
    if (p2) {
      judul = parts[0] ?? '';
      deskripsi = parts[1] ?? '';
      prioritas = p2;
    } else {
      kategori = rapikanKategori(parts[0] ?? '') || 'Fasilitas Kamar';
      judul = parts[1] ?? '';
      deskripsi = parts[2] ?? '';
    }
  } else {
    kategori = rapikanKategori(parts[0] ?? '') || 'Fasilitas Kamar';
    judul = parts[1] ?? '';
    deskripsi = parts.length === 4 ? (parts[2] ?? '') : parts.slice(2, -1).join(' | ').trim();
    const pRaw = parts[parts.length - 1] ?? 'Sedang';
    prioritas = NORMALISASI_PRIORITAS[pRaw.toLowerCase()] ?? pRaw;
  }

  const { data, errors } = validateKeluhan({
    kamar_id: penghuni.kamar_id,
    penghuni_id: penghuni.id,
    kategori,
    judul,
    deskripsi,
    prioritas,
    tanggal_lapor: tanggalJakarta(),
  });
  if (!data) {
    const detailError = Object.values(errors ?? {}).join('\n• ');
    return kirim(chatId, `Laporan keluhan belum valid:\n• ${detailError}\n\n${FORMAT_KELUHAN}`);
  }

  const result = db
    .prepare(
      `INSERT INTO keluhan (kamar_id, penghuni_id, judul, deskripsi, kategori, prioritas, status, tanggal_lapor)
       VALUES (?, ?, ?, ?, ?, ?, 'Pending', ?)`,
    )
    .run(data.kamar_id, data.penghuni_id, data.judul, data.deskripsi, data.kategori, data.prioritas, data.tanggal_lapor);

  return kirim(
    chatId,
    [
      `Laporan Keluhan #${result.lastInsertRowid} (${kamarNomor}) berhasil dikirim!`,
      `Kategori: ${data.kategori}`,
      `Prioritas: ${data.prioritas}`,
      `Judul: ${data.judul}`,
      `Deskripsi: ${data.deskripsi}`,
      'Status: Pending (Menunggu tindak lanjut pemilik kos)',
    ].join('\n'),
    [{ teks: 'Lihat Status Keluhan', data: 'statuskeluhan' }],
  );
}

async function kirimStatusKeluhan(chatId: string, penghuni: Row, kirim: Kirim) {
  const kamarNomor = (penghuni.kamar_nomor as string | undefined) || `Kamar #${penghuni.kamar_id}`;
  const rows = db.prepare(`
    SELECT id, judul, kategori, prioritas, status, catatan_penanganan, tanggal_lapor, tanggal_selesai
    FROM keluhan
    WHERE kamar_id = ?
    ORDER BY CASE status WHEN 'Pending' THEN 1 WHEN 'Diproses' THEN 2 ELSE 3 END ASC, id DESC
    LIMIT 10
  `).all(penghuni.kamar_id as number) as Row[];

  if (!rows.length) {
    return kirim(chatId, `Belum ada laporan keluhan untuk kamar ${kamarNomor}.\nKirim /keluhan untuk melihat format laporan baru.`);
  }

  const baris = rows.map((k) => {
    const lines = [`• #${k.id} [${k.status}] ${k.judul}`, `  ${k.kategori} · Prioritas ${k.prioritas} · Lapor ${k.tanggal_lapor}`];
    if (k.catatan_penanganan) lines.push(`  Catatan: ${k.catatan_penanganan}`);
    if (k.tanggal_selesai) lines.push(`  Selesai: ${k.tanggal_selesai}`);
    return lines.join('\n');
  });

  return kirim(
    chatId,
    `Daftar keluhan kamar ${kamarNomor}:\n\n${baris.join('\n\n')}\n\nKirim /keluhan untuk melaporkan kendala baru.`,
  );
}

async function kirimInfoSewa(chatId: string, penghuni: Row, kirim: Kirim) {
  const durasi = Number(penghuni.durasi_sewa ?? 1);
  const periode = String(penghuni.periode_sewa ?? 'Bulanan');
  const lines = [
    `Informasi Hunian — ${namaKos()}`,
    `Nama: ${penghuni.nama}`,
    `Kamar: ${penghuni.kamar_nomor}`,
    `Paket sewa: ${durasi} ${periode} (${rp(penghuni.harga_sewa ?? 0)})`,
    `Tanggal masuk: ${penghuni.tanggal_masuk}`,
  ];
  if (penghuni.tanggal_selesai_sewa) lines.push(`Akhir periode sewa: ${penghuni.tanggal_selesai_sewa}`);
  return kirim(chatId, lines.join('\n'), [
    { teks: 'Lihat Tagihan', data: 'tagihan' },
    { teks: 'Status Keluhan', data: 'statuskeluhan' },
  ]);
}

/** Tangani satu pesan masuk. */
export async function tanganiPesan({ chatId, teks = '', data }: PesanMasuk, kirim: Kirim) {
  const penghuni = penghuniDariChat(chatId);
  const trimmed = teks.trim();
  const perintah = trimmed.toLowerCase();

  const hubung = /^\/?hubung(?:@\w+)?\s+(\d{6})$/i.exec(trimmed);
>>>>>>> Stashed changes
  if (hubung) {
    const p = db.prepare('SELECT id, nama FROM penghuni WHERE kode_hubung = ? AND aktif = 1').get(hubung[1]) as Row | undefined;
    if (!p) return kirim(chatId, 'Kode tidak valid atau sudah dipakai. Minta kode baru ke pemilik kos.');
    db.prepare('UPDATE penghuni SET chat_id = NULL WHERE chat_id = ?').run(chatId);
    db.prepare('UPDATE penghuni SET chat_id = ?, kode_hubung = NULL WHERE id = ?').run(chatId, p.id as number);
<<<<<<< Updated upstream
    return kirim(chatId, `Terhubung sebagai ${p.nama}. Anda akan menerima pengingat tagihan di sini.\n\n${BANTUAN}`);
  }

  if (!penghuni) {
    return kirim(chatId, `Halo! Ini bot tagihan ${namaKos()}.\nUntuk mulai, minta kode 6 digit ke pemilik kos lalu kirim:\n/hubung 123456`);
=======
    return kirim(chatId, `Terhubung sebagai ${p.nama}. Anda akan menerima pengingat tagihan & info keluhan di sini.\n\n${BANTUAN}`);
  }

  if (!penghuni) {
    return kirim(chatId, `Halo! Ini bot layanan ${namaKos()}.\nUntuk mulai, minta kode 6 digit ke pemilik kos lalu kirim:\n/hubung 123456`);
>>>>>>> Stashed changes
  }
  const pid = penghuni.id as number;

  if (data?.startsWith('bayar:')) return kirimLinkBayar(chatId, pid, Number(data.slice(6)), kirim);
<<<<<<< Updated upstream
  if (perintah === '/putus') {
    db.prepare('UPDATE penghuni SET chat_id = NULL WHERE id = ?').run(pid);
    return kirim(chatId, 'Akun chat ini sudah diputus dari data penghuni.');
  }
  // Kenali perintah bayar dalam bahasa sehari-hari juga ("mau bayar", "bayar kos").
  if (perintah === '/bayar' || /\bbayar\b/.test(perintah)) return kirimDaftarTagihan(chatId, pid, kirim, true);
  if (perintah === '/tagihan' || /\btagihan\b/.test(perintah)) return kirimDaftarTagihan(chatId, pid, kirim, false);
=======
  if (data === 'statuskeluhan') return kirimStatusKeluhan(chatId, penghuni, kirim);
  if (data === 'tagihan') return kirimDaftarTagihan(chatId, pid, kirim, false);

  if (/^\/putus(?:@\w+)?$/i.test(trimmed)) {
    db.prepare('UPDATE penghuni SET chat_id = NULL WHERE id = ?').run(pid);
    return kirim(chatId, 'Akun chat ini sudah diputus dari data penghuni.');
  }

  const cmdKeluhan = /^\/keluhan(?:@\w+)?(?:\s+([\s\S]*))?$/i.exec(trimmed);
  if (cmdKeluhan) return tanganiKeluhan(chatId, penghuni, cmdKeluhan[1] ?? '', kirim);

  if (/^\/statuskeluhan(?:@\w+)?$/i.test(trimmed) || /^\/keluhan_status(?:@\w+)?$/i.test(trimmed)) {
    return kirimStatusKeluhan(chatId, penghuni, kirim);
  }
  if (/^\/info(?:@\w+)?$/i.test(trimmed)) return kirimInfoSewa(chatId, penghuni, kirim);
  if (/^\/bayar(?:@\w+)?$/i.test(trimmed)) return kirimDaftarTagihan(chatId, pid, kirim, true);
  if (/^\/tagihan(?:@\w+)?$/i.test(trimmed)) return kirimDaftarTagihan(chatId, pid, kirim, false);

  if (!/^\/[a-z_]+/i.test(trimmed)) {
    if (/\bstatus\s*keluhan\b/i.test(perintah)) return kirimStatusKeluhan(chatId, penghuni, kirim);
    if (/\b(keluhan|komplain|rusak|bocor|mampet)\b/i.test(perintah)) {
      return kirim(chatId, `Ingin melaporkan kendala kamar? Gunakan format berikut:\n\n${FORMAT_KELUHAN}`);
    }
    // Kenali perintah bayar dalam bahasa sehari-hari juga ("mau bayar", "bayar kos").
    if (/\bbayar\b/i.test(perintah)) return kirimDaftarTagihan(chatId, pid, kirim, true);
    if (/\btagihan\b/i.test(perintah)) return kirimDaftarTagihan(chatId, pid, kirim, false);
  }

>>>>>>> Stashed changes
  return kirim(chatId, `Halo ${penghuni.nama}!\n${BANTUAN}`);
}

/** Kirim pengingat H-3/H-0/terlambat ke penghuni yang chat-nya terhubung. Mengembalikan jumlah terkirim. */
export async function kirimPengingatChat(daftar: Row[], kirim: Kirim) {
  let terkirim = 0;
  for (const t of daftar) {
    const p = db.prepare('SELECT chat_id FROM penghuni WHERE id = ? AND chat_id IS NOT NULL').get(t.penghuni_id as number) as Row | undefined;
    if (!p) continue;
    const kapan = t.pengingat === 'Terlambat' ? `sudah terlambat ${-(t.hari as number)} hari` : t.pengingat === 'H-0' ? 'jatuh tempo hari ini' : 'jatuh tempo 3 hari lagi';
    await kirim(p.chat_id as string, `Pengingat ${namaKos()}: tagihan ${t.kamar_nomor} periode ${t.bulan} sebesar ${rp(t.sisa)} ${kapan} (${t.jatuh_tempo}).`,
      [{ teks: `Bayar ${rp(t.sisa)}`, data: `bayar:${t.id}` }]);
    terkirim++;
  }
  return terkirim;
}

<<<<<<< Updated upstream
/** Konfirmasi ke penghuni setelah pembayaran online tercatat. */
export async function kirimKonfirmasiBayar(tagihan: Row, kirim: Kirim) {
  const p = db.prepare('SELECT chat_id FROM penghuni WHERE id = ? AND chat_id IS NOT NULL').get(tagihan.penghuni_id as number) as Row | undefined;
  if (!p) return;
  const sisa = tagihan.sisa as number;
  await kirim(p.chat_id as string, `Pembayaran diterima untuk ${tagihan.kamar_nomor} periode ${tagihan.bulan}. ${sisa > 0 ? `Sisa tagihan ${rp(sisa)}.` : 'Tagihan sudah LUNAS. Terima kasih!'}`);
}
=======
/** Konfirmasi ke penghuni setelah pembayaran online atau manual tercatat. */
export async function kirimKonfirmasiBayar(tagihan: Row, kirim: Kirim) {
  const p = db.prepare('SELECT chat_id FROM penghuni WHERE id = ? AND chat_id IS NOT NULL').get(tagihan.penghuni_id as number) as Row | undefined;
  if (!p) return;
  const sisa = Number(tagihan.sisa ?? 0);
  await kirim(p.chat_id as string, `Pembayaran diterima untuk ${tagihan.kamar_nomor} periode ${tagihan.bulan}. ${sisa > 0 ? `Sisa tagihan ${rp(sisa)}.` : 'Tagihan sudah LUNAS. Terima kasih!'}`);
}

export class TelegramBelumTerhubungError extends Error {}

function chatIdPenghuni(penghuniId: unknown): string {
  if (!penghuniId) {
    throw new TelegramBelumTerhubungError(
      'Penghuni belum terhubung ke Bot Telegram. Hubungkan dulu lewat Kode Chatbot di menu Penghuni.',
    );
  }
  const p = db.prepare('SELECT chat_id FROM penghuni WHERE id = ? AND chat_id IS NOT NULL').get(Number(penghuniId)) as Row | undefined;
  if (!p?.chat_id) {
    throw new TelegramBelumTerhubungError(
      'Penghuni belum terhubung ke Bot Telegram. Hubungkan dulu lewat Kode Chatbot di menu Penghuni.',
    );
  }
  return p.chat_id as string;
}

function pesanKeluhan(keluhan: Row): { teks: string; tombol: Tombol[] } {
  const baris = [
    `Update Keluhan #${keluhan.id} (${keluhan.kamar_nomor}) — ${namaKos()}`,
    `Judul: ${keluhan.judul}`,
    `Status terbaru: ${keluhan.status}`,
  ];
  if (keluhan.catatan_penanganan) baris.push(`Catatan pemilik: ${keluhan.catatan_penanganan}`);
  if (keluhan.tanggal_selesai) baris.push(`Tanggal selesai: ${keluhan.tanggal_selesai}`);
  return { teks: baris.join('\n'), tombol: [{ teks: 'Lihat Semua Keluhan', data: 'statuskeluhan' }] };
}

/** Kirim notifikasi ke penghuni saat pemilik kos memperbarui status atau catatan keluhan. */
export async function kirimUpdateStatusKeluhan(keluhan: Row, kirim: Kirim) {
  if (!keluhan?.penghuni_id) return;
  const p = db.prepare('SELECT chat_id FROM penghuni WHERE id = ? AND chat_id IS NOT NULL').get(keluhan.penghuni_id as number) as Row | undefined;
  if (!p) return;
  const msg = pesanKeluhan(keluhan);
  await kirim(p.chat_id as string, msg.teks, msg.tombol);
}

/** Kirim pengingat atau rincian keluhan langsung ke Telegram penghuni atas permintaan admin. */
export async function kirimPesanKeluhanPenghuni(keluhan: Row, kirim: Kirim) {
  const chatId = chatIdPenghuni(keluhan?.penghuni_id);
  const msg = pesanKeluhan(keluhan);
  await kirim(chatId, msg.teks, msg.tombol);
}

/** Kirim notifikasi ke penghuni saat pemilik membuat atau memperbarui tagihan manual. */
export async function kirimNotifikasiTagihanBaru(tagihan: Row, kirim: Kirim) {
  if (!tagihan?.penghuni_id) return;
  const p = db.prepare('SELECT chat_id FROM penghuni WHERE id = ? AND chat_id IS NOT NULL').get(tagihan.penghuni_id as number) as Row | undefined;
  if (!p) return;
  const sisa = Number(tagihan.sisa ?? 0);
  const labelSewa =
    tagihan.periode_sewa && (tagihan.periode_sewa !== 'Bulanan' || Number(tagihan.durasi_sewa ?? 1) > 1)
      ? ` [${tagihan.durasi_sewa ?? 1} ${tagihan.periode_sewa}]`
      : '';
  const teks = [
    `Info Tagihan ${namaKos()} — ${tagihan.kamar_nomor} (${tagihan.bulan})${labelSewa}`,
    `Nominal: ${rp(tagihan.nominal)} · Sisa: ${rp(sisa)}`,
    `Jatuh tempo: ${tagihan.jatuh_tempo} · Status: ${tagihan.status_bayar ?? tagihan.status}`,
  ].join('\n');
  const tombol = sisa > 0 ? [{ teks: `Bayar ${rp(sisa)}`, data: `bayar:${tagihan.id}` }] : undefined;
  await kirim(p.chat_id as string, teks, tombol);
}

/** Kirim pengingat & rincian tagihan langsung ke Telegram penghuni atas permintaan admin. */
export async function kirimPesanTagihanPenghuni(tagihan: Row, kirim: Kirim) {
  const chatId = chatIdPenghuni(tagihan?.penghuni_id);
  const sisa = Number(tagihan.sisa ?? 0);
  const labelSewa = tagihan.periode_sewa ? ` [${tagihan.durasi_sewa ?? 1} ${tagihan.periode_sewa}]` : '';
  const teks = [
    `Pengingat Tagihan ${namaKos()}`,
    `Penghuni: ${tagihan.penghuni_nama}`,
    `Kamar: ${tagihan.kamar_nomor} · Periode: ${tagihan.bulan}${labelSewa}`,
    `Total tagihan: ${rp(tagihan.nominal)}`,
    `Sudah dibayar: ${rp(tagihan.terbayar ?? 0)}`,
    `Sisa tagihan: ${rp(sisa)}`,
    `Jatuh tempo: ${tagihan.jatuh_tempo}`,
    sisa > 0 ? 'Silakan lunasi melalui tombol bayar di bawah ini.' : 'Status tagihan: LUNAS. Terima kasih!',
  ].join('\n');
  const tombol = sisa > 0 ? [{ teks: `Bayar ${rp(sisa)}`, data: `bayar:${tagihan.id}` }] : undefined;
  await kirim(chatId, teks, tombol);
}

/** Kirim kuitansi resmi pembayaran ke Telegram penghuni atas permintaan admin. */
export async function kirimKuitansiTelegram(tagihan: Row, pembayaranList: Row[], kirim: Kirim) {
  const chatId = chatIdPenghuni(tagihan?.penghuni_id);
  const admin = db.prepare('SELECT nama, nama_kos, alamat_kos FROM admin_profile WHERE aktif = 1 LIMIT 1').get() as Row | undefined;
  const inv = `INV-${String(tagihan.bulan).replace('-', '')}-${tagihan.id}`;
  const rincian = pembayaranList.length
    ? pembayaranList
        .map((r, i) => `${i + 1}. ${r.tanggal_bayar} · ${rp(r.jumlah)} (${r.metode_pembayaran})${r.catatan ? ` — ${r.catatan}` : ''}`)
        .join('\n')
    : '- Belum ada transaksi pembayaran -';
  const teks = [
    `KUITANSI PEMBAYARAN — ${admin?.nama_kos || namaKos()}`,
    ...(admin?.alamat_kos ? [String(admin.alamat_kos)] : []),
    `No: ${inv} · Status: ${tagihan.status_bayar ?? tagihan.status}`,
    `Diterima dari: ${tagihan.penghuni_nama} (${tagihan.kamar_nomor})`,
    `Periode: ${tagihan.bulan} (${tagihan.durasi_sewa ?? 1} ${tagihan.periode_sewa ?? 'Bulanan'})`,
    '',
    `Total tagihan: ${rp(tagihan.nominal)}`,
    `Sudah diterima: ${rp(tagihan.terbayar ?? 0)}`,
    `Sisa tagihan: ${rp(tagihan.sisa ?? 0)}`,
    '',
    'Rincian pembayaran:',
    rincian,
    '',
    tagihan.status === 'Lunas' ? 'Terima kasih atas pembayaran Anda.' : 'Bukti pembayaran sebagian. Sisa tagihan belum lunas.',
    `Pengelola: ${admin?.nama || 'Pengelola Kos'}`,
  ].join('\n');
  await kirim(chatId, teks);
}
>>>>>>> Stashed changes
