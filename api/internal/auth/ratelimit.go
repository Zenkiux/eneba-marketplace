package auth

import (
	"sync"
	"time"
)

// limiter is a small fixed-window counter per key (IP or e-mail). It is in memory, so it is
// best-effort on a single server instance — enough to slow down password guessing in a demo.
type limiter struct {
	mu     sync.Mutex
	limit  int
	window time.Duration
	hits   map[string]*window
	now    func() time.Time
}

type window struct {
	start time.Time
	count int
}

func newLimiter(limit int, per time.Duration) *limiter {
	return &limiter{limit: limit, window: per, hits: map[string]*window{}, now: time.Now}
}

// Allow records an attempt for key and reports whether it is within the limit.
func (l *limiter) Allow(key string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	now := l.now()
	if len(l.hits) > 10000 { // keep memory bounded
		for k, w := range l.hits {
			if now.Sub(w.start) > l.window {
				delete(l.hits, k)
			}
		}
	}
	w, ok := l.hits[key]
	if !ok || now.Sub(w.start) > l.window {
		l.hits[key] = &window{start: now, count: 1}
		return true
	}
	w.count++
	return w.count <= l.limit
}
