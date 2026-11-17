// Package app wires every module into one HTTP handler. Kept out of main so tests can run the
// whole stack (middleware, cross-origin protection, routes) against a test database.
package app

import (
	"context"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/Zenkiux/eneba-marketplace/api/internal/auth"
	"github.com/Zenkiux/eneba-marketplace/api/internal/cart"
	"github.com/Zenkiux/eneba-marketplace/api/internal/catalog"
	"github.com/Zenkiux/eneba-marketplace/api/internal/compat"
	"github.com/Zenkiux/eneba-marketplace/api/internal/config"
	"github.com/Zenkiux/eneba-marketplace/api/internal/home"
	"github.com/Zenkiux/eneba-marketplace/api/internal/httpx"
	"github.com/Zenkiux/eneba-marketplace/api/internal/keys"
	"github.com/Zenkiux/eneba-marketplace/api/internal/money"
	"github.com/Zenkiux/eneba-marketplace/api/internal/orders"
)

// NewRouter builds the HTTP handler. The order service is returned too so main can run its
// background sweeper.
func NewRouter(cfg config.Config, pool *pgxpool.Pool) (http.Handler, *orders.Service, error) {
	mux := http.NewServeMux()
	mux.Handle("GET /api/healthz", httpx.Handler(func(w http.ResponseWriter, r *http.Request) error {
		ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
		defer cancel()
		if err := pool.Ping(ctx); err != nil {
			return httpx.NewError(http.StatusServiceUnavailable, "db_unavailable", "Database unavailable")
		}
		httpx.JSON(w, http.StatusOK, map[string]string{"status": "ok"})
		return nil
	}))

	authHandler := auth.NewHandler(auth.NewService(pool), auth.CookieFor(cfg.Prod()), cfg.Prod())
	authHandler.Register(mux)
	catalog.NewHandler(catalog.NewStore(pool)).Register(mux)
	cart.NewHandler(cart.NewStore(pool)).Register(mux)
	compat.NewHandler(cfg.Prod()).Register(mux)
	money.Register(mux)
	box, err := keys.NewBox(cfg.KeyEncryption)
	if err != nil {
		return nil, nil, err
	}
	orderSvc := orders.NewService(pool, box)
	orders.NewHandler(orderSvc).Register(mux)
	home.NewHandler(pool).Register(mux)
	mux.Handle("/api/", httpx.Handler(func(w http.ResponseWriter, r *http.Request) error { return httpx.ErrNotFound }))
	if cfg.StaticDir != "" {
		mux.Handle("/", staticSite(cfg.StaticDir))
	}

	// Cross-site request protection for every state-changing request (Go 1.25+): rejects
	// non-GET/HEAD/OPTIONS requests whose Sec-Fetch-Site / Origin show another origin, unless that
	// origin is explicitly trusted. Together with SameSite=Lax cookies and JSON-only bodies this
	// is our CSRF defence.
	cop := http.NewCrossOriginProtection()
	for _, o := range cfg.TrustedOrigins {
		if err := cop.AddTrustedOrigin(o); err != nil {
			return nil, nil, err
		}
	}
	cop.SetDenyHandler(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		httpx.Fail(w, r, httpx.NewError(http.StatusForbidden, "cross_origin", "Cross-origin request blocked"))
	}))
	return securityHeaders(cfg.Prod(), logRequests(cop.Handler(authHandler.Middleware(catalog.SourceMiddleware(mux))))), orderSvc, nil
}

func securityHeaders(prod bool, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h := w.Header()
		h.Set("X-Content-Type-Options", "nosniff")
		if strings.HasPrefix(r.URL.Path, "/api/") {
			h.Set("Cache-Control", "no-store") // API responses can be user-specific
			h.Set("Referrer-Policy", "no-referrer")
		}
		if prod {
			// Behind Cloudflare: send plain-HTTP visitors to HTTPS (the session cookie is Secure-only).
			if r.Header.Get("X-Forwarded-Proto") == "http" {
				http.Redirect(w, r, "https://"+r.Host+r.URL.RequestURI(), http.StatusMovedPermanently)
				return
			}
			h.Set("X-Robots-Tag", "noindex, nofollow") // shared by link only; keep it out of search engines
			h.Set("Strict-Transport-Security", "max-age=31536000")
		}
		next.ServeHTTP(w, r)
	})
}

type statusWriter struct {
	http.ResponseWriter
	status int
}

func (s *statusWriter) WriteHeader(code int) { s.status = code; s.ResponseWriter.WriteHeader(code) }

func logRequests(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		sw := &statusWriter{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(sw, r)
		slog.Info("http", "method", r.Method, "path", r.URL.Path, "status", sw.status, "ms", time.Since(start).Milliseconds())
	})
}
