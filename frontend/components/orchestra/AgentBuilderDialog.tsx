'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { MagicWandIcon, PlusIcon } from '@radix-ui/react-icons';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { ALL_TOOLS, autoGenerateAgentByAi, registerCustomAgent, type SubAgent } from '@/lib/agent/orchestrator';

/** Dialog tambah sub-agen: manual (persona + akses tool) atau otomatis dari deskripsi kebutuhan. */
export function AgentBuilderDialog({ onCreated }: { onCreated: (a: SubAgent) => void }) {
  const [open, setOpen] = React.useState(false);
  const [tab, setTab] = React.useState('manual');
  const [name, setName] = React.useState('');
  const [role, setRole] = React.useState('');
  const [desc, setDesc] = React.useState('');
  const [prompt, setPrompt] = React.useState('');
  const [tools, setTools] = React.useState<string[]>([]);
  const [need, setNeed] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [generated, setGenerated] = React.useState<SubAgent | null>(null);

  const reset = () => { setName(''); setRole(''); setDesc(''); setPrompt(''); setTools([]); setNeed(''); setGenerated(null); };
  const toggle = (t: string, on: boolean) => setTools((cur) => (on ? [...cur, t] : cur.filter((x) => x !== t)));

  const saveManual = () => {
    if (name.trim().length < 3) return toast.error('Nama sub-agent minimal 3 karakter.');
    if (!tools.length) return toast.error('Pilih minimal satu tool.');
    const agent = registerCustomAgent({
      id: '', name: name.trim(), role: role.trim() || 'Sub-agent kustom', description: desc.trim() || 'Sub-agent kustom.',
      systemPrompt: prompt.trim() || `Kamu ${name.trim()} pada TB Guard. Gunakan hanya tool yang diizinkan dan laporkan hasil nyata dari tool.`,
      icon: 'gear', status: 'active', tools, isCustom: true, metrics: { totalRuns: 0, successRate: 100, avgLatencyMs: 0 },
    });
    toast.success(`${agent.name} ditambahkan ke swarm.`);
    onCreated(agent); reset(); setOpen(false);
  };

  const generate = async () => {
    setBusy(true); setGenerated(null);
    try {
      const agent = await autoGenerateAgentByAi(need);
      setGenerated(agent);
      toast.success(`${agent.name} dibuat dan disimpan.`);
      onCreated(agent);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Gagal membuat agen.'); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild><Button><PlusIcon />Tambah sub-agent</Button></DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Tambah sub-agent ke swarm</DialogTitle>
          <DialogDescription>Rakit sendiri persona dan akses tool, atau biarkan AI menyusunnya dari deskripsi kebutuhan.</DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="manual">Manual</TabsTrigger>
            <TabsTrigger value="auto">Otomatis (AI)</TabsTrigger>
          </TabsList>

          <TabsContent value="manual" className="mt-4 grid gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5"><Label htmlFor="ag-name">Nama sub-agent</Label><Input id="ag-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="mis. Rujukan BPJS" /></div>
              <div className="grid gap-1.5"><Label htmlFor="ag-role">Role</Label><Input id="ag-role" value={role} onChange={(e) => setRole(e.target.value)} placeholder="mis. Spesialis administrasi" /></div>
            </div>
            <div className="grid gap-1.5"><Label htmlFor="ag-desc">Deskripsi</Label><Input id="ag-desc" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Apa tugas utamanya?" /></div>
            <div className="grid gap-1.5"><Label htmlFor="ag-prompt">System prompt / persona</Label><Textarea id="ag-prompt" rows={3} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Kamu spesialis ... Tugasmu ..." /></div>
            <div className="grid gap-1.5">
              <Label>Akses tool <span className="font-normal text-muted-foreground">({tools.length} dipilih)</span></Label>
              <ScrollArea className="h-40 rounded-md border p-2">
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {ALL_TOOLS.map((t) => (
                    <label key={t.name} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs hover:bg-black/5 dark:hover:bg-white/5">
                      <Checkbox checked={tools.includes(t.name)} onCheckedChange={(v) => toggle(t.name, v === true)} />
                      <span className="font-mono">{t.name}</span>
                      <Badge variant="outline" className="ml-auto text-[9px]">{t.kind}</Badge>
                    </label>
                  ))}
                </div>
              </ScrollArea>
            </div>
            <DialogFooter><Button onClick={saveManual}>Simpan sub-agent ke swarm</Button></DialogFooter>
          </TabsContent>

          <TabsContent value="auto" className="mt-4 grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="ag-need">Kebutuhan tugas agen</Label>
              <Textarea id="ag-need" rows={4} value={need} onChange={(e) => setNeed(e.target.value)}
                placeholder="Contoh: Buatkan agen khusus sinkronisasi data rekam medis BPJS P-Care dan pembuatan surat rujukan cepat" />
            </div>
            <Button onClick={generate} disabled={busy || need.trim().length < 8}><MagicWandIcon />{busy ? 'Menyusun agen...' : 'Generate agen via AI'}</Button>
            {generated && (
              <div className="rounded-lg border p-3 text-sm">
                <div className="font-medium text-foreground">{generated.name}</div>
                <p className="mt-1 text-xs text-muted-foreground">{generated.systemPrompt}</p>
                <div className="mt-2 flex flex-wrap gap-1">{generated.tools.map((t) => <Badge key={t} variant="outline" className="font-mono text-[10px]">{t}</Badge>)}</div>
              </div>
            )}
            <p className="text-[11px] text-muted-foreground">Penyusunan dijalankan secara lokal di browser dengan pencocokan kebutuhan ke toolset yang relevan; hasil tersimpan di registry.</p>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
