package auth

import (
	"context"
	"net/http"
	"strings"
	"testing"

	"tbguard/backend/internal/config"
)

func TestIsGmail(t *testing.T) {
	for email, want := range map[string]bool{
		"a@gmail.com": true, "A.B@GMAIL.COM": true, "a@googlemail.com": false,
		"a@gmail.com.evil.io": false, "a@evilgmail.com": false, "gmail.com": false, "": false,
	} {
		if isGmail(email) != want {
			t.Errorf("isGmail(%q) != %v", email, want)
		}
	}
}

func TestSessionRoundTripAndTamper(t *testing.T) {
	s := &Service{cfg: config.Config{SessionSecret: []byte("0123456789abcdef0123")}}
	tok := s.signSession(User{Email: "a@gmail.com", Name: "A", Role: "Admin"})
	u, err := s.parseSession(tok)
	if err != nil || u.Email != "a@gmail.com" {
		t.Fatalf("sesi valid ditolak: %v", err)
	}
	p, sig, _ := strings.Cut(tok, ".")
	if _, err := s.parseSession(p + "." + sig[:len(sig)-2] + "AA"); err == nil {
		t.Fatal("tanda tangan rusak harus ditolak")
	}
	other := &Service{cfg: config.Config{SessionSecret: []byte("ffffffffffffffffffff")}}
	if _, err := other.parseSession(tok); err == nil {
		t.Fatal("kunci berbeda harus ditolak")
	}
}

func TestRequireAuthRejectsAnonymous(t *testing.T) {
	s := &Service{cfg: config.Config{SessionSecret: []byte("0123456789abcdef0123")}}
	h := s.RequireAuth(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(204) })
	rec := newRecorder()
	h(rec, newReq(""))
	if rec.code != 401 {
		t.Fatalf("tanpa token harus 401, dapat %d", rec.code)
	}
	rec = newRecorder()
	h(rec, newReq("Bearer "+s.signSession(User{Email: "a@gmail.com"})))
	if rec.code != 204 {
		t.Fatalf("token valid harus lolos, dapat %d", rec.code)
	}
}

type fakeDir struct {
	users map[string]User
}

func (f fakeDir) Login(_ context.Context, email, name, pic string) (User, error) {
	return f.users[email], nil
}
func (f fakeDir) Lookup(_ context.Context, email string) (User, error) {
	u, ok := f.users[email]
	if !ok {
		return User{}, ErrUnknownUser
	}
	return u, nil
}

func TestRoleAndStatusComeFromDirectory(t *testing.T) {
	s := &Service{cfg: config.Config{SessionSecret: []byte("0123456789abcdef0123")}}
	s.UseDirectory(fakeDir{users: map[string]User{
		"admin@gmail.com":  {Email: "admin@gmail.com", Role: "Admin"},
		"viewer@gmail.com": {Email: "viewer@gmail.com", Role: "Petugas"},
		"off@gmail.com":    {Email: "off@gmail.com", Role: "Admin", Disabled: true},
	}})
	var gotRole string
	h := s.RequireAuth(s.RequireAdmin(func(w http.ResponseWriter, r *http.Request) { gotRole = UserFrom(r.Context()).Role; w.WriteHeader(204) }))
	call := func(email, tokRole string) int {
		rec := newRecorder()
		h(rec, newReq("Bearer "+s.signSession(User{Email: email, Role: tokRole})))
		return rec.code
	}
	if c := call("admin@gmail.com", "Petugas"); c != 204 || gotRole != "Admin" {
		t.Fatalf("peran harus dari database (naik), dapat %d %s", c, gotRole)
	}
	if c := call("viewer@gmail.com", "Admin"); c != 403 {
		t.Fatalf("token yang mengaku Admin tidak boleh menembus, dapat %d", c)
	}
	if c := call("off@gmail.com", "Admin"); c != 403 {
		t.Fatalf("akun nonaktif harus ditolak, dapat %d", c)
	}
	if c := call("ghost@gmail.com", "Admin"); c != 401 {
		t.Fatalf("akun yang sudah dihapus harus 401, dapat %d", c)
	}
}
