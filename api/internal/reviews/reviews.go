// Package reviews: product reviews like Eneba's "Reviews" block. Only buyers (a paid order with
// the product) can review, once per product; they can edit or delete their review.
package reviews

import (
	"context"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/Zenkiux/eneba-marketplace/api/internal/auth"
	"github.com/Zenkiux/eneba-marketplace/api/internal/httpx"
)

const pageSize = 5

type Review struct {
	ID        int64     `json:"id"`
	Author    string    `json:"author"`
	Rating    int       `json:"rating"`
	Body      string    `json:"body"`
	CreatedAt time.Time `json:"createdAt"`
	Mine      bool      `json:"mine"`
}

type Page struct {
	Reviews   []Review `json:"reviews"`
	Total     int      `json:"total"`
	Page      int      `json:"page"`
	PageSize  int      `json:"pageSize"`
	CanReview bool     `json:"canReview"` // signed in and bought this product
	Mine      *Review  `json:"mine"`
}

type Handler struct{ db *pgxpool.Pool }

func NewHandler(db *pgxpool.Pool) *Handler { return &Handler{db: db} }

func (h *Handler) Register(mux *http.ServeMux) {
	mux.Handle("GET /api/products/{slug}/reviews", httpx.Handler(h.list))
	mux.Handle("PUT /api/products/{slug}/reviews/mine", auth.RequireUser(httpx.Handler(h.save)))
	mux.Handle("DELETE /api/products/{slug}/reviews/mine", auth.RequireUser(httpx.Handler(h.remove)))
}

func (h *Handler) productID(ctx context.Context, slug string) (int64, error) {
	var id int64
	err := h.db.QueryRow(ctx, `SELECT id FROM products WHERE slug = $1`, slug).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, httpx.ErrNotFound
	}
	return id, err
}

func (h *Handler) bought(ctx context.Context, userID string, productID int64) (bool, error) {
	var ok bool
	err := h.db.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM order_items oi JOIN orders o ON o.id = oi.order_id
		WHERE o.user_id = $1 AND o.status = 'paid' AND oi.product_id = $2)`, userID, productID).Scan(&ok)
	return ok, err
}

func scan(rows pgx.Rows) ([]Review, error) {
	return pgx.CollectRows(rows, func(r pgx.CollectableRow) (Review, error) {
		var x Review
		return x, r.Scan(&x.ID, &x.Author, &x.Rating, &x.Body, &x.CreatedAt, &x.Mine)
	})
}

func (h *Handler) list(w http.ResponseWriter, r *http.Request) error {
	id, err := h.productID(r.Context(), r.PathValue("slug"))
	if err != nil {
		return err
	}
	page := 1
	if p := r.URL.Query().Get("page"); p != "" {
		if page, err = strconv.Atoi(p); err != nil || page < 1 || page > 1000 {
			return httpx.NewError(http.StatusBadRequest, "bad_request", "page must be a positive number")
		}
	}
	u, signedIn := auth.FromContext(r.Context())
	uid := ""
	if signedIn {
		uid = u.ID
	}
	out := Page{Page: page, PageSize: pageSize}
	if err := h.db.QueryRow(r.Context(), `SELECT count(*) FROM product_reviews WHERE product_id = $1`, id).Scan(&out.Total); err != nil {
		return err
	}
	rows, err := h.db.Query(r.Context(), `SELECT rv.id, u.display_name, rv.rating, rv.body, rv.created_at, rv.user_id::text = $2
		FROM product_reviews rv JOIN users u ON u.id = rv.user_id
		WHERE rv.product_id = $1 ORDER BY rv.created_at DESC, rv.id DESC LIMIT $3 OFFSET $4`, id, uid, pageSize, (page-1)*pageSize)
	if err != nil {
		return err
	}
	if out.Reviews, err = scan(rows); err != nil {
		return err
	}
	if signedIn {
		if out.CanReview, err = h.bought(r.Context(), uid, id); err != nil {
			return err
		}
		rows, err := h.db.Query(r.Context(), `SELECT rv.id, u.display_name, rv.rating, rv.body, rv.created_at, true
			FROM product_reviews rv JOIN users u ON u.id = rv.user_id WHERE rv.product_id = $1 AND rv.user_id = $2`, id, uid)
		if err != nil {
			return err
		}
		mine, err := scan(rows)
		if err != nil {
			return err
		}
		if len(mine) == 1 {
			out.Mine = &mine[0]
		}
	}
	httpx.JSON(w, http.StatusOK, out)
	return nil
}

func invalid(field, msg string) error {
	e := httpx.NewError(http.StatusUnprocessableEntity, "validation_failed", msg)
	e.Details = map[string]string{"field": field}
	return e
}

func (h *Handler) save(w http.ResponseWriter, r *http.Request) error {
	var body struct {
		Rating int    `json:"rating"`
		Body   string `json:"body"`
	}
	if err := httpx.Decode(r, &body); err != nil {
		return err
	}
	body.Body = strings.TrimSpace(body.Body)
	if body.Rating < 1 || body.Rating > 5 {
		return invalid("rating", "Choose a rating from 1 to 5 stars.")
	}
	if n := utf8.RuneCountInString(body.Body); n < 10 || n > 2000 {
		return invalid("body", "Write between 10 and 2000 characters.")
	}
	id, err := h.productID(r.Context(), r.PathValue("slug"))
	if err != nil {
		return err
	}
	u, _ := auth.FromContext(r.Context())
	ok, err := h.bought(r.Context(), u.ID, id)
	if err != nil {
		return err
	}
	if !ok {
		return httpx.NewError(http.StatusForbidden, "not_a_buyer", "Only buyers of this product can review it.")
	}
	if _, err := h.db.Exec(r.Context(), `INSERT INTO product_reviews (product_id, user_id, rating, body) VALUES ($1, $2, $3, $4)
		ON CONFLICT (product_id, user_id) DO UPDATE SET rating = EXCLUDED.rating, body = EXCLUDED.body, updated_at = now()`,
		id, u.ID, body.Rating, body.Body); err != nil {
		return err
	}
	return h.list(w, r)
}

func (h *Handler) remove(w http.ResponseWriter, r *http.Request) error {
	id, err := h.productID(r.Context(), r.PathValue("slug"))
	if err != nil {
		return err
	}
	u, _ := auth.FromContext(r.Context())
	if _, err := h.db.Exec(r.Context(), `DELETE FROM product_reviews WHERE product_id = $1 AND user_id = $2`, id, u.ID); err != nil {
		return err
	}
	return h.list(w, r)
}
