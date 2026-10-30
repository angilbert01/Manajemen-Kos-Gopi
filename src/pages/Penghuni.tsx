import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { api, ApiError, rupiah, tanggal, today } from '../api';
import type { Kamar, Penghuni, PenghuniForm } from '../api';
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
                    <TableHead>Kamar</TableHead>
                    <TableHead>Tanggal Masuk</TableHead>
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
                        <TableCell>{p.kamar_nomor}</TableCell>
                        <TableCell>
                          {tanggal(p.tanggal_masuk)}
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
                            <div className="flex justify-end gap-2">
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
                <select className={selectClass} value={form.kamar_id} onChange={set('kamar_id')} aria-invalid={!!errors.kamar_id}>
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
                <Input type="date" value={form.tanggal_masuk} onChange={set('tanggal_masuk')} aria-invalid={!!errors.tanggal_masuk} />
              </Field>
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
    </>
  );
}
