package orders

import (
	"net/http"

	"github.com/Zenkiux/eneba-marketplace/api/internal/auth"
	"github.com/Zenkiux/eneba-marketplace/api/internal/httpx"
)

type Handler struct{ svc *Service }

func NewHandler(s *Service) *Handler { return &Handler{svc: s} }

func (h *Handler) Register(mux *http.ServeMux) {
	mux.Handle("POST /api/orders", auth.RequireUser(httpx.Handler(h.create)))
	mux.Handle("GET /api/orders", auth.RequireUser(httpx.Handler(h.list)))
	mux.Handle("GET /api/orders/{id}", auth.RequireUser(httpx.Handler(h.get)))
	mux.Handle("POST /api/orders/{id}/payments", auth.RequireUser(httpx.Handler(h.pay)))
	mux.Handle("POST /api/orders/{id}/cancel", auth.RequireUser(httpx.Handler(h.cancel)))
}

func uid(r *http.Request) string {
	u, _ := auth.FromContext(r.Context())
	return u.ID
}

func (h *Handler) create(w http.ResponseWriter, r *http.Request) error {
	var body struct {
		Items              []Item `json:"items"`
		ExpectedTotalCents int64  `json:"expectedTotalCents"`
	}
	if err := httpx.Decode(r, &body); err != nil {
		return err
	}
	o, created, err := h.svc.Create(r.Context(), uid(r), r.Header.Get("Idempotency-Key"), body.Items, body.ExpectedTotalCents)
	if err != nil {
		return err
	}
	status := http.StatusOK // a retried request returns the existing order
	if created {
		status = http.StatusCreated
	}
	httpx.JSON(w, status, o)
	return nil
}

func (h *Handler) pay(w http.ResponseWriter, r *http.Request) error {
	var body struct {
		Outcome Outcome `json:"outcome"`
		Method  string  `json:"method"` // label of the demo method picked, e.g. "card"
	}
	if err := httpx.Decode(r, &body); err != nil {
		return err
	}
	o, err := h.svc.Pay(r.Context(), uid(r), r.PathValue("id"), r.Header.Get("Idempotency-Key"), body.Outcome)
	if err != nil {
		return err
	}
	if m := body.Method; validMethod(m) {
		if err := h.svc.recordMethod(r.Context(), r.PathValue("id"), r.Header.Get("Idempotency-Key"), m); err != nil {
			return err
		}
		if o.Status == "paid" {
			o.PaymentMethod = &m
		}
	}
	httpx.JSON(w, http.StatusOK, o)
	return nil
}

func (h *Handler) cancel(w http.ResponseWriter, r *http.Request) error {
	o, err := h.svc.Cancel(r.Context(), uid(r), r.PathValue("id"))
	if err != nil {
		return err
	}
	httpx.JSON(w, http.StatusOK, o)
	return nil
}

func (h *Handler) get(w http.ResponseWriter, r *http.Request) error {
	o, err := h.svc.Get(r.Context(), uid(r), r.PathValue("id"))
	if err != nil {
		return err
	}
	httpx.JSON(w, http.StatusOK, o)
	return nil
}

func (h *Handler) list(w http.ResponseWriter, r *http.Request) error {
	l, err := h.svc.List(r.Context(), uid(r))
	if err != nil {
		return err
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"orders": l})
	return nil
}
