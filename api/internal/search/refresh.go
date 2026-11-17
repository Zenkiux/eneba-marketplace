package search

import (
	"context"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Refresh recomputes search_text for every product whose stored text is missing or out of date.
// It runs on server start and after seeding/importing (a few hundred rows: milliseconds).
func Refresh(ctx context.Context, pool *pgxpool.Pool) (int, error) {
	rows, err := pool.Query(ctx, `SELECT id, title, search_text FROM products`)
	if err != nil {
		return 0, err
	}
	type row struct {
		id          int64
		title, text string
	}
	all, err := pgx.CollectRows(rows, func(r pgx.CollectableRow) (row, error) {
		var x row
		return x, r.Scan(&x.id, &x.title, &x.text)
	})
	if err != nil {
		return 0, err
	}
	batch := &pgx.Batch{}
	for _, r := range all {
		if want := Expand(r.title); want != r.text {
			batch.Queue(`UPDATE products SET search_text = $1 WHERE id = $2`, want, r.id)
		}
	}
	if batch.Len() == 0 {
		return 0, nil
	}
	return batch.Len(), pool.SendBatch(ctx, batch).Close()
}
