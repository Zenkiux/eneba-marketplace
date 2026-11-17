// Package seed loads the fictional demo catalog, sellers, offers, digital keys, homepage
// content and a demo account. It is idempotent: running it again updates rows by slug and only
// adds keys to offers that have never had any.
package seed

import (
	"context"
	"crypto/rand"
	"fmt"
	"hash/fnv"
	mrand "math/rand/v2"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"

	"github.com/Zenkiux/eneba-marketplace/api/internal/compat"
	"github.com/Zenkiux/eneba-marketplace/api/internal/keys"
	"github.com/Zenkiux/eneba-marketplace/api/internal/search"
)

// Demo account, published in the README so evaluators can sign in immediately.
const (
	DemoEmail    = "demo@example.test"
	DemoPassword = "demo-password-2027"
)

type Options struct {
	Reset bool // wipe all data first (development and tests only)
}

type Stats struct {
	Products, Offers, KeysAdded int
}

func Run(ctx context.Context, pool *pgxpool.Pool, box *keys.Box, opt Options) (Stats, error) {
	var st Stats
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		if opt.Reset {
			if _, err := tx.Exec(ctx, `TRUNCATE banners, home_sections, cart_items, payment_attempts, offer_keys,
				order_items, orders, offers, sellers, products, product_types, regions, platforms, sessions, users
				RESTART IDENTITY CASCADE`); err != nil {
				return err
			}
		}
		for table, rows := range map[string][]named{"platforms": platforms, "regions": regions, "product_types": productTypes} {
			for _, r := range rows {
				if _, err := tx.Exec(ctx, fmt.Sprintf(`INSERT INTO %s (slug, name) VALUES ($1, $2)
					ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name`, table), r.Slug, r.Name); err != nil {
					return err
				}
			}
		}
		sellerIDs := make([]int64, len(sellers))
		for i, s := range sellers {
			if err := tx.QueryRow(ctx, `INSERT INTO sellers (slug, name, rating, rating_count, verified)
				VALUES ($1, $2, $3, $4, $5)
				ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, rating = EXCLUDED.rating,
					rating_count = EXCLUDED.rating_count, verified = EXCLUDED.verified
				RETURNING id`, s.Slug, s.Name, s.Rating, s.Count, s.Verified).Scan(&sellerIDs[i]); err != nil {
				return err
			}
		}
		for _, t := range titles {
			for _, v := range t.Variants {
				slug := t.Slug + "-" + v.Platform + "-" + v.Region
				var productID int64
				err := tx.QueryRow(ctx, `INSERT INTO products (slug, title, description, cover_url, platform_id, region_id, type_id,
						release_date, developer, publisher, genres, list_price_cents, popularity)
					VALUES ($1, $2, $3, $4,
						(SELECT id FROM platforms WHERE slug = $5), (SELECT id FROM regions WHERE slug = $6),
						(SELECT id FROM product_types WHERE slug = $7), $8, $9, $10, $11, $12, $13)
					ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, description = EXCLUDED.description,
						cover_url = EXCLUDED.cover_url, platform_id = EXCLUDED.platform_id, region_id = EXCLUDED.region_id,
						type_id = EXCLUDED.type_id, release_date = EXCLUDED.release_date, developer = EXCLUDED.developer,
						publisher = EXCLUDED.publisher, genres = EXCLUDED.genres,
						list_price_cents = EXCLUDED.list_price_cents, popularity = EXCLUDED.popularity
					RETURNING id`,
					slug, listingTitle(t, v), t.Description, "/covers/"+t.Slug+".jpg", v.Platform, v.Region, t.Type,
					t.Release, t.Developer, t.Publisher, t.Genres, v.ListCents, v.Popularity).Scan(&productID)
				if err != nil {
					return fmt.Errorf("product %s: %w", slug, err)
				}
				st.Products++
				min, rec := demoRequirements(t, v)
				if err := compat.SaveRequirements(ctx, tx, productID, min, rec); err != nil {
					return err
				}
				n, added, err := seedOffers(ctx, tx, box, slug, productID, v.ListCents, sellerIDs)
				if err != nil {
					return fmt.Errorf("offers %s: %w", slug, err)
				}
				st.Offers += n
				st.KeysAdded += added
			}
		}
		if err := seedHome(ctx, tx); err != nil {
			return err
		}
		return seedDemoUser(ctx, tx)
	})
	if err == nil {
		_, err = search.Refresh(ctx, pool)
	}
	return st, err
}

var platformLabel = map[string]string{
	"steam": "PC", "gog": "PC", "epic": "PC", "xbox": "Xbox Series X|S", "psn": "PS5", "nintendo": "Nintendo Switch",
}

// listingTitle builds an Eneba-style listing name, e.g. "Starfall Odyssey (PC) Steam Key GLOBAL".
func listingTitle(t title, v variant) string {
	region := strings.ToUpper(strings.ReplaceAll(v.Region, "-", " "))
	if v.Platform == "keyshop" {
		return t.Name + " " + region
	}
	var pname string
	for _, p := range platforms {
		if p.Slug == v.Platform {
			pname = p.Name
		}
	}
	return fmt.Sprintf("%s (%s) %s Key %s", t.Name, platformLabel[v.Platform], pname, region)
}

// seedOffers gives each product 2–6 sellers with prices between 55% and 98% of list price.
// The choice is derived from the product slug, so every run produces the same offers.
func seedOffers(ctx context.Context, tx pgx.Tx, box *keys.Box, slug string, productID, listCents int64, sellerIDs []int64) (int, int, error) {
	h := fnv.New64a()
	h.Write([]byte(slug))
	rng := mrand.New(mrand.NewPCG(h.Sum64(), 2027))
	count := 2 + rng.IntN(5)
	if count > len(sellerIDs) {
		count = len(sellerIDs)
	}
	perm := rng.Perm(len(sellerIDs))[:count]
	added := 0
	for _, idx := range perm {
		// Draw every random value before any early exit, so reruns see the same sequence.
		factor := 0.55 + rng.Float64()*0.43
		stock := 3 + rng.IntN(23)
		if rng.IntN(10) == 0 { // about one offer in ten starts sold out
			stock = 0
		}
		price := int64(float64(listCents)*factor/10)*10 + 9 // ends in 9 cents, like real shops
		var offerID int64
		if err := tx.QueryRow(ctx, `INSERT INTO offers (product_id, seller_id, price_cents)
			VALUES ($1, $2, $3)
			ON CONFLICT (product_id, seller_id) DO UPDATE SET price_cents = EXCLUDED.price_cents, active = true, updated_at = now()
			RETURNING id`, productID, sellerIDs[idx], price).Scan(&offerID); err != nil {
			return 0, 0, err
		}
		var existing int
		if err := tx.QueryRow(ctx, `SELECT count(*) FROM offer_keys WHERE offer_id = $1`, offerID).Scan(&existing); err != nil {
			return 0, 0, err
		}
		if existing > 0 {
			continue
		}
		for i := 0; i < stock; i++ {
			code := demoCode()
			sealed, err := box.Seal(code)
			if err != nil {
				return 0, 0, err
			}
			if _, err := tx.Exec(ctx, `INSERT INTO offer_keys (offer_id, code_ciphertext, code_fingerprint) VALUES ($1, $2, $3)`,
				offerID, sealed, box.Fingerprint(code)); err != nil {
				return 0, 0, err
			}
			added++
		}
	}
	return count, added, nil
}

const codeAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

// demoCode returns a random, clearly fake key such as DEMO-7K2QX-PL9VA-3MZ8R.
func demoCode() string {
	b := make([]byte, 15)
	if _, err := rand.Read(b); err != nil {
		panic(err)
	}
	var sb strings.Builder
	sb.WriteString("DEMO")
	for i, x := range b {
		if i%5 == 0 {
			sb.WriteByte('-')
		}
		sb.WriteByte(codeAlphabet[int(x)%len(codeAlphabet)])
	}
	return sb.String()
}

func seedHome(ctx context.Context, tx pgx.Tx) error {
	for i, s := range sections {
		if _, err := tx.Exec(ctx, `INSERT INTO home_sections (key, type, title, position, config)
			VALUES ($1, $2, $3, $4, $5)
			ON CONFLICT (key) DO UPDATE SET type = EXCLUDED.type, title = EXCLUDED.title,
				position = EXCLUDED.position, config = EXCLUDED.config`,
			s.Key, s.Type, s.Title, (i+1)*10, s.Config); err != nil {
			return err
		}
	}
	// Banners are replaced as a set for the hero section.
	if _, err := tx.Exec(ctx, `DELETE FROM banners WHERE section_id = (SELECT id FROM home_sections WHERE key = 'hero')`); err != nil {
		return err
	}
	for i, b := range banners {
		if _, err := tx.Exec(ctx, `INSERT INTO banners (section_id, slot, title, subtitle, image_url, cta_label, cta_href, position)
			VALUES ((SELECT id FROM home_sections WHERE key = 'hero'), $1, $2, $3, $4, $5, $6, $7)`,
			b.Slot, b.Title, b.Subtitle, b.Image, b.CTALabel, b.CTAHref, i); err != nil {
			return err
		}
	}
	return nil
}

func seedDemoUser(ctx context.Context, tx pgx.Tx) error {
	var exists bool
	if err := tx.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM users WHERE email = $1)`, DemoEmail).Scan(&exists); err != nil || exists {
		return err
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(DemoPassword), 12)
	if err != nil {
		return err
	}
	_, err = tx.Exec(ctx, `INSERT INTO users (email, password_hash, display_name) VALUES ($1, $2, 'Demo Buyer')`, DemoEmail, string(hash))
	return err
}
