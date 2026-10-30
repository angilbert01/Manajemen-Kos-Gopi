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
  MessageSquare,
  MessageSquareWarning,
  Pencil,
  PlusCircle,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  Trash2,
  User,
  Wrench,
} from 'lucide-react';
import { api, tanggal, today } from '../api';
import type { Kamar, Keluhan, PrioritasKeluhan, RekapKeluhan, StatusKeluhan } from '../api';
import { selectClass } from '../components';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  const [updatingStatus, setUpdatingStatus] = useState(false);

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

  // Handle Simpan Keluhan Baru (WBS 3.1)
  const handleSubmitKeluhan = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (!formKamarId) errors.kamar_id = 'Pilih kamar Anda.';
    if (!formJudul.trim()) errors.judul = 'Judul keluhan wajib diisi.';
    if (!formDeskripsi.trim()) errors.deskripsi = 'Deskripsi detail keluhan wajib diisi.';

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    setFormErrors({});
    setSubmittingForm(true);

    try {
      const selectedKamar = kamarList.find((k) => String(k.id) === String(formKamarId));
      await api.keluhan.create({
        kamar_id: Number(formKamarId),
        penghuni_id: selectedKamar?.penghuni_id ?? null,
        judul: formJudul.trim(),
        deskripsi: formDeskripsi.trim(),
        kategori: formKategori,
        prioritas: formPrioritas,
        foto_url: formFotoUrl.trim() || undefined,
        tanggal_lapor: today(),
      });

      notify('✅ Keluhan fasilitas berhasil dikirim! Status awal: Pending.');
      setFormJudul('');
      setFormDeskripsi('');
      setFormFotoUrl('');
      await loadData();
      onChanged?.();
      setViewMode('semua');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Gagal mengirim keluhan.');
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

  // Handle Cepat Ubah Status (1-klik WBS 3.2)
  const handleQuickStatusChange = async (keluhan: Keluhan, statusBaru: StatusKeluhan) => {
    try {
      await api.keluhan.updateStatus(keluhan.id, {
        status: statusBaru,
        catatan_penanganan:
          statusBaru === 'Diproses'
            ? keluhan.catatan_penanganan || 'Keluhan telah diterima pemilik dan sedang dalam penanganan teknisi.'
            : statusBaru === 'Selesai'
              ? keluhan.catatan_penanganan || 'Perbaikan fasilitas telah selesai dikerjakan.'
              : undefined,
        tanggal_selesai: statusBaru === 'Selesai' ? today() : undefined,
      });

      notify(`Status keluhan diperbarui menjadi "${statusBaru}".`);
      await loadData();
      onChanged?.();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Gagal memperbarui status keluhan.');
    }
  };

  // Handle Update Status lewat Modal (dengan input catatan teknisi/pemilik)
  const handleSaveModalStatus = async () => {
    if (!modalKeluhan) return;
    setUpdatingStatus(true);
    try {
      await api.keluhan.updateStatus(modalKeluhan.id, {
        status: modalStatus,
        catatan_penanganan: modalCatatan.trim(),
        tanggal_selesai: modalStatus === 'Selesai' ? today() : undefined,
      });

      notify(`✅ Keluhan "${modalKeluhan.judul}" berhasil diubah menjadi ${modalStatus}.`);
      setModalKeluhan(null);
      await loadData();
      onChanged?.();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Gagal memperbarui status.');
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Handle Hapus Keluhan
  const handleDeleteKeluhan = async (id: number, judul: string) => {
    if (!window.confirm(`Hapus laporan keluhan "${judul}"?`)) return;
    try {
      await api.keluhan.remove(id);
      notify('Keluhan berhasil dihapus.');
      await loadData();
      onChanged?.();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Gagal menghapus keluhan.');
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
          <Badge variant="outline" className="border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
            <Clock className="mr-1 size-3" />
            Pending
          </Badge>
        );
      case 'Diproses':
        return (
          <Badge variant="outline" className="border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
            <Wrench className="mr-1 size-3" />
            Diproses
          </Badge>
        );
      case 'Selesai':
        return (
          <Badge variant="outline" className="border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
            <CheckCircle2 className="mr-1 size-3" />
            Selesai
          </Badge>
        );
    }
  };

  const getPrioritasBadge = (prioritas: PrioritasKeluhan) => {
    switch (prioritas) {
      case 'Tinggi':
        return (
          <Badge variant="destructive" className="gap-1">
            <Flame className="size-3" />
            Tinggi
          </Badge>
        );
      case 'Sedang':
        return (
          <Badge variant="secondary" className="gap-1 bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
            <AlertTriangle className="size-3" />
            Sedang
          </Badge>
        );
      case 'Rendah':
        return (
          <Badge variant="secondary" className="text-muted-foreground">
            Rendah
          </Badge>
        );
    }
  };

  // Buka WhatsApp untuk konfirmasi penanganan ke penghuni
  const kirimWhatsApp = (keluhan: Keluhan) => {
    const hp = keluhan.penghuni_no_hp?.replace(/^0/, '62');
    if (!hp) {
      notify('Nomor WhatsApp penghuni tidak tersedia.');
      return;
    }
    const pesan = encodeURIComponent(
      `Halo Kak ${keluhan.penghuni_nama} (${keluhan.kamar_nomor}),\n\n` +
        `Mengenai laporan keluhan fasilitas:\n` +
        `📌 *${keluhan.judul}*\n` +
        `Status saat ini: *${keluhan.status.toUpperCase()}*\n` +
        (keluhan.catatan_penanganan ? `Catatan penanganan: ${keluhan.catatan_penanganan}\n` : '') +
        `\nTerima kasih atas laporannya. Kami terus berupaya menjaga kenyamanan Kos Gopi. 🙏`,
    );
    window.open(`https://wa.me/${hp}?text=${pesan}`, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Header Info & Switcher Mode (WBS 3.1 & WBS 3.2) */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Sistem Manajemen Keluhan Fasilitas</h2>
          <p className="text-sm text-muted-foreground">
            Layanan penanganan kerusakan & fasilitas kamar antara penghuni dan pemilik kos (EP-03 WBS 3.1 & 3.2).
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
          <CardContent className="text-xs text-muted-foreground">Semua tiket keluhan fasilitas masuk</CardContent>
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
                  Form Input Keluhan Fasilitas (Sisi Penghuni — WBS 3.1)
                </CardTitle>
                <CardDescription>
                  Laporkan kerusakan atau kendala fasilitas kamar Anda. Keluhan langsung tercatat dengan status awal
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
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                💡 Template Keluhan Cepat (Klik untuk isi otomatis):
              </Label>
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

            <form onSubmit={handleSubmitKeluhan} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {/* Pilih Kamar */}
                <div className="space-y-1.5">
                  <Label htmlFor="form-kamar">Kamar Pelapor *</Label>
                  <select
                    id="form-kamar"
                    value={formKamarId}
                    onChange={(e) => setFormKamarId(e.target.value)}
                    className={cn(selectClass, formErrors.kamar_id && 'border-destructive')}
                  >
                    <option value="">-- Pilih Kamar --</option>
                    {kamarList.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.nomor} ({k.tipe}) {k.penghuni_nama ? `— ${k.penghuni_nama}` : ''}
                      </option>
                    ))}
                  </select>
                  {formErrors.kamar_id && <p className="text-xs text-destructive">{formErrors.kamar_id}</p>}
                </div>

                {/* Kategori Fasilitas */}
                <div className="space-y-1.5">
                  <Label htmlFor="form-kategori">Kategori Fasilitas</Label>
                  <select
                    id="form-kategori"
                    value={formKategori}
                    onChange={(e) => setFormKategori(e.target.value)}
                    className={selectClass}
                  >
                    {KATEGORI_LIST.map((kat) => (
                      <option key={kat} value={kat}>
                        {kat}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Prioritas */}
                <div className="space-y-1.5">
                  <Label htmlFor="form-prioritas">Tingkat Urgensi / Prioritas</Label>
                  <select
                    id="form-prioritas"
                    value={formPrioritas}
                    onChange={(e) => setFormPrioritas(e.target.value as PrioritasKeluhan)}
                    className={selectClass}
                  >
                    <option value="Rendah">Rendah (Bisa ditangani berkala)</option>
                    <option value="Sedang">Sedang (Perlu penanganan biasa)</option>
                    <option value="Tinggi">Tinggi (Mendesak / Mengganggu aktivitas)</option>
                  </select>
                </div>
              </div>

              {/* Judul Keluhan */}
              <div className="space-y-1.5">
                <Label htmlFor="form-judul">Judul Keluhan Singkat *</Label>
                <Input
                  id="form-judul"
                  placeholder="Contoh: AC menetes dan tidak dingin / Kran wastafel doll"
                  value={formJudul}
                  onChange={(e) => setFormJudul(e.target.value)}
                  className={formErrors.judul ? 'border-destructive' : ''}
                />
                {formErrors.judul && <p className="text-xs text-destructive">{formErrors.judul}</p>}
              </div>

              {/* Deskripsi Detail */}
              <div className="space-y-1.5">
                <Label htmlFor="form-deskripsi">Deskripsi Detail Kerusakan & Lokasi *</Label>
                <textarea
                  id="form-deskripsi"
                  placeholder="Jelaskan secara rinci kendala yang terjadi, sejak kapan terjadi, dan dampaknya..."
                  rows={3}
                  value={formDeskripsi}
                  onChange={(e) => setFormDeskripsi(e.target.value)}
                  className={cn(
                    'flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
                    formErrors.deskripsi && 'border-destructive',
                  )}
                />
                {formErrors.deskripsi && <p className="text-xs text-destructive">{formErrors.deskripsi}</p>}
              </div>

              {/* URL Foto (Opsional) */}
              <div className="space-y-1.5">
                <Label htmlFor="form-foto">Link / URL Foto Bukti Kerusakan (Opsional)</Label>
                <Input
                  id="form-foto"
                  type="url"
                  placeholder="https://contoh.com/foto-kerusakan.jpg"
                  value={formFotoUrl}
                  onChange={(e) => setFormFotoUrl(e.target.value)}
                />
                <p className="text-[11px] text-muted-foreground">
                  Opsional: Lampirkan URL foto jika ada untuk memudahkan identifikasi teknisi.
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setFormJudul('');
                    setFormDeskripsi('');
                    setFormFotoUrl('');
                  }}
                >
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
                <CardTitle className="text-lg">Daftar & Penanganan Keluhan (Sisi Pemilik — WBS 3.2)</CardTitle>
                <CardDescription>
                  Kelola tiket kerusakan fasilitas, update status penanganan (Pending ➔ Diproses ➔ Selesai), dan beri
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
                              🏠 {k.kamar_nomor} ({k.kamar_tipe})
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
                          <span className="font-semibold text-blue-900 dark:text-blue-300">
                            📝 Catatan Penanganan:
                          </span>{' '}
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
                            onClick={() => handleQuickStatusChange(k, 'Diproses')}
                          >
                            <Wrench className="size-3.5" />
                            Proses Sekarang
                          </Button>
                        )}

                        {k.status === 'Diproses' && (
                          <Button
                            size="sm"
                            variant="default"
                            className="h-8 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-xs text-white"
                            onClick={() => handleQuickStatusChange(k, 'Selesai')}
                          >
                            <Check className="size-3.5" />
                            Tandai Selesai
                          </Button>
                        )}

                        {k.status === 'Selesai' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 gap-1.5 text-xs text-amber-600 hover:bg-amber-50"
                            onClick={() => handleQuickStatusChange(k, 'Diproses')}
                          >
                            <RefreshCw className="size-3.5" />
                            Buka Kembali (Diproses)
                          </Button>
                        )}

                        {/* Modal Update Status & Catatan Lengkap */}
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 gap-1.5 text-xs"
                          onClick={() => {
                            setModalKeluhan(k);
                            setModalStatus(k.status);
                            setModalCatatan(k.catatan_penanganan || '');
                          }}
                        >
                          <Pencil className="size-3.5" />
                          Ubah Status & Catatan
                        </Button>

                        {/* WhatsApp Notifikasi Penghuni */}
                        {k.penghuni_no_hp && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 gap-1.5 text-xs text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                            onClick={() => kirimWhatsApp(k)}
                          >
                            <MessageSquare className="size-3.5" />
                            WA Penghuni
                          </Button>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2 text-xs"
                          onClick={() => setDetailKeluhan(k)}
                        >
                          <Eye className="size-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2 text-xs text-destructive hover:bg-destructive/10"
                          onClick={() => handleDeleteKeluhan(k.id, k.judul)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* MODAL UPDATE STATUS KELUHAN (WBS 3.2) */}
      <Dialog open={!!modalKeluhan} onOpenChange={(open) => !open && setModalKeluhan(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="size-5 text-primary" />
              Update Status Keluhan Fasilitas
            </DialogTitle>
            <DialogDescription>
              Perbarui status penanganan untuk kamar <strong>{modalKeluhan?.kamar_nomor}</strong>: &quot;
              {modalKeluhan?.judul}&quot;
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="modal-status">Pilih Status Baru</Label>
              <select
                id="modal-status"
                value={modalStatus}
                onChange={(e) => setModalStatus(e.target.value as StatusKeluhan)}
                className={selectClass}
              >
                <option value="Pending">Pending (Menunggu antrian teknisi)</option>
                <option value="Diproses">Diproses (Sedang diperbaiki / dijadwalkan)</option>
                <option value="Selesai">Selesai (Perbaikan tuntas normal)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="modal-catatan">Catatan Penanganan & Tindak Lanjut</Label>
              <textarea
                id="modal-catatan"
                placeholder="Contoh: Teknisi pipa dijadwalkan datang jam 14.00 WIB untuk penggantian seal kran / Selesai diganti bohlam baru."
                rows={4}
                value={modalCatatan}
                onChange={(e) => setModalCatatan(e.target.value)}
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
              />
              <p className="text-[11px] text-muted-foreground">
                Catatan ini akan tersimpan di riwayat dan dapat diteruskan ke penghuni via WhatsApp.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalKeluhan(null)}>
              Batal
            </Button>
            <Button onClick={handleSaveModalStatus} disabled={updatingStatus}>
              {updatingStatus ? 'Menyimpan...' : 'Simpan Pembaruan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL DETAIL KELUHAN */}
      <Dialog open={!!detailKeluhan} onOpenChange={(open) => !open && setDetailKeluhan(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquareWarning className="size-5 text-primary" />
              Detail Keluhan Fasilitas #{detailKeluhan?.id}
            </DialogTitle>
            <DialogDescription>Informasi lengkap laporan dan riwayat tindak lanjut penanganan.</DialogDescription>
          </DialogHeader>

          {detailKeluhan && (
            <div className="space-y-4 py-2 text-sm">
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
                  <span className="text-muted-foreground">Tingkat Prioritas:</span>
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
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setDetailKeluhan(null)}>Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
