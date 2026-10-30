import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Check, CircleAlert, CreditCard, LoaderCircle, MessageCircle, Printer, Receipt, RefreshCw, Search, Trash2, Undo2 } from 'lucide-react';
import { api, ApiError, namaBulan, rupiah, tanggal, today } from '../api';
import type { AdminProfile, Pembayaran, RekapTagihan, Tagihan } from '../api';
import { Field, Modal, selectClass } from '../components';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

type Filter = '' | 'Belum Lunas' | 'Dicicil' | 'Lunas';
type Props = { notify: (message: string) => void; onChanged: () => void };
const metodeList = ['Tunai', 'Transfer BCA', 'Transfer Mandiri', 'Transfer BRI', 'Transfer BNI', 'QRIS', 'Lainnya'];

function Status({ tagihan }: { tagihan: Tagihan }) {
  return (
    <Badge variant="outline" className={cn(
      'shrink-0', tagihan.status === 'Lunas' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' :
        tagihan.status_bayar === 'Dicicil' ? 'border-blue-200 bg-blue-50 text-blue-800' : 'border-amber-200 bg-amber-50 text-amber-900',
    )}>
      {tagihan.status_bayar === 'Belum Bayar' ? 'Belum Lunas' : tagihan.status_bayar}
    </Badge>
  );
}

export default function TagihanPage({ notify, onChanged }: Props) {
  const [bulan, setBulan] = useState(() => today().slice(0, 7));
  const [status, setStatus] = useState<Filter>('');
  const [query, setQuery] = useState('');
  const [revision, setRevision] = useState(0);
  const [rekap, setRekap] = useState<RekapTagihan | null>(null);
  const [list, setList] = useState<Tagihan[]>([]);
  const [admin, setAdmin] = useState<AdminProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [payment, setPayment] = useState<Tagihan | null>(null);
  const [receipt, setReceipt] = useState<Tagihan | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.admin.aktif().then((result) => { if (!cancelled) setAdmin(result); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    setRekap(null);
    setList([]);
    const timer = window.setTimeout(async () => {
      try {
        const [summary, rows] = await Promise.all([
          api.tagihan.rekap(bulan), api.tagihan.list({ bulan, status, q: query }),
        ]);
        if (!cancelled) { setRekap(summary); setList(rows); }
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 200);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [bulan, status, query, revision]);

  const refresh = () => { setRevision((n) => n + 1); onChanged(); };
  const generate = async () => {
    setBusy(true);
    try {
      const result = await api.tagihan.generate(bulan);
      notify(result.dibuat ? result.dibuat + ' tagihan dibuat untuk ' + namaBulan(bulan) + '.' : 'Tidak ada tagihan baru. Tagihan yang sudah ada tetap disimpan.');
      refresh();
    } catch (err) { notify((err as Error).message); }
    finally { setBusy(false); }
  };

  const undo = async (tagihan: Tagihan) => {
    if (!window.confirm('Batalkan seluruh pembayaran ' + tagihan.penghuni_nama + ' untuk ' + namaBulan(tagihan.bulan) + '? Semua catatan pembayaran tagihan ini akan dihapus.')) return;
    setBusy(true);
    try { await api.tagihan.batal(tagihan.id); notify('Pembayaran dibatalkan. Tagihan kembali Belum Lunas.'); refresh(); }
    catch (err) { notify((err as Error).message); }
    finally { setBusy(false); }
  };

  const actions = (tagihan: Tagihan) => {
    const phone = tagihan.penghuni_no_hp.replace(/\D/g, '').replace(/^0/, '62');
    const message = 'Halo ' + tagihan.penghuni_nama + ', pengingat sewa ' + (admin?.nama_kos || 'Kos Gopi') + ' kamar ' + tagihan.kamar_nomor + ' periode ' + namaBulan(tagihan.bulan) + '. Sisa tagihan ' + rupiah(tagihan.sisa) + ', jatuh tempo ' + tanggal(tagihan.jatuh_tempo) + '. Mohon konfirmasi jika sudah membayar. Terima kasih.';
    return (
      <div className="flex flex-wrap gap-2">
        {tagihan.status !== 'Lunas' && <>
          <Button size="sm" disabled={busy} onClick={() => setPayment(tagihan)}>
            <CreditCard /> {tagihan.status_bayar === 'Dicicil' ? 'Lanjut Bayar' : 'Catat Bayar'}
          </Button>
          <Button size="sm" variant="outline" asChild>
            <a href={'https://wa.me/' + phone + '?text=' + encodeURIComponent(message)} target="_blank" rel="noopener noreferrer" aria-label={'Siapkan pengingat WhatsApp untuk ' + tagihan.penghuni_nama}>
              <MessageCircle /> <span className="md:sr-only">WhatsApp</span>
            </a>
          </Button>
        </>}
        {tagihan.terbayar > 0 && <Button size="sm" variant="outline" onClick={() => setReceipt(tagihan)}><Receipt /> Kuitansi</Button>}
        {tagihan.status === 'Lunas' && <Button size="sm" variant="outline" disabled={busy} onClick={() => undo(tagihan)} aria-label={'Batalkan pelunasan ' + tagihan.penghuni_nama}><Undo2 /> Batal Lunas</Button>}
      </div>
    );
  };
  const collected = rekap?.nominal_lunas ?? 0;
  const total = rekap?.total_nominal ?? 0;
  const percentage = total ? Math.round(collected / total * 100) : 0;
  const filters: { value: Filter; label: string; count?: number }[] = [
    { value: '', label: 'Semua', count: rekap?.total_tagihan },
    { value: 'Belum Lunas', label: 'Belum Lunas', count: rekap?.total_belum_lunas },
    { value: 'Dicicil', label: 'Dicicil', count: rekap?.total_dicicil },
    { value: 'Lunas', label: 'Lunas', count: rekap?.total_lunas },
  ];

  return (
    <section className="min-w-0 space-y-4" aria-label="Tagihan dan pembayaran">
      <Card>
        <CardContent className="space-y-4 px-4">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-lg font-semibold">Tagihan {namaBulan(bulan)}</h2>
              <p className="text-sm text-muted-foreground">Pantau pembayaran penuh, cicilan, dan sisa tagihan dalam satu tempat.</p>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <Field label="Periode tagihan">
                <Input type="month" value={bulan} onChange={(e) => { if (/^(?!0000)[0-9]{4}-(0[1-9]|1[0-2])$/.test(e.target.value)) setBulan(e.target.value); }} className="w-44" />
              </Field>
              <Button disabled={busy} onClick={generate}>
                <RefreshCw className={busy ? 'animate-spin' : ''} /> {busy ? 'Memproses…' : 'Buat Tagihan'}
              </Button>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3" aria-live="polite">
            {[
              { label: 'Total ditagihkan', value: rekap?.total_nominal, hint: (rekap?.total_tagihan ?? 0) + ' tagihan', color: '' },
              { label: 'Pembayaran diterima', value: rekap?.nominal_lunas, hint: 'Termasuk pembayaran cicilan', color: 'text-emerald-700' },
              { label: 'Sisa belum lunas', value: rekap?.nominal_belum_lunas, hint: (rekap?.total_belum_lunas ?? 0) + ' tagihan belum lunas', color: 'text-amber-800' },
            ].map((stat) => (
              <div key={stat.label} className="min-w-0 rounded-lg border bg-muted/30 p-4">
                <p className="text-xs font-medium text-muted-foreground">{stat.label}</p>
                <p className={cn('my-1 break-all text-xl font-semibold tracking-tight tabular-nums', stat.color)}>{stat.value === undefined ? '—' : rupiah(stat.value)}</p>
                <p className="text-xs text-muted-foreground">{stat.value === undefined ? 'Rekap belum tersedia' : stat.hint}</p>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground"><span>Pembayaran terkumpul</span><span>{rekap ? percentage + '%' : '—'}</span></div>
            <Progress value={percentage} aria-label="Persentase nominal yang sudah dibayar" />
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
        <div className="flex flex-wrap gap-1" role="group" aria-label="Filter status tagihan">
          {filters.map((filter) => <Button key={filter.value} size="sm" variant={status === filter.value ? 'default' : 'outline'} aria-pressed={status === filter.value} onClick={() => setStatus(filter.value)}>
            {filter.label}{filter.count !== undefined && <span className="opacity-70">{filter.count}</span>}
          </Button>)}
        </div>
        <div className="relative lg:w-72">
          <Search className="pointer-events-none absolute top-2.5 left-3 size-4 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9" placeholder="Cari nama, kamar, atau nomor HP…" aria-label="Cari tagihan" />
        </div>
      </div>

      {error ? <Alert variant="destructive"><CircleAlert /><AlertDescription>{error} <Button size="sm" variant="outline" onClick={() => setRevision((n) => n + 1)}>Coba lagi</Button></AlertDescription></Alert> :
        loading ? <div className="space-y-3" role="status" aria-label="Memuat tagihan"><Skeleton className="h-24" /><Skeleton className="h-24" /></div> :
          !list.length ? <Card><CardContent className="py-10 text-center">
            <Receipt className="mx-auto mb-3 size-8 text-muted-foreground" />
            <p className="font-medium">{query || status ? 'Tidak ada tagihan yang cocok' : 'Belum ada tagihan pada periode ini'}</p>
            <p className="mt-1 text-sm text-muted-foreground">{query || status ? 'Coba ubah pencarian atau filter status.' : 'Klik Buat Tagihan untuk menyiapkan tagihan penghuni aktif.'}</p>
          </CardContent></Card> : <>
            <div className="grid gap-3 md:hidden">
              {list.map((tagihan) => <Card key={tagihan.id} className="py-4"><CardContent className="space-y-3 px-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0"><p className="break-words font-semibold">{tagihan.penghuni_nama}</p><p className="text-sm text-muted-foreground">{tagihan.kamar_nomor} · {tagihan.kamar_tipe}</p></div>
                  <Status tagihan={tagihan} />
                </div>
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <div><dt className="text-xs text-muted-foreground">Total tagihan</dt><dd className="break-all font-medium tabular-nums">{rupiah(tagihan.nominal)}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Sudah dibayar</dt><dd className="break-all font-medium tabular-nums">{rupiah(tagihan.terbayar)}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Sisa</dt><dd className="break-all font-semibold tabular-nums">{rupiah(tagihan.sisa)}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Jatuh tempo</dt><dd className={tagihan.sisa > 0 && tagihan.jatuh_tempo < today() ? 'text-destructive' : ''}>{tanggal(tagihan.jatuh_tempo)}</dd></div>
                </dl>
                {actions(tagihan)}
              </CardContent></Card>)}
            </div>
            <Card className="hidden min-w-0 py-0 md:block"><CardContent className="p-0"><Table>
              <TableHeader><TableRow><TableHead>Penghuni / Kamar</TableHead><TableHead>Tagihan</TableHead><TableHead>Sisa</TableHead><TableHead>Jatuh Tempo</TableHead><TableHead>Status</TableHead><TableHead>Aksi</TableHead></TableRow></TableHeader>
              <TableBody>{list.map((tagihan) => <TableRow key={tagihan.id}>
                <TableCell><p className="font-medium">{tagihan.penghuni_nama}</p><p className="text-xs text-muted-foreground">{tagihan.kamar_nomor} · {tagihan.kamar_tipe}</p></TableCell>
                <TableCell className="tabular-nums">{rupiah(tagihan.nominal)}<p className="text-xs text-muted-foreground">Dibayar {rupiah(tagihan.terbayar)}</p></TableCell>
                <TableCell className="font-medium tabular-nums">{rupiah(tagihan.sisa)}</TableCell>
                <TableCell className={tagihan.sisa > 0 && tagihan.jatuh_tempo < today() ? 'text-destructive' : ''}>{tanggal(tagihan.jatuh_tempo)}</TableCell>
                <TableCell><Status tagihan={tagihan} /></TableCell><TableCell>{actions(tagihan)}</TableCell>
              </TableRow>)}</TableBody>
            </Table></CardContent></Card>
          </>}
      {payment && <PaymentModal tagihan={payment} onClose={() => { setPayment(null); refresh(); }} onSaved={() => { setPayment(null); notify('Pembayaran tersimpan. Rekap sudah diperbarui.'); refresh(); }} />}
      {receipt && <ReceiptModal tagihan={receipt} admin={admin} onClose={() => setReceipt(null)} />}
    </section>
  );
}

function PaymentModal({ tagihan, onClose, onSaved }: { tagihan: Tagihan; onClose: () => void; onSaved: () => void }) {
  const [mode, setMode] = useState<'penuh' | 'cicil'>('penuh');
  const [jumlah, setJumlah] = useState('');
  const [date, setDate] = useState(today());
  const [metode, setMetode] = useState('Tunai');
  const [catatan, setCatatan] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [history, setHistory] = useState<Pembayaran[]>([]);
  const [historyError, setHistoryError] = useState('');
  const [remaining, setRemaining] = useState(tagihan.sisa);

  useEffect(() => {
    let cancelled = false;
    api.tagihan.pembayaran(tagihan.id).then((rows) => { if (!cancelled) setHistory(rows); })
      .catch((err: Error) => { if (!cancelled) setHistoryError(err.message); });
    return () => { cancelled = true; };
  }, [tagihan.id]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    const amount = mode === 'penuh' ? remaining : Number(jumlah);
    const local: Record<string, string> = {};
    if (!Number.isSafeInteger(amount) || amount <= 0 || amount > remaining) local.jumlah = 'Isi nominal lebih dari 0 sampai ' + rupiah(remaining) + '.';
    if (!date) local.tanggal_bayar = 'Tanggal bayar wajib diisi.';
    setErrors(local);
    if (Object.keys(local).length) return;
    setSaving(true);
    try {
      const payload = { tanggal_bayar: date, metode_pembayaran: metode, catatan };
      if (mode === 'penuh') await api.tagihan.lunas(tagihan.id, payload);
      else await api.tagihan.bayar(tagihan.id, { ...payload, jumlah: amount });
      onSaved();
    } catch (err) { setErrors(err instanceof ApiError && Object.keys(err.errors).length ? err.errors : { _: (err as Error).message }); }
    finally { setSaving(false); }
  };

  const removePayment = async (pembayaran: Pembayaran) => {
    if (!window.confirm('Hapus pembayaran ' + rupiah(pembayaran.jumlah) + ' tanggal ' + tanggal(pembayaran.tanggal_bayar) + '?')) return;
    setSaving(true);
    try {
      const updated = await api.tagihan.hapusPembayaran(pembayaran.id);
      setRemaining(updated.sisa);
      setHistory((rows) => rows.filter((row) => row.id !== pembayaran.id));
    } catch (err) { setErrors({ _: (err as Error).message }); }
    finally { setSaving(false); }
  };

  return <Modal title="Catat Pembayaran" onClose={() => { if (!saving) onClose(); }}>
    <form className="grid gap-4" onSubmit={submit} noValidate>
      <div className="rounded-lg border bg-muted/30 p-3 text-sm"><p className="font-medium">{tagihan.penghuni_nama} · {tagihan.kamar_nomor}</p><p className="text-muted-foreground">{namaBulan(tagihan.bulan)}</p><p className="mt-2">Sisa tagihan <strong className="tabular-nums">{rupiah(remaining)}</strong></p></div>
      {errors._ && <Alert variant="destructive"><AlertDescription>{errors._}</AlertDescription></Alert>}
      <fieldset disabled={saving} className="grid gap-4">
        <Field label="Jenis pembayaran"><select className={selectClass} value={mode} onChange={(e) => setMode(e.target.value as 'penuh' | 'cicil')}><option value="penuh">Lunasi seluruh sisa tagihan</option><option value="cicil">Bayar sebagian / cicilan</option></select></Field>
        {mode === 'cicil' && <Field label="Nominal pembayaran (Rp)" error={errors.jumlah}><Input type="number" inputMode="numeric" min={1} max={remaining} step={1} value={jumlah} onChange={(e) => setJumlah(e.target.value)} aria-invalid={!!errors.jumlah} /></Field>}
        {mode === 'penuh' && errors.jumlah && <p className="text-sm text-destructive" role="alert">{errors.jumlah}</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tanggal bayar" error={errors.tanggal_bayar}><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-invalid={!!errors.tanggal_bayar} /></Field>
          <Field label="Metode pembayaran" error={errors.metode_pembayaran}><select className={selectClass} value={metode} onChange={(e) => setMetode(e.target.value)}>{metodeList.map((item) => <option key={item}>{item}</option>)}</select></Field>
        </div>
        <Field label="Catatan (opsional)" error={errors.catatan}><Input value={catatan} onChange={(e) => setCatatan(e.target.value)} maxLength={500} placeholder="Contoh: pembayaran via transfer" /></Field>
      </fieldset>
      {historyError && <p className="text-sm text-destructive" role="alert">Riwayat pembayaran tidak dapat dimuat: {historyError}</p>}
      {history.length > 0 && <div className="space-y-2 border-t pt-3"><p className="text-sm font-medium">Riwayat pembayaran</p>{history.map((row) => <div key={row.id} className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm">
        <div><p className="font-medium tabular-nums">{rupiah(row.jumlah)}</p><p className="text-xs text-muted-foreground">{tanggal(row.tanggal_bayar)} · {row.metode_pembayaran}</p>{row.catatan && <p className="break-words text-xs text-muted-foreground">{row.catatan}</p>}</div>
        <Button type="button" size="icon" variant="ghost" disabled={saving} onClick={() => removePayment(row)} aria-label={'Hapus pembayaran ' + rupiah(row.jumlah) + ' tanggal ' + tanggal(row.tanggal_bayar)}><Trash2 className="text-destructive" /></Button>
      </div>)}</div>}
      <div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="outline" disabled={saving} onClick={onClose}>Tutup</Button><Button type="submit" disabled={saving}>{saving ? <LoaderCircle className="animate-spin" /> : <Check />}{saving ? 'Menyimpan…' : mode === 'penuh' ? 'Simpan & Tandai Lunas' : 'Simpan Cicilan'}</Button></div>
    </form>
  </Modal>;
}
function ReceiptModal({ tagihan, admin, onClose }: { tagihan: Tagihan; admin: AdminProfile | null; onClose: () => void }) {
  const [history, setHistory] = useState<Pembayaran[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    api.tagihan.pembayaran(tagihan.id).then((rows) => { if (!cancelled) setHistory(rows); })
      .catch((err: Error) => { if (!cancelled) setError(err.message); });
    return () => { cancelled = true; };
  }, [tagihan.id]);
  return <Modal title="Kuitansi Pembayaran" onClose={onClose}>
    <article className="receipt-print-area space-y-4 rounded-lg border p-4 text-sm">
      <header className="space-y-1 border-b pb-3"><p className="text-xl font-semibold">{admin?.nama_kos || 'Kos Gopi'}</p>{admin?.alamat_kos && <p className="text-muted-foreground">{admin.alamat_kos}</p>}<p className="text-xs text-muted-foreground">{'INV-' + tagihan.bulan.replace('-', '') + '-' + tagihan.id}</p><Status tagihan={tagihan} /></header>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2"><dt className="text-muted-foreground">Diterima dari</dt><dd className="break-words font-medium">{tagihan.penghuni_nama}</dd><dt className="text-muted-foreground">Kamar</dt><dd>{tagihan.kamar_nomor}</dd><dt className="text-muted-foreground">Periode</dt><dd>{namaBulan(tagihan.bulan)}</dd></dl>
      <div className="space-y-2 rounded-md bg-muted/50 p-3 tabular-nums"><p className="flex justify-between gap-2"><span>Total tagihan</span><strong>{rupiah(tagihan.nominal)}</strong></p><p className="flex justify-between gap-2"><span>Sudah diterima</span><strong>{rupiah(tagihan.terbayar)}</strong></p><p className="flex justify-between gap-2 border-t pt-2"><span>Sisa tagihan</span><strong>{rupiah(tagihan.sisa)}</strong></p></div>
      {error ? <p role="alert" className="text-destructive">Riwayat tidak dapat dimuat: {error}</p> : !history ? <p role="status">Memuat riwayat pembayaran…</p> : <div className="space-y-2"><p className="font-medium">Rincian pembayaran</p>{history.map((row) => <div key={row.id} className="border-b pb-2"><p className="flex justify-between gap-2"><span>{tanggal(row.tanggal_bayar)}</span><strong className="tabular-nums">{rupiah(row.jumlah)}</strong></p><p className="text-xs text-muted-foreground">{row.metode_pembayaran}</p>{row.catatan && <p className="break-words text-xs">{row.catatan}</p>}</div>)}</div>}
      <footer className="border-t pt-3 text-xs text-muted-foreground"><p>{tagihan.status === 'Lunas' ? 'Terima kasih atas pembayaran Anda.' : 'Bukti pembayaran sebagian. Sisa tagihan belum lunas.'}</p><p className="mt-3 font-medium text-foreground">{admin?.nama || 'Pengelola Kos'}</p></footer>
    </article>
    <div className="flex flex-wrap justify-end gap-2"><Button variant="outline" onClick={onClose}>Tutup</Button><Button disabled={!history || !!error} onClick={() => window.print()}><Printer /> Cetak / Simpan PDF</Button></div>
  </Modal>;
}
