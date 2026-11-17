-- +goose Up
-- System requirements (raw text for display + parsed numbers for "Will it work for me?").
ALTER TABLE products
    ADD COLUMN requirements jsonb,
    ADD COLUMN req_min_os  text,
    ADD COLUMN req_min_gpu integer,
    ADD COLUMN req_min_cpu integer,
    ADD COLUMN req_min_ram numeric(5,1);

-- +goose Down
ALTER TABLE products DROP COLUMN requirements, DROP COLUMN req_min_os, DROP COLUMN req_min_gpu,
    DROP COLUMN req_min_cpu, DROP COLUMN req_min_ram;
