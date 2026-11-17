// Command server runs the marketplace REST API.
package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/Zenkiux/eneba-marketplace/api/internal/catalog"
	"github.com/Zenkiux/eneba-marketplace/api/internal/config"
	"github.com/Zenkiux/eneba-marketplace/api/internal/db"
	"github.com/Zenkiux/eneba-marketplace/api/internal/home"
	"github.com/Zenkiux/eneba-marketplace/api/internal/httpx"
	"github.com/Zenkiux/eneba-marketplace/api/internal/keys"
	"github.com/Zenkiux/eneba-marketplace/api/internal/seed"
)

func main() {
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, nil)))
	if err := run(); err != nil {
		slog.Error("server stopped", "err", err)
		os.Exit(1)
	}
}

func run() error {
	cfg, err := config.Load()
	if err != nil {
		return err
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	pool, err := db.Open(ctx, cfg.DatabaseURL)
	if err != nil {
		return err
	}
	defer pool.Close()
	if err := db.Migrate(ctx, pool); err != nil {
		return err
	}
	// Free hosting has no shell for one-off jobs, so production can seed itself on first boot.
	// Only an empty catalog is seeded: later restarts never overwrite live data.
	if os.Getenv("SEED_IF_EMPTY") == "true" {
		if err := seedIfEmpty(ctx, pool, cfg); err != nil {
			return err
		}
	}

	handler, err := newRouter(cfg, pool)
	if err != nil {
		return err
	}
	srv := &http.Server{
		Addr:              cfg.Addr,
		Handler:           handler,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
	}
	errc := make(chan error, 1)
	go func() { errc <- srv.ListenAndServe() }()
	slog.Info("listening", "addr", cfg.Addr, "env", cfg.Env)

	select {
	case err := <-errc:
		if !errors.Is(err, http.ErrServerClosed) {
			return err
		}
	case <-ctx.Done():
	}
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	return srv.Shutdown(shutdownCtx)
}

func seedIfEmpty(ctx context.Context, pool *pgxpool.Pool, cfg config.Config) error {
	var empty bool
	if err := pool.QueryRow(ctx, `SELECT NOT EXISTS (SELECT 1 FROM products)`).Scan(&empty); err != nil || !empty {
		return err
	}
	box, err := keys.NewBox(cfg.KeyEncryption)
	if err != nil {
		return err
	}
	st, err := seed.Run(ctx, pool, box, seed.Options{})
	if err != nil {
		return err
	}
	slog.Info("seeded empty database", "products", st.Products, "offers", st.Offers, "keys", st.KeysAdded)
	return nil
}

// newRouter wires every module's routes. Modules register their own handlers here as they are built.
func newRouter(cfg config.Config, pool *pgxpool.Pool) (http.Handler, error) {
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
	catalog.NewHandler(catalog.NewStore(pool)).Register(mux)
	home.NewHandler(pool).Register(mux)
	mux.Handle("/api/", httpx.Handler(func(w http.ResponseWriter, r *http.Request) error { return httpx.ErrNotFound }))

	// Cross-site request protection for every state-changing request (Go 1.25+):
	// rejects non-GET/HEAD/OPTIONS requests whose Sec-Fetch-Site / Origin show a different origin,
	// unless the origin is explicitly trusted.
	cop := http.NewCrossOriginProtection()
	for _, o := range cfg.TrustedOrigins {
		if err := cop.AddTrustedOrigin(o); err != nil {
			return nil, err
		}
	}
	cop.SetDenyHandler(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		httpx.Fail(w, r, httpx.NewError(http.StatusForbidden, "cross_origin", "Cross-origin request blocked"))
	}))
	return logRequests(cop.Handler(mux)), nil
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
