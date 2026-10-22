'use client';

import * as React from 'react';
import { TrashIcon } from '@radix-ui/react-icons';
import { AppLayout } from '@/components/layout/AppLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { OrchestraRouterVisualizer } from '@/components/orchestra/OrchestraRouterVisualizer';
import { ExecutionTracePanel } from '@/components/orchestra/ExecutionTracePanel';
import { AgentBuilderDialog } from '@/components/orchestra/AgentBuilderDialog';
import { CommercializationMatrix } from '@/components/orchestra/CommercializationMatrix';
import { useSwarmPlayer } from '@/components/orchestra/useSwarmPlayer';
import { DEFAULT_AGENTS, deleteCustomAgent, loadAgents, toggleAgentStatus, type SubAgent } from '@/lib/agent/orchestrator';

export default function OrchestraView() {
  const [agents, setAgents] = React.useState<SubAgent[]>(DEFAULT_AGENTS);
  const [confirm, setConfirm] = React.useState<string | null>(null);
  // registry kustom hanya ada di browser (localStorage)
  // eslint-disable-next-line react-hooks/set-state-in-effect -- memuat registry dari localStorage setelah mount
  React.useEffect(() => { setAgents(loadAgents()); }, []);
  const refresh = () => setAgents(loadAgents());
  const player = useSwarmPlayer(agents);
  const live = agents.filter((a) => a.status !== 'disabled').length;

  return (
    <AppLayout crumbs={[{ label: 'Orchestra AI' }]}>
      <div className="intro-y mb-5 mt-4">
        <h1 className="text-xl font-semibold text-foreground sm:text-2xl">TB Guard Orchestra AI</h1>
        <p className="mt-1 text-sm text-muted-foreground">Hierarchical Multi-Agent Swarm with Dynamic DAG Routing &amp; Dual-Layer Execution</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge>Swarm Engine Active</Badge>
          <Badge variant="outline">{live} dari {agents.length} spesialis aktif</Badge>
          <Badge variant="outline">Zero-Latency Visual Actuator</Badge>
        </div>
      </div>

      <Tabs defaultValue="canvas">
        <TabsList className="grid w-full max-w-xl grid-cols-3">
          <TabsTrigger value="canvas">Live Swarm Canvas</TabsTrigger>
          <TabsTrigger value="registry">Agent Registry</TabsTrigger>
          <TabsTrigger value="business">Business &amp; ROI</TabsTrigger>
        </TabsList>

        <TabsContent value="canvas" className="mt-5">
          <div className="grid gap-5 xl:grid-cols-5">
            <div className="xl:col-span-3"><OrchestraRouterVisualizer agents={agents} player={player} /></div>
            <div className="xl:col-span-2"><ExecutionTracePanel steps={player.steps} agents={agents} /></div>
          </div>
        </TabsContent>

        <TabsContent value="registry" className="mt-5">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <p className="text-sm text-muted-foreground">Aktifkan atau nonaktifkan spesialis; yang nonaktif dilewati oleh router.</p>
            <div className="ml-auto"><AgentBuilderDialog onCreated={refresh} /></div>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {agents.map((a) => (
              <div key={a.id} className="box p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">{a.name}</span>
                      {a.isCustom && <Badge variant="outline" className="text-[10px]">Kustom</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground">{a.role}</div>
                  </div>
                  <Switch checked={a.status !== 'disabled'} onCheckedChange={() => { toggleAgentStatus(a.id); refresh(); }} aria-label={`Aktifkan ${a.name}`} />
                  {a.isCustom && (confirm === a.id ? (
                    <span className="flex items-center gap-1 text-xs">
                      <button type="button" className="font-medium text-danger hover:underline" onClick={() => { deleteCustomAgent(a.id); setConfirm(null); refresh(); }}>Hapus</button>
                      <button type="button" className="text-muted-foreground hover:underline" onClick={() => setConfirm(null)}>Batal</button>
                    </span>
                  ) : (
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setConfirm(a.id)} aria-label={`Hapus ${a.name}`}><TrashIcon className="text-danger" /></Button>
                  ))}
                </div>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{a.description}</p>
                <div className="mt-3 flex flex-wrap gap-1">
                  {a.tools.map((t) => <Badge key={t} variant="outline" className="font-mono text-[10px]">{t}</Badge>)}
                </div>
                <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                  <div><div className="text-sm font-semibold tabular-nums text-foreground">{a.metrics.totalRuns.toLocaleString('id-ID')}</div><div className="text-[10px] text-muted-foreground">Total run</div></div>
                  <div><div className="text-sm font-semibold tabular-nums text-foreground">{a.metrics.successRate}%</div><div className="text-[10px] text-muted-foreground">Sukses</div></div>
                  <div><div className="text-sm font-semibold tabular-nums text-foreground">{a.metrics.avgLatencyMs} ms</div><div className="text-[10px] text-muted-foreground">Rata-rata latensi</div></div>
                </div>
                <Progress value={a.metrics.successRate} className="mt-3 h-1.5" aria-label={`Tingkat sukses ${a.name}`} />
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">Metrik contoh untuk demo. Agen kustom tersimpan di browser ini (localStorage).</p>
        </TabsContent>

        <TabsContent value="business" className="mt-5"><CommercializationMatrix /></TabsContent>
      </Tabs>
    </AppLayout>
  );
}
