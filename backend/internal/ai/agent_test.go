package ai

import (
	"encoding/json"
	"testing"
)

func TestPruneMessagesKeepsToolParent(t *testing.T) {
	var msgs []message
	call := toolCall{ID: "c1", Type: "function"}
	msgs = append(msgs, message{Role: "user", Content: "a"}, message{Role: "assistant", ToolCalls: []toolCall{call}})
	msgs = append(msgs, message{Role: "tool", ToolCallID: "c1", Content: "{}"})
	for i := 0; i < 7; i++ {
		msgs = append(msgs, message{Role: "user", Content: "x"})
	}
	// potongan 8 terakhir dimulai dari 'tool'? pastikan tidak yatim
	got := pruneMessages(msgs[:9], 7)
	if got[0].Role == "tool" {
		t.Fatalf("tool yatim di awal: %+v", got[0])
	}
}

func TestPruneToolOutputTruncatesLists(t *testing.T) {
	var v any
	_ = json.Unmarshal([]byte(`{"items":[1,2,3,4,5,6,7,8]}`), &v)
	out := pruneToolOutput(v).(map[string]any)["items"].(map[string]any)
	if out["total"].(int) != 8 || len(out["items"].([]any)) != 6 {
		t.Fatalf("pemotongan salah: %v", out)
	}
}

func TestSchemasBuilt(t *testing.T) {
	if len(geminiFunctions) == 0 || len(geminiFunctions) != len(groqTools) {
		t.Fatal("tools tidak termuat")
	}
	b, _ := json.Marshal(geminiFunctions)
	if !json.Valid(b) {
		t.Fatal("schema gemini tidak valid")
	}
}

func TestGroqPoolRotatesAndCoolsDown(t *testing.T) {
	t.Setenv("GROQ_API_KEYS", "gsk_aaaaaaaaaaaaaaaaaaaa,gsk_bbbbbbbbbbbbbbbbbbbb")
	p := newGroqPool("")
	a, b := p.get(), p.get()
	if a.key == b.key {
		t.Fatal("tidak berotasi")
	}
	p.rateLimit(a.key, 60)
	if c := p.get(); c.key != b.key {
		t.Fatal("key cooldown masih dipakai")
	}
	p.invalidate(b.key)
	if p.stats()["total"] != 1 {
		t.Fatal("key invalid masih dihitung")
	}
}
