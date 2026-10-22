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
	"tbguard/backend/internal/users"
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
	userSvc := users.New(cfg, database)
	authSvc.UseDirectory(userSvc)

	bg, stopBg := context.WithCancel(context.Background())
	defer stopBg()
	go database.Connect(bg, data.Migrate(cfg.Seed), users.Migrate, storage.Migrate)
	go store.Janitor(bg)
	go store.SeedAudio(bg)

	mux := http.NewServeMux()
	protect := authSvc.RequireAuth
	admin := func(h http.HandlerFunc) http.HandlerFunc { return protect(authSvc.RequireAdmin(h)) } // tulis = Admin
	// agen & transkripsi memakai kuota Gemini/Groq: batasi per pengguna
	aiLimit := httpx.NewLimiter(40, time.Minute)
	metered := func(h http.HandlerFunc) http.HandlerFunc {
		return protect(func(w http.ResponseWriter, r *http.Request) {
			if !aiLimit.Allow(auth.UserFrom(r.Context()).Email) {
				w.Header().Set("Retry-After", "30")
				httpx.JSON(w, http.StatusTooManyRequests, map[string]string{"error": "Terlalu banyak permintaan, coba lagi sebentar"})
				return
			}
			h(w, r)
		})
	}

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
	mux.HandleFunc("GET /api/users", admin(userSvc.List()))
	mux.HandleFunc("PATCH /api/users/{email}", admin(userSvc.Patch()))
	mux.HandleFunc("DELETE /api/users/{email}", admin(userSvc.Remove()))
	mux.HandleFunc("GET /api/activity", admin(userSvc.Activity()))
	mux.HandleFunc("GET /api/bootstrap", protect(records.Bootstrap()))
	mux.HandleFunc("POST /api/devices", admin(records.Create(data.DeviceEntity)))
	mux.HandleFunc("PATCH /api/devices/{id}", admin(records.Patch(data.DeviceEntity)))
	mux.HandleFunc("DELETE /api/devices/{id}", admin(records.Remove(data.DeviceEntity)))
	mux.HandleFunc("POST /api/detections", admin(records.Create(data.DetectionEntity)))
	mux.HandleFunc("PATCH /api/detections/{id}", admin(records.Patch(data.DetectionEntity)))
	mux.HandleFunc("POST /api/detections/delete", admin(records.RemoveDetections()))
	mux.HandleFunc("POST /api/patients", admin(records.Create(data.PatientEntity)))
	mux.HandleFunc("PATCH /api/patients/{id}", admin(records.Patch(data.PatientEntity)))
	mux.HandleFunc("DELETE /api/patients/{id}", admin(records.Remove(data.PatientEntity)))
	mux.HandleFunc("GET /api/detections/{id}/audio", protect(store.DetectionAudio()))
	mux.HandleFunc("POST /api/uploads", protect(store.Upload()))
	mux.HandleFunc("GET /api/uploads/usage", protect(store.Usage()))
	mux.HandleFunc("GET /api/uploads/{id}/url", protect(store.URL()))
	mux.HandleFunc("DELETE /api/uploads/{id}", admin(store.Delete()))
	mux.HandleFunc("POST /api/agent", metered(aiSvc.HandleAgent))
	mux.HandleFunc("POST /api/agent/transcribe", metered(aiSvc.HandleTranscribe))

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
