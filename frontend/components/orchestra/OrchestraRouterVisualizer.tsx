'use client';

import * as React from 'react';
import { ActivityLogIcon, BarChartIcon, CheckCircledIcon, GearIcon, MixerHorizontalIcon, PlayIcon, ResetIcon, TargetIcon, VideoIcon } from '@radix-ui/react-icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import type { AgentIcon, SubAgent } from '@/lib/agent/orchestrator';
import type { SwarmPlayer } from './useSwarmPlayer';

const ICONS: Record<AgentIcon, React.ComponentType<{ className?: string }>> = {
  video: VideoIcon, activity: ActivityLogIcon, target: TargetIcon, 'bar-chart': BarChartIcon, gear: GearIcon,
};

interface Point { x: number; y: number }
type NodeState = 'idle' | 'routing' | 'completed' | 'off';

/** Kanvas router multi-agent: orchestrator di atas, sub-agen di bawah, kabel bezier SVG dengan partikel data yang mengalir. */
export function OrchestraRouterVisualizer({ agents, player }: { agents: SubAgent[]; player: SwarmPlayer }) {
  const box = React.useRef<HTMLDivElement>(null);
  const hub = React.useRef<HTMLDivElement>(null);
  const nodes = React.useRef(new Map<string, HTMLDivElement>());
  const [paths, setPaths] = React.useState<{ id: string; d: string }[]>([]);

  const running = player.cursor >= 0 ? player.steps[player.cursor] : null;
  const completedAgents = new Set(player.steps.filter((s) => s.status === 'completed' && !s.skipped).flatMap((s) => [s.agentId, s.targetAgentId].filter(Boolean) as string[]));
  const routedTo = running ? (running.agentId === 'orchestrator' ? running.targetAgentId : running.agentId) : undefined;

  const measure = React.useCallback(() => {
    const c = box.current, h = hub.current;
    if (!c || !h) return;
    const cb = c.getBoundingClientRect(), hb = h.getBoundingClientRect();
    const from: Point = { x: hb.left - cb.left + hb.width / 2, y: hb.bottom - cb.top };
    const next: { id: string; d: string }[] = [];
    nodes.current.forEach((el, id) => {
      const b = el.getBoundingClientRect();
      const to: Point = { x: b.left - cb.left + b.width / 2, y: b.top - cb.top };
      const dy = Math.max(36, (to.y - from.y) * 0.55);
      next.push({ id, d: `M ${from.x} ${from.y} C ${from.x} ${from.y + dy}, ${to.x} ${to.y - dy}, ${to.x} ${to.y}` });
    });
    setPaths(next);
  }, []);

  React.useLayoutEffect(() => {
    measure();
    const ro = new ResizeObserver(measure);
    if (box.current) ro.observe(box.current);
    return () => ro.disconnect();
  }, [measure, agents.length]);

  const stateOf = (a: SubAgent): NodeState => (a.status === 'disabled' ? 'off' : routedTo === a.id ? 'routing' : completedAgents.has(a.id) ? 'completed' : 'idle');
  const hubState: NodeState = running?.agentId === 'orchestrator' ? 'routing' : player.done === player.steps.length && player.done > 0 ? 'completed' : player.running ? 'idle' : 'idle';
  const pct = player.steps.length ? Math.round((player.done / player.steps.length) * 100) : 0;

  return (
    <div className="box p-4 sm:p-5">
      {/* kontrol pemutar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-md border p-0.5" role="group" aria-label="Skenario demo">
          {player.scenarios.map((s) => (
            <button key={s.id} type="button" onClick={() => player.select(s.id)} aria-pressed={s.id === player.scenario.id}
              className={cn('rounded px-3 py-1.5 text-xs font-medium transition-colors', s.id === player.scenario.id ? 'bg-primary text-white' : 'text-muted-foreground hover:text-foreground')}>
              {s.id}. {s.short}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" onClick={player.start} disabled={player.running}><PlayIcon />Mulai simulasi multi-agent</Button>
          <Button size="sm" variant="outline" onClick={player.reset}><ResetIcon />Reset</Button>
        </div>
      </div>

      <p className="mt-3 text-sm text-foreground"><span className="text-muted-foreground">Intent: </span>&ldquo;{player.scenario.intent}&rdquo;</p>
      <div className="mt-2 flex items-center gap-3">
        <Progress value={pct} className="h-1.5 flex-1" aria-label="Progres langkah" />
        <span className="text-xs tabular-nums text-muted-foreground">Langkah {Math.min(player.done + (running ? 1 : 0), player.steps.length)}/{player.steps.length}</span>
      </div>

      {/* kanvas */}
      <div ref={box} className="relative mt-6">
        <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
          {paths.map((p) => {
            const active = routedTo === p.id;
            return (
              <g key={p.id}>
                <path id={`route-${p.id}`} d={p.d} fill="none" strokeWidth={2} className="stroke-slate-200 dark:stroke-slate-700" />
                {active && (
                  <>
                    <path d={p.d} fill="none" strokeWidth={2.5} strokeLinecap="round" strokeDasharray="7 9" className="stroke-primary dark:stroke-blue-400">
                      <animate attributeName="stroke-dashoffset" from="32" to="0" dur="0.9s" repeatCount="indefinite" />
                    </path>
                    {[0, 0.4, 0.8].map((delay) => (
                      <circle key={delay} r={4.5} className="fill-primary dark:fill-blue-400">
                        <animateMotion dur="1.2s" begin={`${delay}s`} repeatCount="indefinite"><mpath href={`#route-${p.id}`} /></animateMotion>
                      </circle>
                    ))}
                  </>
                )}
              </g>
            );
          })}
        </svg>

        {/* hub orchestrator */}
        <div className="relative z-10 flex justify-center">
          <div ref={hub} className={cn('relative w-72 rounded-xl border bg-card p-4 text-center transition-shadow', hubState === 'routing' && 'ring-4 ring-primary/20')}>
            {hubState === 'routing' && <span className="absolute inset-0 animate-pulse rounded-xl border-2 border-primary/40" aria-hidden />}
            <span className="mx-auto grid h-11 w-11 place-items-center rounded-lg bg-primary text-white"><MixerHorizontalIcon className="h-5 w-5" /></span>
            <div className="mt-2 text-sm font-semibold text-foreground">Master Orchestrator</div>
            <div className="text-[10px] font-medium tracking-wider text-muted-foreground">INTENT ROUTER & DAG PLANNER</div>
            <Badge variant={hubState === 'routing' ? 'default' : 'outline'} className="mt-2">{hubState === 'routing' ? 'ROUTING...' : hubState === 'completed' ? 'COMPLETED' : 'SIAGA'}</Badge>
          </div>
        </div>

        {/* sub-agen */}
        <div className="relative z-10 mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-4">
          {agents.map((a) => {
            const st = stateOf(a), Icon = ICONS[a.icon] ?? GearIcon;
            const tool = running && running.agentId === a.id && !running.skipped ? running.toolCalled : undefined;
            return (
              <div key={a.id} ref={(el) => { if (el) nodes.current.set(a.id, el); else nodes.current.delete(a.id); }}
                className={cn('relative rounded-xl border bg-card p-4 transition-all', st === 'routing' && 'ring-4 ring-primary/20', st === 'off' && 'opacity-55')}>
                {st === 'routing' && <span className="absolute inset-0 animate-pulse rounded-xl border-2 border-primary/40" aria-hidden />}
                <div className="flex items-start gap-3">
                  <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-lg', st === 'routing' ? 'bg-primary text-white' : 'bg-primary/10 text-primary')}><Icon className="h-4 w-4" /></span>
                  <div className="min-w-0">
                    <div className="break-words text-sm font-medium leading-snug text-foreground">{a.name}</div>
                    <div className="line-clamp-2 break-words text-xs text-muted-foreground">{a.role}</div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <Badge variant={st === 'routing' ? 'default' : st === 'completed' ? 'secondary' : 'outline'} className="gap-1 text-[10px]">
                    {st === 'completed' && <CheckCircledIcon className="h-3 w-3" />}
                    {st === 'routing' ? 'ROUTING...' : st === 'completed' ? 'COMPLETED' : st === 'off' ? 'NONAKTIF' : a.status === 'standby' ? 'STANDBY' : 'ACTIVE'}
                  </Badge>
                  {tool && <Badge variant="outline" className="font-mono text-[10px]">{tool}</Badge>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <p className="mt-4 text-[11px] text-muted-foreground">Mode simulasi terskrip untuk demo alur orkestrasi. Angka pada skenario bersifat ilustratif.</p>
    </div>
  );
}
