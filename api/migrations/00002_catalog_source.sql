-- +goose Up
-- Two catalogs live side by side: our original demo catalog (default) and an optional snapshot
-- of eneba.com listings, imported from a local file and shown only when a visitor switches to it.
ALTER TABLE products
    ADD COLUMN catalog text NOT NULL DEFAULT 'demo' CHECK (catalog IN ('demo', 'eneba')),
    ADD COLUMN source_url text,
    ADD COLUMN snapshot_at timestamptz;
CREATE INDEX products_catalog_idx ON products(catalog);

-- +goose Down
DROP INDEX products_catalog_idx;
ALTER TABLE products DROP COLUMN catalog, DROP COLUMN source_url, DROP COLUMN snapshot_at;
