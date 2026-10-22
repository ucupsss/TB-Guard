'use client';

import * as React from 'react';
import { ClockIcon, CodeIcon, InfoCircledIcon, LayersIcon } from '@radix-ui/react-icons';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { executionLayer, type ExecutionStep, type SubAgent } from '@/lib/agent/orchestrator';

const LAYER = {
  database: { label: 'Database', detail: 'Go API + PostgreSQL + audit log', tone: 'border-primary/40 text-primary' },
  actuator: { label: 'Aktuator UI', detail: 'instan di browser, tanpa latensi jaringan', tone: 'border-success/40 text-success' },
  read: { label: 'Baca', detail: 'query ke backend', tone: 'border-border text-muted-foreground' },
  none: { label: 'Router', detail: 'perencanaan DAG', tone: 'border-border text-muted-foreground' },
} as const;

function Step({ step, agents }: { step: ExecutionStep; agents: SubAgent[] }) {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => { if (step.status === 'running') ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, [step.status]);
  const who = step.agentId === 'orchestrator' ? 'Orchestrator' : agents.find((a) => a.id === step.agentId)?.name ?? step.agentId;
  const target = step.targetAgentId ? agents.find((a) => a.id === step.targetAgentId)?.name : undefined;
  const layer = LAYER[executionLayer(step.toolCalled)];
  const shown = step.status !== 'pending';
  return (
    <div ref={ref} className={cn('rounded-lg border p-3 transition-opacity', step.status === 'running' && 'border-primary ring-2 ring-primary/15', !shown && 'opacity-45')}>
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant={step.status === 'running' ? 'default' : 'outline'} className="text-[10px]">{who}</Badge>
        {target && <span className="text-xs text-muted-foreground">ke {target}</span>}
        <span className="ml-auto flex items-center gap-1 text-[11px] tabular-nums text-muted-foreground"><ClockIcon className="h-3 w-3" />{step.latencyMs} ms &middot; {step.tokensUsed} tok</span>
      </div>
      <div className="mt-1.5 text-sm font-medium text-foreground">{step.title}</div>
      <p className="mt-0.5 text-xs text-muted-foreground">{step.action}</p>

      {step.toolCalled && !step.skipped && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className="gap-1 font-mono text-[10px]"><CodeIcon className="h-3 w-3" />{step.toolCalled}</Badge>
          <Badge variant="outline" className={cn('text-[10px]', layer.tone)} title={layer.detail}>{layer.label}</Badge>
        </div>
      )}

      {shown && (
        <div className="mt-2 grid gap-2">
          <div>
            <div className="mb-1 text-[10px] font-medium tracking-wide text-muted-foreground">INPUT</div>
            <pre className="max-h-32 overflow-auto rounded-md bg-slate-50 p-2 font-mono text-[11px] leading-snug text-foreground dark:bg-white/5">{step.inputData}</pre>
          </div>
          <div>
            <div className="mb-1 text-[10px] font-medium tracking-wide text-muted-foreground">{step.status === 'running' ? 'OUTPUT (memproses...)' : 'OUTPUT'}</div>
            <pre className="max-h-32 overflow-auto rounded-md bg-slate-50 p-2 font-mono text-[11px] leading-snug text-foreground dark:bg-white/5">{step.status === 'running' ? '...' : step.outputData}</pre>
          </div>
        </div>
      )}
    </div>
  );
}

/** Jejak eksekusi: siapa mengerjakan apa, tool yang dipanggil, data yang dioper antar agen, plus penjelasan dua lapis eksekusi. */
export function ExecutionTracePanel({ steps, agents }: { steps: ExecutionStep[]; agents: SubAgent[] }) {
  const tokens = steps.filter((s) => s.status === 'completed' && !s.skipped).reduce((n, s) => n + s.tokensUsed, 0);
  const latency = steps.filter((s) => s.status === 'completed' && !s.skipped).reduce((n, s) => n + s.latencyMs, 0);
  return (
    <div className="box flex h-full flex-col p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <LayersIcon className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Live trace</h3>
        <span className="ml-auto text-[11px] tabular-nums text-muted-foreground">{latency} ms &middot; {tokens} tok</span>
      </div>

      <ScrollArea className="mt-3 h-[26rem] pr-3">
        <div className="grid gap-2.5">{steps.map((s) => <Step key={s.id} step={s} agents={agents} />)}</div>
      </ScrollArea>

      <div className="mt-3 flex gap-2 rounded-lg border bg-primary/5 p-3 text-xs leading-relaxed text-foreground">
        <InfoCircledIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
        <p><b>Dual-Execution Layer.</b> Mutasi data tercatat persisten ke Backend API dan database relasional dengan audit log, sedangkan kontrol UI browser (kamera 3D, filter tabel) dieksekusi instan tanpa latensi. Skenario di halaman ini adalah simulasi terskrip; agen chat menjalankan jalur yang sama secara sungguhan.</p>
      </div>
    </div>
  );
}
