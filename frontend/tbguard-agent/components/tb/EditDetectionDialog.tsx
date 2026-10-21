'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useStore } from '@/lib/store';
import { fmt } from '@/lib/format';

export function EditDetectionDialog({ uuid, open, onOpenChange }: { uuid: string | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { detection, updateDetection } = useStore();
  const d = uuid ? detection(uuid) : undefined;
  const [name, setName] = React.useState('');
  const [gender, setGender] = React.useState('');
  const [age, setAge] = React.useState('');
  const [type, setType] = React.useState<'Batuk' | '-'>('Batuk');
  const [verified, setVerified] = React.useState('none');
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- isi ulang form tiap dialog dibuka
    if (d && open) { setName(d.name); setGender(d.gender || 'x'); setAge(String(d.age || '')); setType(d.type); setVerified(d.verified || 'none'); }
  }, [d?.uuid, open]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!d) return null;
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    updateDetection(d.uuid, { name: name.trim(), gender: gender === 'x' ? '' : (gender as 'L' | 'P'), age: age ? +age : '', type, verified: verified === 'none' ? null : (verified as 'TB' | 'NEG') });
    toast.success(`Data ${d.uuid} disimpan`);
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={save} className="grid gap-5">
          <DialogHeader>
            <DialogTitle>Edit Data Batuk</DialogTitle>
            <DialogDescription>UUID {d.uuid} · {fmt.dateTime(d.time)}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2 sm:col-span-2"><Label htmlFor="eName">Nama lengkap</Label><Input id="eName" value={name} onChange={(e) => setName(e.target.value)} placeholder="Isi jika individu sudah diidentifikasi" /></div>
            <div className="grid gap-2">
              <Label>Gender</Label>
              <Select value={gender} onValueChange={setGender}><SelectTrigger aria-label="Gender"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="x">Belum diketahui</SelectItem><SelectItem value="L">Laki-laki</SelectItem><SelectItem value="P">Perempuan</SelectItem></SelectContent></Select>
            </div>
            <div className="grid gap-2"><Label htmlFor="eAge">Umur</Label><Input id="eAge" type="number" min={0} max={120} value={age} onChange={(e) => setAge(e.target.value)} /></div>
            <div className="grid gap-2 sm:col-span-2">
              <Label>Type</Label>
              <RadioGroup value={type} onValueChange={(v) => setType(v as 'Batuk' | '-')} className="flex gap-6">
                <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="Batuk" />Batuk</label>
                <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="-" />Bukan batuk</label>
              </RadioGroup>
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label>Label verifikasi tenaga kesehatan</Label>
              <Select value={verified} onValueChange={setVerified}><SelectTrigger aria-label="Label verifikasi"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="none">Belum diverifikasi</SelectItem><SelectItem value="TB">TB (terkonfirmasi)</SelectItem><SelectItem value="NEG">Bukan TB</SelectItem></SelectContent></Select>
              <p className="text-xs text-muted-foreground">Dipakai untuk continuous learning model.</p>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
            <Button type="submit">Simpan</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
