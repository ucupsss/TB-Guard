package httpx

import (
	"sync"
	"time"
)

// Limiter: batas permintaan per kunci (mis. email pengguna) dengan jendela bergulir, di memori per instance.
// Cukup untuk melindungi kuota Gemini/Groq dari penyalahgunaan oleh akun yang sah.
type Limiter struct {
	mu     sync.Mutex
	max    int
	window time.Duration
	hits   map[string][]time.Time
}

func NewLimiter(max int, window time.Duration) *Limiter {
	return &Limiter{max: max, window: window, hits: map[string][]time.Time{}}
}

func (l *Limiter) Allow(key string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	now := time.Now()
	cut := now.Add(-l.window)
	h := l.hits[key][:0]
	for _, t := range l.hits[key] {
		if t.After(cut) {
			h = append(h, t)
		}
	}
	if len(h) >= l.max {
		l.hits[key] = h
		return false
	}
	l.hits[key] = append(h, now)
	if len(l.hits) > 5000 { // cegah pertumbuhan tak terbatas
		for k, v := range l.hits {
			if len(v) == 0 || v[len(v)-1].Before(cut) {
				delete(l.hits, k)
			}
		}
	}
	return true
}
