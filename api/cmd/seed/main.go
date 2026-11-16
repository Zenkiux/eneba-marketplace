// Command seed loads the demo data. Usage: seed [-reset]
// -reset wipes every table first and is refused when APP_ENV=prod.
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
	reset := flag.Bool("reset", false, "delete all data before seeding (not allowed in prod)")
	flag.Parse()

	cfg, err := config.Load()
	if err != nil {
		log.Fatal(err)
	}
	if *reset && cfg.Prod() {
		log.Fatal("-reset is not allowed with APP_ENV=prod")
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
	st, err := seed.Run(ctx, pool, box, seed.Options{Reset: *reset})
	if err != nil {
		log.Fatal(err)
	}
	fmt.Printf("seeded %d products, %d offers, %d new keys\n", st.Products, st.Offers, st.KeysAdded)
}
