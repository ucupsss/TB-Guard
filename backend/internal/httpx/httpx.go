// Package httpx berisi helper HTTP bersama: JSON, error API, dan CORS.
package httpx

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
)

// MaxBody batas ukuran body JSON.
const MaxBody = 1 << 20

func JSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

// Error adalah error yang diterjemahkan langsung menjadi respons JSON {"error": ...}.
type Error struct {
	Status int
	Msg    string
}

func (e Error) Error() string { return e.Msg }

func Errf(status int, msg string) Error { return Error{status, msg} }

// WriteErr menulis Error sebagaimana adanya; error lain dicatat dan dijawab 500 generik.
func WriteErr(w http.ResponseWriter, err error) {
	var he Error
	if errors.As(err, &he) {
		JSON(w, he.Status, map[string]string{"error": he.Msg})
		return
	}
	slog.Error("permintaan gagal", "err", err)
	JSON(w, http.StatusInternalServerError, map[string]string{"error": "Kesalahan server"})
}

// CORS mengizinkan origin frontend (daftar kosong atau "*" = semua).
func CORS(allowed []string, next http.Handler) http.Handler {
	allowAll := len(allowed) == 0 || allowed[0] == "*"
	set := make(map[string]bool, len(allowed))
	for _, o := range allowed {
		set[o] = true
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if o := r.Header.Get("Origin"); o != "" && (allowAll || set[o]) {
			h := w.Header()
			h.Set("Access-Control-Allow-Origin", o)
			h.Set("Vary", "Origin")
			h.Set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
			h.Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
			h.Set("Access-Control-Max-Age", "86400")
		}
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// Decode membaca body JSON (dibatasi MaxBody) ke v; kegagalan menjadi Error 400.
func Decode(r *http.Request, v any) error {
	if err := json.NewDecoder(http.MaxBytesReader(nil, r.Body, MaxBody)).Decode(v); err != nil {
		return Errf(http.StatusBadRequest, "Body bukan JSON yang valid")
	}
	return nil
}
