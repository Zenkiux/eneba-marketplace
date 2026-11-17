// Package compat answers "Will it work for me?": does a game's key activate in the buyer's
// country, is it for a platform they own, and can their PC run it according to the game's
// official requirements.
//
// Hardware comparison uses an approximate relative performance index. For GPUs the numbers
// approximate public 3DMark Time Spy graphics scores; for CPUs a heuristic from brand, tier and
// generation is used. They are deliberately rough: the goal is a helpful "likely yes / likely
// no", and the UI labels results as estimates.
package compat

import (
	"regexp"
	"sort"
	"strconv"
	"strings"
)

// GPU is one entry of the GPU performance table.
type GPU struct {
	Name  string `json:"name"`
	Score int    `json:"score"`
}

// GPUs, approximate relative performance (≈ Time Spy graphics score).
var GPUs = []GPU{
	// NVIDIA desktop
	{"GeForce GT 1030", 1100}, {"GeForce GTX 750 Ti", 1200}, {"GeForce GTX 660", 1700}, {"GeForce GTX 760", 2000},
	{"GeForce GTX 770", 2400}, {"GeForce GTX 960", 2500}, {"GeForce GTX 970", 3400}, {"GeForce GTX 980", 4100},
	{"GeForce GTX 980 Ti", 5400}, {"GeForce GTX 1050", 1800}, {"GeForce GTX 1050 Ti", 2300}, {"GeForce GTX 1060 3GB", 3800},
	{"GeForce GTX 1060", 4100}, {"GeForce GTX 1070", 5800}, {"GeForce GTX 1070 Ti", 6600}, {"GeForce GTX 1080", 7300},
	{"GeForce GTX 1080 Ti", 9800}, {"GeForce GTX 1650", 3500}, {"GeForce GTX 1650 Super", 4700}, {"GeForce GTX 1660", 5400},
	{"GeForce GTX 1660 Super", 6000}, {"GeForce GTX 1660 Ti", 6200}, {"GeForce RTX 2060", 7600}, {"GeForce RTX 2060 Super", 8800},
	{"GeForce RTX 2070", 9100}, {"GeForce RTX 2070 Super", 10000}, {"GeForce RTX 2080", 11000}, {"GeForce RTX 2080 Super", 11500},
	{"GeForce RTX 2080 Ti", 13700}, {"GeForce RTX 3050", 6200}, {"GeForce RTX 3060", 8800}, {"GeForce RTX 3060 Ti", 11700},
	{"GeForce RTX 3070", 13700}, {"GeForce RTX 3070 Ti", 14600}, {"GeForce RTX 3080", 17500}, {"GeForce RTX 3080 Ti", 19500},
	{"GeForce RTX 3090", 20000}, {"GeForce RTX 3090 Ti", 22000}, {"GeForce RTX 4060", 10600}, {"GeForce RTX 4060 Ti", 13500},
	{"GeForce RTX 4070", 17800}, {"GeForce RTX 4070 Super", 20500}, {"GeForce RTX 4070 Ti", 22800}, {"GeForce RTX 4070 Ti Super", 24000},
	{"GeForce RTX 4080", 28000}, {"GeForce RTX 4080 Super", 28500}, {"GeForce RTX 4090", 36000}, {"GeForce RTX 5060", 12500},
	{"GeForce RTX 5060 Ti", 15000}, {"GeForce RTX 5070", 22000}, {"GeForce RTX 5070 Ti", 27000}, {"GeForce RTX 5080", 32000},
	{"GeForce RTX 5090", 48000},
	// NVIDIA laptop (rough)
	{"GeForce RTX 3050 Laptop", 4800}, {"GeForce RTX 3060 Laptop", 8200}, {"GeForce RTX 4050 Laptop", 8500},
	{"GeForce RTX 4060 Laptop", 10000}, {"GeForce RTX 4070 Laptop", 11500}, {"GeForce RTX 4080 Laptop", 17500},
	// AMD
	{"Radeon R9 270", 1900}, {"Radeon R9 280X", 2600}, {"Radeon R9 290", 3400}, {"Radeon R9 390", 3700},
	{"Radeon RX 460", 1800}, {"Radeon RX 470", 3600}, {"Radeon RX 480", 4300}, {"Radeon RX 550", 1300},
	{"Radeon RX 560", 1900}, {"Radeon RX 570", 3900}, {"Radeon RX 580", 4500}, {"Radeon RX 590", 4900},
	{"Radeon RX Vega 56", 6500}, {"Radeon RX Vega 64", 7200}, {"Radeon VII", 8700}, {"Radeon RX 5500 XT", 5000},
	{"Radeon RX 5600 XT", 7500}, {"Radeon RX 5700", 8400}, {"Radeon RX 5700 XT", 9300}, {"Radeon RX 6400", 3600},
	{"Radeon RX 6500 XT", 4800}, {"Radeon RX 6600", 9200}, {"Radeon RX 6600 XT", 10000}, {"Radeon RX 6650 XT", 10500},
	{"Radeon RX 6700 XT", 12500}, {"Radeon RX 6750 XT", 13000}, {"Radeon RX 6800", 16000}, {"Radeon RX 6800 XT", 18500},
	{"Radeon RX 6900 XT", 20000}, {"Radeon RX 6950 XT", 21500}, {"Radeon RX 7600", 10900}, {"Radeon RX 7600 XT", 11300},
	{"Radeon RX 7700 XT", 16500}, {"Radeon RX 7800 XT", 19500}, {"Radeon RX 7900 GRE", 22000}, {"Radeon RX 7900 XT", 26000},
	{"Radeon RX 7900 XTX", 29500}, {"Radeon RX 9070", 26000}, {"Radeon RX 9070 XT", 30000},
	{"Radeon Vega 8", 1100}, {"Radeon 680M", 2600}, {"Radeon 780M", 3000}, {"Steam Deck", 1700},
	// Intel
	{"Intel HD Graphics 4000", 200}, {"Intel HD Graphics 620", 400}, {"Intel UHD Graphics 620", 400}, {"Intel UHD Graphics 630", 450},
	{"Intel UHD Graphics", 500}, {"Intel Iris Plus", 800}, {"Intel Iris Xe", 1500}, {"Intel Arc A380", 3700},
	{"Intel Arc A580", 10500}, {"Intel Arc A750", 13000}, {"Intel Arc A770", 14000}, {"Intel Arc B580", 14800},
	// Apple silicon
	{"Apple M1", 2000}, {"Apple M1 Pro", 4000}, {"Apple M1 Max", 7500}, {"Apple M2", 2600}, {"Apple M2 Pro", 4600},
	{"Apple M2 Max", 9000}, {"Apple M3", 3500}, {"Apple M3 Pro", 5500}, {"Apple M3 Max", 12000}, {"Apple M4", 4000},
	{"Apple M4 Pro", 7000}, {"Apple M4 Max", 14000},
}

var spaces = regexp.MustCompile(`\s+`)

func canon(s string) string {
	s = strings.ToLower(s)
	for _, w := range []string{"nvidia", "geforce", "amd", "ati", "(r)", "(tm)", "®", "™", "graphics card", "series"} {
		s = strings.ReplaceAll(s, w, " ")
	}
	s = regexp.MustCompile(`[^a-z0-9 ]`).ReplaceAllString(s, " ")
	return strings.TrimSpace(spaces.ReplaceAllString(s, " "))
}

var gpuIndex = func() []GPU {
	idx := append([]GPU(nil), GPUs...)
	// Longest names first so "rtx 3060 ti" wins over "rtx 3060".
	sort.SliceStable(idx, func(i, j int) bool { return len(canon(idx[i].Name)) > len(canon(idx[j].Name)) })
	return idx
}()

// MatchGPU finds the best table entry mentioned in free text (a WebGL renderer string, or a
// requirement such as "Nvidia GeForce GTX 1060, 3GB"). ok=false if nothing is recognised.
func MatchGPU(text string) (GPU, bool) {
	c := " " + canon(text) + " "
	is3GB := strings.Contains(strings.ToLower(text), "3gb") || strings.Contains(strings.ToLower(text), "3 gb")
	for _, g := range gpuIndex {
		n := canon(g.Name)
		n = strings.TrimPrefix(n, "intel ")
		if strings.Contains(c, " "+n+" ") {
			if g.Name == "GeForce GTX 1060" && is3GB {
				return GPU{"GeForce GTX 1060 3GB", 3800}, true
			}
			return g, true
		}
	}
	return GPU{}, false
}

// RequiredGPUScore reads a requirement like "GTX 1060 | RX 580" and returns the lowest score
// among the listed alternatives (either card is enough). ok=false if none is recognised.
func RequiredGPUScore(text string) (int, bool) {
	best, ok := 0, false
	for _, part := range splitAlternatives(text) {
		if g, found := MatchGPU(part); found && (!ok || g.Score < best) {
			best, ok = g.Score, true
		}
	}
	return best, ok
}

func splitAlternatives(text string) []string {
	return regexp.MustCompile(`\s*(?:\||/|\bor\b|;)\s*`).Split(text, -1)
}

// ---------------------------------------------------------------- CPUs

var (
	intelCore  = regexp.MustCompile(`(?i)\b(?:core\s*)?i([3579])[\s-]*(\d{4,5})`)
	intelUltra = regexp.MustCompile(`(?i)core\s*ultra\s*([579])`)
	amdRyzen   = regexp.MustCompile(`(?i)ryzen\s*([3579])\s*(?:pro\s*)?(\d{4})`)
	amdFX      = regexp.MustCompile(`(?i)\bfx[\s-]*(\d{4})`)
	oldCPU     = regexp.MustCompile(`(?i)core\s*2|phenom|athlon|pentium|celeron|i[357][\s-]*\d{3}\b`)
)

// CPUScore estimates a CPU's gaming performance (≈ relative index, 1000 = Core i5-8400) from
// a model name. ok=false when the text isn't recognised.
func CPUScore(text string) (int, bool) {
	if m := intelUltra.FindStringSubmatch(text); m != nil {
		tier, _ := strconv.Atoi(m[1])
		return 1500 + tier*60, true
	}
	if m := intelCore.FindStringSubmatch(text); m != nil {
		tier, _ := strconv.Atoi(m[1])
		num := m[2]
		gen, _ := strconv.Atoi(num[:len(num)-3]) // 8400 → 8, 12400 → 12
		if gen < 2 {
			gen = 2
		}
		return 400 + gen*75 + (tier-5)*60, true
	}
	if m := amdRyzen.FindStringSubmatch(text); m != nil {
		tier, _ := strconv.Atoi(m[1])
		gen, _ := strconv.Atoi(m[2][:1]) // 3300 → 3 (Zen 2), 5600 → 5, 7600 → 7
		return 600 + gen*110 + (tier-5)*60, true
	}
	if amdFX.MatchString(text) {
		return 450, true
	}
	if oldCPU.MatchString(text) {
		return 300, true
	}
	return 0, false
}

// RequiredCPUScore: lowest score among listed alternatives.
func RequiredCPUScore(text string) (int, bool) {
	best, ok := 0, false
	for _, part := range splitAlternatives(text) {
		if s, found := CPUScore(part); found && (!ok || s < best) {
			best, ok = s, true
		}
	}
	return best, ok
}

// CPUScoreFromCores is the fallback when only the number of logical cores is known (browsers
// don't reveal the CPU model). Deliberately conservative.
func CPUScoreFromCores(cores int) int {
	switch {
	case cores >= 16:
		return 1300
	case cores >= 12:
		return 1150
	case cores >= 8:
		return 950
	case cores >= 6:
		return 800
	case cores >= 4:
		return 600
	default:
		return 400
	}
}

// ---------------------------------------------------------------- RAM, OS

var gbRe = regexp.MustCompile(`(?i)(\d+(?:\.\d+)?)\s*(gb|mb)`)

// ParseGB reads "12 GB RAM" → 12, "512 MB" → 0.5.
func ParseGB(text string) (float64, bool) {
	m := gbRe.FindStringSubmatch(text)
	if m == nil {
		return 0, false
	}
	v, _ := strconv.ParseFloat(m[1], 64)
	if strings.EqualFold(m[2], "mb") {
		v /= 1024
	}
	return v, true
}

// OSFamily reduces an OS requirement or platform string to windows/mac/linux.
func OSFamily(text string) string {
	t := strings.ToLower(text)
	switch {
	case strings.Contains(t, "mac") || strings.Contains(t, "os x"):
		return "mac"
	case strings.Contains(t, "linux") || strings.Contains(t, "ubuntu") || strings.Contains(t, "steamos"):
		return "linux"
	case strings.Contains(t, "win"):
		return "windows"
	}
	return ""
}
