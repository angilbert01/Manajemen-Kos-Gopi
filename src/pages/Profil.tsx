import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { CheckCircle2, Pencil, Plus, Trash2 } from 'lucide-react';
import { api, ApiError } from '../api';
import type { AdminForm, AdminProfile } from '../api';
import { initials } from '../app-sidebar';
import { Field, Modal, selectClass } from '../components';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

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
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Kolom kiri: kartu profil aktif + daftar semua admin (Read, Activate, Delete, Create) */}
      <div className="flex min-w-0 flex-col gap-4">
        {selected && (
          <Card>
            <CardContent className="flex items-center gap-4">
              <Avatar className="size-16">
                <AvatarImage src={selected.avatar_url || undefined} alt={selected.nama} />
                <AvatarFallback className="text-lg">{initials(selected.nama)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="truncate text-lg font-semibold">{selected.nama}</h2>
                  {selected.aktif ? (
                    <Badge variant="secondary" className="gap-1">
                      <CheckCircle2 className="text-emerald-600" /> Profil Aktif
                    </Badge>
                  ) : (
                    <Badge variant="outline">Non-aktif</Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{selected.peran}</p>
                <p className="truncate text-sm text-muted-foreground">
                  {selected.email} · {selected.no_hp}
                </p>
              </div>
            </CardContent>
            <CardContent className="border-t pt-4">
              <div className="font-medium">{selected.nama_kos}</div>
              <div className="text-sm text-muted-foreground">{selected.alamat_kos || 'Alamat belum diisi'}</div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Daftar Profil Admin ({items.length})</CardTitle>
            <CardAction>
              <Button size="sm" onClick={() => setCreating(true)}>
                <Plus /> Tambah Admin
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Admin</TableHead>
                    <TableHead>Peran</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((a) => (
                    <TableRow key={a.id} data-state={selected?.id === a.id ? 'selected' : undefined}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="size-8">
                            <AvatarImage src={a.avatar_url || undefined} alt="" />
                            <AvatarFallback className="text-xs">{initials(a.nama)}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <div className="truncate font-medium">{a.nama}</div>
                            <div className="truncate text-xs text-muted-foreground">{a.email}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{a.peran}</TableCell>
                      <TableCell>
                        {a.aktif ? <Badge variant="secondary">Aktif</Badge> : <Badge variant="outline">Cadangan</Badge>}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-8"
                            title="Edit profil ini"
                            aria-label="Edit profil ini"
                            onClick={() => pilihEdit(a)}
                          >
                            <Pencil />
                          </Button>
                          {!a.aktif && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="size-8"
                              title="Gunakan profil ini"
                              aria-label="Gunakan profil ini"
                              onClick={() => aktifkan(a)}
                            >
                              <CheckCircle2 />
                            </Button>
                          )}
                          {items.length > 1 && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="size-8 text-destructive hover:text-destructive"
                              title="Hapus profil"
                              aria-label="Hapus profil"
                              onClick={() => hapus(a)}
                            >
                              <Trash2 />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Kolom kanan: form update profil admin & informasi kos */}
      <Card className="h-fit">
        <CardHeader>
          <CardTitle>Edit Profil Admin {selected ? `— ${selected.nama}` : ''}</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={submitUpdate} noValidate>
            {errors._ && (
              <Alert variant="destructive">
                <AlertDescription>{errors._}</AlertDescription>
              </Alert>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nama Admin *" error={errors.nama}>
                <Input value={form.nama} onChange={set('nama')} placeholder="Gopi" aria-invalid={!!errors.nama} />
              </Field>
              <Field label="Peran / Jabatan *" error={errors.peran}>
                <select className={selectClass} value={form.peran} onChange={set('peran')}>
                  <option>Pemilik Kos</option>
                  <option>Pengelola Kos</option>
                  <option>Admin Keuangan</option>
                </select>
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Email *" error={errors.email}>
                <Input type="email" value={form.email} onChange={set('email')} placeholder="gopi@kosgopi.id" aria-invalid={!!errors.email} />
              </Field>
              <Field label="Nomor HP *" error={errors.no_hp}>
                <Input type="tel" value={form.no_hp} onChange={set('no_hp')} placeholder="081234567800" aria-invalid={!!errors.no_hp} />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nama Kos *" error={errors.nama_kos}>
                <Input value={form.nama_kos} onChange={set('nama_kos')} placeholder="Kos Gopi" aria-invalid={!!errors.nama_kos} />
              </Field>
              <Field label="URL Foto Avatar" error={errors.avatar_url}>
                <Input value={form.avatar_url} onChange={set('avatar_url')} placeholder="/img/user.jpg" />
              </Field>
            </div>
            <Field label="Alamat Kos" error={errors.alamat_kos}>
              <Input value={form.alamat_kos} onChange={set('alamat_kos')} placeholder="Jl. Veteran No. 12, Malang" />
            </Field>
            <div className="flex flex-wrap justify-end gap-2">
              {selected && !selected.aktif && (
                <Button type="button" variant="outline" onClick={() => aktifkan(selected)}>
                  Jadikan Profil Aktif
                </Button>
              )}
              <Button type="submit" disabled={saving}>
                {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

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
      <form className="grid gap-4" onSubmit={submit} noValidate>
        {errors._ && (
          <Alert variant="destructive">
            <AlertDescription>{errors._}</AlertDescription>
          </Alert>
        )}
        <Field label="Nama Admin *" error={errors.nama}>
          <Input autoFocus value={form.nama} onChange={set('nama')} placeholder="mis. Hasan Huzaifi" aria-invalid={!!errors.nama} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Peran *" error={errors.peran}>
            <select className={selectClass} value={form.peran} onChange={set('peran')}>
              <option>Pemilik Kos</option>
              <option>Pengelola Kos</option>
              <option>Admin Keuangan</option>
            </select>
          </Field>
          <Field label="Nomor HP *" error={errors.no_hp}>
            <Input type="tel" value={form.no_hp} onChange={set('no_hp')} placeholder="081234567899" aria-invalid={!!errors.no_hp} />
          </Field>
        </div>
        <Field label="Email *" error={errors.email}>
          <Input type="email" value={form.email} onChange={set('email')} placeholder="admin@kosgopi.id" aria-invalid={!!errors.email} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nama Kos *" error={errors.nama_kos}>
            <Input value={form.nama_kos} onChange={set('nama_kos')} aria-invalid={!!errors.nama_kos} />
          </Field>
          <Field label="Alamat Kos" error={errors.alamat_kos}>
            <Input value={form.alamat_kos} onChange={set('alamat_kos')} placeholder="Malang" />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4 accent-primary"
            checked={Boolean(form.aktif)}
            onChange={(e) => setForm({ ...form, aktif: e.target.checked })}
          />
          Langsung jadikan profil aktif
        </label>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Menyimpan...' : 'Tambah Admin'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
