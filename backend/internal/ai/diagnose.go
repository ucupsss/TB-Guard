package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

	"tbguard/backend/internal/httpx"
)

type probeResult struct {
	Model  string `json:"model"`
	OK     bool   `json:"ok"`
	Status int    `json:"status,omitempty"`
	Ms     int64  `json:"ms"`
	Error  string `json:"error,omitempty"`
}

func shortErr(b []byte) string {
	m := errMessage(b)
	m = strings.Join(strings.Fields(m), " ")
	if r := []rune(m); len(r) > 120 {
		m = string(r[:120])
	}
	return m
}

// HandleDiagnose memeriksa tiap model Gemini dalam rantai dan satu panggilan Groq dengan permintaan kecil.
// Hanya untuk Admin; hasilnya dipakai tombol "Diagnosa" di panel agen untuk mencari penyebab layanan AI gagal.
func (s *Service) HandleDiagnose(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()
	out := map[string]any{}

	models := geminiChain(s.cfg.GeminiModel)
	gem := make([]probeResult, len(models))
	if auth, err := s.auth.get(ctx, s.http); err != nil {
		out["gemini_auth"] = err.Error()
	} else {
		out["gemini_auth"] = "ok"
		var wg sync.WaitGroup
		for i, m := range models {
			wg.Add(1)
			go func() {
				defer wg.Done()
				t0 := time.Now()
				body, _ := json.Marshal(map[string]any{
					"contents":         []any{map[string]any{"role": "user", "parts": []any{map[string]any{"text": "Balas satu kata: ok"}}}},
					"generationConfig": map[string]any{"maxOutputTokens": 16},
				})
				req, _ := http.NewRequestWithContext(ctx, http.MethodPost, auth.url(s.cfg, m, "generateContent", false), bytes.NewReader(body))
				auth.sign(req)
				res, err := s.http.Do(req)
				pr := probeResult{Model: m}
				if err != nil {
					pr.Error = "koneksi: " + err.Error()
				} else {
					b, _ := io.ReadAll(io.LimitReader(res.Body, 64<<10))
					res.Body.Close()
					pr.Status, pr.OK = res.StatusCode, res.StatusCode == http.StatusOK
					if !pr.OK {
						pr.Error = shortErr(b)
					}
				}
				pr.Ms = time.Since(t0).Milliseconds()
				gem[i] = pr
			}()
		}
		wg.Wait()
	}
	out["gemini"] = gem
	out["gemini_location"] = s.cfg.GeminiLocation

	g := map[string]any{"keys": s.groq.stats()}
	if key := s.groq.get(); key != nil {
		t0 := time.Now()
		body, _ := json.Marshal(map[string]any{"model": groqFallbackModels[0], "messages": []any{map[string]any{"role": "user", "content": "ok"}}, "max_tokens": 4})
		req, _ := http.NewRequestWithContext(ctx, http.MethodPost, groqURL, bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+key.key)
		pr := probeResult{Model: groqFallbackModels[0]}
		if res, err := s.http.Do(req); err != nil {
			pr.Error = "koneksi: " + err.Error()
		} else {
			b, _ := io.ReadAll(io.LimitReader(res.Body, 64<<10))
			res.Body.Close()
			pr.Status, pr.OK = res.StatusCode, res.StatusCode == http.StatusOK
			if !pr.OK {
				pr.Error = shortErr(b)
			}
		}
		pr.Ms = time.Since(t0).Milliseconds()
		g["test"] = pr
	} else {
		g["test"] = "tidak ada API key Groq aktif"
	}
	out["groq"] = g
	httpx.JSON(w, http.StatusOK, out)
}
