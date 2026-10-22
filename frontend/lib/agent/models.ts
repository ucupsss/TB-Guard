export interface ModelOption {
  id: string;
  name: string;
  provider: 'Google Cloud' | 'Meta' | 'Mistral' | 'DeepSeek' | 'Alibaba Cloud' | 'Canopy Labs' | 'OpenAI';
  badge?: string;
  category: 'google' | 'groq';
  description?: string;
}

export const AVAILABLE_MODELS: ModelOption[] = [
  // Google Cloud (Vertex AI, endpoint global): Gemini 2.x sudah tidak tersedia di project ini
  {
    id: 'gemini-3.8-flash',
    name: 'Gemini 3.8 Flash',
    provider: 'Google Cloud',
    badge: 'Rekomendasi Utama',
    category: 'google',
    description: 'Multimodal cepat, penalaran dan tool calling presisi.',
  },
  {
    id: 'gemini-3.5-flash',
    name: 'Gemini 3.5 Flash',
    provider: 'Google Cloud',
    badge: 'Stabil',
    category: 'google',
    description: 'Seimbang untuk perintah sehari-hari dan analisis data.',
  },
  {
    id: 'gemini-3.1-flash-lite',
    name: 'Gemini 3.1 Flash Lite',
    provider: 'Google Cloud',
    badge: 'Super Cepat',
    category: 'google',
    description: 'Latensi paling rendah dengan efisiensi kuota tinggi.',
  },

  // Groq Cloud (Ultra Fast Inference with 85+ Key Pool)
  {
    id: 'qwen/qwen3.8-27b',
    name: 'Qwen 3.8 27B',
    provider: 'Alibaba Cloud',
    badge: 'Groq Flagship',
    category: 'groq',
    description: 'Bahasa Indonesia tajam, penalaran klinis dan tool calling cepat.',
  },
  {
    id: 'openai/gpt-oss-120b',
    name: 'GPT-OSS 120B',
    provider: 'OpenAI',
    badge: 'High Capacity',
    category: 'groq',
    description: 'Model 120B bertenaga tinggi untuk penalaran kompleks via Groq.',
  },
  {
    id: 'openai/gpt-oss-20b',
    name: 'GPT-OSS 20B Instant',
    provider: 'OpenAI',
    badge: 'Ultra Fast',
    category: 'groq',
    description: 'Kecepatan ~1000 tok/detik, konsumsi kuota paling minim.',
  },
  {
    id: 'whisper-large-v3-turbo',
    name: 'Whisper Large v3 Turbo',
    provider: 'OpenAI',
    badge: 'Audio STT',
    category: 'groq',
    description: 'Transkripsi audio batuk & keluhan pasien medis di Groq.',
  },
  {
    id: 'meta-llama/llama-prompt-guard-2-86m',
    name: 'Llama Prompt Guard 86M',
    provider: 'Meta',
    badge: 'Safety',
    category: 'groq',
    description: 'Proteksi jailbreak & validasi keamanan prompt input medis.',
  },
];

export const DEFAULT_MODEL_ID = 'gemini-3.8-flash';

/** id Gemini lama (chat tersimpan / pengaturan lama) dipetakan ke model aktif */
export const migrateModelId = (id: string) => (/^gemini-[12]\./.test(id) ? DEFAULT_MODEL_ID : id);

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
