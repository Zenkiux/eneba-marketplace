// Package cart stores signed-in users' carts and resolves offer ids into displayable cart lines
// (also used for guest carts kept in the browser). Prices and stock are always read live from
// the database; the cart itself only stores offer ids and quantities.
package cart

import (
	"context"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/Zenkiux/eneba-marketplace/api/internal/auth"
	"github.com/Zenkiux/eneba-marketplace/api/internal/catalog"
	"github.com/Zenkiux/eneba-marketplace/api/internal/compat"
	"github.com/Zenkiux/eneba-marketplace/api/internal/httpx"
)

const MaxQuantity = 10

type Line struct {
	OfferID    int64       `json:"offerId"`
	Quantity   int         `json:"quantity"`
	PriceCents int64       `json:"priceCents"`
	Currency   string      `json:"currency"`
	Stock      int         `json:"stock"`
	Available  bool        `json:"available"` // offer active and in stock
	Seller     SellerBrief `json:"seller"`
	Product    ProductRef  `json:"product"`
}

type SellerBrief struct {
	Slug     string  `json:"slug"`
	Name     string  `json:"name"`
	Rating   float64 `json:"rating"`
	Verified bool    `json:"verified"`
}

type ProductRef struct {
	Slug     string        `json:"slug"`
	Title    string        `json:"title"`
	CoverURL string        `json:"coverUrl"`
	Platform catalog.Named `json:"platform"`
	Region   catalog.Named `json:"region"`
	ReqMin   *compat.Level `json:"reqMin,omitempty"` // for the "Will it work for me?" cart warning
}

// Cart is the response for every cart endpoint.
type Cart struct {
	Lines      []Line `json:"lines"`
	TotalCents int64  `json:"totalCents"` // available lines only
	Count      int    `json:"count"`
}

const lineSelect = `
SELECT o.id, o.price_cents, o.currency,
       (SELECT count(*)::int FROM offer_keys k WHERE k.offer_id = o.id AND k.status = 'available'),
       o.active, se.slug, se.name, se.rating::float8, se.verified,
       p.slug, p.title, p.cover_url, pl.slug, pl.name, r.slug, r.name,
       p.req_min_os, p.req_min_gpu, p.req_min_cpu, p.req_min_ram::float8
FROM offers o
JOIN sellers se ON se.id = o.seller_id
JOIN products p ON p.id = o.product_id
JOIN platforms pl ON pl.id = p.platform_id
JOIN regions r ON r.id = p.region_id`

type reqCols struct {
	os       *string
	gpu, cpu *int
	ram      *float64
}

func (c reqCols) level() *compat.Level {
	if c.os == nil && c.gpu == nil && c.cpu == nil && c.ram == nil {
		return nil
	}
	l := &compat.Level{}
	if c.os != nil {
		l.OS = *c.os
	}
	if c.gpu != nil {
		l.GPUScore = *c.gpu
	}
	if c.cpu != nil {
		l.CPUScore = *c.cpu
	}
	if c.ram != nil {
		l.RAMGB = *c.ram
	}
	return l
}

func scanLine(row pgx.Row) (Line, error) {
	var l Line
	var active bool
	var rc reqCols
	err := row.Scan(&l.OfferID, &l.PriceCents, &l.Currency, &l.Stock, &active,
		&l.Seller.Slug, &l.Seller.Name, &l.Seller.Rating, &l.Seller.Verified,
		&l.Product.Slug, &l.Product.Title, &l.Product.CoverURL,
		&l.Product.Platform.Slug, &l.Product.Platform.Name, &l.Product.Region.Slug, &l.Product.Region.Name,
		&rc.os, &rc.gpu, &rc.cpu, &rc.ram)
	l.Available = active && l.Stock > 0
	l.Product.ReqMin = rc.level()
	return l, err
}

func summarise(lines []Line) Cart {
	c := Cart{Lines: lines}
	if c.Lines == nil {
		c.Lines = []Line{}
	}
	for _, l := range lines {
		c.Count += l.Quantity
		if l.Available {
			c.TotalCents += l.PriceCents * int64(l.Quantity)
		}
	}
	return c
}

type Store struct{ db *pgxpool.Pool }

func NewStore(db *pgxpool.Pool) *Store { return &Store{db: db} }

// Get returns a user's cart with live prices and stock.
func (s *Store) Get(ctx context.Context, userID string) (Cart, error) {
	rows, err := s.db.Query(ctx, `SELECT x.quantity, l.* FROM cart_items x
		CROSS JOIN LATERAL (`+lineSelect+` WHERE o.id = x.offer_id) l
		WHERE x.user_id = $1 ORDER BY x.added_at, x.offer_id`, userID)
	if err != nil {
		return Cart{}, err
	}
	lines, err := pgx.CollectRows(rows, func(r pgx.CollectableRow) (Line, error) {
		var qty int
		var l Line
		var active bool
		var rc reqCols
		err := r.Scan(&qty, &l.OfferID, &l.PriceCents, &l.Currency, &l.Stock, &active,
			&l.Seller.Slug, &l.Seller.Name, &l.Seller.Rating, &l.Seller.Verified,
			&l.Product.Slug, &l.Product.Title, &l.Product.CoverURL,
			&l.Product.Platform.Slug, &l.Product.Platform.Name, &l.Product.Region.Slug, &l.Product.Region.Name,
			&rc.os, &rc.gpu, &rc.cpu, &rc.ram)
		l.Quantity = qty
		l.Available = active && l.Stock > 0
		l.Product.ReqMin = rc.level()
		return l, err
	})
	return summarise(lines), err
}

// Lines resolves offer ids for a guest cart. Unknown ids are left out.
func (s *Store) Lines(ctx context.Context, items []Item) (Cart, error) {
	ids := make([]int64, 0, len(items))
	qty := map[int64]int{}
	for _, it := range items {
		ids = append(ids, it.OfferID)
		qty[it.OfferID] = it.Quantity
	}
	rows, err := s.db.Query(ctx, lineSelect+` WHERE o.id = ANY($1) ORDER BY array_position($1, o.id)`, ids)
	if err != nil {
		return Cart{}, err
	}
	lines, err := pgx.CollectRows(rows, func(r pgx.CollectableRow) (Line, error) { return scanLine(r) })
	for i := range lines {
		lines[i].Quantity = qty[lines[i].OfferID]
	}
	return summarise(lines), err
}

var (
	errNoOffer  = httpx.NewError(http.StatusNotFound, "offer_unavailable", "This offer is no longer available.")
	errSoldOut  = httpx.NewError(http.StatusConflict, "out_of_stock", "This offer is sold out.")
	errQuantity = httpx.NewError(http.StatusUnprocessableEntity, "validation_failed", "Quantity must be between 1 and 10.")
)

// Set puts an exact quantity for an offer in the user's cart.
func (s *Store) Set(ctx context.Context, userID string, offerID int64, quantity int) error {
	if quantity < 1 || quantity > MaxQuantity {
		return errQuantity
	}
	var active bool
	var stock int
	err := s.db.QueryRow(ctx, `SELECT o.active, (SELECT count(*)::int FROM offer_keys k WHERE k.offer_id = o.id AND k.status = 'available')
		FROM offers o WHERE o.id = $1`, offerID).Scan(&active, &stock)
	if errors.Is(err, pgx.ErrNoRows) || (err == nil && !active) {
		return errNoOffer
	}
	if err != nil {
		return err
	}
	if stock == 0 {
		return errSoldOut
	}
	if quantity > stock {
		e := httpx.NewError(http.StatusConflict, "insufficient_stock", "Only "+strconv.Itoa(stock)+" left from this seller.")
		e.Details = map[string]int{"available": stock}
		return e
	}
	_, err = s.db.Exec(ctx, `INSERT INTO cart_items (user_id, offer_id, quantity) VALUES ($1, $2, $3)
		ON CONFLICT (user_id, offer_id) DO UPDATE SET quantity = EXCLUDED.quantity`, userID, offerID, quantity)
	return err
}

func (s *Store) Remove(ctx context.Context, userID string, offerID int64) error {
	_, err := s.db.Exec(ctx, `DELETE FROM cart_items WHERE user_id = $1 AND offer_id = $2`, userID, offerID)
	return err
}

type Item struct {
	OfferID  int64 `json:"offerId"`
	Quantity int   `json:"quantity"`
}

// Merge adds a guest cart to the user's cart after sign-in. Quantities for the same offer are
// added together (max 10); offers that no longer exist or are inactive are skipped. Stock is
// checked again at checkout, so a merged line may show as "only N left".
func (s *Store) Merge(ctx context.Context, userID string, items []Item) error {
	return pgx.BeginFunc(ctx, s.db, func(tx pgx.Tx) error {
		for _, it := range items {
			if it.Quantity < 1 {
				continue
			}
			q := min(it.Quantity, MaxQuantity)
			if _, err := tx.Exec(ctx, `INSERT INTO cart_items (user_id, offer_id, quantity)
				SELECT $1, o.id, $3 FROM offers o WHERE o.id = $2 AND o.active
				ON CONFLICT (user_id, offer_id) DO UPDATE SET quantity = LEAST(cart_items.quantity + EXCLUDED.quantity, $4)`,
				userID, it.OfferID, q, MaxQuantity); err != nil {
				return err
			}
		}
		return nil
	})
}

// ---------------------------------------------------------------- HTTP

type Handler struct{ store *Store }

func NewHandler(s *Store) *Handler { return &Handler{store: s} }

func (h *Handler) Register(mux *http.ServeMux) {
	mux.Handle("GET /api/offers", httpx.Handler(h.lookup))
	mux.Handle("GET /api/cart", auth.RequireUser(httpx.Handler(h.get)))
	mux.Handle("PUT /api/cart/items/{offerId}", auth.RequireUser(httpx.Handler(h.set)))
	mux.Handle("DELETE /api/cart/items/{offerId}", auth.RequireUser(httpx.Handler(h.remove)))
	mux.Handle("POST /api/cart/merge", auth.RequireUser(httpx.Handler(h.merge)))
}

func userID(r *http.Request) string {
	u, _ := auth.FromContext(r.Context())
	return u.ID
}

func offerID(r *http.Request) (int64, error) {
	id, err := strconv.ParseInt(r.PathValue("offerId"), 10, 64)
	if err != nil || id < 1 {
		return 0, httpx.NewError(http.StatusBadRequest, "bad_request", "Invalid offer id")
	}
	return id, nil
}

func (h *Handler) respond(w http.ResponseWriter, r *http.Request) error {
	c, err := h.store.Get(r.Context(), userID(r))
	if err != nil {
		return err
	}
	httpx.JSON(w, http.StatusOK, c)
	return nil
}

func (h *Handler) get(w http.ResponseWriter, r *http.Request) error { return h.respond(w, r) }

func (h *Handler) set(w http.ResponseWriter, r *http.Request) error {
	id, err := offerID(r)
	if err != nil {
		return err
	}
	var body struct {
		Quantity int `json:"quantity"`
	}
	if err := httpx.Decode(r, &body); err != nil {
		return err
	}
	if err := h.store.Set(r.Context(), userID(r), id, body.Quantity); err != nil {
		return err
	}
	return h.respond(w, r)
}

func (h *Handler) remove(w http.ResponseWriter, r *http.Request) error {
	id, err := offerID(r)
	if err != nil {
		return err
	}
	if err := h.store.Remove(r.Context(), userID(r), id); err != nil {
		return err
	}
	return h.respond(w, r)
}

func (h *Handler) merge(w http.ResponseWriter, r *http.Request) error {
	var body struct {
		Items []Item `json:"items"`
	}
	if err := httpx.Decode(r, &body); err != nil {
		return err
	}
	if len(body.Items) > 50 {
		return httpx.NewError(http.StatusUnprocessableEntity, "validation_failed", "Too many cart lines")
	}
	if err := h.store.Merge(r.Context(), userID(r), body.Items); err != nil {
		return err
	}
	return h.respond(w, r)
}

// lookup: GET /api/offers?items=12:1,40:2 → cart lines for a guest cart.
func (h *Handler) lookup(w http.ResponseWriter, r *http.Request) error {
	var items []Item
	for _, part := range strings.Split(r.URL.Query().Get("items"), ",") {
		if part == "" {
			continue
		}
		idStr, qtyStr, _ := strings.Cut(part, ":")
		id, err1 := strconv.ParseInt(idStr, 10, 64)
		qty, err2 := strconv.Atoi(qtyStr)
		if err1 != nil || err2 != nil || id < 1 || qty < 1 || qty > MaxQuantity || len(items) >= 50 {
			return httpx.NewError(http.StatusBadRequest, "bad_request", "items must look like 12:1,40:2")
		}
		items = append(items, Item{OfferID: id, Quantity: qty})
	}
	c, err := h.store.Lines(r.Context(), items)
	if err != nil {
		return err
	}
	httpx.JSON(w, http.StatusOK, c)
	return nil
}
