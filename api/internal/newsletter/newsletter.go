// Package newsletter stores e-mail sign-ups from the footer ("Get personalized game deals").
// No e-mails are sent by this demo; the list exists so the form is real, not decorative.
package newsletter

import (
	"net/http"
	"net/mail"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/Zenkiux/eneba-marketplace/api/internal/httpx"
)

type Handler struct{ db *pgxpool.Pool }

func NewHandler(db *pgxpool.Pool) *Handler { return &Handler{db: db} }

func (h *Handler) Register(mux *http.ServeMux) {
	mux.Handle("POST /api/newsletter", httpx.Handler(h.subscribe))
}

func (h *Handler) subscribe(w http.ResponseWriter, r *http.Request) error {
	var body struct {
		Email string `json:"email"`
	}
	if err := httpx.Decode(r, &body); err != nil {
		return err
	}
	email := strings.ToLower(strings.TrimSpace(body.Email))
	if a, err := mail.ParseAddress(email); err != nil || a.Address != email || len(email) > 254 {
		e := httpx.NewError(http.StatusUnprocessableEntity, "validation_failed", "Enter a valid e-mail address")
		e.Details = map[string]string{"field": "email"}
		return e
	}
	// Same answer whether or not the address was already subscribed (no account enumeration).
	if _, err := h.db.Exec(r.Context(), `INSERT INTO newsletter_subscribers (email) VALUES ($1) ON CONFLICT DO NOTHING`, email); err != nil {
		return err
	}
	w.WriteHeader(http.StatusNoContent)
	return nil
}
