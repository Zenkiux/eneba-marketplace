// Package wishlist stores a signed-in user's favourite products ("Favorites" on Eneba).
package wishlist

import (
	"context"
	"net/http"
	"strconv"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/Zenkiux/eneba-marketplace/api/internal/auth"
	"github.com/Zenkiux/eneba-marketplace/api/internal/catalog"
	"github.com/Zenkiux/eneba-marketplace/api/internal/httpx"
)

const maxItems = 200

type Handler struct{ db *pgxpool.Pool }

func NewHandler(db *pgxpool.Pool) *Handler { return &Handler{db: db} }

func (h *Handler) Register(mux *http.ServeMux) {
	mux.Handle("GET /api/wishlist", auth.RequireUser(httpx.Handler(h.list)))
	mux.Handle("PUT /api/wishlist/{productId}", auth.RequireUser(httpx.Handler(h.add)))
	mux.Handle("DELETE /api/wishlist/{productId}", auth.RequireUser(httpx.Handler(h.remove)))
}

func userID(r *http.Request) string {
	u, _ := auth.FromContext(r.Context())
	return u.ID
}

func productID(r *http.Request) (int64, error) {
	id, err := strconv.ParseInt(r.PathValue("productId"), 10, 64)
	if err != nil || id <= 0 {
		return 0, httpx.NewError(http.StatusBadRequest, "bad_request", "Invalid product id")
	}
	return id, nil
}

// Items returns the favourites as product cards, most recently added first.
func Items(ctx context.Context, db *pgxpool.Pool, userID string) ([]catalog.Card, error) {
	rows, err := db.Query(ctx, catalog.CardSelect+`
		JOIN wishlist_items w ON w.product_id = p.id AND w.user_id = $1
		ORDER BY w.added_at DESC, p.id`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []catalog.Card{}
	for rows.Next() {
		c, err := catalog.ScanCard(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

func (h *Handler) list(w http.ResponseWriter, r *http.Request) error {
	items, err := Items(r.Context(), h.db, userID(r))
	if err != nil {
		return err
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"items": items})
	return nil
}

func (h *Handler) add(w http.ResponseWriter, r *http.Request) error {
	id, err := productID(r)
	if err != nil {
		return err
	}
	var count int
	if err := h.db.QueryRow(r.Context(), `SELECT count(*) FROM wishlist_items WHERE user_id = $1`, userID(r)).Scan(&count); err != nil {
		return err
	}
	if count >= maxItems {
		return httpx.NewError(http.StatusConflict, "wishlist_full", "Your favourites list is full.")
	}
	tag, err := h.db.Exec(r.Context(), `INSERT INTO wishlist_items (user_id, product_id)
		SELECT $1, id FROM products WHERE id = $2 ON CONFLICT DO NOTHING`, userID(r), id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		var exists bool
		if err := h.db.QueryRow(r.Context(), `SELECT EXISTS (SELECT 1 FROM products WHERE id = $1)`, id).Scan(&exists); err != nil {
			return err
		}
		if !exists {
			return httpx.NewError(http.StatusNotFound, "not_found", "Product not found")
		}
	}
	return h.list(w, r)
}

func (h *Handler) remove(w http.ResponseWriter, r *http.Request) error {
	id, err := productID(r)
	if err != nil {
		return err
	}
	if _, err := h.db.Exec(r.Context(), `DELETE FROM wishlist_items WHERE user_id = $1 AND product_id = $2`, userID(r), id); err != nil {
		return err
	}
	return h.list(w, r)
}
