package orders_test

import (
	"context"
	"errors"
	"fmt"
	"math/rand/v2"
	"strings"
	"sync"
	"sync/atomic"
	"testing"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/Zenkiux/eneba-marketplace/api/internal/httpx"
	"github.com/Zenkiux/eneba-marketplace/api/internal/keys"
	"github.com/Zenkiux/eneba-marketplace/api/internal/orders"
	"github.com/Zenkiux/eneba-marketplace/api/internal/testdb"
)

type fixture struct {
	t    *testing.T
	pool *pgxpool.Pool
	svc  *orders.Service
	ctx  context.Context
}

func setup(t *testing.T) *fixture {
	t.Helper()
	pool := testdb.New(t)
	box, err := keys.NewBox(testdb.Key)
	if err != nil {
		t.Fatal(err)
	}
	return &fixture{t: t, pool: pool, svc: orders.NewService(pool, box), ctx: context.Background()}
}

func (f *fixture) exec(sql string, args ...any) {
	f.t.Helper()
	if _, err := f.pool.Exec(f.ctx, sql, args...); err != nil {
		f.t.Fatal(err)
	}
}

func (f *fixture) count(sql string, args ...any) int {
	f.t.Helper()
	var n int
	if err := f.pool.QueryRow(f.ctx, sql, args...).Scan(&n); err != nil {
		f.t.Fatal(err)
	}
	return n
}

func (f *fixture) user(name string) string {
	f.t.Helper()
	var id string
	if err := f.pool.QueryRow(f.ctx, `INSERT INTO users (email, password_hash, display_name) VALUES ($1, 'x', $2) RETURNING id`,
		name+"@example.com", name).Scan(&id); err != nil {
		f.t.Fatal(err)
	}
	return id
}

// offer returns an active offer and limits its available stock to exactly `stock` keys.
func (f *fixture) offer(nth, stock int) (id, price int64) {
	f.t.Helper()
	if err := f.pool.QueryRow(f.ctx, `SELECT o.id, o.price_cents FROM offers o WHERE o.active
		AND (SELECT count(*) FROM offer_keys k WHERE k.offer_id = o.id AND k.status = 'available') >= $1
		ORDER BY o.id OFFSET $2 LIMIT 1`, stock, nth).Scan(&id, &price); err != nil {
		f.t.Fatal(err)
	}
	f.exec(`DELETE FROM offer_keys WHERE offer_id = $1 AND status = 'available'
		AND id NOT IN (SELECT id FROM offer_keys WHERE offer_id = $1 AND status = 'available' ORDER BY id LIMIT $2)`, id, stock)
	return id, price
}

func (f *fixture) available(offerID int64) int {
	return f.count(`SELECT count(*) FROM offer_keys WHERE offer_id = $1 AND status = 'available'`, offerID)
}

// checkInvariant verifies the key ⇔ order consistency rules from the package documentation.
func (f *fixture) checkInvariant() {
	f.t.Helper()
	checks := map[string]string{
		"reserved key on a non-pending order": `SELECT count(*) FROM offer_keys k JOIN order_items oi ON oi.id = k.order_item_id
			JOIN orders o ON o.id = oi.order_id WHERE k.status = 'reserved' AND o.status <> 'pending_payment'`,
		"sold key on an unpaid order": `SELECT count(*) FROM offer_keys k JOIN order_items oi ON oi.id = k.order_item_id
			JOIN orders o ON o.id = oi.order_id WHERE k.status = 'sold' AND o.status <> 'paid'`,
		"pending/paid item with wrong number of keys": `SELECT count(*) FROM order_items oi JOIN orders o ON o.id = oi.order_id
			WHERE o.status IN ('pending_payment', 'paid')
			  AND oi.quantity <> (SELECT count(*) FROM offer_keys k WHERE k.order_item_id = oi.id)`,
		"cancelled/expired item still holding keys": `SELECT count(*) FROM order_items oi JOIN orders o ON o.id = oi.order_id
			WHERE o.status IN ('cancelled', 'expired') AND EXISTS (SELECT 1 FROM offer_keys k WHERE k.order_item_id = oi.id)`,
		"paid order without exactly one successful payment": `SELECT count(*) FROM orders o WHERE o.status = 'paid'
			AND (SELECT count(*) FROM payment_attempts pa WHERE pa.order_id = o.id AND pa.outcome = 'succeeded') <> 1`,
		"paid order whose keys were not all sold": `SELECT count(*) FROM orders o JOIN order_items oi ON oi.order_id = o.id
			WHERE o.status = 'paid' AND EXISTS (SELECT 1 FROM offer_keys k WHERE k.order_item_id = oi.id AND k.status <> 'sold')`,
	}
	for name, sql := range checks {
		if n := f.count(sql); n != 0 {
			f.t.Errorf("invariant broken: %s (%d rows)", name, n)
		}
	}
}

func code(err error) string {
	var e *httpx.Error
	if errors.As(err, &e) {
		return e.Code
	}
	return ""
}

func key(prefix string, i int) string { return fmt.Sprintf("%s-%08d", prefix, i) }

// ---------------------------------------------------------------- happy path

func TestCreatePayDeliversKeys(t *testing.T) {
	f := setup(t)
	u := f.user("buyer")
	a, pa := f.offer(0, 5)
	b, pb := f.offer(1, 5)
	o, created, err := f.svc.Create(f.ctx, u, key("k", 1), []orders.Item{{a, 2}, {b, 1}}, pa*2+pb)
	if err != nil || !created || o.Status != "pending_payment" || o.ItemCount != 3 {
		t.Fatalf("create: %+v %v %v", o, created, err)
	}
	if f.available(a) != 3 || f.available(b) != 4 {
		t.Fatal("reservation should take keys out of stock")
	}
	for _, it := range o.Items {
		if len(it.Keys) != 0 {
			t.Fatal("keys must not be visible before payment")
		}
	}
	f.checkInvariant()

	paid, err := f.svc.Pay(f.ctx, u, o.ID, key("p", 1), orders.OutcomeSuccess)
	if err != nil || paid.Status != "paid" || paid.PaidAt == nil {
		t.Fatalf("pay: %+v %v", paid, err)
	}
	seen := map[string]bool{}
	for _, it := range paid.Items {
		if len(it.Keys) != it.Quantity {
			t.Fatalf("%s: %d keys for quantity %d", it.Title, len(it.Keys), it.Quantity)
		}
		for _, k := range it.Keys {
			if !strings.HasPrefix(k, "DEMO-") || seen[k] {
				t.Fatalf("bad or duplicate key %q", k)
			}
			seen[k] = true
		}
	}
	f.checkInvariant()

	// Another user can't see it, list shows it without keys.
	if _, err := f.svc.Get(f.ctx, f.user("other"), o.ID); code(err) != "not_found" {
		t.Fatalf("other user's order: %v", err)
	}
	list, _ := f.svc.List(f.ctx, u)
	if len(list) != 1 || list[0].ID != o.ID || len(list[0].Items[0].Keys) != 0 {
		t.Fatalf("list: %+v", list)
	}
}

func TestPaymentRemovesBoughtOffersFromCart(t *testing.T) {
	f := setup(t)
	u := f.user("cartbuyer")
	a, pa := f.offer(0, 3)
	b, _ := f.offer(1, 3)
	f.exec(`INSERT INTO cart_items (user_id, offer_id, quantity) VALUES ($1, $2, 1), ($1, $3, 1)`, u, a, b)
	o, _, _ := f.svc.Create(f.ctx, u, key("k", 1), []orders.Item{{a, 1}}, pa)
	f.svc.Pay(f.ctx, u, o.ID, key("p", 1), orders.OutcomeSuccess)
	if n := f.count(`SELECT count(*) FROM cart_items WHERE user_id = $1`, u); n != 1 {
		t.Fatalf("cart should keep only the unbought offer, has %d lines", n)
	}
}

// ---------------------------------------------------------------- validation & conflicts

func TestCreateRejectsBadInput(t *testing.T) {
	f := setup(t)
	u := f.user("v")
	a, pa := f.offer(0, 3)
	cases := []struct {
		name  string
		key   string
		items []orders.Item
		total int64
		want  string
	}{
		{"no key", "", []orders.Item{{a, 1}}, pa, "bad_request"},
		{"empty", key("k", 1), nil, pa, "empty_cart"},
		{"zero qty", key("k", 2), []orders.Item{{a, 0}}, pa, "validation_failed"},
		{"too many", key("k", 3), []orders.Item{{a, 11}}, pa, "validation_failed"},
		{"duplicate line", key("k", 4), []orders.Item{{a, 1}, {a, 1}}, pa * 2, "validation_failed"},
		{"unknown offer", key("k", 5), []orders.Item{{999999, 1}}, pa, "offer_unavailable"},
		{"wrong total", key("k", 6), []orders.Item{{a, 1}}, pa + 1, "price_changed"},
	}
	for _, c := range cases {
		if _, _, err := f.svc.Create(f.ctx, u, c.key, c.items, c.total); code(err) != c.want {
			t.Errorf("%s: got %v, want %s", c.name, err, c.want)
		}
	}
	if f.available(a) != 3 || f.count(`SELECT count(*) FROM orders`) != 0 {
		t.Fatal("rejected requests must not reserve keys or leave orders")
	}
}

func TestPriceChangeAndInactiveOffer(t *testing.T) {
	f := setup(t)
	u := f.user("p")
	a, pa := f.offer(0, 3)
	f.exec(`UPDATE offers SET price_cents = price_cents + 100 WHERE id = $1`, a)
	if _, _, err := f.svc.Create(f.ctx, u, key("k", 1), []orders.Item{{a, 1}}, pa); code(err) != "price_changed" {
		t.Fatalf("price change: %v", err)
	}
	// The client retries with the new total and a new attempt key.
	if _, _, err := f.svc.Create(f.ctx, u, key("k", 2), []orders.Item{{a, 1}}, pa+100); err != nil {
		t.Fatalf("retry with new price: %v", err)
	}
	f.exec(`UPDATE offers SET active = false WHERE id = $1`, a)
	if _, _, err := f.svc.Create(f.ctx, u, key("k", 3), []orders.Item{{a, 1}}, pa+100); code(err) != "offer_unavailable" {
		t.Fatalf("inactive: %v", err)
	}
	f.checkInvariant()
}

func TestMultiItemOrderIsAllOrNothing(t *testing.T) {
	f := setup(t)
	u := f.user("m")
	a, pa := f.offer(0, 5)
	b, pb := f.offer(1, 1)
	_, _, err := f.svc.Create(f.ctx, u, key("k", 1), []orders.Item{{a, 2}, {b, 2}}, pa*2+pb*2)
	if code(err) != "out_of_stock" {
		t.Fatalf("want out_of_stock, got %v", err)
	}
	if f.available(a) != 5 || f.available(b) != 1 || f.count(`SELECT count(*) FROM orders`) != 0 {
		t.Fatal("a failed line must roll back the whole order, including keys of other lines")
	}
}

func TestFailureAfterReservationRollsBack(t *testing.T) {
	f := setup(t)
	u := f.user("crash")
	a, pa := f.offer(0, 4)
	f.svc.SetAfterReserve(func() error { return errors.New("simulated database failure") })
	if _, _, err := f.svc.Create(f.ctx, u, key("k", 1), []orders.Item{{a, 3}}, pa*3); err == nil {
		t.Fatal("expected the injected failure")
	}
	if f.available(a) != 4 || f.count(`SELECT count(*) FROM orders`) != 0 || f.count(`SELECT count(*) FROM order_items`) != 0 {
		t.Fatal("injected failure must leave no order, no items and no reserved keys")
	}
	// After the fault clears, the same request (same key) succeeds normally.
	f.svc.SetAfterReserve(nil)
	if _, created, err := f.svc.Create(f.ctx, u, key("k", 1), []orders.Item{{a, 3}}, pa*3); err != nil || !created {
		t.Fatalf("retry after failure: %v", err)
	}
	f.checkInvariant()
}

// ---------------------------------------------------------------- idempotency

func TestCreateIsIdempotent(t *testing.T) {
	f := setup(t)
	u := f.user("idem")
	a, pa := f.offer(0, 5)
	o1, c1, err1 := f.svc.Create(f.ctx, u, key("same", 1), []orders.Item{{a, 1}}, pa)
	o2, c2, err2 := f.svc.Create(f.ctx, u, key("same", 1), []orders.Item{{a, 1}}, pa)
	if err1 != nil || err2 != nil || !c1 || c2 || o1.ID != o2.ID {
		t.Fatalf("retry should return the same order: %v %v %v %v", c1, c2, err1, err2)
	}
	if f.available(a) != 4 {
		t.Fatal("a retried request must not reserve again")
	}
	if _, _, err := f.svc.Create(f.ctx, u, key("same", 1), []orders.Item{{a, 2}}, pa*2); code(err) != "idempotency_mismatch" {
		t.Fatalf("same key, different cart: %v", err)
	}
}

func TestConcurrentDuplicateCreates(t *testing.T) {
	f := setup(t)
	u := f.user("dup")
	a, pa := f.offer(0, 10)
	var wg sync.WaitGroup
	ids := make([]string, 10)
	errs := make([]error, 10)
	for i := range 10 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			o, _, err := f.svc.Create(f.ctx, u, "double-click-key", []orders.Item{{a, 2}}, pa*2)
			ids[i], errs[i] = o.ID, err
		}()
	}
	wg.Wait()
	for i := range 10 {
		if errs[i] != nil || ids[i] != ids[0] {
			t.Fatalf("request %d: id %s err %v (first id %s)", i, ids[i], errs[i], ids[0])
		}
	}
	if f.count(`SELECT count(*) FROM orders`) != 1 || f.available(a) != 8 {
		t.Fatal("10 identical concurrent requests must create one order reserving 2 keys")
	}
	f.checkInvariant()
}

func TestPayIsIdempotentAndRetryAfterDecline(t *testing.T) {
	f := setup(t)
	u := f.user("payer")
	a, pa := f.offer(0, 3)
	o, _, _ := f.svc.Create(f.ctx, u, key("k", 1), []orders.Item{{a, 1}}, pa)

	if _, err := f.svc.Pay(f.ctx, u, o.ID, key("attempt", 1), orders.OutcomeDecline); code(err) != "payment_declined" {
		t.Fatalf("decline: %v", err)
	}
	// Repeating the declined attempt (same key) reports the same decline; keys stay reserved.
	if _, err := f.svc.Pay(f.ctx, u, o.ID, key("attempt", 1), orders.OutcomeSuccess); code(err) != "payment_declined" {
		t.Fatalf("replayed attempt key should keep its first result: %v", err)
	}
	if f.available(a) != 2 {
		t.Fatal("a declined payment must keep the reservation for a retry")
	}
	paid, err := f.svc.Pay(f.ctx, u, o.ID, key("attempt", 2), orders.OutcomeSuccess)
	if err != nil || paid.Status != "paid" {
		t.Fatalf("retry: %v", err)
	}
	// Double submit after success: same order, no second payment.
	again, err := f.svc.Pay(f.ctx, u, o.ID, key("attempt", 3), orders.OutcomeSuccess)
	if err != nil || again.Status != "paid" || f.count(`SELECT count(*) FROM payment_attempts WHERE outcome = 'succeeded'`) != 1 {
		t.Fatalf("double pay: %v", err)
	}
	f.checkInvariant()
}

func TestConcurrentPaySubmissions(t *testing.T) {
	f := setup(t)
	u := f.user("race-pay")
	a, pa := f.offer(0, 3)
	o, _, _ := f.svc.Create(f.ctx, u, key("k", 1), []orders.Item{{a, 1}}, pa)
	var wg sync.WaitGroup
	var ok atomic.Int32
	for i := range 8 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if p, err := f.svc.Pay(f.ctx, u, o.ID, key("tab", i), orders.OutcomeSuccess); err == nil && p.Status == "paid" {
				ok.Add(1)
			}
		}()
	}
	wg.Wait()
	if ok.Load() != 8 || f.count(`SELECT count(*) FROM payment_attempts WHERE outcome = 'succeeded'`) != 1 {
		t.Fatalf("all submissions should see the paid order and exactly one payment should exist (ok=%d)", ok.Load())
	}
	f.checkInvariant()
}

// ---------------------------------------------------------------- expiry & cancellation

func TestExpiredReservationReturnsKeysAndCannotBePaid(t *testing.T) {
	f := setup(t)
	u := f.user("late")
	a, pa := f.offer(0, 2)
	o, _, _ := f.svc.Create(f.ctx, u, key("k", 1), []orders.Item{{a, 2}}, pa*2)
	if f.available(a) != 0 {
		t.Fatal("both keys should be reserved")
	}
	f.exec(`UPDATE orders SET expires_at = now() - interval '1 second' WHERE id = $1`, o.ID)

	// Paying an overdue order expires it in the same transaction.
	if _, err := f.svc.Pay(f.ctx, u, o.ID, key("p", 1), orders.OutcomeSuccess); code(err) != "order_expired" {
		t.Fatalf("pay after expiry: %v", err)
	}
	if f.available(a) != 2 {
		t.Fatal("expired order must release its keys")
	}
	got, _ := f.svc.Get(f.ctx, u, o.ID)
	if got.Status != "expired" {
		t.Fatalf("status %s", got.Status)
	}
	f.checkInvariant()
}

func TestSweepFreesStockForOtherBuyers(t *testing.T) {
	f := setup(t)
	a, pa := f.offer(0, 1)
	first, second := f.user("first"), f.user("second")
	o, _, _ := f.svc.Create(f.ctx, first, key("k", 1), []orders.Item{{a, 1}}, pa)
	if _, _, err := f.svc.Create(f.ctx, second, key("k", 2), []orders.Item{{a, 1}}, pa); code(err) != "out_of_stock" {
		t.Fatalf("stock should be held by the first buyer: %v", err)
	}
	f.exec(`UPDATE orders SET expires_at = now() - interval '1 second' WHERE id = $1`, o.ID)
	// Create runs the sweep first, so the abandoned reservation no longer blocks the sale.
	if _, _, err := f.svc.Create(f.ctx, second, key("k", 3), []orders.Item{{a, 1}}, pa); err != nil {
		t.Fatalf("after expiry the second buyer should get the key: %v", err)
	}
	f.checkInvariant()
}

func TestCancelAndNewCheckoutReplacesOldOne(t *testing.T) {
	f := setup(t)
	u := f.user("cancel")
	a, pa := f.offer(0, 3)
	o1, _, _ := f.svc.Create(f.ctx, u, key("k", 1), []orders.Item{{a, 1}}, pa)
	o2, _, _ := f.svc.Create(f.ctx, u, key("k", 2), []orders.Item{{a, 2}}, pa*2)
	if g, _ := f.svc.Get(f.ctx, u, o1.ID); g.Status != "cancelled" {
		t.Fatalf("a new checkout should cancel the user's previous pending order, got %s", g.Status)
	}
	if f.available(a) != 1 {
		t.Fatal("only the new order's 2 keys should be reserved")
	}
	c, err := f.svc.Cancel(f.ctx, u, o2.ID)
	if err != nil || c.Status != "cancelled" || f.available(a) != 3 {
		t.Fatalf("cancel: %v", err)
	}
	if _, err := f.svc.Cancel(f.ctx, u, o2.ID); err != nil {
		t.Fatal("cancel should be idempotent")
	}
	if _, err := f.svc.Pay(f.ctx, u, o2.ID, key("p", 1), orders.OutcomeSuccess); code(err) != "order_expired" {
		t.Fatalf("pay cancelled order: %v", err)
	}
	o3, _, _ := f.svc.Create(f.ctx, u, key("k", 3), []orders.Item{{a, 1}}, pa)
	f.svc.Pay(f.ctx, u, o3.ID, key("p", 2), orders.OutcomeSuccess)
	if _, err := f.svc.Cancel(f.ctx, u, o3.ID); code(err) != "already_paid" {
		t.Fatalf("cancel paid order: %v", err)
	}
	f.checkInvariant()
}

func TestOwnershipOnEveryOperation(t *testing.T) {
	f := setup(t)
	owner, intruder := f.user("owner"), f.user("intruder")
	a, pa := f.offer(0, 3)
	o, _, _ := f.svc.Create(f.ctx, owner, key("k", 1), []orders.Item{{a, 1}}, pa)
	if _, err := f.svc.Pay(f.ctx, intruder, o.ID, key("p", 1), orders.OutcomeSuccess); code(err) != "not_found" {
		t.Fatalf("intruder pay: %v", err)
	}
	if _, err := f.svc.Cancel(f.ctx, intruder, o.ID); code(err) != "not_found" {
		t.Fatalf("intruder cancel: %v", err)
	}
	if _, err := f.svc.Get(f.ctx, intruder, "not-a-uuid"); code(err) != "not_found" {
		t.Fatalf("malformed id: %v", err)
	}
	if g, _ := f.svc.Get(f.ctx, owner, o.ID); g.Status != "pending_payment" {
		t.Fatal("intruder actions must not change the order")
	}
}

// ---------------------------------------------------------------- concurrency

func TestRaceForLastKeys(t *testing.T) {
	f := setup(t)
	a, pa := f.offer(0, 3)
	const buyers = 50
	users := make([]string, buyers)
	for i := range users {
		users[i] = f.user(fmt.Sprintf("racer%d", i))
	}
	var wg sync.WaitGroup
	var won, soldOut atomic.Int32
	start := make(chan struct{})
	for i := range buyers {
		wg.Add(1)
		go func() {
			defer wg.Done()
			<-start
			_, _, err := f.svc.Create(f.ctx, users[i], key("race", i), []orders.Item{{a, 1}}, pa)
			switch {
			case err == nil:
				won.Add(1)
			case code(err) == "out_of_stock":
				soldOut.Add(1)
			default:
				t.Errorf("buyer %d: unexpected error %v", i, err)
			}
		}()
	}
	close(start)
	wg.Wait()
	if won.Load() != 3 || soldOut.Load() != buyers-3 {
		t.Fatalf("won %d, sold out %d; want exactly 3 winners", won.Load(), soldOut.Load())
	}
	if n := f.count(`SELECT count(DISTINCT order_item_id) FROM offer_keys WHERE offer_id = $1 AND status = 'reserved'`, a); n != 3 {
		t.Fatalf("3 keys should belong to 3 different orders, got %d", n)
	}
	f.checkInvariant()
}

// TestMixedOperationsStress runs creates, payments (success and decline), cancels, forced
// expiries and sweeps at the same time on a small shared stock, then checks that no deadlock
// occurred, no key is owned twice and the invariant holds.
func TestMixedOperationsStress(t *testing.T) {
	f := setup(t)
	offerIDs := make([]int64, 3)
	prices := map[int64]int64{}
	for i := range offerIDs {
		id, price := f.offer(i, 15)
		offerIDs[i], prices[id] = id, price
	}
	const workers = 12
	users := make([]string, workers)
	for i := range users {
		users[i] = f.user(fmt.Sprintf("stress%d", i))
	}
	var wg sync.WaitGroup
	var deadlocks, outOfStock atomic.Int32
	isDeadlock := func(err error) bool {
		var pg *pgconn.PgError
		return errors.As(err, &pg) && (pg.Code == "40P01" || pg.Code == "40001")
	}
	for w := range workers {
		wg.Add(1)
		go func() {
			defer wg.Done()
			r := rand.New(rand.NewPCG(uint64(w), 99))
			for step := range 25 {
				// Random 1–2 line order across the shared offers (ascending order not required).
				n := 1 + r.IntN(2)
				perm := r.Perm(len(offerIDs))[:n]
				var items []orders.Item
				var total int64
				for _, p := range perm {
					q := 1 + r.IntN(2)
					items = append(items, orders.Item{OfferID: offerIDs[p], Quantity: q})
					total += prices[offerIDs[p]] * int64(q)
				}
				o, _, err := f.svc.Create(f.ctx, users[w], key(fmt.Sprintf("w%d", w), step), items, total)
				if isDeadlock(err) {
					deadlocks.Add(1)
				}
				if code(err) == "out_of_stock" {
					outOfStock.Add(1)
				}
				if err != nil {
					if c := code(err); c != "out_of_stock" {
						t.Errorf("unexpected create error: %v", err)
					}
					continue
				}
				switch r.IntN(5) {
				case 0, 1:
					_, err = f.svc.Pay(f.ctx, users[w], o.ID, key(fmt.Sprintf("pw%d", w), step), orders.OutcomeSuccess)
				case 2:
					_, err = f.svc.Pay(f.ctx, users[w], o.ID, key(fmt.Sprintf("pw%d", w), step), orders.OutcomeDecline)
				case 3:
					_, err = f.svc.Cancel(f.ctx, users[w], o.ID)
				case 4:
					f.pool.Exec(f.ctx, `UPDATE orders SET expires_at = now() - interval '1 second' WHERE id = $1`, o.ID)
					_, err = f.svc.Sweep(f.ctx)
				}
				if isDeadlock(err) {
					deadlocks.Add(1)
				}
			}
		}()
	}
	wg.Wait()
	if deadlocks.Load() > 0 {
		t.Fatalf("%d deadlock/serialization failures", deadlocks.Load())
	}
	f.checkInvariant()
	for _, a := range offerIDs {
		total := f.count(`SELECT count(*) FROM offer_keys WHERE offer_id = $1`, a)
		if total != 15 {
			t.Fatalf("offer %d: %d keys exist, want 15 (none lost or created)", a, total)
		}
	}
	paid := f.count(`SELECT count(*) FROM orders WHERE status = 'paid'`)
	cancelled := f.count(`SELECT count(*) FROM orders WHERE status = 'cancelled'`)
	expired := f.count(`SELECT count(*) FROM orders WHERE status = 'expired'`)
	pending := f.count(`SELECT count(*) FROM orders WHERE status = 'pending_payment'`)
	declined := f.count(`SELECT count(*) FROM payment_attempts WHERE outcome = 'declined'`)
	t.Logf("orders: %d paid, %d cancelled, %d expired, %d pending; %d declined attempts; %d create attempts out of stock",
		paid, cancelled, expired, pending, declined, outOfStock.Load())
	// Guard against a stress test that silently does nothing.
	if paid == 0 || cancelled == 0 || expired == 0 || declined == 0 || outOfStock.Load() == 0 {
		t.Fatal("stress run did not exercise every path (paid, cancelled, expired, declined, out of stock)")
	}
}
