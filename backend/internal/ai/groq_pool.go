package ai

import (
	"log/slog"
	"os"
	"strings"
	"sync"
	"time"
)

type groqKey struct {
	key           string
	cooldownUntil time.Time
	dead          bool
}

// groqPool memutar banyak API key Groq (round-robin) dan mengistirahatkan key yang kena limit.
type groqPool struct {
	mu   sync.Mutex
	keys []*groqKey
	next int
}

type activeKey struct {
	key          string
	index, total int
}

func newGroqPool(file string) *groqPool {
	p := &groqPool{}
	seen := map[string]bool{}
	add := func(raw string) {
		raw = strings.TrimSpace(raw)
		if len(raw) < 20 || strings.HasPrefix(raw, "#") {
			return
		}
		if !strings.HasPrefix(raw, "gsk_") {
			raw = "gsk_" + raw
		}
		if !seen[raw] {
			seen[raw] = true
			p.keys = append(p.keys, &groqKey{key: raw})
		}
	}
	// sumber: env (mis. dari Secret Manager) dan/atau file yang di-mount
	split := func(r rune) bool { return r == ',' || r == ' ' || r == '\n' || r == '\r' || r == '\t' }
	for _, f := range strings.FieldsFunc(os.Getenv("GROQ_API_KEYS")+","+os.Getenv("GROQ_API_KEY"), split) {
		add(f)
	}
	if file != "" {
		if b, err := os.ReadFile(file); err == nil {
			for _, line := range strings.Split(string(b), "\n") {
				add(line)
			}
		} else {
			slog.Warn("file groq keys tidak terbaca", "file", file, "err", err)
		}
	}
	return p
}

// get mengembalikan key yang bebas cooldown; bila semua istirahat, pilih yang paling cepat pulih.
func (p *groqPool) get() *activeKey {
	p.mu.Lock()
	defer p.mu.Unlock()
	n := len(p.keys)
	if n == 0 {
		return nil
	}
	now := time.Now()
	for i := 0; i < n; i++ {
		idx := (p.next + i) % n
		k := p.keys[idx]
		if !k.dead && !k.cooldownUntil.After(now) {
			p.next = (idx + 1) % n
			return &activeKey{k.key, idx + 1, n}
		}
	}
	best := -1
	for i, k := range p.keys {
		if k.dead {
			continue
		}
		if best < 0 || k.cooldownUntil.Before(p.keys[best].cooldownUntil) {
			best = i
		}
	}
	if best < 0 {
		return nil
	}
	p.next = (best + 1) % n
	return &activeKey{p.keys[best].key, best + 1, n}
}

func (p *groqPool) find(key string) *groqKey {
	for _, k := range p.keys {
		if k.key == key {
			return k
		}
	}
	return nil
}

func (p *groqPool) rateLimit(key string, sec float64) {
	p.mu.Lock()
	defer p.mu.Unlock()
	if k := p.find(key); k != nil {
		k.cooldownUntil = time.Now().Add(time.Duration(sec * float64(time.Second)))
	}
}

func (p *groqPool) invalidate(key string) {
	p.mu.Lock()
	defer p.mu.Unlock()
	if k := p.find(key); k != nil {
		k.dead = true
		slog.Warn("groq key dinonaktifkan permanen", "suffix", key[len(key)-6:])
	}
}

func (p *groqPool) ready() bool {
	p.mu.Lock()
	defer p.mu.Unlock()
	for _, k := range p.keys {
		if !k.dead {
			return true
		}
	}
	return false
}

func (p *groqPool) stats() map[string]int {
	p.mu.Lock()
	defer p.mu.Unlock()
	now := time.Now()
	total, ready := 0, 0
	for _, k := range p.keys {
		if k.dead {
			continue
		}
		total++
		if !k.cooldownUntil.After(now) {
			ready++
		}
	}
	return map[string]int{"total": total, "ready": ready}
}
