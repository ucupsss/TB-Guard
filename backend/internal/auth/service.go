package auth

import (
	"context"
	"errors"
	"net/http"

	"tbguard/backend/internal/config"
)

var (
	ErrDirectoryDown = errors.New("direktori pengguna belum siap")
	ErrUnknownUser   = errors.New("pengguna tidak terdaftar")
)

// Directory adalah penyimpanan akun (PostgreSQL). Login mencatat/membuat akun dan menentukan peran;
// Lookup mengambil peran/status terbaru agar perubahan oleh Admin langsung berlaku.
type Directory interface {
	Login(ctx context.Context, email, name, picture string) (User, error)
	Lookup(ctx context.Context, email string) (User, error)
}

// Service: login Google (@gmail.com saja) dan sesi bertanda tangan HMAC.
type Service struct {
	cfg  config.Config
	http *http.Client
	jwks jwks
	dir  Directory // nil = tanpa database (hanya tes)
}

func New(cfg config.Config, hc *http.Client) *Service { return &Service{cfg: cfg, http: hc} }

// UseDirectory memasang penyimpanan akun.
func (s *Service) UseDirectory(d Directory) { s.dir = d }
