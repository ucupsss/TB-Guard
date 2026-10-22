package ai

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os/exec"
	"strings"
	"sync"
	"tbguard/backend/internal/config"
	"time"
)

// geminiAuth: Vertex AI (token OAuth) atau Generative Language (API key).
type geminiAuth struct {
	vertex bool
	token  string
	apiKey string
}

type googleAuth struct {
	cfg    config.Config
	mu     sync.Mutex
	token  string
	expiry time.Time
}

func newGoogleAuth(cfg config.Config) *googleAuth { return &googleAuth{cfg: cfg} }

// get memakai urutan: metadata server Cloud Run (service account runtime) -> gcloud CLI (dev lokal) -> GEMINI_API_KEY.
func (g *googleAuth) get(ctx context.Context, client *http.Client) (*geminiAuth, error) {
	g.mu.Lock()
	defer g.mu.Unlock()

	if g.token != "" && time.Until(g.expiry) > time.Minute {
		return &geminiAuth{vertex: true, token: g.token}, nil
	}
	if tok, ttl, err := metadataToken(ctx, client); err == nil {
		g.token, g.expiry = tok, time.Now().Add(ttl)
		return &geminiAuth{vertex: true, token: tok}, nil
	}

	// dev lokal: hanya bila gcloud terpasang dan sudah login
	cctx, cancel := context.WithTimeout(ctx, 6*time.Second)
	defer cancel()
	if out, err := exec.CommandContext(cctx, "gcloud", "auth", "print-access-token").Output(); err == nil {
		if tok := strings.TrimSpace(string(out)); strings.HasPrefix(tok, "ya29.") {
			g.token, g.expiry = tok, time.Now().Add(45*time.Minute)
			return &geminiAuth{vertex: true, token: tok}, nil
		}
	}

	if g.cfg.GeminiAPIKey != "" {
		return &geminiAuth{apiKey: g.cfg.GeminiAPIKey}, nil
	}
	return nil, errors.New("autentikasi Google Cloud belum tersedia: jalankan di Cloud Run dengan service account, atau set GEMINI_API_KEY")
}

func metadataToken(ctx context.Context, client *http.Client) (string, time.Duration, error) {
	ctx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet,
		"http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token", nil)
	req.Header.Set("Metadata-Flavor", "Google")
	res, err := client.Do(req)
	if err != nil {
		return "", 0, err
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return "", 0, fmt.Errorf("metadata server status %d", res.StatusCode)
	}
	var body struct {
		AccessToken string `json:"access_token"`
		ExpiresIn   int    `json:"expires_in"`
	}
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil || body.AccessToken == "" {
		return "", 0, errors.New("token metadata tidak valid")
	}
	return body.AccessToken, time.Duration(body.ExpiresIn) * time.Second, nil
}

// url membentuk endpoint Gemini; sse=true untuk streaming.
func (a *geminiAuth) url(cfg config.Config, model, method string, sse bool) string {
	if a.vertex {
		u := fmt.Sprintf("https://%s-aiplatform.googleapis.com/v1/projects/%s/locations/%s/publishers/google/models/%s:%s",
			cfg.Location, cfg.ProjectID, cfg.Location, normalizeVertexModel(model), method)
		if sse {
			u += "?alt=sse"
		}
		return u
	}
	u := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/%s:%s?key=%s", model, method, a.apiKey)
	if sse {
		u += "&alt=sse"
	}
	return u
}

func (a *geminiAuth) sign(req *http.Request) {
	req.Header.Set("Content-Type", "application/json")
	if a.vertex {
		req.Header.Set("Authorization", "Bearer "+a.token)
	}
}
