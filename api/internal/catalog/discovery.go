package catalog

import (
	"context"
	"regexp"
	"strings"

	"github.com/jackc/pgx/v5"
)

// Product-name helpers and discovery features copied from eneba.com's search box and product
// page: "Trending searches", phrase completions and "Gamers also viewed".

var (
	parenPart  = regexp.MustCompile(`\s*\(.*?\)`)
	keySuffix  = regexp.MustCompile(`(?i)\s+(steam|xbox live|xbox|psn|playstation network|nintendo eshop|nintendo|gog\.com|gog|epic games|ea app|origin|ubisoft connect|rockstar games launcher|rockstar|battle\.net|microsoft store|official website|steam gift)?\s*(key|gift|account|cd key)\b.*$`)
	extraSpace = regexp.MustCompile(`\s+`)
)

// BaseName reduces a listing title to the game's name: "Elden Ring (PC) Steam Key EUROPE" →
// "elden ring".
func BaseName(title string) string {
	t := parenPart.ReplaceAllString(title, "")
	t = keySuffix.ReplaceAllString(t, "")
	t = strings.Trim(extraSpace.ReplaceAllString(t, " "), " -–:")
	return strings.ToLower(t)
}

// Phrases suggests search phrases for what the visitor has typed: the base names of matching
// products and "<name> <platform>" variants, like Eneba's completions above its results.
func Phrases(query string, items []Card, limit int) []string {
	q := strings.ToLower(strings.TrimSpace(query))
	seen := map[string]bool{q: true}
	var out []string
	add := func(s string) {
		if s != "" && !seen[s] && len(out) < limit {
			seen[s] = true
			out = append(out, s)
		}
	}
	for _, it := range items {
		add(BaseName(it.Title))
	}
	for _, it := range items {
		if b := BaseName(it.Title); b != "" && it.Platform.Name != "" {
			add(b + " " + strings.ToLower(it.Platform.Name))
		}
	}
	return out
}

// LogSearch counts a submitted search (normalised) for "Trending searches". Best effort: a
// failure here must not fail the search itself.
func (s *Store) LogSearch(ctx context.Context, query string) {
	q := strings.ToLower(extraSpace.ReplaceAllString(strings.TrimSpace(query), " "))
	if len([]rune(q)) < 2 || len([]rune(q)) > 60 {
		return
	}
	_, _ = s.db.Exec(ctx, `INSERT INTO search_queries (query) VALUES ($1)
		ON CONFLICT (query) DO UPDATE SET count = search_queries.count + 1, last_at = now()`, q)
}

// Trending returns the most searched phrases of the last 30 days, topped up with the names of
// the catalog's most popular products while there is little search history.
func (s *Store) Trending(ctx context.Context, source string, limit int) ([]string, error) {
	rows, err := s.db.Query(ctx, `SELECT query FROM search_queries WHERE last_at > now() - interval '30 days'
		ORDER BY count DESC, last_at DESC LIMIT $1`, limit)
	if err != nil {
		return nil, err
	}
	out, err := pgx.CollectRows(rows, pgx.RowTo[string])
	if err != nil {
		return nil, err
	}
	seen := map[string]bool{}
	for _, q := range out {
		seen[q] = true
	}
	rows, err = s.db.Query(ctx, `SELECT title FROM products WHERE catalog = $1 ORDER BY popularity DESC, id LIMIT 40`, source)
	if err != nil {
		return nil, err
	}
	titles, err := pgx.CollectRows(rows, pgx.RowTo[string])
	if err != nil {
		return nil, err
	}
	for _, t := range titles {
		if b := BaseName(t); b != "" && !seen[b] && len(out) < limit {
			seen[b] = true
			out = append(out, b)
		}
	}
	return out, nil
}

// Related: in-stock products of the same catalog sharing the most genres, then the same platform
// and type, then popularity.
func (s *Store) Related(ctx context.Context, slug string, limit int) ([]Card, error) {
	var id int64
	if err := s.db.QueryRow(ctx, `SELECT id FROM products WHERE slug = $1`, slug).Scan(&id); err != nil {
		if err == pgx.ErrNoRows {
			return nil, ErrNotFound
		}
		return nil, err
	}
	rows, err := s.db.Query(ctx, CardSelect+`
		JOIN products base ON base.id = $1
		WHERE p.catalog = base.catalog AND p.id <> base.id AND s.min_price IS NOT NULL
		ORDER BY cardinality(ARRAY(SELECT unnest(p.genres) INTERSECT SELECT unnest(base.genres))) DESC,
		         (p.platform_id = base.platform_id) DESC, (p.type_id = base.type_id) DESC, p.popularity DESC, p.id
		LIMIT $2`, id, limit)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, func(r pgx.CollectableRow) (Card, error) { return ScanCard(r) })
}
