// TB-Guard backend: API data (PostgreSQL/Neon), login Gmail, agen AI (Gemini/Groq), transkripsi, dan unggahan rekaman.
// Hanya stdlib + pgx supaya image kecil dan cold start cepat di Cloud Run.
package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"tbguard/backend/internal/ai"
	"tbguard/backend/internal/auth"
	"tbguard/backend/internal/config"
	"tbguard/backend/internal/data"
	"tbguard/backend/internal/db"
	"tbguard/backend/internal/httpx"
	"tbguard/backend/internal/storage"
)

func main() {
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, nil)))
	cfg := config.Load()

	// satu http.Client untuk semua panggilan keluar: koneksi keep-alive dipakai ulang
	hc := &http.Client{Transport: &http.Transport{
		MaxIdleConns: 100, MaxIdleConnsPerHost: 32, IdleConnTimeout: 90 * time.Second, ForceAttemptHTTP2: true,
	}}

	database := db.New(cfg)
	authSvc := auth.New(cfg, hc)
	aiSvc := ai.New(cfg, hc)
	store := storage.New(cfg, database, hc)
	records := data.NewHandlers(database)

	bg, stopBg := context.WithCancel(context.Background())
	defer stopBg()
	go database.Connect(bg, data.Migrate(cfg.Seed), storage.Migrate)
	go store.Janitor(bg)

	mux := http.NewServeMux()
	protect := authSvc.RequireAuth

	// publik
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, _ *http.Request) {
		httpx.JSON(w, http.StatusOK, map[string]any{"status": "ok", "groq": aiSvc.GroqStats(), "storage": store.Enabled()})
	})
	mux.HandleFunc("GET /readyz", func(w http.ResponseWriter, _ *http.Request) {
		if database.Pool() == nil {
			httpx.JSON(w, http.StatusServiceUnavailable, map[string]string{"status": "db belum siap"})
			return
		}
		httpx.JSON(w, http.StatusOK, map[string]string{"status": "ready"})
	})
	mux.HandleFunc("POST /api/auth/google", authSvc.HandleGoogleLogin)

	// terlindungi (wajib login Gmail)
	mux.HandleFunc("GET /api/auth/me", protect(authSvc.HandleMe))
	mux.HandleFunc("GET /api/bootstrap", protect(records.Bootstrap()))
	mux.HandleFunc("POST /api/devices", protect(records.Create(data.DeviceEntity)))
	mux.HandleFunc("PATCH /api/devices/{id}", protect(records.Patch(data.DeviceEntity)))
	mux.HandleFunc("DELETE /api/devices/{id}", protect(records.Remove(data.DeviceEntity)))
	mux.HandleFunc("POST /api/detections", protect(records.Create(data.DetectionEntity)))
	mux.HandleFunc("PATCH /api/detections/{id}", protect(records.Patch(data.DetectionEntity)))
	mux.HandleFunc("POST /api/detections/delete", protect(records.RemoveDetections()))
	mux.HandleFunc("POST /api/patients", protect(records.Create(data.PatientEntity)))
	mux.HandleFunc("PATCH /api/patients/{id}", protect(records.Patch(data.PatientEntity)))
	mux.HandleFunc("DELETE /api/patients/{id}", protect(records.Remove(data.PatientEntity)))
	mux.HandleFunc("POST /api/uploads", protect(store.Upload()))
	mux.HandleFunc("GET /api/uploads/usage", protect(store.Usage()))
	mux.HandleFunc("GET /api/uploads/{id}/url", protect(store.URL()))
	mux.HandleFunc("DELETE /api/uploads/{id}", protect(store.Delete()))
	mux.HandleFunc("POST /api/agent", protect(aiSvc.HandleAgent))
	mux.HandleFunc("POST /api/agent/transcribe", protect(aiSvc.HandleTranscribe))

	var origins []string
	for _, o := range strings.Split(cfg.AllowedOrigins, ",") {
		if o = strings.TrimSpace(o); o != "" {
			origins = append(origins, o)
		}
	}

	srv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           httpx.CORS(origins, mux),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       30 * time.Second, // unggahan audio maks 25MB
		IdleTimeout:       120 * time.Second,
		// tanpa WriteTimeout: respons NDJSON di-stream, batasnya diatur deadline per request
	}
	go func() {
		slog.Info("backend siap", "addr", srv.Addr, "groq_keys", aiSvc.GroqStats()["total"], "storage", store.Enabled())
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("server berhenti", "err", err)
			os.Exit(1)
		}
	}()

	// Cloud Run mengirim SIGTERM; beri waktu stream yang sedang berjalan untuk selesai.
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	stopBg()
	_ = srv.Shutdown(ctx)
	database.Close()
}
