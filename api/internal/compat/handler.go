package compat

import (
	"net/http"
	"regexp"
	"strings"

	"github.com/Zenkiux/eneba-marketplace/api/internal/httpx"
)

// Handler serves the device-detection helpers for "Will it work for me?".
type Handler struct{ trustCloudflare bool }

func NewHandler(trustCloudflare bool) *Handler { return &Handler{trustCloudflare: trustCloudflare} }

func (h *Handler) Register(mux *http.ServeMux) {
	mux.Handle("POST /api/compat/detect", httpx.Handler(h.detect))
	mux.Handle("GET /api/compat/gpus", httpx.Handler(h.gpus))
}

// DetectRequest is what the browser can tell us without installing anything.
type DetectRequest struct {
	Renderer string  `json:"renderer"` // WebGL UNMASKED_RENDERER string, may be empty
	Cores    int     `json:"cores"`    // navigator.hardwareConcurrency
	MemoryGB float64 `json:"memoryGb"` // navigator.deviceMemory (Chromium only, capped at 8)
	Platform string  `json:"platform"` // navigator.userAgentData.platform or a UA-derived name
}

type DetectResponse struct {
	Device       Device `json:"device"`
	GPUName      string `json:"gpuName"`
	GPUMatched   bool   `json:"gpuMatched"`
	CPUEstimated bool   `json:"cpuEstimated"` // from core count only
	RAMIsMinimum bool   `json:"ramIsMinimum"` // browsers report at most 8 GB
	Country      string `json:"country"`
}

var langCountry = regexp.MustCompile(`^[a-z]{2}-([A-Z]{2})`)

// Country guesses the visitor's country: Cloudflare's CF-IPCountry header in production,
// otherwise the region part of the browser language ("lt-LT" → LT).
func (h *Handler) Country(r *http.Request) string {
	if h.trustCloudflare {
		if c := r.Header.Get("CF-IPCountry"); len(c) == 2 && c != "XX" && c != "T1" {
			return strings.ToUpper(c)
		}
	}
	for _, part := range strings.Split(r.Header.Get("Accept-Language"), ",") {
		if m := langCountry.FindStringSubmatch(strings.TrimSpace(part)); m != nil {
			return m[1]
		}
	}
	return ""
}

func (h *Handler) detect(w http.ResponseWriter, r *http.Request) error {
	var req DetectRequest
	if err := httpx.Decode(r, &req); err != nil {
		return err
	}
	if len(req.Renderer) > 300 || len(req.Platform) > 100 || req.Cores < 0 || req.Cores > 512 || req.MemoryGB < 0 || req.MemoryGB > 1024 {
		return httpx.NewError(http.StatusBadRequest, "bad_request", "Unexpected device values")
	}
	res := DetectResponse{Country: h.Country(r), CPUEstimated: true}
	res.Device.OS = OSFamily(req.Platform)
	if g, ok := MatchGPU(req.Renderer); ok {
		res.Device.GPUScore, res.GPUName, res.GPUMatched = g.Score, g.Name, true
	}
	if req.Cores > 0 {
		res.Device.CPUScore = CPUScoreFromCores(req.Cores)
	}
	if req.MemoryGB > 0 {
		res.Device.RAMGB = req.MemoryGB
		res.RAMIsMinimum = req.MemoryGB >= 8
	}
	httpx.JSON(w, http.StatusOK, res)
	return nil
}

func (h *Handler) gpus(w http.ResponseWriter, r *http.Request) error {
	httpx.JSON(w, http.StatusOK, map[string]any{"gpus": GPUs})
	return nil
}
