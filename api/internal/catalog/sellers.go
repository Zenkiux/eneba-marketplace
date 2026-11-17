package catalog

import (
	"context"
	"errors"
	"net/http"
	"strconv"

	"github.com/jackc/pgx/v5"

	"github.com/Zenkiux/eneba-marketplace/api/internal/httpx"
)

// Seller pages ("/vendor/<seller>" on Eneba): who the seller is and what they sell.

type SellerPage struct {
	Seller
	Products   []Card `json:"products"` // products this seller has in stock, in the current catalog
	Total      int    `json:"total"`
	KeysSold   int    `json:"keysSold"` // keys sold through paid orders on this site
	OfferCount int    `json:"offerCount"`
}

func (h *Handler) seller(w http.ResponseWriter, r *http.Request) error {
	page := 1
	if p := r.URL.Query().Get("page"); p != "" {
		var err error
		if page, err = strconv.Atoi(p); err != nil || page < 1 || page > 1000 {
			return bad("page must be a positive number")
		}
	}
	sp, err := h.store.Seller(r.Context(), SourceFrom(r.Context()), r.PathValue("slug"), page, defaultPageSize)
	if errors.Is(err, ErrNotFound) {
		return httpx.ErrNotFound
	}
	if err != nil {
		return err
	}
	httpx.JSON(w, http.StatusOK, sp)
	return nil
}

func (s *Store) Seller(ctx context.Context, source, slug string, page, pageSize int) (SellerPage, error) {
	var sp SellerPage
	var id int64
	err := s.db.QueryRow(ctx, `SELECT id, slug, name, rating::float8, rating_count, verified FROM sellers WHERE slug = $1`, slug).
		Scan(&id, &sp.Slug, &sp.Name, &sp.Rating, &sp.RatingCount, &sp.Verified)
	if errors.Is(err, pgx.ErrNoRows) {
		return sp, ErrNotFound
	}
	if err != nil {
		return sp, err
	}
	if err := s.db.QueryRow(ctx, `SELECT
			(SELECT coalesce(sum(oi.quantity), 0)::int FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE oi.seller_id = $1 AND o.status = 'paid'),
			(SELECT count(*)::int FROM offers o JOIN products p ON p.id = o.product_id WHERE o.seller_id = $1 AND o.active AND p.catalog = $2)`,
		id, source).Scan(&sp.KeysSold, &sp.OfferCount); err != nil {
		return sp, err
	}
	// Products where this seller has an in-stock offer (cards show the overall lowest price).
	where := `WHERE p.catalog = $2 AND EXISTS (SELECT 1 FROM offers so WHERE so.product_id = p.id AND so.seller_id = $1 AND so.active
		AND EXISTS (SELECT 1 FROM offer_keys k WHERE k.offer_id = so.id AND k.status = 'available'))`
	if err := s.db.QueryRow(ctx, `SELECT count(*) FROM products p `+where, id, source).Scan(&sp.Total); err != nil {
		return sp, err
	}
	rows, err := s.db.Query(ctx, CardSelect+" "+where+` ORDER BY p.popularity DESC, p.id LIMIT $3 OFFSET $4`, id, source, pageSize, (page-1)*pageSize)
	if err != nil {
		return sp, err
	}
	sp.Products, err = pgx.CollectRows(rows, func(r pgx.CollectableRow) (Card, error) { return ScanCard(r) })
	return sp, err
}
