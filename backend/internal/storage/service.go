// Package storage menyimpan rekaman batuk di Neon Object Storage (S3-compatible) dengan batas ketat.
package storage

import (
	"context"
	"crypto/rand"
	_ "embed"
	"encoding/hex"
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"

	"tbguard/backend/internal/config"
	"tbguard/backend/internal/db"
)

//go:embed schema.sql
var schemaSQL string

type Service struct {
	cfg config.Config
	db  *db.DB
	s3  *s3Client
}

func New(cfg config.Config, database *db.DB, hc *http.Client) *Service {
	return &Service{cfg: cfg, db: database, s3: newS3(cfg, hc)}
}

// Enabled: false bila kredensial S3 belum dikonfigurasi.
func (s *Service) Enabled() bool { return s.s3 != nil }

// Migrate membuat tabel metadata unggahan (idempoten).
func Migrate(ctx context.Context, pool *pgxpool.Pool) error {
	tx, err := pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if _, err := tx.Exec(ctx, "SELECT pg_advisory_xact_lock(727003)"); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, schemaSQL); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func randomHex(n int) string {
	b := make([]byte, n)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}
