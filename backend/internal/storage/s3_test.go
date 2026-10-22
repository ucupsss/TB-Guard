package storage

import (
	"context"
	"io"
	"net/http"
	"os"
	"testing"
	"time"

	"tbguard/backend/internal/config"
)

// Tes langsung ke Neon Object Storage; hanya jalan bila S3_LIVE=1 dan kredensial S3 ada di environment.
func TestS3LiveRoundTrip(t *testing.T) {
	c := newS3(config.Load(), http.DefaultClient)
	if c == nil || os.Getenv("S3_LIVE") == "" {
		t.Skip("set S3_LIVE=1 dengan kredensial S3 untuk tes langsung")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	key := "tests/" + randomHex(6) + ".webm"
	if err := c.Put(ctx, key, "audio/webm", []byte("halo")); err != nil {
		t.Fatal(err)
	}
	defer c.Delete(ctx, key)
	res, err := http.Get(c.PresignGet(key, time.Minute))
	if err != nil {
		t.Fatal(err)
	}
	b, _ := io.ReadAll(res.Body)
	res.Body.Close()
	if res.StatusCode != 200 || string(b) != "halo" {
		t.Fatalf("presigned GET: %d %q", res.StatusCode, b)
	}
}

func TestCanonicalType(t *testing.T) {
	if canonicalType("Audio/WebM; codecs=opus") != "audio/webm" {
		t.Fatal("parameter harus dipangkas")
	}
}
