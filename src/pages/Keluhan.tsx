import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import {
  AlertTriangle,
  Bot,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  Eye,
  Filter,
  Flame,
  Home,
  Pencil,
  RefreshCw,
  Search,
  Send,
  Trash2,
  User,
  Wrench,
} from 'lucide-react';
import { api, ApiError, tanggal, today } from '../api';
import type { Keluhan, PrioritasKeluhan, RekapKeluhan, StatusKeluhan } from '../api';
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

const errorsDari = (err: unknown) =>
  err instanceof ApiError && Object.keys(err.errors).length ? err.errors : { _: (err as Error).message };

export default function KeluhanPage({ notify, onChanged }: KeluhanPageProps) {
  const [keluhanList, setKeluhanList] = useState<Keluhan[]>([]);
  const [rekap, setRekap] = useState<RekapKeluhan | null>(null);
  const [loading, setLoading] = useState(true);

  // Tab & Filter state: keluhan Selesai otomatis pindah ke tab Riwayat Selesai.
  const [tabTampilan, setTabTampilan] = useState<'aktif' | 'riwayat' | 'semua'>('aktif');
  const [filterStatus, setFilterStatus] = useState<string>('semua');
  const [filterPrioritas, setFilterPrioritas] = useState<string>('semua');
  const [searchQuery, setSearchQuery] = useState('');
  const [clearingRiwayat, setClearingRiwayat] = useState(false);

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

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [list, rkp] = await Promise.all([
        api.keluhan.list(),
        api.keluhan.rekap().catch(() => null),
      ]);
      setKeluhanList(list);
      setRekap(rkp);
    } catch (err) {
      if (!silent) notify(err instanceof Error ? err.message : 'Gagal memuat data keluhan.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Keluhan baru dari Bot Telegram penghuni langsung muncul di panel pemilik tanpa muat ulang manual.
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void loadData(true);
      }
    }, 15000);
    return () => window.clearInterval(timer);
  }, [loadData]);

  const salinFormatTelegram = async () => {
    const templat = [
      'Format Lapor Keluhan via Bot Telegram Kos Gopi:',
      '/keluhan Judul | Deskripsi',
      '',
      'Atau format lengkap:',
      '/keluhan Kategori | Judul | Deskripsi | Prioritas',
      '',
      'Contoh:',
      '/keluhan Elektronik & AC | AC kamar bocor | Air menetes deras dari unit indoor | Tinggi',
    ].join('\n');
    try {
      await navigator.clipboard.writeText(templat);
      notify('Format /keluhan Bot Telegram berhasil disalin.');
    } catch {
      notify('Gagal menyalin otomatis. Salin format yang tampil di kartu Telegram.');
    }
  };

  // Handle Cepat Ubah Status (1-klik WBS 3.2). Tanpa catatan/tanggal: server menyimpan catatan lama dan mengisi tanggal selesai.
  const handleQuickStatusChange = async (keluhan: Keluhan, statusBaru: StatusKeluhan) => {
    setBusyId(keluhan.id);
    try {
      await api.keluhan.updateStatus(keluhan.id, { status: statusBaru });
      notify(
        statusBaru === 'Selesai'
          ? 'Keluhan ditandai Selesai dan dipindahkan ke tab Riwayat Selesai.'
          : `Status keluhan diperbarui menjadi ${statusBaru}.`,
      );
      await loadData();
      onChanged?.();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Gagal memperbarui status keluhan.');
    } finally {
      setBusyId(null);
    }
  };

  const handleHapusRiwayat = async (keluhan: Keluhan) => {
    if (!window.confirm(`Hapus riwayat keluhan "${keluhan.judul}" (${keluhan.kamar_nomor}) secara permanen?`)) return;
    setBusyId(keluhan.id);
    try {
      await api.keluhan.remove(keluhan.id);
      notify(`Riwayat keluhan "${keluhan.judul}" berhasil dihapus.`);
      await loadData();
      onChanged?.();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Gagal menghapus riwayat keluhan.');
    } finally {
      setBusyId(null);
    }
  };

  const handleHapusSemuaRiwayat = async () => {
    const jumlahSelesai = rekap?.selesai ?? keluhanList.filter((k) => k.status === 'Selesai').length;
    if (!jumlahSelesai) return;
    if (!window.confirm(`Hapus seluruh ${jumlahSelesai} riwayat keluhan yang sudah selesai secara permanen?`)) return;
    setClearingRiwayat(true);
    try {
      const res = await api.keluhan.clearRiwayat();
      notify(`${res.dihapus} riwayat keluhan selesai berhasil dihapus.`);
      await loadData();
      onChanged?.();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Gagal menghapus semua riwayat keluhan.');
    } finally {
      setClearingRiwayat(false);
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
  const handleSaveModalStatus = async (e: FormEvent) => {
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

      notify(
        modalStatus === 'Selesai'
          ? `Keluhan "${modalKeluhan.judul}" selesai & dipindahkan ke Riwayat Selesai.`
          : `Keluhan "${modalKeluhan.judul}" berhasil diperbarui (${modalStatus}).`,
      );
      setModalKeluhan(null);
      await loadData();
      onChanged?.();
    } catch (err) {
      setModalErrors(errorsDari(err));
    } finally {
      setUpdatingStatus(false);
    }
  };

  const aktifCount = rekap?.aktif ?? keluhanList.filter((k) => k.status !== 'Selesai').length;
  const selesaiCount = rekap?.selesai ?? keluhanList.filter((k) => k.status === 'Selesai').length;
  const totalCount = rekap?.total ?? keluhanList.length;

  const gantiTab = (next: 'aktif' | 'riwayat' | 'semua') => {
    setTabTampilan(next);
    setFilterStatus('semua');
  };

  // Filter list
  const filteredList = keluhanList.filter((k) => {
    if (tabTampilan === 'aktif' && k.status === 'Selesai') return false;
    if (tabTampilan === 'riwayat' && k.status !== 'Selesai') return false;
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

  const handleKirimTelegram = async (keluhan: Keluhan) => {
    setBusyId(keluhan.id);
    try {
      await api.keluhan.kirimTelegram(keluhan.id);
      notify(`Update keluhan #${keluhan.id} dikirim ke Telegram ${keluhan.penghuni_nama}.`);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Gagal mengirim pesan Telegram.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Panel Keluhan Pemilik Kos (WBS 3.2) */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Keluhan Fasilitas</h2>
        <p className="text-sm text-muted-foreground">
          Pemantauan dan penanganan laporan kerusakan fasilitas kamar yang masuk dari Bot Telegram penghuni.
        </p>
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

      {/* Informasi Integrasi Bot Telegram (Penghuni Lapor -> Dashboard, Status Berubah -> Telegram Penghuni) */}
      <Card className="border-blue-500/20 bg-blue-500/5">
        <CardContent className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1.5 text-sm">
            <div className="flex items-center gap-2 font-semibold text-foreground">
              <Bot className="size-4 text-blue-600 dark:text-blue-400" />
              Integrasi Keluhan 2 Arah via Bot Telegram
            </div>
            <p className="text-xs text-muted-foreground">
              Penghuni yang sudah terhubung (<code className="rounded bg-muted px-1 py-0.5">/hubung</code>) dapat mengirim
              keluhan langsung dari Telegram tanpa membuka dashboard pemilik. Saat Anda memperbarui status di bawah,
              notifikasi otomatis dikirim ke Telegram penghuni.
            </p>
            <div className="flex flex-wrap gap-2 pt-1 text-xs">
              <code className="rounded border bg-background px-2 py-1 font-mono text-foreground">
                /keluhan Judul | Deskripsi
              </code>
              <code className="rounded border bg-background px-2 py-1 font-mono text-foreground">
                /keluhan Kategori | Judul | Deskripsi | Prioritas
              </code>
              <code className="rounded border bg-background px-2 py-1 font-mono text-muted-foreground">
                /statuskeluhan
              </code>
            </div>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={salinFormatTelegram} className="shrink-0 gap-1.5">
            <Copy className="size-3.5" />
            Salin Format /keluhan
          </Button>
        </CardContent>
      </Card>

      {/* DAFTAR & PENANGANAN KELUHAN (WBS 3.2 - KHUSUS ADMIN / PEMILIK) */}
      <Card className="shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-lg">Daftar &amp; Penanganan Keluhan</CardTitle>
                <CardDescription>
                  Keluhan berstatus Pending/Diproses tampil di Keluhan Aktif; saat ditandai Selesai otomatis pindah ke
                  Riwayat Selesai dan dapat dihapus.
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {tabTampilan === 'riwayat' && selesaiCount > 0 && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleHapusSemuaRiwayat}
                    disabled={clearingRiwayat || loading}
                    className="gap-1.5"
                  >
                    <Trash2 className="size-3.5" />
                    {clearingRiwayat ? 'Menghapus...' : `Hapus Semua Riwayat (${selesaiCount})`}
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => void loadData(false)} disabled={loading} className="gap-1.5">
                  <RefreshCw className={cn('size-3.5', loading && 'animate-spin')} />
                  Muat Ulang
                </Button>
              </div>
            </div>

            {/* Tab Keluhan Aktif vs Riwayat Selesai */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant={tabTampilan === 'aktif' ? 'default' : 'outline'}
                onClick={() => gantiTab('aktif')}
                className="h-8 text-xs"
              >
                Keluhan Aktif ({aktifCount})
              </Button>
              <Button
                type="button"
                size="sm"
                variant={tabTampilan === 'riwayat' ? 'default' : 'outline'}
                onClick={() => gantiTab('riwayat')}
                className="h-8 text-xs"
              >
                Riwayat Selesai ({selesaiCount})
              </Button>
              <Button
                type="button"
                size="sm"
                variant={tabTampilan === 'semua' ? 'default' : 'outline'}
                onClick={() => gantiTab('semua')}
                className="h-8 text-xs"
              >
                Semua ({totalCount})
              </Button>
            </div>

            {/* Filter Bar */}
            <div className="mt-3 flex flex-col gap-3 rounded-lg border bg-muted/20 p-3 sm:flex-row sm:items-center">
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
                {tabTampilan !== 'riwayat' && (
                  <>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Filter className="size-3.5" />
                      Status:
                    </div>
                    <select
                      aria-label="Filter status"
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      className={cn(selectClass, 'h-9 w-36 text-xs')}
                    >
                      <option value="semua">{tabTampilan === 'aktif' ? 'Semua Aktif' : 'Semua Status'}</option>
                      <option value="Pending">Pending</option>
                      <option value="Diproses">Diproses</option>
                      {tabTampilan === 'semua' && <option value="Selesai">Selesai</option>}
                    </select>
                  </>
                )}

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
                <p className="font-medium text-foreground">
                  {tabTampilan === 'riwayat'
                    ? 'Belum ada riwayat keluhan selesai.'
                    : 'Tidak ada keluhan aktif saat ini.'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {tabTampilan === 'riwayat'
                    ? 'Keluhan yang Anda tandai Selesai akan muncul di tab ini dan bisa dihapus.'
                    : 'Semua keluhan sudah selesai (lihat di tab Riwayat Selesai) atau tidak ada data pada filter ini.'}
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
                              {k.kamar_nomor}
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

                        {/* Kirim Update Keluhan ke Telegram Penghuni */}
                        {k.penghuni_id && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 gap-1.5 text-xs text-sky-700 hover:bg-sky-50 dark:text-sky-300 dark:hover:bg-sky-950/30"
                            disabled={busyId === k.id}
                            onClick={() => handleKirimTelegram(k)}
                          >
                            <Send className="size-3.5" />
                            Kirim Update ke Telegram
                          </Button>
                        )}

                        {/* Hapus Riwayat (hanya tampil setelah status Selesai) */}
                        {k.status === 'Selesai' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 gap-1.5 border-destructive/30 text-xs text-destructive hover:bg-destructive/10"
                            disabled={busyId === k.id}
                            onClick={() => handleHapusRiwayat(k)}
                          >
                            <Trash2 className="size-3.5" />
                            Hapus Riwayat
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
              hint="Catatan tersimpan di riwayat dan dikirim otomatis ke Telegram penghuni."
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
                <p className="font-medium">{detailKeluhan.kamar_nomor}</p>
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
