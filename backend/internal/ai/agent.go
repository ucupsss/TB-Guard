package ai

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"math/rand"
	"net/http"
	"strconv"
	"strings"
	"tbguard/backend/internal/httpx"
	"time"
)

const maxBodyBytes = 1 << 20

type toolCall struct {
	ID       string `json:"id"`
	Type     string `json:"type"`
	Function struct {
		Name      string `json:"name"`
		Arguments string `json:"arguments"`
	} `json:"function"`
	// Signature: thoughtSignature Gemini 3 untuk panggilan fungsi; harus dikirim balik pada giliran berikutnya.
	Signature string `json:"thought_signature,omitempty"`
}

type message struct {
	Role       string     `json:"role"`
	Content    string     `json:"content,omitempty"`
	ToolCalls  []toolCall `json:"tool_calls,omitempty"`
	ToolCallID string     `json:"tool_call_id,omitempty"`
}

type agentRequest struct {
	Messages []message    `json:"messages"`
	Context  agentContext `json:"context"`
	Model    string       `json:"model"`
}

// stream menulis event NDJSON dan langsung flush.
type stream struct {
	w     http.ResponseWriter
	f     http.Flusher
	ended bool // sudah mengirim done
}

func (s *stream) send(ev map[string]any) {
	b, err := json.Marshal(ev)
	if err != nil {
		return
	}
	_, _ = s.w.Write(append(b, '\n'))
	if s.f != nil {
		s.f.Flush()
	}
}

// tokenUsage: pemakaian token satu panggilan model (untuk ditampilkan per jawaban dan per percakapan).
type tokenUsage struct {
	Prompt     int `json:"prompt"`
	Completion int `json:"completion"` // termasuk token "berpikir" bila ada
	Total      int `json:"total"`
}

func (s *stream) done(content string, calls []toolCall, u tokenUsage, ms int64, model string) {
	s.ended = true
	if calls == nil {
		calls = []toolCall{}
	}
	s.send(map[string]any{
		"type": "done", "message": map[string]any{"role": "assistant", "content": content, "tool_calls": calls},
		"usage": u, "ms": ms, "model": model,
	})
}

func (s *stream) wait(sec int, notice string) {
	s.send(map[string]any{"type": "wait", "seconds": sec, "notice": notice})
}

// ---------------------------------------------------------------------------
// kompresi konteks: hemat token input & kuota
// ---------------------------------------------------------------------------

func pruneToolOutput(raw any) any {
	const maxItems = 6
	switch v := raw.(type) {
	case []any:
		if len(v) > maxItems {
			items := make([]any, maxItems)
			for i := range items {
				items[i] = pruneToolOutput(v[i])
			}
			return map[string]any{"total": len(v), "items": items, "_note": fmt.Sprintf("Dipotong %d dari %d item untuk efisiensi kuota.", maxItems, len(v))}
		}
		out := make([]any, len(v))
		for i := range v {
			out[i] = pruneToolOutput(v[i])
		}
		return out
	case map[string]any:
		out := make(map[string]any, len(v))
		for k, x := range v {
			out[k] = pruneToolOutput(x)
		}
		return out
	case string:
		if r := []rune(v); len(r) > 1200 {
			return string(r[:1200]) + "... [ringkasan dipotong]"
		}
	}
	return raw
}

func pruneMessages(msgs []message, maxTurns int) []message {
	if len(msgs) <= maxTurns {
		return msgs
	}
	sliced := msgs[len(msgs)-maxTurns:]
	// potongan tidak boleh diawali 'tool' tanpa assistant pemanggilnya
	if sliced[0].Role == "tool" {
		for i := 0; i < len(msgs)-maxTurns; i++ {
			for _, tc := range msgs[i].ToolCalls {
				if tc.ID == sliced[0].ToolCallID {
					return append([]message{msgs[i]}, sliced...)
				}
			}
		}
	}
	return sliced
}

// prunedToolContent mengompres isi pesan tool; bila bukan JSON, dikembalikan apa adanya.
func prunedToolContent(content string) (string, any) {
	var parsed any
	if err := json.Unmarshal([]byte(content), &parsed); err != nil {
		return content, map[string]any{"output": content}
	}
	p := pruneToolOutput(parsed)
	b, _ := json.Marshal(p)
	return string(b), p
}

// ---------------------------------------------------------------------------
// handler
// ---------------------------------------------------------------------------

type agentRun struct {
	s        *Service
	ctx      context.Context
	deadline time.Time
	st       *stream
	req      agentRequest
	msgs     []message
	started  time.Time
	usage    tokenUsage
	model    string // model yang benar-benar menjawab
}

// finish menutup satu langkah model dengan event done (isi, tool call, token, dan lama generate).
func (a *agentRun) finish(content string, calls []toolCall) {
	u := a.usage
	if u.Total == 0 {
		u.Total = u.Prompt + u.Completion
	}
	a.st.done(content, calls, u, time.Since(a.started).Milliseconds(), a.model)
}

func (s *Service) HandleAgent(w http.ResponseWriter, r *http.Request) {
	var req agentRequest
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxBodyBytes)).Decode(&req); err != nil {
		httpx.JSON(w, http.StatusBadRequest, map[string]string{"error": "Body bukan JSON"})
		return
	}
	if len(req.Messages) == 0 {
		httpx.JSON(w, http.StatusBadRequest, map[string]string{"error": "Pesan kosong"})
		return
	}

	h := w.Header()
	h.Set("Content-Type", "application/x-ndjson; charset=utf-8")
	h.Set("Cache-Control", "no-store")
	h.Set("X-Accel-Buffering", "no")
	f, _ := w.(http.Flusher)

	ctx, cancel := context.WithTimeout(r.Context(), s.cfg.AgentBudget)
	defer cancel()
	run := &agentRun{
		s: s, ctx: ctx, deadline: time.Now().Add(s.cfg.AgentBudget),
		st: &stream{w: w, f: f}, req: req, msgs: pruneMessages(req.Messages, 8), started: time.Now(),
	}

	model := orDef(req.Model, s.cfg.GeminiModel)
	var err string
	if isGroqModel(model) {
		err = run.groqThenGemini(model)
	} else {
		err = run.geminiThenGroq(model)
	}
	// stream dijamin berakhir dengan done atau error, kecuali klien sudah pergi
	if !run.st.ended && r.Context().Err() == nil {
		if err != "" {
			slog.Error("agen gagal", "err", err) // detail teknis hanya di log, tidak ditampilkan ke pengguna
		}
		run.st.send(map[string]any{"type": "error", "error": friendlyErr(err)})
	}
}

// friendlyErr: pesan untuk pengguna tanpa detail internal (nama project, model, endpoint).
func friendlyErr(err string) string {
	switch {
	case err == "":
		return "Waktu habis sebelum agen selesai menjawab. Coba lagi."
	case strings.Contains(err, "Gemini API Error"), strings.Contains(err, "Groq API Error"), strings.Contains(err, "Koneksi ke"),
		strings.Contains(err, "Stream"), strings.Contains(err, "autentikasi"), strings.Contains(err, "Kuota"), strings.Contains(err, "API key"):
		return "Layanan AI sedang sibuk atau tidak tersedia. Silakan coba lagi sebentar."
	}
	return err
}

func (a *agentRun) gone() bool { return a.ctx.Err() != nil }

func (a *agentRun) geminiThenGroq(model string) string {
	auth, authErr := a.s.auth.get(a.ctx, a.s.http)
	var err string
	if authErr != nil {
		err = authErr.Error()
	} else {
		err = a.runGeminiChain(auth, model)
	}
	if err != "" && !a.gone() && a.s.groq.ready() {
		slog.Warn("gemini gagal, dialihkan ke groq", "err", err)
		a.st.wait(1, "Gemini tidak tersedia, dialihkan ke "+groqFallbackModels[0]+"…")
		err = a.runGroq(groqFallbackModels[0])
	}
	return err
}

func (a *agentRun) groqThenGemini(model string) string {
	err := a.runGroq(model)
	if err != "" && !a.gone() {
		if auth, e := a.s.auth.get(a.ctx, a.s.http); e == nil {
			slog.Warn("groq gagal, dialihkan ke gemini", "err", err)
			a.st.wait(1, "Groq tidak tersedia, dialihkan ke "+defaultModelID+"…")
			err = a.runGeminiChain(auth, defaultModelID)
		}
	}
	return err
}

// runGeminiChain mencoba model pilihan, lalu cadangan, bila model tidak tersedia atau gagal sebelum ada isi yang terkirim.
func (a *agentRun) runGeminiChain(auth *geminiAuth, model string) string {
	var err string
	for i, m := range geminiChain(model) {
		if err = a.runGemini(auth, m); err == "" || a.gone() || a.st.ended {
			return err
		}
		slog.Warn("model gemini gagal, mencoba berikutnya", "model", m, "err", err)
		if i+1 < len(geminiChain(model)) {
			a.st.wait(1, "Model "+m+" tidak tersedia, mencoba model lain…")
		}
	}
	return err
}

// post mengirim JSON dengan batas waktu per percobaan yang tidak melewati deadline total.
func (a *agentRun) post(url string, sign func(*http.Request), body []byte, limit time.Duration) (*http.Response, context.CancelFunc, error) {
	d := time.Until(a.deadline)
	if d > limit {
		d = limit
	}
	if d < time.Second {
		d = time.Second
	}
	ctx, cancel := context.WithTimeout(a.ctx, d)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		cancel()
		return nil, nil, err
	}
	sign(req)
	res, err := a.s.http.Do(req)
	if err != nil {
		cancel()
		return nil, nil, err
	}
	return res, cancel, nil
}

// readSSE memanggil fn untuk tiap payload "data:" yang bukan [DONE].
func readSSE(r io.Reader, fn func(data []byte)) error {
	sc := bufio.NewScanner(r)
	sc.Buffer(make([]byte, 64*1024), 4*1024*1024)
	for sc.Scan() {
		line := strings.TrimSpace(sc.Text())
		if !strings.HasPrefix(line, "data:") {
			continue
		}
		data := strings.TrimSpace(line[5:])
		if data == "" || data == "[DONE]" {
			continue
		}
		fn([]byte(data))
	}
	return sc.Err()
}

func randID(prefix string) string { return prefix + strconv.FormatInt(rand.Int63(), 36)[:6] }

func errMessage(body []byte) string {
	var e struct {
		Error struct {
			Message string `json:"message"`
			Code    any    `json:"code"`
		} `json:"error"`
	}
	if json.Unmarshal(body, &e) == nil && e.Error.Message != "" {
		return e.Error.Message
	}
	return string(body)
}

// ---------------------------------------------------------------------------
// Gemini (Vertex AI / Generative Language)
// ---------------------------------------------------------------------------

func (a *agentRun) geminiContents() []map[string]any {
	names := map[string]string{}
	for _, m := range a.msgs {
		for _, tc := range m.ToolCalls {
			if tc.ID != "" {
				names[tc.ID] = tc.Function.Name
			}
		}
	}
	var contents []map[string]any
	last := func() map[string]any {
		if len(contents) == 0 {
			return nil
		}
		return contents[len(contents)-1]
	}
	for _, m := range a.msgs {
		switch {
		case m.Role == "user":
			contents = append(contents, map[string]any{"role": "user", "parts": []any{map[string]any{"text": orDef(m.Content, " ")}}})
		case m.Role == "assistant":
			var parts []any
			if m.Content != "" {
				parts = append(parts, map[string]any{"text": m.Content})
			}
			for _, tc := range m.ToolCalls {
				args := map[string]any{}
				_ = json.Unmarshal([]byte(tc.Function.Arguments), &args)
				fc := map[string]any{"functionCall": map[string]any{"name": tc.Function.Name, "args": args}}
				if tc.Signature != "" {
					fc["thoughtSignature"] = tc.Signature
				}
				parts = append(parts, fc)
			}
			if len(parts) > 0 {
				contents = append(contents, map[string]any{"role": "model", "parts": parts})
			}
		case m.Role == "tool" && m.ToolCallID != "":
			_, resp := prunedToolContent(m.Content)
			part := map[string]any{"functionResponse": map[string]any{
				"name": orDef(names[m.ToolCallID], "tool"), "response": map[string]any{"result": resp},
			}}
			if l := last(); l != nil && l["role"] == "user" {
				l["parts"] = append(l["parts"].([]any), part)
			} else {
				contents = append(contents, map[string]any{"role": "user", "parts": []any{part}})
			}
		}
	}
	// Gemini menolak percakapan yang tidak diawali pesan user
	for len(contents) > 0 && contents[0]["role"] != "user" {
		contents = contents[1:]
	}
	return contents
}

func (a *agentRun) runGemini(auth *geminiAuth, model string) string {
	contents := a.geminiContents()
	if len(contents) == 0 {
		return "Pesan kosong setelah dipangkas."
	}
	a.model, a.usage = normalizeVertexModel(model), tokenUsage{}
	body, _ := json.Marshal(map[string]any{
		"systemInstruction": map[string]any{"parts": []any{map[string]any{"text": systemPrompt(a.req.Context)}}},
		"contents":          contents,
		"tools":             []any{map[string]any{"functionDeclarations": geminiFunctions}},
		"generationConfig":  map[string]any{"temperature": 0.4, "maxOutputTokens": 1536},
	})
	url := auth.url(a.s.cfg, model, "streamGenerateContent", true)

	var res *http.Response
	var cancel context.CancelFunc
	lastErr := ""
	// satu kali ulang untuk gangguan sementara (429 / 5xx / jaringan)
	for attempt := 0; attempt < 3 && res == nil; attempt++ {
		if attempt > 0 {
			select {
			case <-time.After(time.Duration(attempt) * 1200 * time.Millisecond):
			case <-a.ctx.Done():
			}
		}
		if a.gone() {
			return ""
		}
		r, c, err := a.post(url, auth.sign, body, 25*time.Second)
		if err != nil {
			lastErr = "Koneksi ke Gemini gagal: " + err.Error()
			continue
		}
		if r.StatusCode == http.StatusOK {
			res, cancel = r, c
			break
		}
		b, _ := io.ReadAll(io.LimitReader(r.Body, 64<<10))
		r.Body.Close()
		c()
		lastErr = fmt.Sprintf("Gemini API Error (%d): %s", r.StatusCode, errMessage(b))
		// 404 "Publisher model not found" kadang muncul sesaat di Vertex: ulangi, bukan langsung beralih model
		if r.StatusCode != http.StatusTooManyRequests && r.StatusCode != http.StatusNotFound && r.StatusCode < 500 {
			return lastErr
		}
	}
	if res == nil {
		if a.gone() {
			return ""
		}
		return lastErr
	}
	defer cancel()
	defer res.Body.Close()

	var content strings.Builder
	var calls []toolCall
	sentAny := false
	err := readSSE(res.Body, func(data []byte) {
		var ev struct {
			Candidates []struct {
				Content struct {
					Parts []struct {
						Text             string `json:"text"`
						Thought          bool   `json:"thought"`
						ThoughtSignature string `json:"thoughtSignature"`
						FunctionCall     *struct {
							Name string         `json:"name"`
							Args map[string]any `json:"args"`
						} `json:"functionCall"`
					} `json:"parts"`
				} `json:"content"`
			} `json:"candidates"`
			UsageMetadata *struct {
				Prompt     int `json:"promptTokenCount"`
				Candidates int `json:"candidatesTokenCount"`
				Thoughts   int `json:"thoughtsTokenCount"`
				Total      int `json:"totalTokenCount"`
			} `json:"usageMetadata"`
		}
		if json.Unmarshal(data, &ev) != nil {
			return
		}
		if m := ev.UsageMetadata; m != nil && m.Total > 0 {
			a.usage = tokenUsage{Prompt: m.Prompt, Completion: m.Candidates + m.Thoughts, Total: m.Total}
		}
		if len(ev.Candidates) == 0 {
			return
		}
		for _, p := range ev.Candidates[0].Content.Parts {
			if p.Text != "" {
				sentAny = true
				if p.Thought {
					a.st.send(map[string]any{"type": "reasoning", "delta": p.Text})
				} else {
					content.WriteString(p.Text)
					a.st.send(map[string]any{"type": "content", "delta": p.Text})
				}
			}
			if p.FunctionCall != nil {
				args, _ := json.Marshal(p.FunctionCall.Args)
				if p.FunctionCall.Args == nil {
					args = []byte("{}")
				}
				tc := toolCall{ID: randID("call_"), Type: "function", Signature: p.ThoughtSignature}
				tc.Function.Name, tc.Function.Arguments = p.FunctionCall.Name, string(args)
				calls = append(calls, tc)
			}
		}
	})
	if a.gone() {
		return ""
	}
	if err != nil && !sentAny && len(calls) == 0 {
		return "Stream Gemini terputus: " + err.Error()
	}
	// kosong (mis. diblokir filter keamanan): biarkan pemanggil beralih ke Groq
	if !sentAny && len(calls) == 0 {
		return "Gemini tidak mengembalikan jawaban."
	}
	a.finish(content.String(), calls)
	return ""
}

// ---------------------------------------------------------------------------
// Groq (OpenAI-compatible) dengan rotasi key dan model cadangan
// ---------------------------------------------------------------------------

func (a *agentRun) openAIMessages() []map[string]any {
	out := []map[string]any{{"role": "system", "content": systemPrompt(a.req.Context)}}
	for _, m := range a.msgs {
		switch {
		case m.Role == "user":
			out = append(out, map[string]any{"role": "user", "content": m.Content})
		case m.Role == "assistant":
			e := map[string]any{"role": "assistant"}
			if len(m.ToolCalls) > 0 {
				plain := make([]toolCall, len(m.ToolCalls))
				for i, tc := range m.ToolCalls {
					tc.Signature = ""
					plain[i] = tc
				}
				e["tool_calls"] = plain
				if m.Content != "" {
					e["content"] = m.Content
				} else {
					e["content"] = nil
				}
			} else {
				e["content"] = m.Content
			}
			out = append(out, e)
		case m.Role == "tool" && m.ToolCallID != "":
			c, _ := prunedToolContent(m.Content)
			out = append(out, map[string]any{"role": "tool", "tool_call_id": m.ToolCallID, "content": c})
		}
	}
	return out
}

const groqURL = "https://api.groq.com/openai/v1/chat/completions"

func (a *agentRun) runGroq(target string) string {
	msgs := a.openAIMessages()
	models := []string{target}
	for _, m := range groqFallbackModels {
		if m != target {
			models = append(models, m)
		}
	}
	idx, modelFails, limited := 0, 0, 0
	lastErr := "Groq tidak merespons."
	nextModel := func() bool {
		idx++
		modelFails, limited = 0, 0
		if idx < len(models) {
			a.st.wait(1, "Beralih ke model cadangan "+models[idx]+"…")
		}
		return idx < len(models)
	}

	for attempt := 0; attempt < 24 && time.Until(a.deadline) > 3*time.Second && !a.gone(); attempt++ {
		key := a.s.groq.get()
		if key == nil {
			return "Tidak ada API key Groq yang aktif."
		}
		a.model, a.usage = models[idx], tokenUsage{}
		body, _ := json.Marshal(map[string]any{
			"model": models[idx], "messages": msgs, "tools": groqTools, "tool_choice": "auto",
			"temperature": 0.3, "max_tokens": 1536, "stream": true, "stream_options": map[string]any{"include_usage": true},
		})
		res, cancel, err := a.post(groqURL, func(r *http.Request) {
			r.Header.Set("Content-Type", "application/json")
			r.Header.Set("Authorization", "Bearer "+key.key)
		}, body, 25*time.Second)
		if err != nil {
			if a.gone() {
				return ""
			}
			a.s.groq.rateLimit(key.key, 15) // jaringan putus / timeout: istirahatkan key ini
			lastErr = "Koneksi ke Groq gagal: " + err.Error()
			continue
		}

		if res.StatusCode == 429 || res.StatusCode == 413 {
			retry, _ := strconv.ParseFloat(res.Header.Get("Retry-After"), 64)
			if retry == 0 {
				retry = 20
			}
			res.Body.Close()
			cancel()
			a.s.groq.rateLimit(key.key, min(max(retry, 2), 60))
			lastErr = "Kuota Groq sedang penuh, coba lagi sebentar."
			// kuota dihitung per model: pindah model lebih efektif daripada menunggu
			limited++
			if limited >= 4 {
				if !nextModel() {
					idx, limited = 0, 0
					a.st.wait(3, "Semua kuota Groq penuh, menunggu 3 detik…")
					select {
					case <-time.After(3 * time.Second):
					case <-a.ctx.Done():
					}
				}
			} else {
				a.st.wait(1, fmt.Sprintf("Rotasi API Key Groq [%d/%d] karena limit kuota…", key.index, key.total))
			}
			continue
		}

		if res.StatusCode != http.StatusOK {
			b, _ := io.ReadAll(io.LimitReader(res.Body, 64<<10))
			res.Body.Close()
			cancel()
			msg := errMessage(b)
			lastErr = fmt.Sprintf("Groq API Error (%d): %s", res.StatusCode, msg)
			low := strings.ToLower(string(b))
			switch {
			case strings.Contains(low, "restricted") || strings.Contains(low, "deactivated") ||
				res.StatusCode == 401 || res.StatusCode == 403 || strings.Contains(low, "invalid_api_key"):
				a.s.groq.invalidate(key.key)
				attempt-- // key mati tidak dihitung sebagai percobaan
			case res.StatusCode >= 500 || strings.Contains(low, "rate_limit"):
				a.s.groq.rateLimit(key.key, 30)
			case res.StatusCode == 404 || strings.Contains(low, "model_not_found") ||
				strings.Contains(low, "decommissioned") || strings.Contains(low, "does not exist"):
				if !nextModel() {
					return lastErr
				}
			default: // tool call rusak / 400 lain: ulangi sekali, lalu pindah model
				if modelFails++; modelFails >= 2 && !nextModel() {
					return lastErr
				}
			}
			continue
		}

		// stream sukses
		var content strings.Builder
		type acc struct{ id, name, args string }
		byIdx := map[int]*acc{}
		sentAny := false
		serr := readSSE(res.Body, func(data []byte) {
			var ev struct {
				Choices []struct {
					Delta struct {
						Content          string `json:"content"`
						Reasoning        string `json:"reasoning"`
						ReasoningContent string `json:"reasoning_content"`
						ToolCalls        []struct {
							Index    int    `json:"index"`
							ID       string `json:"id"`
							Function struct {
								Name      string `json:"name"`
								Arguments string `json:"arguments"`
							} `json:"function"`
						} `json:"tool_calls"`
					} `json:"delta"`
				} `json:"choices"`
				Usage *struct {
					Prompt     int `json:"prompt_tokens"`
					Completion int `json:"completion_tokens"`
					Total      int `json:"total_tokens"`
				} `json:"usage"`
			}
			if json.Unmarshal(data, &ev) != nil {
				return
			}
			if u := ev.Usage; u != nil && u.Total > 0 {
				a.usage = tokenUsage{Prompt: u.Prompt, Completion: u.Completion, Total: u.Total}
			}
			if len(ev.Choices) == 0 {
				return
			}
			d := ev.Choices[0].Delta
			if r := orDef(d.ReasoningContent, d.Reasoning); r != "" {
				sentAny = true
				a.st.send(map[string]any{"type": "reasoning", "delta": r})
			}
			if d.Content != "" {
				sentAny = true
				content.WriteString(d.Content)
				a.st.send(map[string]any{"type": "content", "delta": d.Content})
			}
			for _, tc := range d.ToolCalls {
				c := byIdx[tc.Index]
				if c == nil {
					c = &acc{id: randID(fmt.Sprintf("call_%d_", tc.Index))}
					byIdx[tc.Index] = c
				}
				if tc.ID != "" {
					c.id = tc.ID
				}
				c.name += tc.Function.Name
				c.args += tc.Function.Arguments
			}
		})
		res.Body.Close()
		cancel()
		if a.gone() {
			return ""
		}

		var calls []toolCall
		for i := 0; i < len(byIdx)+8 && len(calls) < len(byIdx); i++ { // urut berdasarkan index
			if c, ok := byIdx[i]; ok && c.name != "" {
				tc := toolCall{ID: c.id, Type: "function"}
				tc.Function.Name, tc.Function.Arguments = c.name, orDef(c.args, "{}")
				calls = append(calls, tc)
			}
		}

		if serr != nil && !sentAny && len(calls) == 0 { // putus sebelum ada isi: ulangi dengan key lain
			a.s.groq.rateLimit(key.key, 15)
			lastErr = "Stream Groq terputus: " + serr.Error()
			continue
		}
		if !sentAny && len(calls) == 0 {
			lastErr = "Model tidak mengembalikan jawaban."
			if modelFails++; modelFails >= 2 && !nextModel() {
				return lastErr
			}
			continue
		}
		a.finish(content.String(), calls)
		return ""
	}
	if a.gone() {
		return ""
	}
	return lastErr
}
