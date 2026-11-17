package orders

import (
	"context"
	"errors"
	"regexp"
	"time"

	"github.com/jackc/pgx/v5"
)

type Order struct {
	ID              string      `json:"id"`
	Status          string      `json:"status"` // pending_payment | paid | cancelled | expired
	TotalCents      int64       `json:"totalCents"`
	Currency        string      `json:"currency"`
	CreatedAt       time.Time   `json:"createdAt"`
	ExpiresAt       time.Time   `json:"expiresAt"`
	PaidAt          *time.Time  `json:"paidAt"`
	LastPayment     *string     `json:"lastPayment"`   // "succeeded" | "declined" | null
	PaymentMethod   *string     `json:"paymentMethod"` // demo method of the successful payment, if recorded
	Items           []OrderItem `json:"items"`
	ItemCount       int         `json:"itemCount"`
	SecondsToExpiry int         `json:"secondsToExpiry"` // only meaningful while pending
}

type OrderItem struct {
	OfferID        int64  `json:"offerId"`
	ProductSlug    string `json:"productSlug"`
	Title          string `json:"title"`
	CoverURL       string `json:"coverUrl"`
	Seller         string `json:"seller"`
	UnitPriceCents int64  `json:"unitPriceCents"`
	Quantity       int    `json:"quantity"`
	// Keys are present only for the owner of a paid order, and only in the order detail.
	Keys []string `json:"keys,omitempty"`
}

var uuidRe = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

func validUUID(s string) bool { return uuidRe.MatchString(s) }

const orderCols = `o.id, o.status, o.total_cents, o.currency, o.created_at, o.expires_at, o.paid_at,
	(SELECT outcome::text FROM payment_attempts pa WHERE pa.order_id = o.id ORDER BY pa.id DESC LIMIT 1),
	(SELECT nullif(method, '') FROM payment_attempts pa WHERE pa.order_id = o.id AND pa.outcome = 'succeeded' LIMIT 1),
	greatest(0, extract(epoch FROM o.expires_at - now()))::int`

func scanOrder(row pgx.Row) (Order, error) {
	var o Order
	err := row.Scan(&o.ID, &o.Status, &o.TotalCents, &o.Currency, &o.CreatedAt, &o.ExpiresAt, &o.PaidAt, &o.LastPayment, &o.PaymentMethod, &o.SecondsToExpiry)
	return o, err
}

func (s *Service) items(ctx context.Context, orderIDs []string) (map[string][]OrderItem, map[int64]*OrderItem, error) {
	rows, err := s.db.Query(ctx, `SELECT oi.order_id, oi.id, oi.offer_id, p.slug, oi.title_snapshot, p.cover_url, oi.seller_snapshot,
			oi.unit_price_cents, oi.quantity
		FROM order_items oi JOIN products p ON p.id = oi.product_id
		WHERE oi.order_id = ANY($1::uuid[]) ORDER BY oi.id`, orderIDs)
	if err != nil {
		return nil, nil, err
	}
	defer rows.Close()
	byOrder := map[string][]OrderItem{}
	type ref struct {
		order string
		idx   int
	}
	refs := map[int64]ref{}
	for rows.Next() {
		var orderID string
		var itemID int64
		var it OrderItem
		if err := rows.Scan(&orderID, &itemID, &it.OfferID, &it.ProductSlug, &it.Title, &it.CoverURL, &it.Seller, &it.UnitPriceCents, &it.Quantity); err != nil {
			return nil, nil, err
		}
		byOrder[orderID] = append(byOrder[orderID], it)
		refs[itemID] = ref{orderID, len(byOrder[orderID]) - 1}
	}
	if err := rows.Err(); err != nil {
		return nil, nil, err
	}
	ptrs := map[int64]*OrderItem{}
	for id, r := range refs {
		ptrs[id] = &byOrder[r.order][r.idx]
	}
	return byOrder, ptrs, nil
}

// Get returns one of the user's orders. Another user's order id behaves exactly like an unknown
// id (404), so ids can't be probed. Keys are decrypted only when the order is paid.
func (s *Service) Get(ctx context.Context, userID, orderID string) (Order, error) {
	if !validUUID(orderID) {
		return Order{}, errNotFound
	}
	o, err := scanOrder(s.db.QueryRow(ctx, `SELECT `+orderCols+` FROM orders o WHERE o.id = $1 AND o.user_id = $2`, orderID, userID))
	if errors.Is(err, pgx.ErrNoRows) {
		return Order{}, errNotFound
	}
	if err != nil {
		return Order{}, err
	}
	byOrder, ptrs, err := s.items(ctx, []string{o.ID})
	if err != nil {
		return Order{}, err
	}
	if o.Status == "paid" {
		rows, err := s.db.Query(ctx, `SELECT k.order_item_id, k.code_ciphertext FROM offer_keys k
			JOIN order_items oi ON oi.id = k.order_item_id
			WHERE oi.order_id = $1 AND k.status = 'sold' ORDER BY k.id`, o.ID)
		if err != nil {
			return Order{}, err
		}
		defer rows.Close()
		for rows.Next() {
			var itemID int64
			var sealed []byte
			if err := rows.Scan(&itemID, &sealed); err != nil {
				return Order{}, err
			}
			code, err := s.box.Open(sealed)
			if err != nil {
				return Order{}, err
			}
			if it := ptrs[itemID]; it != nil {
				it.Keys = append(it.Keys, code)
			}
		}
		if err := rows.Err(); err != nil {
			return Order{}, err
		}
	}
	o.Items = byOrder[o.ID]
	for _, it := range o.Items {
		o.ItemCount += it.Quantity
	}
	return o, nil
}

// List returns the user's orders, newest first, without keys (open an order to see its keys).
func (s *Service) List(ctx context.Context, userID string) ([]Order, error) {
	rows, err := s.db.Query(ctx, `SELECT `+orderCols+` FROM orders o WHERE o.user_id = $1 ORDER BY o.created_at DESC, o.id LIMIT 100`, userID)
	if err != nil {
		return nil, err
	}
	list, err := pgx.CollectRows(rows, func(r pgx.CollectableRow) (Order, error) { return scanOrder(r) })
	if err != nil || len(list) == 0 {
		return []Order{}, err
	}
	ids := make([]string, len(list))
	for i, o := range list {
		ids[i] = o.ID
	}
	byOrder, _, err := s.items(ctx, ids)
	if err != nil {
		return nil, err
	}
	for i := range list {
		list[i].Items = byOrder[list[i].ID]
		for _, it := range list[i].Items {
			list[i].ItemCount += it.Quantity
		}
	}
	return list, nil
}

// Labels the demo payment page may send. Only these are stored.
func validMethod(m string) bool {
	switch m {
	case "card", "wallet", "bank", "declined":
		return true
	}
	return false
}

func (s *Service) recordMethod(ctx context.Context, orderID, attemptKey, method string) error {
	if !validUUID(orderID) {
		return nil
	}
	_, err := s.db.Exec(ctx, `UPDATE payment_attempts SET method = $3 WHERE order_id = $1 AND idempotency_key = $2 AND method = ''`,
		orderID, attemptKey, method)
	return err
}
