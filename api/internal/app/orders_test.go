package app_test

import (
	"fmt"
	"io"
	"net/http"
	"strings"
	"testing"
)

func checkout(s *stack, c *http.Client, idem string, offerID, total int64) resp {
	return s.do(c, "POST", "/api/orders", map[string]any{
		"items": []map[string]int64{{"offerId": offerID, "quantity": 1}}, "expectedTotalCents": total,
	}, "Idempotency-Key", idem)
}

func TestOrderHTTPFlow(t *testing.T) {
	s := newStack(t, "dev")
	c := s.signedIn("http-buyer@example.com")
	o := s.inStockOffers(1, 2)[0]

	if r := checkout(s, s.client(), "attempt-0001", o.id, o.price); r.status != 401 {
		t.Fatalf("signed-out checkout: %d", r.status)
	}
	if r := s.do(c, "POST", "/api/orders", map[string]any{"items": []any{}, "expectedTotalCents": 1}, "Idempotency-Key", "attempt-0000"); r.status != 422 || errCode(r) != "empty_cart" {
		t.Fatalf("empty cart: %d %v", r.status, r.body)
	}
	if r := checkout(s, c, "", o.id, o.price); r.status != 400 {
		t.Fatalf("missing Idempotency-Key: %d", r.status)
	}

	created := checkout(s, c, "attempt-0001", o.id, o.price)
	if created.status != 201 || created.body["status"] != "pending_payment" {
		t.Fatalf("create: %d %v", created.status, created.body)
	}
	id := created.body["id"].(string)
	if retry := checkout(s, c, "attempt-0001", o.id, o.price); retry.status != 200 || retry.body["id"] != id {
		t.Fatalf("retried create should return the same order with 200: %d %v", retry.status, retry.body)
	}

	pay := func(key, outcome string) resp {
		return s.do(c, "POST", "/api/orders/"+id+"/payments", map[string]string{"outcome": outcome}, "Idempotency-Key", key)
	}
	if r := pay("pay-attempt-1", "decline"); r.status != 402 || errCode(r) != "payment_declined" {
		t.Fatalf("declined payment: %d %v", r.status, r.body)
	}
	if r := pay("pay-attempt-2", "bogus"); r.status != 422 {
		t.Fatalf("invalid outcome: %d", r.status)
	}

	// Before payment: no keys anywhere.
	res, _ := c.Get(s.srv.URL + "/api/orders/" + id)
	raw, _ := io.ReadAll(res.Body)
	res.Body.Close()
	if strings.Contains(string(raw), "DEMO-") {
		t.Fatal("unpaid order exposed a key")
	}

	paid := pay("pay-attempt-3", "success")
	if paid.status != 200 || paid.body["status"] != "paid" {
		t.Fatalf("pay: %d %v", paid.status, paid.body)
	}
	item := paid.body["items"].([]any)[0].(map[string]any)
	keys, _ := item["keys"].([]any)
	if len(keys) != 1 || !strings.HasPrefix(keys[0].(string), "DEMO-") {
		t.Fatalf("paid order should deliver the key: %v", item)
	}

	// Order history lists it (without keys); detail shows the same key again.
	list := s.do(c, "GET", "/api/orders", nil)
	orders := list.body["orders"].([]any)
	if len(orders) != 1 || orders[0].(map[string]any)["id"] != id {
		t.Fatalf("history: %v", list.body)
	}
	if strings.Contains(fmt.Sprint(list.body), "DEMO-") {
		t.Fatal("order list must not include keys")
	}
	detail := s.do(c, "GET", "/api/orders/"+id, nil)
	if fmt.Sprint(detail.body["items"]) != fmt.Sprint(paid.body["items"]) {
		t.Fatal("order detail should show the same delivered key")
	}

	// Another account sees nothing: 404 for detail, pay and cancel; empty history.
	other := s.signedIn("someone-else@example.com")
	for _, r := range []resp{
		s.do(other, "GET", "/api/orders/"+id, nil),
		s.do(other, "POST", "/api/orders/"+id+"/payments", map[string]string{"outcome": "success"}, "Idempotency-Key", "x-attempt-1"),
		s.do(other, "POST", "/api/orders/"+id+"/cancel", nil),
	} {
		if r.status != 404 {
			t.Fatalf("other user access: %d %v", r.status, r.body)
		}
	}
	if r := s.do(other, "GET", "/api/orders", nil); len(r.body["orders"].([]any)) != 0 {
		t.Fatal("other user's history must be empty")
	}
	if r := s.do(c, "POST", "/api/orders/"+id+"/cancel", nil); r.status != 409 {
		t.Fatalf("cancel paid order: %d", r.status)
	}
}

func TestOrderEndpointsRejectCrossSite(t *testing.T) {
	s := newStack(t, "dev")
	c := s.signedIn("csrf-target@example.com")
	o := s.inStockOffers(1, 1)[0]
	r := s.do(c, "POST", "/api/orders", map[string]any{
		"items": []map[string]int64{{"offerId": o.id, "quantity": 1}}, "expectedTotalCents": o.price,
	}, "Idempotency-Key", "csrf-attempt", "Origin", "https://evil.example", "Sec-Fetch-Site", "cross-site")
	if r.status != 403 {
		t.Fatalf("cross-site order creation: %d", r.status)
	}
}
