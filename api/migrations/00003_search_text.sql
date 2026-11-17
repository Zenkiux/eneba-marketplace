-- +goose Up
-- Precomputed search text (normalised title + acronyms + numeral variants + aliases), filled by
-- the application (search.Refresh). Indexed for trigram similarity and substring search.
ALTER TABLE products ADD COLUMN search_text text NOT NULL DEFAULT '';
CREATE INDEX products_search_text_trgm_idx ON products USING gin (search_text gin_trgm_ops);

-- +goose Down
DROP INDEX products_search_text_trgm_idx;
ALTER TABLE products DROP COLUMN search_text;
