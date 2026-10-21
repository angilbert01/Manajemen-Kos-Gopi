import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { MdAdd, MdBusiness, MdHotel, MdPersonAdd, MdViewModule } from 'react-icons/md';
import { api, ApiError, rupiah, tanggal, today } from '../api';
import type { Kamar, KamarForm, Penghuni, PenghuniForm, Ringkasan } from '../api';
import { Field, IconWidget, Modal, Stat, StatusPill } from '../components';

const PHONE_RE = /^(\+62|62|0)8\d{7,12}$/;
const TIPE_LIST = ['Standar', 'AC', 'VIP'];
const blankPenghuni = (kamarId?: number): PenghuniForm => ({
  nama: '',
  no_hp: '',
  kamar_id: kamarId ? String(kamarId) : '',
  tanggal_masuk: today(),
});
const emptyKamar: KamarForm = { nomor: '', tipe: 'Standar', harga: '', foto_url: '' };

type Props = { go: (page: string, action?: 'tambah', kamarId?: number) => void; notify: (m: string) => void };

export default function Dashboard({ go, notify }: Props) {
  const [r, setR] = useState<Ringkasan | null>(null);
  const [kamarList, setKamarList] = useState<Kamar[]>([]);
  const [penghuniList, setPenghuniList] = useState<Penghuni[]>([]);
  const [apiError, setApiError] = useState('');

  // Filter katalog kamar (WBS 1.2)
  const [filterStatus, setFilterStatus] = useState<'' | 'Kosong' | 'Terisi'>('');
  const [filterHarga, setFilterHarga] = useState('');
  const [searchKamar, setSearchKamar] = useState('');

  // Form registrasi penghuni baru (WBS 1.3)
  const [form, setForm] = useState<PenghuniForm>(blankPenghuni());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Modal tambah kamar cepat dari dashboard
  const [addingKamar, setAddingKamar] = useState(false);

  // Filter tabel penghuni aktif
  const [searchPenghuni, setSearchPenghuni] = useState('');

  const loadAll = useCallback(async () => {
    try {
      const [ringkasan, kamars, penghunis] = await Promise.all([
        api.ringkasan(),
        api.kamar.list(),
        api.penghuni.list(false),
      ]);
      setR(ringkasan);
      setKamarList(kamars);
      setPenghuniList(penghunis);
      setApiError('');
    } catch (e) {
      setApiError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const totalKamar = r?.total_kamar ?? 0;
  const terisi = r?.kamar_terisi ?? 0;
  const kosong = r?.kamar_kosong ?? 0;
  const occPct = totalKamar > 0 ? Math.round((terisi / totalKamar) * 100) : 0;
  const kosongPct = totalKamar > 0 ? Math.round((kosong / totalKamar) * 100) : 0;
  const pendapatan = r?.pendapatan_bulanan ?? 0;
  const potensi = r?.potensi_pendapatan ?? 0;
  const revPct = potensi > 0 ? Math.round((pendapatan / potensi) * 100) : 0;

  // Filter katalog kamar secara real-time
  const katalogFiltered = kamarList.filter((k) => {
    if (filterStatus && k.status !== filterStatus) return false;
    if (filterHarga && k.harga > Number(filterHarga)) return false;
    if (searchKamar.trim()) {
      const q = searchKamar.toLowerCase();
      if (!`${k.nomor} ${k.tipe} ${k.penghuni_nama ?? ''}`.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const kamarKosongList = kamarList.filter((k) => k.status === 'Kosong');

  const tipeStats = TIPE_LIST.map((tipe) => {
    const all = kamarList.filter((k) => k.tipe === tipe);
    const occ = all.filter((k) => k.status === 'Terisi').length;
    return { tipe, total: all.length, occ, pct: all.length ? Math.round((occ / all.length) * 100) : 0 };
  });

  const setField = (k: keyof PenghuniForm) => (e: { target: { value: string } }) =>
    setForm({ ...form, [k]: e.target.value });

  // Submit registrasi penghuni -> POST /api/penghuni -> kamar otomatis jadi Terisi
  const submitPenghuni = async (e: FormEvent) => {
    e.preventDefault();
    const local: Record<string, string> = {};
    if (!form.nama.trim()) local.nama = 'Nama wajib diisi.';
    if (!form.no_hp.trim()) local.no_hp = 'Nomor HP wajib diisi.';
    else if (!PHONE_RE.test(form.no_hp.replace(/[\s.-]/g, '')))
      local.no_hp = 'Nomor HP tidak valid (contoh: 081234567890).';
    if (!form.kamar_id) local.kamar_id = 'Pilih kamar kosong.';
    if (!form.tanggal_masuk) local.tanggal_masuk = 'Tanggal masuk wajib diisi.';
    setErrors(local);
    if (Object.keys(local).length) return;

    setSaving(true);
    try {
      const created = await api.penghuni.create(form);
      notify(`${created.nama} berhasil didaftarkan ke ${created.kamar_nomor}. Status kamar otomatis menjadi "Terisi".`);
      setForm(blankPenghuni());
      setErrors({});
      await loadAll();
    } catch (err) {
      setErrors(err instanceof ApiError && Object.keys(err.errors).length ? err.errors : { _: (err as Error).message });
      await loadAll();
    } finally {
      setSaving(false);
    }
  };

  const catatKeluar = async (p: Penghuni) => {
    if (!window.confirm(`Catat ${p.nama} keluar dari ${p.kamar_nomor}? Status kamar akan kembali menjadi "Kosong".`))
      return;
    try {
      await api.penghuni.keluar(p.id);
      notify(`${p.nama} tercatat keluar. ${p.kamar_nomor} kini berstatus "Kosong".`);
      await loadAll();
    } catch (e) {
      notify((e as Error).message);
    }
  };

  const penghuniFiltered = penghuniList.filter((p) =>
    `${p.nama} ${p.kamar_nomor} ${p.no_hp}`.toLowerCase().includes(searchPenghuni.toLowerCase()),
  );

  return (
    <div className="DashboardPage">
      {apiError && <div className="alert alert-danger mb-3">{apiError}</div>}

      {/* Row 1: 4 NumberWidgets 100% Real-Time dari Backend Database */}
      <div className="cr-row cr-row--4 mb-3">
        <Stat
          title="Total Kamar"
          value={r ? totalKamar : '–'}
          hint="Terdaftar di database"
          color="primary"
          progress={100}
          progressLabel="Kapasitas kos"
        />
        <Stat
          title="Kamar Terisi"
          value={r ? `${terisi} / ${totalKamar}` : '–'}
          hint={`${r?.total_penghuni ?? 0} penghuni aktif`}
          color="secondary"
          progress={occPct}
          progressLabel="Tingkat hunian"
        />
        <Stat
          title="Kamar Kosong"
          value={r ? kosong : '–'}
          hint="Siap dihuni"
          color="success"
          progress={kosongPct}
          progressLabel="Ketersediaan"
        />
        <Stat
          title="Sewa Aktif / Bln"
          value={r ? rupiah(pendapatan) : '–'}
          hint={`Dari potensi ${rupiah(potensi)}`}
          color="info"
          progress={revPct}
          progressLabel="Realisasi sewa"
        />
      </div>

      {/* Row 2: Sprint 2 Deliverables — Katalog Kamar (WBS 1.2) + Form Registrasi Penghuni (WBS 1.3) */}
      <div className="cr-row cr-row--charts mb-3">
        {/* WBS 1.2: Tampilan Katalog Kamar dengan Status Terisi / Kosong */}
        <div className="card">
          <div className="card-header d-flex justify-content-between align-items-center">
            <div>
              <strong>Katalog & Status Kamar</strong>{' '}
              <small className="text-muted">({katalogFiltered.length} tampil · {kosong} kosong · {terisi} terisi)</small>
            </div>
            <div className="d-flex align-items-center" style={{ gap: '0.4rem' }}>
              <button
                type="button"
                className="btn btn-sm btn-primary d-inline-flex align-items-center"
                onClick={() => setAddingKamar(true)}
              >
                <MdAdd size={16} className="mr-1" /> Tambah Kamar
              </button>
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => go('Kamar')}>
                Kelola Penuh
              </button>
            </div>
          </div>

          <div className="card-body">
            <div className="filters mb-3">
              <input
                type="search"
                className="form-control"
                placeholder="Cari nomor, tipe, atau nama penghuni..."
                aria-label="Cari kamar"
                value={searchKamar}
                onChange={(e) => setSearchKamar(e.target.value)}
              />
              <select
                aria-label="Filter status kamar"
                className="form-control"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as '' | 'Kosong' | 'Terisi')}
              >
                <option value="">Semua status ({totalKamar})</option>
                <option value="Kosong">Kosong ({kosong})</option>
                <option value="Terisi">Terisi ({terisi})</option>
              </select>
              <select
                aria-label="Filter harga maksimal"
                className="form-control"
                value={filterHarga}
                onChange={(e) => setFilterHarga(e.target.value)}
              >
                <option value="">Semua harga</option>
                <option value="1000000">≤ Rp 1.000.000</option>
                <option value="1300000">≤ Rp 1.300.000</option>
                <option value="2000000">≤ Rp 2.000.000</option>
              </select>
            </div>

            {katalogFiltered.length === 0 ? (
              <div className="empty">Tidak ada kamar yang cocok dengan filter.</div>
            ) : (
              <div className="rooms rooms--compact">
                {katalogFiltered.map((k) => {
                  const isSelected = Number(form.kamar_id) === k.id;
                  return (
                    <article
                      key={k.id}
                      className={`card room ${k.status === 'Terisi' ? 'is-occupied' : ''} ${
                        isSelected ? 'room--selected' : ''
                      }`}
                    >
                      <div className="roomphoto roomphoto--sm">
                        {k.foto_url ? (
                          <img src={k.foto_url} alt={k.nomor} loading="lazy" />
                        ) : (
                          <MdHotel size={30} />
                        )}
                      </div>
                      <div className="card-body roombody">
                        <div className="d-flex justify-content-between align-items-center">
                          <strong>{k.nomor}</strong>
                          <StatusPill status={k.status} />
                        </div>
                        <div className="text-muted small">
                          Tipe {k.tipe} · {rupiah(k.harga)}/bln
                        </div>
                        {k.status === 'Terisi' ? (
                          <div className="small mt-1 text-dark">
                            Penghuni: <strong>{k.penghuni_nama ?? 'Terisi'}</strong>
                          </div>
                        ) : (
                          <div className="roomactions">
                            <button
                              type="button"
                              className={`btn btn-sm ${isSelected ? 'btn-outline-secondary' : 'btn-primary'}`}
                              onClick={() => setForm((f) => ({ ...f, kamar_id: String(k.id) }))}
                            >
                              {isSelected ? 'Dipilih di Form ✓' : 'Pilih Kamar Ini'}
                            </button>
                          </div>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* WBS 1.3: Form & API Registrasi Penghuni Baru (Otomatis Ubah Status Kamar -> Terisi) */}
        <div className="card">
          <div className="card-header d-flex justify-content-between align-items-center">
            <strong>Registrasi Penghuni Baru</strong>
            <span className="badge badge-success">{kamarKosongList.length} kamar kosong</span>
          </div>
          <div className="card-body">
            <p className="text-muted small mb-2">
              Isi form di bawah atau klik <strong>Pilih Kamar Ini</strong> pada katalog. Setelah disimpan ke API, status
              kamar otomatis berubah menjadi <strong>Terisi</strong>.
            </p>
            <form className="form" onSubmit={submitPenghuni} noValidate>
              {errors._ && <div className="alert alert-danger">{errors._}</div>}
              <Field label="Nama lengkap penghuni *" error={errors.nama}>
                <input
                  className="form-control"
                  value={form.nama}
                  onChange={setField('nama')}
                  placeholder="mis. Fajar Hidayat"
                  maxLength={100}
                />
              </Field>
              <Field label="Nomor HP *" error={errors.no_hp} hint="Format 08xx / 628xx">
                <input
                  type="tel"
                  className="form-control"
                  inputMode="tel"
                  value={form.no_hp}
                  onChange={setField('no_hp')}
                  placeholder="081234567890"
                />
              </Field>
              <Field
                label="Pilih kamar *"
                error={errors.kamar_id}
                hint="Kamar berstatus Terisi otomatis dikunci"
              >
                <select className="form-control" value={form.kamar_id} onChange={setField('kamar_id')}>
                  <option value="">-- Pilih kamar kosong --</option>
                  {kamarList.map((k) => (
                    <option key={k.id} value={k.id} disabled={k.status === 'Terisi'}>
                      {k.nomor} · {k.tipe} · {rupiah(k.harga)}
                      {k.status === 'Terisi' ? ` (Terisi - ${k.penghuni_nama ?? ''})` : ' (Kosong)'}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Tanggal mulai sewa *" error={errors.tanggal_masuk}>
                <input
                  type="date"
                  className="form-control"
                  value={form.tanggal_masuk}
                  onChange={setField('tanggal_masuk')}
                />
              </Field>
              <div className="formactions">
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() => {
                    setForm(blankPenghuni());
                    setErrors({});
                  }}
                >
                  Reset
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving || kamarKosongList.length === 0}>
                  {saving ? 'Menyimpan...' : 'Daftarkan Penghuni'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Row 3: CardGroup IconWidgets */}
      <div className="card-group mb-3">
        <IconWidget
          bgColor="primary"
          Icon={MdBusiness}
          title="Tambah Kamar Baru"
          subtitle="Tambah unit kamar ke katalog"
          onClick={() => setAddingKamar(true)}
        />
        <IconWidget
          bgColor="secondary"
          Icon={MdPersonAdd}
          title={`${penghuniList.length} Penghuni Aktif`}
          subtitle="Buka halaman kelola penghuni"
          onClick={() => go('Penghuni')}
        />
        <IconWidget
          bgColor="info"
          Icon={MdViewModule}
          title={`${kosong} Kamar Tersedia`}
          subtitle="Buka katalog kamar lengkap"
          onClick={() => go('Kamar')}
        />
      </div>

      {/* Row 4: Tabel Penghuni & Kamar Terisi (Live dari BE) + Distribusi Okupansi per Tipe Kamar */}
      <div className="cr-row cr-row--2 mb-3">
        <div className="card">
          <div className="card-header d-flex justify-content-between align-items-center">
            <span>Daftar Penghuni Aktif & Kamar Terisi ({penghuniList.length})</span>
            <button type="button" className="btn btn-sm btn-link" onClick={() => go('Penghuni')}>
              Lihat riwayat lengkap
            </button>
          </div>
          <div className="card-body">
            <div className="filters mb-3">
              <input
                type="search"
                className="form-control"
                placeholder="Cari penghuni, nomor kamar, atau no. HP..."
                aria-label="Cari penghuni"
                value={searchPenghuni}
                onChange={(e) => setSearchPenghuni(e.target.value)}
              />
            </div>
            <div className="tablewrap">
              <table className="table table-hover">
                <thead>
                  <tr>
                    <th>Penghuni</th>
                    <th>Kamar</th>
                    <th>Harga Sewa</th>
                    <th>Tanggal Masuk</th>
                    <th>Status Kamar</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {penghuniFiltered.length ? (
                    penghuniFiltered.map((p) => (
                      <tr key={p.id}>
                        <td>
                          <div className="font-weight-500">{p.nama}</div>
                          <div className="text-muted small">{p.no_hp}</div>
                        </td>
                        <td>
                          <strong>{p.kamar_nomor}</strong>
                          {p.kamar_tipe && <div className="text-muted small">Tipe {p.kamar_tipe}</div>}
                        </td>
                        <td>{p.kamar_harga ? rupiah(p.kamar_harga) : '–'}</td>
                        <td>{tanggal(p.tanggal_masuk)}</td>
                        <td>
                          <span className="badge badge-primary">Terisi</span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary"
                            onClick={() => catatKeluar(p)}
                          >
                            Catat Keluar
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="empty">
                        Belum ada penghuni yang cocok.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header d-flex justify-content-between align-items-center">
            <span>Okupansi per Tipe Kamar (Real-Time DB)</span>
            <button type="button" className="btn btn-sm btn-link" onClick={() => go('Kamar')}>
              Detail
            </button>
          </div>
          <div className="card-body">
            {tipeStats.map((t, idx) => {
              const color = idx === 0 ? 'secondary' : idx === 1 ? 'primary' : 'info';
              return (
                <div key={t.tipe} className="mb-3">
                  <div className="d-flex justify-content-between small mb-1">
                    <strong>Tipe {t.tipe}</strong>
                    <span className="text-muted">
                      {t.occ} terisi dari {t.total} kamar ({t.pct}%)
                    </span>
                  </div>
                  <div className="progress" style={{ height: '8px' }}>
                    <div className={`progress-bar bg-${color}`} style={{ width: `${t.pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="list-group list-group-flush">
            <div className="list-group-item d-flex justify-content-between align-items-center small">
              <span>Total Kamar Terisi</span>
              <span className="badge badge-primary">{terisi} kamar</span>
            </div>
            <div className="list-group-item d-flex justify-content-between align-items-center small">
              <span>Total Kamar Kosong</span>
              <span className="badge badge-success">{kosong} kamar</span>
            </div>
            <div className="list-group-item d-flex justify-content-between align-items-center small">
              <span>Total Sewa Aktif Bulan Ini</span>
              <strong>{rupiah(pendapatan)}</strong>
            </div>
          </div>
        </div>
      </div>

      {addingKamar && (
        <TambahKamarModal
          onClose={() => setAddingKamar(false)}
          onSaved={async (k) => {
            setAddingKamar(false);
            notify(`${k.nomor} berhasil ditambahkan dengan status "Kosong".`);
            await loadAll();
          }}
        />
      )}
    </div>
  );
}

function TambahKamarModal({ onClose, onSaved }: { onClose: () => void; onSaved: (k: Kamar) => void }) {
  const [form, setForm] = useState<KamarForm>(emptyKamar);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const set = (k: keyof KamarForm) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const local: Record<string, string> = {};
    if (!form.nomor.trim()) local.nomor = 'Nomor kamar wajib diisi.';
    if (!form.harga) local.harga = 'Harga wajib diisi.';
    else if (!(Number(form.harga) > 0)) local.harga = 'Harga harus lebih dari 0.';
    setErrors(local);
    if (Object.keys(local).length) return;
    setSaving(true);
    try {
      const saved = await api.kamar.create(form);
      onSaved(saved);
    } catch (err) {
      setErrors(err instanceof ApiError && Object.keys(err.errors).length ? err.errors : { _: (err as Error).message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Tambah Kamar Baru" onClose={onClose}>
      <form className="form" onSubmit={submit} noValidate>
        {errors._ && <div className="alert alert-danger">{errors._}</div>}
        <Field label="Nomor kamar *" error={errors.nomor}>
          <input
            autoFocus
            className="form-control"
            value={form.nomor}
            onChange={set('nomor')}
            placeholder="mis. Kamar 13"
            maxLength={20}
          />
        </Field>
        <div className="row2">
          <Field label="Tipe *" error={errors.tipe}>
            <select className="form-control" value={form.tipe} onChange={set('tipe')}>
              {TIPE_LIST.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>
          <Field label="Harga per bulan (Rp) *" error={errors.harga}>
            <input
              type="number"
              className="form-control"
              inputMode="numeric"
              min={1}
              step={50000}
              value={form.harga}
              onChange={set('harga')}
              placeholder="1200000"
            />
          </Field>
        </div>
        <Field label="URL foto (opsional)" error={errors.foto_url}>
          <input
            type="url"
            className="form-control"
            value={form.foto_url}
            onChange={set('foto_url')}
            placeholder="https://..."
          />
        </Field>
        <div className="formactions">
          <button type="button" className="btn btn-outline-secondary" onClick={onClose}>
            Batal
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Menyimpan...' : 'Simpan Kamar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
