// Package home serves the homepage. The layout (which blocks, in which order, with which titles)
// lives in the home_sections table, and every block type has its own provider that reads its
// content from the database. The frontend only maps a block type to a component.
package home

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"regexp"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/Zenkiux/eneba-marketplace/api/internal/catalog"
	"github.com/Zenkiux/eneba-marketplace/api/internal/httpx"
)

type Section struct {
	Key    string          `json:"key"`
	Type   string          `json:"type"`
	Title  string          `json:"title"`
	More   string          `json:"more,omitempty"` // "See all" link (store URL), from config
	config json.RawMessage `json:"-"`
}

type sectionConfig struct {
	Limit  int               `json:"limit"`
	Type   string            `json:"type"`   // optional product type filter, e.g. "game"
	More   string            `json:"more"`   // "See all" link
	Titles map[string]string `json:"titles"` // translated titles by language code, e.g. {"lt": "…"}
	// Slugs of products the visitor viewed (sent by the browser as ?viewed=a,b,c); used by the
	// "recently viewed" and "recommended" rows. Never stored on the server.
	Viewed []string `json:"-"`
}

var slugRe = regexp.MustCompile(`^[a-z0-9-]{1,200}$`)

func viewedFrom(r *http.Request) []string {
	var out []string
	for _, s := range strings.Split(r.URL.Query().Get("viewed"), ",") {
		if s = strings.TrimSpace(s); slugRe.MatchString(s) && len(out) < 20 {
			out = append(out, s)
		}
	}
	return out
}

func moreLink(raw json.RawMessage) string {
	var c sectionConfig
	if len(raw) > 0 && json.Unmarshal(raw, &c) == nil && strings.HasPrefix(c.More, "/") {
		return c.More
	}
	return ""
}

// Lang picks the first supported language from Accept-Language ("lt-LT,lt;q=0.9" → "lt").
func Lang(r *http.Request) string {
	for _, part := range strings.Split(r.Header.Get("Accept-Language"), ",") {
		code := strings.ToLower(strings.TrimSpace(strings.SplitN(strings.SplitN(part, ";", 2)[0], "-", 2)[0]))
		switch code {
		case "en", "lt", "de", "pl":
			return code
		}
	}
	return "en"
}

func localTitle(title string, raw json.RawMessage, lang string) string {
	var c sectionConfig
	if lang != "en" && len(raw) > 0 && json.Unmarshal(raw, &c) == nil {
		if t := c.Titles[lang]; t != "" {
			return t
		}
	}
	return title
}

// Provider loads the content of one block type.
type Provider func(ctx context.Context, db *pgxpool.Pool, s Section, cfg sectionConfig) (any, error)

// providers is the registry of block types. Adding a block type = one function here plus one
// React component; the order and titles are data.
var providers = map[string]Provider{
	"banner":          banners,
	"category_strip":  categories,
	"bestsellers":     productRow(bestsellersOrder),
	"deals":           productRow(dealsOrder),
	"new_releases":    productRow(newReleasesOrder),
	"upcoming":        productRow(upcomingOrder),
	"recently_viewed": recentlyViewed,
	"recommended":     recommended,
	"genres":          genres,
}

type Handler struct{ db *pgxpool.Pool }

func NewHandler(db *pgxpool.Pool) *Handler { return &Handler{db: db} }

func (h *Handler) Register(mux *http.ServeMux) {
	mux.Handle("GET /api/home", httpx.Handler(h.layout))
	mux.Handle("GET /api/home/sections/{key}", httpx.Handler(h.section))
}

func (h *Handler) layout(w http.ResponseWriter, r *http.Request) error {
	rows, err := h.db.Query(r.Context(), `SELECT key, type, title, config FROM home_sections WHERE enabled ORDER BY position, id`)
	if err != nil {
		return err
	}
	lang := Lang(r)
	sections, err := pgx.CollectRows(rows, func(r pgx.CollectableRow) (Section, error) {
		var s Section
		err := r.Scan(&s.Key, &s.Type, &s.Title, &s.config)
		s.Title = localTitle(s.Title, s.config, lang)
		s.More = moreLink(s.config)
		return s, err
	})
	if err != nil {
		return err
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"sections": sections})
	return nil
}

func (h *Handler) section(w http.ResponseWriter, r *http.Request) error {
	var s Section
	err := h.db.QueryRow(r.Context(), `SELECT key, type, title, config FROM home_sections WHERE key = $1 AND enabled`,
		r.PathValue("key")).Scan(&s.Key, &s.Type, &s.Title, &s.config)
	if errors.Is(err, pgx.ErrNoRows) {
		return httpx.ErrNotFound
	}
	if err != nil {
		return err
	}
	provider, ok := providers[s.Type]
	if !ok {
		return fmt.Errorf("no provider for section type %q", s.Type)
	}
	cfg := sectionConfig{Limit: 10}
	if len(s.config) > 0 {
		if err := json.Unmarshal(s.config, &cfg); err != nil {
			return fmt.Errorf("section %s config: %w", s.Key, err)
		}
	}
	if cfg.Limit < 1 || cfg.Limit > 24 {
		cfg.Limit = 10
	}
	cfg.Viewed = viewedFrom(r)
	content, err := provider(r.Context(), h.db, s, cfg)
	if err != nil {
		return err
	}
	w.Header().Add("Vary", "Accept-Language")
	httpx.JSON(w, http.StatusOK, map[string]any{"key": s.Key, "type": s.Type, "title": localTitle(s.Title, s.config, Lang(r)),
		"more": moreLink(s.config), "content": content})
	return nil
}

// ---------------------------------------------------------------- providers

type Banner struct {
	Slot     string `json:"slot"`
	Title    string `json:"title"`
	Subtitle string `json:"subtitle"`
	ImageURL string `json:"imageUrl"`
	CTALabel string `json:"ctaLabel"`
	CTAHref  string `json:"ctaHref"`
}

func banners(ctx context.Context, db *pgxpool.Pool, s Section, _ sectionConfig) (any, error) {
	rows, err := db.Query(ctx, `SELECT b.slot, b.title, b.subtitle, b.image_url, b.cta_label, b.cta_href
		FROM banners b JOIN home_sections hs ON hs.id = b.section_id
		WHERE hs.key = $1 AND (b.starts_at IS NULL OR b.starts_at <= now()) AND (b.ends_at IS NULL OR b.ends_at > now())
		ORDER BY b.position, b.id`, s.Key)
	if err != nil {
		return nil, err
	}
	items, err := pgx.CollectRows(rows, func(r pgx.CollectableRow) (Banner, error) {
		var b Banner
		return b, r.Scan(&b.Slot, &b.Title, &b.Subtitle, &b.ImageURL, &b.CTALabel, &b.CTAHref)
	})
	return map[string]any{"banners": items}, err
}

type Category struct {
	Kind  string `json:"kind"` // "type" or "platform"
	Slug  string `json:"slug"`
	Name  string `json:"name"`
	Count int    `json:"count"`
}

// categories lists product types and platforms that have products, for the icon strip.
func categories(ctx context.Context, db *pgxpool.Pool, _ Section, _ sectionConfig) (any, error) {
	rows, err := db.Query(ctx, `
		SELECT 'type', t.slug, t.name, count(p.id)::int FROM product_types t JOIN products p ON p.type_id = t.id AND p.catalog = $1 GROUP BY t.id
		UNION ALL
		SELECT 'platform', pl.slug, pl.name, count(p.id)::int FROM platforms pl JOIN products p ON p.platform_id = pl.id AND p.catalog = $1 GROUP BY pl.id
		ORDER BY 1 DESC, 4 DESC`, catalog.SourceFrom(ctx))
	if err != nil {
		return nil, err
	}
	items, err := pgx.CollectRows(rows, func(r pgx.CollectableRow) (Category, error) {
		var c Category
		return c, r.Scan(&c.Kind, &c.Slug, &c.Name, &c.Count)
	})
	return map[string]any{"categories": items}, err
}

// Ordering rules for product rows. Each one is a different query over live data.
const (
	// Best sellers: units sold in paid orders, then seeded popularity.
	bestsellersOrder = `WHERE s.min_price IS NOT NULL %s
		ORDER BY (SELECT coalesce(sum(oi.quantity), 0) FROM order_items oi JOIN orders o ON o.id = oi.order_id
		          WHERE oi.product_id = p.id AND o.status = 'paid') DESC, p.popularity DESC, p.id`
	// Deals: biggest discount of the cheapest in-stock offer against the list price.
	dealsOrder = `WHERE s.min_price IS NOT NULL AND s.min_price < p.list_price_cents %s
		ORDER BY (p.list_price_cents - s.min_price)::float / p.list_price_cents DESC, p.id`
	newReleasesOrder = `WHERE p.release_date <= current_date AND s.min_price IS NOT NULL %s
		ORDER BY p.release_date DESC, p.popularity DESC, p.id`
	upcomingOrder = `WHERE p.release_date > current_date %s ORDER BY p.release_date, p.popularity DESC, p.id`
)

func productRow(order string) Provider {
	return func(ctx context.Context, db *pgxpool.Pool, _ Section, cfg sectionConfig) (any, error) {
		args := []any{cfg.Limit, catalog.SourceFrom(ctx)}
		typeFilter := "AND p.catalog = $2"
		if cfg.Type != "" {
			typeFilter += " AND t.slug = $3"
			args = append(args, cfg.Type)
		}
		q := catalog.CardSelect + " " + fmt.Sprintf(order, typeFilter) + " LIMIT $1"
		rows, err := db.Query(ctx, q, args...)
		if err != nil {
			return nil, err
		}
		items, err := pgx.CollectRows(rows, func(r pgx.CollectableRow) (catalog.Card, error) { return catalog.ScanCard(r) })
		return map[string]any{"products": items}, err
	}
}

func cards(ctx context.Context, db *pgxpool.Pool, q string, args ...any) (any, error) {
	rows, err := db.Query(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	items, err := pgx.CollectRows(rows, func(r pgx.CollectableRow) (catalog.Card, error) { return catalog.ScanCard(r) })
	return map[string]any{"products": items}, err
}

// recentlyViewed returns the products the browser says it viewed, in that order (newest first).
func recentlyViewed(ctx context.Context, db *pgxpool.Pool, _ Section, cfg sectionConfig) (any, error) {
	if len(cfg.Viewed) == 0 {
		return map[string]any{"products": []catalog.Card{}}, nil
	}
	return cards(ctx, db, catalog.CardSelect+` WHERE p.slug = ANY($1) AND p.catalog = $2
		ORDER BY array_position($1::text[], p.slug) LIMIT $3`, cfg.Viewed, catalog.SourceFrom(ctx), cfg.Limit)
}

// recommended: in-stock products sharing genres, platform or type with what the visitor viewed,
// ranked by how much they share and then popularity; without history, the most popular ones.
func recommended(ctx context.Context, db *pgxpool.Pool, _ Section, cfg sectionConfig) (any, error) {
	viewed := cfg.Viewed
	if viewed == nil {
		viewed = []string{}
	}
	return cards(ctx, db, catalog.CardSelect+`
		LEFT JOIN LATERAL (
			SELECT coalesce(sum(cardinality(ARRAY(SELECT unnest(v.genres) INTERSECT SELECT unnest(p.genres)))), 0)
			     + 2 * count(*) FILTER (WHERE v.platform_id = p.platform_id)
			     + count(*) FILTER (WHERE v.type_id = p.type_id) AS score
			FROM products v WHERE v.slug = ANY($1)
		) m ON true
		WHERE p.catalog = $2 AND s.min_price IS NOT NULL AND NOT (p.slug = ANY($1))
		ORDER BY m.score DESC, p.popularity DESC, p.id LIMIT $3`, viewed, catalog.SourceFrom(ctx), cfg.Limit)
}

type Genre struct {
	Name  string `json:"name"`
	Count int    `json:"count"`
}

// genres: the most common genres of the catalog with product counts ("Categories" on Eneba).
func genres(ctx context.Context, db *pgxpool.Pool, _ Section, cfg sectionConfig) (any, error) {
	rows, err := db.Query(ctx, `SELECT g, count(*)::int FROM products p, unnest(p.genres) g
		WHERE p.catalog = $1 GROUP BY g ORDER BY count(*) DESC, g LIMIT $2`, catalog.SourceFrom(ctx), cfg.Limit)
	if err != nil {
		return nil, err
	}
	items, err := pgx.CollectRows(rows, func(r pgx.CollectableRow) (Genre, error) {
		var g Genre
		return g, r.Scan(&g.Name, &g.Count)
	})
	return map[string]any{"genres": items}, err
}
