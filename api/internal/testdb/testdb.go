// Package testdb gives each test its own throwaway PostgreSQL database, cloned from a
// migrated + seeded template. Cloning (CREATE DATABASE … TEMPLATE) takes milliseconds, so every
// test starts from identical data and tests in different packages can run in parallel.
//
// Set TEST_DATABASE_URL to a server you may create databases on
// (default: postgres:///postgres?sslmode=disable). Tests are skipped if it is unreachable.
package testdb

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io/fs"
	"net/url"
	"os"
	"path/filepath"
	"runtime"
	"sort"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/Zenkiux/eneba-marketplace/api/internal/db"
	"github.com/Zenkiux/eneba-marketplace/api/internal/keys"
	"github.com/Zenkiux/eneba-marketplace/api/internal/seed"
	"github.com/Zenkiux/eneba-marketplace/api/migrations"
)

// Key is the encryption key used for seeded test data.
var Key = []byte("test-only-key-0123456789abcdefgh")

func baseURL() string {
	if u := os.Getenv("TEST_DATABASE_URL"); u != "" {
		return u
	}
	return "postgres:///postgres?sslmode=disable"
}

func withDB(base, name string) string {
	u, err := url.Parse(base)
	if err != nil {
		panic(err)
	}
	u.Path = "/" + name
	return u.String()
}

// fingerprint changes whenever migrations or seed code change, forcing a template rebuild.
func fingerprint() string {
	h := sha256.New()
	entries, _ := fs.ReadDir(migrations.FS, ".")
	for _, e := range entries {
		b, _ := fs.ReadFile(migrations.FS, e.Name())
		h.Write(b)
	}
	_, file, _, _ := runtime.Caller(0)
	seedDir := filepath.Join(filepath.Dir(file), "..", "seed")
	files, _ := filepath.Glob(filepath.Join(seedDir, "*.go"))
	sort.Strings(files)
	for _, f := range files {
		b, _ := os.ReadFile(f)
		h.Write(b)
	}
	return hex.EncodeToString(h.Sum(nil))[:16]
}

// New returns a pool connected to a fresh copy of the seeded template database.
func New(t testing.TB) *pgxpool.Pool {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	admin, err := pgx.Connect(ctx, baseURL())
	if err != nil {
		t.Skipf("test database unavailable (%v); set TEST_DATABASE_URL", err)
	}
	defer admin.Close(context.Background())

	tpl := "eneba_tpl_" + fingerprint()
	if err := ensureTemplate(ctx, admin, tpl); err != nil {
		t.Fatalf("template: %v", err)
	}
	b := make([]byte, 6)
	rand.Read(b)
	name := "eneba_t_" + hex.EncodeToString(b)
	if _, err := admin.Exec(ctx, fmt.Sprintf(`CREATE DATABASE %s TEMPLATE %s`, name, tpl)); err != nil {
		t.Fatalf("create test db: %v", err)
	}
	pool, err := db.Open(ctx, withDB(baseURL(), name))
	if err != nil {
		t.Fatalf("open test db: %v", err)
	}
	t.Cleanup(func() {
		pool.Close()
		c, err := pgx.Connect(context.Background(), baseURL())
		if err == nil {
			c.Exec(context.Background(), fmt.Sprintf(`DROP DATABASE IF EXISTS %s WITH (FORCE)`, name))
			c.Close(context.Background())
		}
	})
	return pool
}

// ensureTemplate builds the template once; an advisory lock stops parallel packages racing.
func ensureTemplate(ctx context.Context, admin *pgx.Conn, tpl string) error {
	if _, err := admin.Exec(ctx, `SELECT pg_advisory_lock(727274)`); err != nil {
		return err
	}
	defer admin.Exec(context.Background(), `SELECT pg_advisory_unlock(727274)`)

	var exists bool
	if err := admin.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = $1)`, tpl).Scan(&exists); err != nil || exists {
		return err
	}
	// Drop stale templates from earlier schema versions.
	rows, _ := admin.Query(ctx, `SELECT datname FROM pg_database WHERE datname LIKE 'eneba_tpl_%'`)
	old, _ := pgx.CollectRows(rows, pgx.RowTo[string])
	for _, o := range old {
		admin.Exec(ctx, fmt.Sprintf(`DROP DATABASE IF EXISTS %s WITH (FORCE)`, o))
	}
	if _, err := admin.Exec(ctx, fmt.Sprintf(`CREATE DATABASE %s`, tpl)); err != nil {
		return err
	}
	// If building fails, don't leave a half-built template behind: it would be reused (and look
	// empty) by every later run with the same fingerprint.
	ok := false
	defer func() {
		if !ok {
			admin.Exec(context.Background(), fmt.Sprintf(`DROP DATABASE IF EXISTS %s WITH (FORCE)`, tpl))
		}
	}()
	pool, err := db.Open(ctx, withDB(baseURL(), tpl))
	if err != nil {
		return err
	}
	defer pool.Close()
	if err := db.Migrate(ctx, pool); err != nil {
		return err
	}
	box, err := keys.NewBox(Key)
	if err != nil {
		return err
	}
	if _, err = seed.Run(ctx, pool, box, seed.Options{}); err != nil {
		return err
	}
	ok = true
	return nil
}
