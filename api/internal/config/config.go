// Package config reads runtime settings from environment variables.
package config

import (
	"encoding/base64"
	"errors"
	"fmt"
	"os"
	"strings"
)

type Config struct {
	Env            string   // "dev" or "prod"
	Addr           string   // listen address, e.g. ":8080"
	DatabaseURL    string   // PostgreSQL connection string
	KeyEncryption  []byte   // 32 bytes for AES-256-GCM (digital keys at rest)
	TrustedOrigins []string // origins allowed to send state-changing requests
	StaticDir      string   // if set, also serve the built frontend from this folder (single-origin hosting)
}

func (c Config) Prod() bool { return c.Env == "prod" }

// Load reads the environment. Development has safe defaults; production must set everything.
func Load() (Config, error) {
	c := Config{
		Env:         getenv("APP_ENV", "dev"),
		Addr:        getenv("LISTEN_ADDR", ":"+getenv("PORT", "8080")),
		StaticDir:   os.Getenv("STATIC_DIR"),
		DatabaseURL: getenv("DATABASE_URL", "postgres:///eneba?sslmode=disable"),
	}
	if c.Env != "dev" && c.Env != "prod" {
		return c, fmt.Errorf("APP_ENV must be dev or prod, got %q", c.Env)
	}
	rawKey := os.Getenv("KEY_ENCRYPTION_KEY")
	if rawKey == "" {
		if c.Prod() {
			return c, errors.New("KEY_ENCRYPTION_KEY is required in prod")
		}
		// Fixed development key so seeded keys survive restarts locally. Never used in prod.
		rawKey = base64.StdEncoding.EncodeToString([]byte("dev-only-key-0123456789abcdefghi"))
	}
	key, err := base64.StdEncoding.DecodeString(rawKey)
	if err != nil || len(key) != 32 {
		return c, errors.New("KEY_ENCRYPTION_KEY must be 32 bytes, base64-encoded")
	}
	c.KeyEncryption = key

	origins := getenv("TRUSTED_ORIGINS", "")
	if origins == "" && !c.Prod() {
		origins = "http://localhost:5173,http://127.0.0.1:5173"
	}
	for _, o := range strings.Split(origins, ",") {
		if o = strings.TrimSpace(o); o != "" {
			c.TrustedOrigins = append(c.TrustedOrigins, o)
		}
	}
	if c.Prod() && len(c.TrustedOrigins) == 0 {
		return c, errors.New("TRUSTED_ORIGINS is required in prod")
	}
	return c, nil
}

func getenv(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}
