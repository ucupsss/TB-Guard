package ai

import (
	"net/http"

	"tbguard/backend/internal/config"
)

// Service melayani agen AI (Gemini/Vertex AI + Groq) dan transkripsi suara.
type Service struct {
	cfg  config.Config
	http *http.Client
	groq *groqPool
	auth *googleAuth
}

func New(cfg config.Config, hc *http.Client) *Service {
	return &Service{cfg: cfg, http: hc, groq: newGroqPool(cfg.GroqKeysFile), auth: newGoogleAuth(cfg)}
}

// GroqStats untuk health check.
func (s *Service) GroqStats() map[string]int { return s.groq.stats() }
