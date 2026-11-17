-- +goose Up
-- Features measured on eneba.com that were missing: product reviews, "Other details"
-- (languages, works on), external rating from the Eneba snapshot, newsletter sign-up, trending
-- searches, and the homepage rows Eneba shows (recently viewed, recommended, gift cards,
-- genre categories). Section rows are data: order/titles can be changed without code changes.
ALTER TABLE products
    ADD COLUMN languages        text[] NOT NULL DEFAULT '{}',
    ADD COLUMN works_on         text[] NOT NULL DEFAULT '{}', -- windows | mac | linux
    ADD COLUMN ext_rating       numeric(3,2),                 -- e.g. 4.58 (Eneba snapshot only)
    ADD COLUMN ext_rating_count integer NOT NULL DEFAULT 0;
CREATE INDEX products_genres_idx ON products USING gin (genres);

CREATE TABLE product_reviews (
    id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    product_id bigint NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    user_id    uuid   NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating     smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
    body       text NOT NULL CHECK (char_length(body) BETWEEN 10 AND 2000),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (product_id, user_id)
);
CREATE INDEX product_reviews_product_idx ON product_reviews(product_id, created_at DESC);

CREATE TABLE newsletter_subscribers (
    email      citext PRIMARY KEY,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Normalised search queries submitted from the store, for "Trending searches".
CREATE TABLE search_queries (
    query   text PRIMARY KEY,
    count   integer NOT NULL DEFAULT 1,
    last_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE home_sections DROP CONSTRAINT home_sections_type_check;
ALTER TABLE home_sections ADD CONSTRAINT home_sections_type_check CHECK (type IN ('banner', 'category_strip', 'bestsellers',
    'deals', 'new_releases', 'upcoming', 'recently_viewed', 'recommended', 'genres'));

INSERT INTO home_sections (key, type, title, position, config) VALUES
    ('recently-viewed', 'recently_viewed', 'Recently viewed', 25,
        '{"limit": 10, "titles": {"lt": "Neseniai peržiūrėti", "de": "Zuletzt angesehen", "pl": "Ostatnio oglądane"}}'),
    ('recommended', 'recommended', 'Recommended for you', 27,
        '{"limit": 10, "more": "/store?sort=popular", "titles": {"lt": "Rekomenduojama jums", "de": "Für dich empfohlen", "pl": "Polecane dla Ciebie"}}'),
    ('gift-cards', 'bestsellers', 'Best selling gift cards', 55,
        '{"limit": 10, "type": "gift-card", "more": "/store?type=gift-card", "titles": {"lt": "Perkamiausios dovanų kortelės", "de": "Meistverkaufte Geschenkkarten", "pl": "Najlepiej sprzedające się karty podarunkowe"}}'),
    ('genres', 'genres', 'Categories', 70,
        '{"limit": 12, "titles": {"lt": "Kategorijos", "de": "Kategorien", "pl": "Kategorie"}}')
ON CONFLICT (key) DO NOTHING;
UPDATE home_sections SET config = config || '{"more": "/store?type=game&sort=popular"}' WHERE key = 'top-games';
UPDATE home_sections SET config = config || '{"more": "/store?sort=discount"}' WHERE key = 'deals';
UPDATE home_sections SET config = config || '{"more": "/store?sort=newest"}' WHERE key = 'new-releases';

-- +goose Down
DELETE FROM home_sections WHERE key IN ('recently-viewed', 'recommended', 'gift-cards', 'genres');
ALTER TABLE home_sections DROP CONSTRAINT home_sections_type_check;
ALTER TABLE home_sections ADD CONSTRAINT home_sections_type_check CHECK (type IN ('banner', 'category_strip', 'bestsellers',
    'deals', 'new_releases', 'upcoming'));
DROP TABLE search_queries;
DROP TABLE newsletter_subscribers;
DROP TABLE product_reviews;
DROP INDEX products_genres_idx;
ALTER TABLE products DROP COLUMN languages, DROP COLUMN works_on, DROP COLUMN ext_rating, DROP COLUMN ext_rating_count;
