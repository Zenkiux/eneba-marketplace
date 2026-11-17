package app_test

import (
	"context"
	"testing"
)

// The optional Eneba catalog and the demo catalog never mix: the X-Catalog header selects one,
// and anything else falls back to the demo catalog.
func TestCatalogSwitchIsolatesProducts(t *testing.T) {
	s := newStack(t, "dev")
	ctx := context.Background()
	if _, err := s.pool.Exec(ctx, `INSERT INTO products (slug, title, cover_url, platform_id, region_id, type_id, list_price_cents, catalog)
		SELECT 'eneba-test-game', 'Snapshot Test Game', 'https://imgproxy.eneba.games/x', platform_id, region_id, type_id, 1999, 'eneba'
		FROM products LIMIT 1`); err != nil {
		t.Fatal(err)
	}
	c := s.client()
	demo := s.do(c, "GET", "/api/products?page_size=60", nil)
	eneba := s.do(c, "GET", "/api/products?page_size=60", nil, "X-Catalog", "eneba")
	junk := s.do(c, "GET", "/api/products?page_size=60", nil, "X-Catalog", "'; drop table products --")

	var demoCount int
	s.pool.QueryRow(ctx, `SELECT count(*) FROM products WHERE catalog = 'demo'`).Scan(&demoCount)
	if int(demo.body["total"].(float64)) != demoCount || int(junk.body["total"].(float64)) != demoCount {
		t.Fatalf("default/unknown header should show the demo catalog only: %v / %v", demo.body["total"], junk.body["total"])
	}
	items := eneba.body["items"].([]any)
	if len(items) != 1 || items[0].(map[string]any)["title"] != "Snapshot Test Game" {
		t.Fatalf("eneba catalog should contain only snapshot products: %v", eneba.body["total"])
	}
	if r := s.do(c, "GET", "/api/search/suggest?q=snapshot", nil); len(r.body["items"].([]any)) != 0 {
		t.Fatal("demo search must not find snapshot products")
	}
	cats := s.do(c, "GET", "/api/catalogs", nil)
	if len(cats.body["catalogs"].([]any)) != 2 {
		t.Fatalf("catalogs: %v", cats.body)
	}
	if r := s.do(c, "GET", "/api/products", nil); r.header.Get("Vary") != "X-Catalog" {
		t.Fatal("responses must vary by X-Catalog so caches keep catalogs apart")
	}
}
