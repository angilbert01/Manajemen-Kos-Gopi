import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { MdAdd, MdHotel } from 'react-icons/md';
import { api, ApiError, rupiah } from '../api';
import type { Kamar, KamarForm } from '../api';
import { Field, Modal, StatusPill } from '../components';

// EP-01 US-02 (WBS 1.2): katalog & status kamar + kelola data kamar (EP-01 US-01).

const TIPE = ['Standar', 'AC', 'VIP'];
const HARGA_MAX = [
  ['', 'Semua harga'], ['1000000', '≤ Rp 1.000.000'], ['1300000', '≤ Rp 1.300.000'], ['2000000', '≤ Rp 2.000.000'],
];
const emptyForm: KamarForm = { nomor: '', tipe: 'Standar', harga: '', foto_url: '' };

type Props = { notify: (m: string) => void; autoOpen?: boolean; onDaftarkan: (kamarId: number) => void };

export default function KamarPage({ notify, autoOpen = false, onDaftarkan }: Props) {
  const [items, setItems] = useState<Kamar[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [hargaMax, setHargaMax] = useState('');
  const [editing, setEditing] = useState<Kamar | 'new' | null>(autoOpen ? 'new' : null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await api.kamar.list({ status, harga_max: hargaMax, q }));
      setError('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [status, hargaMax, q]);

  useEffect(() => {
    const t = window.setTimeout(load, 200);
    return () => window.clearTimeout(t);
  }, [load]);

  const hapus = async (k: Kamar) => {
    if (!window.confirm(`Hapus ${k.nomor}?`)) return;
    try {
      await api.kamar.remove(k.id);
      notify(`${k.nomor} dihapus.`);
      load();
    } catch (e) {
      notify((e as Error).message);
    }
  };

  const kosong = items.filter((k) => k.status === 'Kosong').length;

  return (
    <>
      <div className="card card-body mb-3">
        <div className="toolbar">
          <div className="filters grow">
            <input
              type="search"
              className="form-control"
              placeholder="Cari nomor, tipe kamar, atau nama penghuni..."
              aria-label="Cari kamar"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <select
              aria-label="Filter status"
              className="form-control"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">Semua status</option>
              <option>Kosong</option>
              <option>Terisi</option>
            </select>
            <select
              aria-label="Filter harga"
              className="form-control"
              value={hargaMax}
              onChange={(e) => setHargaMax(e.target.value)}
            >
              {HARGA_MAX.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <button type="button" className="btn btn-primary d-inline-flex align-items-center" onClick={() => setEditing('new')}>
            <MdAdd size={18} className="mr-1" /> Tambah Kamar
          </button>
        </div>
        <div className="small text-muted mt-2">
          Menampilkan <strong>{items.length}</strong> kamar · <strong className="text-success">{kosong} kosong</strong> ·{' '}
          {items.length - kosong} terisi
        </div>
      </div>

      {error && <div className="alert alert-danger mb-3">{error}</div>}

      {loading && !items.length ? (
        <div className="card card-body empty">Memuat data kamar...</div>
      ) : !items.length ? (
        <div className="card card-body empty">
          Belum ada kamar yang cocok. {!status && !q && !hargaMax && 'Klik "Tambah Kamar" untuk mulai.'}
        </div>
      ) : (
        <section className="rooms">
          {items.map((k) => (
            <article key={k.id} className={`card room ${k.status === 'Terisi' ? 'is-occupied' : ''}`}>
              <div className="roomphoto">
                {k.foto_url ? <img src={k.foto_url} alt={`Foto ${k.nomor}`} loading="lazy" /> : <MdHotel size={42} />}
              </div>
              <div className="card-body roombody">
                <div className="d-flex justify-content-between align-items-center">
                  <h5 className="card-title mb-0">{k.nomor}</h5>
                  <StatusPill status={k.status} />
                </div>
                <div className="text-muted small">Tipe {k.tipe}</div>
                <div className="price">
                  {rupiah(k.harga)}
                  <small> / bulan</small>
                </div>
                {k.status === 'Terisi' && k.penghuni_nama && (
                  <div className="small text-dark mt-1">
                    Dihuni: <strong>{k.penghuni_nama}</strong> ({k.penghuni_no_hp})
                  </div>
                )}
                <div className="roomactions">
                  {k.status === 'Kosong' && (
                    <button type="button" className="btn btn-sm btn-primary" onClick={() => onDaftarkan(k.id)}>
                      Isi Penghuni
                    </button>
                  )}
                  <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setEditing(k)}>
                    Ubah
                  </button>
                  {k.status === 'Kosong' && (
                    <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => hapus(k)}>
                      Hapus
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </section>
      )}

      {editing && (
        <KamarModal
          kamar={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(k, isNew) => {
            setEditing(null);
            notify(`${k.nomor} ${isNew ? 'ditambahkan' : 'diperbarui'}.`);
            load();
          }}
        />
      )}
    </>
  );
}

function KamarModal({ kamar, onClose, onSaved }: { kamar: Kamar | null; onClose: () => void; onSaved: (k: Kamar, isNew: boolean) => void }) {
  const [form, setForm] = useState<KamarForm>(
    kamar ? { nomor: kamar.nomor, tipe: kamar.tipe, harga: String(kamar.harga), foto_url: kamar.foto_url ?? '' } : emptyForm,
  );
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
      const saved = kamar ? await api.kamar.update(kamar.id, form) : await api.kamar.create(form);
      onSaved(saved, !kamar);
    } catch (err) {
      setErrors(err instanceof ApiError && Object.keys(err.errors).length ? err.errors : { _: (err as Error).message });
    } finally {
      setSaving(false);
    }
  };

  const tipeOptions = TIPE.includes(form.tipe) ? TIPE : [...TIPE, form.tipe];

  return (
    <Modal title={kamar ? `Ubah ${kamar.nomor}` : 'Tambah Kamar'} onClose={onClose}>
      <form className="form" onSubmit={submit} noValidate>
        {errors._ && <div className="alert alert-danger">{errors._}</div>}
        <Field label="Nomor kamar *" error={errors.nomor}>
          <input autoFocus className="form-control" value={form.nomor} onChange={set('nomor')} placeholder="mis. Kamar 13" maxLength={20} />
        </Field>
        <div className="row2">
          <Field label="Tipe *" error={errors.tipe}>
            <select className="form-control" value={form.tipe} onChange={set('tipe')}>
              {tipeOptions.map((t) => (
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
          <input type="url" className="form-control" value={form.foto_url} onChange={set('foto_url')} placeholder="https://..." />
        </Field>
        <div className="formactions">
          <button type="button" className="btn btn-outline-secondary" onClick={onClose}>
            Batal
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
