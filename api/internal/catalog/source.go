package catalog

import (
	"context"
	"net/http"
)

// Catalog sources. "demo" is our original fictional catalog and the default; "eneba" is an
// optional snapshot of eneba.com listings that a visitor can switch to (X-Catalog header).
const (
	SourceDemo  = "demo"
	SourceEneba = "eneba"
)

type sourceKey struct{}

// SourceFrom returns the catalog selected for this request.
func SourceFrom(ctx context.Context) string {
	if s, ok := ctx.Value(sourceKey{}).(string); ok {
		return s
	}
	return SourceDemo
}

func WithSource(ctx context.Context, s string) context.Context {
	return context.WithValue(ctx, sourceKey{}, s)
}

// SourceMiddleware reads the X-Catalog header. Anything other than "eneba" means the demo catalog.
func SourceMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("X-Catalog") == SourceEneba {
			r = r.WithContext(WithSource(r.Context(), SourceEneba))
		}
		w.Header().Add("Vary", "X-Catalog")
		next.ServeHTTP(w, r)
	})
}
