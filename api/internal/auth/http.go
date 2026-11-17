package auth

import (
	"context"
	"errors"
	"net"
	"net/http"
	"strings"
	"time"

	"github.com/Zenkiux/eneba-marketplace/api/internal/httpx"
)

type ctxKey struct{}

// FromContext returns the signed-in user set by Middleware.
func FromContext(ctx context.Context) (User, bool) {
	u, ok := ctx.Value(ctxKey{}).(User)
	return u, ok
}

// WithUser is used by tests of other packages to simulate a signed-in request.
func WithUser(ctx context.Context, u User) context.Context {
	return context.WithValue(ctx, ctxKey{}, u)
}

type CookieConfig struct {
	Name   string // "__Host-sid" in production
	Secure bool
}

func CookieFor(prod bool) CookieConfig {
	if prod {
		// __Host- prefix: browser only accepts it with Secure, Path=/ and no Domain, so it can't be
		// set or overwritten by another subdomain.
		return CookieConfig{Name: "__Host-sid", Secure: true}
	}
	return CookieConfig{Name: "sid", Secure: false}
}

type Handler struct {
	svc        *Service
	cookie     CookieConfig
	trustProxy bool
	perIP      *limiter
	perEmail   *limiter
}

func NewHandler(svc *Service, cookie CookieConfig, trustProxy bool) *Handler {
	return &Handler{svc: svc, cookie: cookie, trustProxy: trustProxy,
		perIP: newLimiter(10, time.Minute), perEmail: newLimiter(5, time.Minute)}
}

func (h *Handler) Register(mux *http.ServeMux) {
	mux.Handle("POST /api/auth/register", httpx.Handler(h.register))
	mux.Handle("POST /api/auth/login", httpx.Handler(h.login))
	mux.Handle("POST /api/auth/logout", httpx.Handler(h.logout))
	mux.Handle("GET /api/auth/me", RequireUser(httpx.Handler(h.me)))
}

// Middleware resolves the session cookie (if any) into a user on the request context.
func (h *Handler) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if c, err := r.Cookie(h.cookie.Name); err == nil {
			u, ok, err := h.svc.UserForToken(r.Context(), c.Value)
			if err != nil {
				httpx.Fail(w, r, err)
				return
			}
			if ok {
				r = r.WithContext(context.WithValue(r.Context(), ctxKey{}, u))
			} else {
				h.clearCookie(w) // stale cookie: remove it
			}
		}
		next.ServeHTTP(w, r)
	})
}

// RequireUser rejects requests without a valid session with 401.
func RequireUser(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if _, ok := FromContext(r.Context()); !ok {
			httpx.Fail(w, r, httpx.ErrUnauthorized)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (h *Handler) clientIP(r *http.Request) string {
	if h.trustProxy {
		// Behind Cloudflare (tunnel) the edge sets CF-Connecting-IP; the server only listens on
		// localhost, so the header can only come from cloudflared.
		if ip := r.Header.Get("CF-Connecting-IP"); ip != "" {
			return ip
		}
		// Behind other proxies the client is the first X-Forwarded-For entry. It can be spoofed
		// by a client, so this limiter is best-effort (documented in architecture.md).
		if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
			return strings.TrimSpace(strings.Split(xff, ",")[0])
		}
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

var errTooMany = httpx.NewError(http.StatusTooManyRequests, "rate_limited", "Too many attempts. Please wait a minute and try again.")

type credentials struct {
	Email       string `json:"email"`
	Password    string `json:"password"`
	DisplayName string `json:"displayName"`
}

func validation(err error) error {
	var v *ValidationError
	if errors.As(err, &v) {
		e := httpx.NewError(http.StatusUnprocessableEntity, "validation_failed", v.Message)
		e.Details = map[string]string{"field": v.Field}
		return e
	}
	return err
}

func (h *Handler) register(w http.ResponseWriter, r *http.Request) error {
	var c credentials
	if err := httpx.Decode(r, &c); err != nil {
		return err
	}
	if !h.perIP.Allow("register:" + h.clientIP(r)) {
		return errTooMany
	}
	u, err := h.svc.Register(r.Context(), c.Email, c.Password, c.DisplayName)
	if errors.Is(err, ErrEmailTaken) {
		return httpx.NewError(http.StatusConflict, "email_taken", "An account with this e-mail already exists. Try signing in.")
	}
	if err != nil {
		return validation(err)
	}
	return h.startSession(w, r, u, http.StatusCreated)
}

func (h *Handler) login(w http.ResponseWriter, r *http.Request) error {
	var c credentials
	if err := httpx.Decode(r, &c); err != nil {
		return err
	}
	if !h.perIP.Allow("login:"+h.clientIP(r)) || !h.perEmail.Allow(strings.ToLower(strings.TrimSpace(c.Email))) {
		return errTooMany
	}
	u, err := h.svc.Authenticate(r.Context(), c.Email, c.Password)
	if errors.Is(err, ErrInvalidCredentials) {
		return httpx.NewError(http.StatusUnauthorized, "invalid_credentials", "Wrong e-mail or password.")
	}
	if err != nil {
		return err
	}
	return h.startSession(w, r, u, http.StatusOK)
}

func (h *Handler) startSession(w http.ResponseWriter, r *http.Request, u User, status int) error {
	// Replace any session the browser already had (prevents session fixation).
	if c, err := r.Cookie(h.cookie.Name); err == nil {
		if err := h.svc.DeleteSession(r.Context(), c.Value); err != nil {
			return err
		}
	}
	token, expires, err := h.svc.CreateSession(r.Context(), u.ID, r.UserAgent())
	if err != nil {
		return err
	}
	http.SetCookie(w, &http.Cookie{
		Name: h.cookie.Name, Value: token, Path: "/", Expires: expires,
		HttpOnly: true, Secure: h.cookie.Secure, SameSite: http.SameSiteLaxMode,
	})
	httpx.JSON(w, status, map[string]User{"user": u})
	return nil
}

func (h *Handler) clearCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{Name: h.cookie.Name, Value: "", Path: "/", MaxAge: -1,
		HttpOnly: true, Secure: h.cookie.Secure, SameSite: http.SameSiteLaxMode})
}

func (h *Handler) logout(w http.ResponseWriter, r *http.Request) error {
	if c, err := r.Cookie(h.cookie.Name); err == nil {
		if err := h.svc.DeleteSession(r.Context(), c.Value); err != nil {
			return err
		}
	}
	h.clearCookie(w)
	w.WriteHeader(http.StatusNoContent)
	return nil
}

func (h *Handler) me(w http.ResponseWriter, r *http.Request) error {
	u, _ := FromContext(r.Context())
	httpx.JSON(w, http.StatusOK, map[string]User{"user": u})
	return nil
}
