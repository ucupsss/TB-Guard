// Package users menyimpan akun Gmail di PostgreSQL: peran, status aktif, riwayat login, dan jejak aktivitas (audit).
package users

import (
	"context"
	_ "embed"
	"errors"
	"log/slog"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"tbguard/backend/internal/auth"
	"tbguard/backend/internal/config"
	"tbguard/backend/internal/db"
	"tbguard/backend/internal/httpx"
)

//go:embed schema.sql
var schemaSQL string

// Migrate membuat tabel users + audit_log dan kolom atribusi pada tabel data. Dijalankan SETELAH data.Migrate.
func Migrate(ctx context.Context, pool *pgxpool.Pool) error {
	tx, err := pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if _, err := tx.Exec(ctx, "SELECT pg_advisory_xact_lock(727005)"); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, schemaSQL); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

type cached struct {
	u   auth.User
	exp time.Time
}

// Service mengimplementasikan auth.Directory dan endpoint manajemen pengguna.
type Service struct {
	cfg   config.Config
	db    *db.DB
	mu    sync.Mutex
	cache map[string]cached
}

func New(cfg config.Config, d *db.DB) *Service {
	return &Service{cfg: cfg, db: d, cache: map[string]cached{}}
}

const lookupTTL = 20 * time.Second // perubahan peran/status berlaku paling lambat sekian detik di semua instance

func (s *Service) forget(email string) {
	s.mu.Lock()
	delete(s.cache, email)
	s.mu.Unlock()
}

// Login mencatat login (membuat akun bila baru). Akun pertama menjadi Admin; ADMIN_EMAILS selalu Admin;
// sisanya Petugas (hanya-baca) sampai dinaikkan oleh Admin. Bila ADMIN_EMAILS diisi, tidak ada "akun pertama"
// otomatis Admin (mencegah pihak lain merebut peran Admin).
func (s *Service) Login(ctx context.Context, email, name, picture string) (auth.User, error) {
	pool := s.db.Pool()
	if pool == nil {
		return auth.User{}, auth.ErrDirectoryDown
	}
	tx, err := pool.Begin(ctx)
	if err != nil {
		return auth.User{}, err
	}
	defer tx.Rollback(ctx)
	if _, err := tx.Exec(ctx, "SELECT pg_advisory_xact_lock(727006)"); err != nil {
		return auth.User{}, err
	}
	now := time.Now().UnixMilli()
	forceAdmin := s.cfg.AdminEmails[email]
	var u auth.User
	err = tx.QueryRow(ctx, `
		INSERT INTO users (email, name, picture, role, created_at, last_login_at, login_count)
		VALUES ($1, $2, $3, CASE WHEN $4 OR ($6 AND NOT EXISTS (SELECT 1 FROM users)) THEN 'Admin' ELSE 'Petugas' END, $5, $5, 1)
		ON CONFLICT (email) DO UPDATE SET
			name = EXCLUDED.name, picture = EXCLUDED.picture, last_login_at = EXCLUDED.last_login_at,
			login_count = users.login_count + 1,
			role = CASE WHEN $4 THEN 'Admin' ELSE users.role END
		RETURNING email, name, picture, role, disabled`, email, name, picture, forceAdmin, now, len(s.cfg.AdminEmails) == 0).
		Scan(&u.Email, &u.Name, &u.Picture, &u.Role, &u.Disabled)
	if err != nil {
		return auth.User{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return auth.User{}, err
	}
	s.forget(email)
	if !u.Disabled {
		Audit(ctx, pool, email, "login", "users", email)
	}
	return u, nil
}

// Lookup mengambil akun terbaru (cache 20 detik) agar perubahan peran/penonaktifan cepat berlaku.
func (s *Service) Lookup(ctx context.Context, email string) (auth.User, error) {
	s.mu.Lock()
	if c, ok := s.cache[email]; ok && time.Now().Before(c.exp) {
		s.mu.Unlock()
		return c.u, nil
	}
	s.mu.Unlock()
	pool := s.db.Pool()
	if pool == nil {
		return auth.User{}, auth.ErrDirectoryDown
	}
	var u auth.User
	err := pool.QueryRow(ctx, "SELECT email, name, picture, role, disabled FROM users WHERE email=$1", email).
		Scan(&u.Email, &u.Name, &u.Picture, &u.Role, &u.Disabled)
	if errors.Is(err, pgx.ErrNoRows) {
		return auth.User{}, auth.ErrUnknownUser
	}
	if err != nil {
		return auth.User{}, err
	}
	s.mu.Lock()
	s.cache[email] = cached{u, time.Now().Add(lookupTTL)}
	s.mu.Unlock()
	return u, nil
}

// Audit mencatat aksi pengguna (best-effort: kegagalan hanya dicatat di log, tidak membatalkan aksi).
func Audit(ctx context.Context, pool *pgxpool.Pool, actor, action, entity, entityID string) {
	if len(entityID) > 200 {
		entityID = entityID[:200]
	}
	if _, err := pool.Exec(context.WithoutCancel(ctx), "INSERT INTO audit_log (at, actor, action, entity, entity_id) VALUES ($1,$2,$3,$4,$5)",
		time.Now().UnixMilli(), actor, action, entity, entityID); err != nil {
		slog.Warn("audit gagal", "err", err)
	}
}

// ---- endpoint Admin --------------------------------------------------------

type row struct {
	Email       string `json:"email"`
	Name        string `json:"name"`
	Picture     string `json:"picture"`
	Role        string `json:"role"`
	Disabled    bool   `json:"disabled"`
	CreatedAt   int64  `json:"createdAt"`
	LastLoginAt int64  `json:"lastLoginAt"`
	LoginCount  int    `json:"loginCount"`
}

func (s *Service) List() http.HandlerFunc {
	return s.db.Handler(func(ctx context.Context, pool *pgxpool.Pool, _ *http.Request) (any, error) {
		rows, err := pool.Query(ctx, "SELECT email,name,picture,role,disabled,created_at,last_login_at,login_count FROM users ORDER BY last_login_at DESC")
		if err != nil {
			return nil, err
		}
		defer rows.Close()
		out := []row{}
		for rows.Next() {
			var r row
			if err := rows.Scan(&r.Email, &r.Name, &r.Picture, &r.Role, &r.Disabled, &r.CreatedAt, &r.LastLoginAt, &r.LoginCount); err != nil {
				return nil, err
			}
			out = append(out, r)
		}
		return map[string]any{"users": out}, rows.Err()
	})
}

// otherAdmins: jumlah Admin aktif selain email ini (menjaga agar selalu ada minimal satu Admin).
func otherAdmins(ctx context.Context, pool *pgxpool.Pool, email string) (int, error) {
	var n int
	err := pool.QueryRow(ctx, "SELECT COUNT(*) FROM users WHERE role='Admin' AND NOT disabled AND email<>$1", email).Scan(&n)
	return n, err
}

func (s *Service) Patch() http.HandlerFunc {
	return s.db.Handler(func(ctx context.Context, pool *pgxpool.Pool, r *http.Request) (any, error) {
		target := strings.ToLower(r.PathValue("email"))
		actor := auth.UserFrom(r.Context()).Email
		var body struct {
			Role     *string `json:"role"`
			Disabled *bool   `json:"disabled"`
		}
		if err := httpx.Decode(r, &body); err != nil {
			return nil, err
		}
		if body.Role == nil && body.Disabled == nil {
			return nil, httpx.Errf(http.StatusBadRequest, "Tidak ada perubahan")
		}
		if body.Role != nil && *body.Role != "Admin" && *body.Role != "Petugas" {
			return nil, httpx.Errf(http.StatusBadRequest, "Peran harus Admin atau Petugas")
		}
		if target == actor {
			return nil, httpx.Errf(http.StatusBadRequest, "Tidak bisa mengubah akun sendiri")
		}
		demote := (body.Role != nil && *body.Role != "Admin") || (body.Disabled != nil && *body.Disabled)
		if demote {
			if n, err := otherAdmins(ctx, pool, target); err != nil {
				return nil, err
			} else if n == 0 {
				return nil, httpx.Errf(http.StatusConflict, "Harus tersisa minimal satu Admin aktif")
			}
		}
		tag, err := pool.Exec(ctx, "UPDATE users SET role=COALESCE($2, role), disabled=COALESCE($3, disabled) WHERE email=$1", target, body.Role, body.Disabled)
		if err != nil {
			return nil, err
		}
		if tag.RowsAffected() == 0 {
			return nil, httpx.Errf(http.StatusNotFound, "Pengguna tidak ditemukan")
		}
		s.forget(target)
		Audit(ctx, pool, actor, "update", "users", target)
		return map[string]any{"ok": true}, nil
	})
}

func (s *Service) Remove() http.HandlerFunc {
	return s.db.Handler(func(ctx context.Context, pool *pgxpool.Pool, r *http.Request) (any, error) {
		target := strings.ToLower(r.PathValue("email"))
		actor := auth.UserFrom(r.Context()).Email
		if target == actor {
			return nil, httpx.Errf(http.StatusBadRequest, "Tidak bisa menghapus akun sendiri")
		}
		if n, err := otherAdmins(ctx, pool, target); err != nil {
			return nil, err
		} else if n == 0 {
			return nil, httpx.Errf(http.StatusConflict, "Harus tersisa minimal satu Admin aktif")
		}
		if _, err := pool.Exec(ctx, "DELETE FROM users WHERE email=$1", target); err != nil {
			return nil, err
		}
		s.forget(target)
		Audit(ctx, pool, actor, "delete", "users", target)
		return map[string]any{"ok": true}, nil
	})
}

// Activity: 100 aktivitas terbaru semua pengguna.
func (s *Service) Activity() http.HandlerFunc {
	return s.db.Handler(func(ctx context.Context, pool *pgxpool.Pool, _ *http.Request) (any, error) {
		rows, err := pool.Query(ctx, "SELECT at, actor, action, entity, entity_id FROM audit_log ORDER BY at DESC, id DESC LIMIT 100")
		if err != nil {
			return nil, err
		}
		defer rows.Close()
		type item struct {
			At       int64  `json:"at"`
			Actor    string `json:"actor"`
			Action   string `json:"action"`
			Entity   string `json:"entity"`
			EntityID string `json:"entityId"`
		}
		out := []item{}
		for rows.Next() {
			var it item
			if err := rows.Scan(&it.At, &it.Actor, &it.Action, &it.Entity, &it.EntityID); err != nil {
				return nil, err
			}
			out = append(out, it)
		}
		return map[string]any{"activity": out}, rows.Err()
	})
}
