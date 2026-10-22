'use client';

import * as React from 'react';
import { SCENARIOS, type ExecutionStep, type Scenario, type SubAgent } from '@/lib/agent/orchestrator';

const STEP_MS = 1700;      // lama satu langkah ditampilkan sebagai "berjalan"
const SKIP_MS = 450;
const fresh = (s: Scenario): ExecutionStep[] => s.steps.map((x) => ({ ...x, status: 'pending', skipped: false }));

export interface SwarmPlayer {
  scenario: Scenario;
  scenarios: Scenario[];
  steps: ExecutionStep[];
  running: boolean;
  /** indeks langkah yang sedang berjalan (-1 bila tidak ada) */
  cursor: number;
  done: number;
  select: (id: Scenario['id']) => void;
  start: () => void;
  reset: () => void;
}

/** Pemutar skenario multi-agent: menjalankan langkah satu per satu dan melewati sub-agen yang dinonaktifkan. */
export function useSwarmPlayer(agents: SubAgent[]): SwarmPlayer {
  const [scenarioId, setScenarioId] = React.useState<Scenario['id']>('A');
  const scenario = SCENARIOS.find((s) => s.id === scenarioId) ?? SCENARIOS[0];
  const [steps, setSteps] = React.useState<ExecutionStep[]>(() => fresh(SCENARIOS[0]));
  const [running, setRunning] = React.useState(false);
  const [cursor, setCursor] = React.useState(-1);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const agentsRef = React.useRef(agents);
  React.useEffect(() => { agentsRef.current = agents; });
  React.useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const stop = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; };

  const runFrom = (list: ExecutionStep[], i: number) => {
    if (i >= list.length) { setRunning(false); setCursor(-1); return; }
    const st = list[i];
    const agent = st.agentId === 'orchestrator' ? null : agentsRef.current.find((a) => a.id === st.agentId);
    const off = st.agentId !== 'orchestrator' && (!agent || agent.status === 'disabled');
    setCursor(i);
    setSteps((cur) => cur.map((x, k) => (k === i ? { ...x, status: 'running', skipped: off } : x)));
    timer.current = setTimeout(() => {
      setSteps((cur) => cur.map((x, k) => (k === i ? { ...x, status: 'completed', skipped: off, ...(off ? { outputData: 'Dilewati: sub-agen nonaktif di registry.', toolCalled: undefined } : {}) } : x)));
      timer.current = setTimeout(() => runFrom(list, i + 1), 220);
    }, off ? SKIP_MS : STEP_MS);
  };

  const start = () => {
    stop();
    const list = fresh(scenario);
    setSteps(list);
    setRunning(true);
    runFrom(list, 0);
  };
  const reset = () => { stop(); setRunning(false); setCursor(-1); setSteps(fresh(scenario)); };
  const select = (id: Scenario['id']) => {
    stop(); setRunning(false); setCursor(-1);
    setScenarioId(id);
    setSteps(fresh(SCENARIOS.find((s) => s.id === id) ?? SCENARIOS[0]));
  };

  return { scenario, scenarios: SCENARIOS, steps, running, cursor, done: steps.filter((s) => s.status === 'completed').length, select, start, reset };
}
