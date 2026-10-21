import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { MdAdd, MdCheckCircle, MdDelete, MdEdit } from 'react-icons/md';
import { api, ApiError } from '../api';
import type { AdminForm, AdminProfile } from '../api';
import { Field, Modal } from '../components';

const emptyForm: AdminForm = {
  nama: '',
  peran: 'Pemilik Kos',
  email: '',
  no_hp: '',
  nama_kos: 'Kos Gopi',
  alamat_kos: '',
  avatar_url: '/img/user.jpg',
  aktif: true,
};

type Props = {
  notify: (m: string) => void;
  onProfileChanged: () => void;
};

export default function ProfilPage({ notify, onProfileChanged }: Props) {
  const [items, setItems] = useState<AdminProfile[]>([]);
  const [selected, setSelected] = useState<AdminProfile | null>(null);
  const [form, setForm] = useState<AdminForm>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      const list = await api.admin.list();
      setItems(list);
      const aktif = list.find((a) => a.aktif === 1) ?? list[0] ?? null;
      setSelected(aktif);
      if (aktif) {
        setForm({
          nama: aktif.nama,
          peran: aktif.peran,
          email: aktif.email,
          no_hp: aktif.no_hp,
          nama_kos: aktif.nama_kos,
          alamat_kos: aktif.alamat_kos,
          avatar_url: aktif.avatar_url,
        });
      }
    } catch (e) {
      notify((e as Error).message);
    }
  }, [notify]);

  useEffect(() => {
    load();
  }, [load]);

  const pilihEdit = (a: AdminProfile) => {
    setSelected(a);
    setErrors({});
    setForm({
      nama: a.nama,
      peran: a.peran,
      email: a.email,
      no_hp: a.no_hp,
      nama_kos: a.nama_kos,
      alamat_kos: a.alamat_kos,
      avatar_url: a.avatar_url,
    });
  };

  const set = (k: keyof AdminForm) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  const submitUpdate = async (e: FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setSaving(true);
    setErrors({});
    try {
      const updated = await api.admin.update(selected.id, form);
      notify(`Profil ${updated.nama} berhasil diperbarui.`);
      await load();
      onProfileChanged();
    } catch (err) {
      setErrors(err instanceof ApiError && Object.keys(err.errors).length ? err.errors : { _: (err as Error).message });
    } finally {
      setSaving(false);
    }
  };

  const aktifkan = async (a: AdminProfile) => {
    try {
      await api.admin.aktifkan(a.id);
      notify(`${a.nama} dijadikan profil admin aktif.`);
      await load();
      onProfileChanged();
    } catch (e) {
      notify((e as Error).message);
    }
  };

  const hapus = async (a: AdminProfile) => {
    if (!window.confirm(`Hapus profil admin "${a.nama}"?`)) return;
    try {
      await api.admin.remove(a.id);
      notify(`Profil ${a.nama} dihapus.`);
      await load();
      onProfileChanged();
    } catch (e) {
      notify((e as Error).message);
    }
  };

  return (
    <div className="cr-row cr-row--2">
      {/* Kolom Kiri: UserCard gaya react-reduction + Daftar Semua Admin (Read, Activate, Delete, Create) */}
      <div>
        {selected && (
          <div className="card mb-3 overflow-hidden">
            <div className="cr-user-popover__top" style={{ padding: '1.75rem 1.25rem' }}>
              <img
                src={selected.avatar_url || '/img/user.jpg'}
                alt={selected.nama}
                className="cr-avatar cr-avatar--lg mb-2"
                style={{ border: '2px solid rgba(255,255,255,0.85)' }}
              />
              <h5 className="mb-0 text-white">{selected.nama}</h5>
              <div className="small">{selected.peran}</div>
              <div className="small mt-1">{selected.email} · {selected.no_hp}</div>
            </div>
            <div className="card-body d-flex justify-content-between align-items-center">
              <div>
                <div className="font-weight-500">{selected.nama_kos}</div>
                <div className="text-muted small">{selected.alamat_kos || 'Alamat belum diisi'}</div>
              </div>
              <span className={`badge badge-${selected.aktif ? 'success' : 'secondary'}`}>
                {selected.aktif ? 'Profil Aktif' : 'Non-aktif'}
              </span>
            </div>
          </div>
        )}

        <div className="card">
          <div className="card-header d-flex justify-content-between align-items-center">
            <span>Daftar Profil Admin ({items.length})</span>
            <button
              type="button"
              className="btn btn-sm btn-primary d-inline-flex align-items-center"
              onClick={() => setCreating(true)}
            >
              <MdAdd size={16} className="mr-1" /> Tambah Admin
            </button>
          </div>
          <div className="tablewrap">
            <table className="table table-hover">
              <thead>
                <tr>
                  <th>Admin</th>
                  <th>Peran</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {items.map((a) => (
                  <tr key={a.id} className={selected?.id === a.id ? 'bg-light' : ''}>
                    <td>
                      <div className="d-flex align-items-center">
                        <img src={a.avatar_url || '/img/user.jpg'} alt="" className="cr-avatar cr-avatar--sm mr-2" />
                        <div>
                          <div className="font-weight-500">{a.nama}</div>
                          <div className="text-muted small">{a.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>{a.peran}</td>
                    <td>
                      <span className={`badge badge-${a.aktif ? 'success' : 'secondary'}`}>
                        {a.aktif ? 'Aktif' : 'Cadangan'}
                      </span>
                    </td>
                    <td>
                      <div className="d-flex align-items-center" style={{ gap: '0.35rem' }}>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary"
                          title="Edit profil ini"
                          onClick={() => pilihEdit(a)}
                        >
                          <MdEdit size={15} />
                        </button>
                        {!a.aktif && (
                          <button
                            type="button"
                            className="btn btn-sm btn-primary"
                            title="Gunakan profil ini"
                            onClick={() => aktifkan(a)}
                          >
                            <MdCheckCircle size={15} />
                          </button>
                        )}
                        {items.length > 1 && (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger"
                            title="Hapus profil"
                            onClick={() => hapus(a)}
                          >
                            <MdDelete size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Kolom Kanan: Form Update Profil Admin & Informasi Kos */}
      <div className="card">
        <div className="card-header">
          Edit Profil Admin {selected ? `— ${selected.nama}` : ''}
        </div>
        <div className="card-body">
          <form className="form" onSubmit={submitUpdate} noValidate>
            {errors._ && <div className="alert alert-danger">{errors._}</div>}
            <div className="row2">
              <Field label="Nama Admin *" error={errors.nama}>
                <input className="form-control" value={form.nama} onChange={set('nama')} placeholder="Gopi" />
              </Field>
              <Field label="Peran / Jabatan *" error={errors.peran}>
                <select className="form-control" value={form.peran} onChange={set('peran')}>
                  <option>Pemilik Kos</option>
                  <option>Pengelola Kos</option>
                  <option>Admin Keuangan</option>
                </select>
              </Field>
            </div>
            <div className="row2">
              <Field label="Email *" error={errors.email}>
                <input type="email" className="form-control" value={form.email} onChange={set('email')} placeholder="gopi@kosgopi.id" />
              </Field>
              <Field label="Nomor HP *" error={errors.no_hp}>
                <input type="tel" className="form-control" value={form.no_hp} onChange={set('no_hp')} placeholder="081234567800" />
              </Field>
            </div>
            <div className="row2">
              <Field label="Nama Kos *" error={errors.nama_kos}>
                <input className="form-control" value={form.nama_kos} onChange={set('nama_kos')} placeholder="Kos Gopi" />
              </Field>
              <Field label="URL Foto Avatar" error={errors.avatar_url}>
                <input className="form-control" value={form.avatar_url} onChange={set('avatar_url')} placeholder="/img/user.jpg" />
              </Field>
            </div>
            <Field label="Alamat Kos" error={errors.alamat_kos}>
              <input className="form-control" value={form.alamat_kos} onChange={set('alamat_kos')} placeholder="Jl. Veteran No. 12, Malang" />
            </Field>
            <div className="formactions">
              {selected && !selected.aktif && (
                <button type="button" className="btn btn-outline-secondary" onClick={() => aktifkan(selected)}>
                  Jadikan Profil Aktif
                </button>
              )}
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {creating && (
        <TambahAdminModal
          onClose={() => setCreating(false)}
          onCreated={async (baru) => {
            setCreating(false);
            notify(`Profil admin ${baru.nama} berhasil ditambahkan.`);
            await load();
            onProfileChanged();
          }}
        />
      )}
    </div>
  );
}

function TambahAdminModal({ onClose, onCreated }: { onClose: () => void; onCreated: (a: AdminProfile) => void }) {
  const [form, setForm] = useState<AdminForm>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const set = (k: keyof AdminForm) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      const created = await api.admin.create(form);
      onCreated(created);
    } catch (err) {
      setErrors(err instanceof ApiError && Object.keys(err.errors).length ? err.errors : { _: (err as Error).message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Tambah Profil Admin Baru" onClose={onClose}>
      <form className="form" onSubmit={submit} noValidate>
        {errors._ && <div className="alert alert-danger">{errors._}</div>}
        <Field label="Nama Admin *" error={errors.nama}>
          <input autoFocus className="form-control" value={form.nama} onChange={set('nama')} placeholder="mis. Hasan Huzaifi" />
        </Field>
        <div className="row2">
          <Field label="Peran *" error={errors.peran}>
            <select className="form-control" value={form.peran} onChange={set('peran')}>
              <option>Pemilik Kos</option>
              <option>Pengelola Kos</option>
              <option>Admin Keuangan</option>
            </select>
          </Field>
          <Field label="Nomor HP *" error={errors.no_hp}>
            <input type="tel" className="form-control" value={form.no_hp} onChange={set('no_hp')} placeholder="081234567899" />
          </Field>
        </div>
        <Field label="Email *" error={errors.email}>
          <input type="email" className="form-control" value={form.email} onChange={set('email')} placeholder="admin@kosgopi.id" />
        </Field>
        <div className="row2">
          <Field label="Nama Kos *" error={errors.nama_kos}>
            <input className="form-control" value={form.nama_kos} onChange={set('nama_kos')} />
          </Field>
          <Field label="Alamat Kos" error={errors.alamat_kos}>
            <input className="form-control" value={form.alamat_kos} onChange={set('alamat_kos')} placeholder="Malang" />
          </Field>
        </div>
        <label className="check">
          <input
            type="checkbox"
            checked={Boolean(form.aktif)}
            onChange={(e) => setForm({ ...form, aktif: e.target.checked })}
          />{' '}
          Langsung jadikan profil aktif
        </label>
        <div className="formactions">
          <button type="button" className="btn btn-outline-secondary" onClick={onClose}>
            Batal
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Menyimpan...' : 'Tambah Admin'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
