package auth

import (
	"net/http"

	"tbguard/backend/internal/config"
)

// Service: login Google (@gmail.com saja) dan sesi bertanda tangan HMAC.
type Service struct {
	cfg  config.Config
	http *http.Client
	jwks jwks
}

func New(cfg config.Config, hc *http.Client) *Service { return &Service{cfg: cfg, http: hc} }
