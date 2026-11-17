package auth

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"time"
	"unicode/utf8"

	"golang.org/x/crypto/bcrypt"

	"github.com/Zenkiux/eneba-marketplace/api/internal/httpx"
)

// Session is one row of the login history.
type Session struct {
	ID         int64     `json:"id"`
	CreatedAt  time.Time `json:"createdAt"`
	LastSeenAt time.Time `json:"lastSeenAt"`
	Country    string    `json:"country"`
	UserAgent  string    `json:"userAgent"`
	Current    bool      `json:"current"`
}

// Sessions lists the user's live sessions, newest first; current marks the caller's own.
func (s *Service) Sessions(ctx context.Context, userID, token string) ([]Session, error) {
	rows, err := s.db.Query(ctx, `SELECT id, created_at, last_seen_at, country, user_agent, token_hash = $2
		FROM sessions WHERE user_id = $1 AND expires_at > $3 AND last_seen_at > $4 ORDER BY created_at DESC`,
		userID, hashToken(token), s.now(), s.now().Add(-sessionIdleLimit))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Session{}
	for rows.Next() {
		var x Session
		if err := rows.Scan(&x.ID, &x.CreatedAt, &x.LastSeenAt, &x.Country, &x.UserAgent, &x.Current); err != nil {
			return nil, err
		}
		out = append(out, x)
	}
	return out, rows.Err()
}

// RevokeOtherSessions signs the user out everywhere except the current browser.
func (s *Service) RevokeOtherSessions(ctx context.Context, userID, token string) (int64, error) {
	tag, err := s.db.Exec(ctx, `DELETE FROM sessions WHERE user_id = $1 AND token_hash <> $2`, userID, hashToken(token))
	return tag.RowsAffected(), err
}

// UpdateDisplayName changes the public name shown in the header and account pages.
func (s *Service) UpdateDisplayName(ctx context.Context, userID, name string) (User, error) {
	name = strings.TrimSpace(name)
	if name == "" || utf8.RuneCountInString(name) > 50 {
		return User{}, &ValidationError{"displayName", "Name must be 1–50 characters"}
	}
	var u User
	err := s.db.QueryRow(ctx, `UPDATE users SET display_name = $2 WHERE id = $1 RETURNING id, email, display_name, created_at`, userID, name).
		Scan(&u.ID, &u.Email, &u.DisplayName, &u.CreatedAt)
	return u, err
}

var ErrWrongPassword = errors.New("current password is wrong")

// ChangePassword checks the current password, stores the new one and signs out every other
// session (a stolen session must not survive a password change).
func (s *Service) ChangePassword(ctx context.Context, userID, token, current, next string) error {
	if err := checkPassword(next); err != nil {
		return err
	}
	var hash string
	if err := s.db.QueryRow(ctx, `SELECT password_hash FROM users WHERE id = $1`, userID).Scan(&hash); err != nil {
		return err
	}
	if bcrypt.CompareHashAndPassword([]byte(hash), []byte(current)) != nil {
		return ErrWrongPassword
	}
	newHash, err := bcrypt.GenerateFromPassword([]byte(next), bcryptCost)
	if err != nil {
		return err
	}
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if _, err := tx.Exec(ctx, `UPDATE users SET password_hash = $2 WHERE id = $1`, userID, string(newHash)); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `DELETE FROM sessions WHERE user_id = $1 AND token_hash <> $2`, userID, hashToken(token)); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// ---------------------------------------------------------------- HTTP

func (h *Handler) token(r *http.Request) string {
	if c, err := r.Cookie(h.cookie.Name); err == nil {
		return c.Value
	}
	return ""
}

func (h *Handler) sessions(w http.ResponseWriter, r *http.Request) error {
	u, _ := FromContext(r.Context())
	list, err := h.svc.Sessions(r.Context(), u.ID, h.token(r))
	if err != nil {
		return err
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"sessions": list})
	return nil
}

func (h *Handler) revokeOthers(w http.ResponseWriter, r *http.Request) error {
	u, _ := FromContext(r.Context())
	n, err := h.svc.RevokeOtherSessions(r.Context(), u.ID, h.token(r))
	if err != nil {
		return err
	}
	httpx.JSON(w, http.StatusOK, map[string]int64{"revoked": n})
	return nil
}

func (h *Handler) updateProfile(w http.ResponseWriter, r *http.Request) error {
	var body struct {
		DisplayName string `json:"displayName"`
	}
	if err := httpx.Decode(r, &body); err != nil {
		return err
	}
	u, _ := FromContext(r.Context())
	updated, err := h.svc.UpdateDisplayName(r.Context(), u.ID, body.DisplayName)
	if err != nil {
		return validation(err)
	}
	httpx.JSON(w, http.StatusOK, map[string]User{"user": updated})
	return nil
}

func (h *Handler) changePassword(w http.ResponseWriter, r *http.Request) error {
	var body struct {
		CurrentPassword string `json:"currentPassword"`
		NewPassword     string `json:"newPassword"`
	}
	if err := httpx.Decode(r, &body); err != nil {
		return err
	}
	u, _ := FromContext(r.Context())
	if !h.perEmail.Allow("password:" + u.ID) {
		return errTooMany
	}
	err := h.svc.ChangePassword(r.Context(), u.ID, h.token(r), body.CurrentPassword, body.NewPassword)
	if errors.Is(err, ErrWrongPassword) {
		e := httpx.NewError(http.StatusUnprocessableEntity, "validation_failed", "Your current password is wrong.")
		e.Details = map[string]string{"field": "currentPassword"}
		return e
	}
	if err != nil {
		var v *ValidationError
		if errors.As(err, &v) {
			v.Field = "newPassword"
		}
		return validation(err)
	}
	w.WriteHeader(http.StatusNoContent)
	return nil
}
