package ai

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"io"
	"log/slog"
	"mime/multipart"
	"net/http"
	"net/textproto"
	"strings"
	"tbguard/backend/internal/httpx"
	"time"
)

const (
	maxAudioBytes = 25 << 20
	transcribeAsk = "Transkripsikan rekaman audio bahasa Indonesia ini secara persis dan akurat ke teks percakapan. Keluarkan HANYA teks hasil transkripsinya saja, tanpa tanda petik, tanpa awalan, dan tanpa penjelasan tambahan."
)

// handleTranscribe: Groq Whisper (rotasi key) -> Gemini (Vertex / API key).
func (s *Service) HandleTranscribe(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, maxAudioBytes+(1<<20))
	if err := r.ParseMultipartForm(8 << 20); err != nil {
		httpx.JSON(w, http.StatusBadRequest, map[string]string{"error": "Body bukan multipart form atau terlalu besar (maks 25MB)"})
		return
	}
	f, hdr, err := r.FormFile("audio")
	if err != nil || hdr.Size == 0 {
		httpx.JSON(w, http.StatusBadRequest, map[string]string{"error": "Rekaman suara kosong"})
		return
	}
	defer f.Close()
	if hdr.Size > maxAudioBytes {
		httpx.JSON(w, http.StatusRequestEntityTooLarge, map[string]string{"error": "Ukuran rekaman audio melebihi batas (25MB)"})
		return
	}
	audio, err := io.ReadAll(f)
	if err != nil {
		httpx.JSON(w, http.StatusBadRequest, map[string]string{"error": "Gagal membaca rekaman"})
		return
	}
	mime := orDef(hdr.Header.Get("Content-Type"), "audio/webm")
	ctx, cancel := context.WithTimeout(r.Context(), 50*time.Second)
	defer cancel()

	if text := s.whisper(ctx, audio, mime); text != "" {
		httpx.JSON(w, http.StatusOK, map[string]string{"text": text})
		return
	}
	if text := s.geminiTranscribe(ctx, audio, mime); text != "" {
		httpx.JSON(w, http.StatusOK, map[string]string{"text": text})
		return
	}
	httpx.JSON(w, http.StatusServiceUnavailable, map[string]string{"error": "Semua layanan transkripsi (Groq Whisper, Gemini) sedang sibuk. Coba sesaat lagi."})
}

func (s *Service) whisper(ctx context.Context, audio []byte, mime string) string {
	tries := min(10, max(s.groq.stats()["total"], 1))
	for i := 0; i < tries && ctx.Err() == nil; i++ {
		key := s.groq.get()
		if key == nil {
			return ""
		}
		var buf bytes.Buffer
		mw := multipart.NewWriter(&buf)
		_ = mw.WriteField("model", "whisper-large-v3-turbo")
		_ = mw.WriteField("language", "id")
		_ = mw.WriteField("temperature", "0.1")
		_ = mw.WriteField("response_format", "json")
		h := textproto.MIMEHeader{}
		h.Set("Content-Disposition", `form-data; name="file"; filename="voice.webm"`)
		h.Set("Content-Type", mime)
		part, _ := mw.CreatePart(h)
		_, _ = part.Write(audio)
		_ = mw.Close()

		cctx, cancel := context.WithTimeout(ctx, 20*time.Second)
		req, _ := http.NewRequestWithContext(cctx, http.MethodPost, "https://api.groq.com/openai/v1/audio/transcriptions", &buf)
		req.Header.Set("Content-Type", mw.FormDataContentType())
		req.Header.Set("Authorization", "Bearer "+key.key)
		res, err := s.http.Do(req)
		if err != nil {
			cancel()
			s.groq.rateLimit(key.key, 45)
			continue
		}
		body, _ := io.ReadAll(io.LimitReader(res.Body, 1<<20))
		res.Body.Close()
		cancel()

		switch {
		case res.StatusCode == http.StatusOK:
			var out struct{ Text string }
			if json.Unmarshal(body, &out) == nil && strings.TrimSpace(out.Text) != "" {
				return strings.TrimSpace(out.Text)
			}
		case res.StatusCode == 400 || res.StatusCode == 401 || res.StatusCode == 403:
			s.groq.invalidate(key.key)
		default:
			s.groq.rateLimit(key.key, 45)
		}
		slog.Warn("whisper gagal", "status", res.StatusCode)
	}
	return ""
}

func (s *Service) geminiTranscribe(ctx context.Context, audio []byte, mime string) string {
	auth, err := s.auth.get(ctx, s.http)
	if err != nil {
		return ""
	}
	body, _ := json.Marshal(map[string]any{
		"contents": []any{map[string]any{"role": "user", "parts": []any{
			map[string]any{"inline_data": map[string]any{"mime_type": mime, "data": base64.StdEncoding.EncodeToString(audio)}},
			map[string]any{"text": transcribeAsk},
		}}},
		"generationConfig": map[string]any{"temperature": 0.1},
	})
	cctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()
	req, _ := http.NewRequestWithContext(cctx, http.MethodPost, auth.url(s.cfg, defaultModelID, "generateContent", false), bytes.NewReader(body))
	auth.sign(req)
	res, err := s.http.Do(req)
	if err != nil {
		slog.Warn("transkripsi gemini gagal", "err", err)
		return ""
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		slog.Warn("transkripsi gemini gagal", "status", res.StatusCode)
		return ""
	}
	var out struct {
		Candidates []struct {
			Content struct {
				Parts []struct{ Text string } `json:"parts"`
			} `json:"content"`
		} `json:"candidates"`
	}
	if json.NewDecoder(res.Body).Decode(&out) != nil || len(out.Candidates) == 0 || len(out.Candidates[0].Content.Parts) == 0 {
		return ""
	}
	return strings.TrimSpace(out.Candidates[0].Content.Parts[0].Text)
}
