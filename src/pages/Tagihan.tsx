import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
<<<<<<< Updated upstream
import { BellRing, Check, CircleAlert, CreditCard, Link2, LoaderCircle, MessageCircle, Plus, Printer, Receipt, RefreshCw, Search, SlidersHorizontal, Trash2, Undo2 } from 'lucide-react';
import { api, ApiError, formatPeriodeSewa, namaBulan, PERIODE_SEWA_LIST, rupiah, satuanPeriode, tanggal, today, waLink } from '../api';
=======
import { BellRing, Check, CircleAlert, CreditCard, Download, FileDown, Link2, LoaderCircle, Plus, Receipt, RefreshCw, Search, Send, SlidersHorizontal, Trash2, Undo2 } from 'lucide-react';
import { api, ApiError, formatPeriodeSewa, namaBulan, PERIODE_SEWA_LIST, rupiah, satuanPeriode, tanggal, today } from '../api';
>>>>>>> Stashed changes
import type { AdminProfile, Pembayaran, PengingatTagihan, Penghuni, PeriodeSewa, RekapTagihan, Tagihan } from '../api';
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

type Filter = '' | 'Belum Bayar' | 'Dicicil' | 'Lunas';
type Props = { notify: (message: string) => void; onChanged: () => void };
const metodeList = ['Tunai', 'Transfer BCA', 'Transfer Mandiri', 'Transfer BRI', 'Transfer BNI', 'QRIS', 'Lainnya'];

function Status({ tagihan }: { tagihan: Tagihan }) {
  return (
    <Badge variant="outline" className={cn(
      'shrink-0', tagihan.status === 'Lunas' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' :
        tagihan.status_bayar === 'Dicicil' ? 'border-blue-200 bg-blue-50 text-blue-800' : 'border-amber-200 bg-amber-50 text-amber-900',
    )}>
      {tagihan.status_bayar}
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
  const [creatingBill, setCreatingBill] = useState(false);
  const [editingBill, setEditingBill] = useState<Tagihan | null>(null);
  const [receipt, setReceipt] = useState<Tagihan | null>(null);
  const [pengingat, setPengingat] = useState<PengingatTagihan[]>([]);

  useEffect(() => {
    let cancelled = false;
    api.admin.aktif().then((result) => { if (!cancelled) setAdmin(result); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    // Data lama tetap tampil selama memuat ulang agar tidak berkedip saat mengetik pencarian.
    setLoading(true);
    setError('');
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

  // WBS 5.4: pembayaran online lewat chatbot mengubah status di server; muat ulang berkala agar panel ikut berubah.
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') setRevision((n) => n + 1);
    }, 15000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    api.tagihan.pengingat().then((rows) => { if (!cancelled) setPengingat(rows); }).catch(() => {});
    return () => { cancelled = true; };
  }, [revision]);

  const refresh = () => { setRevision((n) => n + 1); onChanged(); };
  const generate = async () => {
    setBusy(true);
    try {
      const result = await api.tagihan.generate(bulan);
      notify(result.dibuat ? result.dibuat + ' tagihan dibuat untuk ' + namaBulan(bulan) + '.' : 'Tidak ada tagihan baru. Tagihan yang sudah ada tetap disimpan.');
      refresh();
    } catch (err) { notify((err as Error).message); }
    finally { setBusy(false); }
<<<<<<< Updated upstream
  };

  const undo = async (tagihan: Tagihan) => {
    if (!window.confirm('Batalkan seluruh pembayaran ' + tagihan.penghuni_nama + ' untuk ' + namaBulan(tagihan.bulan) + '? Pembayaran ditandai batal; riwayatnya tetap tersimpan.')) return;
    setBusy(true);
    try { await api.tagihan.batal(tagihan.id); notify('Pembayaran dibatalkan. Tagihan kembali Belum Lunas.'); refresh(); }
    catch (err) { notify((err as Error).message); }
    finally { setBusy(false); }
  };

  const pesanWa = (tagihan: Tagihan) =>
    'Halo ' + tagihan.penghuni_nama + ', pengingat sewa ' + (admin?.nama_kos || 'Kos Gopi') + ' kamar ' + tagihan.kamar_nomor + ' periode ' + namaBulan(tagihan.bulan) + '. Sisa tagihan ' + rupiah(tagihan.sisa) + ', jatuh tempo ' + tanggal(tagihan.jatuh_tempo) + '. Mohon konfirmasi jika sudah membayar. Terima kasih.';

=======
  };

  const undo = async (tagihan: Tagihan) => {
    if (!window.confirm('Batalkan seluruh pembayaran ' + tagihan.penghuni_nama + ' untuk ' + namaBulan(tagihan.bulan) + '? Pembayaran ditandai batal; riwayatnya tetap tersimpan.')) return;
    setBusy(true);
    try { await api.tagihan.batal(tagihan.id); notify('Pembayaran dibatalkan. Tagihan kembali Belum Lunas.'); refresh(); }
    catch (err) { notify((err as Error).message); }
    finally { setBusy(false); }
  };

  const kirimTelegramTagihan = async (tagihan: Tagihan) => {
    setBusy(true);
    try {
      await api.tagihan.kirimTelegram(tagihan.id);
      notify('Pengingat tagihan dikirim ke Telegram ' + tagihan.penghuni_nama + '.');
    } catch (err) {
      notify((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

>>>>>>> Stashed changes
  const salinLinkBayar = async (tagihan: Tagihan) => {
    try {
      const link = await api.tagihan.linkBayar(tagihan.id);
      await navigator.clipboard.writeText(link.payment_url).catch(() => {});
      notify('Link pembayaran ' + (link.provider === 'simulasi' ? '(simulasi) ' : '') + 'disalin: ' + link.payment_url);
    } catch (err) { notify((err as Error).message); }
  };

  const actions = (tagihan: Tagihan) => {
    return (
      <div className="flex flex-wrap gap-2">
        {tagihan.status !== 'Lunas' && <>
          <Button size="sm" disabled={busy} onClick={() => setPayment(tagihan)}>
            <CreditCard /> {tagihan.status_bayar === 'Dicicil' ? 'Lanjut Bayar' : 'Catat Bayar'}
          </Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => setEditingBill(tagihan)} aria-label={'Atur nominal dan jangka penyewaan untuk ' + tagihan.penghuni_nama}>
            <SlidersHorizontal /> Atur Nominal & Jangka Sewa
          </Button>
<<<<<<< Updated upstream
          <Button size="sm" variant="outline" asChild>
            <a href={waLink(tagihan.penghuni_no_hp, pesanWa(tagihan))} target="_blank" rel="noopener noreferrer" aria-label={'Siapkan pengingat WhatsApp untuk ' + tagihan.penghuni_nama}>
              <MessageCircle /> <span className="md:sr-only">WhatsApp</span>
            </a>
=======
          <Button size="sm" variant="outline" disabled={busy} onClick={() => kirimTelegramTagihan(tagihan)} aria-label={'Kirim pengingat Telegram untuk ' + tagihan.penghuni_nama}>
            <Send /> <span className="md:sr-only">Telegram</span>
>>>>>>> Stashed changes
          </Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => salinLinkBayar(tagihan)} aria-label={'Salin link pembayaran online untuk ' + tagihan.penghuni_nama}>
            <Link2 /> <span className="md:sr-only">Link Bayar</span>
          </Button>
        </>}
        {tagihan.terbayar > 0 && <Button size="sm" variant="outline" onClick={() => setReceipt(tagihan)}><Receipt /> Kuitansi</Button>}
        {tagihan.status === 'Lunas' && <Button size="sm" variant="outline" disabled={busy} onClick={() => undo(tagihan)} aria-label={'Batalkan pelunasan ' + tagihan.penghuni_nama}><Undo2 /> Batal Lunas</Button>}
      </div>
    );
  };
  const collected = rekap?.nominal_lunas ?? 0;
  const total = rekap?.total_nominal ?? 0;
  // floor: jangan tampil 100% selama masih ada sisa.
  const percentage = total ? Math.floor(collected / total * 100) : 0;
  const filters: { value: Filter; label: string; count?: number }[] = [
    { value: '', label: 'Semua', count: rekap?.total_tagihan },
    { value: 'Belum Bayar', label: 'Belum Bayar', count: rekap ? rekap.total_belum_lunas - (rekap.total_dicicil ?? 0) : undefined },
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
                <Input type="month" value={bulan} max={today().slice(0, 7)} onChange={(e) => { if (/^(?!0000)[0-9]{4}-(0[1-9]|1[0-2])$/.test(e.target.value)) setBulan(e.target.value); }} className="w-44" />
              </Field>
              <Button variant="outline" disabled={busy} onClick={() => setCreatingBill(true)}>
                <Plus /> Input Tagihan & Jangka Sewa
              </Button>
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

      {pengingat.length > 0 && <Card className="border-amber-200"><CardContent className="space-y-3 px-4">
        <div className="flex items-center gap-2">
          <BellRing className="size-4 text-amber-700" aria-hidden />
          <h2 className="font-semibold">Perlu diingatkan hari ini ({pengingat.length})</h2>
        </div>
<<<<<<< Updated upstream
        <p className="text-sm text-muted-foreground">Tagihan jatuh tempo 3 hari lagi (H-3), hari ini (H-0), atau sudah terlambat. Kirim pengingat lewat WhatsApp.</p>
=======
        <p className="text-sm text-muted-foreground">Tagihan jatuh tempo 3 hari lagi (H-3), hari ini (H-0), atau sudah terlambat. Kirim pengingat langsung ke Telegram penghuni.</p>
>>>>>>> Stashed changes
        <ul className="divide-y">
          {pengingat.map((t) => <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <div className="min-w-0">
              <p className="truncate font-medium">{t.penghuni_nama} <span className="font-normal text-muted-foreground">· {t.kamar_nomor} · {namaBulan(t.bulan)}</span></p>
              <p className="text-sm text-muted-foreground">Sisa <span className="font-medium text-foreground tabular-nums">{rupiah(t.sisa)}</span> · jatuh tempo {tanggal(t.jatuh_tempo)}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={t.pengingat === 'Terlambat' ? 'border-red-200 bg-red-50 text-red-800' : 'border-amber-200 bg-amber-50 text-amber-900'}>
                {t.pengingat === 'Terlambat' ? `Terlambat ${-t.hari} hari` : t.pengingat === 'H-0' ? 'Jatuh tempo hari ini' : 'H-3'}
              </Badge>
<<<<<<< Updated upstream
              <Button size="sm" variant="outline" asChild>
                <a href={waLink(t.penghuni_no_hp, pesanWa(t))} target="_blank" rel="noopener noreferrer" aria-label={'Kirim pengingat WhatsApp ke ' + t.penghuni_nama}>
                  <MessageCircle /> WhatsApp
                </a>
=======
              <Button size="sm" variant="outline" disabled={busy} onClick={() => kirimTelegramTagihan(t)} aria-label={'Kirim pengingat Telegram ke ' + t.penghuni_nama}>
                <Send /> Kirim Telegram
>>>>>>> Stashed changes
              </Button>
            </div>
          </li>)}
        </ul>
      </CardContent></Card>}

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
        loading && !rekap ? <div className="space-y-3" role="status" aria-label="Memuat tagihan"><Skeleton className="h-24" /><Skeleton className="h-24" /></div> :
          !list.length ? <Card><CardContent className="py-10 text-center">
            <Receipt className="mx-auto mb-3 size-8 text-muted-foreground" />
            <p className="font-medium">{query || status ? 'Tidak ada tagihan yang cocok' : 'Belum ada tagihan pada periode ini'}</p>
            <p className="mt-1 text-sm text-muted-foreground">{query || status ? 'Coba ubah pencarian atau filter status.' : 'Klik Buat Tagihan untuk menyiapkan tagihan penghuni aktif.'}</p>
          </CardContent></Card> : <>
            <div className="grid gap-3 md:hidden">
              {list.map((tagihan) => <Card key={tagihan.id} className="py-4"><CardContent className="space-y-3 px-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0"><p className="break-words font-semibold">{tagihan.penghuni_nama}</p><p className="text-sm text-muted-foreground">{tagihan.kamar_nomor} · {formatPeriodeSewa(tagihan.periode_sewa, tagihan.durasi_sewa)}</p></div>
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
                <TableCell><p className="font-medium">{tagihan.penghuni_nama}</p><p className="text-xs text-muted-foreground">{tagihan.kamar_nomor} · {formatPeriodeSewa(tagihan.periode_sewa, tagihan.durasi_sewa)}</p></TableCell>
                <TableCell className="tabular-nums">{rupiah(tagihan.nominal)}<p className="text-xs text-muted-foreground">Dibayar {rupiah(tagihan.terbayar)}</p></TableCell>
                <TableCell className="font-medium tabular-nums">{rupiah(tagihan.sisa)}</TableCell>
                <TableCell className={tagihan.sisa > 0 && tagihan.jatuh_tempo < today() ? 'text-destructive' : ''}>{tanggal(tagihan.jatuh_tempo)}</TableCell>
                <TableCell><Status tagihan={tagihan} /></TableCell><TableCell>{actions(tagihan)}</TableCell>
              </TableRow>)}</TableBody>
            </Table></CardContent></Card>
          </>}
      {payment && <PaymentModal tagihan={payment} onClose={() => { setPayment(null); refresh(); }} onSaved={() => { setPayment(null); notify('Pembayaran tersimpan. Rekap sudah diperbarui.'); refresh(); }} />}
      {creatingBill && <InputTagihanModal bulan={bulan} onClose={() => setCreatingBill(false)} onSaved={() => { setCreatingBill(false); notify('Tagihan dan jangka penyewaan tersimpan.'); refresh(); }} />}
      {editingBill && <EditTagihanModal tagihan={editingBill} onClose={() => setEditingBill(null)} onSaved={() => { setEditingBill(null); notify('Nominal dan jangka penyewaan tagihan diperbarui.'); refresh(); }} />}
<<<<<<< Updated upstream
      {receipt && <ReceiptModal tagihan={receipt} admin={admin} onClose={() => setReceipt(null)} />}
=======
      {receipt && <ReceiptModal tagihan={receipt} admin={admin} notify={notify} onClose={() => setReceipt(null)} />}
>>>>>>> Stashed changes
    </section>
  );
}

function InputTagihanModal({ bulan, onClose, onSaved }: { bulan: string; onClose: () => void; onSaved: () => void }) {
  const [penghuniList, setPenghuniList] = useState<Penghuni[]>([]);
  const [penghuniId, setPenghuniId] = useState('');
  const [periode, setPeriode] = useState<PeriodeSewa>('Bulanan');
  const [durasi, setDurasi] = useState('1');
  const [nominal, setNominal] = useState('');
  const [jatuhTempo, setJatuhTempo] = useState(today());
  const [catatan, setCatatan] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    api.penghuni.list(false).then((rows) => { if (!cancelled) setPenghuniList(rows); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const pid = Number(penghuniId);
    const n = Number(nominal);
    const d = Number(durasi);
    const local: Record<string, string> = {};
    if (!Number.isInteger(pid) || pid <= 0) local.penghuni_id = 'Pilih penghuni terlebih dahulu.';
    if (!nominal || !Number.isSafeInteger(n) || n <= 0) local.nominal = 'Masukkan nominal tagihan (lebih dari 0).';
    if (!Number.isInteger(d) || d < 1) local.durasi_sewa = 'Lama penyewaan minimal 1.';
    if (!jatuhTempo) local.jatuh_tempo = 'Jatuh tempo wajib diisi.';
    setErrors(local);
    if (Object.keys(local).length) return;
    setSaving(true);
    try {
      await api.tagihan.create({
        penghuni_id: pid,
        nominal: n,
        periode_sewa: periode,
        durasi_sewa: d,
        bulan,
        jatuh_tempo: jatuhTempo,
        catatan,
      });
      onSaved();
    } catch (err) {
      setErrors(err instanceof ApiError && Object.keys(err.errors).length ? err.errors : { _: (err as Error).message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Input Nominal Tagihan & Jangka Sewa" onClose={onClose}>
      <form className="grid gap-4" onSubmit={submit} noValidate>
        <p className="text-sm text-muted-foreground">
          Masukkan langsung nominal tagihan dan jangka penyewaan ({namaBulan(bulan)}).
        </p>
        {errors._ && <Alert variant="destructive"><AlertDescription>{errors._}</AlertDescription></Alert>}
        <Field label="Pilih penghuni & kamar *" error={errors.penghuni_id}>
          <select className={selectClass} value={penghuniId} onChange={(e) => setPenghuniId(e.target.value)} aria-invalid={!!errors.penghuni_id}>
            <option value="">-- Pilih penghuni aktif --</option>
            {penghuniList.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nama} · {p.kamar_nomor}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Jangka penyewaan *" error={errors.periode_sewa}>
            <select className={selectClass} value={periode} onChange={(e) => setPeriode(e.target.value as PeriodeSewa)}>
              {PERIODE_SEWA_LIST.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </Field>
          <Field label={`Lama (${satuanPeriode(periode)}) *`} error={errors.durasi_sewa}>
            <Input type="number" min={1} max={3650} value={durasi} onChange={(e) => setDurasi(e.target.value)} aria-invalid={!!errors.durasi_sewa} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nominal tagihan (Rp) *" error={errors.nominal}>
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              step={10000}
              value={nominal}
              onChange={(e) => setNominal(e.target.value)}
              placeholder="mis. 500000"
              aria-invalid={!!errors.nominal}
            />
          </Field>
          <Field label="Jatuh tempo *" error={errors.jatuh_tempo}>
            <Input type="date" value={jatuhTempo} onChange={(e) => setJatuhTempo(e.target.value)} aria-invalid={!!errors.jatuh_tempo} />
          </Field>
        </div>
        <Field label="Catatan (opsional)" error={errors.catatan}>
          <Input value={catatan} onChange={(e) => setCatatan(e.target.value)} maxLength={500} placeholder="mis. Sewa mingguan kamar atas" />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Batal</Button>
          <Button type="submit" disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan Tagihan'}</Button>
        </div>
      </form>
    </Modal>
  );
}

function EditTagihanModal({ tagihan, onClose, onSaved }: { tagihan: Tagihan; onClose: () => void; onSaved: () => void }) {
  const [nominal, setNominal] = useState(String(tagihan.nominal));
  const [periode, setPeriode] = useState<PeriodeSewa>(tagihan.periode_sewa ?? 'Bulanan');
  const [durasi, setDurasi] = useState(String(tagihan.durasi_sewa ?? 1));
  const [jatuhTempo, setJatuhTempo] = useState(tagihan.jatuh_tempo);
  const [catatan, setCatatan] = useState(tagihan.catatan ?? '');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const n = Number(nominal);
    const d = Number(durasi);
    const local: Record<string, string> = {};
    if (!Number.isSafeInteger(n) || n < Math.max(1, tagihan.terbayar)) {
      local.nominal = tagihan.terbayar > 0 ? `Nominal minimal ${rupiah(tagihan.terbayar)} (sudah terbayar).` : 'Nominal harus lebih dari 0.';
    }
    if (!Number.isInteger(d) || d < 1) local.durasi_sewa = 'Lama sewa minimal 1.';
    if (!jatuhTempo) local.jatuh_tempo = 'Jatuh tempo wajib diisi.';
    setErrors(local);
    if (Object.keys(local).length) return;
    setSaving(true);
    try {
      await api.tagihan.update(tagihan.id, {
        nominal: n,
        periode_sewa: periode,
        durasi_sewa: d,
        jatuh_tempo: jatuhTempo,
        catatan,
      });
      onSaved();
    } catch (err) {
      setErrors(err instanceof ApiError && Object.keys(err.errors).length ? err.errors : { _: (err as Error).message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Atur Harga & Jangka Sewa Tagihan" onClose={onClose}>
      <form className="grid gap-4" onSubmit={submit} noValidate>
        <div className="rounded-lg border bg-muted/30 p-3 text-sm">
          <p className="font-medium">{tagihan.penghuni_nama} · {tagihan.kamar_nomor}</p>
          <p className="text-xs text-muted-foreground">Periode {namaBulan(tagihan.bulan)} · Sudah dibayar {rupiah(tagihan.terbayar)}</p>
        </div>
        {errors._ && <Alert variant="destructive"><AlertDescription>{errors._}</AlertDescription></Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Jangka waktu sewa *" error={errors.periode_sewa}>
            <select className={selectClass} value={periode} onChange={(e) => setPeriode(e.target.value as PeriodeSewa)}>
              {PERIODE_SEWA_LIST.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </Field>
          <Field label={`Lama (${satuanPeriode(periode)}) *`} error={errors.durasi_sewa}>
            <Input type="number" min={1} max={3650} value={durasi} onChange={(e) => setDurasi(e.target.value)} aria-invalid={!!errors.durasi_sewa} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nominal tagihan (Rp) *" error={errors.nominal}>
            <Input type="number" inputMode="numeric" min={Math.max(1, tagihan.terbayar)} step={10000} value={nominal} onChange={(e) => setNominal(e.target.value)} aria-invalid={!!errors.nominal} />
          </Field>
          <Field label="Jatuh tempo *" error={errors.jatuh_tempo}>
            <Input type="date" value={jatuhTempo} onChange={(e) => setJatuhTempo(e.target.value)} aria-invalid={!!errors.jatuh_tempo} />
          </Field>
        </div>
        <Field label="Catatan (opsional)" error={errors.catatan}>
          <Input value={catatan} onChange={(e) => setCatatan(e.target.value)} maxLength={500} placeholder="mis. Penyesuaian sewa mingguan" />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Batal</Button>
          <Button type="submit" disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan Perubahan'}</Button>
        </div>
      </form>
    </Modal>
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
<<<<<<< Updated upstream
function ReceiptModal({ tagihan, admin, onClose }: { tagihan: Tagihan; admin: AdminProfile | null; onClose: () => void }) {
  const [history, setHistory] = useState<Pembayaran[] | null>(null);
  const [error, setError] = useState('');
=======
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  if (!words.length) return [''];
  const lines: string[] = [];
  let cur = words[0]!;
  for (let i = 1; i < words.length; i++) {
    const next = `${cur} ${words[i]}`;
    if (ctx.measureText(next).width <= maxWidth) cur = next;
    else {
      lines.push(cur);
      cur = words[i]!;
    }
  }
  lines.push(cur);
  return lines;
}

function roundRectBox(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, r);
  } else {
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
  }
  ctx.closePath();
}

/** Render kartu kuitansi menjadi screenshot beresolusi tinggi di HTML5 Canvas. */
function renderKuitansiCanvas(tagihan: Tagihan, admin: AdminProfile | null, history: Pembayaran[]): HTMLCanvasElement {
  const W = 760;
  const pad = 40;
  const innerW = W - pad * 2;
  const scale = 2;

  const probe = document.createElement('canvas').getContext('2d')!;
  const kosNama = admin?.nama_kos || 'Kos Gopi';
  const kosAlamat = admin?.alamat_kos?.trim() || '';
  const invCode = `INV-${tagihan.bulan.replace('-', '')}-${tagihan.id}`;
  const statusTeks = tagihan.status_bayar;

  probe.font = '400 16px Inter, system-ui, -apple-system, sans-serif';
  const alamatLines = kosAlamat ? wrapText(probe, kosAlamat, innerW - 32) : [];
  const penghuniLines = wrapText(probe, tagihan.penghuni_nama, innerW - 180);
  const catatanBlocks = history.map((row) => ({
    row,
    noteLines: row.catatan ? wrapText(probe, row.catatan, innerW - 24) : [],
  }));
  const footerNote =
    tagihan.status === 'Lunas'
      ? 'Terima kasih atas pembayaran Anda.'
      : 'Bukti pembayaran sebagian. Sisa tagihan belum lunas.';

  let H = pad + 24;
  H += 34; // nama kos
  H += alamatLines.length * 22;
  H += 24; // invoice code
  H += 36; // badge + divider
  H += 20; // gap after header
  H += Math.max(1, penghuniLines.length) * 24 + 10;
  H += 28 + 28 + 20; // kamar + periode + gap
  H += 132 + 24; // summary box + gap
  H += 30; // rincian title
  for (const b of catatanBlocks) {
    H += 24 + 22 + b.noteLines.length * 20 + 18;
  }
  H += 24 + 26 + 34 + pad + 24; // footer + bottom pad

  const canvas = document.createElement('canvas');
  canvas.width = W * scale;
  canvas.height = H * scale;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);

  // Latar belakang putih polos & bingkai kartu kuitansi
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = '#e4e4e7';
  ctx.lineWidth = 2;
  roundRectBox(ctx, 18, 18, W - 36, H - 36, 14);
  ctx.stroke();

  let y = pad + 18;

  // Header
  ctx.fillStyle = '#09090b';
  ctx.font = '700 24px Inter, system-ui, -apple-system, sans-serif';
  ctx.fillText(kosNama, pad, y);
  y += 26;

  if (alamatLines.length) {
    ctx.fillStyle = '#52525b';
    ctx.font = '400 15px Inter, system-ui, -apple-system, sans-serif';
    for (const line of alamatLines) {
      ctx.fillText(line, pad, y);
      y += 22;
    }
  }

  ctx.fillStyle = '#71717a';
  ctx.font = '500 14px Inter, system-ui, -apple-system, sans-serif';
  ctx.fillText(invCode, pad, y);
  y += 16;

  // Badge status
  const badgeColor =
    tagihan.status === 'Lunas'
      ? { bg: '#ecfdf5', border: '#a7f3d0', text: '#065f46' }
      : tagihan.status_bayar === 'Dicicil'
        ? { bg: '#eff6ff', border: '#bfdbfe', text: '#1e40af' }
        : { bg: '#fffbeb', border: '#fde68a', text: '#78350f' };
  ctx.font = '600 13px Inter, system-ui, -apple-system, sans-serif';
  const badgeW = ctx.measureText(statusTeks).width + 22;
  ctx.fillStyle = badgeColor.bg;
  ctx.strokeStyle = badgeColor.border;
  ctx.lineWidth = 1.2;
  roundRectBox(ctx, pad, y, badgeW, 26, 7);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = badgeColor.text;
  ctx.fillText(statusTeks, pad + 11, y + 17);
  y += 42;

  ctx.strokeStyle = '#e4e4e7';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad, y);
  ctx.lineTo(W - pad, y);
  ctx.stroke();
  y += 28;

  // Identitas tagihan
  const drawMeta = (label: string, valLines: string[]) => {
    ctx.fillStyle = '#71717a';
    ctx.font = '400 15px Inter, system-ui, -apple-system, sans-serif';
    ctx.fillText(label, pad, y);
    ctx.fillStyle = '#09090b';
    ctx.font = '600 15px Inter, system-ui, -apple-system, sans-serif';
    for (let i = 0; i < valLines.length; i++) {
      ctx.fillText(valLines[i]!, pad + 150, y + i * 22);
    }
    y += Math.max(1, valLines.length) * 24 + 6;
  };
  drawMeta('Diterima dari', penghuniLines);
  drawMeta('Kamar', [tagihan.kamar_nomor]);
  drawMeta('Periode', [`${namaBulan(tagihan.bulan)} (${formatPeriodeSewa(tagihan.periode_sewa, tagihan.durasi_sewa)})`]);
  y += 10;

  // Kotak ringkasan nominal
  ctx.fillStyle = '#f4f4f5';
  roundRectBox(ctx, pad, y, innerW, 118, 10);
  ctx.fill();

  const drawMoneyRow = (label: string, val: string, rowY: number, bold = false) => {
    ctx.fillStyle = '#18181b';
    ctx.font = `${bold ? '600' : '400'} 15px Inter, system-ui, -apple-system, sans-serif`;
    ctx.fillText(label, pad + 18, rowY);
    ctx.font = '700 16px Inter, system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(val, W - pad - 18, rowY);
    ctx.textAlign = 'left';
  };

  drawMoneyRow('Total tagihan', rupiah(tagihan.nominal), y + 28);
  drawMoneyRow('Sudah diterima', rupiah(tagihan.terbayar), y + 58);
  ctx.strokeStyle = '#d4d4d8';
  ctx.beginPath();
  ctx.moveTo(pad + 18, y + 74);
  ctx.lineTo(W - pad - 18, y + 74);
  ctx.stroke();
  drawMoneyRow('Sisa tagihan', rupiah(tagihan.sisa), y + 98, true);
  y += 142;

  // Rincian transaksi
  ctx.fillStyle = '#09090b';
  ctx.font = '600 16px Inter, system-ui, -apple-system, sans-serif';
  ctx.fillText('Rincian pembayaran', pad, y);
  y += 28;

  for (const { row, noteLines } of catatanBlocks) {
    ctx.fillStyle = '#09090b';
    ctx.font = '500 15px Inter, system-ui, -apple-system, sans-serif';
    ctx.fillText(tanggal(row.tanggal_bayar), pad, y);
    ctx.font = '700 15px Inter, system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(rupiah(row.jumlah), W - pad, y);
    ctx.textAlign = 'left';
    y += 20;

    ctx.fillStyle = '#71717a';
    ctx.font = '400 13px Inter, system-ui, -apple-system, sans-serif';
    ctx.fillText(row.metode_pembayaran, pad, y);
    y += 18;

    if (noteLines.length) {
      ctx.fillStyle = '#27272a';
      ctx.font = '400 13px Inter, system-ui, -apple-system, sans-serif';
      for (const l of noteLines) {
        ctx.fillText(l, pad, y);
        y += 18;
      }
    }

    ctx.strokeStyle = '#e4e4e7';
    ctx.beginPath();
    ctx.moveTo(pad, y + 4);
    ctx.lineTo(W - pad, y + 4);
    ctx.stroke();
    y += 22;
  }

  // Footer
  y += 8;
  ctx.fillStyle = '#71717a';
  ctx.font = '400 14px Inter, system-ui, -apple-system, sans-serif';
  ctx.fillText(footerNote, pad, y);
  y += 30;
  ctx.fillStyle = '#09090b';
  ctx.font = '600 15px Inter, system-ui, -apple-system, sans-serif';
  ctx.fillText(admin?.nama || 'Pengelola Kos', pad, y);

  return canvas;
}

/** Bungkus gambar screenshot JPEG dari canvas langsung menjadi berkas PDF 1.4 valid. */
function canvasToPdfBlob(canvas: HTMLCanvasElement): Blob {
  const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
  const b64 = dataUrl.split(',')[1] ?? '';
  const bin = atob(b64);
  const jpgBytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) jpgBytes[i] = bin.charCodeAt(i);

  const imgW = canvas.width;
  const imgH = canvas.height;
  const pageW = 595;
  const margin = 36;
  const maxDrawW = pageW - margin * 2;
  const maxDrawH = 770;
  const scale = Math.min(maxDrawW / imgW, maxDrawH / imgH);
  const drawW = imgW * scale;
  const drawH = imgH * scale;
  const pageH = Math.max(420, Math.ceil(drawH + margin * 2));
  const x = (pageW - drawW) / 2;
  const y = (pageH - drawH) / 2;

  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  let offset = 0;
  const offsets: number[] = [0];

  const pushBytes = (bytes: Uint8Array) => {
    chunks.push(bytes);
    offset += bytes.length;
  };
  const pushStr = (s: string) => pushBytes(encoder.encode(s));

  pushStr('%PDF-1.4\n%\xFF\xFF\xFF\xFF\n');

  offsets[1] = offset;
  pushStr('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

  offsets[2] = offset;
  pushStr('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');

  offsets[3] = offset;
  pushStr(
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /Resources << /XObject << /Im0 4 0 R >> >> /MediaBox [0 0 ${pageW} ${pageH}] /Contents 5 0 R >>\nendobj\n`,
  );

  offsets[4] = offset;
  pushStr(
    `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${imgW} /Height ${imgH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpgBytes.length} >>\nstream\n`,
  );
  pushBytes(jpgBytes);
  pushStr('\nendstream\nendobj\n');

  const contentStream = `q\n${drawW.toFixed(2)} 0 0 ${drawH.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm\n/Im0 Do\nQ\n`;
  offsets[5] = offset;
  pushStr(`5 0 obj\n<< /Length ${contentStream.length} >>\nstream\n${contentStream}endstream\nendobj\n`);

  const xrefOffset = offset;
  pushStr('xref\n0 6\n0000000000 65535 f \n');
  for (let i = 1; i <= 5; i++) {
    pushStr(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`);
  }
  pushStr(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);

  const pdfBytes = new Uint8Array(offset);
  let pos = 0;
  for (const c of chunks) {
    pdfBytes.set(c, pos);
    pos += c.length;
  }
  return new Blob([pdfBytes], { type: 'application/pdf' });
}

function triggerDownload(url: string, filename: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function ReceiptModal({ tagihan, admin, notify, onClose }: { tagihan: Tagihan; admin: AdminProfile | null; notify: (msg: string) => void; onClose: () => void }) {
  const [history, setHistory] = useState<Pembayaran[] | null>(null);
  const [error, setError] = useState('');
  const [sendingTg, setSendingTg] = useState(false);

>>>>>>> Stashed changes
  useEffect(() => {
    let cancelled = false;
    api.tagihan.pembayaran(tagihan.id).then((rows) => { if (!cancelled) setHistory(rows); })
      .catch((err: Error) => { if (!cancelled) setError(err.message); });
    return () => { cancelled = true; };
  }, [tagihan.id]);
<<<<<<< Updated upstream
  return <Modal title="Kuitansi Pembayaran" onClose={onClose}>
    <article className="receipt-print-area space-y-4 rounded-lg border p-4 text-sm">
      <header className="space-y-1 border-b pb-3"><p className="text-xl font-semibold">{admin?.nama_kos || 'Kos Gopi'}</p>{admin?.alamat_kos && <p className="text-muted-foreground">{admin.alamat_kos}</p>}<p className="text-xs text-muted-foreground">{'INV-' + tagihan.bulan.replace('-', '') + '-' + tagihan.id}</p><Status tagihan={tagihan} /></header>
=======

  const invCode = `INV-${tagihan.bulan.replace('-', '')}-${tagihan.id}`;

  const unduhScreenshotPdf = () => {
    if (!history) return;
    const canvas = renderKuitansiCanvas(tagihan, admin, history);
    const pdfBlob = canvasToPdfBlob(canvas);
    const url = URL.createObjectURL(pdfBlob);
    triggerDownload(url, `Kuitansi-${invCode}.pdf`);
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify(`Screenshot kuitansi ${invCode} diunduh sebagai PDF.`);
  };

  const unduhScreenshotPng = () => {
    if (!history) return;
    const canvas = renderKuitansiCanvas(tagihan, admin, history);
    triggerDownload(canvas.toDataURL('image/png'), `Kuitansi-${invCode}.png`);
    notify(`Screenshot kuitansi ${invCode} diunduh sebagai gambar PNG.`);
  };

  const kirimKeTelegram = async () => {
    setSendingTg(true);
    try {
      await api.tagihan.kirimKuitansiTelegram(tagihan.id);
      notify(`Kuitansi ${invCode} berhasil dikirim ke Telegram ${tagihan.penghuni_nama}.`);
    } catch (err) {
      notify((err as Error).message);
    } finally {
      setSendingTg(false);
    }
  };

  return <Modal title="Kuitansi Pembayaran" onClose={onClose}>
    <article className="space-y-4 rounded-lg border bg-background p-4 text-sm">
      <header className="space-y-1 border-b pb-3"><p className="text-xl font-semibold">{admin?.nama_kos || 'Kos Gopi'}</p>{admin?.alamat_kos && <p className="text-muted-foreground">{admin.alamat_kos}</p>}<p className="text-xs text-muted-foreground">{invCode}</p><Status tagihan={tagihan} /></header>
>>>>>>> Stashed changes
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2"><dt className="text-muted-foreground">Diterima dari</dt><dd className="break-words font-medium">{tagihan.penghuni_nama}</dd><dt className="text-muted-foreground">Kamar</dt><dd>{tagihan.kamar_nomor}</dd><dt className="text-muted-foreground">Periode</dt><dd>{namaBulan(tagihan.bulan)} ({formatPeriodeSewa(tagihan.periode_sewa, tagihan.durasi_sewa)})</dd></dl>
      <div className="space-y-2 rounded-md bg-muted/50 p-3 tabular-nums"><p className="flex justify-between gap-2"><span>Total tagihan</span><strong>{rupiah(tagihan.nominal)}</strong></p><p className="flex justify-between gap-2"><span>Sudah diterima</span><strong>{rupiah(tagihan.terbayar)}</strong></p><p className="flex justify-between gap-2 border-t pt-2"><span>Sisa tagihan</span><strong>{rupiah(tagihan.sisa)}</strong></p></div>
      {error ? <p role="alert" className="text-destructive">Riwayat tidak dapat dimuat: {error}</p> : !history ? <p role="status">Memuat riwayat pembayaran…</p> : <div className="space-y-2"><p className="font-medium">Rincian pembayaran</p>{history.map((row) => <div key={row.id} className="border-b pb-2"><p className="flex justify-between gap-2"><span>{tanggal(row.tanggal_bayar)}</span><strong className="tabular-nums">{rupiah(row.jumlah)}</strong></p><p className="text-xs text-muted-foreground">{row.metode_pembayaran}</p>{row.catatan && <p className="break-words text-xs">{row.catatan}</p>}</div>)}</div>}
      <footer className="border-t pt-3 text-xs text-muted-foreground"><p>{tagihan.status === 'Lunas' ? 'Terima kasih atas pembayaran Anda.' : 'Bukti pembayaran sebagian. Sisa tagihan belum lunas.'}</p><p className="mt-3 font-medium text-foreground">{admin?.nama || 'Pengelola Kos'}</p></footer>
    </article>
<<<<<<< Updated upstream
    <div className="flex flex-wrap justify-end gap-2"><Button variant="outline" onClick={onClose}>Tutup</Button><Button disabled={!history || !!error} onClick={() => window.print()}><Printer /> Cetak / Simpan PDF</Button></div>
=======
    <div className="flex flex-wrap justify-end gap-2">
      <Button variant="outline" onClick={onClose}>Tutup</Button>
      <Button variant="outline" disabled={!history || !!error || sendingTg} onClick={kirimKeTelegram}>
        <Send /> {sendingTg ? 'Mengirim…' : 'Kirim ke Telegram'}
      </Button>
      <Button variant="outline" disabled={!history || !!error} onClick={unduhScreenshotPng}>
        <Download /> Screenshot (PNG)
      </Button>
      <Button disabled={!history || !!error} onClick={unduhScreenshotPdf}>
        <FileDown /> Screenshot ke PDF
      </Button>
    </div>
>>>>>>> Stashed changes
  </Modal>;
}
