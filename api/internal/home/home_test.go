package home_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/Zenkiux/eneba-marketplace/api/internal/catalog"
	"github.com/Zenkiux/eneba-marketplace/api/internal/home"
	"github.com/Zenkiux/eneba-marketplace/api/internal/testdb"
)

type layout struct {
	Sections []home.Section `json:"sections"`
}

type section[T any] struct {
	Key     string `json:"key"`
	Type    string `json:"type"`
	Title   string `json:"title"`
	More    string `json:"more"`
	Content T      `json:"content"`
}

type products struct {
	Products []catalog.Card `json:"products"`
}

type bannerList struct {
	Banners []home.Banner `json:"banners"`
}

func setup(t *testing.T) (*pgxpool.Pool, func(string, any) int) {
	pool := testdb.New(t)
	mux := http.NewServeMux()
	home.NewHandler(pool).Register(mux)
	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)
	get := func(path string, out any) int {
		res, err := http.Get(srv.URL + path)
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		if out != nil && res.StatusCode == 200 {
			if err := json.NewDecoder(res.Body).Decode(out); err != nil {
				t.Fatal(err)
			}
		}
		return res.StatusCode
	}
	return pool, get
}

func exec(t *testing.T, pool *pgxpool.Pool, sql string, args ...any) {
	t.Helper()
	if _, err := pool.Exec(context.Background(), sql, args...); err != nil {
		t.Fatal(err)
	}
}

func keys(l layout) []string {
	var out []string
	for _, s := range l.Sections {
		out = append(out, s.Key)
	}
	return out
}

// The layout comes from the database: renaming, reordering and disabling rows changes the API
// output with no code change.
func TestLayoutIsDatabaseDriven(t *testing.T) {
	pool, get := setup(t)
	var l layout
	get("/api/home", &l)
	if len(l.Sections) != 10 || l.Sections[0].Type != "banner" {
		t.Fatalf("unexpected seeded layout: %v", keys(l))
	}

	exec(t, pool, `UPDATE home_sections SET title = 'Hot this week', position = 1 WHERE key = 'deals'`)
	exec(t, pool, `UPDATE home_sections SET enabled = false WHERE key = 'upcoming'`)
	get("/api/home", &l)
	if l.Sections[0].Key != "deals" || l.Sections[0].Title != "Hot this week" {
		t.Fatalf("reorder/rename not reflected: %+v", l.Sections[0])
	}
	for _, s := range l.Sections {
		if s.Key == "upcoming" {
			t.Fatal("disabled section still listed")
		}
	}
	if code := get("/api/home/sections/upcoming", nil); code != 404 {
		t.Fatalf("disabled section content: status %d, want 404", code)
	}

	// A brand-new section of an existing type appears without frontend or backend changes.
	exec(t, pool, `INSERT INTO home_sections (key, type, title, position, config) VALUES ('dlc-deals', 'deals', 'DLC deals', 5, '{"type":"dlc","limit":3}')`)
	var s section[products]
	if code := get("/api/home/sections/dlc-deals", &s); code != 200 {
		t.Fatalf("new section status %d", code)
	}
	if s.Title != "DLC deals" || len(s.Content.Products) == 0 || len(s.Content.Products) > 3 {
		t.Fatalf("new section content: %+v", s)
	}
	for _, p := range s.Content.Products {
		if p.Type.Slug != "dlc" {
			t.Fatalf("type filter ignored: %s", p.Slug)
		}
	}
}

func TestBannersComeFromBannerTable(t *testing.T) {
	pool, get := setup(t)
	var s section[bannerList]
	get("/api/home/sections/hero", &s)
	if len(s.Content.Banners) != 5 {
		t.Fatalf("want 5 seeded banners, got %d", len(s.Content.Banners))
	}
	exec(t, pool, `UPDATE banners SET title = 'Spring Sale' WHERE position = 0`)
	exec(t, pool, `UPDATE banners SET ends_at = now() - interval '1 day' WHERE position = 1`)
	get("/api/home/sections/hero", &s)
	if s.Content.Banners[0].Title != "Spring Sale" || len(s.Content.Banners) != 4 {
		t.Fatalf("banner edits not reflected: %+v", s.Content.Banners)
	}
}

func TestBestsellersFollowPaidOrders(t *testing.T) {
	pool, get := setup(t)
	var before section[products]
	get("/api/home/sections/top-games", &before)
	if len(before.Content.Products) == 0 {
		t.Fatal("no best sellers")
	}
	// Pick an unpopular in-stock game and record paid sales for it.
	var productID, offerID, sellerID int64
	if err := pool.QueryRow(context.Background(), `SELECT p.id, o.id, o.seller_id FROM products p
		JOIN product_types t ON t.id = p.type_id JOIN offers o ON o.product_id = p.id
		WHERE t.slug = 'game' AND p.release_date <= current_date
		  AND EXISTS (SELECT 1 FROM offer_keys k WHERE k.offer_id = o.id AND k.status = 'available')
		ORDER BY p.popularity ASC LIMIT 1`).Scan(&productID, &offerID, &sellerID); err != nil {
		t.Fatal(err)
	}
	for _, c := range before.Content.Products {
		if c.ID == productID {
			t.Fatal("chosen product already a best seller; test would prove nothing")
		}
	}
	exec(t, pool, `WITH u AS (SELECT id FROM users LIMIT 1),
		o AS (INSERT INTO orders (user_id, status, total_cents, idempotency_key, request_hash, expires_at, paid_at)
		      SELECT id, 'paid', 1000, 'test', '\x00', now(), now() FROM u RETURNING id)
		INSERT INTO order_items (order_id, offer_id, product_id, seller_id, unit_price_cents, quantity, title_snapshot, seller_snapshot)
		SELECT id, $1, $2, $3, 1000, 10, 't', 's' FROM o`, offerID, productID, sellerID)
	var after section[products]
	get("/api/home/sections/top-games", &after)
	if after.Content.Products[0].ID != productID {
		t.Fatalf("product with 10 paid sales should lead best sellers, got %s", after.Content.Products[0].Slug)
	}
}

func TestDealsFollowPrices(t *testing.T) {
	pool, get := setup(t)
	// Make one product's cheapest in-stock offer almost free: it must become the top deal.
	var slug string
	if err := pool.QueryRow(context.Background(), `UPDATE offers SET price_cents = 9 WHERE id = (
		SELECT o.id FROM offers o JOIN products p ON p.id = o.product_id
		WHERE p.slug = 'pixel-pioneers-steam-global'
		  AND EXISTS (SELECT 1 FROM offer_keys k WHERE k.offer_id = o.id AND k.status = 'available') LIMIT 1)
		RETURNING (SELECT slug FROM products WHERE id = offers.product_id)`).Scan(&slug); err != nil {
		t.Fatal(err)
	}
	var s section[products]
	get("/api/home/sections/deals", &s)
	if s.Content.Products[0].Slug != slug || s.Content.Products[0].DiscountPercent < 99 {
		t.Fatalf("top deal %s (%d%%), want %s", s.Content.Products[0].Slug, s.Content.Products[0].DiscountPercent, slug)
	}
}

func TestUpcomingAndNewReleasesSplitByDate(t *testing.T) {
	_, get := setup(t)
	var up, nr section[products]
	get("/api/home/sections/upcoming", &up)
	get("/api/home/sections/new-releases", &nr)
	if len(up.Content.Products) == 0 || len(nr.Content.Products) == 0 {
		t.Fatal("both rows should have products")
	}
	upSet := map[int64]bool{}
	for _, p := range up.Content.Products {
		upSet[p.ID] = true
	}
	for _, p := range nr.Content.Products {
		if upSet[p.ID] {
			t.Fatalf("%s is both upcoming and released", p.Slug)
		}
	}
}

func TestCategoriesAndUnknownSection(t *testing.T) {
	_, get := setup(t)
	var s section[struct {
		Categories []home.Category `json:"categories"`
	}]
	get("/api/home/sections/categories", &s)
	if len(s.Content.Categories) < 5 {
		t.Fatalf("categories: %+v", s.Content.Categories)
	}
	if code := get("/api/home/sections/nope", nil); code != 404 {
		t.Fatalf("unknown section: %d", code)
	}
}

func TestSectionTitlesFollowLanguage(t *testing.T) {
	pool := testdb.New(t)
	mux := http.NewServeMux()
	home.NewHandler(pool).Register(mux)
	srv := httptest.NewServer(mux)
	defer srv.Close()
	get := func(lang string) layout {
		req, _ := http.NewRequest("GET", srv.URL+"/api/home", nil)
		req.Header.Set("Accept-Language", lang)
		res, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		var l layout
		json.NewDecoder(res.Body).Decode(&l)
		return l
	}
	titles := func(l layout) map[string]string {
		m := map[string]string{}
		for _, s := range l.Sections {
			m[s.Key] = s.Title
		}
		return m
	}
	if got := titles(get("lt-LT,lt;q=0.9"))["top-games"]; got != "Populiariausi žaidimai" {
		t.Fatalf("Lithuanian title: %q", got)
	}
	if got := titles(get("fr-FR"))["top-games"]; got != "Top games" {
		t.Fatalf("unsupported language should fall back to English: %q", got)
	}
}

type genreList struct {
	Genres []home.Genre `json:"genres"`
}

func TestRecentlyViewedRecommendedAndGenres(t *testing.T) {
	_, get := setup(t)
	var empty section[products]
	get("/api/home/sections/recently-viewed", &empty)
	if len(empty.Content.Products) != 0 {
		t.Fatal("no history → no recently viewed products")
	}
	viewed := "starfall-odyssey-steam-global,hollow-crown-steam-global"
	var rv section[products]
	get("/api/home/sections/recently-viewed?viewed="+viewed+",not-a-product,BAD%20SLUG", &rv)
	if len(rv.Content.Products) != 2 || rv.Content.Products[0].Slug != "starfall-odyssey-steam-global" {
		t.Fatalf("recently viewed must keep the browser's order and ignore unknown slugs: %+v", rv.Content.Products)
	}
	var rec section[products]
	get("/api/home/sections/recommended?viewed="+viewed, &rec)
	if len(rec.Content.Products) == 0 || rec.More == "" {
		t.Fatalf("recommended: %+v", rec)
	}
	for _, p := range rec.Content.Products {
		if p.Slug == "starfall-odyssey-steam-global" {
			t.Fatal("recommended must not repeat what was viewed")
		}
	}
	var g section[genreList]
	get("/api/home/sections/genres", &g)
	if len(g.Content.Genres) < 3 || g.Content.Genres[0].Count < g.Content.Genres[len(g.Content.Genres)-1].Count {
		t.Fatalf("genres should be sorted by count: %+v", g.Content.Genres)
	}
}
