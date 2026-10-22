package ai

import (
	"testing"

	"tbguard/backend/internal/config"
)

func TestNormalizeAndChain(t *testing.T) {
	for in, want := range map[string]string{
		"gemini-2.5-flash": defaultModelID, "gemini-1.5-pro": defaultModelID, "gemini-2.0-flash": defaultModelID, "": defaultModelID,
		"gemini-3.5-flash": "gemini-3.5-flash",
	} {
		if got := normalizeVertexModel(in); got != want {
			t.Errorf("normalizeVertexModel(%q) = %q, want %q", in, got, want)
		}
	}
	chain := geminiChain("gemini-3.5-flash")
	if chain[0] != "gemini-3.5-flash" || len(chain) != 1+len(geminiFallbackModels)-1 {
		t.Fatalf("rantai salah: %v", chain)
	}
	seen := map[string]bool{}
	for _, m := range geminiChain("gemini-2.5-flash") {
		if seen[m] {
			t.Fatalf("model duplikat di rantai: %s", m)
		}
		seen[m] = true
	}
}

func TestVertexURLUsesGlobalEndpoint(t *testing.T) {
	cfg := config.Config{ProjectID: "p", GeminiLocation: "global"}
	got := (&geminiAuth{vertex: true}).url(cfg, "gemini-3.8-flash", "streamGenerateContent", true)
	want := "https://aiplatform.googleapis.com/v1/projects/p/locations/global/publishers/google/models/gemini-3.8-flash:streamGenerateContent?alt=sse"
	if got != want {
		t.Fatalf("url global salah:\n%s", got)
	}
	cfg.GeminiLocation = "us-central1"
	if u := (&geminiAuth{vertex: true}).url(cfg, "gemini-3.8-flash", "generateContent", false); u[:36] != "https://us-central1-aiplatform.googl" {
		t.Fatalf("url regional salah: %s", u)
	}
}

func TestFriendlyErrHidesInternals(t *testing.T) {
	raw := "Gemini API Error (404): Publisher model `projects/hackathon-primestep-19/locations/us-central1/...` was not found"
	if got := friendlyErr(raw); got == raw || len(got) > 100 {
		t.Fatalf("detail internal bocor: %q", got)
	}
}
