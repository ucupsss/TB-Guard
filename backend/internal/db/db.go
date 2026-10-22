// Package db mengelola koneksi PostgreSQL (Neon) dan handler HTTP yang butuh database.
package db

import (
	"compress/gzip"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"tbguard/backend/internal/config"
	"tbguard/backend/internal/httpx"
)

// Func adalah handler yang menerima pool yang sudah siap dan context ber-timeout.
type Func func(ctx context.Context, pool *pgxpool.Pool, r *http.Request) (any, error)

// Migrator dijalankan sekali setelah koneksi berhasil (skema, seed).
type Migrator func(ctx context.Context, pool *pgxpool.Pool) error

type DB struct {
	cfg  config.Config
	pool atomicPool
}

func New(cfg config.Config) *DB { return &DB{cfg: cfg} }

// Pool mengembalikan pool, atau nil bila belum siap.
func (d *DB) Pool() *pgxpool.Pool { return d.pool.Load() }

func (d *DB) Close() {
	if p := d.pool.Load(); p != nil {
		p.Close()
	}
}

func (d *DB) dsn() string {
	c := d.cfg
	if c.DatabaseURL != "" {
		return c.DatabaseURL
	}
	if c.DBHost == "" {
		return ""
	}
	// format keyword/value mendukung host berupa path unix socket
	return fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		quoteKV(c.DBHost), c.DBPort, quoteKV(c.DBUser), quoteKV(c.DBPassword), quoteKV(c.DBName), c.DBSSLMode)
}

func quoteKV(s string) string {
	r := []byte{'\''}
	for i := 0; i < len(s); i++ {
		if s[i] == '\'' || s[i] == '\\' {
			r = append(r, '\\')
		}
		r = append(r, s[i])
	}
	return string(append(r, '\''))
}

// Connect berjalan di background supaya Cloud Run cepat siap; handler membalas 503 sampai DB siap.
// Neon men-suspend compute saat idle, jadi koneksi pertama bisa gagal dan diulang dengan jeda bertahap.
func (d *DB) Connect(ctx context.Context, migrators ...Migrator) {
	dsn := d.dsn()
	if dsn == "" {
		slog.Warn("database tidak dikonfigurasi (DATABASE_URL); endpoint data nonaktif")
		return
	}
	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		slog.Error("DSN database tidak valid", "err", err)
		return
	}
	// Neon pooler (PgBouncer, transaction mode): jangan cache prepared statement per koneksi
	cfg.ConnConfig.DefaultQueryExecMode = pgx.QueryExecModeExec
	// batasi koneksi per instance agar total (instance Cloud Run x ini) tidak melewati batas Neon
	cfg.MaxConns = int32(d.cfg.DBMaxConns)
	cfg.MaxConnIdleTime = 5 * time.Minute
	cfg.MaxConnLifetime = time.Hour

	for attempt := 1; ctx.Err() == nil; attempt++ {
		pool, err := pgxpool.NewWithConfig(ctx, cfg)
		if err == nil {
			for _, m := range migrators {
				if err = m(ctx, pool); err != nil {
					break
				}
			}
			if err != nil {
				pool.Close()
			}
		}
		if err == nil {
			d.pool.Store(pool)
			slog.Info("database siap")
			return
		}
		wait := time.Duration(min(attempt, 6)) * 2 * time.Second
		slog.Warn("koneksi/migrasi database gagal, mencoba lagi", "err", err, "dalam", wait.String())
		select {
		case <-time.After(wait):
		case <-ctx.Done():
		}
	}
}

// Handler membungkus Func: cek DB siap, timeout 10 detik, terjemah error, dan gzip untuk klien yang mendukung.
func (d *DB) Handler(fn Func) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		pool := d.pool.Load()
		if pool == nil {
			httpx.JSON(w, http.StatusServiceUnavailable, map[string]string{"error": "Database belum siap"})
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
		defer cancel()
		out, err := fn(ctx, pool, r)
		if err != nil {
			httpx.WriteErr(w, MapErr(err))
			return
		}
		if strings.Contains(r.Header.Get("Accept-Encoding"), "gzip") {
			w.Header().Set("Content-Type", "application/json; charset=utf-8")
			w.Header().Set("Content-Encoding", "gzip")
			w.Header().Add("Vary", "Accept-Encoding")
			gz := gzip.NewWriter(w)
			_ = json.NewEncoder(gz).Encode(out)
			_ = gz.Close()
			return
		}
		httpx.JSON(w, http.StatusOK, out)
	}
}

// MapErr: pelanggaran unik/cek menjadi 409/400 yang bermakna; error lain dibiarkan (500).
func MapErr(err error) error {
	var he httpx.Error
	if errors.As(err, &he) {
		return err
	}
	var pe interface{ SQLState() string }
	if errors.As(err, &pe) {
		switch pe.SQLState() {
		case "23505":
			return httpx.Errf(http.StatusConflict, "Data dengan ID tersebut sudah ada")
		case "23514", "22P02", "23502":
			return httpx.Errf(http.StatusBadRequest, "Nilai tidak valid")
		}
	}
	if errors.Is(err, pgx.ErrNoRows) {
		return httpx.Errf(http.StatusNotFound, "Data tidak ditemukan")
	}
	return err
}
