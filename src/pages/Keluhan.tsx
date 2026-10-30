import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  Eye,
  Filter,
  Flame,
  Home,
  MessageSquare,
  MessageSquareWarning,
  Pencil,
  PlusCircle,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  User,
  Wrench,
} from 'lucide-react';
import { api, ApiError, tanggal, today, waLink } from '../api';
import type { Kamar, Keluhan, PrioritasKeluhan, RekapKeluhan, StatusKeluhan } from '../api';
import { Field, Modal, selectClass } from '../components';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

interface KeluhanPageProps {
  notify: (msg: string) => void;
  onChanged?: () => void;
}

const KATEGORI_LIST = [
  'Elektronik & AC',
  'Plumbing & Sanitasi',
  'Furnitur & Kasur',
  'Kelistrikan',
  'Kebersihan',
  'Keamanan & Kunci',
  'Fasilitas Kamar',
  'Lainnya',
];

// Sama dengan aturan server (409 jika di luar ini): Pending -> Diproses -> Selesai, Selesai bisa dibuka kembali.
const STATUS_BERIKUT: Record<StatusKeluhan, StatusKeluhan[]> = {
  Pending: ['Diproses'],
  Diproses: ['Selesai'],
  Selesai: ['Diproses'],
};

const LABEL_STATUS: Record<StatusKeluhan, string> = {
  Pending: 'Pending (Menunggu antrean teknisi)',
  Diproses: 'Diproses (Sedang diperbaiki / dijadwalkan)',
  Selesai: 'Selesai (Perbaikan tuntas)',
};

const textareaClass =
  'flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:border-destructive';

const TEMPLAT_KELUHAN = [
  {
    judul: 'AC bocor dan tidak dingin',
    deskripsi: 'Air AC menetes deras dari unit indoor, suhu kamar tidak dingin meski sudah disetel 18°C.',
    kategori: 'Elektronik & AC',
    prioritas: 'Tinggi' as PrioritasKeluhan,
  },
  {
    judul: 'Kran air wastafel macet/patah',
    deskripsi: 'Kran putaran wastafel doll/lepas sehingga air tidak bisa menyala lancar.',
    kategori: 'Plumbing & Sanitasi',
    prioritas: 'Sedang' as PrioritasKeluhan,
  },
  {
    judul: 'Lampu utama kamar tidur putus',
    deskripsi: 'Lampu LED plafon kamar mati total, mohon dibantu penggantian bohlam.',
    kategori: 'Kelistrikan',
    prioritas: 'Rendah' as PrioritasKeluhan,
  },
  {
    judul: 'Kloset kamar mandi mampet',
    deskripsi: 'Aliran pembuangan air kloset sangat lambat dan meluap saat disiram.',
    kategori: 'Plumbing & Sanitasi',
    prioritas: 'Tinggi' as PrioritasKeluhan,
  },
  {
    judul: 'Gagang kunci pintu kamar dol',
    deskripsi: 'Kunci sulit diputar dari luar, rawan terkunci sendiri atau sulit dibuka.',
    kategori: 'Keamanan & Kunci',
    prioritas: 'Tinggi' as PrioritasKeluhan,
  },
];

const errorsDari = (err: unknown) =>
  err instanceof ApiError && Object.keys(err.errors).length ? err.errors : { _: (err as Error).message };

export default function KeluhanPage({ notify, onChanged }: KeluhanPageProps) {
  const [keluhanList, setKeluhanList] = useState<Keluhan[]>([]);
  const [rekap, setRekap] = useState<RekapKeluhan | null>(null);
  const [kamarList, setKamarList] = useState<Kamar[]>([]);
  const [loading, setLoading] = useState(true);

  // View mode: 'semua' | 'penghuni' (WBS 3.1) | 'pemilik' (WBS 3.2)
  const [viewMode, setViewMode] = useState<'semua' | 'penghuni' | 'pemilik'>('semua');

  // Filter state
  const [filterStatus, setFilterStatus] = useState<string>('semua');
  const [filterPrioritas, setFilterPrioritas] = useState<string>('semua');
  const [searchQuery, setSearchQuery] = useState('');

  // Form input keluhan sisi penghuni (WBS 3.1)
  const [formKamarId, setFormKamarId] = useState('');
  const [formJudul, setFormJudul] = useState('');
  const [formDeskripsi, setFormDeskripsi] = useState('');
  const [formKategori, setFormKategori] = useState('Elektronik & AC');
  const [formPrioritas, setFormPrioritas] = useState<PrioritasKeluhan>('Sedang');
  const [formFotoUrl, setFormFotoUrl] = useState('');
  const [submittingForm, setSubmittingForm] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Modal Update Status sisi pemilik (WBS 3.2)
  const [modalKeluhan, setModalKeluhan] = useState<Keluhan | null>(null);
  const [modalStatus, setModalStatus] = useState<StatusKeluhan>('Diproses');
  const [modalCatatan, setModalCatatan] = useState('');
  const [modalTanggal, setModalTanggal] = useState('');
  const [modalErrors, setModalErrors] = useState<Record<string, string>>({});
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Id keluhan yang sedang diproses tombol cepat (cegah klik ganda)
  const [busyId, setBusyId] = useState<number | null>(null);

  // Modal Detail Keluhan
  const [detailKeluhan, setDetailKeluhan] = useState<Keluhan | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [list, rkp, kmr] = await Promise.all([
        api.keluhan.list(),
        api.keluhan.rekap().catch(() => null),
        api.kamar.list(),
      ]);
      setKeluhanList(list);
      setRekap(rkp);
      setKamarList(kmr);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Gagal memuat data keluhan.');
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const selectedKamar = kamarList.find((k) => String(k.id) === formKamarId);

  const resetForm = () => {
    setFormJudul('');
    setFormDeskripsi('');
    setFormFotoUrl('');
    setFormErrors({});
  };

  // Handle Simpan Keluhan Baru (WBS 3.1)
  const handleSubmitKeluhan = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (!formKamarId) errors.kamar_id = 'Pilih kamar.';
    if (!formJudul.trim()) errors.judul = 'Judul keluhan wajib diisi.';
    if (!formDeskripsi.trim()) errors.deskripsi = 'Deskripsi keluhan wajib diisi.';

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    setFormErrors({});
    setSubmittingForm(true);

    try {
      await api.keluhan.create({
        kamar_id: Number(formKamarId),
        // Penghuni selalu diambil dari kamar terpilih; kamar kosong = tanpa penghuni.
        penghuni_id: selectedKamar?.penghuni_id ?? null,
        judul: formJudul.trim(),
        deskripsi: formDeskripsi.trim(),
        kategori: formKategori,
        prioritas: formPrioritas,
        foto_url: formFotoUrl.trim() || undefined,
        tanggal_lapor: today(),
      });

      notify('Keluhan berhasil dikirim dengan status Pending.');
      resetForm();
      await loadData();
      onChanged?.();
      setViewMode('semua');
    } catch (err) {
      setFormErrors(errorsDari(err));
    } finally {
      setSubmittingForm(false);
    }
  };

  // Quick fill templat
  const applyTemplat = (t: (typeof TEMPLAT_KELUHAN)[0]) => {
    setFormJudul(t.judul);
    setFormDeskripsi(t.deskripsi);
    setFormKategori(t.kategori);
    setFormPrioritas(t.prioritas);
  };

  // Handle Cepat Ubah Status (1-klik WBS 3.2). Tanpa catatan/tanggal: server menyimpan catatan lama dan mengisi tanggal selesai.
  const handleQuickStatusChange = async (keluhan: Keluhan, statusBaru: StatusKeluhan) => {
    setBusyId(keluhan.id);
    try {
      await api.keluhan.updateStatus(keluhan.id, { status: statusBaru });
      notify(`Status keluhan diperbarui menjadi ${statusBaru}.`);
      await loadData();
      onChanged?.();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Gagal memperbarui status keluhan.');
    } finally {
      setBusyId(null);
    }
  };

  const bukaModalStatus = (k: Keluhan) => {
    setModalKeluhan(k);
    setModalStatus(k.status);
    setModalCatatan(k.catatan_penanganan || '');
    setModalTanggal(k.tanggal_selesai || '');
    setModalErrors({});
  };

  // Handle Update Status lewat Modal (dengan input catatan teknisi/pemilik)
  const handleSaveModalStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalKeluhan) return;
    setUpdatingStatus(true);
    setModalErrors({});
    try {
      await api.keluhan.updateStatus(modalKeluhan.id, {
        status: modalStatus,
        catatan_penanganan: modalCatatan.trim(),
        // Kirim tanggal selesai hanya jika diisi/diubah pengguna; selain itu server memakai tanggal lama atau hari ini.
        tanggal_selesai:
          modalStatus === 'Selesai' && modalTanggal && modalTanggal !== modalKeluhan.tanggal_selesai
            ? modalTanggal
            : undefined,
      });

      notify(`Keluhan "${modalKeluhan.judul}" berhasil diperbarui (${modalStatus}).`);
      setModalKeluhan(null);
      await loadData();
      onChanged?.();
    } catch (err) {
      setModalErrors(errorsDari(err));
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Filter list
  const filteredList = keluhanList.filter((k) => {
    if (filterStatus !== 'semua' && k.status !== filterStatus) return false;
    if (filterPrioritas !== 'semua' && k.prioritas !== filterPrioritas) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchKamar = k.kamar_nomor?.toLowerCase().includes(q);
      const matchJudul = k.judul?.toLowerCase().includes(q);
      const matchPenghuni = k.penghuni_nama?.toLowerCase().includes(q);
      const matchKategori = k.kategori?.toLowerCase().includes(q);
      if (!matchKamar && !matchJudul && !matchPenghuni && !matchKategori) return false;
    }
    return true;
  });

  const getStatusBadge = (status: StatusKeluhan) => {
    switch (status) {
      case 'Pending':
        return (
          <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-900">
            <Clock className="mr-1 size-3" aria-hidden />
            Pending
          </Badge>
        );
      case 'Diproses':
        return (
          <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-800">
            <Wrench className="mr-1 size-3" aria-hidden />
            Diproses
          </Badge>
        );
      case 'Selesai':
        return (
          <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-800">
            <CheckCircle2 className="mr-1 size-3" aria-hidden />
            Selesai
          </Badge>
        );
    }
  };

  const getPrioritasBadge = (prioritas: PrioritasKeluhan) => {
    switch (prioritas) {
      case 'Tinggi':
        return (
          <Badge variant="outline" className="gap-1 border-red-200 bg-red-50 text-red-800">
            <Flame className="size-3" aria-hidden />
            Tinggi
          </Badge>
        );
      case 'Sedang':
        return (
          <Badge variant="secondary" className="gap-1">
            <AlertTriangle className="size-3" aria-hidden />
            Sedang
          </Badge>
        );
      case 'Rendah':
        return (
          <Badge variant="outline" className="text-muted-foreground">
            Rendah
          </Badge>
        );
    }
  };

  // Link WhatsApp untuk konfirmasi penanganan ke penghuni
  const linkWhatsApp = (keluhan: Keluhan) =>
    waLink(
      keluhan.penghuni_no_hp,
      `Halo Kak ${keluhan.penghuni_nama} (${keluhan.kamar_nomor}),\n\n` +
        `Mengenai laporan keluhan fasilitas:\n` +
        `*${keluhan.judul}*\n` +
        `Status saat ini: *${keluhan.status.toUpperCase()}*\n` +
        (keluhan.catatan_penanganan ? `Catatan penanganan: ${keluhan.catatan_penanganan}\n` : '') +
        `\nTerima kasih atas laporannya. Kami terus berupaya menjaga kenyamanan Kos Gopi.`,
    );

  return (
    <div className="space-y-6">
      {/* Header Info & Switcher Mode (WBS 3.1 & WBS 3.2) */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Keluhan Fasilitas</h2>
          <p className="text-sm text-muted-foreground">
            Pencatatan dan penanganan kerusakan fasilitas kamar antara penghuni dan pemilik kos.
          </p>
        </div>

        {/* View Mode Pills */}
        <div className="flex items-center rounded-lg border bg-muted/30 p-1">
          <Button
            type="button"
            variant={viewMode === 'semua' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-8 text-xs font-medium"
            onClick={() => setViewMode('semua')}
          >
            Panel Terpadu
          </Button>
          <Button
            type="button"
            variant={viewMode === 'penghuni' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-8 gap-1.5 text-xs font-medium"
            onClick={() => setViewMode('penghuni')}
          >
            <PlusCircle className="size-3.5" />
            Sisi Penghuni
          </Button>
          <Button
            type="button"
            variant={viewMode === 'pemilik' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-8 gap-1.5 text-xs font-medium"
            onClick={() => setViewMode('pemilik')}
          >
            <Wrench className="size-3.5" />
            Sisi Pemilik
          </Button>
        </div>
      </div>

      {/* Ringkasan Status Keluhan */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-slate-400">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-semibold uppercase tracking-wider">Total Laporan</CardDescription>
            <CardTitle className="text-3xl font-bold tabular-nums">{rekap?.total ?? keluhanList.length}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Semua laporan keluhan fasilitas masuk</CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500 bg-amber-500/5">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              Pending (Menunggu)
            </CardDescription>
            <CardTitle className="text-3xl font-bold text-amber-600 tabular-nums dark:text-amber-400">
              {rekap?.pending ?? keluhanList.filter((k) => k.status === 'Pending').length}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Belum ditangani oleh teknisi/pemilik</CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500 bg-blue-500/5">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              Sedang Diproses
            </CardDescription>
            <CardTitle className="text-3xl font-bold text-blue-600 tabular-nums dark:text-blue-400">
              {rekap?.diproses ?? keluhanList.filter((k) => k.status === 'Diproses').length}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Sedang diperbaiki atau menunggu suku cadang</CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500 bg-emerald-500/5">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Selesai Ditangani
            </CardDescription>
            <CardTitle className="text-3xl font-bold text-emerald-600 tabular-nums dark:text-emerald-400">
              {rekap?.selesai ?? keluhanList.filter((k) => k.status === 'Selesai').length}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Fasilitas sudah diperbaiki & berfungsi normal</CardContent>
        </Card>
      </div>

      {/* TAMPILAN SISI PENGHUNI (WBS 3.1) - FORM INPUT KELUHAN */}
      {(viewMode === 'penghuni' || viewMode === 'semua') && (
        <Card className="border-primary/20 shadow-sm">
          <CardHeader className="bg-muted/30 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <MessageSquareWarning className="size-5 text-primary" />
                  Laporkan Keluhan Fasilitas
                </CardTitle>
                <CardDescription>
                  Laporkan kerusakan atau kendala fasilitas kamar. Keluhan langsung tercatat dengan status awal
                  &quot;Pending&quot;.
                </CardDescription>
              </div>
              <Badge variant="secondary" className="gap-1">
                <Sparkles className="size-3 text-amber-500" />
                Respon Cepat
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {/* Quick Fill Chips */}
            <div className="mb-6 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Template keluhan (klik untuk isi otomatis):
              </p>
              <div className="flex flex-wrap gap-2">
                {TEMPLAT_KELUHAN.map((t, idx) => (
                  <Button
                    key={idx}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => applyTemplat(t)}
                  >
                    + {t.judul}
                  </Button>
                ))}
              </div>
            </div>

            <form onSubmit={handleSubmitKeluhan} className="space-y-4" noValidate>
              {formErrors._ && (
                <Alert variant="destructive">
                  <AlertDescription>{formErrors._}</AlertDescription>
                </Alert>
              )}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {/* Pilih Kamar — penghuni mengikuti kamar */}
                <Field
                  label="Kamar pelapor *"
                  error={formErrors.kamar_id || formErrors.penghuni_id}
                  hint={
                    selectedKamar
                      ? selectedKamar.penghuni_id
                        ? `Penghuni: ${selectedKamar.penghuni_nama}`
                        : 'Kamar kosong — tanpa penghuni'
                      : undefined
                  }
                >
                  <select
                    value={formKamarId}
                    onChange={(e) => setFormKamarId(e.target.value)}
                    className={selectClass}
                    aria-invalid={!!(formErrors.kamar_id || formErrors.penghuni_id)}
                  >
                    <option value="">-- Pilih Kamar --</option>
                    {kamarList.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.nomor} ({k.tipe}) — {k.penghuni_id ? k.penghuni_nama : 'Kamar kosong'}
                      </option>
                    ))}
                  </select>
                </Field>

                {/* Kategori Fasilitas */}
                <Field label="Kategori fasilitas" error={formErrors.kategori}>
                  <select
                    value={formKategori}
                    onChange={(e) => setFormKategori(e.target.value)}
                    className={selectClass}
                    aria-invalid={!!formErrors.kategori}
                  >
                    {KATEGORI_LIST.map((kat) => (
                      <option key={kat} value={kat}>
                        {kat}
                      </option>
                    ))}
                  </select>
                </Field>

                {/* Prioritas */}
                <Field label="Prioritas" error={formErrors.prioritas}>
                  <select
                    value={formPrioritas}
                    onChange={(e) => setFormPrioritas(e.target.value as PrioritasKeluhan)}
                    className={selectClass}
                    aria-invalid={!!formErrors.prioritas}
                  >
                    <option value="Rendah">Rendah (Bisa ditangani berkala)</option>
                    <option value="Sedang">Sedang (Perlu penanganan biasa)</option>
                    <option value="Tinggi">Tinggi (Mendesak / Mengganggu aktivitas)</option>
                  </select>
                </Field>
              </div>

              {/* Judul Keluhan */}
              <Field label="Judul keluhan *" error={formErrors.judul}>
                <Input
                  placeholder="Contoh: AC menetes dan tidak dingin / Kran wastafel doll"
                  value={formJudul}
                  onChange={(e) => setFormJudul(e.target.value)}
                  maxLength={120}
                  aria-invalid={!!formErrors.judul}
                />
              </Field>

              {/* Deskripsi Detail */}
              <Field label="Deskripsi kerusakan & lokasi *" error={formErrors.deskripsi}>
                <textarea
                  placeholder="Jelaskan secara rinci kendala yang terjadi, sejak kapan terjadi, dan dampaknya..."
                  rows={3}
                  value={formDeskripsi}
                  onChange={(e) => setFormDeskripsi(e.target.value)}
                  maxLength={1000}
                  aria-invalid={!!formErrors.deskripsi}
                  className={textareaClass}
                />
              </Field>

              {/* URL Foto (Opsional) */}
              <Field
                label="URL foto bukti kerusakan (opsional)"
                error={formErrors.foto_url}
                hint="Lampirkan URL foto jika ada untuk memudahkan identifikasi teknisi."
              >
                <Input
                  type="url"
                  placeholder="https://contoh.com/foto-kerusakan.jpg"
                  value={formFotoUrl}
                  onChange={(e) => setFormFotoUrl(e.target.value)}
                  aria-invalid={!!formErrors.foto_url}
                />
              </Field>

              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={resetForm}>
                  Reset Form
                </Button>
                <Button type="submit" disabled={submittingForm} className="gap-2">
                  <Send className="size-4" />
                  {submittingForm ? 'Mengirim Laporan...' : 'Kirim Laporan Keluhan'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* TAMPILAN DAFTAR & UPDATE STATUS KELUHAN (WBS 3.2 - SISI PEMILIK) */}
      {(viewMode === 'pemilik' || viewMode === 'semua') && (
        <Card className="shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-lg">Daftar & Penanganan Keluhan</CardTitle>
                <CardDescription>
                  Kelola laporan kerusakan fasilitas, perbarui status penanganan (Pending, Diproses, Selesai), dan beri
                  catatan perbaikan.
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={loadData} disabled={loading} className="gap-1.5">
                <RefreshCw className={cn('size-3.5', loading && 'animate-spin')} />
                Muat Ulang
              </Button>
            </div>

            {/* Filter Bar */}
            <div className="mt-4 flex flex-col gap-3 rounded-lg border bg-muted/20 p-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  aria-label="Cari keluhan"
                  placeholder="Cari keluhan (kamar, nama penghuni, masalah)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9 pl-9 text-sm"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Filter className="size-3.5" />
                  Status:
                </div>
                <select
                  aria-label="Filter status"
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className={cn(selectClass, 'h-9 w-32 text-xs')}
                >
                  <option value="semua">Semua Status</option>
                  <option value="Pending">Pending</option>
                  <option value="Diproses">Diproses</option>
                  <option value="Selesai">Selesai</option>
                </select>

                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">Prioritas:</div>
                <select
                  aria-label="Filter prioritas"
                  value={filterPrioritas}
                  onChange={(e) => setFilterPrioritas(e.target.value)}
                  className={cn(selectClass, 'h-9 w-32 text-xs')}
                >
                  <option value="semua">Semua</option>
                  <option value="Tinggi">Tinggi</option>
                  <option value="Sedang">Sedang</option>
                  <option value="Rendah">Rendah</option>
                </select>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {loading ? (
              <div className="py-12 text-center text-sm text-muted-foreground">Memuat daftar keluhan fasilitas...</div>
            ) : filteredList.length === 0 ? (
              <div className="py-12 text-center">
                <CheckCircle2 className="mx-auto mb-2 size-8 text-emerald-500" />
                <p className="font-medium text-foreground">Tidak ada keluhan fasilitas yang cocok.</p>
                <p className="text-xs text-muted-foreground">
                  Semua keluhan telah diselesaikan atau tidak ada data pada filter ini.
                </p>
              </div>
            ) : (
              <div className="grid gap-4">
                {filteredList.map((k) => (
                  <Card
                    key={k.id}
                    className={cn(
                      'transition-all hover:border-primary/40',
                      k.status === 'Pending'
                        ? 'border-l-4 border-l-amber-500'
                        : k.status === 'Diproses'
                          ? 'border-l-4 border-l-blue-500'
                          : 'border-l-4 border-l-emerald-500 opacity-90',
                    )}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-foreground text-base">{k.judul}</span>
                            {getStatusBadge(k.status)}
                            {getPrioritasBadge(k.prioritas)}
                            <Badge variant="outline" className="text-xs">
                              {k.kategori}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1 font-medium text-foreground">
                              <Home className="size-3" aria-hidden />
                              {k.kamar_nomor} ({k.kamar_tipe})
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <User className="size-3" />
                              {k.penghuni_nama || 'Penghuni Kamar'}
                            </span>
                            <span>•</span>
                            <span>Lapor: {tanggal(k.tanggal_lapor)}</span>
                            {k.tanggal_selesai && (
                              <>
                                <span>•</span>
                                <span className="text-emerald-600 dark:text-emerald-400">
                                  Selesai: {tanggal(k.tanggal_selesai)}
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Status Stepper Mini */}
                        <div className="flex items-center gap-1 self-start rounded-full border bg-muted/30 px-2 py-1 text-[11px]">
                          <span
                            className={
                              k.status === 'Pending'
                                ? 'font-semibold text-amber-600 dark:text-amber-400'
                                : 'text-muted-foreground line-through'
                            }
                          >
                            Pending
                          </span>
                          <span>→</span>
                          <span
                            className={
                              k.status === 'Diproses'
                                ? 'font-semibold text-blue-600 dark:text-blue-400'
                                : k.status === 'Selesai'
                                  ? 'text-muted-foreground line-through'
                                  : 'text-muted-foreground'
                            }
                          >
                            Diproses
                          </span>
                          <span>→</span>
                          <span
                            className={
                              k.status === 'Selesai'
                                ? 'font-semibold text-emerald-600 dark:text-emerald-400'
                                : 'text-muted-foreground'
                            }
                          >
                            Selesai
                          </span>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-3 pb-3 text-sm">
                      <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">{k.deskripsi}</p>

                      {k.foto_url && (
                        <div className="flex items-center gap-2 text-xs">
                          <ExternalLink className="size-3.5 text-primary" />
                          <a
                            href={k.foto_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                          >
                            Lihat Foto Lampiran Kerusakan
                          </a>
                        </div>
                      )}

                      {/* Catatan Penanganan Teknisi / Pemilik */}
                      {k.catatan_penanganan && (
                        <div className="rounded-md border border-blue-200 bg-blue-50/50 p-2.5 text-xs dark:border-blue-900/60 dark:bg-blue-950/20">
                          <span className="font-semibold text-blue-900 dark:text-blue-300">Catatan penanganan:</span>{' '}
                          <span className="text-blue-800 dark:text-blue-200">{k.catatan_penanganan}</span>
                        </div>
                      )}
                    </CardContent>

                    <Separator />

                    <CardFooter className="flex flex-wrap items-center justify-between gap-2 pt-3">
                      {/* Aksi Cepat 1-Klik Alur Status */}
                      <div className="flex flex-wrap items-center gap-2">
                        {k.status === 'Pending' && (
                          <Button
                            size="sm"
                            variant="default"
                            className="h-8 gap-1.5 bg-blue-600 hover:bg-blue-700 text-xs text-white"
                            disabled={busyId === k.id}
                            onClick={() => handleQuickStatusChange(k, 'Diproses')}
                          >
                            <Wrench className="size-3.5" />
                            {busyId === k.id ? 'Menyimpan...' : 'Proses Sekarang'}
                          </Button>
                        )}

                        {k.status === 'Diproses' && (
                          <Button
                            size="sm"
                            variant="default"
                            className="h-8 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-xs text-white"
                            disabled={busyId === k.id}
                            onClick={() => handleQuickStatusChange(k, 'Selesai')}
                          >
                            <Check className="size-3.5" />
                            {busyId === k.id ? 'Menyimpan...' : 'Tandai Selesai'}
                          </Button>
                        )}

                        {k.status === 'Selesai' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 gap-1.5 text-xs text-amber-600 hover:bg-amber-50"
                            disabled={busyId === k.id}
                            onClick={() => handleQuickStatusChange(k, 'Diproses')}
                          >
                            <RefreshCw className="size-3.5" />
                            {busyId === k.id ? 'Menyimpan...' : 'Buka kembali'}
                          </Button>
                        )}

                        {/* Modal Update Status & Catatan Lengkap */}
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 gap-1.5 text-xs"
                          onClick={() => bukaModalStatus(k)}
                        >
                          <Pencil className="size-3.5" />
                          Ubah Status & Catatan
                        </Button>

                        {/* WhatsApp Notifikasi Penghuni (kamar kosong tidak punya nomor) */}
                        {k.penghuni_no_hp && (
                          <Button
                            asChild
                            size="sm"
                            variant="outline"
                            className="h-8 gap-1.5 text-xs text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                          >
                            <a href={linkWhatsApp(k)} target="_blank" rel="noopener noreferrer">
                              <MessageSquare className="size-3.5" />
                              WA Penghuni
                            </a>
                          </Button>
                        )}
                      </div>

                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 px-2 text-xs"
                        aria-label={`Lihat detail keluhan ${k.judul}`}
                        onClick={() => setDetailKeluhan(k)}
                      >
                        <Eye className="size-3.5" />
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* MODAL UPDATE STATUS KELUHAN (WBS 3.2) */}
      {modalKeluhan && (
        <Modal title="Ubah Status Keluhan" onClose={() => setModalKeluhan(null)}>
          <form className="grid gap-4" onSubmit={handleSaveModalStatus} noValidate>
            <p className="text-sm text-muted-foreground">
              Kamar <strong>{modalKeluhan.kamar_nomor}</strong>: &quot;{modalKeluhan.judul}&quot;
            </p>
            {modalErrors._ && (
              <Alert variant="destructive">
                <AlertDescription>{modalErrors._}</AlertDescription>
              </Alert>
            )}

            <Field label="Status" error={modalErrors.status}>
              <select
                value={modalStatus}
                onChange={(e) => setModalStatus(e.target.value as StatusKeluhan)}
                className={selectClass}
                aria-invalid={!!modalErrors.status}
              >
                <option value={modalKeluhan.status}>{LABEL_STATUS[modalKeluhan.status]} — saat ini</option>
                {STATUS_BERIKUT[modalKeluhan.status].map((s) => (
                  <option key={s} value={s}>
                    {modalKeluhan.status === 'Selesai' ? 'Buka kembali (Diproses)' : LABEL_STATUS[s]}
                  </option>
                ))}
              </select>
            </Field>

            {modalStatus === 'Selesai' && (
              <Field
                label="Tanggal selesai"
                error={modalErrors.tanggal_selesai}
                hint={modalKeluhan.status === 'Selesai' ? undefined : 'Kosongkan untuk memakai tanggal hari ini.'}
              >
                <Input
                  type="date"
                  value={modalTanggal}
                  min={modalKeluhan.tanggal_lapor}
                  max={today()}
                  onChange={(e) => setModalTanggal(e.target.value)}
                  aria-invalid={!!modalErrors.tanggal_selesai}
                />
              </Field>
            )}

            <Field
              label="Catatan penanganan & tindak lanjut"
              error={modalErrors.catatan_penanganan}
              hint="Catatan tersimpan di riwayat dan dapat diteruskan ke penghuni lewat WhatsApp."
            >
              <textarea
                placeholder="Contoh: Teknisi dijadwalkan datang jam 14.00 WIB untuk mengganti seal kran."
                rows={4}
                value={modalCatatan}
                onChange={(e) => setModalCatatan(e.target.value)}
                maxLength={500}
                aria-invalid={!!modalErrors.catatan_penanganan}
                className={textareaClass}
              />
            </Field>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setModalKeluhan(null)}>
                Batal
              </Button>
              <Button type="submit" disabled={updatingStatus}>
                {updatingStatus ? 'Menyimpan...' : 'Simpan'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL DETAIL KELUHAN */}
      {detailKeluhan && (
        <Modal title={`Detail Keluhan #${detailKeluhan.id}`} onClose={() => setDetailKeluhan(null)}>
          <div className="space-y-4 text-sm">
            <div className="flex items-center justify-between border-b pb-2">
              <span className="font-semibold text-base">{detailKeluhan.judul}</span>
              {getStatusBadge(detailKeluhan.status)}
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-muted-foreground">Kamar:</span>
                <p className="font-medium">
                  {detailKeluhan.kamar_nomor} ({detailKeluhan.kamar_tipe})
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Penghuni:</span>
                <p className="font-medium">{detailKeluhan.penghuni_nama || '-'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Kategori:</span>
                <p className="font-medium">{detailKeluhan.kategori}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Prioritas:</span>
                <div>{getPrioritasBadge(detailKeluhan.prioritas)}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Tanggal Lapor:</span>
                <p className="font-medium">{tanggal(detailKeluhan.tanggal_lapor)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Tanggal Selesai:</span>
                <p className="font-medium">
                  {detailKeluhan.tanggal_selesai ? tanggal(detailKeluhan.tanggal_selesai) : 'Belum Selesai'}
                </p>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-xs font-semibold text-muted-foreground">Deskripsi Lengkap:</span>
              <p className="rounded-md border bg-muted/20 p-3 leading-relaxed whitespace-pre-wrap">
                {detailKeluhan.deskripsi}
              </p>
            </div>

            {detailKeluhan.foto_url && (
              <div className="space-y-1">
                <span className="text-xs font-semibold text-muted-foreground">Foto Bukti Kerusakan:</span>
                <div className="rounded-md border p-2">
                  <img
                    src={detailKeluhan.foto_url}
                    alt="Bukti kerusakan"
                    className="max-h-56 w-full rounded object-contain"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                  <a
                    href={detailKeluhan.foto_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 block text-xs text-primary hover:underline"
                  >
                    Buka Tautan Foto Asli
                  </a>
                </div>
              </div>
            )}

            {detailKeluhan.catatan_penanganan && (
              <div className="space-y-1">
                <span className="text-xs font-semibold text-muted-foreground">Catatan Penanganan:</span>
                <p className="rounded-md border border-blue-200 bg-blue-50/50 p-3 text-blue-900 leading-relaxed dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200">
                  {detailKeluhan.catatan_penanganan}
                </p>
              </div>
            )}

            <div className="flex justify-end">
              <Button onClick={() => setDetailKeluhan(null)}>Tutup</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
