// Package orchestra menyimpan rekaman jalannya Orchestra AI (chat live dan simulasi) di PostgreSQL.
// Rekaman milik pengguna yang membuatnya; dipakai untuk memutar ulang alur kerja seperti transkrip percakapan.
package orchestra

import (
	"context"
	_ "embed"
	"encoding/json"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"tbguard/backend/internal/auth"
	"tbguard/backend/internal/db"
	"tbguard/backend/internal/httpx"
)

//go:embed schema.sql
var schemaSQL string

const (
	maxRunsPerUser = 100
	maxPayload     = 256 << 10
	maxText        = 400
)

var idRe = regexp.MustCompile(`^[A-Za-z0-9_-]{6,80}$`)

// Migrate membuat tabel rekaman (idempoten).
func Migrate(ctx context.Context, pool *pgxpool.Pool) error {
	tx, err := pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if _, err := tx.Exec(ctx, "SELECT pg_advisory_xact_lock(727008)"); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, schemaSQL); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

type Service struct{ db *db.DB }

func New(d *db.DB) *Service { return &Service{db: d} }

func owner(r *http.Request) string { return auth.UserFrom(r.Context()).Email }

func clip(s string, n int) string {
	s = strings.Join(strings.Fields(s), " ")
	if r := []rune(s); len(r) > n {
		return string(r[:n])
	}
	return s
}

// List: ringkasan rekaman milik pengguna, terbaru dulu.
func (s *Service) List() http.HandlerFunc {
	return s.db.Handler(func(ctx context.Context, pool *pgxpool.Pool, r *http.Request) (any, error) {
		rows, err := pool.Query(ctx, `SELECT id, source, scenario, prompt, jsonb_array_length(steps), total_ms, tokens, created_at
			FROM orchestra_runs WHERE owner=$1 ORDER BY created_at DESC LIMIT 100`, owner(r))
		if err != nil {
			return nil, err
		}
		defer rows.Close()
		type item struct {
			ID        string `json:"id"`
			Source    string `json:"source"`
			Scenario  string `json:"scenario"`
			Prompt    string `json:"prompt"`
			Steps     int    `json:"steps"`
			TotalMs   int    `json:"totalMs"`
			Tokens    int    `json:"tokens"`
			CreatedAt int64  `json:"createdAt"`
		}
		out := []item{}
		for rows.Next() {
			var it item
			if err := rows.Scan(&it.ID, &it.Source, &it.Scenario, &it.Prompt, &it.Steps, &it.TotalMs, &it.Tokens, &it.CreatedAt); err != nil {
				return nil, err
			}
			out = append(out, it)
		}
		return map[string]any{"runs": out}, rows.Err()
	})
}

// Get: satu rekaman lengkap milik pengguna.
func (s *Service) Get() http.HandlerFunc {
	return s.db.Handler(func(ctx context.Context, pool *pgxpool.Pool, r *http.Request) (any, error) {
		var run struct {
			ID        string          `json:"id"`
			Source    string          `json:"source"`
			Scenario  string          `json:"scenario"`
			Prompt    string          `json:"prompt"`
			Steps     json.RawMessage `json:"steps"`
			TotalMs   int             `json:"totalMs"`
			Tokens    int             `json:"tokens"`
			CreatedAt int64           `json:"createdAt"`
		}
		err := pool.QueryRow(ctx, "SELECT id,source,scenario,prompt,steps,total_ms,tokens,created_at FROM orchestra_runs WHERE id=$1 AND owner=$2",
			r.PathValue("id"), owner(r)).Scan(&run.ID, &run.Source, &run.Scenario, &run.Prompt, &run.Steps, &run.TotalMs, &run.Tokens, &run.CreatedAt)
		if err != nil {
			return nil, err // ErrNoRows -> 404 lewat db.MapErr
		}
		return run, nil
	})
}

// Save: upsert rekaman (id dari path, dibuat klien agar penyimpanan ulang tidak menggandakan). Kepemilikan dipaksa dari sesi.
func (s *Service) Save() http.HandlerFunc {
	return s.db.Handler(func(ctx context.Context, pool *pgxpool.Pool, r *http.Request) (any, error) {
		id := r.PathValue("id")
		if !idRe.MatchString(id) {
			return nil, httpx.Errf(http.StatusBadRequest, "ID rekaman tidak valid")
		}
		var body struct {
			Source   string          `json:"source"`
			Scenario string          `json:"scenario"`
			Prompt   string          `json:"prompt"`
			Steps    json.RawMessage `json:"steps"`
			TotalMs  int             `json:"totalMs"`
			Tokens   int             `json:"tokens"`
		}
		r.Body = http.MaxBytesReader(nil, r.Body, maxPayload)
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			return nil, httpx.Errf(http.StatusRequestEntityTooLarge, "Rekaman terlalu besar atau bukan JSON")
		}
		if body.Source != "live" && body.Source != "simulation" {
			return nil, httpx.Errf(http.StatusBadRequest, "source harus live atau simulation")
		}
		if !strings.HasPrefix(strings.TrimSpace(string(body.Steps)), "[") {
			return nil, httpx.Errf(http.StatusBadRequest, "steps harus berupa array")
		}
		who, now := owner(r), time.Now().UnixMilli()
		tx, err := pool.Begin(ctx)
		if err != nil {
			return nil, err
		}
		defer tx.Rollback(ctx)
		if _, err := tx.Exec(ctx, "SELECT pg_advisory_xact_lock(hashtext($1))", "orch:"+who); err != nil {
			return nil, err
		}
		tag, err := tx.Exec(ctx, `INSERT INTO orchestra_runs (id, owner, source, scenario, prompt, steps, total_ms, tokens, created_at)
			VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9)
			ON CONFLICT (id) DO UPDATE SET steps=EXCLUDED.steps, total_ms=EXCLUDED.total_ms, tokens=EXCLUDED.tokens
			WHERE orchestra_runs.owner = EXCLUDED.owner`,
			id, who, body.Source, clip(body.Scenario, 40), clip(body.Prompt, maxText), string(body.Steps), max(body.TotalMs, 0), max(body.Tokens, 0), now)
		if err != nil {
			return nil, err
		}
		if tag.RowsAffected() == 0 {
			return nil, httpx.Errf(http.StatusForbidden, "Rekaman ini bukan milik Anda")
		}
		if _, err := tx.Exec(ctx, `DELETE FROM orchestra_runs WHERE owner=$1 AND id IN (
			SELECT id FROM orchestra_runs WHERE owner=$1 ORDER BY created_at DESC OFFSET $2)`, who, maxRunsPerUser); err != nil {
			return nil, err
		}
		if err := tx.Commit(ctx); err != nil {
			return nil, err
		}
		return map[string]any{"ok": true}, nil
	})
}

// Remove: hapus satu rekaman milik pengguna.
func (s *Service) Remove() http.HandlerFunc {
	return s.db.Handler(func(ctx context.Context, pool *pgxpool.Pool, r *http.Request) (any, error) {
		_, err := pool.Exec(ctx, "DELETE FROM orchestra_runs WHERE id=$1 AND owner=$2", r.PathValue("id"), owner(r))
		return map[string]any{"ok": true}, err
	})
}
