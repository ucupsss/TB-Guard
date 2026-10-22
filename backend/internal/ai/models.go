package ai

import "strings"

const defaultModelID = "gemini-3.5-flash"

// geminiFallbackModels dicoba berurutan bila model pilihan tidak tersedia (404) atau sibuk.
var geminiFallbackModels = []string{"gemini-3.8-flash", "gemini-3.1-flash-lite", "gemini-3.7-flash"}

// groqFallbackModels dicoba berurutan bila model Groq pilihan gagal.
var groqFallbackModels = []string{"qwen/qwen3.8-27b", "openai/gpt-oss-120b", "llama-3.3-70b-versatile"}

// isGroqModel: semua id Gemini dilayani Google, sisanya Groq (sama dengan models.ts di frontend).
func isGroqModel(id string) bool { return !strings.HasPrefix(id, "gemini") }

// normalizeVertexModel memetakan id lama (Gemini 1.x/2.x sudah tidak tersedia di project ini) ke model aktif.
func normalizeVertexModel(id string) string {
	if strings.HasPrefix(id, "gemini-1.") || strings.HasPrefix(id, "gemini-2.") || id == "" {
		return defaultModelID
	}
	return id
}

// geminiChain: model pilihan lebih dulu, lalu cadangan (tanpa duplikat).
func geminiChain(model string) []string {
	first := normalizeVertexModel(model)
	out := []string{first}
	for _, m := range geminiFallbackModels {
		if m != first {
			out = append(out, m)
		}
	}
	return out
}
