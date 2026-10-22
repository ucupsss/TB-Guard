package orchestra_test

import (
	"context"
	"os"
	"testing"
	"time"

	"tbguard/backend/internal/config"
	"tbguard/backend/internal/db"
	"tbguard/backend/internal/orchestra"
)

// Tes integrasi ke PostgreSQL asli (butuh DATABASE_URL): skema valid dan rekaman milik orang lain tidak bisa ditimpa.
func TestSchemaAndOwnerIsolation(t *testing.T) {
	if os.Getenv("DATABASE_URL") == "" {
		t.Skip("DATABASE_URL tidak diset")
	}
	d := db.New(config.Load())
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()
	go d.Connect(ctx, orchestra.Migrate)
	for d.Pool() == nil {
		time.Sleep(200 * time.Millisecond)
		if ctx.Err() != nil {
			t.Fatal("database tidak siap")
		}
	}
	defer d.Close()
	p := d.Pool()
	id := "it-run-" + time.Now().Format("150405.000")
	defer p.Exec(context.Background(), "DELETE FROM orchestra_runs WHERE id=$1", id)

	upsert := `INSERT INTO orchestra_runs (id, owner, source, prompt, steps, total_ms, tokens, created_at)
		VALUES ($1,$2,'live','p','[]'::jsonb,1,1,1)
		ON CONFLICT (id) DO UPDATE SET total_ms=99 WHERE orchestra_runs.owner = EXCLUDED.owner`
	if tag, err := p.Exec(ctx, upsert, id, "a@gmail.com"); err != nil || tag.RowsAffected() != 1 {
		t.Fatalf("insert: %v %v", tag, err)
	}
	if tag, _ := p.Exec(ctx, upsert, id, "b@gmail.com"); tag.RowsAffected() != 0 {
		t.Fatal("pengguna lain tidak boleh menimpa rekaman")
	}
	if _, err := p.Exec(ctx, "INSERT INTO orchestra_runs (id, owner, source, created_at) VALUES ($1,'a@gmail.com','bogus',1)", id+"x"); err == nil {
		t.Fatal("source tidak valid harus ditolak oleh CHECK")
	}
}
