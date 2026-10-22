package auth

import (
	"context"
	"crypto"
	"crypto/hmac"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"log/slog"
	"math/big"
	"net/http"
	"strings"
	"sync"
	"tbguard/backend/internal/httpx"
	"time"
)

// Login hanya lewat Google Sign-In dan hanya akun @gmail.com. Tanpa username/password.
// Backend memverifikasi ID token Google (tanda tangan RS256, iss, aud, exp, email_verified),
// lalu menerbitkan sesi bertanda tangan HMAC (stateless, aman untuk banyak instance Cloud Run).

const sessionTTL = 7 * 24 * time.Hour

type User struct {
	Email string `json:"email"`
	Name  string `json:"name"`
	Role  string `json:"role"`
	Exp   int64  `json:"exp,omitempty"`
}

type ctxKey struct{}

func UserFrom(ctx context.Context) User {
	u, _ := ctx.Value(ctxKey{}).(User)
	return u
}

// ---- token sesi ------------------------------------------------------------

func (s *Service) signSession(u User) string {
	u.Exp = time.Now().Add(sessionTTL).Unix()
	payload, _ := json.Marshal(u)
	p := base64.RawURLEncoding.EncodeToString(payload)
	return p + "." + s.mac(p)
}

func (s *Service) mac(p string) string {
	h := hmac.New(sha256.New, s.cfg.SessionSecret)
	h.Write([]byte(p))
	return base64.RawURLEncoding.EncodeToString(h.Sum(nil))
}

func (s *Service) parseSession(tok string) (User, error) {
	var u User
	p, sig, ok := strings.Cut(tok, ".")
	if !ok || !hmac.Equal([]byte(sig), []byte(s.mac(p))) {
		return u, errors.New("sesi tidak valid")
	}
	raw, err := base64.RawURLEncoding.DecodeString(p)
	if err != nil || json.Unmarshal(raw, &u) != nil || u.Exp < time.Now().Unix() {
		return u, errors.New("sesi kedaluwarsa")
	}
	return u, nil
}

// RequireAuth membungkus handler: wajib header "Authorization: Bearer <token sesi>".
func (s *Service) RequireAuth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		tok, _ := strings.CutPrefix(r.Header.Get("Authorization"), "Bearer ")
		u, err := s.parseSession(tok)
		if tok == "" || err != nil {
			httpx.JSON(w, http.StatusUnauthorized, map[string]string{"error": "Silakan masuk dengan akun Gmail"})
			return
		}
		next(w, r.WithContext(context.WithValue(r.Context(), ctxKey{}, u)))
	}
}

// ---- verifikasi ID token Google -------------------------------------------

type jwks struct {
	mu      sync.Mutex
	keys    map[string]*rsa.PublicKey
	expires time.Time
}

func (j *jwks) get(ctx context.Context, client *http.Client, kid string) (*rsa.PublicKey, error) {
	j.mu.Lock()
	defer j.mu.Unlock()
	if k, ok := j.keys[kid]; ok && time.Now().Before(j.expires) {
		return k, nil
	}
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, "https://www.googleapis.com/oauth2/v3/certs", nil)
	res, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	var body struct {
		Keys []struct{ Kid, N, E string } `json:"keys"`
	}
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		return nil, err
	}
	keys := map[string]*rsa.PublicKey{}
	for _, k := range body.Keys {
		n, err1 := base64.RawURLEncoding.DecodeString(k.N)
		e, err2 := base64.RawURLEncoding.DecodeString(k.E)
		if err1 != nil || err2 != nil {
			continue
		}
		keys[k.Kid] = &rsa.PublicKey{N: new(big.Int).SetBytes(n), E: int(new(big.Int).SetBytes(e).Int64())}
	}
	j.keys, j.expires = keys, time.Now().Add(time.Hour)
	if k, ok := keys[kid]; ok {
		return k, nil
	}
	return nil, errors.New("kunci penanda tangan tidak dikenal")
}

type googleClaims struct {
	Iss           string `json:"iss"`
	Aud           string `json:"aud"`
	Exp           int64  `json:"exp"`
	Email         string `json:"email"`
	EmailVerified any    `json:"email_verified"` // bool atau "true"
	Name          string `json:"name"`
	HD            string `json:"hd"`
}

func (s *Service) verifyGoogleToken(ctx context.Context, idToken string) (*googleClaims, error) {
	parts := strings.Split(idToken, ".")
	if len(parts) != 3 {
		return nil, errors.New("token bukan JWT")
	}
	var hdr struct{ Alg, Kid string }
	hb, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil || json.Unmarshal(hb, &hdr) != nil || hdr.Alg != "RS256" {
		return nil, errors.New("header token tidak valid")
	}
	key, err := s.jwks.get(ctx, s.http, hdr.Kid)
	if err != nil {
		return nil, err
	}
	sig, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil {
		return nil, errors.New("tanda tangan rusak")
	}
	sum := sha256.Sum256([]byte(parts[0] + "." + parts[1]))
	if rsa.VerifyPKCS1v15(key, crypto.SHA256, sum[:], sig) != nil {
		return nil, errors.New("tanda tangan token salah")
	}
	pb, err := base64.RawURLEncoding.DecodeString(parts[1])
	var c googleClaims
	if err != nil || json.Unmarshal(pb, &c) != nil {
		return nil, errors.New("isi token rusak")
	}
	verified := c.EmailVerified == true || c.EmailVerified == "true"
	switch {
	case c.Iss != "accounts.google.com" && c.Iss != "https://accounts.google.com":
		return nil, errors.New("penerbit token salah")
	case c.Aud != s.cfg.GoogleClientID:
		return nil, errors.New("token bukan untuk aplikasi ini")
	case c.Exp < time.Now().Unix():
		return nil, errors.New("token kedaluwarsa")
	case !verified:
		return nil, errors.New("email belum terverifikasi")
	}
	return &c, nil
}

func isGmail(email string) bool {
	at := strings.LastIndexByte(email, '@')
	return at > 0 && strings.EqualFold(email[at+1:], "gmail.com")
}

func (s *Service) HandleGoogleLogin(w http.ResponseWriter, r *http.Request) {
	if s.cfg.GoogleClientID == "" {
		httpx.JSON(w, http.StatusServiceUnavailable, map[string]string{"error": "Login belum dikonfigurasi (GOOGLE_CLIENT_ID)"})
		return
	}
	var body struct {
		Credential string `json:"credential"`
	}
	if json.NewDecoder(http.MaxBytesReader(w, r.Body, 16<<10)).Decode(&body) != nil || body.Credential == "" {
		httpx.JSON(w, http.StatusBadRequest, map[string]string{"error": "Credential Google kosong"})
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 8*time.Second)
	defer cancel()
	c, err := s.verifyGoogleToken(ctx, body.Credential)
	if err != nil {
		slog.Warn("login ditolak", "err", err)
		httpx.JSON(w, http.StatusUnauthorized, map[string]string{"error": "Token Google tidak valid"})
		return
	}
	email := strings.ToLower(strings.TrimSpace(c.Email))
	if !isGmail(email) || c.HD != "" {
		httpx.JSON(w, http.StatusForbidden, map[string]string{"error": "Hanya akun @gmail.com yang diizinkan"})
		return
	}
	if len(s.cfg.AllowedEmails) > 0 && !s.cfg.AllowedEmails[email] {
		httpx.JSON(w, http.StatusForbidden, map[string]string{"error": "Akun ini belum diizinkan"})
		return
	}
	role := "Admin"
	if len(s.cfg.AdminEmails) > 0 && !s.cfg.AdminEmails[email] {
		role = "Petugas"
	}
	u := User{Email: email, Name: nameOr(c.Name, email), Role: role}
	httpx.JSON(w, http.StatusOK, map[string]any{"token": s.signSession(u), "user": u, "expiresIn": int(sessionTTL.Seconds())})
}

// RequireAdmin: hanya peran Admin yang boleh mengubah data; peran lain read-only.
// Pakai di dalam RequireAuth: RequireAuth(RequireAdmin(h)).
func (s *Service) RequireAdmin(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if UserFrom(r.Context()).Role != "Admin" {
			httpx.JSON(w, http.StatusForbidden, map[string]string{"error": "Hanya Admin yang boleh mengubah data"})
			return
		}
		next(w, r)
	}
}

func (s *Service) HandleMe(w http.ResponseWriter, r *http.Request) {
	u := UserFrom(r.Context())
	httpx.JSON(w, http.StatusOK, map[string]any{"user": User{Email: u.Email, Name: u.Name, Role: u.Role}})
}

func randomHex(n int) string {
	b := make([]byte, n)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

func nameOr(name, email string) string {
	if name != "" {
		return name
	}
	return strings.Split(email, "@")[0]
}
