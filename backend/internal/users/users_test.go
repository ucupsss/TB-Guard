package users_test

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"

	"tbguard/backend/internal/config"
	"tbguard/backend/internal/data"
	"tbguard/backend/internal/db"
	"tbguard/backend/internal/users"
)

// Tes integrasi ke PostgreSQL asli; hanya jalan bila DATABASE_URL tersedia. Baris uji dibersihkan di akhir.
func TestLoginRolesAndLookup(t *testing.T) {
	cfg := config.Load()
	if os.Getenv("DATABASE_URL") == "" {
		t.Skip("DATABASE_URL tidak diset")
	}
	suffix := fmt.Sprint(time.Now().UnixNano())
	admin, viewer := "it-admin-"+suffix+"@gmail.com", "it-viewer-"+suffix+"@gmail.com"
	cfg.AdminEmails = map[string]bool{admin: true}

	d := db.New(cfg)
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()
	go d.Connect(ctx, data.Migrate(false), users.Migrate)
	for d.Pool() == nil {
		time.Sleep(200 * time.Millisecond)
		if ctx.Err() != nil {
			t.Fatal("database tidak siap")
		}
	}
	defer func() {
		d.Pool().Exec(context.Background(), "DELETE FROM users WHERE email = ANY($1)", []string{admin, viewer})
		d.Pool().Exec(context.Background(), "DELETE FROM audit_log WHERE actor = ANY($1)", []string{admin, viewer})
		d.Close()
	}()
	svc := users.New(cfg, d)

	a, err := svc.Login(ctx, admin, "Admin Tes", "http://x/p.png")
	if err != nil || a.Role != "Admin" {
		t.Fatalf("ADMIN_EMAILS harus Admin: %+v %v", a, err)
	}
	v, err := svc.Login(ctx, viewer, "Viewer", "")
	if err != nil || v.Role != "Petugas" {
		t.Fatalf("akun lain harus Petugas (ADMIN_EMAILS terisi, tanpa bootstrap): %+v %v", v, err)
	}
	if _, err := svc.Login(ctx, viewer, "Viewer Baru", ""); err != nil {
		t.Fatal(err)
	}
	got, err := svc.Lookup(ctx, viewer)
	if err != nil || got.Name != "Viewer Baru" || got.Role != "Petugas" {
		t.Fatalf("lookup salah: %+v %v", got, err)
	}
	var n int
	d.Pool().QueryRow(ctx, "SELECT login_count FROM users WHERE email=$1", viewer).Scan(&n)
	if n != 2 {
		t.Fatalf("login_count harus 2, dapat %d", n)
	}
	var logins int
	d.Pool().QueryRow(ctx, "SELECT COUNT(*) FROM audit_log WHERE actor=$1 AND action='login'", viewer).Scan(&logins)
	if logins != 2 {
		t.Fatalf("audit login harus 2, dapat %d", logins)
	}
}
