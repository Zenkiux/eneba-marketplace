package app_test

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"strings"
	"testing"
)

type offerInfo struct {
	id    int64
	price int64
	stock int
}

// inStockOffers returns n offers with at least minStock available keys.
func (s *stack) inStockOffers(n, minStock int) []offerInfo {
	s.t.Helper()
	rows, err := s.pool.Query(context.Background(), `SELECT o.id, o.price_cents,
		(SELECT count(*)::int FROM offer_keys k WHERE k.offer_id = o.id AND k.status = 'available') AS stock
		FROM offers o WHERE o.active ORDER BY o.id`)
	if err != nil {
		s.t.Fatal(err)
	}
	defer rows.Close()
	var out []offerInfo
	for rows.Next() {
		var o offerInfo
		rows.Scan(&o.id, &o.price, &o.stock)
		if o.stock >= minStock {
			out = append(out, o)
		}
		if len(out) == n {
			break
		}
	}
	if len(out) < n {
		s.t.Fatalf("not enough offers with stock >= %d", minStock)
	}
	return out
}

func (s *stack) signedIn(email string) *http.Client {
	c := s.client()
	if r := s.do(c, "POST", "/api/auth/register", creds(email, "longenough")); r.status != 201 {
		s.t.Fatalf("register %s: %d", email, r.status)
	}
	return c
}

func lines(r resp) []map[string]any {
	var out []map[string]any
	for _, l := range r.body["lines"].([]any) {
		out = append(out, l.(map[string]any))
	}
	return out
}

func TestCartRequiresSignIn(t *testing.T) {
	s := newStack(t, "dev")
	c := s.client()
	for _, tc := range []struct{ method, path string }{
		{"GET", "/api/cart"}, {"PUT", "/api/cart/items/1"}, {"DELETE", "/api/cart/items/1"}, {"POST", "/api/cart/merge"},
	} {
		if r := s.do(c, tc.method, tc.path, map[string]int{"quantity": 1}); r.status != 401 {
			t.Errorf("%s %s: %d, want 401", tc.method, tc.path, r.status)
		}
	}
}

func TestCartSetGetRemoveWithLivePrices(t *testing.T) {
	s := newStack(t, "dev")
	c := s.signedIn("cart@example.com")
	offers := s.inStockOffers(2, 3)

	s.do(c, "PUT", fmt.Sprintf("/api/cart/items/%d", offers[0].id), map[string]int{"quantity": 2})
	r := s.do(c, "PUT", fmt.Sprintf("/api/cart/items/%d", offers[1].id), map[string]int{"quantity": 1})
	if r.status != 200 || len(lines(r)) != 2 {
		t.Fatalf("set: %d %v", r.status, r.body)
	}
	want := offers[0].price*2 + offers[1].price
	if int64(r.body["totalCents"].(float64)) != want || int(r.body["count"].(float64)) != 3 {
		t.Fatalf("total %v count %v, want %d / 3", r.body["totalCents"], r.body["count"], want)
	}

	// Setting again replaces the quantity rather than adding.
	r = s.do(c, "PUT", fmt.Sprintf("/api/cart/items/%d", offers[0].id), map[string]int{"quantity": 1})
	if int(lines(r)[0]["quantity"].(float64)) != 1 {
		t.Fatal("PUT must set an exact quantity")
	}

	// Price changes are visible immediately: the cart stores no prices.
	s.pool.Exec(context.Background(), `UPDATE offers SET price_cents = 4242 WHERE id = $1`, offers[0].id)
	r = s.do(c, "GET", "/api/cart", nil)
	if int64(lines(r)[0]["priceCents"].(float64)) != 4242 {
		t.Fatal("cart should show the current price")
	}

	r = s.do(c, "DELETE", fmt.Sprintf("/api/cart/items/%d", offers[1].id), nil)
	if len(lines(r)) != 1 {
		t.Fatalf("remove: %v", r.body)
	}
}

func TestCartRejectsInvalidQuantitiesAndOffers(t *testing.T) {
	s := newStack(t, "dev")
	c := s.signedIn("rules@example.com")
	o := s.inStockOffers(1, 1)[0]
	ctx := context.Background()

	for _, q := range []int{0, -1, 11} {
		if r := s.do(c, "PUT", fmt.Sprintf("/api/cart/items/%d", o.id), map[string]int{"quantity": q}); r.status != 422 {
			t.Errorf("quantity %d: %d", q, r.status)
		}
	}
	if o.stock < 10 {
		if r := s.do(c, "PUT", fmt.Sprintf("/api/cart/items/%d", o.id), map[string]int{"quantity": o.stock + 1}); r.status != 409 || errCode(r) != "insufficient_stock" {
			t.Errorf("more than stock: %d %v", r.status, r.body)
		}
	}
	if r := s.do(c, "PUT", "/api/cart/items/999999", map[string]int{"quantity": 1}); r.status != 404 {
		t.Errorf("unknown offer: %d", r.status)
	}
	s.pool.Exec(ctx, `UPDATE offers SET active = false WHERE id = $1`, o.id)
	if r := s.do(c, "PUT", fmt.Sprintf("/api/cart/items/%d", o.id), map[string]int{"quantity": 1}); r.status != 404 || errCode(r) != "offer_unavailable" {
		t.Errorf("inactive offer: %d %v", r.status, r.body)
	}
	var soldOut int64
	s.pool.QueryRow(ctx, `SELECT o.id FROM offers o WHERE o.active AND NOT EXISTS
		(SELECT 1 FROM offer_keys k WHERE k.offer_id = o.id AND k.status = 'available') LIMIT 1`).Scan(&soldOut)
	if r := s.do(c, "PUT", fmt.Sprintf("/api/cart/items/%d", soldOut), map[string]int{"quantity": 1}); r.status != 409 || errCode(r) != "out_of_stock" {
		t.Errorf("sold-out offer: %d %v", r.status, r.body)
	}
}

func TestCartsAreIsolatedPerUser(t *testing.T) {
	s := newStack(t, "dev")
	alice := s.signedIn("alice@example.com")
	bob := s.signedIn("bob@example.com")
	o := s.inStockOffers(1, 1)[0]
	s.do(alice, "PUT", fmt.Sprintf("/api/cart/items/%d", o.id), map[string]int{"quantity": 1})
	if r := s.do(bob, "GET", "/api/cart", nil); len(lines(r)) != 0 {
		t.Fatal("bob must not see alice's cart")
	}
	// Bob deleting the same offer id only affects his own (empty) cart.
	s.do(bob, "DELETE", fmt.Sprintf("/api/cart/items/%d", o.id), nil)
	if r := s.do(alice, "GET", "/api/cart", nil); len(lines(r)) != 1 {
		t.Fatal("alice's cart changed by bob")
	}
}

func TestMergeGuestCart(t *testing.T) {
	s := newStack(t, "dev")
	c := s.signedIn("merge@example.com")
	offers := s.inStockOffers(2, 1)
	s.do(c, "PUT", fmt.Sprintf("/api/cart/items/%d", offers[0].id), map[string]int{"quantity": 1})

	r := s.do(c, "POST", "/api/cart/merge", map[string]any{"items": []map[string]int64{
		{"offerId": offers[0].id, "quantity": 9}, // 1 + 9 = 10
		{"offerId": offers[0].id, "quantity": 5}, // would exceed 10: capped
		{"offerId": offers[1].id, "quantity": 2},
		{"offerId": 999999, "quantity": 1}, // unknown: skipped
	}})
	if r.status != 200 {
		t.Fatalf("merge: %d %v", r.status, r.body)
	}
	got := map[int64]int{}
	for _, l := range lines(r) {
		got[int64(l["offerId"].(float64))] = int(l["quantity"].(float64))
	}
	if got[offers[0].id] != 10 || got[offers[1].id] != 2 || len(got) != 2 {
		t.Fatalf("merged cart %v", got)
	}
}

func TestGuestOfferLookup(t *testing.T) {
	s := newStack(t, "dev")
	o := s.inStockOffers(2, 1)
	r := s.do(s.client(), "GET", fmt.Sprintf("/api/offers?items=%d:2,%d:1,999999:1", o[1].id, o[0].id), nil)
	if r.status != 200 || len(lines(r)) != 2 {
		t.Fatalf("lookup: %d %v", r.status, r.body)
	}
	if int64(lines(r)[0]["offerId"].(float64)) != o[1].id || int(lines(r)[0]["quantity"].(float64)) != 2 {
		t.Fatal("lookup should keep the requested order and quantities")
	}
	for _, bad := range []string{"abc", "1:0", "1:11", "-1:1", "1"} {
		if r := s.do(s.client(), "GET", "/api/offers?items="+bad, nil); r.status != 400 {
			t.Errorf("items=%s: %d", bad, r.status)
		}
	}
	res, _ := http.Get(s.srv.URL + fmt.Sprintf("/api/offers?items=%d:1", o[0].id))
	raw, _ := io.ReadAll(res.Body)
	res.Body.Close()
	if strings.Contains(string(raw), "DEMO-") {
		t.Fatal("offer lookup leaked a key")
	}
}
