import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  MdAccountCircle,
  MdClearAll,
  MdDashboard,
  MdNotificationsActive,
  MdPersonPin,
  MdReceipt,
  MdReportProblem,
  MdSearch,
  MdWidgets,
} from 'react-icons/md';
import './style.css';
import { api } from './api';
import type { AdminProfile } from './api';
import Dashboard from './pages/Dashboard';
import KamarPage from './pages/Kamar';
import PenghuniPage from './pages/Penghuni';
import ProfilPage from './pages/Profil';
import TagihanPage from './pages/Tagihan';

const navItems = [
  { name: 'Dashboard', label: 'dashboard', Icon: MdDashboard },
  { name: 'Kamar', label: 'kamar', Icon: MdWidgets },
  { name: 'Penghuni', label: 'penghuni', Icon: MdPersonPin },
  { name: 'Tagihan', label: 'tagihan', Icon: MdReceipt },
  { name: 'Keluhan', label: 'keluhan', Icon: MdReportProblem },
  { name: 'Profil Admin', label: 'profil admin', Icon: MdAccountCircle },
];

const READY = new Set(['Dashboard', 'Kamar', 'Penghuni', 'Tagihan', 'Profil Admin']);

type Nav = { page: string; action?: 'tambah'; kamarId?: number; n: number };

function App() {
  const [nav, setNav] = useState<Nav>({ page: 'Dashboard', n: 0 });
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [userOpen, setUserOpen] = useState(false);
  const [admin, setAdmin] = useState<AdminProfile | null>(null);
  const [toast, setToast] = useState('');
  const timer = useRef<number | undefined>(undefined);

  const notify = useCallback((message: string) => {
    setToast(message);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToast(''), 2600);
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

  const go = (page: string, action?: 'tambah', kamarId?: number) => {
    setNav((prev) => ({ page, action, kamarId, n: prev.n + 1 }));
    setUserOpen(false);
    if (window.innerWidth < 768) setSidebarOpen(false);
    if (!READY.has(page)) notify(`${page} akan dikerjakan pada Sprint berikutnya.`);
  };

  const { page } = nav;
  const brandTitle = admin?.nama_kos || 'Kos Gopi';
  const avatarSrc = admin?.avatar_url || '/img/user.jpg';

  return (
    <main className="cr-app bg-light">
      {/* Sidebar asli react-reduction dengan foto sidebar-4.jpg + Sublime Light gradient */}
      <aside
        className={`cr-sidebar ${sidebarOpen ? 'cr-sidebar--open' : ''}`}
        data-image="/img/sidebar-4.jpg"
        style={{ backgroundImage: 'url("/img/sidebar-4.jpg")' }}
      >
        <div className="cr-sidebar__content">
          <div className="cr-sidebar__brand">
            <a
              href="#dashboard"
              className="navbar-brand d-flex align-items-center"
              onClick={(e) => {
                e.preventDefault();
                go('Dashboard');
              }}
            >
              <img src="/img/logo_200.png" width="40" height="30" className="pr-2" alt="" />
              <span className="text-white">{brandTitle}</span>
            </a>
          </div>

          <ul className="cr-sidebar__nav">
            {navItems.map(({ name, label, Icon }) => (
              <li key={name} className="nav-item">
                <button
                  type="button"
                  className={`nav-link ${page === name ? 'active' : ''}`}
                  onClick={() => go(name)}
                >
                  <Icon className="cr-sidebar__nav-item-icon" />
                  <span>{label}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      {sidebarOpen && <div className="cr-sidebar-backdrop" onClick={() => setSidebarOpen(false)} />}

      <div className="cr-content">
        {/* Header asli react-reduction */}
        <header className="cr-header navbar navbar-expand navbar-light bg-white">
          <div className="navbar-nav mr-2">
            <button
              type="button"
              className="btn btn-outline-secondary btn-toggle"
              onClick={() => setSidebarOpen((v) => !v)}
              aria-label="Toggle sidebar"
            >
              <MdClearAll size={25} />
            </button>
          </div>

          <form
            className="cr-search-form form-inline mr-auto"
            onSubmit={(e) => {
              e.preventDefault();
              go('Kamar');
            }}
          >
            <MdSearch size={20} className="cr-search-form__icon-search text-secondary" />
            <input
              type="search"
              className="cr-search-form__input form-control"
              placeholder="Search..."
              onFocus={() => {
                if (page !== 'Kamar') go('Kamar');
              }}
            />
          </form>

          <div className="navbar-nav cr-header__nav-right">
            <button
              type="button"
              className="nav-icon-btn"
              onClick={() => notify('4 tagihan belum dibayar bulan ini.')}
              aria-label="Notifikasi"
            >
              <MdNotificationsActive size={25} className="text-dark" />
              <span className="cr-notif-badge">4</span>
            </button>

            <div className="cr-user-menu">
              <button
                type="button"
                className="nav-avatar-btn"
                onClick={() => setUserOpen((v) => !v)}
                aria-label="Menu pengguna"
              >
                <img src={avatarSrc} alt={admin?.nama ?? 'Admin'} className="cr-avatar" />
              </button>
              {userOpen && (
                <div className="cr-user-popover card">
                  <div className="cr-user-popover__top">
                    <img src={avatarSrc} alt={admin?.nama ?? 'Admin'} className="cr-avatar cr-avatar--lg mb-2" />
                    <div className="font-weight-bold">{admin?.nama ?? 'Gopi'}</div>
                    <small className="d-block">{admin?.peran ?? 'Pemilik Kos'}</small>
                    <small className="d-block">{admin?.email ?? 'gopi@kosgopi.id'}</small>
                  </div>
                  <div className="list-group list-group-flush">
                    <button type="button" className="list-group-item" onClick={() => go('Profil Admin')}>
                      Kelola Profil Admin (CRUD)
                    </button>
                    <button type="button" className="list-group-item" onClick={() => go('Kamar')}>
                      Data Kamar
                    </button>
                    <button type="button" className="list-group-item" onClick={() => go('Penghuni')}>
                      Data Penghuni
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page container asli react-reduction */}
        <section className="cr-page px-3">
          <div className="cr-page__header">
            <h1 className="cr-page__title">{page}</h1>
            <ol className="breadcrumb">
              <li className="breadcrumb-item">
                <a
                  href="#home"
                  onClick={(e) => {
                    e.preventDefault();
                    go('Dashboard');
                  }}
                >
                  Home
                </a>
              </li>
              <li className="breadcrumb-item active">{page}</li>
            </ol>
          </div>

          {page === 'Dashboard' && <Dashboard key={nav.n} go={go} notify={notify} />}
          {page === 'Kamar' && (
            <KamarPage
              key={nav.n}
              notify={notify}
              autoOpen={nav.action === 'tambah'}
              onDaftarkan={(id) => go('Penghuni', undefined, id)}
            />
          )}
          {page === 'Penghuni' && <PenghuniPage key={nav.n} notify={notify} presetKamarId={nav.kamarId} />}
          {page === 'Tagihan' && <TagihanPage key={nav.n} notify={notify} />}
          {page === 'Profil Admin' && (
            <ProfilPage key={nav.n} notify={notify} onProfileChanged={loadAdmin} />
          )}
          {!READY.has(page) && (
            <div className="card card-body text-muted">
              Modul {page} dijadwalkan pada Sprint berikutnya.
            </div>
          )}
        </section>

        <footer className="cr-footer">
          2026 Manajemen {brandTitle} · Template based on Reduction Admin
        </footer>
      </div>

      {toast && <div className="toast" role="status" aria-live="polite">{toast}</div>}
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
