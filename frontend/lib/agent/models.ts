export interface ModelOption {
  id: string;
  name: string;
  provider: 'Google Cloud' | 'Meta' | 'Mistral' | 'DeepSeek' | 'Alibaba Cloud' | 'Canopy Labs' | 'OpenAI';
  badge?: string;
  category: 'google' | 'groq';
  description?: string;
}

export const AVAILABLE_MODELS: ModelOption[] = [
  // Google Cloud
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'Google Cloud',
    badge: 'Rekomendasi',
    category: 'google',
    description: 'Multimodal seimbang, penalaran cepat & tool calling akurat.',
  },
  {
    id: 'gemini-1.5-flash',
    name: 'Gemini 1.5 Flash',
    provider: 'Google Cloud',
    badge: 'Super Hemat',
    category: 'google',
    description: 'Latensi ultra rendah, hemat kuota token per menit.',
  },
  {
    id: 'gemini-1.5-pro',
    name: 'Gemini 1.5 Pro',
    provider: 'Google Cloud',
    badge: 'Deep Reasoning',
    category: 'google',
    description: 'Analisis mendalam untuk kasus epidemiologi rumit.',
  },

  // Meta (via Groq)
  {
    id: 'llama-3.3-70b-versatile',
    name: 'Llama 3.3 70B Versatile',
    provider: 'Meta',
    badge: 'Groq Flagship',
    category: 'groq',
    description: 'Model open-source terkuat di Groq dengan tool-calling presisi.',
  },
  {
    id: 'llama-3.1-8b-instant',
    name: 'Llama 3.1 8B Instant',
    provider: 'Meta',
    badge: 'Paling Hemat',
    category: 'groq',
    description: 'Kecepatan ~1000 tok/detik, konsumsi kuota paling minim.',
  },
  {
    id: 'meta-llama/llama-prompt-guard-2-86m',
    name: 'Llama Prompt Guard 86M',
    provider: 'Meta',
    badge: 'Safety',
    category: 'groq',
    description: 'Proteksi jailbreak & validasi keamanan prompt input.',
  },

  // DeepSeek (via Groq)
  {
    id: 'deepseek-r1-distill-llama-70b',
    name: 'DeepSeek R1 Distill 70B',
    provider: 'DeepSeek',
    badge: 'Thinking Mode',
    category: 'groq',
    description: 'Penalaran langkah-demi-langkah (CoT) sebelum mengeksekusi tool.',
  },

  // Mistral (via Groq)
  {
    id: 'mixtral-8x7b-32768',
    name: 'Mixtral 8x7B (32k)',
    provider: 'Mistral',
    badge: 'High Context',
    category: 'groq',
    description: 'Arsitektur MoE dengan jendela konteks 32k token.',
  },

  // Alibaba Cloud (Qwen)
  {
    id: 'qwen/qwen3.8-27b',
    name: 'Qwen 3.8 27B',
    provider: 'Alibaba Cloud',
    badge: 'Multilingual',
    category: 'groq',
    description: 'Kemampuan bahasa Indonesia dan penalaran klinis yang tajam.',
  },
  {
    id: 'qwen-2.5-32b',
    name: 'Qwen 2.5 32B',
    provider: 'Alibaba Cloud',
    badge: 'Fast Reasoning',
    category: 'groq',
    description: 'Optimal untuk penalaran terstruktur dan ekstraksi JSON.',
  },

  // OpenAI / Whisper (via Groq)
  {
    id: 'whisper-large-v3-turbo',
    name: 'Whisper Large v3 Turbo',
    provider: 'OpenAI',
    badge: 'Audio STT',
    category: 'groq',
    description: 'Transkripsi audio medis kecepatan tinggi di Groq.',
  },
];

export const DEFAULT_MODEL_ID = 'gemini-2.5-flash';

export function getModelInfo(id: string): ModelOption {
  return AVAILABLE_MODELS.find((m) => m.id === id) || {
    id,
    name: id,
    provider: id.startsWith('gemini') ? 'Google Cloud' : 'Meta',
    category: id.startsWith('gemini') ? 'google' : 'groq',
  };
}

export function isGroqModel(modelId: string): boolean {
  const m = getModelInfo(modelId);
  return m.category === 'groq';
}

export function isGeminiModel(modelId: string): boolean {
  const m = getModelInfo(modelId);
  return m.category === 'google';
}
