import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { BedDouble, Plus } from 'lucide-react';
import { api, ApiError, rupiah } from '../api';
import type { Kamar, KamarForm } from '../api';
import { Field, Modal, StatusPill, selectClass } from '../components';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { enterClass, stagger } from '@/lib/motion';
import { cn } from '@/lib/utils';

// EP-01 US-02 (WBS 1.2): katalog & status kamar + kelola data kamar (EP-01 US-01).

const TIPE = ['Standar', 'AC', 'VIP'];
const HARGA_MAX = [
  ['', 'Semua harga'], ['1000000', '≤ Rp 1.000.000'], ['1300000', '≤ Rp 1.300.000'], ['2000000', '≤ Rp 2.000.000'],
];
const emptyForm: KamarForm = { nomor: '', tipe: 'Standar', harga: '', foto_url: '' };

type Props = { notify: (m: string) => void; autoOpen?: boolean; initialQuery?: string; onDaftarkan: (kamarId: number) => void };

export default function KamarPage({ notify, autoOpen = false, initialQuery = '', onDaftarkan }: Props) {
  const [items, setItems] = useState<Kamar[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState(initialQuery);
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
      <Card className="py-4">
        <CardContent className="space-y-3 px-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              type="search"
              className="sm:flex-1"
              placeholder="Cari nomor, tipe kamar, atau nama penghuni..."
              aria-label="Cari kamar"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <select aria-label="Filter status" className={`${selectClass} sm:w-40`} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Semua status</option>
              <option>Kosong</option>
              <option>Terisi</option>
            </select>
            <select aria-label="Filter harga" className={`${selectClass} sm:w-44`} value={hargaMax} onChange={(e) => setHargaMax(e.target.value)}>
              {HARGA_MAX.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
            <Button onClick={() => setEditing('new')}>
              <Plus /> Tambah Kamar
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Menampilkan <span className="font-medium text-foreground">{items.length}</span> kamar ·{' '}
            <span className="font-medium text-emerald-600">{kosong} kosong</span> · {items.length - kosong} terisi
          </p>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading && !items.length ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">Memuat data kamar...</CardContent>
        </Card>
      ) : !items.length ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Belum ada kamar yang cocok. {!status && !q && !hargaMax && 'Klik "Tambah Kamar" untuk mulai.'}
          </CardContent>
        </Card>
      ) : (
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((k, i) => (
            <Card
              key={k.id}
              style={stagger(i)}
              className={cn('gap-0 overflow-hidden py-0 transition-[translate,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-md', enterClass)}
            >
              <div className="flex aspect-video items-center justify-center bg-muted text-muted-foreground">
                {k.foto_url ? (
                  <img src={k.foto_url} alt={`Foto ${k.nomor}`} loading="lazy" className="size-full object-cover" />
                ) : (
                  <BedDouble className="size-8" aria-hidden />
                )}
              </div>
              <CardContent className="flex flex-1 flex-col gap-1 p-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="truncate font-semibold">{k.nomor}</h3>
                  <StatusPill status={k.status} />
                </div>
                <p className="text-sm text-muted-foreground">Tipe {k.tipe}</p>
                <p className="text-lg font-semibold">
                  {rupiah(k.harga)}
                  <span className="text-sm font-normal text-muted-foreground"> / bulan</span>
                </p>
                {k.status === 'Terisi' && k.penghuni_nama && (
                  <p className="truncate text-sm">
                    Dihuni: <span className="font-medium">{k.penghuni_nama}</span> ({k.penghuni_no_hp})
                  </p>
                )}
                <div className="mt-auto flex flex-wrap gap-2 pt-3">
                  {k.status === 'Kosong' && (
                    <Button size="sm" onClick={() => onDaftarkan(k.id)}>
                      Isi Penghuni
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => setEditing(k)}>
                    Ubah
                  </Button>
                  {k.status === 'Kosong' && (
                    <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => hapus(k)}>
                      Hapus
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
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
      <form className="grid gap-4" onSubmit={submit} noValidate>
        {errors._ && (
          <Alert variant="destructive">
            <AlertDescription>{errors._}</AlertDescription>
          </Alert>
        )}
        <Field label="Nomor kamar *" error={errors.nomor}>
          <Input autoFocus value={form.nomor} onChange={set('nomor')} placeholder="mis. Kamar 13" maxLength={20} aria-invalid={!!errors.nomor} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tipe *" error={errors.tipe}>
            <select className={selectClass} value={form.tipe} onChange={set('tipe')}>
              {tipeOptions.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>
          <Field label="Harga per bulan (Rp) *" error={errors.harga}>
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              step={50000}
              value={form.harga}
              onChange={set('harga')}
              placeholder="1200000"
              aria-invalid={!!errors.harga}
            />
          </Field>
        </div>
        <Field label="URL foto (opsional)" error={errors.foto_url}>
          <Input type="url" value={form.foto_url} onChange={set('foto_url')} placeholder="https://..." />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Menyimpan...' : 'Simpan'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
