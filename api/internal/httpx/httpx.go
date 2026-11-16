// Package httpx holds small HTTP helpers shared by all handlers: JSON responses,
// a single error format and request-body decoding.
package httpx

import (
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"mime"
	"net/http"
)

// Error is the one error shape every endpoint returns:
// {"error": {"code": "out_of_stock", "message": "...", "details": {...}}}
type Error struct {
	Status  int    `json:"-"`
	Code    string `json:"code"`
	Message string `json:"message"`
	Details any    `json:"details,omitempty"`
}

func (e *Error) Error() string { return e.Code + ": " + e.Message }

func NewError(status int, code, msg string) *Error {
	return &Error{Status: status, Code: code, Message: msg}
}

var (
	ErrNotFound     = NewError(http.StatusNotFound, "not_found", "Not found")
	ErrUnauthorized = NewError(http.StatusUnauthorized, "unauthorized", "Please sign in")
)

func JSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(v); err != nil {
		slog.Warn("write json", "err", err)
	}
}

// Fail writes err as a JSON error. Unknown errors are logged and hidden behind a 500.
func Fail(w http.ResponseWriter, r *http.Request, err error) {
	var e *Error
	if !errors.As(err, &e) {
		slog.Error("request failed", "method", r.Method, "path", r.URL.Path, "err", err)
		e = NewError(http.StatusInternalServerError, "internal", "Something went wrong. Please try again.")
	}
	JSON(w, e.Status, map[string]*Error{"error": e})
}

const maxBody = 64 << 10

// Decode reads a JSON request body into dst. It requires Content-Type application/json,
// which also means browsers cannot send it cross-site without a CORS preflight.
func Decode(r *http.Request, dst any) error {
	mt, _, _ := mime.ParseMediaType(r.Header.Get("Content-Type"))
	if mt != "application/json" {
		return NewError(http.StatusUnsupportedMediaType, "unsupported_media_type", "Expected application/json")
	}
	dec := json.NewDecoder(io.LimitReader(r.Body, maxBody))
	dec.DisallowUnknownFields()
	if err := dec.Decode(dst); err != nil {
		return NewError(http.StatusBadRequest, "bad_request", "Invalid JSON body")
	}
	return nil
}

// Handler adapts a handler that returns an error into an http.HandlerFunc.
type Handler func(w http.ResponseWriter, r *http.Request) error

func (h Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if err := h(w, r); err != nil {
		Fail(w, r, err)
	}
}
