'use client';

import * as React from 'react';
import {
  BrainCircuit,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Send,
  Stethoscope,
  Activity,
  Layers,
  FileCheck2,
  ShieldCheck,
} from '@/components/ui/icons';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  fetchAIModelStatus,
  fetchAITriage,
  askAIConsult,
  type AIModelStatus,
  type AITriageResult,
  type AIChatMessage,
} from '@/lib/ai-service';
import type { Detection, Device } from '@/lib/types';
import { cn } from '@/lib/utils';

export function AiClinicalCopilot({ d, dev }: { d: Detection; dev: Device }) {
  const [modelStatus, setModelStatus] = React.useState<AIModelStatus | null>(null);
  const [triage, setTriage] = React.useState<AITriageResult | null>(null);
  const [loading, setLoading] = React.useState(true);

  // Chat state
  const [messages, setMessages] = React.useState<AIChatMessage[]>([]);
  const [input, setInput] = React.useState('');
  const [chatLoading, setChatLoading] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    async function loadData() {
      setLoading(true);
      try {
        const [mStatus, tRes] = await Promise.all([
          fetchAIModelStatus(),
          fetchAITriage({
            uuid: d.uuid,
            result: d.result,
            confidence: d.confidence,
            coughs: d.coughs,
            patient_name: d.name,
            age: d.age,
            gender: d.gender,
            location: dev.location,
            zone: dev.zone,
            doa_azimuth: d.doa.azimuth,
            crowd_level: d.person.crowd,
          }),
        ]);
        if (alive) {
          setModelStatus(mStatus);
          setTriage(tRes);
        }
      } catch (e) {
        console.error('Failed to load AI triage data', e);
      } finally {
        if (alive) setLoading(false);
      }
    }
    loadData();
    return () => {
      alive = false;
    };
  }, [d.uuid, d.confidence, d.result, d.coughs, d.name, d.age, d.gender, dev.location, dev.zone, d.doa.azimuth, d.person.crowd]);

  const handleSend = async (textToSend?: string) => {
    const question = (textToSend || input).trim();
    if (!question || chatLoading) return;

    const userMsg: AIChatMessage = {
      id: `u-${Date.now()}`,
      sender: 'user',
      text: question,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInput('');
    setChatLoading(true);

    try {
      const res = await askAIConsult(d.uuid, question, {
        result: d.result,
        confidence: d.confidence,
        location: dev.location,
        zone: dev.zone,
        name: d.name,
      });

      const aiMsg: AIChatMessage = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: res.reply,
        timestamp: Date.now(),
        citations: res.citations,
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch {
      const errorMsg: AIChatMessage = {
        id: `err-${Date.now()}`,
        sender: 'ai',
        text: 'Maaf, terjadi kendala saat memproses pertanyaan klinis. Silakan coba kembali.',
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setChatLoading(false);
    }
  };

  const isTb = d.result === 'TB';

  return (
    <div className="intro-y box col-span-12 overflow-hidden border border-primary/20 bg-gradient-to-b from-blue-50/50 to-white p-5 shadow-sm dark:from-slate-900 dark:to-slate-950">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/70 pb-4 dark:border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-white shadow-sm">
            <BrainCircuit className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-slate-800 dark:text-slate-100">
                TB-Guard AI Copilot & Clinical Triage
              </h3>
              <Badge variant="soft-primary" className="gap-1 text-xs font-medium">
                <Sparkles className="h-3 w-3 text-primary" /> LLM
              </Badge>
            </div>
          </div>
        </div>

        {/* Model status chips */}
        {modelStatus && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
              <Layers className="h-3.5 w-3.5 text-blue-600" />
              <span>Model: <strong>MobileNetV3 (Colab)</strong></span>
            </div>
            <div className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
              <Activity className="h-3.5 w-3.5 text-emerald-600" />
              <span>Val F1: <strong>{(modelStatus.metrics.val_f1_tb * 100).toFixed(1)}%</strong></span>
            </div>
            <div className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
              <ShieldCheck className="h-3.5 w-3.5 text-indigo-600" />
              <span>ROC-AUC: <strong>{(modelStatus.metrics.roc_auc * 100).toFixed(1)}%</strong></span>
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div role="status" aria-label="Menganalisis" className="mt-5 grid grid-cols-12 gap-5">
          <div className="col-span-12 space-y-4 lg:col-span-7">
            <Skeleton className="h-36 w-full rounded-lg" />
            <Skeleton className="h-28 w-full rounded-lg" />
          </div>
          <div className="col-span-12 space-y-3 lg:col-span-5">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-40 w-full rounded-lg" />
            <Skeleton className="h-9 w-full" />
          </div>
        </div>
      ) : triage ? (
        <div className="mt-5 grid grid-cols-12 gap-5">
          {/* Main Clinical Triage Summary */}
          <div className="col-span-12 lg:col-span-7 space-y-4">
            <div
              className={cn(
                'rounded-lg border p-4 transition-all',
                triage.triage_level === 'HIGH_PRIORITY'
                  ? 'border-red-200 bg-red-50/70 dark:border-red-900/50 dark:bg-red-950/20'
                  : triage.triage_level === 'MODERATE_RISK'
                  ? 'border-amber-200 bg-amber-50/70 dark:border-amber-900/50 dark:bg-amber-950/20'
                  : 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/50 dark:bg-emerald-950/20'
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {triage.triage_level === 'HIGH_PRIORITY' ? (
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                  ) : (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  )}
                  <span className="font-semibold text-sm sm:text-base text-slate-900 dark:text-slate-100">
                    {triage.priority_label}
                  </span>
                </div>
                <Badge
                  variant={isTb ? 'destructive' : 'success'}
                  className="text-xs uppercase"
                >
                  Risiko Transmisi: {triage.infection_control_risk}
                </Badge>
              </div>

              <p className="mt-3 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                {triage.clinical_reasoning}
              </p>
            </div>

            {/* Acoustic Insights */}
            <div className="rounded-lg border border-slate-200/80 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/60">
              <div className="mb-2.5 flex items-center gap-2 font-medium text-xs uppercase tracking-wider text-muted-foreground">
                <Activity className="h-4 w-4 text-primary" /> Temuan Analisis Akustik Model CWT
              </div>
              <ul className="space-y-1.5 text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                {triage.acoustic_insights.map((insight, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />
                    <span>{insight}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* WHO Guideline Next Steps */}
            <div className="rounded-lg border border-slate-200/80 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/60">
              <div className="mb-2.5 flex items-center gap-2 font-medium text-xs uppercase tracking-wider text-muted-foreground">
                <FileCheck2 className="h-4 w-4 text-emerald-600" /> Rekomendasi Tindak Lanjut Protokol WHO
              </div>
              <div className="space-y-2">
                {triage.who_recommended_actions.map((act, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2.5 rounded-md bg-slate-50 p-2 text-xs sm:text-sm text-slate-700 dark:bg-slate-800/50 dark:text-slate-200"
                  >
                    <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 font-bold text-xs text-primary">
                      {idx + 1}
                    </span>
                    <span>{act}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Interactive AI Chat & Consultation Assistant */}
          <div className="col-span-12 lg:col-span-5 flex flex-col rounded-lg border border-slate-200/80 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/60">
            <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-2.5 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Stethoscope className="h-4 w-4 text-primary" />
                <span className="font-semibold text-sm">Konsultasi AI Klinis</span>
              </div>
              <span className="text-[11px] text-muted-foreground">Model Asisten TB</span>
            </div>

            {/* Quick Prompt Pills */}
            <div className="mb-3 flex flex-wrap gap-1.5">
              {[
                'Risiko penularan di ruangan?',
                'Apakah perlu rujukan TCM?',
                'Jelaskan fitur akustik CWT',
              ].map((pill) => (
                <button
                  key={pill}
                  onClick={() => handleSend(pill)}
                  disabled={chatLoading}
                  className="rounded-full border border-primary/20 bg-primary/5 px-2.5 py-1 text-[11px] font-medium text-primary hover:bg-primary/10 transition-colors disabled:opacity-50 text-left"
                >
                  {pill}
                </button>
              ))}
            </div>

            {/* Message Thread */}
            <div className="flex-1 space-y-3 overflow-y-auto max-h-[280px] pr-1 text-xs">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                  <BrainCircuit className="h-8 w-8 text-slate-300 mb-2" />
                  <p>Tanya AI Copilot</p>
                </div>
              ) : (
                messages.map((m) => (
                  <div
                    key={m.id}
                    className={cn(
                      'rounded-lg p-3 leading-relaxed',
                      m.sender === 'user'
                        ? 'ml-auto max-w-[85%] bg-primary text-white'
                        : 'mr-auto max-w-[95%] bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100'
                    )}
                  >
                    <p>{m.text}</p>
                    {m.citations && m.citations.length > 0 && (
                      <div className="mt-2 border-t border-slate-200/50 pt-1 text-[10px] opacity-80 dark:border-white/10">
                        <strong>Rujukan:</strong> {m.citations.join(', ')}
                      </div>
                    )}
                  </div>
                ))
              )}
              {chatLoading && (
                <div role="status" aria-label="AI menjawab" className="mr-auto w-4/5 space-y-2 py-2">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
              )}
            </div>

            {/* Chat Input */}
            <div className="mt-3 flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <Input
                placeholder="Ketik pertanyaan untuk AI Dokter..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSend();
                }}
                disabled={chatLoading}
                className="text-xs h-9"
              />
              <Button
                size="sm"
                onClick={() => handleSend()}
                disabled={chatLoading || !input.trim()}
                className="h-9 px-3"
              >
                <Send className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Scientific disclaimer footer */}
      <div className="mt-4 border-t border-slate-200/60 pt-3 text-center text-[11px] text-muted-foreground dark:border-white/10">
        <span title="Prototipe produk. Skor akustik & triase AI tidak menggantikan diagnosis dokter maupun TCM / GeneXpert.">🔬 Bukan diagnosis medis</span>
      </div>
    </div>
  );
}
