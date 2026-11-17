// Package orders turns a cart into an order, reserves digital keys, runs the simulated payment
// and delivers keys.
//
// Invariant (checked by tests after every scenario):
//
//	a key is 'available'  ⇔ it has no order_item_id
//	a key is 'reserved'   ⇒ its order is 'pending_payment'
//	a key is 'sold'       ⇒ its order is 'paid'
//	a pending or paid order item has exactly `quantity` keys; a cancelled/expired one has none
//
// Lock order, used by every transaction so they can never deadlock each other:
//
//	orders (ascending id) → offers (ascending id) → offer_keys (ascending offer_id, id)
package orders

import (
	"context"
	"crypto/sha256"
	"encoding/binary"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"sort"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/Zenkiux/eneba-marketplace/api/internal/httpx"
	"github.com/Zenkiux/eneba-marketplace/api/internal/keys"
)

const (
	ReservationTTL = 15 * time.Minute
	maxLines       = 20
	maxQuantity    = 10
)

type Item struct {
	OfferID  int64 `json:"offerId"`
	Quantity int   `json:"quantity"`
}

type Service struct {
	db  *pgxpool.Pool
	box *keys.Box
	// afterReserve, when set (tests only), runs inside the create transaction after keys are
	// reserved; returning an error simulates a crash/DB failure at the worst moment.
	afterReserve func() error
}

func NewService(db *pgxpool.Pool, box *keys.Box) *Service { return &Service{db: db, box: box} }

// ---------------------------------------------------------------- errors returned to clients

func apiErr(status int, code, msg string, details any) *httpx.Error {
	e := httpx.NewError(status, code, msg)
	e.Details = details
	return e
}

var (
	errNotFound = httpx.NewError(http.StatusNotFound, "not_found", "Order not found")
	errExpired  = httpx.NewError(http.StatusGone, "order_expired", "This order is no longer payable: the reservation expired or was cancelled. Please check out again.")
	errDeclined = httpx.NewError(http.StatusPaymentRequired, "payment_declined", "The (simulated) payment was declined. Your keys stay reserved — you can try again.")
	errPaid     = httpx.NewError(http.StatusConflict, "already_paid", "This order is already paid and cannot be cancelled.")
)

// ---------------------------------------------------------------- create

func validate(idemKey string, items []Item, expectedTotal int64) ([]Item, error) {
	if len(idemKey) < 8 || len(idemKey) > 100 {
		return nil, apiErr(http.StatusBadRequest, "bad_request", "Idempotency-Key header (8–100 characters) is required", nil)
	}
	if len(items) == 0 {
		return nil, apiErr(http.StatusUnprocessableEntity, "empty_cart", "Your cart is empty.", nil)
	}
	if len(items) > maxLines {
		return nil, apiErr(http.StatusUnprocessableEntity, "validation_failed", "Too many lines in one order.", nil)
	}
	if expectedTotal <= 0 {
		return nil, apiErr(http.StatusUnprocessableEntity, "validation_failed", "expectedTotalCents must be positive.", nil)
	}
	sorted := append([]Item(nil), items...)
	sort.Slice(sorted, func(i, j int) bool { return sorted[i].OfferID < sorted[j].OfferID })
	for i, it := range sorted {
		if it.Quantity < 1 || it.Quantity > maxQuantity || it.OfferID < 1 {
			return nil, apiErr(http.StatusUnprocessableEntity, "validation_failed", "Each line needs a valid offer and a quantity from 1 to 10.", nil)
		}
		if i > 0 && sorted[i-1].OfferID == it.OfferID {
			return nil, apiErr(http.StatusUnprocessableEntity, "validation_failed", "Each offer may appear only once.", nil)
		}
	}
	return sorted, nil
}

func requestHash(items []Item, expectedTotal int64) []byte {
	h := sha256.New()
	buf := make([]byte, 8)
	for _, it := range items { // already sorted by offer id
		binary.BigEndian.PutUint64(buf, uint64(it.OfferID))
		h.Write(buf)
		binary.BigEndian.PutUint64(buf, uint64(it.Quantity))
		h.Write(buf)
	}
	binary.BigEndian.PutUint64(buf, uint64(expectedTotal))
	h.Write(buf)
	return h.Sum(nil)
}

// Create places an order and reserves one key per unit. It is idempotent per (user, key):
// repeating the same request returns the same order.
func (s *Service) Create(ctx context.Context, userID, idemKey string, items []Item, expectedTotal int64) (Order, bool, error) {
	items, err := validate(idemKey, items, expectedTotal)
	if err != nil {
		return Order{}, false, err
	}
	hash := requestHash(items, expectedTotal)

	// 1. Cleanup, in its own transaction so the main transaction's lock order stays simple.
	if _, err := s.Sweep(ctx); err != nil {
		return Order{}, false, err
	}
	if err := s.cancelOtherPending(ctx, userID, idemKey); err != nil {
		return Order{}, false, err
	}

	// 2. Main transaction: order row → offers → keys.
	var orderID string
	created := false
	err = pgx.BeginFunc(ctx, s.db, func(tx pgx.Tx) error {
		err := tx.QueryRow(ctx, `INSERT INTO orders (user_id, total_cents, idempotency_key, request_hash, expires_at)
			VALUES ($1, $2, $3, $4, now() + $5::interval)
			ON CONFLICT (user_id, idempotency_key) DO NOTHING RETURNING id`,
			userID, expectedTotal, idemKey, hash, fmt.Sprintf("%d seconds", int(ReservationTTL.Seconds()))).Scan(&orderID)
		if errors.Is(err, pgx.ErrNoRows) {
			// Same key used before (possibly by a concurrent request that has now committed).
			var existingHash []byte
			if err := tx.QueryRow(ctx, `SELECT id, request_hash FROM orders WHERE user_id = $1 AND idempotency_key = $2`,
				userID, idemKey).Scan(&orderID, &existingHash); err != nil {
				return err
			}
			if string(existingHash) != string(hash) {
				return apiErr(http.StatusUnprocessableEntity, "idempotency_mismatch", "This checkout attempt was already used for a different cart. Please reload and try again.", nil)
			}
			return nil
		}
		if err != nil {
			return err
		}
		created = true

		ids := make([]int64, len(items))
		for i, it := range items {
			ids[i] = it.OfferID
		}
		rows, err := tx.Query(ctx, `SELECT o.id, o.price_cents, o.active, o.product_id, o.seller_id, p.title, se.name
			FROM offers o JOIN products p ON p.id = o.product_id JOIN sellers se ON se.id = o.seller_id
			WHERE o.id = ANY($1) ORDER BY o.id FOR SHARE OF o`, ids)
		if err != nil {
			return err
		}
		type offerRow struct {
			id, price, productID, sellerID int64
			active                         bool
			title, seller                  string
		}
		found := map[int64]offerRow{}
		for rows.Next() {
			var o offerRow
			if err := rows.Scan(&o.id, &o.price, &o.active, &o.productID, &o.sellerID, &o.title, &o.seller); err != nil {
				rows.Close()
				return err
			}
			found[o.id] = o
		}
		rows.Close()
		if err := rows.Err(); err != nil {
			return err
		}

		var unavailable []int64
		var total int64
		prices := map[string]int64{}
		for _, it := range items {
			o, ok := found[it.OfferID]
			if !ok || !o.active {
				unavailable = append(unavailable, it.OfferID)
				continue
			}
			total += o.price * int64(it.Quantity)
			prices[strconv.FormatInt(o.id, 10)] = o.price
		}
		if len(unavailable) > 0 {
			return apiErr(http.StatusConflict, "offer_unavailable", "Some offers in your cart are no longer available.", map[string]any{"offerIds": unavailable})
		}
		if total != expectedTotal {
			return apiErr(http.StatusConflict, "price_changed", "Prices changed since you opened your cart. Please review the new total.",
				map[string]any{"totalCents": total, "prices": prices})
		}

		for _, it := range items { // ascending offer id
			o := found[it.OfferID]
			var itemID int64
			if err := tx.QueryRow(ctx, `INSERT INTO order_items (order_id, offer_id, product_id, seller_id, unit_price_cents, quantity, title_snapshot, seller_snapshot)
				VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
				orderID, o.id, o.productID, o.sellerID, o.price, it.Quantity, o.title, o.seller).Scan(&itemID); err != nil {
				return err
			}
			// Reserve keys. SKIP LOCKED: concurrent buyers take different keys instead of
			// waiting on each other; a row can only be updated once, so no key is reserved twice.
			tag, err := tx.Exec(ctx, `UPDATE offer_keys SET status = 'reserved', order_item_id = $1, updated_at = now()
				WHERE id IN (SELECT id FROM offer_keys WHERE offer_id = $2 AND status = 'available'
				             ORDER BY id LIMIT $3 FOR UPDATE SKIP LOCKED)`, itemID, o.id, it.Quantity)
			if err != nil {
				return err
			}
			if got := int(tag.RowsAffected()); got < it.Quantity {
				return apiErr(http.StatusConflict, "out_of_stock", fmt.Sprintf("Not enough keys left for “%s” from %s.", o.title, o.seller),
					map[string]any{"offerId": o.id, "requested": it.Quantity, "available": got})
			}
		}
		if s.afterReserve != nil {
			return s.afterReserve()
		}
		return nil
	})
	if err != nil {
		return Order{}, false, err
	}
	o, err := s.Get(ctx, userID, orderID)
	return o, created, err
}

// releaseKeys returns the keys of the given orders to stock. Callers hold the orders' locks.
func releaseKeys(ctx context.Context, tx pgx.Tx, orderIDs []string) error {
	_, err := tx.Exec(ctx, `UPDATE offer_keys SET status = 'available', order_item_id = NULL, updated_at = now()
		WHERE status = 'reserved' AND order_item_id IN (SELECT id FROM order_items WHERE order_id = ANY($1::uuid[]))`, orderIDs)
	return err
}

func (s *Service) cancelOtherPending(ctx context.Context, userID, keepKey string) error {
	return pgx.BeginFunc(ctx, s.db, func(tx pgx.Tx) error {
		rows, err := tx.Query(ctx, `SELECT id FROM orders WHERE user_id = $1 AND status = 'pending_payment' AND idempotency_key <> $2
			ORDER BY id FOR UPDATE`, userID, keepKey)
		if err != nil {
			return err
		}
		ids, err := pgx.CollectRows(rows, pgx.RowTo[string])
		if err != nil || len(ids) == 0 {
			return err
		}
		if _, err := tx.Exec(ctx, `UPDATE orders SET status = 'cancelled', updated_at = now() WHERE id = ANY($1::uuid[])`, ids); err != nil {
			return err
		}
		return releaseKeys(ctx, tx, ids)
	})
}

// Sweep expires overdue pending orders and returns their keys to stock. It runs before every
// create/pay and once a minute, so stock recovers even after the server slept.
func (s *Service) Sweep(ctx context.Context) (int, error) {
	var n int
	err := pgx.BeginFunc(ctx, s.db, func(tx pgx.Tx) error {
		rows, err := tx.Query(ctx, `SELECT id FROM orders WHERE status = 'pending_payment' AND expires_at < now()
			ORDER BY id LIMIT 200 FOR UPDATE SKIP LOCKED`)
		if err != nil {
			return err
		}
		ids, err := pgx.CollectRows(rows, pgx.RowTo[string])
		if err != nil || len(ids) == 0 {
			return err
		}
		n = len(ids)
		if _, err := tx.Exec(ctx, `UPDATE orders SET status = 'expired', updated_at = now() WHERE id = ANY($1::uuid[])`, ids); err != nil {
			return err
		}
		return releaseKeys(ctx, tx, ids)
	})
	return n, err
}

// RunSweeper calls Sweep every interval until ctx ends.
func (s *Service) RunSweeper(ctx context.Context, every time.Duration) {
	t := time.NewTicker(every)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			if n, err := s.Sweep(ctx); err != nil {
				slog.Error("order sweep", "err", err)
			} else if n > 0 {
				slog.Info("expired unpaid orders", "count", n)
			}
		}
	}
}

// ---------------------------------------------------------------- pay / cancel

type Outcome string

const (
	OutcomeSuccess Outcome = "success"
	OutcomeDecline Outcome = "decline"
)

// lockOwned locks the user's order row (first in the lock order) and returns its state.
func lockOwned(ctx context.Context, tx pgx.Tx, userID, orderID string) (status string, expired bool, err error) {
	err = tx.QueryRow(ctx, `SELECT status, expires_at < now() FROM orders WHERE id = $1 AND user_id = $2 FOR UPDATE`,
		orderID, userID).Scan(&status, &expired)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", false, errNotFound
	}
	return status, expired, err
}

// Pay runs the simulated payment. Idempotent per attempt key; paying a paid order is a no-op.
func (s *Service) Pay(ctx context.Context, userID, orderID, attemptKey string, outcome Outcome) (Order, error) {
	if !validUUID(orderID) {
		return Order{}, errNotFound
	}
	if len(attemptKey) < 8 || len(attemptKey) > 100 {
		return Order{}, apiErr(http.StatusBadRequest, "bad_request", "Idempotency-Key header (8–100 characters) is required", nil)
	}
	if outcome != OutcomeSuccess && outcome != OutcomeDecline {
		return Order{}, apiErr(http.StatusUnprocessableEntity, "validation_failed", `outcome must be "success" or "decline"`, nil)
	}
	var after error // returned after a successful commit (expired / declined)
	err := pgx.BeginFunc(ctx, s.db, func(tx pgx.Tx) error {
		status, expired, err := lockOwned(ctx, tx, userID, orderID)
		if err != nil {
			return err
		}
		var prior string
		err = tx.QueryRow(ctx, `SELECT outcome FROM payment_attempts WHERE order_id = $1 AND idempotency_key = $2`, orderID, attemptKey).Scan(&prior)
		if err == nil { // retry of an attempt we already processed
			if prior == "declined" {
				after = errDeclined
			}
			return nil
		}
		if !errors.Is(err, pgx.ErrNoRows) {
			return err
		}
		switch {
		case status == "paid":
			return nil
		case status != "pending_payment":
			after = errExpired
			return nil
		case expired:
			if _, err := tx.Exec(ctx, `UPDATE orders SET status = 'expired', updated_at = now() WHERE id = $1`, orderID); err != nil {
				return err
			}
			after = errExpired
			return releaseKeys(ctx, tx, []string{orderID})
		}

		if outcome == OutcomeDecline {
			if _, err := tx.Exec(ctx, `INSERT INTO payment_attempts (order_id, outcome, idempotency_key) VALUES ($1, 'declined', $2)`, orderID, attemptKey); err != nil {
				return err
			}
			after = errDeclined
			return nil
		}

		if _, err := tx.Exec(ctx, `INSERT INTO payment_attempts (order_id, outcome, idempotency_key) VALUES ($1, 'succeeded', $2)`, orderID, attemptKey); err != nil {
			return err
		}
		tag, err := tx.Exec(ctx, `UPDATE orders SET status = 'paid', paid_at = now(), updated_at = now() WHERE id = $1 AND status = 'pending_payment'`, orderID)
		if err != nil {
			return err
		}
		if tag.RowsAffected() != 1 {
			return fmt.Errorf("order %s: pending→paid transition matched %d rows", orderID, tag.RowsAffected())
		}
		var units int64
		if err := tx.QueryRow(ctx, `SELECT coalesce(sum(quantity), 0) FROM order_items WHERE order_id = $1`, orderID).Scan(&units); err != nil {
			return err
		}
		tag, err = tx.Exec(ctx, `UPDATE offer_keys SET status = 'sold', updated_at = now()
			WHERE status = 'reserved' AND order_item_id IN (SELECT id FROM order_items WHERE order_id = $1)`, orderID)
		if err != nil {
			return err
		}
		if tag.RowsAffected() != units {
			// Should be impossible; refuse to take the payment rather than deliver the wrong keys.
			return fmt.Errorf("order %s: expected %d reserved keys, found %d", orderID, units, tag.RowsAffected())
		}
		_, err = tx.Exec(ctx, `DELETE FROM cart_items WHERE user_id = $1 AND offer_id IN (SELECT offer_id FROM order_items WHERE order_id = $2)`, userID, orderID)
		return err
	})
	if err != nil {
		return Order{}, err
	}
	if after != nil {
		return Order{}, after
	}
	return s.Get(ctx, userID, orderID)
}

// Cancel abandons an unpaid order and returns its keys to stock. Idempotent.
func (s *Service) Cancel(ctx context.Context, userID, orderID string) (Order, error) {
	if !validUUID(orderID) {
		return Order{}, errNotFound
	}
	err := pgx.BeginFunc(ctx, s.db, func(tx pgx.Tx) error {
		status, _, err := lockOwned(ctx, tx, userID, orderID)
		if err != nil {
			return err
		}
		switch status {
		case "paid":
			return errPaid
		case "pending_payment":
			if _, err := tx.Exec(ctx, `UPDATE orders SET status = 'cancelled', updated_at = now() WHERE id = $1`, orderID); err != nil {
				return err
			}
			return releaseKeys(ctx, tx, []string{orderID})
		}
		return nil // already cancelled or expired
	})
	if err != nil {
		return Order{}, err
	}
	return s.Get(ctx, userID, orderID)
}
