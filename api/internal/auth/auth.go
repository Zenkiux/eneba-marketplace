// Package auth implements accounts and server-side sessions.
//
//   - Passwords: bcrypt (cost 12), 8–72 bytes. Unknown e-mails still run a bcrypt comparison so
//     response time doesn't reveal which accounts exist.
//   - Sessions: a random 32-byte token lives only in an HttpOnly cookie; the database stores its
//     SHA-256 hash. A new session is created on every sign-in (no session fixation). Sessions end
//     after 14 days, or after 2 days without use, or on logout.
package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"net/mail"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

const (
	bcryptCost       = 12
	sessionLifetime  = 14 * 24 * time.Hour
	sessionIdleLimit = 2 * 24 * time.Hour
	touchInterval    = 5 * time.Minute // how often last_seen_at is refreshed
)

type User struct {
	ID          string    `json:"id"`
	Email       string    `json:"email"`
	DisplayName string    `json:"displayName"`
	CreatedAt   time.Time `json:"createdAt"`
}

var (
	ErrEmailTaken         = errors.New("email already registered")
	ErrInvalidCredentials = errors.New("invalid email or password")
)

// ValidationError carries a user-facing message about one field.
type ValidationError struct{ Field, Message string }

func (e *ValidationError) Error() string { return e.Field + ": " + e.Message }

type Service struct {
	db        *pgxpool.Pool
	now       func() time.Time
	dummyHash []byte
}

func NewService(db *pgxpool.Pool) *Service {
	dummy, _ := bcrypt.GenerateFromPassword([]byte("timing-equaliser"), bcryptCost)
	return &Service{db: db, now: time.Now, dummyHash: dummy}
}

func normaliseEmail(s string) (string, error) {
	s = strings.ToLower(strings.TrimSpace(s))
	addr, err := mail.ParseAddress(s)
	if err != nil || addr.Address != s || len(s) > 254 || !strings.Contains(s[strings.LastIndex(s, "@"):], ".") {
		return "", &ValidationError{"email", "Enter a valid e-mail address"}
	}
	return s, nil
}

func checkPassword(p string) error {
	if len(p) < 8 {
		return &ValidationError{"password", "Password must be at least 8 characters"}
	}
	if len(p) > 72 { // bcrypt only uses the first 72 bytes; reject rather than silently truncate
		return &ValidationError{"password", "Password must be at most 72 bytes"}
	}
	return nil
}

func (s *Service) Register(ctx context.Context, email, password, displayName string) (User, error) {
	email, err := normaliseEmail(email)
	if err != nil {
		return User{}, err
	}
	if err := checkPassword(password); err != nil {
		return User{}, err
	}
	displayName = strings.TrimSpace(displayName)
	if displayName == "" {
		displayName = email[:strings.Index(email, "@")]
	}
	if utf8.RuneCountInString(displayName) > 50 {
		return User{}, &ValidationError{"displayName", "Name must be at most 50 characters"}
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcryptCost)
	if err != nil {
		return User{}, err
	}
	var u User
	err = s.db.QueryRow(ctx, `INSERT INTO users (email, password_hash, display_name) VALUES ($1, $2, $3)
		RETURNING id, email, display_name, created_at`, email, string(hash), displayName).
		Scan(&u.ID, &u.Email, &u.DisplayName, &u.CreatedAt)
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" {
		return User{}, ErrEmailTaken
	}
	return u, err
}

func (s *Service) Authenticate(ctx context.Context, email, password string) (User, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	var u User
	var hash string
	err := s.db.QueryRow(ctx, `SELECT id, email, display_name, created_at, password_hash FROM users WHERE email = $1`, email).
		Scan(&u.ID, &u.Email, &u.DisplayName, &u.CreatedAt, &hash)
	if errors.Is(err, pgx.ErrNoRows) {
		bcrypt.CompareHashAndPassword(s.dummyHash, []byte(password)) // same cost as a real check
		return User{}, ErrInvalidCredentials
	}
	if err != nil {
		return User{}, err
	}
	if bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) != nil {
		return User{}, ErrInvalidCredentials
	}
	return u, nil
}

func hashToken(token string) []byte {
	h := sha256.Sum256([]byte(token))
	return h[:]
}

// CreateSession stores a new session and returns the raw token for the cookie.
func (s *Service) CreateSession(ctx context.Context, userID, userAgent, country string) (string, time.Time, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", time.Time{}, err
	}
	token := base64.RawURLEncoding.EncodeToString(b)
	expires := s.now().Add(sessionLifetime)
	if len(userAgent) > 300 {
		userAgent = userAgent[:300]
	}
	// Housekeeping: drop this user's dead sessions while we're here.
	if _, err := s.db.Exec(ctx, `DELETE FROM sessions WHERE user_id = $1 AND (expires_at < $2 OR last_seen_at < $3)`,
		userID, s.now(), s.now().Add(-sessionIdleLimit)); err != nil {
		return "", time.Time{}, err
	}
	_, err := s.db.Exec(ctx, `INSERT INTO sessions (token_hash, user_id, expires_at, last_seen_at, user_agent, country) VALUES ($1, $2, $3, $4, $5, $6)`,
		hashToken(token), userID, expires, s.now(), userAgent, country)
	return token, expires, err
}

// UserForToken returns the session's user, or ok=false if the token is unknown or expired.
func (s *Service) UserForToken(ctx context.Context, token string) (User, bool, error) {
	if token == "" || len(token) > 100 {
		return User{}, false, nil
	}
	var u User
	var lastSeen time.Time
	err := s.db.QueryRow(ctx, `SELECT u.id, u.email, u.display_name, u.created_at, s.last_seen_at
		FROM sessions s JOIN users u ON u.id = s.user_id
		WHERE s.token_hash = $1 AND s.expires_at > $2 AND s.last_seen_at > $3`,
		hashToken(token), s.now(), s.now().Add(-sessionIdleLimit)).
		Scan(&u.ID, &u.Email, &u.DisplayName, &u.CreatedAt, &lastSeen)
	if errors.Is(err, pgx.ErrNoRows) {
		return User{}, false, nil
	}
	if err != nil {
		return User{}, false, err
	}
	if s.now().Sub(lastSeen) > touchInterval {
		if _, err := s.db.Exec(ctx, `UPDATE sessions SET last_seen_at = $2 WHERE token_hash = $1`, hashToken(token), s.now()); err != nil {
			return User{}, false, err
		}
	}
	return u, true, nil
}

func (s *Service) DeleteSession(ctx context.Context, token string) error {
	_, err := s.db.Exec(ctx, `DELETE FROM sessions WHERE token_hash = $1`, hashToken(token))
	return err
}
