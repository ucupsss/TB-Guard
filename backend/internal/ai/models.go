package ai

import "strings"

const defaultModelID = "gemini-2.5-flash"

// groqFallbackModels dicoba berurutan bila model Groq pilihan gagal.
var groqFallbackModels = []string{"qwen/qwen3.8-27b", "openai/gpt-oss-120b", "llama-3.3-70b-versatile"}

// isGroqModel: semua id Gemini dilayani Google, sisanya Groq (sama dengan models.ts di frontend).
func isGroqModel(id string) bool { return !strings.HasPrefix(id, "gemini") }

// normalizeVertexModel memetakan model Gemini lama ke versi yang aktif di Vertex AI.
func normalizeVertexModel(id string) string {
	switch id {
	case "gemini-1.5-flash", "gemini-2.0-flash":
		return "gemini-2.5-flash"
	case "gemini-1.5-pro", "gemini-2.0-pro":
		return "gemini-2.5-pro"
	}
	return id
}
