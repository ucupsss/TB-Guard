package storage

import (
	"context"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"tbguard/backend/internal/auth"
	"tbguard/backend/internal/httpx"
)

// Unggahan rekaman batuk ke Neon Object Storage dengan batas ketat supaya tidak melewati kuota Neon:
//  - ukuran per file (UPLOAD_MAX_BYTES), total seluruh bucket (UPLOAD_TOTAL_MAX_BYTES),
//    jumlah per pengguna per hari (UPLOAD_MAX_PER_DAY), dan hanya tipe audio;
//  - umur penyimpanan (UPLOAD_TTL_DAYS): file lama dihapus otomatis oleh janitor;
//  - metadata + kuota dihitung di Postgres secara atomik (advisory lock), jadi aman untuk banyak instance.

var audioExt = map[string]string{
	"audio/wav": "wav", "audio/x-wav": "wav", "audio/webm": "webm", "audio/ogg": "ogg",
	"audio/mp4": "m4a", "audio/mpeg": "mp3",
}

// canonicalType memangkas parameter ("audio/webm;codecs=opus" -> "audio/webm").
func canonicalType(ct string) string {
	t, _, _ := strings.Cut(ct, ";")
	return strings.ToLower(strings.TrimSpace(t))
}

func (s *Service) storageReady(w http.ResponseWriter) bool {
	if s.s3 == nil {
		httpx.JSON(w, http.StatusServiceUnavailable, map[string]string{"error": "Object storage belum dikonfigurasi"})
		return false
	}
	return true
}

func (s *Service) Upload() http.HandlerFunc {
	return s.db.Handler(func(ctx context.Context, db *pgxpool.Pool, r *http.Request) (any, error) {
		if s.s3 == nil {
			return nil, httpx.Errf(http.StatusServiceUnavailable, "Object storage belum dikonfigurasi")
		}
		user := auth.UserFrom(r.Context())
		// batas keras dibaca di memori: tolak sebelum membaca isi bila Content-Length sudah melebihi
		r.Body = http.MaxBytesReader(nil, r.Body, s.cfg.UploadMaxBytes+(64<<10))
		if err := r.ParseMultipartForm(1 << 20); err != nil {
			return nil, httpx.Errf(http.StatusRequestEntityTooLarge, "File terlalu besar atau bukan multipart")
		}
		f, hdr, err := r.FormFile("file")
		if err != nil {
			return nil, httpx.Errf(http.StatusBadRequest, "Field 'file' wajib")
		}
		defer f.Close()
		ct := canonicalType(hdr.Header.Get("Content-Type"))
		ext, ok := audioExt[ct]
		if !ok {
			return nil, httpx.Errf(http.StatusUnsupportedMediaType, "Hanya file audio (wav/webm/ogg/mp4/mp3)")
		}
		data, err := io.ReadAll(io.LimitReader(f, s.cfg.UploadMaxBytes+1))
		if err != nil || len(data) == 0 {
			return nil, httpx.Errf(http.StatusBadRequest, "File kosong")
		}
		if int64(len(data)) > s.cfg.UploadMaxBytes {
			return nil, httpx.Errf(http.StatusRequestEntityTooLarge, "Ukuran file melebihi batas")
		}

		id := randomHex(12)
		now := time.Now()
		key := "recordings/" + now.UTC().Format("2006/01/02") + "/" + id + "." + ext

		// reservasi kuota secara atomik sebelum menulis ke storage
		tx, err := db.Begin(ctx)
		if err != nil {
			return nil, err
		}
		defer tx.Rollback(ctx)
		if _, err := tx.Exec(ctx, "SELECT pg_advisory_xact_lock(727002)"); err != nil {
			return nil, err
		}
		var total, today int64
		if err := tx.QueryRow(ctx, "SELECT COALESCE(SUM(size),0) FROM uploads").Scan(&total); err != nil {
			return nil, err
		}
		if total+int64(len(data)) > s.cfg.UploadTotalMax {
			return nil, httpx.Errf(http.StatusInsufficientStorage, "Kuota penyimpanan penuh, hapus rekaman lama dahulu")
		}
		dayAgo := now.Add(-24 * time.Hour).UnixMilli()
		if err := tx.QueryRow(ctx, "SELECT COUNT(*) FROM uploads WHERE owner=$1 AND created_at>$2", user.Email, dayAgo).Scan(&today); err != nil {
			return nil, err
		}
		if today >= int64(s.cfg.UploadPerDay) {
			return nil, httpx.Errf(http.StatusTooManyRequests, "Batas unggahan harian tercapai")
		}
		det := strings.TrimSpace(r.FormValue("detectionUuid"))
		if _, err := tx.Exec(ctx, "INSERT INTO uploads (id,key,owner,content_type,size,detection,created_at) VALUES ($1,$2,$3,$4,$5,NULLIF($6,''),$7)",
			id, key, user.Email, ct, int64(len(data)), det, now.UnixMilli()); err != nil {
			return nil, err
		}
		// tulis objek dulu; commit hanya jika berhasil, sehingga tidak ada baris tanpa objek
		if err := s.s3.Put(ctx, key, ct, data); err != nil {
			slog.Error("upload ke storage gagal", "err", err)
			return nil, httpx.Errf(http.StatusBadGateway, "Gagal menyimpan ke object storage")
		}
		if err := tx.Commit(ctx); err != nil {
			_ = s.s3.Delete(context.WithoutCancel(ctx), key)
			return nil, err
		}
		return map[string]any{"id": id, "size": len(data), "contentType": ct, "usedBytes": total + int64(len(data)), "maxBytes": s.cfg.UploadTotalMax}, nil
	})
}

func (s *Service) URL() http.HandlerFunc {
	return s.db.Handler(func(ctx context.Context, db *pgxpool.Pool, r *http.Request) (any, error) {
		if s.s3 == nil {
			return nil, httpx.Errf(http.StatusServiceUnavailable, "Object storage belum dikonfigurasi")
		}
		var key string
		if err := db.QueryRow(ctx, "SELECT key FROM uploads WHERE id=$1", r.PathValue("id")).Scan(&key); err != nil {
			return nil, err
		}
		const ttl = 5 * time.Minute
		return map[string]any{"url": s.s3.PresignGet(key, ttl), "expiresIn": int(ttl.Seconds())}, nil
	})
}

func (s *Service) Delete() http.HandlerFunc {
	return s.db.Handler(func(ctx context.Context, db *pgxpool.Pool, r *http.Request) (any, error) {
		if s.s3 == nil {
			return nil, httpx.Errf(http.StatusServiceUnavailable, "Object storage belum dikonfigurasi")
		}
		var key string
		if err := db.QueryRow(ctx, "SELECT key FROM uploads WHERE id=$1", r.PathValue("id")).Scan(&key); err != nil {
			return nil, err
		}
		if err := s.s3.Delete(ctx, key); err != nil {
			return nil, httpx.Errf(http.StatusBadGateway, "Gagal menghapus dari object storage")
		}
		_, err := db.Exec(ctx, "DELETE FROM uploads WHERE id=$1", r.PathValue("id"))
		return map[string]any{"ok": true}, err
	})
}

func (s *Service) Usage() http.HandlerFunc {
	return s.db.Handler(func(ctx context.Context, db *pgxpool.Pool, r *http.Request) (any, error) {
		var used, count int64
		if err := db.QueryRow(ctx, "SELECT COALESCE(SUM(size),0), COUNT(*) FROM uploads").Scan(&used, &count); err != nil {
			return nil, err
		}
		return map[string]any{
			"usedBytes": used, "maxBytes": s.cfg.UploadTotalMax, "files": count,
			"maxFileBytes": s.cfg.UploadMaxBytes, "ttlDays": s.cfg.UploadTTLDays,
		}, nil
	})
}

// janitor menghapus rekaman yang melewati umur simpan; berjalan tiap jam di background.
func (s *Service) Janitor(ctx context.Context) {
	if s.s3 == nil || s.cfg.UploadTTLDays <= 0 {
		return
	}
	tick := time.NewTicker(time.Hour)
	defer tick.Stop()
	for {
		if db := s.db.Pool(); db != nil {
			s.expireUploads(ctx, db)
		}
		select {
		case <-tick.C:
		case <-ctx.Done():
			return
		}
	}
}

func (s *Service) expireUploads(ctx context.Context, db *pgxpool.Pool) {
	cutoff := time.Now().AddDate(0, 0, -s.cfg.UploadTTLDays).UnixMilli()
	rows, err := db.Query(ctx, "SELECT id, key FROM uploads WHERE created_at < $1 LIMIT 200", cutoff)
	if err != nil {
		slog.Warn("janitor: query gagal", "err", err)
		return
	}
	type item struct{ id, key string }
	var old []item
	for rows.Next() {
		var it item
		if rows.Scan(&it.id, &it.key) == nil {
			old = append(old, it)
		}
	}
	rows.Close()
	for _, it := range old {
		if err := s.s3.Delete(ctx, it.key); err != nil {
			slog.Warn("janitor: hapus objek gagal", "key", it.key, "err", err)
			continue
		}
		_, _ = db.Exec(ctx, "DELETE FROM uploads WHERE id=$1", it.id)
	}
	if len(old) > 0 {
		slog.Info("janitor: rekaman kedaluwarsa dihapus", "jumlah", len(old))
	}
}
