package ai

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"tbguard/backend/internal/config"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

func TestPruneKeepsWholeParallelToolTurn(t *testing.T) {
	msgs := []message{{Role: "user", Content: "old"}, {Role: "assistant", Content: "old answer"}, {Role: "user", Content: "current"}, {Role: "assistant", ToolCalls: []toolCall{{ID: "a"}, {ID: "b"}}}, {Role: "tool", ToolCallID: "a"}, {Role: "tool", ToolCallID: "b"}}
	got := pruneMessages(msgs, 1)
	if len(got) != 4 || got[0].Content != "current" || got[2].ToolCallID != "a" {
		t.Fatalf("broken tool turn: %+v", got)
	}
}

func TestMissingModelFallsBackWithoutRetry(t *testing.T) {
	requests := 0
	cfg := config.Config{GeminiModel: defaultModelID, AgentBudget: time.Second * 10}
	s := New(cfg, &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
		requests++
		status, body := 404, `{"error":{"message":"model not found"}}`
		if requests == 2 {
			status, body = 200, "data: {\"candidates\":[{\"content\":{\"parts\":[{\"text\":\"Jawaban\"}]}}]}\n\n"
		}
		return &http.Response{StatusCode: status, Body: io.NopCloser(strings.NewReader(body)), Header: make(http.Header)}, nil
	})})
	s.auth.token, s.auth.expiry = "test", time.Now().Add(time.Hour)
	w := httptest.NewRecorder()
	s.HandleAgent(w, httptest.NewRequest("POST", "/api/agent", strings.NewReader(`{"messages":[{"role":"user","content":"Dasar hukum Perpres 67/2021?"}]}`)))
	if requests != 2 || !strings.Contains(w.Body.String(), `"type":"done"`) {
		t.Fatalf("requests=%d response=%s", requests, w.Body.String())
	}
}

// Opt-in real Vertex smoke test. Token must belong to the runtime service account.
func TestLiveVertexServiceAccount(t *testing.T) {
	token := os.Getenv("TB_TEST_VERTEX_TOKEN")
	if token == "" {
		t.Skip("TB_TEST_VERTEX_TOKEN not set")
	}
	cfg := config.Config{ProjectID: "hackathon-primestep-19", GeminiLocation: "global", GeminiModel: defaultModelID, AgentBudget: 50 * time.Second}
	s := New(cfg, &http.Client{})
	s.auth.token, s.auth.expiry = token, time.Now().Add(time.Hour)
	w := httptest.NewRecorder()
	r := httptest.NewRequest("POST", "/api/agent", strings.NewReader(`{"messages":[{"role":"user","content":"Dasar hukum Perpres 67/2021? Jawab ringkas, jangan panggil tool."}]}`)).WithContext(context.Background())
	s.HandleAgent(w, r)
	for _, line := range strings.Split(w.Body.String(), "\n") {
		var ev map[string]any
		if json.Unmarshal([]byte(line), &ev) != nil {
			continue
		}
		if ev["type"] == "done" {
			t.Logf("Vertex success: model=%v", ev["model"])
			return
		}
	}
	t.Fatalf("Vertex failed: %s", w.Body.String())
}
