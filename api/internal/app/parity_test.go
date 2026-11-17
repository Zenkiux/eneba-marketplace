package app_test

import (
	"context"
	"net/url"
	"testing"
)

// Store filters Eneba has (genre, operating system, country) and their facet counts.
func TestGenreOSAndCountryFilters(t *testing.T) {
	s := newStack(t, "dev")
	c := s.client()
	all := s.do(c, "GET", "/api/products?page_size=60", nil)
	facets := all.body["facets"].(map[string]any)
	genres := facets["genres"].([]any)
	if len(genres) == 0 || len(facets["os"].([]any)) == 0 {
		t.Fatalf("genre and OS facets expected: %v", facets)
	}
	g := genres[0].(map[string]any)
	byGenre := s.do(c, "GET", "/api/products?page_size=60&genre="+url.QueryEscape(g["slug"].(string)), nil)
	if int(byGenre.body["total"].(float64)) != int(g["count"].(float64)) {
		t.Fatalf("genre facet count %v != filtered total %v", g["count"], byGenre.body["total"])
	}
	mac := s.do(c, "GET", "/api/products?os_filter=mac", nil)
	win := s.do(c, "GET", "/api/products?os_filter=windows", nil)
	if mac.body["total"].(float64) >= win.body["total"].(float64) {
		t.Fatal("fewer products should work on Mac than on Windows")
	}
	us := s.do(c, "GET", "/api/products?page_size=60&country=US", nil)
	for _, it := range us.body["items"].([]any) {
		if r := it.(map[string]any)["region"].(map[string]any)["slug"]; r == "europe" || r == "united-kingdom" {
			t.Fatalf("country=US returned a %v key", r)
		}
	}
	for _, bad := range []string{"os_filter=amiga", "country=usa"} {
		if r := s.do(c, "GET", "/api/products?"+bad, nil); r.status != 400 {
			t.Errorf("%s: %d", bad, r.status)
		}
	}
}

func TestReviewsOnlyFromBuyers(t *testing.T) {
	s := newStack(t, "dev")
	buyer, other := s.signedIn("rev-buyer@example.test"), s.signedIn("rev-other@example.test")
	offers := s.inStockOffers(1, 2)
	var slug string
	if err := s.pool.QueryRow(context.Background(), `SELECT p.slug FROM offers o JOIN products p ON p.id = o.product_id WHERE o.id = $1`, offers[0].id).Scan(&slug); err != nil {
		t.Fatal(err)
	}
	path := "/api/products/" + slug + "/reviews"
	review := map[string]any{"rating": 5, "body": "Activated instantly, works great."}
	if r := s.do(buyer, "PUT", path+"/mine", review); r.status != 403 {
		t.Fatalf("review before buying: %d", r.status)
	}
	o := checkout(s, buyer, "review-order-0001", offers[0].id, offers[0].price)
	s.do(buyer, "POST", "/api/orders/"+o.body["id"].(string)+"/payments", map[string]string{"outcome": "success"}, "Idempotency-Key", "review-pay-0001")
	if r := s.do(buyer, "PUT", path+"/mine", map[string]any{"rating": 6, "body": "Activated instantly."}); r.status != 422 {
		t.Fatalf("rating 6: %d", r.status)
	}
	if r := s.do(buyer, "PUT", path+"/mine", review); r.status != 200 || r.body["total"].(float64) != 1 {
		t.Fatalf("buyer review: %d %v", r.status, r.body)
	}
	review["rating"] = 4
	if r := s.do(buyer, "PUT", path+"/mine", review); r.body["total"].(float64) != 1 {
		t.Fatal("a second review must update the first")
	}
	r := s.do(other, "GET", path, nil)
	if r.body["canReview"] != false || r.body["reviews"].([]any)[0].(map[string]any)["mine"] != false {
		t.Fatalf("other user view: %v", r.body)
	}
	p := s.do(other, "GET", "/api/products/"+slug, nil)
	if rating := p.body["rating"].(map[string]any); rating["count"].(float64) < 1 {
		t.Fatalf("product rating should include the review: %v", rating)
	}
	if r := s.do(buyer, "DELETE", path+"/mine", nil); r.body["total"].(float64) != 0 {
		t.Fatal("delete own review")
	}
}

func TestNewsletterAndTrending(t *testing.T) {
	s := newStack(t, "dev")
	c := s.client()
	if r := s.do(c, "POST", "/api/newsletter", map[string]string{"email": "not-an-email"}); r.status != 422 {
		t.Fatalf("invalid e-mail: %d", r.status)
	}
	for i := 0; i < 2; i++ {
		if r := s.do(c, "POST", "/api/newsletter", map[string]string{"email": "Fan@Example.test"}); r.status != 204 {
			t.Fatalf("subscribe: %d", r.status)
		}
	}
	for i := 0; i < 3; i++ {
		s.do(c, "GET", "/api/products?q=starfall&log=1", nil)
	}
	tr := s.do(c, "GET", "/api/search/trending", nil)
	if items := tr.body["items"].([]any); len(items) == 0 || items[0] != "starfall" {
		t.Fatalf("logged search should trend first: %v", items)
	}
	sg := s.do(c, "GET", "/api/search/suggest?q=starf", nil)
	if sg.body["total"].(float64) < 1 || len(sg.body["phrases"].([]any)) == 0 {
		t.Fatalf("suggest should return a total and phrases: %v", sg.body)
	}
}

func TestSellerPage(t *testing.T) {
	s := newStack(t, "dev")
	c := s.client()
	r := s.do(c, "GET", "/api/sellers/pixelvault", nil)
	if r.status != 200 || r.body["name"] != "PixelVault" || len(r.body["products"].([]any)) == 0 {
		t.Fatalf("seller page: %d %v", r.status, r.body)
	}
	if int(r.body["total"].(float64)) < len(r.body["products"].([]any)) {
		t.Fatal("total must cover the listed products")
	}
	if r := s.do(c, "GET", "/api/sellers/nobody", nil); r.status != 404 {
		t.Fatalf("unknown seller: %d", r.status)
	}
}
