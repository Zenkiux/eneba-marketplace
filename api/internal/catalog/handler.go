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
	mux.Handle("GET /api/platforms", h.dimension("platforms"))
	mux.Handle("GET /api/regions", h.dimension("regions"))
	mux.Handle("GET /api/types", h.dimension("product_types"))
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
	page, err := h.store.List(r.Context(), f)
	if err != nil {
		return err
	}
	httpx.JSON(w, http.StatusOK, page)
	return nil
}

func (h *Handler) suggest(w http.ResponseWriter, r *http.Request) error {
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	if utf8.RuneCountInString(q) > maxQueryLen {
		return bad("Search text is too long (max 100 characters)")
	}
	items := []Card{}
	if q != "" {
		var err error
		if items, err = h.store.Suggest(r.Context(), q, 6); err != nil {
			return err
		}
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"query": q, "items": items})
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
