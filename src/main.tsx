import React, { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Bell, Search } from 'lucide-react';
import { toast } from 'sonner';
import './index.css';
import { api } from './api';
import type { AdminProfile, Ringkasan } from './api';
import { AppSidebar } from './app-sidebar';
import { Badge } from '@/components/ui/badge';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { Skeleton } from '@/components/ui/skeleton';
import { Toaster } from '@/components/ui/sonner';
import KamarPage from './pages/Kamar';
import PenghuniPage from './pages/Penghuni';
import ProfilPage from './pages/Profil';

// Dashboard, Tagihan & Keluhan dimuat terpisah (code-splitting).
const Dashboard = lazy(() => import('./pages/Dashboard'));
const TagihanPage = lazy(() => import('./pages/Tagihan'));
const KeluhanPage = lazy(() => import('./pages/Keluhan'));

const READY = new Set(['Dashboard', 'Kamar', 'Penghuni', 'Tagihan', 'Keluhan', 'Profil Admin']);

type Nav = { page: string; action?: 'tambah'; kamarId?: number; n: number };

function App() {
  const [nav, setNav] = useState<Nav>({ page: 'Dashboard', n: 0 });
  const [admin, setAdmin] = useState<AdminProfile | null>(null);
  const [ringkasan, setRingkasan] = useState<Ringkasan | null>(null);

  const notify = useCallback((message: string) => {
    toast(message);
  }, []);

  const loadAdmin = useCallback(() => {
    api.admin
      .aktif()
      .then(setAdmin)
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadAdmin();
  }, [loadAdmin]);

  const refreshSummary = useCallback(() => {
    api.ringkasan().then(setRingkasan).catch(() => setRingkasan(null));
  }, []);

  useEffect(() => {
    refreshSummary();
  }, [refreshSummary, nav.n]);

  const go = (page: string, action?: 'tambah', kamarId?: number) => {
    setNav((prev) => ({ page, action, kamarId, n: prev.n + 1 }));
    if (!READY.has(page)) notify(`${page} akan dikerjakan pada Sprint berikutnya.`);
  };

  const { page } = nav;

  return (
    <SidebarProvider>
      <AppSidebar page={page} go={go} admin={admin} />
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-1 data-[orientation=vertical]:h-4" />
          <form
            className="relative w-full max-w-xs"
            onSubmit={(e) => {
              e.preventDefault();
              go('Kamar');
            }}
          >
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search..."
              aria-label="Cari"
              className="h-9 pl-8"
              onFocus={() => {
                if (page !== 'Kamar') go('Kamar');
              }}
            />
          </form>
          <Button
            variant="ghost"
            size="icon"
            className="relative ml-auto"
            onClick={() => go('Tagihan')}
            aria-label={`Buka tagihan bulan ini${ringkasan ? `, ${ringkasan.tagihan_belum_lunas ?? 0} belum lunas` : ''}`}
          >
            <Bell />
            {!!ringkasan?.tagihan_belum_lunas && <Badge className="absolute -top-0.5 -right-0.5 h-4 min-w-4 rounded-full px-1 text-[10px] tabular-nums">{ringkasan.tagihan_belum_lunas}</Badge>}
          </Button>
        </header>

        <div
          key={nav.n}
          className="flex flex-1 flex-col gap-4 p-4 fill-mode-both md:p-6 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300"
        >
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">{page}</h1>
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink
                    href="#home"
                    onClick={(e) => {
                      e.preventDefault();
                      go('Dashboard');
                    }}
                  >
                    Home
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>{page}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>

          {page === 'Dashboard' && (
            <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
              <Dashboard key={nav.n} go={go} notify={notify} />
            </Suspense>
          )}
          {page === 'Kamar' && (
            <KamarPage
              key={nav.n}
              notify={notify}
              autoOpen={nav.action === 'tambah'}
              onDaftarkan={(id) => go('Penghuni', undefined, id)}
            />
          )}
          {page === 'Penghuni' && <PenghuniPage key={nav.n} notify={notify} presetKamarId={nav.kamarId} />}
          {page === 'Tagihan' && (
            <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
              <TagihanPage key={nav.n} notify={notify} onChanged={refreshSummary} />
            </Suspense>
          )}
          {page === 'Keluhan' && (
            <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
              <KeluhanPage key={nav.n} notify={notify} onChanged={refreshSummary} />
            </Suspense>
          )}
          {page === 'Profil Admin' && <ProfilPage key={nav.n} notify={notify} onProfileChanged={loadAdmin} />}
          {!READY.has(page) && (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                Modul {page} dijadwalkan pada Sprint berikutnya.
              </CardContent>
            </Card>
          )}
        </div>
      </SidebarInset>
      <Toaster />
    </SidebarProvider>
  );
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
