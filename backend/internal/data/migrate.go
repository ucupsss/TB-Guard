package data

import (
	"context"
	_ "embed"
	"encoding/json"
	"fmt"
	"log/slog"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"tbguard/backend/internal/db"
)

//go:embed schema.sql
var schemaSQL string

//go:embed seed/seed.json
var seedJSON []byte

// Migrate membuat skema (idempoten) dan memuat data contoh sekali. Satu instance saja yang bekerja
// pada satu waktu (advisory lock), sehingga aman saat Cloud Run menyalakan banyak instance sekaligus.
func Migrate(seed bool) db.Migrator {
	return func(ctx context.Context, pool *pgxpool.Pool) error {
		tx, err := pool.Begin(ctx)
		if err != nil {
			return err
		}
		defer tx.Rollback(ctx)
		if _, err := tx.Exec(ctx, "SELECT pg_advisory_xact_lock(727001)"); err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, schemaSQL); err != nil {
			return fmt.Errorf("skema: %w", err)
		}
		if seed {
			tag, err := tx.Exec(ctx, "INSERT INTO meta (key) VALUES ('seeded') ON CONFLICT DO NOTHING")
			if err != nil {
				return err
			}
			if tag.RowsAffected() == 1 {
				if err := seedData(ctx, tx); err != nil {
					return fmt.Errorf("seed: %w", err)
				}
				slog.Info("data contoh dimuat")
			}
		}
		return tx.Commit(ctx)
	}
}

func seedData(ctx context.Context, tx pgx.Tx) error {
	var seed map[string][]map[string]any
	if err := json.Unmarshal(seedJSON, &seed); err != nil {
		return err
	}
	batch := &pgx.Batch{}
	add := func(e Entity, rows []map[string]any, reverse bool) error {
		for i := range rows {
			row := rows[i]
			if reverse { // tabel yang diurutkan seq DESC: sisipkan dari belakang
				row = rows[len(rows)-1-i]
			}
			q, args, err := e.insertSQL(row)
			if err != nil {
				return err
			}
			batch.Queue(q, args...)
		}
		return nil
	}
	if err := add(DeviceEntity, seed["devices"], false); err != nil {
		return err
	}
	if err := add(DetectionEntity, seed["detections"], false); err != nil {
		return err
	}
	if err := add(PatientEntity, seed["patients"], true); err != nil {
		return err
	}
	for _, kind := range []string{"webform", "offline", "primer"} {
		for _, row := range seed[kind] {
			data, _ := json.Marshal(row)
			t, _ := coerce(col{"time", "time", tMs}, row["time"])
			batch.Queue("INSERT INTO dataset_rows (kind,id,time,data) VALUES ($1,$2,$3,$4::jsonb)", kind, fmt.Sprint(row["id"]), t, string(data))
		}
	}
	res := tx.SendBatch(ctx, batch)
	defer res.Close()
	for i := 0; i < batch.Len(); i++ {
		if _, err := res.Exec(); err != nil {
			return err
		}
	}
	return nil
}
