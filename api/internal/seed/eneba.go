package seed

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/Zenkiux/eneba-marketplace/api/internal/compat"
	"github.com/Zenkiux/eneba-marketplace/api/internal/keys"
	"github.com/Zenkiux/eneba-marketplace/api/internal/search"
)

// EnebaSnapshot is the file written by e2e/tools/scrape-eneba.mjs (kept local, never committed).
type EnebaSnapshot struct {
	Source    string    `json:"source"`
	ScrapedAt time.Time `json:"scrapedAt"`
	Products  []struct {
		Slug             string  `json:"slug"`
		URL              string  `json:"url"`
		Name             string  `json:"name"`
		Image            string  `json:"image"`
		ReleaseDate      *string `json:"releaseDate"`
		Platform         string  `json:"platform"`
		Region           string  `json:"region"`
		ListPriceCents   int64   `json:"listPriceCents"`
		OfferPricesCents []int64 `json:"offerPricesCents"`
		Type             string  `json:"type"`
		Requirements     *struct {
			Minimum     map[string]string `json:"minimum"`
			Recommended map[string]string `json:"recommended"`
		} `json:"requirements"`
		// From the product page: genre tags, "Other details" and the schema.org rating.
		Details *struct {
			Genres     []string `json:"genres"`
			Languages  []string `json:"languages"`
			Publisher  string   `json:"publisher"`
			Developers []string `json:"developers"`
			WorksOn    []string `json:"worksOn"`
			Rating     *struct {
				Value float64 `json:"value"`
				Count int     `json:"count"`
			} `json:"rating"`
		} `json:"details"`
	} `json:"products"`
}

var enebaPlatformNames = map[string]string{
	"rockstar": "Rockstar Games Launcher", "ea": "EA app", "ubisoft": "Ubisoft Connect",
	"battlenet": "Battle.net", "microsoft": "Microsoft Store", "other": "Other",
}

var enebaRegionNames = map[string]string{
	"latin-america": "Latin America", "turkey": "Turkey", "argentina": "Argentina", "brazil": "Brazil",
	"rest-of-world": "Rest of World",
}

var enebaTypes = map[string]bool{"game": true, "dlc": true, "gift-card": true, "subscription": true, "software": true}

// ImportEneba loads a snapshot as catalog 'eneba'. Real titles, cover URLs (Eneba's image CDN)
// and prices are kept; sellers are our demo sellers and keys are freshly generated fake keys.
// Idempotent like Run: products upsert by slug, keys are added only to offers that have none.
func ImportEneba(ctx context.Context, pool *pgxpool.Pool, box *keys.Box, file string) (Stats, error) {
	var st Stats
	raw, err := os.ReadFile(file)
	if err != nil {
		return st, err
	}
	var snap EnebaSnapshot
	if err := json.Unmarshal(raw, &snap); err != nil {
		return st, fmt.Errorf("parse %s: %w", file, err)
	}
	err = pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		var sellerIDs []int64
		rows, err := tx.Query(ctx, `SELECT id FROM sellers ORDER BY rating DESC, id`)
		if err != nil {
			return err
		}
		if sellerIDs, err = pgx.CollectRows(rows, pgx.RowTo[int64]); err != nil {
			return err
		}
		if len(sellerIDs) == 0 {
			return fmt.Errorf("run the demo seed first (no sellers)")
		}
		for i, p := range snap.Products {
			if len(p.OfferPricesCents) == 0 || p.ListPriceCents <= 0 {
				continue
			}
			name := enebaPlatformNames[p.Platform]
			if name == "" {
				name = p.Platform
			}
			if _, err := tx.Exec(ctx, `INSERT INTO platforms (slug, name) VALUES ($1, $2) ON CONFLICT (slug) DO NOTHING`, p.Platform, name); err != nil {
				return err
			}
			if rn := enebaRegionNames[p.Region]; rn != "" {
				if _, err := tx.Exec(ctx, `INSERT INTO regions (slug, name) VALUES ($1, $2) ON CONFLICT (slug) DO NOTHING`, p.Region, rn); err != nil {
					return err
				}
			}
			typ := p.Type
			if !enebaTypes[typ] {
				typ = "game"
			}
			if _, err := tx.Exec(ctx, `INSERT INTO product_types (slug, name) VALUES ('software', 'Software') ON CONFLICT (slug) DO NOTHING`); err != nil {
				return err
			}
			var productID int64
			err := tx.QueryRow(ctx, `INSERT INTO products (slug, title, description, cover_url, platform_id, region_id, type_id,
					release_date, list_price_cents, popularity, catalog, source_url, snapshot_at)
				VALUES ($1, $2, $3, $4, (SELECT id FROM platforms WHERE slug = $5), (SELECT id FROM regions WHERE slug = $6),
					(SELECT id FROM product_types WHERE slug = $12), $7, $8, $9, 'eneba', $10, $11)
				ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, cover_url = EXCLUDED.cover_url, type_id = EXCLUDED.type_id,
					region_id = EXCLUDED.region_id, platform_id = EXCLUDED.platform_id,
					list_price_cents = EXCLUDED.list_price_cents, popularity = EXCLUDED.popularity, snapshot_at = EXCLUDED.snapshot_at
				RETURNING id`,
				"eneba-"+p.Slug, p.Name,
				fmt.Sprintf("Listing from an eneba.com snapshot taken on %s, shown for demonstration. Prices are as listed on that day; sellers are demo sellers and keys are fake.", snap.ScrapedAt.Format("2 January 2006")),
				p.Image, p.Platform, p.Region, p.ReleaseDate, p.ListPriceCents, 1000-i*3, p.URL, snap.ScrapedAt, typ).Scan(&productID)
			if err != nil {
				return fmt.Errorf("%s: %w", p.Slug, err)
			}
			st.Products++
			var min, rec map[string]string
			if p.Requirements != nil {
				min, rec = p.Requirements.Minimum, p.Requirements.Recommended
			}
			if err := compat.SaveRequirements(ctx, tx, productID, min, rec); err != nil {
				return err
			}
			if d := p.Details; d != nil {
				works := []string{}
				for _, w := range d.WorksOn {
					if f := compat.OSFamily(w); f != "" {
						works = append(works, f)
					}
				}
				var rating *float64
				count := 0
				if d.Rating != nil && d.Rating.Count > 0 && d.Rating.Value >= 1 && d.Rating.Value <= 5 {
					rating, count = &d.Rating.Value, d.Rating.Count
				}
				if _, err := tx.Exec(ctx, `UPDATE products SET genres = $2, languages = $3, publisher = $4, developer = $5,
						works_on = $6, ext_rating = $7, ext_rating_count = $8 WHERE id = $1`,
					productID, nonNil(d.Genres), nonNil(d.Languages), d.Publisher, strings.Join(d.Developers, ", "), works, rating, count); err != nil {
					return err
				}
			}
			for j, price := range p.OfferPricesCents {
				seller := sellerIDs[(i+j)%len(sellerIDs)]
				var offerID int64
				if err := tx.QueryRow(ctx, `INSERT INTO offers (product_id, seller_id, price_cents) VALUES ($1, $2, $3)
					ON CONFLICT (product_id, seller_id) DO UPDATE SET price_cents = EXCLUDED.price_cents, active = true
					RETURNING id`, productID, seller, price).Scan(&offerID); err != nil {
					return err
				}
				st.Offers++
				var existing int
				if err := tx.QueryRow(ctx, `SELECT count(*) FROM offer_keys WHERE offer_id = $1`, offerID).Scan(&existing); err != nil {
					return err
				}
				for k := existing; k < 8+((i+j)%10); k++ {
					code := demoCode()
					sealed, err := box.Seal(code)
					if err != nil {
						return err
					}
					if _, err := tx.Exec(ctx, `INSERT INTO offer_keys (offer_id, code_ciphertext, code_fingerprint) VALUES ($1, $2, $3)`,
						offerID, sealed, box.Fingerprint(code)); err != nil {
						return err
					}
					st.KeysAdded++
				}
			}
		}
		return nil
	})
	if err == nil {
		if err = compat.FillWorksOn(ctx, pool); err == nil {
			_, err = search.Refresh(ctx, pool)
		}
	}
	return st, err
}

func nonNil(s []string) []string {
	if s == nil {
		return []string{}
	}
	return s
}
