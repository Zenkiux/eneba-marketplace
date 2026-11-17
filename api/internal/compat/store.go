package compat

import (
	"context"
	"encoding/json"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// SaveRequirements parses raw requirement maps and stores them on a product.
func SaveRequirements(ctx context.Context, tx pgx.Tx, productID int64, min, rec map[string]string) error {
	if len(min) == 0 && len(rec) == 0 {
		_, err := tx.Exec(ctx, `UPDATE products SET requirements = NULL, req_min_os = NULL, req_min_gpu = NULL,
			req_min_cpu = NULL, req_min_ram = NULL, req_min_unchecked = '{}' WHERE id = $1`, productID)
		return err
	}
	r := Parse(min, rec)
	raw, err := json.Marshal(r)
	if err != nil {
		return err
	}
	var os *string
	var gpu, cpu *int
	var ram *float64
	unchecked := []string{}
	if m := r.Minimum; m != nil {
		if m.Unchecked != nil {
			unchecked = m.Unchecked
		}
		if m.OS != "" {
			os = &m.OS
		}
		if m.GPUScore > 0 {
			gpu = &m.GPUScore
		}
		if m.CPUScore > 0 {
			cpu = &m.CPUScore
		}
		if m.RAMGB > 0 {
			ram = &m.RAMGB
		}
	}
	_, err = tx.Exec(ctx, `UPDATE products SET requirements = $2, req_min_os = $3, req_min_gpu = $4, req_min_cpu = $5,
		req_min_ram = $6, req_min_unchecked = $7 WHERE id = $1`, productID, raw, os, gpu, cpu, ram, unchecked)
	return err
}

// Reparse re-reads every product's stored raw requirements with the current parser, so
// improvements to the hardware tables apply to existing data on the next start.
func Reparse(ctx context.Context, pool *pgxpool.Pool) (int, error) {
	rows, err := pool.Query(ctx, `SELECT id, requirements->'rawMinimum', requirements->'rawRecommended' FROM products WHERE requirements IS NOT NULL`)
	if err != nil {
		return 0, err
	}
	type item struct {
		id       int64
		min, rec map[string]string
	}
	var items []item
	for rows.Next() {
		var it item
		if err := rows.Scan(&it.id, &it.min, &it.rec); err != nil {
			rows.Close()
			return 0, err
		}
		items = append(items, it)
	}
	if err := rows.Err(); err != nil {
		return 0, err
	}
	tx, err := pool.Begin(ctx)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback(ctx)
	for _, it := range items {
		if err := SaveRequirements(ctx, tx, it.id, it.min, it.rec); err != nil {
			return 0, err
		}
	}
	return len(items), tx.Commit(ctx)
}
