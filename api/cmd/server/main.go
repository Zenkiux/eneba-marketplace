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

	"github.com/Zenkiux/eneba-marketplace/api/internal/app"
	"github.com/Zenkiux/eneba-marketplace/api/internal/config"
	"github.com/Zenkiux/eneba-marketplace/api/internal/db"
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

	handler, orderSvc, err := app.NewRouter(cfg, pool)
	if err != nil {
		return err
	}
	go orderSvc.RunSweeper(ctx, time.Minute)
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
