import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import {
  api,
  ApiError,
  formatPeriodeSewa,
  hitungAkhirSewa,
  PERIODE_SEWA_LIST,
  rupiah,
  satuanPeriode,
  tanggal,
  today,
} from '../api';
import type { Kamar, Penghuni, PenghuniForm, PeriodeSewa } from '../api';
import { Field, Modal, selectClass } from '../components';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

// EP-01 US-03 (WBS 1.3): form registrasi penghuni baru (< 2 menit) + daftar penghuni.

const PHONE_RE = /^(\+62|62|0)8\d{7,12}$/;
const blank = (kamarId?: number): PenghuniForm => ({
  nama: '',
  no_hp: '',
  kamar_id: kamarId ? String(kamarId) : '',
  tanggal_masuk: today(),
  periode_sewa: 'Bulanan',
  durasi_sewa: '1',
  harga_sewa: '',
  tanggal_selesai_sewa: '',
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
  const [aturSewa, setAturSewa] = useState<Penghuni | null>(null);
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
  const applyPresetSewa = (kamarIdStr: string, periode: PeriodeSewa, durasiStr: string, tglMasuk: string) => {
    const durasi = Math.max(1, Number(durasiStr) || 1);
    setForm((prev) => ({
      ...prev,
      kamar_id: kamarIdStr,
      periode_sewa: periode,
      durasi_sewa: String(durasi),
      tanggal_selesai_sewa: hitungAkhirSewa(tglMasuk, periode, durasi),
    }));
  };

  useEffect(() => {
    if (presetKamarId && kamar.length) {
      const kObj = kamar.find((k) => k.id === presetKamarId);
      if (kObj) {
        setForm((prev) => ({
          ...prev,
          kamar_id: String(presetKamarId),
          tanggal_selesai_sewa: hitungAkhirSewa(prev.tanggal_masuk, (prev.periode_sewa ?? 'Bulanan') as PeriodeSewa, Number(prev.durasi_sewa || 1)),
        }));
      }
    }
  }, [presetKamarId, kamar]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const local: Record<string, string> = {};
    if (!form.nama.trim()) local.nama = 'Nama wajib diisi.';
    if (!form.no_hp.trim()) local.no_hp = 'Nomor HP wajib diisi.';
    else if (!PHONE_RE.test(form.no_hp.replace(/[\s.-]/g, ''))) local.no_hp = 'Nomor HP tidak valid (contoh: 081234567890).';
    if (!form.kamar_id) local.kamar_id = 'Pilih kamar.';
    if (!form.tanggal_masuk) local.tanggal_masuk = 'Tanggal masuk wajib diisi.';
    const dur = Number(form.durasi_sewa || 1);
    if (!Number.isInteger(dur) || dur < 1) local.durasi_sewa = 'Lama penyewaan minimal 1.';
    if (!form.harga_sewa || !(Number(form.harga_sewa) > 0)) local.harga_sewa = 'Masukkan nominal tagihan sewa (Rp).';
    setErrors(local);
    if (Object.keys(local).length) return;
    setSaving(true);
    try {
      const p = await api.penghuni.create(form);
      notify(`${p.nama} terdaftar di ${p.kamar_nomor} (${formatPeriodeSewa(p.periode_sewa, p.durasi_sewa)}).`);
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

  const [kodeChat, setKodeChat] = useState<{ nama: string; kode: string } | null>(null);
  const buatKodeChat = async (p: Penghuni) => {
    try {
      const { kode } = await api.penghuni.kodeChat(p.id);
      setKodeChat({ nama: p.nama, kode });
    } catch (e) {
      notify((e as Error).message);
    }
  };

  const keluar = async (p: Penghuni) => {
    const tunggakan = p.tagihan_belum_lunas ? `\n\nPerhatian: masih ada ${p.tagihan_belum_lunas} tagihan belum lunas. Tagihan tetap tercatat setelah keluar.` : '';
    if (!window.confirm(`Catat ${p.nama} keluar dari ${p.kamar_nomor}? Kamar akan menjadi "Kosong".${tunggakan}`)) return;
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
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="min-w-0 lg:col-span-2">
          <CardHeader>
            <CardTitle>Daftar Penghuni {semua ? '(Termasuk Riwayat)' : 'Aktif'}</CardTitle>
            <CardAction>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={semua}
                  onChange={(e) => setSemua(e.target.checked)}
                />
                Tampilkan riwayat
              </label>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              type="search"
              placeholder="Cari nama, kamar, atau nomor HP..."
              aria-label="Cari penghuni"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Penghuni</TableHead>
                    <TableHead>Kamar & Sewa</TableHead>
                    <TableHead>Masa Sewa</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shown.length ? (
                    shown.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>
                          <div className="flex items-center gap-1.5 font-medium">
                            {p.nama}
                            {p.chat_terhubung === 1 && <Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-800">Chatbot</Badge>}
                          </div>
                          <div className="text-xs text-muted-foreground tabular-nums">{p.no_hp}</div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{p.kamar_nomor}</div>
                          <div className="text-xs text-muted-foreground tabular-nums">
                            {rupiah(p.harga_sewa ?? p.kamar_harga ?? 0)} · {formatPeriodeSewa(p.periode_sewa ?? 'Bulanan', p.durasi_sewa ?? 1)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>{tanggal(p.tanggal_masuk)}</div>
                          {p.tanggal_selesai_sewa && (
                            <div className="text-xs text-muted-foreground">s/d {tanggal(p.tanggal_selesai_sewa)}</div>
                          )}
                          {p.tanggal_keluar && <div className="text-xs text-muted-foreground">Keluar {tanggal(p.tanggal_keluar)}</div>}
                        </TableCell>
                        <TableCell>
                          {p.aktif ? (
                            <Badge variant="outline" className="gap-1.5">
                              <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden />
                              Aktif
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Keluar</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {p.aktif === 1 && (
                            <div className="flex flex-wrap justify-end gap-1.5">
                              <Button size="sm" variant="outline" onClick={() => setAturSewa(p)}>
                                Atur Sewa
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => buatKodeChat(p)}>
                                {p.chat_terhubung === 1 ? 'Ganti Chat' : 'Kode Chatbot'}
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => keluar(p)}>
                                Catat Keluar
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                        {penghuni.length ? 'Tidak ada data yang cocok.' : 'Belum ada penghuni terdaftar.'}
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
            <CardTitle>Registrasi Penghuni Baru</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4" onSubmit={submit} noValidate>
              {errors._ && (
                <Alert variant="destructive">
                  <AlertDescription>{errors._}</AlertDescription>
                </Alert>
              )}
              <Field label="Nama lengkap *" error={errors.nama}>
                <Input
                  ref={namaRef}
                  value={form.nama}
                  onChange={set('nama')}
                  placeholder="mis. Andi Pratama"
                  maxLength={100}
                  autoComplete="off"
                  aria-invalid={!!errors.nama}
                />
              </Field>
              <Field label="Nomor HP *" error={errors.no_hp} hint="Format 08xx / 628xx">
                <Input
                  type="tel"
                  inputMode="tel"
                  value={form.no_hp}
                  onChange={set('no_hp')}
                  placeholder="081234567890"
                  aria-invalid={!!errors.no_hp}
                />
              </Field>
              <Field label="Kamar *" error={errors.kamar_id} hint={`${kosong.length} kamar kosong tersedia`}>
                <select
                  className={selectClass}
                  value={form.kamar_id}
                  onChange={(e) => applyPresetSewa(e.target.value, (form.periode_sewa || 'Bulanan') as PeriodeSewa, form.durasi_sewa || '1', form.tanggal_masuk)}
                  aria-invalid={!!errors.kamar_id}
                >
                  <option value="">-- Pilih kamar kosong --</option>
                  {kamar.map((k) => (
                    <option key={k.id} value={k.id} disabled={k.status === 'Terisi'}>
                      {k.nomor}{k.status === 'Terisi' ? ' (Terisi)' : ' (Kosong)'}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Jangka penyewaan *" error={errors.periode_sewa}>
                  <select
                    className={selectClass}
                    value={form.periode_sewa ?? 'Bulanan'}
                    onChange={(e) => applyPresetSewa(form.kamar_id, e.target.value as PeriodeSewa, form.durasi_sewa || '1', form.tanggal_masuk)}
                  >
                    {PERIODE_SEWA_LIST.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </Field>
                <Field label={`Lama (${satuanPeriode(form.periode_sewa)}) *`} error={errors.durasi_sewa}>
                  <Input
                    type="number"
                    min={1}
                    max={3650}
                    value={form.durasi_sewa ?? '1'}
                    onChange={(e) => applyPresetSewa(form.kamar_id, (form.periode_sewa ?? 'Bulanan') as PeriodeSewa, e.target.value, form.tanggal_masuk)}
                    aria-invalid={!!errors.durasi_sewa}
                  />
                </Field>
              </div>
              <Field
                label="Nominal tagihan sewa (Rp) *"
                error={errors.harga_sewa}
                hint="Masukkan sendiri nominal tagihan sesuai kesepakatan"
              >
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  step={10000}
                  value={form.harga_sewa ?? ''}
                  onChange={set('harga_sewa')}
                  placeholder="mis. 1200000"
                  aria-invalid={!!errors.harga_sewa}
                />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Tanggal mulai *" error={errors.tanggal_masuk}>
                  <Input
                    type="date"
                    value={form.tanggal_masuk}
                    onChange={(e) => {
                      const tgl = e.target.value;
                      setForm((prev) => ({
                        ...prev,
                        tanggal_masuk: tgl,
                        tanggal_selesai_sewa: hitungAkhirSewa(tgl, (prev.periode_sewa ?? 'Bulanan') as PeriodeSewa, Number(prev.durasi_sewa || 1)),
                      }));
                    }}
                    aria-invalid={!!errors.tanggal_masuk}
                  />
                </Field>
                <Field label="Berakhir tanggal" error={errors.tanggal_selesai_sewa}>
                  <Input
                    type="date"
                    value={form.tanggal_selesai_sewa || hitungAkhirSewa(form.tanggal_masuk, (form.periode_sewa ?? 'Bulanan') as PeriodeSewa, Number(form.durasi_sewa || 1))}
                    onChange={set('tanggal_selesai_sewa')}
                    aria-invalid={!!errors.tanggal_selesai_sewa}
                  />
                </Field>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setForm(blank());
                    setErrors({});
                  }}
                >
                  Reset
                </Button>
                <Button type="submit" disabled={saving || !kosong.length}>
                  {saving ? 'Menyimpan...' : 'Simpan Penghuni'}
                </Button>
              </div>
              {!kosong.length && kamar.length > 0 && (
                <p className="text-xs text-muted-foreground">Semua kamar terisi. Tambah kamar baru atau catat penghuni keluar.</p>
              )}
            </form>
          </CardContent>
        </Card>
      </section>
      {kodeChat && (
        <Modal title={`Hubungkan chatbot — ${kodeChat.nama}`} onClose={() => { setKodeChat(null); load(); }}>
          <div className="space-y-3 text-sm">
            <p>Minta penghuni membuka bot Telegram kos lalu mengirim pesan berikut:</p>
            <p className="rounded-md border bg-muted/40 p-3 text-center font-mono text-lg tracking-widest">/hubung {kodeChat.kode}</p>
            <p className="text-muted-foreground">Kode hanya bisa dipakai sekali. Setelah terhubung, penghuni menerima pengingat tagihan dan bisa membayar lewat chat.</p>
          </div>
        </Modal>
      )}
      {aturSewa && (
        <AturSewaModal
          penghuni={aturSewa}
          onClose={() => setAturSewa(null)}
          onSaved={async () => {
            setAturSewa(null);
            notify(`Pengaturan sewa ${aturSewa.nama} diperbarui.`);
            await load();
            onChanged?.();
          }}
        />
      )}
    </>
  );
}

function AturSewaModal({
  penghuni,
  onClose,
  onSaved,
}: {
  penghuni: Penghuni;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [periode, setPeriode] = useState<PeriodeSewa>(penghuni.periode_sewa ?? 'Bulanan');
  const [durasi, setDurasi] = useState(String(penghuni.durasi_sewa ?? 1));
  const [harga, setHarga] = useState(String(penghuni.harga_sewa ?? penghuni.kamar_harga ?? ''));
  const [selesai, setSelesai] = useState(
    penghuni.tanggal_selesai_sewa || hitungAkhirSewa(penghuni.tanggal_masuk, penghuni.periode_sewa ?? 'Bulanan', penghuni.durasi_sewa ?? 1),
  );
  const [updateTagihan, setUpdateTagihan] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const applySuggest = (nextPeriode: PeriodeSewa, nextDurasiStr: string) => {
    setPeriode(nextPeriode);
    setDurasi(nextDurasiStr);
    const d = Math.max(1, Number(nextDurasiStr) || 1);
    setSelesai(hitungAkhirSewa(penghuni.tanggal_masuk, nextPeriode, d));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const d = Number(durasi);
    const h = Number(harga);
    const local: Record<string, string> = {};
    if (!Number.isInteger(d) || d < 1) local.durasi_sewa = 'Lama sewa minimal 1.';
    if (!Number.isInteger(h) || h < 1) local.harga_sewa = 'Harga sewa harus lebih dari 0.';
    setErrors(local);
    if (Object.keys(local).length) return;
    setSaving(true);
    try {
      await api.penghuni.aturSewa(penghuni.id, {
        periode_sewa: periode,
        durasi_sewa: d,
        harga_sewa: h,
        tanggal_selesai_sewa: selesai,
        update_tagihan: updateTagihan,
      });
      onSaved();
    } catch (err) {
      setErrors(err instanceof ApiError && Object.keys(err.errors).length ? err.errors : { _: (err as Error).message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={`Atur Harga & Jangka Sewa — ${penghuni.nama}`} onClose={onClose}>
      <form className="grid gap-4" onSubmit={submit} noValidate>
        <div className="rounded-lg border bg-muted/30 p-3 text-sm">
          <p className="font-medium">{penghuni.kamar_nomor} · Masuk {tanggal(penghuni.tanggal_masuk)}</p>
          <p className="text-xs text-muted-foreground">Ubah jangka waktu sewa (Harian/Mingguan/Bulanan/Tahunan) dan nominal sesuai kesepakatan.</p>
        </div>
        {errors._ && (
          <Alert variant="destructive">
            <AlertDescription>{errors._}</AlertDescription>
          </Alert>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Jangka waktu sewa *" error={errors.periode_sewa}>
            <select className={selectClass} value={periode} onChange={(e) => applySuggest(e.target.value as PeriodeSewa, durasi)}>
              {PERIODE_SEWA_LIST.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </Field>
          <Field label={`Lama sewa (${satuanPeriode(periode)}) *`} error={errors.durasi_sewa}>
            <Input type="number" min={1} max={3650} value={durasi} onChange={(e) => applySuggest(periode, e.target.value)} aria-invalid={!!errors.durasi_sewa} />
          </Field>
        </div>
        <Field label="Harga sewa (Rp) *" error={errors.harga_sewa}>
          <Input type="number" inputMode="numeric" min={1} step={10000} value={harga} onChange={(e) => setHarga(e.target.value)} aria-invalid={!!errors.harga_sewa} />
        </Field>
        <Field label="Tanggal berakhir sewa" error={errors.tanggal_selesai_sewa}>
          <Input type="date" value={selesai} onChange={(e) => setSelesai(e.target.value)} aria-invalid={!!errors.tanggal_selesai_sewa} />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="size-4 accent-primary" checked={updateTagihan} onChange={(e) => setUpdateTagihan(e.target.checked)} />
          <span>Perbarui nominal & jangka sewa pada tagihan yang belum lunas</span>
        </label>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Batal</Button>
          <Button type="submit" disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan Pengaturan'}</Button>
        </div>
      </form>
    </Modal>
  );
}
