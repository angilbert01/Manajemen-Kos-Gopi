import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import {
  MdCalendarToday,
  MdChat,
  MdCheckCircle,
  MdDelete,
  MdHistory,
  MdPrint,
  MdReceipt,
  MdRefresh,
  MdUndo,
  MdWarning,
} from 'react-icons/md';
import { api, namaBulan, rupiah, tanggal, today } from '../api';
import type { AdminProfile, Pembayaran, RekapTagihan, Tagihan } from '../api';
import { Field, Modal } from '../components';

// EP-02 Sistem Tagihan Bulanan & Status Pembayaran (WBS 2.1, 2.2, 2.3)

type Props = { notify: (m: string) => void };

const METODE_LIST = [
  'Tunai',
  'Transfer BCA',
  'Transfer Mandiri',
  'Transfer BRI',
  'Transfer BNI',
  'QRIS',
  'Lainnya',
];

export default function TagihanPage({ notify }: Props) {
  const [rekap, setRekap] = useState<RekapTagihan | null>(null);
  const [list, setList] = useState<Tagihan[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [admin, setAdmin] = useState<AdminProfile | null>(null);
  const [error, setError] = useState('');

  // Filter
  const [selectedBulan, setSelectedBulan] = useState(() => today().slice(0, 7));
  const [statusFilter, setStatusFilter] = useState<'' | 'Belum Lunas' | 'Dicicil' | 'Lunas'>('');
  const [query, setQuery] = useState('');

  // Modals
  const [confirmLunas, setConfirmLunas] = useState<Tagihan | null>(null);
  const [viewKuitansi, setViewKuitansi] = useState<Tagihan | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [rekapData, listData, adminData] = await Promise.all([
        api.tagihan.rekap(selectedBulan),
        api.tagihan.list({ bulan: selectedBulan, status: statusFilter, q: query }),
        api.admin.aktif().catch(() => null),
      ]);
      setRekap(rekapData);
      setList(listData);
      if (adminData) setAdmin(adminData);
      setError('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [selectedBulan, statusFilter, query]);

  useEffect(() => {
    const t = window.setTimeout(loadData, 200);
    return () => window.clearTimeout(t);
  }, [loadData]);

  // WBS 2.1: Generate tagihan bulanan otomatis
  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await api.tagihan.generate(selectedBulan);
      if (res.dibuat > 0) {
        notify(`Berhasil membuat ${res.dibuat} tagihan baru untuk periode ${namaBulan(selectedBulan)}.`);
      } else {
        notify(`Semua penghuni aktif (${res.total_penghuni_aktif}) sudah memiliki tagihan bulan ini.`);
      }
      await loadData();
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setGenerating(false);
    }
  };

  // WBS 2.3: Batal status lunas
  const handleBatalLunas = async (t: Tagihan) => {
    if (!window.confirm(`Batalkan status lunas untuk tagihan ${t.penghuni_nama} (${t.kamar_nomor})?`)) return;
    try {
      await api.tagihan.batal(t.id);
      notify(`Status tagihan ${t.penghuni_nama} dikembalikan menjadi "Belum Lunas".`);
      await loadData();
    } catch (e) {
      notify((e as Error).message);
    }
  };

  // Buka WhatsApp reminder
  const kirimPengingatWa = (t: Tagihan) => {
    let cleanPhone = t.penghuni_no_hp.replace(/\D/g, '');
    if (cleanPhone.startsWith('0')) cleanPhone = `62${cleanPhone.slice(1)}`;
    const kosName = admin?.nama_kos || 'Kos Gopi';
    const pesan =
      t.status_bayar === 'Dicicil'
        ? `Halo Kak ${t.penghuni_nama}, kami dari manajemen ${kosName} menginformasikan sisa tagihan sewa kamar ${t.kamar_nomor} (${t.kamar_tipe}) periode ${namaBulan(t.bulan)} sebesar ${rupiah(t.sisa)} (dari total ${rupiah(t.nominal)}, sudah terbayar ${rupiah(t.terbayar)}) jatuh tempo pada ${tanggal(t.jatuh_tempo)}. Mohon konfirmasi jika sudah melakukan pembayaran ya. Terima kasih! 🙏`
        : `Halo Kak ${t.penghuni_nama}, kami dari manajemen ${kosName} menginformasikan tagihan sewa kamar ${t.kamar_nomor} (${t.kamar_tipe}) untuk periode ${namaBulan(t.bulan)} sebesar ${rupiah(t.nominal)} jatuh tempo pada ${tanggal(t.jatuh_tempo)}. Mohon konfirmasi jika sudah melakukan pembayaran ya. Terima kasih! 🙏`;
    const text = encodeURIComponent(pesan);
    window.open(`https://api.whatsapp.com/send?phone=${cleanPhone}&text=${text}`, '_blank');
  };

  const totalNominal = rekap?.total_nominal ?? 0;
  const nominalLunas = rekap?.nominal_lunas ?? 0;
  const nominalBelum = rekap?.nominal_belum_lunas ?? 0;
  const pctLunas = totalNominal > 0 ? Math.round((nominalLunas / totalNominal) * 100) : 0;

  return (
    <div className="TagihanPage">
      {error && <div className="alert alert-danger mb-3">{error}</div>}

      {/* Header controls & Rekap stats */}
      <div className="card card-body mb-3">
        <div className="d-flex flex-wrap justify-content-between align-items-center" style={{ gap: '0.8rem' }}>
          <div>
            <h4 className="mb-1 d-flex align-items-center">
              <MdReceipt className="text-primary mr-2" size={26} />
              Tagihan Bulanan: <strong>{namaBulan(selectedBulan)}</strong>
            </h4>
            <span className="text-muted small">
              Deliverable WBS 2.1–2.3 · Generate tagihan otomatis & konfirmasi pembayaran
            </span>
          </div>

          <div className="d-flex flex-wrap align-items-center" style={{ gap: '0.5rem' }}>
            <div className="d-flex align-items-center bg-light rounded px-2 py-1" style={{ border: '1px solid var(--border-color)' }}>
              <MdCalendarToday size={16} className="text-muted mr-1" />
              <select
                aria-label="Pilih bulan tagihan"
                className="form-control form-control-sm border-0 bg-transparent font-weight-500"
                value={selectedBulan}
                onChange={(e) => setSelectedBulan(e.target.value)}
                style={{ cursor: 'pointer', outline: 'none' }}
              >
                {rekap?.bulan_tersedia.map((b) => (
                  <option key={b} value={b}>
                    {namaBulan(b)} {b === today().slice(0, 7) ? '(Bulan Ini)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              className="btn btn-sm btn-primary d-inline-flex align-items-center"
              onClick={handleGenerate}
              disabled={generating}
              title="Generate tagihan otomatis untuk semua kamar yang terisi"
            >
              <MdRefresh size={16} className={`mr-1 ${generating ? 'spinner' : ''}`} />
              {generating ? 'Menghasilkan...' : 'Generate Tagihan'}
            </button>
          </div>
        </div>

        {/* Rekap bar: Lunas vs Belum Lunas (WBS 2.2) */}
        <div className="row mt-3 pt-3" style={{ borderTop: '1px solid #f0f0f0' }}>
          <div className="col-md-4 mb-2">
            <div className="p-2 rounded bg-light d-flex justify-content-between align-items-center">
              <div>
                <small className="text-muted d-block">Total Ditagihkan</small>
                <strong>{rupiah(totalNominal)}</strong>
                <span className="text-muted small ml-1">({rekap?.total_tagihan ?? 0} tagihan)</span>
              </div>
              <MdReceipt size={32} className="text-primary" style={{ opacity: 0.3 }} />
            </div>
          </div>

          <div className="col-md-4 mb-2">
            <div className="p-2 rounded" style={{ backgroundColor: '#eafaf1', border: '1px solid #c3e6cb' }}>
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <small className="text-success font-weight-500 d-block">✓ Terkumpul (Lunas)</small>
                  <strong className="text-success">{rupiah(nominalLunas)}</strong>
                  <span className="text-muted small ml-1">({rekap?.total_lunas ?? 0} lunas · {pctLunas}%)</span>
                </div>
                <MdCheckCircle size={32} className="text-success" style={{ opacity: 0.4 }} />
              </div>
              <div className="progress mt-2" style={{ height: '5px' }}>
                <div className="progress-bar bg-success" style={{ width: `${pctLunas}%` }} />
              </div>
            </div>
          </div>

          <div className="col-md-4 mb-2">
            <div className="p-2 rounded" style={{ backgroundColor: '#fff9e6', border: '1px solid #ffeeba' }}>
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <small className="text-warning font-weight-500 d-block" style={{ color: '#856404' }}>
                    ⚠️ Tertunggak (Belum Lunas)
                  </small>
                  <strong style={{ color: '#856404' }}>{rupiah(nominalBelum)}</strong>
                  <span className="text-muted small ml-1">({rekap?.total_belum_lunas ?? 0} belum bayar)</span>
                </div>
                <MdWarning size={32} className="text-warning" style={{ opacity: 0.4 }} />
              </div>
              <div className="progress mt-2" style={{ height: '5px' }}>
                <div className="progress-bar bg-warning" style={{ width: `${100 - pctLunas}%` }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="card card-body mb-3">
        <div className="d-flex flex-wrap justify-content-between align-items-center" style={{ gap: '0.6rem' }}>
          {/* Status Tabs */}
          <div className="btn-group btn-group-sm" role="group" aria-label="Filter status tagihan">
            <button
              type="button"
              className={`btn ${statusFilter === '' ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={() => setStatusFilter('')}
            >
              Semua ({rekap?.total_tagihan ?? 0})
            </button>
            <button
              type="button"
              className={`btn ${statusFilter === 'Belum Lunas' ? 'btn-warning text-dark font-weight-bold' : 'btn-outline-secondary'}`}
              onClick={() => setStatusFilter('Belum Lunas')}
            >
              Belum Lunas ({rekap?.total_belum_lunas ?? 0})
            </button>
            <button
              type="button"
              className={`btn ${statusFilter === 'Dicicil' ? 'btn-info text-white font-weight-bold' : 'btn-outline-secondary'}`}
              onClick={() => setStatusFilter('Dicicil')}
            >
              ⏳ Dicicil ({rekap?.total_dicicil ?? 0})
            </button>
            <button
              type="button"
              className={`btn ${statusFilter === 'Lunas' ? 'btn-success' : 'btn-outline-secondary'}`}
              onClick={() => setStatusFilter('Lunas')}
            >
              Lunas ({rekap?.total_lunas ?? 0})
            </button>
          </div>

          {/* Search Box */}
          <div style={{ maxWidth: '300px', width: '100%' }}>
            <div className="input-group input-group-sm">
              <input
                type="search"
                className="form-control"
                placeholder="Cari penghuni atau kamar..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Cari tagihan"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Daftar Tagihan (Mobile-Friendly & Desktop Table) */}
      <div className="card">
        <div className="card-header d-flex justify-content-between align-items-center">
          <strong>
            Daftar Tagihan {statusFilter ? `— ${statusFilter}` : ''}{' '}
            <small className="text-muted">({list.length} data ditemukan)</small>
          </strong>
          {list.length > 0 && (
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={loadData}>
              <MdRefresh size={15} /> Segarkan
            </button>
          )}
        </div>

        <div className="card-body p-0">
          {loading ? (
            <div className="p-4 text-center text-muted">Memuat data tagihan...</div>
          ) : list.length === 0 ? (
            <div className="p-5 text-center text-muted">
              <MdReceipt size={48} className="mb-2" style={{ opacity: 0.3 }} />
              <p className="mb-2">Belum ada tagihan untuk filter yang dipilih.</p>
              {rekap?.total_tagihan === 0 && (
                <button type="button" className="btn btn-sm btn-primary" onClick={handleGenerate}>
                  Generate Tagihan untuk {namaBulan(selectedBulan)}
                </button>
              )}
            </div>
          ) : (
            <div className="tablewrap">
              <table className="table table-hover mb-0">
                <thead>
                  <tr>
                    <th>Kamar & Penghuni</th>
                    <th>Periode</th>
                    <th>Nominal</th>
                    <th>Jatuh Tempo</th>
                    <th>Status</th>
                    <th>Tanggal Bayar / Metode</th>
                    <th style={{ textAlign: 'right' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((t) => {
                    const isLunas = t.status === 'Lunas';
                    const isDicicil = !isLunas && t.status_bayar === 'Dicicil';
                    const isLewat = !isLunas && t.jatuh_tempo < today();
                    return (
                      <tr key={t.id} style={isLunas ? { opacity: 0.95 } : isDicicil ? { backgroundColor: '#f9fbff' } : { backgroundColor: '#fffdf5' }}>
                        <td>
                          <div className="font-weight-500">
                            <strong>{t.kamar_nomor}</strong>{' '}
                            <span className="badge badge-light" style={{ border: '1px solid #ddd' }}>
                              {t.kamar_tipe}
                            </span>
                          </div>
                          <div className="text-dark">{t.penghuni_nama}</div>
                          <small className="text-muted">{t.penghuni_no_hp}</small>
                        </td>

                        <td>
                          <span className="badge badge-secondary">{namaBulan(t.bulan)}</span>
                        </td>

                        <td>
                          {isDicicil ? (
                            <div>
                              <strong className="text-danger font-weight-bold">{rupiah(t.sisa)}</strong>
                              <small className="text-muted d-block">Sisa dr {rupiah(t.nominal)}</small>
                              <div className="progress mt-1" style={{ height: '3px', width: '90px' }}>
                                <div className="progress-bar bg-info" style={{ width: `${Math.round((t.terbayar / t.nominal) * 100)}%` }} />
                              </div>
                            </div>
                          ) : (
                            <strong className="text-dark font-weight-bold">{rupiah(t.nominal)}</strong>
                          )}
                        </td>

                        <td>
                          <div className="small">
                            {tanggal(t.jatuh_tempo)}
                            {isLewat && (
                              <span className="badge badge-danger ml-1" title="Sudah lewat jatuh tempo">
                                Lewat
                              </span>
                            )}
                          </div>
                        </td>

                        <td>
                          {isLunas ? (
                            <span className="badge badge-success d-inline-flex align-items-center">
                              <MdCheckCircle size={13} className="mr-1" /> Lunas
                            </span>
                          ) : isDicicil ? (
                            <div>
                              <span className="badge badge-info text-white d-inline-flex align-items-center">
                                <MdReceipt size={13} className="mr-1" /> Dicicil ({t.jumlah_pembayaran}x)
                              </span>
                              <div className="small text-muted mt-1">Masuk: {rupiah(t.terbayar)}</div>
                            </div>
                          ) : (
                            <span className="badge badge-warning d-inline-flex align-items-center text-dark">
                              <MdWarning size={13} className="mr-1" /> Belum Lunas
                            </span>
                          )}
                        </td>

                        <td>
                          {isLunas ? (
                            <div className="small">
                              <div>{t.tanggal_bayar ? tanggal(t.tanggal_bayar) : '–'}</div>
                              <span className="badge badge-light" style={{ border: '1px solid #ccc' }}>
                                {t.metode_pembayaran || 'Tunai'}
                              </span>
                            </div>
                          ) : isDicicil ? (
                            <div className="small text-muted">
                              <span>{t.jumlah_pembayaran}x cicilan</span>
                              <div>Terakhir: {t.tanggal_bayar ? tanggal(t.tanggal_bayar) : '–'}</div>
                            </div>
                          ) : (
                            <span className="text-muted small">–</span>
                          )}
                        </td>

                        <td style={{ textAlign: 'right' }}>
                          <div className="d-inline-flex align-items-center" style={{ gap: '0.35rem' }}>
                            {!isLunas ? (
                              <>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-success d-inline-flex align-items-center"
                                  onClick={() => setConfirmLunas(t)}
                                  title="Catat pembayaran (lunas penuh atau cicilan)"
                                >
                                  <MdCheckCircle size={15} className="mr-1" /> {isDicicil ? 'Bayar Cicilan' : 'Bayar / Cicil'}
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-success"
                                  onClick={() => kirimPengingatWa(t)}
                                  title="Kirim pengingat via WhatsApp"
                                >
                                  <MdChat size={15} /> WA
                                </button>
                                {isDicicil && (
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-primary d-inline-flex align-items-center"
                                    onClick={() => setViewKuitansi(t)}
                                    title="Lihat kuitansi sementara cicilan"
                                  >
                                    <MdReceipt size={15} />
                                  </button>
                                )}
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-primary d-inline-flex align-items-center"
                                  onClick={() => setViewKuitansi(t)}
                                  title="Lihat kuitansi pembayaran"
                                >
                                  <MdReceipt size={15} className="mr-1" /> Kuitansi
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-secondary"
                                  onClick={() => handleBatalLunas(t)}
                                  title="Batalkan status lunas (reset pembayaran)"
                                >
                                  <MdUndo size={14} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal WBS 2.3: Konfirmasi Pembayaran Lunas */}
      {confirmLunas && (
        <ModalKonfirmasiLunas
          tagihan={confirmLunas}
          onClose={() => setConfirmLunas(null)}
          onSuccess={async (updated) => {
            setConfirmLunas(null);
            notify(`Tagihan ${updated.penghuni_nama} (${updated.kamar_nomor}) berhasil ditandai Lunas.`);
            await loadData();
          }}
        />
      )}

      {/* Modal Kuitansi Pembayaran */}
      {viewKuitansi && (
        <ModalKuitansi
          tagihan={viewKuitansi}
          admin={admin}
          onClose={() => setViewKuitansi(null)}
        />
      )}
    </div>
  );
}

// Modal Konfirmasi Lunas (WBS 2.3)
function ModalKonfirmasiLunas({
  tagihan,
  onClose,
  onSuccess,
}: {
  tagihan: Tagihan;
  onClose: () => void;
  onSuccess: (t: Tagihan) => void;
}) {
  const sisa = tagihan.sisa > 0 ? tagihan.sisa : tagihan.nominal;
  const [mode, setMode] = useState<'penuh' | 'cicil'>('penuh');
  const [jumlah, setJumlah] = useState(String(sisa));
  const [tglBayar, setTglBayar] = useState(today());
  const [metode, setMetode] = useState('Transfer BCA');
  const [catatan, setCatatan] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [riwayat, setRiwayat] = useState<Pembayaran[]>([]);

  useEffect(() => {
    if (tagihan.jumlah_pembayaran > 0) {
      api.tagihan
        .pembayaran(tagihan.id)
        .then((data) => setRiwayat(data))
        .catch(() => null);
    }
  }, [tagihan.id, tagihan.jumlah_pembayaran]);

  const handleSelectMode = (newMode: 'penuh' | 'cicil') => {
    setMode(newMode);
    if (newMode === 'penuh') {
      setJumlah(String(sisa));
    } else {
      const half = Math.round(sisa / 2 / 50000) * 50000;
      setJumlah(String(half > 0 ? half : sisa));
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const nominalBayar = mode === 'penuh' ? sisa : Number(jumlah);
    if (!nominalBayar || nominalBayar <= 0) {
      setError('Jumlah pembayaran harus lebih dari 0.');
      return;
    }
    if (nominalBayar > sisa) {
      setError(`Jumlah pembayaran melebihi sisa tagihan (${rupiah(sisa)}).`);
      return;
    }

    setSaving(true);
    setError('');
    try {
      let updated: Tagihan;
      if (mode === 'penuh' || nominalBayar >= sisa) {
        updated = await api.tagihan.lunas(tagihan.id, {
          tanggal_bayar: tglBayar,
          metode_pembayaran: metode,
          catatan: catatan.trim() || undefined,
        });
      } else {
        updated = await api.tagihan.bayar(tagihan.id, {
          jumlah: nominalBayar,
          tanggal_bayar: tglBayar,
          metode_pembayaran: metode,
          catatan: catatan.trim() || undefined,
        });
      }
      onSuccess(updated);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleHapusCicilan = async (pembayaranId: number) => {
    if (!window.confirm('Hapus transaksi pembayaran ini?')) return;
    try {
      const updated = await api.tagihan.hapusPembayaran(pembayaranId);
      setRiwayat((prev) => prev.filter((p) => p.id !== pembayaranId));
      onSuccess(updated);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <Modal title={tagihan.status_bayar === 'Dicicil' ? 'Pembayaran Tagihan (Cicilan)' : 'Konfirmasi Pembayaran'} onClose={onClose}>
      <form onSubmit={submit} className="form">
        {error && <div className="alert alert-danger">{error}</div>}

        <div className="card p-3 mb-3 bg-light" style={{ border: '1px solid #e2e8f0' }}>
          <div className="d-flex justify-content-between mb-1">
            <span className="text-muted small">Penghuni:</span>
            <strong>{tagihan.penghuni_nama}</strong>
          </div>
          <div className="d-flex justify-content-between mb-1">
            <span className="text-muted small">Kamar:</span>
            <span>
              <strong>{tagihan.kamar_nomor}</strong> ({tagihan.kamar_tipe})
            </span>
          </div>
          <div className="d-flex justify-content-between mb-1">
            <span className="text-muted small">Periode:</span>
            <span>{namaBulan(tagihan.bulan)}</span>
          </div>
          <div className="d-flex justify-content-between mb-1">
            <span className="text-muted small">Total Tagihan:</span>
            <strong className="text-dark">{rupiah(tagihan.nominal)}</strong>
          </div>
          {tagihan.terbayar > 0 && (
            <div className="d-flex justify-content-between mb-1 text-success small">
              <span>Sudah Terbayar:</span>
              <strong>{rupiah(tagihan.terbayar)}</strong>
            </div>
          )}
          <div className="d-flex justify-content-between pt-2 mt-2" style={{ borderTop: '1px dashed #cbd5e0' }}>
            <span className="font-weight-bold text-dark">Sisa Tagihan:</span>
            <strong className="text-danger h5 mb-0">{rupiah(sisa)}</strong>
          </div>
        </div>

        {/* Pilihan Mode Pembayaran */}
        <div className="mb-3">
          <label className="flabel d-block mb-1">Pilihan Pembayaran *</label>
          <div className="btn-group btn-group-sm w-100" role="group">
            <button
              type="button"
              className={`btn ${mode === 'penuh' ? 'btn-success font-weight-bold' : 'btn-outline-secondary'}`}
              onClick={() => handleSelectMode('penuh')}
              style={{ flex: 1 }}
            >
              ✓ Bayar Penuh ({rupiah(sisa)})
            </button>
            <button
              type="button"
              className={`btn ${mode === 'cicil' ? 'btn-primary font-weight-bold' : 'btn-outline-secondary'}`}
              onClick={() => handleSelectMode('cicil')}
              style={{ flex: 1 }}
            >
              ⏳ Cicil / Bayar Sebagian
            </button>
          </div>
        </div>

        {mode === 'cicil' && (
          <Field label={`Jumlah Pembayaran Cicilan (Maks. ${rupiah(sisa)}) *`}>
            <input
              type="number"
              className="form-control"
              min={10000}
              max={sisa}
              step={50000}
              value={jumlah}
              onChange={(e) => setJumlah(e.target.value)}
              placeholder="mis. 500000"
              required
            />
          </Field>
        )}

        <div className="row2">
          <Field label="Tanggal Bayar *">
            <input
              type="date"
              className="form-control"
              value={tglBayar}
              onChange={(e) => setTglBayar(e.target.value)}
              required
            />
          </Field>

          <Field label="Metode Pembayaran *">
            <select className="form-control" value={metode} onChange={(e) => setMetode(e.target.value)}>
              {METODE_LIST.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Catatan (opsional)">
          <input
            type="text"
            className="form-control"
            placeholder={mode === 'cicil' ? 'mis. Cicilan ke-1 / DP via BCA' : 'mis. Lunas transfer via BCA'}
            value={catatan}
            onChange={(e) => setCatatan(e.target.value)}
          />
        </Field>

        {riwayat.length > 0 && (
          <div className="mb-3 pt-2 border-top">
            <div className="small font-weight-bold text-muted mb-2 d-flex align-items-center">
              <MdHistory className="mr-1" size={15} /> Riwayat Pembayaran Sebelumnya ({riwayat.length}x)
            </div>
            <div className="list-group list-group-flush border rounded small" style={{ maxHeight: '140px', overflowY: 'auto' }}>
              {riwayat.map((p, idx) => (
                <div key={p.id} className="list-group-item p-2 d-flex justify-content-between align-items-center">
                  <div>
                    <span className="badge badge-light border mr-1">#{idx + 1}</span>
                    <strong>{rupiah(p.jumlah)}</strong>
                    <span className="text-muted ml-1">· {tanggal(p.tanggal_bayar)} ({p.metode_pembayaran})</span>
                    {p.catatan && <small className="text-muted d-block">{p.catatan}</small>}
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-danger p-1"
                    title="Hapus transaksi cicilan ini"
                    onClick={() => handleHapusCicilan(p.id)}
                  >
                    <MdDelete size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="formactions">
          <button type="button" className="btn btn-outline-secondary" onClick={onClose} disabled={saving}>
            Batal
          </button>
          <button
            type="submit"
            className={`btn ${mode === 'penuh' ? 'btn-success' : 'btn-primary'} d-inline-flex align-items-center`}
            disabled={saving}
          >
            <MdCheckCircle size={16} className="mr-1" />
            {saving
              ? 'Menyimpan...'
              : mode === 'penuh'
              ? 'Simpan & Tandai Lunas'
              : `Catat Cicilan (${rupiah(Number(jumlah) || 0)})`}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// Modal Kuitansi Digital Kos Gopi
function ModalKuitansi({
  tagihan,
  admin,
  onClose,
}: {
  tagihan: Tagihan;
  admin: AdminProfile | null;
  onClose: () => void;
}) {
  const kosName = admin?.nama_kos || 'Kos Gopi';
  const alamat = admin?.alamat_kos || 'Jl. Veteran No. 12, Malang';
  const adminName = admin?.nama || 'Pengelola Kos';
  const noHp = admin?.no_hp || '';

  const cetak = () => {
    window.print();
  };

  return (
    <Modal title="Bukti Pembayaran / Kuitansi" onClose={onClose}>
      <div className="kuitansi-box p-4 bg-white rounded border" id="area-kuitansi">
        <div className="d-flex justify-content-between align-items-start pb-3 mb-3 border-bottom">
          <div>
            <h4 className="text-primary font-weight-bold mb-0">{kosName}</h4>
            <div className="small text-muted">{alamat}</div>
            {noHp && <div className="small text-muted">Telp/WA: {noHp}</div>}
          </div>
          <div className="text-right">
            {tagihan.status === 'Lunas' ? (
              <span className="badge badge-success px-3 py-2 font-weight-bold" style={{ fontSize: '1rem', letterSpacing: '1px' }}>
                ✓ LUNAS
              </span>
            ) : (
              <span className="badge badge-info px-3 py-2 font-weight-bold text-white" style={{ fontSize: '0.9rem', letterSpacing: '1px' }}>
                ⏳ CICILAN ({tagihan.jumlah_pembayaran}x)
              </span>
            )}
            <div className="small text-muted mt-1">No: INV-{tagihan.bulan.replace('-', '')}-{tagihan.id}</div>
          </div>
        </div>

        <div className="mb-3">
          <div className="row small mb-2">
            <div className="col-4 text-muted">Telah Diterima Dari:</div>
            <div className="col-8 font-weight-bold">{tagihan.penghuni_nama}</div>
          </div>
          <div className="row small mb-2">
            <div className="col-4 text-muted">Nomor Kamar:</div>
            <div className="col-8">
              <strong>{tagihan.kamar_nomor}</strong> ({tagihan.kamar_tipe})
            </div>
          </div>
          <div className="row small mb-2">
            <div className="col-4 text-muted">Untuk Pembayaran:</div>
            <div className="col-8">Sewa Kamar Periode {namaBulan(tagihan.bulan)}</div>
          </div>
          <div className="row small mb-2">
            <div className="col-4 text-muted">Tanggal Bayar Terakhir:</div>
            <div className="col-8">{tagihan.tanggal_bayar ? tanggal(tagihan.tanggal_bayar) : '–'}</div>
          </div>
          <div className="row small mb-2">
            <div className="col-4 text-muted">Metode Pembayaran:</div>
            <div className="col-8">{tagihan.metode_pembayaran || 'Tunai'}</div>
          </div>
          {tagihan.catatan && (
            <div className="row small mb-2">
              <div className="col-4 text-muted">Catatan:</div>
              <div className="col-8">{tagihan.catatan}</div>
            </div>
          )}
        </div>

        <div className="p-3 my-3 rounded" style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
          <div className="d-flex justify-content-between align-items-center mb-1">
            <span className="font-weight-500 text-muted">Total Tagihan Bulanan:</span>
            <span className="font-weight-bold text-dark">{rupiah(tagihan.nominal)}</span>
          </div>
          <div className="d-flex justify-content-between align-items-center mb-1">
            <span className="font-weight-500 text-success">Sudah Diterima (Terbayar):</span>
            <span className="h5 text-success mb-0 font-weight-bold">{rupiah(tagihan.terbayar || (tagihan.status === 'Lunas' ? tagihan.nominal : 0))}</span>
          </div>
          {tagihan.status !== 'Lunas' && (
            <div className="d-flex justify-content-between align-items-center pt-2 mt-2 border-top">
              <span className="font-weight-500 text-danger">Sisa Tagihan Tertunggak:</span>
              <span className="h5 text-danger mb-0 font-weight-bold">{rupiah(tagihan.sisa)}</span>
            </div>
          )}
        </div>

        <div className="d-flex justify-content-between align-items-end pt-3 text-muted small">
          <div>
            <em>{tagihan.status === 'Lunas' ? 'Terima kasih atas pembayaran Anda.' : 'Kuitansi pembayaran cicilan sementara.'}</em>
          </div>
          <div className="text-right">
            <div>Malang, {tagihan.tanggal_bayar ? tanggal(tagihan.tanggal_bayar) : today()}</div>
            <div style={{ marginTop: '2.5rem' }}>
              <strong>({adminName})</strong>
            </div>
          </div>
        </div>
      </div>

      <div className="formactions mt-3">
        <button type="button" className="btn btn-outline-secondary" onClick={onClose}>
          Tutup
        </button>
        <button type="button" className="btn btn-primary d-inline-flex align-items-center" onClick={cetak}>
          <MdPrint size={16} className="mr-1" /> Cetak / Unduh
        </button>
      </div>
    </Modal>
  );
}
