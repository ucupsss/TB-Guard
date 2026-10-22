package chats_test

import (
	"context"
	"os"
	"testing"
	"time"

	"tbguard/backend/internal/chats"
	"tbguard/backend/internal/config"
	"tbguard/backend/internal/db"
)

// Tes integrasi ke PostgreSQL asli (butuh DATABASE_URL): isolasi kepemilikan lewat SQL yang dipakai handler.
func TestSchemaAndOwnerIsolation(t *testing.T) {
	if os.Getenv("DATABASE_URL") == "" {
		t.Skip("DATABASE_URL tidak diset")
	}
	d := db.New(config.Load())
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()
	go d.Connect(ctx, chats.Migrate)
	for d.Pool() == nil {
		time.Sleep(200 * time.Millisecond)
		if ctx.Err() != nil {
			t.Fatal("database tidak siap")
		}
	}
	defer d.Close()
	p := d.Pool()
	id := "it-chat-" + time.Now().Format("150405.000")
	defer p.Exec(context.Background(), "DELETE FROM agent_chats WHERE id=$1", id)

	upsert := `INSERT INTO agent_chats (id, owner, title, model, turns, history, tokens, created_at, updated_at)
		VALUES ($1,$2,'t','m','[]'::jsonb,'[]'::jsonb,1,1,1)
		ON CONFLICT (id) DO UPDATE SET title='diubah' WHERE agent_chats.owner = EXCLUDED.owner`
	if tag, err := p.Exec(ctx, upsert, id, "a@gmail.com"); err != nil || tag.RowsAffected() != 1 {
		t.Fatalf("insert: %v %v", tag, err)
	}
	if tag, _ := p.Exec(ctx, upsert, id, "b@gmail.com"); tag.RowsAffected() != 0 {
		t.Fatal("pengguna lain tidak boleh menimpa chat milik orang lain")
	}
	var title string
	p.QueryRow(ctx, "SELECT title FROM agent_chats WHERE id=$1", id).Scan(&title)
	if title != "t" {
		t.Fatalf("judul tidak boleh berubah oleh pengguna lain, dapat %q", title)
	}
}
