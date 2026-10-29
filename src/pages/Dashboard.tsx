import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { BedDouble, Building2, LayoutGrid, Plus, UserPlus } from 'lucide-react';
import { api, ApiError, rupiah, tanggal, today } from '../api';
import type { Kamar, KamarForm, Penghuni, PenghuniForm, Ringkasan } from '../api';
import { Field, IconWidget, Modal, Stat, StatusPill, selectClass } from '../components';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

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
    <>
      {apiError && (
        <Alert variant="destructive">
          <AlertDescription>{apiError}</AlertDescription>
        </Alert>
      )}

      {/* Baris 1: ringkasan real-time dari backend */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          title="Total Kamar"
          value={r ? totalKamar : '–'}
          hint="Terdaftar di database"
          progress={100}
          progressLabel="Kapasitas kos"
        />
        <Stat
          title="Kamar Terisi"
          value={r ? `${terisi} / ${totalKamar}` : '–'}
          hint={`${r?.total_penghuni ?? 0} penghuni aktif`}
          progress={occPct}
          progressLabel="Tingkat hunian"
        />
        <Stat
          title="Kamar Kosong"
          value={r ? kosong : '–'}
          hint="Siap dihuni"
          progress={kosongPct}
          progressLabel="Ketersediaan"
        />
        <Stat
          title="Sewa Aktif / Bln"
          value={r ? rupiah(pendapatan) : '–'}
          hint={`Dari potensi ${rupiah(potensi)}`}
          progress={revPct}
          progressLabel="Realisasi sewa"
        />
      </div>

      {/* Baris 2: katalog kamar (WBS 1.2) + form registrasi penghuni (WBS 1.3) */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="min-w-0 lg:col-span-2">
          <CardHeader>
            <CardTitle>Katalog & Status Kamar</CardTitle>
            <CardDescription>
              {katalogFiltered.length} tampil · {kosong} kosong · {terisi} terisi
            </CardDescription>
            <CardAction className="flex gap-2">
              <Button size="sm" onClick={() => setAddingKamar(true)}>
                <Plus /> Tambah Kamar
              </Button>
              <Button size="sm" variant="outline" onClick={() => go('Kamar')}>
                Kelola Penuh
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                type="search"
                className="sm:flex-1"
                placeholder="Cari nomor, tipe, atau nama penghuni..."
                aria-label="Cari kamar"
                value={searchKamar}
                onChange={(e) => setSearchKamar(e.target.value)}
              />
              <select
                aria-label="Filter status kamar"
                className={`${selectClass} sm:w-44`}
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as '' | 'Kosong' | 'Terisi')}
              >
                <option value="">Semua status ({totalKamar})</option>
                <option value="Kosong">Kosong ({kosong})</option>
                <option value="Terisi">Terisi ({terisi})</option>
              </select>
              <select
                aria-label="Filter harga maksimal"
                className={`${selectClass} sm:w-40`}
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
              <p className="py-10 text-center text-sm text-muted-foreground">Tidak ada kamar yang cocok dengan filter.</p>
            ) : (
              <div className="grid max-h-[28rem] gap-3 overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-3">
                {katalogFiltered.map((k) => {
                  const isSelected = Number(form.kamar_id) === k.id;
                  return (
                    <div
                      key={k.id}
                      className={cn('flex flex-col overflow-hidden rounded-lg border', isSelected && 'ring-2 ring-primary')}
                    >
                      <div className="flex aspect-[16/9] items-center justify-center bg-muted text-muted-foreground">
                        {k.foto_url ? (
                          <img src={k.foto_url} alt={k.nomor} loading="lazy" className="size-full object-cover" />
                        ) : (
                          <BedDouble className="size-6" aria-hidden />
                        )}
                      </div>
                      <div className="flex flex-1 flex-col gap-1 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate font-medium">{k.nomor}</span>
                          <StatusPill status={k.status} />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Tipe {k.tipe} · {rupiah(k.harga)}/bln
                        </p>
                        {k.status === 'Terisi' ? (
                          <p className="truncate text-sm">
                            Penghuni: <span className="font-medium">{k.penghuni_nama ?? 'Terisi'}</span>
                          </p>
                        ) : (
                          <Button
                            size="sm"
                            variant={isSelected ? 'outline' : 'default'}
                            className="mt-auto self-start"
                            onClick={() => setForm((f) => ({ ...f, kamar_id: String(k.id) }))}
                          >
                            {isSelected ? 'Dipilih di Form ✓' : 'Pilih Kamar Ini'}
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2">
              Registrasi Penghuni Baru
              <Badge variant="outline">{kamarKosongList.length} kamar kosong</Badge>
            </CardTitle>
            <CardDescription>
              Isi form di bawah atau klik <span className="font-medium text-foreground">Pilih Kamar Ini</span> pada katalog.
              Setelah disimpan ke API, status kamar otomatis berubah menjadi{' '}
              <span className="font-medium text-foreground">Terisi</span>.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4" onSubmit={submitPenghuni} noValidate>
              {errors._ && (
                <Alert variant="destructive">
                  <AlertDescription>{errors._}</AlertDescription>
                </Alert>
              )}
              <Field label="Nama lengkap penghuni *" error={errors.nama}>
                <Input
                  value={form.nama}
                  onChange={setField('nama')}
                  placeholder="mis. Fajar Hidayat"
                  maxLength={100}
                  aria-invalid={!!errors.nama}
                />
              </Field>
              <Field label="Nomor HP *" error={errors.no_hp} hint="Format 08xx / 628xx">
                <Input
                  type="tel"
                  inputMode="tel"
                  value={form.no_hp}
                  onChange={setField('no_hp')}
                  placeholder="081234567890"
                  aria-invalid={!!errors.no_hp}
                />
              </Field>
              <Field label="Pilih kamar *" error={errors.kamar_id} hint="Kamar berstatus Terisi otomatis dikunci">
                <select className={selectClass} value={form.kamar_id} onChange={setField('kamar_id')} aria-invalid={!!errors.kamar_id}>
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
                <Input type="date" value={form.tanggal_masuk} onChange={setField('tanggal_masuk')} aria-invalid={!!errors.tanggal_masuk} />
              </Field>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setForm(blankPenghuni());
                    setErrors({});
                  }}
                >
                  Reset
                </Button>
                <Button type="submit" disabled={saving || kamarKosongList.length === 0}>
                  {saving ? 'Menyimpan...' : 'Daftarkan Penghuni'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Baris 3: aksi cepat */}
      <div className="grid gap-4 sm:grid-cols-3">
        <IconWidget
          Icon={Building2}
          title="Tambah Kamar Baru"
          subtitle="Tambah unit kamar ke katalog"
          onClick={() => setAddingKamar(true)}
        />
        <IconWidget
          Icon={UserPlus}
          title={`${penghuniList.length} Penghuni Aktif`}
          subtitle="Buka halaman kelola penghuni"
          onClick={() => go('Penghuni')}
        />
        <IconWidget
          Icon={LayoutGrid}
          title={`${kosong} Kamar Tersedia`}
          subtitle="Buka katalog kamar lengkap"
          onClick={() => go('Kamar')}
        />
      </div>

      {/* Baris 4: tabel penghuni & kamar terisi + okupansi per tipe kamar */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="min-w-0 lg:col-span-2">
          <CardHeader>
            <CardTitle>Daftar Penghuni Aktif & Kamar Terisi ({penghuniList.length})</CardTitle>
            <CardAction>
              <Button size="sm" variant="link" className="px-0" onClick={() => go('Penghuni')}>
                Lihat riwayat lengkap
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              type="search"
              placeholder="Cari penghuni, nomor kamar, atau no. HP..."
              aria-label="Cari penghuni"
              value={searchPenghuni}
              onChange={(e) => setSearchPenghuni(e.target.value)}
            />
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Penghuni</TableHead>
                    <TableHead>Kamar</TableHead>
                    <TableHead>Harga Sewa</TableHead>
                    <TableHead>Tanggal Masuk</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {penghuniFiltered.length ? (
                    penghuniFiltered.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>
                          <div className="font-medium">{p.nama}</div>
                          <div className="text-xs text-muted-foreground tabular-nums">{p.no_hp}</div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{p.kamar_nomor}</div>
                          {p.kamar_tipe && <div className="text-xs text-muted-foreground">Tipe {p.kamar_tipe}</div>}
                        </TableCell>
                        <TableCell className="tabular-nums">{p.kamar_harga ? rupiah(p.kamar_harga) : '–'}</TableCell>
                        <TableCell>{tanggal(p.tanggal_masuk)}</TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline" onClick={() => catatKeluar(p)}>
                            Catat Keluar
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                        Belum ada penghuni yang cocok.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Okupansi per Tipe Kamar</CardTitle>
            <CardAction>
              <Button size="sm" variant="link" className="px-0" onClick={() => go('Kamar')}>
                Detail
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-4">
            {tipeStats.map((t) => (
              <div key={t.tipe} className="space-y-1.5">
                <div className="flex justify-between gap-2 text-sm">
                  <span className="shrink-0 font-medium">Tipe {t.tipe}</span>
                  <span className="text-right text-muted-foreground">
                    {t.occ} terisi dari {t.total} kamar ({t.pct}%)
                  </span>
                </div>
                <Progress value={t.pct} className="h-1.5" />
              </div>
            ))}
          </CardContent>
          <CardContent className="space-y-2 border-t pt-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Total Kamar Terisi</span>
              <Badge variant="secondary">{terisi} kamar</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Total Kamar Kosong</span>
              <Badge variant="outline">{kosong} kamar</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Total Sewa Aktif Bulan Ini</span>
              <span className="font-semibold tabular-nums">{rupiah(pendapatan)}</span>
            </div>
          </CardContent>
        </Card>
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
    </>
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
              {TIPE_LIST.map((t) => (
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
            {saving ? 'Menyimpan...' : 'Simpan Kamar'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
