// Command import-eneba loads a local eneba.com snapshot (see e2e/tools/scrape-eneba.mjs) as the
// optional "eneba" catalog. Usage: import-eneba [-file ../data/eneba-snapshot.json]
package main

import (
	"context"
	"flag"
	"fmt"
	"log"

	"github.com/Zenkiux/eneba-marketplace/api/internal/config"
	"github.com/Zenkiux/eneba-marketplace/api/internal/db"
	"github.com/Zenkiux/eneba-marketplace/api/internal/keys"
	"github.com/Zenkiux/eneba-marketplace/api/internal/seed"
)

func main() {
	file := flag.String("file", "../data/eneba-snapshot.json", "snapshot written by the scraper")
	flag.Parse()
	cfg, err := config.Load()
	if err != nil {
		log.Fatal(err)
	}
	ctx := context.Background()
	pool, err := db.Open(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatal(err)
	}
	defer pool.Close()
	if err := db.Migrate(ctx, pool); err != nil {
		log.Fatal(err)
	}
	box, err := keys.NewBox(cfg.KeyEncryption)
	if err != nil {
		log.Fatal(err)
	}
	st, err := seed.ImportEneba(ctx, pool, box, *file)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Printf("imported %d eneba products, %d offers, %d new keys\n", st.Products, st.Offers, st.KeysAdded)
}
