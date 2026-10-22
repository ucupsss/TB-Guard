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
import { useSwarmPlayer } from '@/components/orchestra/useSwarmPlayer';
import { useLiveSwarm } from '@/components/orchestra/useLiveSwarm';
import { OrchestraWorkflowBar } from '@/components/orchestra/OrchestraWorkflowBar';
import { OrchestraRunHistory } from '@/components/orchestra/OrchestraRunHistory';
import { saveRun } from '@/lib/agent/orchestra-runs';
import { DEFAULT_AGENTS, deleteCustomAgent, loadAgents, toggleAgentStatus, type SubAgent } from '@/lib/agent/orchestrator';

export default function OrchestraView() {
  const [agents, setAgents] = React.useState<SubAgent[]>(DEFAULT_AGENTS);
  const [confirm, setConfirm] = React.useState<string | null>(null);
  // registry kustom hanya ada di browser (localStorage)
  // eslint-disable-next-line react-hooks/set-state-in-effect -- memuat registry dari localStorage setelah mount
  React.useEffect(() => { setAgents(loadAgents()); }, []);
  const refresh = () => setAgents(loadAgents());
  const player = useSwarmPlayer(agents);
  const chatLive = useLiveSwarm(agents);
  // chat agen yang sedang/baru berjalan menggantikan simulasi di kanvas (kecuali simulasi sedang diputar)
  const liveOn = chatLive.active && !player.running;
  const view = liveOn ? { ...player, steps: chatLive.steps, running: chatLive.running, cursor: chatLive.cursor, done: chatLive.done } : player;
  const activeStep: 1 | 2 | 3 | 4 | undefined = !liveOn ? undefined
    : !chatLive.running ? 4
    : chatLive.steps.some((s) => s.toolCalled) ? 3
    : chatLive.steps[0]?.status === 'completed' ? 2 : 1;
  const live = agents.filter((a) => a.status !== 'disabled').length;
  const [tab, setTab] = React.useState('canvas');
  // simulasi yang selesai dijalankan juga disimpan ke database agar bisa dibaca ulang seperti percakapan
  const wasRunning = React.useRef(false);
  React.useEffect(() => {
    const finished = wasRunning.current && !player.running && player.done === player.steps.length && player.steps.length > 0;
    wasRunning.current = player.running;
    if (!finished) return;
    const ok = player.steps.filter((x) => !x.skipped);
    void saveRun(`sim-${player.scenario.id}-${Date.now().toString(36)}`, {
      source: 'simulation', scenario: player.scenario.title, prompt: player.scenario.intent, steps: player.steps,
      totalMs: ok.reduce((n, x) => n + x.latencyMs, 0), tokens: ok.reduce((n, x) => n + x.tokensUsed, 0),
    });
  }, [player.running]); // eslint-disable-line react-hooks/exhaustive-deps
  // chat yang baru berjalan selalu mengambil alih kanvas: pindah ke tab kanvas dan hentikan simulasi
  const chatRunning = chatLive.running;
  // eslint-disable-next-line react-hooks/set-state-in-effect -- bereaksi pada awal chat dari panel agen
  React.useEffect(() => { if (chatRunning) { setTab('canvas'); player.reset(); } }, [chatRunning]); // eslint-disable-line react-hooks/exhaustive-deps

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

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full max-w-lg grid-cols-3">
          <TabsTrigger value="canvas">Live Swarm Canvas</TabsTrigger>
          <TabsTrigger value="registry">Agent Registry</TabsTrigger>
          <TabsTrigger value="history">Riwayat</TabsTrigger>
        </TabsList>

        <TabsContent value="canvas" className="mt-5 grid gap-5">
          <OrchestraWorkflowBar activeStep={activeStep} />
          <div className="grid gap-5 xl:grid-cols-5">
            <div className="xl:col-span-3"><OrchestraRouterVisualizer agents={agents} player={view} live={liveOn} onExitLive={chatLive.clear} /></div>
            <div className="xl:col-span-2"><ExecutionTracePanel steps={view.steps} agents={agents} /></div>
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
        <TabsContent value="history" className="mt-5"><OrchestraRunHistory agents={agents} /></TabsContent>
      </Tabs>
    </AppLayout>
  );
}
