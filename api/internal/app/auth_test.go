package app_test

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/json"
	"io"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/Zenkiux/eneba-marketplace/api/internal/app"
	"github.com/Zenkiux/eneba-marketplace/api/internal/config"
	"github.com/Zenkiux/eneba-marketplace/api/internal/testdb"
)

type stack struct {
	t    *testing.T
	pool *pgxpool.Pool
	srv  *httptest.Server
}

func newStack(t *testing.T, env string) *stack {
	t.Helper()
	pool := testdb.New(t)
	h, _, err := app.NewRouter(config.Config{Env: env, TrustedOrigins: []string{"http://localhost:5173"}, KeyEncryption: testdb.Key}, pool)
	if err != nil {
		t.Fatal(err)
	}
	srv := httptest.NewServer(h)
	t.Cleanup(srv.Close)
	return &stack{t: t, pool: pool, srv: srv}
}

// client returns an HTTP client with its own cookie jar (one "browser").
func (s *stack) client() *http.Client {
	jar, _ := cookiejar.New(nil)
	return &http.Client{Jar: jar}
}

type resp struct {
	status int
	body   map[string]any
	header http.Header
}

func (s *stack) do(c *http.Client, method, path string, body any, headers ...string) resp {
	s.t.Helper()
	var rdr io.Reader
	if body != nil {
		b, _ := json.Marshal(body)
		rdr = bytes.NewReader(b)
	}
	req, _ := http.NewRequest(method, s.srv.URL+path, rdr)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	for i := 0; i+1 < len(headers); i += 2 {
		req.Header.Set(headers[i], headers[i+1])
	}
	res, err := c.Do(req)
	if err != nil {
		s.t.Fatal(err)
	}
	defer res.Body.Close()
	out := resp{status: res.StatusCode, header: res.Header}
	json.NewDecoder(res.Body).Decode(&out.body)
	return out
}

func errCode(r resp) string {
	if e, ok := r.body["error"].(map[string]any); ok {
		return e["code"].(string)
	}
	return ""
}

func creds(email, pw string) map[string]string {
	return map[string]string{"email": email, "password": pw}
}

func TestRegisterLoginMeLogout(t *testing.T) {
	s := newStack(t, "dev")
	browser := s.client()

	if r := s.do(browser, "GET", "/api/auth/me", nil); r.status != 401 {
		t.Fatalf("me before login: %d", r.status)
	}
	r := s.do(browser, "POST", "/api/auth/register", map[string]string{"email": "  Alice@Example.COM ", "password": "correct horse", "displayName": "Alice"})
	if r.status != 201 {
		t.Fatalf("register: %d %v", r.status, r.body)
	}
	cookie := r.header.Get("Set-Cookie")
	for _, want := range []string{"sid=", "HttpOnly", "SameSite=Lax", "Path=/"} {
		if !strings.Contains(cookie, want) {
			t.Errorf("cookie %q lacks %s", cookie, want)
		}
	}
	me := s.do(browser, "GET", "/api/auth/me", nil)
	if me.status != 200 || me.body["user"].(map[string]any)["email"] != "alice@example.com" {
		t.Fatalf("me after register: %d %v", me.status, me.body)
	}

	// Stored password is a bcrypt hash; stored session is a hash of the cookie token, not the token.
	var hash string
	s.pool.QueryRow(context.Background(), `SELECT password_hash FROM users WHERE email = 'alice@example.com'`).Scan(&hash)
	if !strings.HasPrefix(hash, "$2a$12$") || strings.Contains(hash, "correct horse") {
		t.Fatalf("password not hashed with bcrypt cost 12: %q", hash[:7])
	}
	token := strings.TrimPrefix(strings.Split(cookie, ";")[0], "sid=")
	sum := sha256.Sum256([]byte(token))
	var n int
	s.pool.QueryRow(context.Background(), `SELECT count(*) FROM sessions WHERE token_hash = $1`, sum[:]).Scan(&n)
	if n != 1 {
		t.Fatal("session should be stored as sha256(token)")
	}

	if r := s.do(browser, "POST", "/api/auth/logout", nil); r.status != 204 {
		t.Fatalf("logout: %d", r.status)
	}
	if r := s.do(browser, "GET", "/api/auth/me", nil); r.status != 401 {
		t.Fatalf("me after logout: %d", r.status)
	}
	// Replaying the old cookie after logout must not work.
	if r := s.do(&http.Client{}, "GET", "/api/auth/me", nil, "Cookie", "sid="+token); r.status != 401 {
		t.Fatalf("old token after logout: %d", r.status)
	}

	// Sign in again: new session, different token.
	r = s.do(browser, "POST", "/api/auth/login", creds("ALICE@example.com", "correct horse"))
	if r.status != 200 {
		t.Fatalf("login: %d %v", r.status, r.body)
	}
	if strings.Contains(r.header.Get("Set-Cookie"), token) {
		t.Fatal("login must issue a new token")
	}
}

func TestRegisterValidation(t *testing.T) {
	s := newStack(t, "dev")
	c := s.client()
	cases := []struct {
		body  map[string]string
		field string
	}{
		{creds("not-an-email", "longenough"), "email"},
		{creds("a@b", "longenough"), "email"},
		{creds("ok@example.com", "short"), "password"},
		{creds("ok@example.com", strings.Repeat("x", 73)), "password"},
	}
	for _, tc := range cases {
		r := s.do(c, "POST", "/api/auth/register", tc.body)
		if r.status != 422 || r.body["error"].(map[string]any)["details"].(map[string]any)["field"] != tc.field {
			t.Errorf("%v: %d %v", tc.body, r.status, r.body)
		}
	}
	s.do(c, "POST", "/api/auth/register", creds("dup@example.com", "longenough"))
	if r := s.do(s.client(), "POST", "/api/auth/register", creds("DUP@example.com", "different1")); r.status != 409 || errCode(r) != "email_taken" {
		t.Fatalf("duplicate e-mail: %d %v", r.status, r.body)
	}
}

func TestLoginFailuresAreGeneric(t *testing.T) {
	s := newStack(t, "dev")
	c := s.client()
	s.do(c, "POST", "/api/auth/register", creds("bob@example.com", "right-password"))
	wrong := s.do(s.client(), "POST", "/api/auth/login", creds("bob@example.com", "wrong-password"))
	unknown := s.do(s.client(), "POST", "/api/auth/login", creds("nobody@example.com", "whatever1"))
	if wrong.status != 401 || unknown.status != 401 {
		t.Fatalf("statuses %d %d", wrong.status, unknown.status)
	}
	if wrong.body["error"].(map[string]any)["message"] != unknown.body["error"].(map[string]any)["message"] {
		t.Fatal("wrong password and unknown e-mail must look the same")
	}
	if wrong.header.Get("Set-Cookie") != "" {
		t.Fatal("failed login must not set a cookie")
	}
}

func TestSessionExpiry(t *testing.T) {
	s := newStack(t, "dev")
	ctx := context.Background()
	for _, tc := range []struct{ name, sql string }{
		{"absolute", `UPDATE sessions SET expires_at = now() - interval '1 second'`},
		{"idle", `UPDATE sessions SET last_seen_at = now() - interval '3 days'`},
	} {
		browser := s.client()
		s.do(browser, "POST", "/api/auth/register", creds(tc.name+"@example.com", "longenough"))
		if _, err := s.pool.Exec(ctx, tc.sql); err != nil {
			t.Fatal(err)
		}
		if r := s.do(browser, "GET", "/api/auth/me", nil); r.status != 401 {
			t.Fatalf("%s expiry: status %d", tc.name, r.status)
		}
	}
}

func TestCrossOriginAndContentType(t *testing.T) {
	s := newStack(t, "dev")
	c := s.client()
	body := creds("eve@example.com", "longenough")

	r := s.do(c, "POST", "/api/auth/register", body, "Origin", "https://evil.example", "Sec-Fetch-Site", "cross-site")
	if r.status != 403 || errCode(r) != "cross_origin" {
		t.Fatalf("cross-site POST: %d %v", r.status, r.body)
	}
	if r := s.do(c, "POST", "/api/auth/register", body, "Sec-Fetch-Site", "same-origin"); r.status != 201 {
		t.Fatalf("same-origin POST: %d", r.status)
	}
	if r := s.do(s.client(), "POST", "/api/auth/login", creds("eve@example.com", "longenough"), "Origin", "http://localhost:5173", "Sec-Fetch-Site", "cross-site"); r.status != 200 {
		t.Fatalf("trusted dev origin: %d", r.status)
	}
	// Cross-site GETs stay allowed (they don't change anything).
	if r := s.do(c, "GET", "/api/products?page_size=1", nil, "Origin", "https://evil.example", "Sec-Fetch-Site", "cross-site"); r.status != 200 {
		t.Fatalf("cross-site GET: %d", r.status)
	}

	// A form post (what a cross-site attacker could send without CORS) is rejected.
	req, _ := http.NewRequest("POST", s.srv.URL+"/api/auth/login", strings.NewReader("email=eve%40example.com&password=longenough"))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	res.Body.Close()
	if res.StatusCode != 415 {
		t.Fatalf("form-encoded login: %d, want 415", res.StatusCode)
	}
}

func TestLoginRateLimit(t *testing.T) {
	s := newStack(t, "dev")
	var last resp
	for i := 0; i < 6; i++ {
		last = s.do(s.client(), "POST", "/api/auth/login", creds("target@example.com", "guess-"+string(rune('a'+i))))
	}
	if last.status != 429 || errCode(last) != "rate_limited" {
		t.Fatalf("6th attempt for one e-mail: %d %v", last.status, last.body)
	}
}

func TestProductionCookieAttributes(t *testing.T) {
	s := newStack(t, "prod")
	r := s.do(s.client(), "POST", "/api/auth/register", creds("prod@example.com", "longenough"))
	c := r.header.Get("Set-Cookie")
	for _, want := range []string{"__Host-sid=", "Secure", "HttpOnly", "SameSite=Lax", "Path=/"} {
		if !strings.Contains(c, want) {
			t.Errorf("prod cookie %q lacks %s", c, want)
		}
	}
	if strings.Contains(strings.ToLower(c), "domain=") {
		t.Error("__Host- cookie must not set Domain")
	}
	if r.header.Get("Cache-Control") != "no-store" || r.header.Get("X-Content-Type-Options") != "nosniff" {
		t.Error("security headers missing")
	}
}

func TestStaticSiteServesSPA(t *testing.T) {
	dir := t.TempDir()
	os.MkdirAll(filepath.Join(dir, "assets"), 0o755)
	os.WriteFile(filepath.Join(dir, "index.html"), []byte("<!doctype html><title>app</title>"), 0o644)
	os.WriteFile(filepath.Join(dir, "assets", "app-123.js"), []byte("console.log(1)"), 0o644)
	pool := testdb.New(t)
	h, _, err := app.NewRouter(config.Config{Env: "prod", TrustedOrigins: []string{"https://keyshop.example"}, KeyEncryption: testdb.Key, StaticDir: dir}, pool)
	if err != nil {
		t.Fatal(err)
	}
	srv := httptest.NewServer(h)
	defer srv.Close()
	get := func(p string) *http.Response {
		res, err := http.Get(srv.URL + p)
		if err != nil {
			t.Fatal(err)
		}
		res.Body.Close()
		return res
	}
	if r := get("/store?q=x"); r.StatusCode != 200 || r.Header.Get("Content-Security-Policy") == "" || r.Header.Get("X-Robots-Tag") == "" {
		t.Fatalf("SPA route: %d %v", r.StatusCode, r.Header)
	}
	if r := get("/assets/app-123.js"); !strings.Contains(r.Header.Get("Cache-Control"), "immutable") {
		t.Fatalf("asset caching: %v", r.Header.Get("Cache-Control"))
	}
	if r := get("/api/nope"); r.StatusCode != 404 || r.Header.Get("Cache-Control") != "no-store" {
		t.Fatalf("unknown API path must stay a JSON 404: %d", r.StatusCode)
	}
	req, _ := http.NewRequest("GET", srv.URL+"/store?q=x", nil)
	req.Header.Set("X-Forwarded-Proto", "http")
	res, err := (&http.Client{CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}).Do(req)
	if err != nil || res.StatusCode != 301 || !strings.HasPrefix(res.Header.Get("Location"), "https://") {
		t.Fatalf("plain HTTP should redirect to HTTPS: %v %v", res, err)
	}
	if r := get("/../../etc/passwd"); r.StatusCode != 200 { // cleaned path → index.html, never a file outside dir
		t.Fatalf("path traversal: %d", r.StatusCode)
	}
}
