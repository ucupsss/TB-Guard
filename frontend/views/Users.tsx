'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { Trash2, ShieldCheck, Eye, History } from '@/components/ui/icons';
import { AppLayout } from '@/components/layout/AppLayout';
import { SectionHeader } from '@/components/tb/common';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useStore } from '@/lib/store';
import { backendFetch } from '@/lib/backend';

interface Row { email: string; name: string; picture: string; role: 'Admin' | 'Petugas'; disabled: boolean; createdAt: number; lastLoginAt: number; loginCount: number }
interface Act { at: number; actor: string; action: string; entity: string; entityId: string }

const ENTITY: Record<string, string> = { devices: 'perangkat', detections: 'deteksi', patients: 'pasien', users: 'pengguna' };
const ACTION: Record<string, string> = { create: 'menambah', update: 'mengubah', delete: 'menghapus', login: 'masuk' };
const initials = (n: string) => n.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?';
const when = (t: number) => new Date(t).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

async function call(method: string, path: string, body?: unknown) {
  const res = await backendFetch(path, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
  return j;
}

export default function Users() {
  const { user } = useStore();
  const isAdmin = user?.role === 'Admin';
  const [rows, setRows] = React.useState<Row[]>([]);
  const [acts, setActs] = React.useState<Act[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [del, setDel] = React.useState<Row | null>(null);

  const load = React.useCallback(async () => {
    try {
      const [u, a] = await Promise.all([call('GET', '/api/users'), call('GET', '/api/activity')]);
      setRows(u.users); setActs(a.activity);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Gagal memuat pengguna'); }
    finally { setLoading(false); }
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- muat data dari backend saat halaman dibuka
  React.useEffect(() => { if (isAdmin) void load(); else setLoading(false); }, [isAdmin, load]);

  const patch = async (r: Row, change: Partial<Pick<Row, 'role' | 'disabled'>>) => {
    try { await call('PATCH', `/api/users/${encodeURIComponent(r.email)}`, change); toast.success('Tersimpan'); await load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Gagal menyimpan'); }
  };
  const remove = async () => {
    if (!del) return;
    try { await call('DELETE', `/api/users/${encodeURIComponent(del.email)}`); toast.success('Pengguna dihapus'); setDel(null); await load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Gagal menghapus'); }
  };

  return (
    <AppLayout crumbs={[{ label: 'Pengguna' }]}>
      <div className="intro-y mb-6 mt-4 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold text-foreground sm:text-2xl">Pengguna</h1>
        <Badge variant="outline" className="ml-auto gap-1.5">{isAdmin ? <ShieldCheck className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}{user?.role ?? '-'}</Badge>
      </div>

      {!isAdmin ? (
        <div className="box p-8 text-center text-muted-foreground">Halaman ini hanya untuk Admin.</div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-5">
          <div className="xl:col-span-3">
            <SectionHeader title="Akun Gmail" />
            <div className="box intro-y overflow-x-auto p-2">
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Pengguna</TableHead><TableHead>Peran</TableHead><TableHead>Aktif</TableHead><TableHead className="text-right">Aksi</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {loading && <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">Memuat…</TableCell></TableRow>}
                  {rows.map((r) => {
                    const me = r.email === user?.email;
                    return (
                      <TableRow key={r.email}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9">
                              {r.picture && <AvatarImage src={r.picture} alt="" referrerPolicy="no-referrer" />}
                              <AvatarFallback className="bg-primary text-xs text-white">{initials(r.name)}</AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <div className="truncate font-medium text-foreground">{r.name || r.email}{me && <Badge variant="outline" className="ml-2">Anda</Badge>}</div>
                              <div className="truncate text-xs text-muted-foreground">{r.email} · masuk {when(r.lastLoginAt)} · {r.loginCount}x</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Select value={r.role} disabled={me} onValueChange={(v) => patch(r, { role: v as Row['role'] })}>
                            <SelectTrigger className="h-9 w-32" aria-label={`Peran ${r.email}`}><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="Admin">Admin</SelectItem><SelectItem value="Petugas">Petugas</SelectItem></SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell><Switch checked={!r.disabled} disabled={me} onCheckedChange={(on) => patch(r, { disabled: !on })} aria-label={`Aktifkan ${r.email}`} /></TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" disabled={me} onClick={() => setDel(r)} aria-label={`Hapus ${r.email}`}><Trash2 className="h-4 w-4 text-danger" /></Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <p className="px-4 pb-3 pt-2 text-xs text-muted-foreground">Admin dapat mengubah data. Petugas hanya membaca. Pengguna baru masuk sebagai Petugas.</p>
            </div>
          </div>

          <div className="xl:col-span-2">
            <SectionHeader title="Aktivitas Terbaru"><History className="h-4 w-4 text-muted-foreground" /></SectionHeader>
            <div className="box intro-y max-h-[32rem] divide-y divide-border overflow-y-auto">
              {acts.length === 0 && !loading && <div className="p-6 text-center text-sm text-muted-foreground">Belum ada aktivitas.</div>}
              {acts.map((a, i) => (
                <div key={i} className="px-4 py-2.5 text-sm">
                  <span className="font-medium text-foreground">{a.actor.split('@')[0]}</span>{' '}
                  <span className="text-muted-foreground">{ACTION[a.action] ?? a.action} {ENTITY[a.entity] ?? a.entity}</span>{' '}
                  <span className="font-mono text-xs text-foreground">{a.entityId}</span>
                  <div className="text-xs text-muted-foreground">{when(a.at)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <Dialog open={!!del} onOpenChange={(o) => !o && setDel(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus pengguna?</DialogTitle>
            <DialogDescription>{del?.email} akan kehilangan akses. Mereka bisa masuk lagi sebagai Petugas.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDel(null)}>Batal</Button>
            <Button variant="destructive" onClick={remove}>Hapus</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
