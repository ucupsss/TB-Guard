package httpx

import (
	"testing"
	"time"
)

func TestLimiter(t *testing.T) {
	l := NewLimiter(2, 50*time.Millisecond)
	if !l.Allow("a") || !l.Allow("a") || l.Allow("a") {
		t.Fatal("batas 2 per jendela tidak berlaku")
	}
	if !l.Allow("b") {
		t.Fatal("kunci berbeda tidak boleh terpengaruh")
	}
	time.Sleep(60 * time.Millisecond)
	if !l.Allow("a") {
		t.Fatal("harus pulih setelah jendela lewat")
	}
}
