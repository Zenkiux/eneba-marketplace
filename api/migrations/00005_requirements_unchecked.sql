-- +goose Up
-- Minimum-requirement parts the parser couldn't read (gpu/cpu/ram). A product with any of them
-- is never shown as "works for you"; the UI says it can't be checked.
ALTER TABLE products ADD COLUMN req_min_unchecked text[] NOT NULL DEFAULT '{}';

-- +goose Down
ALTER TABLE products DROP COLUMN req_min_unchecked;
