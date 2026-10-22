package storage

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"time"

	"tbguard/backend/internal/config"
)

// Klien S3 minimal (path-style, SigV4) untuk Neon Object Storage: PUT, DELETE, dan presigned GET.
// Cukup stdlib; tidak perlu AWS SDK.

type s3Client struct {
	endpoint *url.URL
	bucket   string
	region   string
	akid     string
	secret   string
	http     *http.Client
}

func newS3(cfg config.Config, hc *http.Client) *s3Client {
	if cfg.S3Endpoint == "" || cfg.S3AccessKey == "" || cfg.S3Secret == "" {
		return nil
	}
	u, err := url.Parse(cfg.S3Endpoint)
	if err != nil || u.Host == "" {
		return nil
	}
	return &s3Client{endpoint: u, bucket: cfg.S3Bucket, region: cfg.S3Region, akid: cfg.S3AccessKey, secret: cfg.S3Secret, http: hc}
}

// uriEncode: encoding SigV4 (hanya unreserved yang tidak di-escape); '/' dipertahankan untuk path.
func uriEncode(s string, keepSlash bool) string {
	var b strings.Builder
	for i := 0; i < len(s); i++ {
		c := s[i]
		switch {
		case c >= 'A' && c <= 'Z', c >= 'a' && c <= 'z', c >= '0' && c <= '9', c == '-', c == '_', c == '.', c == '~':
			b.WriteByte(c)
		case c == '/' && keepSlash:
			b.WriteByte(c)
		default:
			fmt.Fprintf(&b, "%%%02X", c)
		}
	}
	return b.String()
}

func hmacSHA(key []byte, data string) []byte {
	h := hmac.New(sha256.New, key)
	h.Write([]byte(data))
	return h.Sum(nil)
}

func (c *s3Client) signingKey(date string) []byte {
	k := hmacSHA([]byte("AWS4"+c.secret), date)
	k = hmacSHA(k, c.region)
	k = hmacSHA(k, "s3")
	return hmacSHA(k, "aws4_request")
}

func (c *s3Client) objectPath(key string) string {
	return strings.TrimRight(c.endpoint.Path, "/") + "/" + uriEncode(c.bucket, false) + "/" + uriEncode(key, true)
}

func sha256Hex(b []byte) string {
	h := sha256.Sum256(b)
	return hex.EncodeToString(h[:])
}

// do mengirim request bertanda tangan header (Authorization).
func (c *s3Client) do(ctx context.Context, method, key string, body []byte, contentType string) (*http.Response, error) {
	now := time.Now().UTC()
	amzDate, date := now.Format("20060102T150405Z"), now.Format("20060102")
	payload := sha256Hex(body)
	path := c.objectPath(key)

	hdrs := map[string]string{"host": c.endpoint.Host, "x-amz-content-sha256": payload, "x-amz-date": amzDate}
	if contentType != "" {
		hdrs["content-type"] = contentType
	}
	names := make([]string, 0, len(hdrs))
	for k := range hdrs {
		names = append(names, k)
	}
	sort.Strings(names)
	var canon strings.Builder
	for _, k := range names {
		canon.WriteString(k + ":" + hdrs[k] + "\n")
	}
	signed := strings.Join(names, ";")
	creq := strings.Join([]string{method, path, "", canon.String(), signed, payload}, "\n")
	scope := date + "/" + c.region + "/s3/aws4_request"
	sts := "AWS4-HMAC-SHA256\n" + amzDate + "\n" + scope + "\n" + sha256Hex([]byte(creq))
	sig := hex.EncodeToString(hmacSHA(c.signingKey(date), sts))

	u := *c.endpoint
	u.Path, u.RawPath = "", ""
	req, err := http.NewRequestWithContext(ctx, method, u.Scheme+"://"+u.Host+path, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("x-amz-content-sha256", payload)
	req.Header.Set("x-amz-date", amzDate)
	if contentType != "" {
		req.Header.Set("Content-Type", contentType)
	}
	req.Header.Set("Authorization", fmt.Sprintf("AWS4-HMAC-SHA256 Credential=%s/%s, SignedHeaders=%s, Signature=%s", c.akid, scope, signed, sig))
	return c.http.Do(req)
}

func (c *s3Client) Put(ctx context.Context, key, contentType string, body []byte) error {
	res, err := c.do(ctx, http.MethodPut, key, body, contentType)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.StatusCode/100 != 2 {
		b, _ := io.ReadAll(io.LimitReader(res.Body, 512))
		return fmt.Errorf("s3 put %d: %s", res.StatusCode, strings.TrimSpace(string(b)))
	}
	return nil
}

func (c *s3Client) Delete(ctx context.Context, key string) error {
	res, err := c.do(ctx, http.MethodDelete, key, nil, "")
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.StatusCode/100 != 2 && res.StatusCode != http.StatusNotFound {
		return fmt.Errorf("s3 delete %d", res.StatusCode)
	}
	return nil
}

// PresignGet membuat URL unduh berumur pendek; tidak perlu lewat backend.
func (c *s3Client) PresignGet(key string, ttl time.Duration) string {
	now := time.Now().UTC()
	amzDate, date := now.Format("20060102T150405Z"), now.Format("20060102")
	scope := date + "/" + c.region + "/s3/aws4_request"
	path := c.objectPath(key)
	q := map[string]string{
		"X-Amz-Algorithm":     "AWS4-HMAC-SHA256",
		"X-Amz-Credential":    c.akid + "/" + scope,
		"X-Amz-Date":          amzDate,
		"X-Amz-Expires":       fmt.Sprint(int(ttl.Seconds())),
		"X-Amz-SignedHeaders": "host",
	}
	keys := make([]string, 0, len(q))
	for k := range q {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	parts := make([]string, len(keys))
	for i, k := range keys {
		parts[i] = uriEncode(k, false) + "=" + uriEncode(q[k], false)
	}
	query := strings.Join(parts, "&")
	creq := strings.Join([]string{"GET", path, query, "host:" + c.endpoint.Host + "\n", "host", "UNSIGNED-PAYLOAD"}, "\n")
	sts := "AWS4-HMAC-SHA256\n" + amzDate + "\n" + scope + "\n" + sha256Hex([]byte(creq))
	sig := hex.EncodeToString(hmacSHA(c.signingKey(date), sts))
	return c.endpoint.Scheme + "://" + c.endpoint.Host + path + "?" + query + "&X-Amz-Signature=" + sig
}
