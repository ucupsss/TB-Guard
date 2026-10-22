package ai

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"io"
	"log/slog"
	"math"
	"mime/multipart"
	"net/http"
	"net/textproto"
	"regexp"
	"strings"
	"time"

	"tbguard/backend/internal/httpx"
)

const maxAudioBytes = 25 << 20

// Kosakata domain untuk membiaskan Whisper/Gemini ke istilah yang benar (nama produk, istilah medis).
const domainPrompt = "TB Guard, perangkat TB Guard 1 2 3 4 5, tuberkulosis, TBC, deteksi batuk, pasien, TCM GeneXpert, " +
	"Puskesmas, RSKI Universitas Airlangga, UUID, dashboard, tambahkan device, hapus, ubah, lokasi, Surabaya, Bandung."

const geminiAsk = "Transkripsikan rekaman audio ini apa adanya ke teks. Bahasa utama Indonesia (boleh bercampur istilah Inggris). " +
	"Konteks: asisten dashboard TB Guard; istilah yang mungkin muncul: " + domainPrompt + " " +
	"Perbaiki salah dengar yang jelas sesuai konteks (mis. 'tebe gard' = TB Guard). " +
	"Keluarkan HANYA teks hasilnya, tanpa tanda petik, awalan, atau penjelasan. Bila tidak ada ucapan, keluarkan kosong."

// Ambang kepercayaan: di bawahnya dicoba model yang lebih akurat, lalu Gemini.
const (
	confOK   = 0.62
	confMin  = 0.40
	fastMod  = "whisper-large-v3-turbo"
	exactMod = "whisper-large-v3"
)

type transcript struct {
	Text       string  `json:"text"`
	Language   string  `json:"language,omitempty"`
	Confidence float64 `json:"confidence"`
	Engine     string  `json:"engine"`
}

// HandleTranscribe: transkripsi adaptif. Whisper turbo (cepat) -> bila ragu, Whisper large-v3 (akurat)
// -> bila masih ragu, Gemini dengan konteks domain. Hasil dibersihkan dari halusinasi dan istilah dinormalkan.
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
	lang := r.FormValue("lang") // "id" (default), "en", atau "auto"
	if lang == "" {
		lang = "id"
	}
	ctx, cancel := context.WithTimeout(r.Context(), 50*time.Second)
	defer cancel()

	best := s.whisper(ctx, audio, mime, fastMod, lang)
	if best.Confidence < confOK { // ragu: coba model yang lebih akurat dan ambil yang lebih yakin
		if alt := s.whisper(ctx, audio, mime, exactMod, lang); alt.Text != "" && alt.Confidence > best.Confidence {
			best = alt
		}
	}
	if best.Confidence < confMin && ctx.Err() == nil { // masih ragu / kosong: Gemini punya konteks lebih luas
		if g := s.geminiTranscribe(ctx, audio, mime); g != "" {
			best = transcript{Text: g, Confidence: 0.6, Engine: "gemini", Language: best.Language}
		}
	}
	best.Text = normalizeText(best.Text)
	if best.Text == "" {
		httpx.JSON(w, http.StatusOK, map[string]any{"text": "", "confidence": 0, "engine": best.Engine})
		return
	}
	httpx.JSON(w, http.StatusOK, best)
}

type whisperSeg struct {
	Text             string  `json:"text"`
	Start            float64 `json:"start"`
	End              float64 `json:"end"`
	AvgLogprob       float64 `json:"avg_logprob"`
	NoSpeechProb     float64 `json:"no_speech_prob"`
	CompressionRatio float64 `json:"compression_ratio"`
}

// whisper memanggil Groq Whisper dengan rotasi key; mengembalikan teks yang sudah disaring dan skor keyakinan.
func (s *Service) whisper(ctx context.Context, audio []byte, mime, model, lang string) transcript {
	tries := min(8, max(s.groq.stats()["total"], 1))
	for i := 0; i < tries && ctx.Err() == nil; i++ {
		key := s.groq.get()
		if key == nil {
			break
		}
		var buf bytes.Buffer
		mw := multipart.NewWriter(&buf)
		_ = mw.WriteField("model", model)
		if lang != "auto" {
			_ = mw.WriteField("language", lang)
		}
		_ = mw.WriteField("prompt", domainPrompt)
		_ = mw.WriteField("temperature", "0")
		_ = mw.WriteField("response_format", "verbose_json")
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
		body, _ := io.ReadAll(io.LimitReader(res.Body, 2<<20))
		res.Body.Close()
		cancel()

		switch {
		case res.StatusCode == http.StatusOK:
			var out struct {
				Text     string       `json:"text"`
				Language string       `json:"language"`
				Segments []whisperSeg `json:"segments"`
			}
			if json.Unmarshal(body, &out) != nil {
				continue
			}
			text, conf := scoreSegments(out.Text, out.Segments)
			return transcript{Text: text, Language: out.Language, Confidence: conf, Engine: model}
		case res.StatusCode == 400 && model != fastMod:
			return transcript{} // model tidak tersedia: biarkan pemanggil memakai hasil lain
		case res.StatusCode == 400 || res.StatusCode == 401 || res.StatusCode == 403:
			s.groq.invalidate(key.key)
		default:
			s.groq.rateLimit(key.key, 45)
		}
		slog.Warn("whisper gagal", "model", model, "status", res.StatusCode)
	}
	return transcript{Engine: model}
}

// scoreSegments membuang segmen yang kemungkinan halusinasi/derau dan menghitung keyakinan
// dari rata-rata log-probabilitas (berbobot durasi). Tanpa segmen, dipakai teks mentah dengan skor netral.
func scoreSegments(raw string, segs []whisperSeg) (string, float64) {
	if len(segs) == 0 {
		t := strings.TrimSpace(raw)
		if isHallucination(t) {
			return "", 0
		}
		return t, 0.5
	}
	var parts []string
	var sumLP, sumDur float64
	for _, sg := range segs {
		// hanya buang segmen yang JELAS halusinasi/derau; ucapan nyata dengan skor sedang tetap dipertahankan
		if sg.CompressionRatio > 2.4 || (sg.NoSpeechProb > 0.85 && sg.AvgLogprob < -1.3) {
			continue
		}
		t := strings.TrimSpace(sg.Text)
		if t == "" {
			continue
		}
		parts = append(parts, t)
		d := math.Max(sg.End-sg.Start, 0.1)
		sumLP += sg.AvgLogprob * d
		sumDur += d
	}
	text := strings.Join(parts, " ")
	if text == "" || isHallucination(text) {
		return "", 0
	}
	return text, math.Min(1, math.Max(0, math.Exp(sumLP/sumDur)))
}

var hallucinations = []string{
	"terima kasih telah menonton", "terima kasih sudah menonton", "thanks for watching", "thank you for watching",
	"subtitle", "subtitles by", "amara.org", "jangan lupa subscribe", "like dan subscribe", "sampai jumpa di video berikutnya",
}

func isHallucination(t string) bool {
	l := strings.ToLower(strings.TrimSpace(t))
	if len([]rune(strings.Trim(l, " .,!?-…"))) < 2 {
		return true
	}
	for _, h := range hallucinations {
		if strings.Contains(l, h) {
			return true
		}
	}
	return false
}

// Normalisasi istilah domain yang sering salah dengar.
var normalizers = []struct {
	re  *regexp.Regexp
	rep string
}{
	{regexp.MustCompile(`(?i)\b(?:te ?be|ti ?bi|tebe|tibi|fest tv|test tv|tb)\s*(?:gward|gard|guard|gar|ward|gerd)\b`), "TB Guard"},
	{regexp.MustCompile(`(?i)\b(?:te ?be ?ce|ti ?bi ?si|tebece|tibisi)\b`), "TBC"},
	{regexp.MustCompile(`(?i)\b(?:te ?be|ti ?bi)\b`), "TB"},
	{regexp.MustCompile(`(?i)\b(?:gene ?expert|jin ?exper[t]?|gen ?exper[t]?)\b`), "GeneXpert"},
	{regexp.MustCompile(`(?i)\b(?:yu ?yu ?ai ?di|uuid)\b`), "UUID"},
	{regexp.MustCompile(`(?i)\bte ?ce ?em\b`), "TCM"},
}

func normalizeText(t string) string {
	t = strings.TrimSpace(t)
	for _, n := range normalizers {
		t = n.re.ReplaceAllString(t, n.rep)
	}
	return strings.Join(strings.Fields(t), " ")
}

func (s *Service) geminiTranscribe(ctx context.Context, audio []byte, mime string) string {
	auth, err := s.auth.get(ctx, s.http)
	if err != nil {
		return ""
	}
	body, _ := json.Marshal(map[string]any{
		"contents": []any{map[string]any{"role": "user", "parts": []any{
			map[string]any{"inline_data": map[string]any{"mime_type": mime, "data": base64.StdEncoding.EncodeToString(audio)}},
			map[string]any{"text": geminiAsk},
		}}},
		"generationConfig": map[string]any{"temperature": 0},
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
	t := strings.TrimSpace(out.Candidates[0].Content.Parts[0].Text)
	if isHallucination(t) {
		return ""
	}
	return t
}
