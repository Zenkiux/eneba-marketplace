package app

import (
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"
)

// Security headers for the HTML/JS/CSS of the frontend (same policy as web/vercel.json).
const contentSecurityPolicy = "default-src 'self'; img-src 'self' data: https://imgproxy.eneba.games; style-src 'self' 'unsafe-inline'; " +
	"font-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"

// staticSite serves the built single-page app from dir: real files as-is, every other path gets
// index.html so client-side routes (/store, /p/…) work on reload.
func staticSite(dir string) http.Handler {
	files := http.FileServer(http.Dir(dir))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			w.Header().Set("Allow", "GET, HEAD")
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		h := w.Header()
		h.Set("Content-Security-Policy", contentSecurityPolicy)
		h.Set("X-Frame-Options", "DENY")
		h.Set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
		h.Set("Referrer-Policy", "strict-origin-when-cross-origin")

		clean := path.Clean("/" + r.URL.Path)
		full := filepath.Join(dir, filepath.FromSlash(clean))
		if info, err := os.Stat(full); err == nil && !info.IsDir() {
			switch {
			case strings.HasPrefix(clean, "/assets/"): // hashed file names: cache forever
				h.Set("Cache-Control", "public, max-age=31536000, immutable")
			case strings.HasPrefix(clean, "/covers/"), strings.HasPrefix(clean, "/banners/"):
				h.Set("Cache-Control", "public, max-age=86400")
			}
			files.ServeHTTP(w, r)
			return
		}
		h.Set("Cache-Control", "no-cache")
		http.ServeFile(w, r, filepath.Join(dir, "index.html"))
	})
}
