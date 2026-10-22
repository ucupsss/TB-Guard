'use client';

import * as React from 'react';
import { subscribeSwarm, swarmLog, type StampedEvent } from '@/lib/agent/swarm-bus';
import type { ExecutionStep, SubAgent } from '@/lib/agent/orchestrator';

export interface LiveState {
  steps: ExecutionStep[];
  running: boolean;
  totalMs?: number;
  tokens?: number;
}

const EMPTY: LiveState = { steps: [], running: false };
const clip = (v: unknown, n = 320) => { const s = typeof v === 'string' ? v : JSON.stringify(v); return s.length > n ? s.slice(0, n - 3) + '...' : s; };

/** Reducer murni: satu peristiwa chat menjadi perubahan pada daftar langkah live. */
export function applyLive(state: LiveState, { event: e, at }: StampedEvent, agents: SubAgent[]): LiveState {
  const name = (id?: string) => (id ? agents.find((a) => a.id === id)?.name ?? id : '');
  const startOf = (s: ExecutionStep) => Number(s.id.split('@')[1] ?? at);
  switch (e.type) {
    case 'chat:reset': return EMPTY;
    case 'chat:start':
      return {
        running: true,
        steps: [{ id: `live0@${at}`, agentId: 'orchestrator', title: 'Menerima intent', action: 'Orchestrator menerima pesan dari chat dan memilih rute.', inputData: clip(e.prompt), outputData: '', latencyMs: 0, tokensUsed: 0, status: 'running' }],
      };
    case 'chat:routing': {
      const steps = state.steps.map((s, i) => (i === 0 ? { ...s, status: 'completed' as const, latencyMs: at - startOf(s), targetAgentId: e.targetAgentId, title: 'Rute dipilih', outputData: `intent: ${clip(e.intent, 120)}\nrute: ${e.targetAgentId ? name(e.targetAgentId) : 'dijawab langsung'}` } : s));
      return { ...state, steps };
    }
    case 'chat:tool_call': {
      const step: ExecutionStep = {
        id: `live${state.steps.length}@${at}`, agentId: e.agentId, title: `Panggil ${e.toolName}`,
        action: `${name(e.agentId) || 'Orchestrator'} menjalankan tool nyata dari chat.`, toolCalled: e.toolName,
        inputData: clip(e.args), outputData: '', latencyMs: 0, tokensUsed: 0, status: 'running',
      };
      return { ...state, running: true, steps: [...state.steps, step] };
    }
    case 'chat:tool_done': {
      let idx = -1;
      state.steps.forEach((s, i) => { if (s.status === 'running' && s.toolCalled === e.toolName && s.agentId === e.agentId) idx = i; });
      if (idx < 0) return state;
      const steps = state.steps.map((s, i) => (i === idx ? { ...s, status: 'completed' as const, latencyMs: e.latencyMs, outputData: e.ok ? 'ok: tool selesai' : 'error: tool gagal atau ditolak' } : s));
      return { ...state, steps };
    }
    case 'chat:done': {
      const steps: ExecutionStep[] = state.steps.map((s, i) => (s.status === 'running'
        ? { ...s, status: 'completed' as const, latencyMs: s.latencyMs || at - startOf(s), outputData: s.outputData || (i === 0 ? 'intent dijawab langsung oleh model' : 'selesai') }
        : s));
      steps.push({
        id: `live${steps.length}@${at}`, agentId: 'orchestrator', title: 'Jawaban selesai',
        action: `Agen aktif: ${e.activeAgents.length ? e.activeAgents.map(name).join(', ') : 'orchestrator'}.`,
        inputData: `${steps.filter((s) => s.toolCalled).length} tool dipanggil`, outputData: 'jawaban dikirim ke chat',
        latencyMs: e.totalMs, tokensUsed: e.tokens ?? 0, status: 'completed',
      });
      return { steps, running: false, totalMs: e.totalMs, tokens: e.tokens };
    }
  }
}

/** Mendengarkan chat agen dan menyusun jejak eksekusi live (memutar ulang peristiwa yang sudah terjadi saat dibuka). */
export function useLiveSwarm(agents: SubAgent[]) {
  const agentsRef = React.useRef(agents);
  React.useEffect(() => { agentsRef.current = agents; });
  const [state, setState] = React.useState<LiveState>(EMPTY);

  React.useEffect(() => {
    setState(swarmLog().reduce((s, ev) => applyLive(s, ev, agentsRef.current), EMPTY));
    return subscribeSwarm((ev) => setState((s) => applyLive(s, ev, agentsRef.current)));
  }, []);

  const cursor = state.steps.reduce((c, s, i) => (s.status === 'running' ? i : c), -1);
  return {
    ...state,
    active: state.steps.length > 0,
    cursor,
    done: state.steps.filter((s) => s.status === 'completed').length,
    clear: () => setState(EMPTY),
  };
}
