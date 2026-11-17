package compat

import (
	"context"
	"encoding/json"

	"github.com/jackc/pgx/v5"
)

// SaveRequirements parses raw requirement maps and stores them on a product.
func SaveRequirements(ctx context.Context, tx pgx.Tx, productID int64, min, rec map[string]string) error {
	if len(min) == 0 && len(rec) == 0 {
		_, err := tx.Exec(ctx, `UPDATE products SET requirements = NULL, req_min_os = NULL, req_min_gpu = NULL,
			req_min_cpu = NULL, req_min_ram = NULL WHERE id = $1`, productID)
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
	if m := r.Minimum; m != nil {
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
		req_min_ram = $6 WHERE id = $1`, productID, raw, os, gpu, cpu, ram)
	return err
}
