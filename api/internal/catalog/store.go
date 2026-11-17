// Package catalog serves the product listing, filters, facets, search and product pages.
package catalog

import (
	"context"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/Zenkiux/eneba-marketplace/api/internal/compat"
	"github.com/Zenkiux/eneba-marketplace/api/internal/search"
)

// Named is a filter dimension value (platform, region or product type).
type Named struct {
	Slug string `json:"slug"`
	Name string `json:"name"`
}

// Card is the product summary used by the store grid, search and homepage rows.
type Card struct {
	ID              int64   `json:"id"`
	Slug            string  `json:"slug"`
	Title           string  `json:"title"`
	CoverURL        string  `json:"coverUrl"`
	Platform        Named   `json:"platform"`
	Region          Named   `json:"region"`
	Type            Named   `json:"type"`
	ReleaseDate     *string `json:"releaseDate"`
	ListPriceCents  int64   `json:"listPriceCents"`
	MinPriceCents   *int64  `json:"minPriceCents"` // lowest in-stock offer; nil = sold out
	DiscountPercent int     `json:"discountPercent"`
	OfferCount      int     `json:"offerCount"` // offers with stock
	// Minimum requirements (PC games only) so the UI can show "works for me" badges.
	ReqMin *compat.Level `json:"reqMin,omitempty"`
}

// CardSelect is shared by every query that returns cards. The lateral join finds the cheapest
// active offer that still has at least one available key.
const CardSelect = `
SELECT p.id, p.slug, p.title, p.cover_url,
       pl.slug, pl.name, r.slug, r.name, t.slug, t.name,
       to_char(p.release_date, 'YYYY-MM-DD'), p.list_price_cents, s.min_price, s.offer_count,
       p.req_min_os, p.req_min_gpu, p.req_min_cpu, p.req_min_ram::float8` + cardFrom

const cardFrom = `
FROM products p
JOIN platforms pl ON pl.id = p.platform_id
JOIN regions r ON r.id = p.region_id
JOIN product_types t ON t.id = p.type_id
LEFT JOIN LATERAL (
    SELECT min(o.price_cents) AS min_price, count(*)::int AS offer_count
    FROM offers o
    WHERE o.product_id = p.id AND o.active
      AND EXISTS (SELECT 1 FROM offer_keys k WHERE k.offer_id = o.id AND k.status = 'available')
) s ON true`

// ScanCard reads one row produced by CardSelect.
func ScanCard(row pgx.Row) (Card, error) {
	var c Card
	var os *string
	var gpu, cpu *int
	var ram *float64
	err := row.Scan(&c.ID, &c.Slug, &c.Title, &c.CoverURL,
		&c.Platform.Slug, &c.Platform.Name, &c.Region.Slug, &c.Region.Name, &c.Type.Slug, &c.Type.Name,
		&c.ReleaseDate, &c.ListPriceCents, &c.MinPriceCents, &c.OfferCount, &os, &gpu, &cpu, &ram)
	if os != nil || gpu != nil || cpu != nil || ram != nil {
		c.ReqMin = &compat.Level{}
		if os != nil {
			c.ReqMin.OS = *os
		}
		if gpu != nil {
			c.ReqMin.GPUScore = *gpu
		}
		if cpu != nil {
			c.ReqMin.CPUScore = *cpu
		}
		if ram != nil {
			c.ReqMin.RAMGB = *ram
		}
	}
	if c.MinPriceCents != nil && c.ListPriceCents > *c.MinPriceCents {
		c.DiscountPercent = int((c.ListPriceCents - *c.MinPriceCents) * 100 / c.ListPriceCents)
	}
	return c, err
}

// ---------------------------------------------------------------- listing

// Works restricts results to products that work for the visitor: key region activates in their
// country, and either it's for a console they own or their PC meets the minimum requirements.
type Works struct {
	Regions  []string // region slugs that activate in the visitor's country
	Consoles []string // key platforms of owned consoles: psn, xbox, nintendo
	compat.Device
}

type Filter struct {
	Works     *Works
	Source    string // catalog: SourceDemo or SourceEneba
	Query     string
	Platforms []string
	Regions   []string
	Types     []string
	MinPrice  *int64 // cents, inclusive, compared with the lowest in-stock offer
	MaxPrice  *int64
	Sort      string
	Page      int // 1-based
	PageSize  int
}

type Facets struct {
	Platforms []FacetValue `json:"platforms"`
	Regions   []FacetValue `json:"regions"`
	Types     []FacetValue `json:"types"`
}

type FacetValue struct {
	Named
	Count int `json:"count"`
}

type Page struct {
	Items    []Card `json:"items"`
	Total    int    `json:"total"`
	Page     int    `json:"page"`
	PageSize int    `json:"pageSize"`
	Sort     string `json:"sort"`
	Facets   Facets `json:"facets"`
}

// Similarity threshold for typo matching (pg_trgm word_similarity). Chosen from measurements:
// one- or two-letter typos of real titles score 0.6–0.75, unrelated words around 0.2.
const typoThreshold = 0.45

var sorts = map[string]string{
	"popular":    "p.popularity DESC",
	"price_asc":  "s.min_price ASC NULLS LAST",
	"price_desc": "s.min_price DESC NULLS LAST",
	"newest":     "p.release_date DESC NULLS LAST",
	"oldest":     "p.release_date ASC NULLS LAST",
	// COLLATE "C": byte order, identical on every OS. Locale collations differ between macOS
	// and Linux (glibc ignores punctuation), which made A–Z order depend on the server.
	"alpha_asc":  `lower(p.title) COLLATE "C" ASC`,
	"alpha_desc": `lower(p.title) COLLATE "C" DESC`,
	"discount":   "(CASE WHEN s.min_price IS NULL THEN -1 ELSE (p.list_price_cents - s.min_price)::float / p.list_price_cents END) DESC",
	// relevance: exact > prefix > substring > fuzzy, then similarity score.
	"relevance": `(CASE WHEN lower(p.title) = lower(@q) THEN 0
	                    WHEN split_part(p.search_text, ' | ', 2) = @qnorm THEN 0
	                    WHEN split_part(p.search_text, ' | ', 2) LIKE @qnorm || '%' THEN 1
	                    WHEN p.search_text LIKE ANY(@likes) THEN 2 ELSE 3 END) ASC,
	              (SELECT max(word_similarity(v, p.search_text)) FROM unnest(@variants::text[]) v) DESC, p.popularity DESC`,
}

// ValidSort reports whether s is a supported sort key.
func ValidSort(s string) bool { _, ok := sorts[s]; return ok }

type Store struct{ db *pgxpool.Pool }

func NewStore(db *pgxpool.Pool) *Store { return &Store{db: db} }

// where builds the WHERE clause. `skip` leaves one dimension out, which is how facet counts
// are computed: each facet shows how many results you'd get by choosing that value, given the
// other active filters (the same behaviour as Eneba's filter counts).
func (f Filter) where(args pgx.NamedArgs, skip string) string {
	args["catalog"] = f.Source
	conds := []string{"p.catalog = @catalog"}
	if f.Query != "" {
		variants := search.QueryVariants(f.Query)
		likes := make([]string, len(variants))
		for i, v := range variants {
			likes[i] = "%" + escapeLike(v) + "%"
		}
		args["q"] = f.Query
		args["qnorm"] = search.Normalize(f.Query)
		args["variants"] = variants
		args["likes"] = likes
		args["threshold"] = typoThreshold
		// Substring of the search text (title, acronyms, numeral variants, aliases) for any query
		// variant, or trigram similarity for typos. LIKE's default escape character is '\'.
		conds = append(conds, `(p.search_text LIKE ANY(@likes)
			OR (SELECT max(word_similarity(v, p.search_text)) FROM unnest(@variants::text[]) v) >= @threshold)`)
	}
	if len(f.Platforms) > 0 && skip != "platform" {
		args["platforms"] = f.Platforms
		conds = append(conds, "pl.slug = ANY(@platforms)")
	}
	if len(f.Regions) > 0 && skip != "region" {
		args["regions"] = f.Regions
		conds = append(conds, "r.slug = ANY(@regions)")
	}
	if len(f.Types) > 0 && skip != "type" {
		args["types"] = f.Types
		conds = append(conds, "t.slug = ANY(@types)")
	}
	if w := f.Works; w != nil {
		args["works_regions"] = w.Regions
		args["works_consoles"] = w.Consoles
		args["works_pc"] = pcPlatforms()
		args["works_os"] = w.OS
		args["works_gpu"] = w.GPUScore
		args["works_cpu"] = w.CPUScore
		args["works_ram"] = w.RAMGB
		conds = append(conds, `r.slug = ANY(@works_regions)`, `(pl.slug = 'keyshop' OR pl.slug = ANY(@works_consoles)
			OR (pl.slug = ANY(@works_pc)
			    AND (p.req_min_os IS NULL OR @works_os = '' OR p.req_min_os = @works_os)
			    AND (p.req_min_gpu IS NULL OR @works_gpu = 0 OR @works_gpu >= p.req_min_gpu)
			    AND (p.req_min_cpu IS NULL OR @works_cpu = 0 OR @works_cpu >= p.req_min_cpu)
			    AND (p.req_min_ram IS NULL OR @works_ram::float8 = 0 OR @works_ram::float8 >= p.req_min_ram)))`)
	}
	if f.MinPrice != nil {
		args["min_price"] = *f.MinPrice
		conds = append(conds, "s.min_price >= @min_price")
	}
	if f.MaxPrice != nil {
		args["max_price"] = *f.MaxPrice
		conds = append(conds, "s.min_price <= @max_price")
	}
	return strings.Join(conds, " AND ")
}

func pcPlatforms() []string {
	var out []string
	for p := range compat.PCPlatforms {
		out = append(out, p)
	}
	return out
}

// AllowedRegions lists region slugs whose keys activate in the country.
func (s *Store) AllowedRegions(ctx context.Context, country string) ([]string, error) {
	rows, err := s.db.Query(ctx, `SELECT slug FROM regions`)
	if err != nil {
		return nil, err
	}
	all, err := pgx.CollectRows(rows, pgx.RowTo[string])
	return compat.RegionsFor(country, all), err
}

func escapeLike(s string) string {
	return strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`).Replace(s)
}

func (s *Store) List(ctx context.Context, f Filter) (Page, error) {
	args := pgx.NamedArgs{}
	where := f.where(args, "")
	order := sorts[f.Sort]
	args["limit"] = f.PageSize
	args["offset"] = (f.Page - 1) * f.PageSize
	// p.id is the final tie-breaker so pages never overlap or skip items.
	q := fmt.Sprintf(`%s WHERE %s ORDER BY %s, p.id LIMIT @limit OFFSET @offset`, CardSelect, where, order)
	rows, err := s.db.Query(ctx, q, args)
	if err != nil {
		return Page{}, err
	}
	items, err := pgx.CollectRows(rows, func(r pgx.CollectableRow) (Card, error) { return ScanCard(r) })
	if err != nil {
		return Page{}, err
	}
	page := Page{Items: items, Page: f.Page, PageSize: f.PageSize, Sort: f.Sort}
	countArgs := pgx.NamedArgs{}
	if err := s.db.QueryRow(ctx, fmt.Sprintf(`SELECT count(*) FROM (%s WHERE %s) x`, CardSelect, f.where(countArgs, "")), countArgs).Scan(&page.Total); err != nil {
		return Page{}, err
	}
	if page.Facets.Platforms, err = s.facet(ctx, f, "platform", "pl", "platforms"); err != nil {
		return Page{}, err
	}
	if page.Facets.Regions, err = s.facet(ctx, f, "region", "r", "regions"); err != nil {
		return Page{}, err
	}
	if page.Facets.Types, err = s.facet(ctx, f, "type", "t", "product_types"); err != nil {
		return Page{}, err
	}
	return page, nil
}

func (s *Store) facet(ctx context.Context, f Filter, dim, alias, table string) ([]FacetValue, error) {
	args := pgx.NamedArgs{}
	where := f.where(args, dim)
	col := map[string]string{"platforms": "platform_id", "regions": "region_id", "product_types": "type_id"}[table]
	q := fmt.Sprintf(`SELECT d.slug, d.name, count(x.id)::int
		FROM %s d
		LEFT JOIN (SELECT p.id, %s.slug AS dslug %s WHERE %s) x ON x.dslug = d.slug
		WHERE EXISTS (SELECT 1 FROM products px WHERE px.%s = d.id AND px.catalog = @catalog)
		GROUP BY d.id, d.slug, d.name ORDER BY count(x.id) DESC, d.name`,
		table, alias, cardFrom, where, col)
	rows, err := s.db.Query(ctx, q, args)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, func(r pgx.CollectableRow) (FacetValue, error) {
		var v FacetValue
		return v, r.Scan(&v.Slug, &v.Name, &v.Count)
	})
}

// Suggest returns up to limit best matches for the header search box.
func (s *Store) Suggest(ctx context.Context, source, query string, limit int) ([]Card, error) {
	p, err := s.List(ctx, Filter{Source: source, Query: query, Sort: "relevance", Page: 1, PageSize: limit})
	return p.Items, err
}

type CatalogInfo struct {
	Key        string  `json:"key"`
	Products   int     `json:"products"`
	SnapshotAt *string `json:"snapshotAt"`
}

// Catalogs lists the catalogs that have products (the frontend shows the switch only if the
// Eneba snapshot was imported).
func (s *Store) Catalogs(ctx context.Context) ([]CatalogInfo, error) {
	rows, err := s.db.Query(ctx, `SELECT catalog, count(*)::int, to_char(max(snapshot_at), 'YYYY-MM-DD')
		FROM products GROUP BY catalog ORDER BY catalog = 'demo' DESC, catalog`)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, func(r pgx.CollectableRow) (CatalogInfo, error) {
		var c CatalogInfo
		return c, r.Scan(&c.Key, &c.Products, &c.SnapshotAt)
	})
}

// Dimensions returns all values of a filter dimension (used by the store's filter panel).
func (s *Store) Dimension(ctx context.Context, table string) ([]Named, error) {
	switch table {
	case "platforms", "regions", "product_types":
	default:
		return nil, fmt.Errorf("unknown dimension %q", table)
	}
	rows, err := s.db.Query(ctx, `SELECT slug, name FROM `+table+` ORDER BY name`)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, func(r pgx.CollectableRow) (Named, error) {
		var n Named
		return n, r.Scan(&n.Slug, &n.Name)
	})
}

// ---------------------------------------------------------------- product page

type Offer struct {
	ID         int64  `json:"id"`
	PriceCents int64  `json:"priceCents"`
	Currency   string `json:"currency"`
	Stock      int    `json:"stock"`
	Seller     Seller `json:"seller"`
}

type Seller struct {
	Slug        string  `json:"slug"`
	Name        string  `json:"name"`
	Rating      float64 `json:"rating"`
	RatingCount int     `json:"ratingCount"`
	Verified    bool    `json:"verified"`
}

type Product struct {
	Card
	Description  string               `json:"description"`
	Developer    string               `json:"developer"`
	Publisher    string               `json:"publisher"`
	Genres       []string             `json:"genres"`
	Requirements *compat.Requirements `json:"requirements"`
	Offers       []Offer              `json:"offers"` // cheapest in-stock first, sold-out offers last
}

var ErrNotFound = fmt.Errorf("product not found")

func (s *Store) Product(ctx context.Context, slug string) (Product, error) {
	var p Product
	row := s.db.QueryRow(ctx, CardSelect+` WHERE p.slug = $1`, slug)
	card, err := ScanCard(row)
	if err == pgx.ErrNoRows {
		return p, ErrNotFound
	}
	if err != nil {
		return p, err
	}
	p.Card = card
	if err := s.db.QueryRow(ctx, `SELECT description, developer, publisher, genres, requirements FROM products WHERE id = $1`, card.ID).
		Scan(&p.Description, &p.Developer, &p.Publisher, &p.Genres, &p.Requirements); err != nil {
		return p, err
	}
	// Stock is a count only. Key codes are never selected here.
	rows, err := s.db.Query(ctx, `
		SELECT o.id, o.price_cents, o.currency,
		       (SELECT count(*)::int FROM offer_keys k WHERE k.offer_id = o.id AND k.status = 'available') AS stock,
		       se.slug, se.name, se.rating::float8, se.rating_count, se.verified
		FROM offers o JOIN sellers se ON se.id = o.seller_id
		WHERE o.product_id = $1 AND o.active
		ORDER BY (SELECT count(*) FROM offer_keys k WHERE k.offer_id = o.id AND k.status = 'available') = 0,
		         o.price_cents, se.rating DESC, o.id`, card.ID)
	if err != nil {
		return p, err
	}
	p.Offers, err = pgx.CollectRows(rows, func(r pgx.CollectableRow) (Offer, error) {
		var o Offer
		return o, r.Scan(&o.ID, &o.PriceCents, &o.Currency, &o.Stock,
			&o.Seller.Slug, &o.Seller.Name, &o.Seller.Rating, &o.Seller.RatingCount, &o.Seller.Verified)
	})
	return p, err
}
