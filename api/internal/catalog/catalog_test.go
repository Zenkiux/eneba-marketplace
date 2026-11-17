package catalog_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/Zenkiux/eneba-marketplace/api/internal/catalog"
	"github.com/Zenkiux/eneba-marketplace/api/internal/testdb"
)

type env struct {
	t    *testing.T
	pool *pgxpool.Pool
	srv  *httptest.Server
}

func setup(t *testing.T) *env {
	t.Helper()
	pool := testdb.New(t)
	mux := http.NewServeMux()
	catalog.NewHandler(catalog.NewStore(pool)).Register(mux)
	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)
	return &env{t: t, pool: pool, srv: srv}
}

func (e *env) get(path string, out any) int {
	e.t.Helper()
	res, err := http.Get(e.srv.URL + path)
	if err != nil {
		e.t.Fatal(err)
	}
	defer res.Body.Close()
	if out != nil {
		if err := json.NewDecoder(res.Body).Decode(out); err != nil {
			e.t.Fatalf("decode %s: %v", path, err)
		}
	}
	return res.StatusCode
}

func (e *env) count(sql string, args ...any) int {
	e.t.Helper()
	var n int
	if err := e.pool.QueryRow(context.Background(), sql, args...).Scan(&n); err != nil {
		e.t.Fatal(err)
	}
	return n
}

// Products whose cheapest in-stock offer is within [min,max] — written independently of the
// store's query so the test checks the result rather than repeating the implementation.
const minPriceSQL = `(SELECT min(o.price_cents) FROM offers o WHERE o.product_id = p.id AND o.active
	AND EXISTS (SELECT 1 FROM offer_keys k WHERE k.offer_id = o.id AND k.status = 'available'))`

func TestListTotalsMatchDatabase(t *testing.T) {
	e := setup(t)
	cases := []struct {
		query string
		sql   string
		args  []any
	}{
		{"", `SELECT count(*) FROM products p`, nil},
		{"platform=steam", `SELECT count(*) FROM products p JOIN platforms x ON x.id = p.platform_id WHERE x.slug = 'steam'`, nil},
		{"platform=steam,gog", `SELECT count(*) FROM products p JOIN platforms x ON x.id = p.platform_id WHERE x.slug IN ('steam','gog')`, nil},
		{"region=europe", `SELECT count(*) FROM products p JOIN regions x ON x.id = p.region_id WHERE x.slug = 'europe'`, nil},
		{"type=dlc", `SELECT count(*) FROM products p JOIN product_types x ON x.id = p.type_id WHERE x.slug = 'dlc'`, nil},
		{"platform=psn&region=europe", `SELECT count(*) FROM products p JOIN platforms a ON a.id = p.platform_id JOIN regions b ON b.id = p.region_id WHERE a.slug = 'psn' AND b.slug = 'europe'`, nil},
		{"min_price=2000&max_price=4000", `SELECT count(*) FROM products p WHERE ` + minPriceSQL + ` BETWEEN 2000 AND 4000`, nil},
		{"max_price=1500&platform=steam", `SELECT count(*) FROM products p JOIN platforms x ON x.id = p.platform_id WHERE x.slug = 'steam' AND ` + minPriceSQL + ` <= 1500`, nil},
		{"platform=does-not-exist", `SELECT 0`, nil},
	}
	for _, c := range cases {
		var page catalog.Page
		if code := e.get("/api/products?page_size=60&"+c.query, &page); code != 200 {
			t.Fatalf("%s: status %d", c.query, code)
		}
		want := e.count(c.sql, c.args...)
		if page.Total != want {
			t.Errorf("%q: total %d, database says %d", c.query, page.Total, want)
		}
		if want <= 60 && len(page.Items) != want {
			t.Errorf("%q: %d items on page, want %d", c.query, len(page.Items), want)
		}
		if c.query == "" && want < 50 {
			t.Errorf("expected the full seeded catalog, got %d", want)
		}
	}
}

func TestEveryProductReachableThroughPagination(t *testing.T) {
	e := setup(t)
	for _, s := range []string{"popular", "price_asc", "price_desc", "newest", "oldest", "alpha_asc", "alpha_desc", "discount"} {
		seen := map[string]bool{}
		var total int
		for page := 1; ; page++ {
			var p catalog.Page
			e.get("/api/products?page_size=7&sort="+s+"&page="+strconv.Itoa(page), &p)
			total = p.Total
			for _, it := range p.Items {
				if seen[it.Slug] {
					t.Fatalf("sort %s: %s appears on two pages", s, it.Slug)
				}
				seen[it.Slug] = true
			}
			if len(p.Items) < 7 {
				break
			}
		}
		if len(seen) != total || total != e.count(`SELECT count(*) FROM products`) {
			t.Fatalf("sort %s: saw %d of %d products", s, len(seen), total)
		}
	}
}

func TestSortOrders(t *testing.T) {
	e := setup(t)
	var p catalog.Page
	e.get("/api/products?page_size=60&sort=price_asc", &p)
	var prices []int64
	soldOutSeen := false
	for _, it := range p.Items {
		if it.MinPriceCents == nil {
			soldOutSeen = true
			continue
		}
		if soldOutSeen {
			t.Fatal("sold-out products must come after priced ones")
		}
		prices = append(prices, *it.MinPriceCents)
	}
	if !sort.SliceIsSorted(prices, func(i, j int) bool { return prices[i] < prices[j] }) {
		t.Fatalf("price_asc not ascending: %v", prices)
	}
	e.get("/api/products?page_size=60&sort=alpha_desc", &p)
	for i := 1; i < len(p.Items); i++ {
		if strings.ToLower(p.Items[i-1].Title) < strings.ToLower(p.Items[i].Title) {
			t.Fatalf("alpha_desc out of order at %d", i)
		}
	}
	e.get("/api/products?page_size=60&sort=newest", &p)
	for i := 1; i < len(p.Items); i++ {
		a, b := p.Items[i-1].ReleaseDate, p.Items[i].ReleaseDate
		if a != nil && b != nil && *a < *b {
			t.Fatalf("newest out of order: %s before %s", *a, *b)
		}
	}
}

func TestFacetCounts(t *testing.T) {
	e := setup(t)
	var p catalog.Page
	e.get("/api/products?region=europe", &p)
	// Platform facet counts respect the region filter but not the platform filter itself.
	sum := 0
	for _, f := range p.Facets.Platforms {
		sum += f.Count
	}
	if sum != p.Total {
		t.Fatalf("platform facet counts sum to %d, total is %d", sum, p.Total)
	}
	// Region facet ignores the region filter, so it reports all regions' counts.
	all := 0
	for _, f := range p.Facets.Regions {
		all += f.Count
	}
	if all != e.count(`SELECT count(*) FROM products`) {
		t.Fatalf("region facet should count all products, got %d", all)
	}
}

func TestSearch(t *testing.T) {
	e := setup(t)
	cases := []struct {
		q, wantFirst string // wantFirst: slug prefix expected as the top result ("" = expect no results)
	}{
		{"Starfall Odyssey (PC) Steam Key GLOBAL", "starfall-odyssey-steam-global"}, // exact title
		{"starfall", "starfall-odyssey"},                                            // prefix
		{"odyssey", "starfall-odyssey"},                                             // substring
		{"STARFALL ODYSSEY", "starfall-odyssey"},                                    // case
		{"starfal odysey", "starfall-odyssey"},                                      // two typos
		{"kingdm forge", "kingdom-forge-2"},                                         // missing letter
		{"neon drfit", "neon-drift-racing"},                                         // swapped letters
		{"shadow protokol", "shadow-protocol"},                                      // wrong letter
		{"hollow", "hollow-crown"},                                                  // partial word
		{"kingdom forge ii", "kingdom-forge-2"},                                     // Roman numeral for a digit
		{"tfv", "tiny-farm-valley"},                                                 // acronym
		{"pokémon", ""},                                                             // accents normalised, no such game
		{"xyzzy", ""},                                                               // nonsense
		{"%", ""},                                                                   // LIKE wildcard is literal (would match everything if unescaped)
		{"_", ""},                                                                   // LIKE wildcard is literal
		{`\`, ""},                                                                   // escape char is literal
		{"'; DROP TABLE products; --", ""},                                          // just text
	}
	for _, c := range cases {
		var p catalog.Page
		if code := e.get("/api/products?q="+url.QueryEscape(c.q), &p); code != 200 {
			t.Fatalf("%q: status %d", c.q, code)
		}
		if c.wantFirst == "" {
			if p.Total != 0 {
				t.Errorf("%q: expected no results, got %d (first %s)", c.q, p.Total, p.Items[0].Slug)
			}
			continue
		}
		if len(p.Items) == 0 || !strings.HasPrefix(p.Items[0].Slug, c.wantFirst) {
			got := "none"
			if len(p.Items) > 0 {
				got = p.Items[0].Slug
			}
			t.Errorf("%q: top result %s, want %s…", c.q, got, c.wantFirst)
		}
	}
	if n := e.count(`SELECT count(*) FROM products`); n == 0 {
		t.Fatal("products table damaged")
	}
	// Empty query = whole catalog; overlong query rejected.
	var p catalog.Page
	e.get("/api/products?q=", &p)
	if p.Total != e.count(`SELECT count(*) FROM products`) {
		t.Fatal("empty query should return the catalog")
	}
	if code := e.get("/api/products?q="+strings.Repeat("a", 101), nil); code != 400 {
		t.Fatalf("overlong query: status %d, want 400", code)
	}
}

func TestSuggest(t *testing.T) {
	e := setup(t)
	var out struct{ Items []catalog.Card }
	e.get("/api/search/suggest?q=frostbnd", &out)
	if len(out.Items) == 0 || len(out.Items) > 6 || !strings.HasPrefix(out.Items[0].Slug, "frostbound") {
		t.Fatalf("suggest frostbnd: %+v", out.Items)
	}
	e.get("/api/search/suggest?q=", &out)
	if len(out.Items) != 0 {
		t.Fatal("empty suggest should return nothing")
	}
}

func TestBadParameters(t *testing.T) {
	e := setup(t)
	for _, q := range []string{"sort=random", "page=0", "page=abc", "page_size=500", "min_price=-1", "min_price=10.5", "min_price=5000&max_price=100", "sort=relevance"} {
		if code := e.get("/api/products?"+q, nil); code != 400 {
			t.Errorf("%s: status %d, want 400", q, code)
		}
	}
}

func TestProductPageOffersAndNoKeyLeak(t *testing.T) {
	e := setup(t)
	res, err := http.Get(e.srv.URL + "/api/products/starfall-odyssey-steam-global")
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	var raw json.RawMessage
	json.NewDecoder(res.Body).Decode(&raw)
	body := string(raw)
	if strings.Contains(body, "DEMO-") || strings.Contains(strings.ToLower(body), "cipher") || strings.Contains(strings.ToLower(body), "fingerprint") {
		t.Fatal("product response must not contain key material")
	}
	var p catalog.Product
	json.Unmarshal(raw, &p)
	if len(p.Offers) < 2 {
		t.Fatalf("expected several offers, got %d", len(p.Offers))
	}
	want := e.count(`SELECT count(*) FROM offers o JOIN products p ON p.id = o.product_id WHERE p.slug = 'starfall-odyssey-steam-global' AND o.active`)
	if len(p.Offers) != want {
		t.Fatalf("offers %d, want %d", len(p.Offers), want)
	}
	for i, o := range p.Offers {
		stock := e.count(`SELECT count(*) FROM offer_keys WHERE offer_id = $1 AND status = 'available'`, o.ID)
		if o.Stock != stock {
			t.Fatalf("offer %d stock %d, want %d", o.ID, o.Stock, stock)
		}
		if i > 0 && o.Stock > 0 && p.Offers[i-1].Stock > 0 && o.PriceCents < p.Offers[i-1].PriceCents {
			t.Fatal("in-stock offers must be ordered by price")
		}
	}
	if code := e.get("/api/products/no-such-product", nil); code != 404 {
		t.Fatalf("unknown product: %d", code)
	}
}

func TestSoldOutOfferDoesNotSetPrice(t *testing.T) {
	e := setup(t)
	ctx := context.Background()
	// Make the cheapest offer of a product sell out; the card price must move to the next one.
	var offerID, price int64
	if err := e.pool.QueryRow(ctx, `SELECT o.id, o.price_cents FROM offers o JOIN products p ON p.id = o.product_id
		WHERE p.slug = 'hollow-crown-steam-global'
		  AND EXISTS (SELECT 1 FROM offer_keys k WHERE k.offer_id = o.id AND k.status = 'available')
		ORDER BY o.price_cents LIMIT 1`).Scan(&offerID, &price); err != nil {
		t.Fatal(err)
	}
	if _, err := e.pool.Exec(ctx, `DELETE FROM offer_keys WHERE offer_id = $1`, offerID); err != nil {
		t.Fatal(err)
	}
	var p catalog.Product
	e.get("/api/products/hollow-crown-steam-global", &p)
	if p.MinPriceCents != nil && *p.MinPriceCents <= price {
		t.Fatalf("min price %d should be above sold-out offer price %d", *p.MinPriceCents, price)
	}
	last := p.Offers[len(p.Offers)-1]
	if last.ID != offerID || last.Stock != 0 {
		t.Fatal("sold-out offer should be listed last with stock 0")
	}
}

func TestWorksForMeFilter(t *testing.T) {
	e := setup(t)
	total := func(q string) int {
		var p catalog.Page
		if code := e.get("/api/products?works=1&page_size=60&"+q, &p); code != 200 {
			t.Fatalf("%s: status %d", q, code)
		}
		return p.Total
	}
	strong := total("country=LT&os=windows&gpu=20000&cpu=1500&ram=32")
	weak := total("country=LT&os=windows&gpu=1300&cpu=750&ram=8") // budget PC: indie games only
	if !(strong > weak && weak > 0) {
		t.Fatalf("a strong PC should get more games than a weak one (strong %d, weak %d)", strong, weak)
	}
	// A Mac can't run the (Windows-only) demo games; only platform-free items remain.
	mac := total("country=LT&os=mac&gpu=20000&cpu=1500&ram=32")
	if mac >= weak {
		t.Fatalf("mac %d should be below weak windows %d", mac, weak)
	}
	// Owning a PlayStation adds PSN keys.
	withPS := total("country=LT&os=mac&consoles=psn")
	if withPS <= mac {
		t.Fatalf("owning a PlayStation should add products (%d vs %d)", withPS, mac)
	}
	// Region: a buyer in the US must not get Europe-only keys.
	var us catalog.Page
	e.get("/api/products?works=1&page_size=60&country=US&os=windows&gpu=20000&cpu=1500&ram=32&consoles=psn,xbox,nintendo", &us)
	for _, it := range us.Items {
		if it.Region.Slug == "europe" || it.Region.Slug == "united-kingdom" {
			t.Fatalf("US buyer got a %s key: %s", it.Region.Slug, it.Slug)
		}
	}
	for _, bad := range []string{"os=amiga", "gpu=-1", "consoles=sega", "country=lithuania"} {
		if code := e.get("/api/products?works=1&"+bad, nil); code != 400 {
			t.Errorf("%s: want 400, got %d", bad, code)
		}
	}
}

func TestProductRequirementsExposed(t *testing.T) {
	e := setup(t)
	var p catalog.Product
	e.get("/api/products/starfall-odyssey-steam-global", &p)
	if p.Requirements == nil || p.Requirements.Minimum == nil || p.Requirements.Minimum.GPUScore == 0 || p.ReqMin == nil {
		t.Fatalf("PC game should expose parsed requirements: %+v", p.Requirements)
	}
	e.get("/api/products/starfall-odyssey-psn-europe", &p)
	if p.Requirements != nil {
		t.Fatal("console keys have no PC requirements")
	}
}
