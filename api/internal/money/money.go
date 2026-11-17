// Package money serves display currencies. Prices are stored and charged in EUR; other
// currencies are shown converted with fixed demo rates (clearly labelled in the UI).
package money

import (
	"net/http"

	"github.com/Zenkiux/eneba-marketplace/api/internal/httpx"
)

type Currency struct {
	Code   string  `json:"code"`
	Symbol string  `json:"symbol"`
	Rate   float64 `json:"rate"` // units of this currency per 1 EUR
}

// Fixed demonstration rates (approximate mid-market rates, November 2026 is not live data).
var Currencies = []Currency{
	{"EUR", "€", 1}, {"USD", "$", 1.08}, {"GBP", "£", 0.85}, {"PLN", "zł", 4.30}, {"SEK", "kr", 11.40}, {"CZK", "Kč", 25.20},
}

func Register(mux *http.ServeMux) {
	mux.Handle("GET /api/currencies", httpx.Handler(func(w http.ResponseWriter, r *http.Request) error {
		w.Header().Set("Cache-Control", "public, max-age=3600")
		httpx.JSON(w, http.StatusOK, map[string]any{"base": "EUR", "currencies": Currencies, "note": "Fixed demo rates; orders are charged in EUR."})
		return nil
	}))
}
