package compat

import "strings"

// Level holds parsed requirement numbers for one level (minimum or recommended).
type Level struct {
	OS       string  `json:"os"` // windows | mac | linux | ""
	GPUScore int     `json:"gpuScore,omitempty"`
	CPUScore int     `json:"cpuScore,omitempty"`
	RAMGB    float64 `json:"ramGb,omitempty"`
}

// Requirements is the structured form stored with a product (raw text kept for display).
type Requirements struct {
	Minimum        *Level            `json:"minimum,omitempty"`
	Recommended    *Level            `json:"recommended,omitempty"`
	RawMinimum     map[string]string `json:"rawMinimum,omitempty"`
	RawRecommended map[string]string `json:"rawRecommended,omitempty"`
}

func field(raw map[string]string, names ...string) string {
	for k, v := range raw {
		lk := strings.ToLower(k)
		for _, n := range names {
			if strings.Contains(lk, n) {
				return v
			}
		}
	}
	return ""
}

// ParseLevel turns Eneba-style key/value requirements into numbers.
func ParseLevel(raw map[string]string) *Level {
	if len(raw) == 0 {
		return nil
	}
	l := &Level{OS: OSFamily(field(raw, "system requirements", "os", "operating"))}
	if s, ok := RequiredGPUScore(field(raw, "graphics", "video", "gpu")); ok {
		l.GPUScore = s
	}
	if s, ok := RequiredCPUScore(field(raw, "processor", "cpu")); ok {
		l.CPUScore = s
	}
	if g, ok := ParseGB(field(raw, "memory", "ram")); ok {
		l.RAMGB = g
	}
	if l.OS == "" && l.GPUScore == 0 && l.CPUScore == 0 && l.RAMGB == 0 {
		return nil
	}
	return l
}

// Parse builds Requirements from raw minimum/recommended maps.
func Parse(min, rec map[string]string) Requirements {
	return Requirements{Minimum: ParseLevel(min), Recommended: ParseLevel(rec), RawMinimum: min, RawRecommended: rec}
}

// Device is what we know about the buyer's computer (detected in the browser, editable).
type Device struct {
	OS       string  `json:"os"`
	GPUScore int     `json:"gpuScore"`
	CPUScore int     `json:"cpuScore"`
	RAMGB    float64 `json:"ramGb"`
}

// Check is one comparison: which parts meet the level and which don't.
type Check struct {
	Meets   bool     `json:"meets"`
	Unknown bool     `json:"unknown"` // requirement data missing
	Short   []string `json:"short"`   // parts below the requirement: os, gpu, cpu, ram
}

// Compare checks a device against one requirement level. Missing requirement numbers are
// treated as satisfied; missing device numbers (0) are reported as unknown parts, not failures.
func Compare(d Device, l *Level) Check {
	if l == nil {
		return Check{Meets: true, Unknown: true}
	}
	c := Check{Meets: true}
	if l.OS != "" && d.OS != "" && l.OS != d.OS {
		c.Short = append(c.Short, "os")
	}
	if l.GPUScore > 0 && d.GPUScore > 0 && d.GPUScore < l.GPUScore {
		c.Short = append(c.Short, "gpu")
	}
	if l.CPUScore > 0 && d.CPUScore > 0 && d.CPUScore < l.CPUScore {
		c.Short = append(c.Short, "cpu")
	}
	if l.RAMGB > 0 && d.RAMGB > 0 && d.RAMGB+0.01 < l.RAMGB {
		c.Short = append(c.Short, "ram")
	}
	c.Meets = len(c.Short) == 0
	return c
}

// ---------------------------------------------------------------- platforms & regions

// PCPlatforms are activation platforms for games played on a computer.
var PCPlatforms = map[string]bool{"steam": true, "gog": true, "epic": true, "ea": true, "ubisoft": true,
	"rockstar": true, "battlenet": true, "microsoft": true, "other": true}

// ConsoleOf maps a key platform to the console family it needs ("" = not a console key).
func ConsoleOf(platform string) string {
	switch platform {
	case "psn":
		return "playstation"
	case "xbox":
		return "xbox"
	case "nintendo":
		return "nintendo"
	}
	return ""
}

var euEEA = strings.Fields("AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE IS LI NO CH")

var regionCountries = map[string][]string{
	"europe":         append(append([]string{}, euEEA...), "GB"),
	"north-america":  {"US", "CA"},
	"united-kingdom": {"GB"},
	"latin-america":  strings.Fields("MX AR BR CL CO PE UY PY BO EC VE CR PA GT HN SV NI DO"),
	"turkey":         {"TR"},
	"argentina":      {"AR"},
	"brazil":         {"BR"},
}

// RegionWorksIn reports whether a key of this region activates in the country (ISO 3166-1
// alpha-2). Unknown country → true (we can't tell). Based on the usual meaning of each region
// label; the product page remains the source of truth.
func RegionWorksIn(region, country string) bool {
	country = strings.ToUpper(strings.TrimSpace(country))
	if country == "" || country == "XX" || region == "global" || region == "" {
		return true
	}
	if region == "rest-of-world" {
		for _, c := range append(append([]string{}, regionCountries["europe"]...), "US", "CA") {
			if c == country {
				return false
			}
		}
		return true
	}
	for _, c := range regionCountries[region] {
		if c == country {
			return true
		}
	}
	return false
}

// RegionsFor lists region slugs whose keys activate in the country.
func RegionsFor(country string, all []string) []string {
	var out []string
	for _, r := range all {
		if RegionWorksIn(r, country) {
			out = append(out, r)
		}
	}
	return out
}
