// Package chats menyimpan riwayat percakapan agen AI per pengguna di PostgreSQL.
// Setiap pengguna hanya bisa melihat dan mengubah chat miliknya sendiri (dibatasi owner = email sesi).
package chats

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
	maxChatsPerUser = 60
	maxPayload      = 2 << 20 // 2 MB per simpanan chat
	maxTitle        = 80
)

var idRe = regexp.MustCompile(`^[A-Za-z0-9_-]{6,40}$`)

// Migrate membuat tabel riwayat chat (idempoten).
func Migrate(ctx context.Context, pool *pgxpool.Pool) error {
	tx, err := pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if _, err := tx.Exec(ctx, "SELECT pg_advisory_xact_lock(727007)"); err != nil {
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

func cleanTitle(t string) string {
	t = strings.Join(strings.Fields(t), " ")
	if r := []rune(t); len(r) > maxTitle {
		t = string(r[:maxTitle])
	}
	return t
}

// List: ringkasan chat milik pengguna (tanpa isi percakapan), yang disematkan di atas.
func (s *Service) List() http.HandlerFunc {
	return s.db.Handler(func(ctx context.Context, pool *pgxpool.Pool, r *http.Request) (any, error) {
		rows, err := pool.Query(ctx, `SELECT id, title, pinned, model, tokens, jsonb_array_length(turns), created_at, updated_at
			FROM agent_chats WHERE owner=$1 ORDER BY pinned DESC, updated_at DESC LIMIT 100`, owner(r))
		if err != nil {
			return nil, err
		}
		defer rows.Close()
		type item struct {
			ID        string `json:"id"`
			Title     string `json:"title"`
			Pinned    bool   `json:"pinned"`
			Model     string `json:"model"`
			Tokens    int64  `json:"tokens"`
			Turns     int    `json:"turns"`
			CreatedAt int64  `json:"createdAt"`
			UpdatedAt int64  `json:"updatedAt"`
		}
		out := []item{}
		for rows.Next() {
			var it item
			if err := rows.Scan(&it.ID, &it.Title, &it.Pinned, &it.Model, &it.Tokens, &it.Turns, &it.CreatedAt, &it.UpdatedAt); err != nil {
				return nil, err
			}
			out = append(out, it)
		}
		return map[string]any{"chats": out}, rows.Err()
	})
}

// Get: isi lengkap satu chat milik pengguna.
func (s *Service) Get() http.HandlerFunc {
	return s.db.Handler(func(ctx context.Context, pool *pgxpool.Pool, r *http.Request) (any, error) {
		var c struct {
			ID      string          `json:"id"`
			Title   string          `json:"title"`
			Pinned  bool            `json:"pinned"`
			Model   string          `json:"model"`
			Tokens  int64           `json:"tokens"`
			Turns   json.RawMessage `json:"turns"`
			History json.RawMessage `json:"history"`
		}
		err := pool.QueryRow(ctx, "SELECT id,title,pinned,model,tokens,turns,history FROM agent_chats WHERE id=$1 AND owner=$2",
			r.PathValue("id"), owner(r)).Scan(&c.ID, &c.Title, &c.Pinned, &c.Model, &c.Tokens, &c.Turns, &c.History)
		if err != nil {
			return nil, err // ErrNoRows -> 404 lewat db.MapErr
		}
		return c, nil
	})
}

// Save: upsert chat (dipanggil klien setelah tiap jawaban selesai). Kepemilikan dipaksa dari sesi.
func (s *Service) Save() http.HandlerFunc {
	return s.db.Handler(func(ctx context.Context, pool *pgxpool.Pool, r *http.Request) (any, error) {
		id := r.PathValue("id")
		if !idRe.MatchString(id) {
			return nil, httpx.Errf(http.StatusBadRequest, "ID chat tidak valid")
		}
		var body struct {
			Title   string          `json:"title"`
			Model   string          `json:"model"`
			Tokens  int64           `json:"tokens"`
			Turns   json.RawMessage `json:"turns"`
			History json.RawMessage `json:"history"`
		}
		r.Body = http.MaxBytesReader(nil, r.Body, maxPayload)
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			return nil, httpx.Errf(http.StatusRequestEntityTooLarge, "Chat terlalu besar atau bukan JSON")
		}
		if !isArray(body.Turns) || !isArray(body.History) {
			return nil, httpx.Errf(http.StatusBadRequest, "turns dan history harus berupa array")
		}
		who, now := owner(r), time.Now().UnixMilli()
		tx, err := pool.Begin(ctx)
		if err != nil {
			return nil, err
		}
		defer tx.Rollback(ctx)
		if _, err := tx.Exec(ctx, "SELECT pg_advisory_xact_lock(hashtext($1))", "chats:"+who); err != nil {
			return nil, err
		}
		// ID milik pengguna lain tidak boleh ditimpa
		tag, err := tx.Exec(ctx, `INSERT INTO agent_chats (id, owner, title, model, turns, history, tokens, created_at, updated_at)
			VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$8,$8)
			ON CONFLICT (id) DO UPDATE SET title = CASE WHEN EXCLUDED.title <> '' THEN EXCLUDED.title ELSE agent_chats.title END,
				model=EXCLUDED.model, turns=EXCLUDED.turns, history=EXCLUDED.history, tokens=EXCLUDED.tokens, updated_at=EXCLUDED.updated_at
			WHERE agent_chats.owner = EXCLUDED.owner`,
			id, who, cleanTitle(body.Title), body.Model, string(body.Turns), string(body.History), body.Tokens, now)
		if err != nil {
			return nil, err
		}
		if tag.RowsAffected() == 0 {
			return nil, httpx.Errf(http.StatusForbidden, "Chat ini bukan milik Anda")
		}
		// batasi jumlah chat per pengguna: hapus yang paling lama dan tidak disematkan
		if _, err := tx.Exec(ctx, `DELETE FROM agent_chats WHERE owner=$1 AND id IN (
			SELECT id FROM agent_chats WHERE owner=$1 AND NOT pinned ORDER BY updated_at DESC OFFSET $2)`, who, maxChatsPerUser); err != nil {
			return nil, err
		}
		if err := tx.Commit(ctx); err != nil {
			return nil, err
		}
		return map[string]any{"ok": true, "updatedAt": now}, nil
	})
}

// Patch: ganti nama dan/atau sematkan chat.
func (s *Service) Patch() http.HandlerFunc {
	return s.db.Handler(func(ctx context.Context, pool *pgxpool.Pool, r *http.Request) (any, error) {
		var body struct {
			Title  *string `json:"title"`
			Pinned *bool   `json:"pinned"`
		}
		if err := httpx.Decode(r, &body); err != nil {
			return nil, err
		}
		var title *string
		if body.Title != nil {
			t := cleanTitle(*body.Title)
			if t == "" {
				return nil, httpx.Errf(http.StatusBadRequest, "Judul tidak boleh kosong")
			}
			title = &t
		}
		if title == nil && body.Pinned == nil {
			return nil, httpx.Errf(http.StatusBadRequest, "Tidak ada perubahan")
		}
		tag, err := pool.Exec(ctx, "UPDATE agent_chats SET title=COALESCE($3,title), pinned=COALESCE($4,pinned) WHERE id=$1 AND owner=$2",
			r.PathValue("id"), owner(r), title, body.Pinned)
		if err != nil {
			return nil, err
		}
		if tag.RowsAffected() == 0 {
			return nil, httpx.Errf(http.StatusNotFound, "Chat tidak ditemukan")
		}
		return map[string]any{"ok": true}, nil
	})
}

// Remove: hapus satu chat; RemoveAll: hapus semua chat milik pengguna.
func (s *Service) Remove() http.HandlerFunc {
	return s.db.Handler(func(ctx context.Context, pool *pgxpool.Pool, r *http.Request) (any, error) {
		_, err := pool.Exec(ctx, "DELETE FROM agent_chats WHERE id=$1 AND owner=$2", r.PathValue("id"), owner(r))
		return map[string]any{"ok": true}, err
	})
}

func (s *Service) RemoveAll() http.HandlerFunc {
	return s.db.Handler(func(ctx context.Context, pool *pgxpool.Pool, r *http.Request) (any, error) {
		tag, err := pool.Exec(ctx, "DELETE FROM agent_chats WHERE owner=$1 AND NOT pinned", owner(r))
		return map[string]any{"ok": true, "deleted": tag.RowsAffected()}, err
	})
}

func isArray(b json.RawMessage) bool {
	t := strings.TrimSpace(string(b))
	return strings.HasPrefix(t, "[")
}
