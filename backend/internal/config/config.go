// Package config memuat konfigurasi dari environment (12-factor).
package config

import (
	"crypto/rand"
	"log/slog"
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	Port           string
	AllowedOrigins string

	// Google Cloud / Gemini
	ProjectID      string
	Location       string
	GeminiModel    string
	GeminiLocation string // Gemini 3.x hanya tersedia di endpoint global (bukan us-central1)
	GeminiAPIKey   string
	GroqKeysFile   string
	AgentBudget    time.Duration // batas kerja total satu request agen

	// PostgreSQL (Neon). DATABASE_URL diutamakan; DB_* untuk koneksi keyword/value.
	DatabaseURL string
	DBHost      string
	DBPort      string
	DBUser      string
	DBPassword  string
	DBName      string
	DBSSLMode   string
	DBMaxConns  int
	Seed        bool // muat data contoh sekali pada database kosong

	// Login Google (hanya @gmail.com)
	GoogleClientID string
	SessionSecret  []byte
	AdminEmails    map[string]bool
	AllowedEmails  map[string]bool

	// Neon Object Storage (S3-compatible) + batas pemakaian
	S3Endpoint     string
	S3AccessKey    string
	S3Secret       string
	S3Region       string
	S3Bucket       string
	UploadMaxBytes int64
	UploadTotalMax int64
	UploadPerDay   int
	UploadTTLDays  int
	SeedAudioMax   int // jumlah rekaman simulasi yang disimpan di storage saat seed (0 = nonaktif)
}

func Load() Config {
	loadDotEnv()
	return Config{
		Port:           env("PORT", "8080"),
		AllowedOrigins: env("ALLOWED_ORIGINS", "*"),

		ProjectID:      env("GCP_PROJECT_ID", "hackathon-primestep-19"),
		Location:       env("GCP_LOCATION", "us-central1"),
		GeminiModel:    env("GEMINI_MODEL", "gemini-3.5-flash"),
		GeminiLocation: env("GEMINI_LOCATION", "global"),
		GeminiAPIKey:   env("GEMINI_API_KEY", ""),
		GroqKeysFile:   env("GROQ_KEYS_FILE", ""),
		AgentBudget:    50 * time.Second,

		DatabaseURL: env("DATABASE_URL", ""),
		DBHost:      env("DB_HOST", ""),
		DBPort:      env("DB_PORT", "5432"),
		DBUser:      env("DB_USER", "postgres"),
		DBPassword:  env("DB_PASSWORD", ""),
		DBName:      env("DB_NAME", "neondb"),
		DBSSLMode:   env("DB_SSLMODE", "require"),
		DBMaxConns:  atoi(env("DB_MAX_CONNS", "5"), 5),
		Seed:        env("DB_SEED", "true") != "false",

		GoogleClientID: env("GOOGLE_CLIENT_ID", ""),
		SessionSecret:  secretBytes(env("SESSION_SECRET", "")),
		AdminEmails:    emailSet(env("ADMIN_EMAILS", "")),
		AllowedEmails:  emailSet(env("ALLOWED_EMAILS", "")),

		S3Endpoint:     env("S3_ENDPOINT", env("AWS_ENDPOINT_URL_S3", "")),
		S3AccessKey:    env("S3_ACCESS_KEY_ID", env("AWS_ACCESS_KEY_ID", "")),
		S3Secret:       env("S3_SECRET_ACCESS_KEY", env("AWS_SECRET_ACCESS_KEY", "")),
		S3Region:       env("S3_REGION", env("AWS_REGION", "us-east-2")),
		S3Bucket:       env("S3_BUCKET", "tbguard-recordings"),
		UploadMaxBytes: int64(atoi(env("UPLOAD_MAX_BYTES", "2097152"), 2<<20)),           // 2 MB / file
		UploadTotalMax: int64(atoi(env("UPLOAD_TOTAL_MAX_BYTES", "104857600"), 100<<20)), // 100 MB total
		UploadPerDay:   atoi(env("UPLOAD_MAX_PER_DAY", "30"), 30),                        // per pengguna
		UploadTTLDays:  atoi(env("UPLOAD_TTL_DAYS", "30"), 30),
		SeedAudioMax:   atoi(env("SEED_AUDIO_MAX", "500"), 500), // ~110 KB/rekaman; cukup untuk semua deteksi contoh (~14 MB)
	}
}

func env(key, def string) string {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		return v
	}
	return def
}

func atoi(s string, def int) int {
	if n, err := strconv.Atoi(s); err == nil && n > 0 {
		return n
	}
	return def
}

func emailSet(csv string) map[string]bool {
	m := map[string]bool{}
	for _, e := range strings.Split(csv, ",") {
		if e = strings.ToLower(strings.TrimSpace(e)); e != "" {
			m[e] = true
		}
	}
	return m
}

// secretBytes memakai SESSION_SECRET; bila kosong, buat acak (sesi hilang saat restart / beda instance).
func secretBytes(s string) []byte {
	if len(s) >= 16 {
		return []byte(s)
	}
	slog.Warn("SESSION_SECRET kosong/pendek: memakai kunci acak per proses (set di Secret Manager untuk produksi)")
	b := make([]byte, 32)
	_, _ = rand.Read(b)
	return b
}

func loadDotEnv() {
	paths := []string{".env", "backend/.env", "../backend/.env", "../../backend/.env"}
	for _, p := range paths {
		data, err := os.ReadFile(p)
		if err != nil {
			continue
		}
		for _, rawLine := range strings.Split(string(data), "\n") {
			line := strings.TrimSpace(rawLine)
			if line == "" || strings.HasPrefix(line, "#") {
				continue
			}
			k, v, ok := strings.Cut(line, "=")
			if !ok {
				continue
			}
			k = strings.TrimSpace(k)
			v = strings.TrimSpace(v)
			v = strings.Trim(v, `"'`)
			if os.Getenv(k) == "" {
				os.Setenv(k, v)
			}
		}
		break
	}
}
