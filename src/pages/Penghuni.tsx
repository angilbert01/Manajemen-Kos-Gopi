import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { api, ApiError, rupiah, tanggal, today } from '../api';
import type { Kamar, Penghuni, PenghuniForm } from '../api';
import { Field } from '../components';

// EP-01 US-03 (WBS 1.3): form registrasi penghuni baru (< 2 menit) + daftar penghuni.

const PHONE_RE = /^(\+62|62|0)8\d{7,12}$/;
const blank = (kamarId?: number): PenghuniForm => ({
  nama: '',
  no_hp: '',
  kamar_id: kamarId ? String(kamarId) : '',
  tanggal_masuk: today(),
});

type Props = { notify: (m: string) => void; presetKamarId?: number; onChanged?: () => void };

export default function PenghuniPage({ notify, presetKamarId, onChanged }: Props) {
  const [penghuni, setPenghuni] = useState<Penghuni[]>([]);
  const [kamar, setKamar] = useState<Kamar[]>([]);
  const [semua, setSemua] = useState(false);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState<PenghuniForm>(blank(presetKamarId));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const namaRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const [p, k] = await Promise.all([api.penghuni.list(semua), api.kamar.list()]);
      setPenghuni(p);
      setKamar(k);
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  }, [semua]);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    namaRef.current?.focus();
  }, []);

  const set = (k: keyof PenghuniForm) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const local: Record<string, string> = {};
    if (!form.nama.trim()) local.nama = 'Nama wajib diisi.';
    if (!form.no_hp.trim()) local.no_hp = 'Nomor HP wajib diisi.';
    else if (!PHONE_RE.test(form.no_hp.replace(/[\s.-]/g, ''))) local.no_hp = 'Nomor HP tidak valid (contoh: 081234567890).';
    if (!form.kamar_id) local.kamar_id = 'Pilih kamar.';
    if (!form.tanggal_masuk) local.tanggal_masuk = 'Tanggal masuk wajib diisi.';
    setErrors(local);
    if (Object.keys(local).length) return;
    setSaving(true);
    try {
      const p = await api.penghuni.create(form);
      notify(`${p.nama} terdaftar di ${p.kamar_nomor}. Status kamar kini "Terisi".`);
      setForm(blank());
      setErrors({});
      await load();
      onChanged?.();
      namaRef.current?.focus();
    } catch (err) {
      setErrors(err instanceof ApiError && Object.keys(err.errors).length ? err.errors : { _: (err as Error).message });
      if (err instanceof ApiError && err.status === 409) load();
    } finally {
      setSaving(false);
    }
  };

  const keluar = async (p: Penghuni) => {
    if (!window.confirm(`Catat ${p.nama} keluar dari ${p.kamar_nomor}? Kamar akan menjadi "Kosong".`)) return;
    try {
      await api.penghuni.keluar(p.id);
      notify(`${p.nama} keluar. ${p.kamar_nomor} kini "Kosong".`);
      await load();
      onChanged?.();
    } catch (e) {
      notify((e as Error).message);
    }
  };

  const kosong = kamar.filter((k) => k.status === 'Kosong');
  const shown = penghuni.filter((p) => `${p.nama} ${p.kamar_nomor} ${p.no_hp}`.toLowerCase().includes(query.toLowerCase()));

  return (
    <>
      {error && <div className="alert alert-danger mb-3">{error}</div>}
      <section className="cr-row cr-row--charts">
        <article className="card">
          <div className="card-header d-flex justify-content-between align-items-center">
            <span>Daftar Penghuni {semua ? '(Termasuk Riwayat)' : 'Aktif'}</span>
            <label className="check">
              <input type="checkbox" checked={semua} onChange={(e) => setSemua(e.target.checked)} /> Tampilkan riwayat
            </label>
          </div>
          <div className="card-body">
            <div className="filters mb-3">
              <input
                type="search"
                className="form-control"
                placeholder="Cari nama, kamar, atau nomor HP..."
                aria-label="Cari penghuni"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="tablewrap">
              <table className="table table-hover">
                <thead>
                  <tr>
                    <th>Penghuni</th>
                    <th>Kamar</th>
                    <th>No. HP</th>
                    <th>Tanggal Masuk</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {shown.length ? (
                    shown.map((p) => (
                      <tr key={p.id}>
                        <td className="font-weight-500">{p.nama}</td>
                        <td>{p.kamar_nomor}</td>
                        <td>{p.no_hp}</td>
                        <td>
                          {tanggal(p.tanggal_masuk)}
                          {p.tanggal_keluar && <div className="text-muted small">Keluar {tanggal(p.tanggal_keluar)}</div>}
                        </td>
                        <td>
                          <span className={`badge badge-${p.aktif ? 'success' : 'secondary'}`}>
                            {p.aktif ? 'Aktif' : 'Keluar'}
                          </span>
                        </td>
                        <td>
                          {p.aktif === 1 && (
                            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => keluar(p)}>
                              Catat Keluar
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="empty">
                        {penghuni.length ? 'Tidak ada data yang cocok.' : 'Belum ada penghuni terdaftar.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </article>

        <article className="card">
          <div className="card-header">Registrasi Penghuni Baru</div>
          <div className="card-body">
            <form className="form" onSubmit={submit} noValidate>
              {errors._ && <div className="alert alert-danger">{errors._}</div>}
              <Field label="Nama lengkap *" error={errors.nama}>
                <input
                  ref={namaRef}
                  className="form-control"
                  value={form.nama}
                  onChange={set('nama')}
                  placeholder="mis. Andi Pratama"
                  maxLength={100}
                  autoComplete="off"
                />
              </Field>
              <Field label="Nomor HP *" error={errors.no_hp} hint="Format 08xx / 628xx">
                <input
                  type="tel"
                  className="form-control"
                  inputMode="tel"
                  value={form.no_hp}
                  onChange={set('no_hp')}
                  placeholder="081234567890"
                />
              </Field>
              <Field label="Kamar *" error={errors.kamar_id} hint={`${kosong.length} kamar kosong tersedia`}>
                <select className="form-control" value={form.kamar_id} onChange={set('kamar_id')}>
                  <option value="">-- Pilih kamar kosong --</option>
                  {kamar.map((k) => (
                    <option key={k.id} value={k.id} disabled={k.status === 'Terisi'}>
                      {k.nomor} · {k.tipe} · {rupiah(k.harga)}
                      {k.status === 'Terisi' ? ' (Terisi)' : ''}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Tanggal masuk *" error={errors.tanggal_masuk}>
                <input type="date" className="form-control" value={form.tanggal_masuk} onChange={set('tanggal_masuk')} />
              </Field>
              <div className="formactions">
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() => {
                    setForm(blank());
                    setErrors({});
                  }}
                >
                  Reset
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving || !kosong.length}>
                  {saving ? 'Menyimpan...' : 'Simpan Penghuni'}
                </button>
              </div>
              {!kosong.length && kamar.length > 0 && (
                <div className="fhint">Semua kamar terisi. Tambah kamar baru atau catat penghuni keluar.</div>
              )}
            </form>
          </div>
        </article>
      </section>
    </>
  );
}
