package auth

import (
	"net/http"
	"net/http/httptest"
)

type recorder struct {
	*httptest.ResponseRecorder
	code int
}

func newRecorder() *recorder {
	return &recorder{ResponseRecorder: httptest.NewRecorder(), code: 200}
}

func (r *recorder) WriteHeader(c int) { r.code = c; r.ResponseRecorder.WriteHeader(c) }

func newReq(authz string) *http.Request {
	req := httptest.NewRequest(http.MethodGet, "/x", nil)
	if authz != "" {
		req.Header.Set("Authorization", authz)
	}
	return req
}
