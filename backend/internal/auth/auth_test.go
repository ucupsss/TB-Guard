package auth

import (
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
