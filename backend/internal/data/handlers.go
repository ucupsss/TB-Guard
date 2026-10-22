package data

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/jackc/pgx/v5/pgxpool"

	"tbguard/backend/internal/db"
	"tbguard/backend/internal/httpx"
)

// Handlers: CRUD perangkat, deteksi, dan pasien di PostgreSQL.
type Handlers struct{ db *db.DB }

func NewHandlers(d *db.DB) *Handlers { return &Handlers{db: d} }

func readBody(w http.ResponseWriter, r *http.Request) (map[string]any, error) {
	var body map[string]any
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, httpx.MaxBody)).Decode(&body); err != nil || body == nil {
		return nil, httpx.Errf(http.StatusBadRequest, "Body bukan objek JSON")
	}
	return body, nil
}

// pkValue mengubah path param ke tipe kunci utama entity.
func pkValue(e Entity, raw string) (any, error) {
	if e.pk.typ == tInt {
		n, err := strconv.ParseInt(raw, 10, 64)
		if err != nil {
			return nil, httpx.Errf(http.StatusBadRequest, "ID tidak valid")
		}
		return n, nil
	}
	return raw, nil
}

func (e Entity) list(ctx context.Context, pool *pgxpool.Pool) ([]map[string]any, error) {
	rows, err := pool.Query(ctx, e.selectSQL())
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []map[string]any{}
	for rows.Next() {
		vals, err := rows.Values()
		if err != nil {
			return nil, err
		}
		m := make(map[string]any, len(vals))
		for i, v := range vals {
			m[e.cols[i].json] = v
		}
		out = append(out, m)
	}
	return out, rows.Err()
}

// Bootstrap mengembalikan seluruh data awal dalam satu respons (gzip bila didukung).
func (h *Handlers) Bootstrap() http.HandlerFunc {
	return h.db.Handler(func(ctx context.Context, pool *pgxpool.Pool, _ *http.Request) (any, error) {
		out := map[string]any{}
		for key, e := range map[string]Entity{"devices": DeviceEntity, "detections": DetectionEntity, "patients": PatientEntity} {
			rows, err := e.list(ctx, pool)
			if err != nil {
				return nil, err
			}
			out[key] = rows
		}
		ds := map[string][]json.RawMessage{"webform": {}, "offline": {}, "primer": {}}
		rows, err := pool.Query(ctx, "SELECT kind, data FROM dataset_rows ORDER BY seq ASC")
		if err != nil {
			return nil, err
		}
		defer rows.Close()
		for rows.Next() {
			var kind string
			var data []byte
			if err := rows.Scan(&kind, &data); err != nil {
				return nil, err
			}
			ds[kind] = append(ds[kind], data)
		}
		out["datasets"] = ds
		return out, rows.Err()
	})
}

func (h *Handlers) Create(e Entity) http.HandlerFunc {
	return h.db.Handler(func(ctx context.Context, pool *pgxpool.Pool, r *http.Request) (any, error) {
		body, err := readBody(nil, r)
		if err != nil {
			return nil, err
		}
		q, args, err := e.insertSQL(body)
		if err != nil {
			return nil, httpx.Errf(http.StatusBadRequest, err.Error())
		}
		if _, err := pool.Exec(ctx, q, args...); err != nil {
			return nil, err
		}
		return map[string]any{"ok": true}, nil
	})
}

func (h *Handlers) Patch(e Entity) http.HandlerFunc {
	return h.db.Handler(func(ctx context.Context, pool *pgxpool.Pool, r *http.Request) (any, error) {
		pk, err := pkValue(e, r.PathValue("id"))
		if err != nil {
			return nil, err
		}
		body, err := readBody(nil, r)
		if err != nil {
			return nil, err
		}
		q, args, err := e.updateSQL(pk, body)
		if err != nil {
			return nil, httpx.Errf(http.StatusBadRequest, err.Error())
		}
		tag, err := pool.Exec(ctx, q, args...)
		if err != nil {
			return nil, err
		}
		if tag.RowsAffected() == 0 {
			return nil, httpx.Errf(http.StatusNotFound, "Data tidak ditemukan")
		}
		return map[string]any{"ok": true}, nil
	})
}

func (h *Handlers) Remove(e Entity) http.HandlerFunc {
	return h.db.Handler(func(ctx context.Context, pool *pgxpool.Pool, r *http.Request) (any, error) {
		pk, err := pkValue(e, r.PathValue("id"))
		if err != nil {
			return nil, err
		}
		if _, err := pool.Exec(ctx, "DELETE FROM "+e.table+" WHERE "+e.pk.db+"=$1", pk); err != nil {
			return nil, err
		}
		return map[string]any{"ok": true}, nil
	})
}

func (h *Handlers) RemoveDetections() http.HandlerFunc {
	return h.db.Handler(func(ctx context.Context, pool *pgxpool.Pool, r *http.Request) (any, error) {
		var body struct {
			UUIDs []string `json:"uuids"`
		}
		if err := json.NewDecoder(http.MaxBytesReader(nil, r.Body, httpx.MaxBody)).Decode(&body); err != nil {
			return nil, httpx.Errf(http.StatusBadRequest, "Body bukan JSON")
		}
		tag, err := pool.Exec(ctx, "DELETE FROM detections WHERE uuid = ANY($1)", body.UUIDs)
		if err != nil {
			return nil, err
		}
		return map[string]any{"ok": true, "deleted": tag.RowsAffected()}, nil
	})
}
