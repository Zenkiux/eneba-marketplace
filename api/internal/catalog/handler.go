package catalog

import (
	"errors"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"unicode/utf8"

	"github.com/Zenkiux/eneba-marketplace/api/internal/httpx"
)

const (
	maxQueryLen     = 100
	defaultPageSize = 24
	maxPageSize     = 60
)

type Handler struct{ store *Store }

func NewHandler(s *Store) *Handler { return &Handler{store: s} }

func (h *Handler) Register(mux *http.ServeMux) {
	mux.Handle("GET /api/products", httpx.Handler(h.list))
	mux.Handle("GET /api/products/{slug}", httpx.Handler(h.product))
	mux.Handle("GET /api/search/suggest", httpx.Handler(h.suggest))
	mux.Handle("GET /api/search/trending", httpx.Handler(h.trending))
	mux.Handle("GET /api/sellers/{slug}", httpx.Handler(h.seller))
	mux.Handle("GET /api/products/{slug}/related", httpx.Handler(h.related))
	mux.Handle("GET /api/platforms", h.dimension("platforms"))
	mux.Handle("GET /api/regions", h.dimension("regions"))
	mux.Handle("GET /api/types", h.dimension("product_types"))
	mux.Handle("GET /api/catalogs", httpx.Handler(h.catalogs))
}

func bad(msg string) error { return httpx.NewError(http.StatusBadRequest, "bad_request", msg) }

// ParseFilter turns query parameters into a validated Filter.
// Multi-value filters accept comma-separated slugs: ?platform=steam,gog
func ParseFilter(v url.Values) (Filter, error) {
	f := Filter{Query: strings.TrimSpace(v.Get("q")), Page: 1, PageSize: defaultPageSize}
	if utf8.RuneCountInString(f.Query) > maxQueryLen {
		return f, bad("Search text is too long (max 100 characters)")
	}
	f.Platforms = list(v.Get("platform"))
	f.Regions = list(v.Get("region"))
	f.Types = list(v.Get("type"))
	f.Genres = list(v.Get("genre"))
	for _, g := range f.Genres {
		if utf8.RuneCountInString(g) > 40 {
			return f, bad("Unknown genre")
		}
	}
	f.OS = list(v.Get("os_filter"))
	for _, o := range f.OS {
		if o != "windows" && o != "mac" && o != "linux" {
			return f, bad("os_filter must be windows, mac or linux")
		}
	}
	if c := strings.ToUpper(strings.TrimSpace(v.Get("country"))); c != "" && v.Get("works") != "1" {
		if len(c) != 2 || c[0] < 'A' || c[0] > 'Z' || c[1] < 'A' || c[1] > 'Z' {
			return f, bad("country must be a two-letter code")
		}
		f.Country = c
	}
	var err error
	if f.MinPrice, err = cents(v.Get("min_price")); err != nil {
		return f, err
	}
	if f.MaxPrice, err = cents(v.Get("max_price")); err != nil {
		return f, err
	}
	if f.MinPrice != nil && f.MaxPrice != nil && *f.MinPrice > *f.MaxPrice {
		return f, bad("min_price must not exceed max_price")
	}
	f.Sort = v.Get("sort")
	if f.Sort == "" {
		f.Sort = "popular"
		if f.Query != "" {
			f.Sort = "relevance"
		}
	}
	if !ValidSort(f.Sort) || (f.Sort == "relevance" && f.Query == "") {
		return f, bad("Unknown sort order")
	}
	if p := v.Get("page"); p != "" {
		if f.Page, err = strconv.Atoi(p); err != nil || f.Page < 1 || f.Page > 10000 {
			return f, bad("page must be a positive number")
		}
	}
	if ps := v.Get("page_size"); ps != "" {
		if f.PageSize, err = strconv.Atoi(ps); err != nil || f.PageSize < 1 || f.PageSize > maxPageSize {
			return f, bad("page_size must be between 1 and 60")
		}
	}
	return f, nil
}

func list(s string) []string {
	var out []string
	for _, p := range strings.Split(s, ",") {
		if p = strings.TrimSpace(p); p != "" && len(out) < 20 {
			out = append(out, p)
		}
	}
	return out
}

func cents(s string) (*int64, error) {
	if s == "" {
		return nil, nil
	}
	n, err := strconv.ParseInt(s, 10, 64)
	if err != nil || n < 0 || n > 100_000_000 {
		return nil, bad("Prices must be whole cents (e.g. 1999 for 19.99)")
	}
	return &n, nil
}

func (h *Handler) list(w http.ResponseWriter, r *http.Request) error {
	f, err := ParseFilter(r.URL.Query())
	if err != nil {
		return err
	}
	f.Source = SourceFrom(r.Context())
	if f.Country != "" {
		if f.CountryRegions, err = h.store.AllowedRegions(r.Context(), f.Country); err != nil {
			return err
		}
	}
	if r.URL.Query().Get("works") == "1" {
		w, err := parseWorks(r)
		if err != nil {
			return err
		}
		if w.Regions, err = h.store.AllowedRegions(r.Context(), r.URL.Query().Get("country")); err != nil {
			return err
		}
		f.Works = w
	}
	page, err := h.store.List(r.Context(), f)
	if err != nil {
		return err
	}
	// A search submitted from the store (first page) counts towards "Trending searches".
	if f.Query != "" && f.Page == 1 && r.URL.Query().Get("log") == "1" && page.Total > 0 {
		h.store.LogSearch(r.Context(), f.Query)
	}
	httpx.JSON(w, http.StatusOK, page)
	return nil
}

func (h *Handler) suggest(w http.ResponseWriter, r *http.Request) error {
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	if utf8.RuneCountInString(q) > maxQueryLen {
		return bad("Search text is too long (max 100 characters)")
	}
	items, total, phrases := []Card{}, 0, []string{}
	if q != "" {
		var err error
		if items, total, err = h.store.Suggest(r.Context(), SourceFrom(r.Context()), q, 6); err != nil {
			return err
		}
		phrases = Phrases(q, items, 4)
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"query": q, "items": items, "total": total, "phrases": phrases})
	return nil
}

func (h *Handler) product(w http.ResponseWriter, r *http.Request) error {
	p, err := h.store.Product(r.Context(), r.PathValue("slug"))
	if errors.Is(err, ErrNotFound) {
		return httpx.ErrNotFound
	}
	if err != nil {
		return err
	}
	httpx.JSON(w, http.StatusOK, p)
	return nil
}

func (h *Handler) dimension(table string) http.Handler {
	return httpx.Handler(func(w http.ResponseWriter, r *http.Request) error {
		items, err := h.store.Dimension(r.Context(), table)
		if err != nil {
			return err
		}
		httpx.JSON(w, http.StatusOK, map[string]any{"items": items})
		return nil
	})
}

func (h *Handler) catalogs(w http.ResponseWriter, r *http.Request) error {
	list, err := h.store.Catalogs(r.Context())
	if err != nil {
		return err
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"catalogs": list})
	return nil
}

// parseWorks reads the visitor's device profile for the "works for me" filter:
// ?works=1&country=LT&os=windows&gpu=8800&cpu=1100&ram=16&consoles=psn,xbox
func parseWorks(r *http.Request) (*Works, error) {
	q := r.URL.Query()
	w := &Works{}
	switch os := q.Get("os"); os {
	case "", "windows", "mac", "linux":
		w.OS = os
	default:
		return nil, bad("os must be windows, mac or linux")
	}
	num := func(name string, max int) (int, error) {
		v := q.Get(name)
		if v == "" {
			return 0, nil
		}
		n, err := strconv.Atoi(v)
		if err != nil || n < 0 || n > max {
			return 0, bad(name + " is out of range")
		}
		return n, nil
	}
	var err error
	if w.GPUScore, err = num("gpu", 100000); err != nil {
		return nil, err
	}
	if w.CPUScore, err = num("cpu", 10000); err != nil {
		return nil, err
	}
	ram, err := num("ram", 1024)
	if err != nil {
		return nil, err
	}
	w.RAMGB = float64(ram)
	for _, c := range list(q.Get("consoles")) {
		if c != "psn" && c != "xbox" && c != "nintendo" {
			return nil, bad("consoles may contain psn, xbox, nintendo")
		}
		w.Consoles = append(w.Consoles, c)
	}
	if c := q.Get("country"); c != "" && (len(c) != 2 || strings.ToUpper(c) != c) {
		return nil, bad("country must be a two-letter code like LT")
	}
	return w, nil
}

func (h *Handler) trending(w http.ResponseWriter, r *http.Request) error {
	items, err := h.store.Trending(r.Context(), SourceFrom(r.Context()), 10)
	if err != nil {
		return err
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"items": items})
	return nil
}

// related: "Gamers also viewed" — products sharing genres, then platform/type.
func (h *Handler) related(w http.ResponseWriter, r *http.Request) error {
	items, err := h.store.Related(r.Context(), r.PathValue("slug"), 10)
	if errors.Is(err, ErrNotFound) {
		return httpx.ErrNotFound
	}
	if err != nil {
		return err
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"items": items})
	return nil
}
