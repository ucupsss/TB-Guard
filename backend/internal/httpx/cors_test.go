package httpx

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// Regresi: preflight HARUS mengizinkan semua metode yang dipakai route API (PUT dipakai simpan chat dan rekaman Orchestra).
func TestCORSPreflightAllowsAllAPIMethods(t *testing.T) {
	h := CORS([]string{"https://app.example"}, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(200) }))
	req := httptest.NewRequest(http.MethodOptions, "/api/chats/x", nil)
	req.Header.Set("Origin", "https://app.example")
	req.Header.Set("Access-Control-Request-Method", "PUT")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	allowed := rec.Header().Get("Access-Control-Allow-Methods")
	for _, m := range []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"} {
		if !strings.Contains(allowed, m) {
			t.Errorf("metode %s tidak diizinkan: %q", m, allowed)
		}
	}
	if !strings.Contains(rec.Header().Get("Access-Control-Allow-Headers"), "Authorization") {
		t.Error("header Authorization harus diizinkan")
	}
	if rec.Header().Get("Access-Control-Allow-Origin") != "https://app.example" {
		t.Error("origin harus dipantulkan")
	}
}
