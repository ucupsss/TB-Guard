'use client';

/* Perekam PCM mentah multi-kanal untuk GCC-PHAT. MediaRecorder (Opus) tidak dipakai di sini karena
   kompresi stereo-nya bisa merusak beda fase antar-kanal. AudioWorklet menyalin tiap blok 128 sampel
   dari semua kanal pada sample rate asli perangkat (biasanya 48 kHz, resolusi TDOA ~21 µs). */
import type { RawCapture } from './doa';

const WORKLET = `
class TbvRaw extends AudioWorkletProcessor {
  process(inputs) {
    const i = inputs[0];
    if (i && i.length) this.port.postMessage(i.map((c) => c.slice()));
    return true;
  }
}
registerProcessor('tbv-raw', TbvRaw);
`;

export class RawRecorder {
  private ctx: AudioContext;
  private node: AudioWorkletNode | null = null;
  private chunks: Float32Array[][] = [];
  private collecting = false;
  readonly reportedChannels: number;

  private constructor(ctx: AudioContext, reportedChannels: number) { this.ctx = ctx; this.reportedChannels = reportedChannels; }

  static async create(stream: MediaStream) {
    const ctx = new AudioContext();
    const reported = stream.getAudioTracks()[0]?.getSettings().channelCount ?? 1;
    const rec = new RawRecorder(ctx, reported);
    const url = URL.createObjectURL(new Blob([WORKLET], { type: 'application/javascript' }));
    try { await ctx.audioWorklet.addModule(url); } finally { URL.revokeObjectURL(url); }
    const src = ctx.createMediaStreamSource(stream);
    // 'discrete' supaya kanal tidak di-downmix; sumber mono → kanal kedua berisi nol
    const node = new AudioWorkletNode(ctx, 'tbv-raw', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1], channelCount: 2, channelCountMode: 'explicit', channelInterpretation: 'discrete' });
    node.port.onmessage = (e: MessageEvent<Float32Array[]>) => { if (rec.collecting) rec.chunks.push(e.data); };
    const mute = ctx.createGain(); mute.gain.value = 0;
    src.connect(node).connect(mute).connect(ctx.destination); // harus tersambung ke destination agar diproses
    rec.node = node;
    return rec;
  }

  begin() { this.chunks = []; this.collecting = true; if (this.ctx.state === 'suspended') void this.ctx.resume(); }

  end(): RawCapture {
    this.collecting = false;
    const nCh = Math.max(1, ...this.chunks.map((c) => c.length));
    const total = this.chunks.reduce((n, c) => n + (c[0]?.length ?? 0), 0);
    const channels = Array.from({ length: nCh }, () => new Float32Array(total));
    let off = 0;
    for (const c of this.chunks) { c.forEach((ch, i) => channels[i].set(ch, off)); off += c[0]?.length ?? 0; }
    this.chunks = [];
    return { fs: this.ctx.sampleRate, channels, reportedChannels: this.reportedChannels };
  }

  close() { this.collecting = false; this.node?.port.close(); void this.ctx.close().catch(() => {}); }
}
