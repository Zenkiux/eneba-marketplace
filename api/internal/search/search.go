// Package search prepares text for fuzzy product search. Each product stores a "search text":
// its normalised title plus generated variants (acronyms, Roman numerals ⇄ digits, well-known
// aliases). Queries are normalised the same way, then matched in PostgreSQL by substring and
// trigram similarity (pg_trgm), so "gta 6", "GTA VI", "gta6" and "grand theft auto six" all work.
package search

import (
	"regexp"
	"strings"
	"unicode"

	"golang.org/x/text/unicode/norm"
)

var (
	nonWord     = regexp.MustCompile(`[^\p{L}\p{N}]+`)
	editionTail = regexp.MustCompile(`\s*[\(\[].*$`) // "(PC) Steam Key GLOBAL" and similar
	storeWords  = map[string]bool{"steam": true, "key": true, "gift": true, "global": true, "europe": true, "eu": true, "xbox": true,
		"live": true, "psn": true, "ps4": true, "ps5": true, "pc": true, "nintendo": true, "switch": true, "eshop": true, "gog": true,
		"epic": true, "games": true, "launcher": true, "rockstar": true, "official": true, "website": true, "windows": true,
		"store": true, "network": true, "playstation": true, "account": true, "cd": true, "north": true, "america": true,
		"united": true, "states": true, "kingdom": true, "series": true, "x": true, "s": true, "one": true}
	stopWords = map[string]bool{"of": true, "the": true, "and": true, "a": true, "an": true, "for": true, "to": true, "in": true}
)

var romans = []struct{ roman, digit, word string }{
	{"ii", "2", "two"}, {"iii", "3", "three"}, {"iv", "4", "four"}, {"v", "5", "five"}, {"vi", "6", "six"},
	{"vii", "7", "seven"}, {"viii", "8", "eight"}, {"ix", "9", "nine"}, {"x", "10", "ten"},
}

// Aliases people actually type for well-known franchises (lower-case, normalised).
var aliases = map[string][]string{
	"grand theft auto":               {"gta"},
	"red dead redemption":            {"rdr"},
	"call of duty":                   {"cod"},
	"counter strike":                 {"cs", "csgo"},
	"counter strike 2":               {"cs2"},
	"battlefield":                    {"bf"},
	"ea sports fc":                   {"fifa", "fc"},
	"the elder scrolls":              {"tes"},
	"world of warcraft":              {"wow"},
	"assassin s creed":               {"ac"},
	"player unknown s battlegrounds": {"pubg"},
	"monster hunter":                 {"mh"},
	"final fantasy":                  {"ff"},
	"marvel s spider man":            {"spiderman", "spider man"},
	"microsoft flight simulator":     {"msfs"},
	"xbox game pass":                 {"gamepass", "game pass", "xgp"},
	"playstation plus":               {"ps plus", "psplus", "ps+"},
}

// Normalize lower-cases, strips accents and punctuation and collapses spaces: "Marvel's
// Spider-Man®" → "marvel s spider man".
func Normalize(s string) string {
	s = norm.NFD.String(strings.ToLower(s))
	var b strings.Builder
	for _, r := range s {
		if unicode.Is(unicode.Mn, r) { // drop combining accents
			continue
		}
		b.WriteRune(r)
	}
	s = strings.ReplaceAll(b.String(), "&", " and ")
	return strings.TrimSpace(nonWord.ReplaceAllString(s, " "))
}

// numeralVariants returns s with standalone Roman numerals turned into digits and vice versa.
func numeralVariants(s string) []string {
	words := strings.Fields(s)
	toDigit, toRoman := make([]string, len(words)), make([]string, len(words))
	changedD, changedR := false, false
	for i, w := range words {
		toDigit[i], toRoman[i] = w, w
		for _, r := range romans {
			if w == r.roman && i > 0 { // "v" alone at the start is a letter, not 5
				toDigit[i], changedD = r.digit, true
			}
			if w == r.digit || w == r.word {
				toRoman[i], changedR = r.roman, true
				if w == r.word {
					toDigit[i], changedD = r.digit, true
				}
			}
		}
	}
	var out []string
	if changedD {
		out = append(out, strings.Join(toDigit, " "))
	}
	if changedR {
		out = append(out, strings.Join(toRoman, " "))
	}
	return out
}

func acronym(words []string, skipStop bool) string {
	var b strings.Builder
	for _, w := range words {
		if skipStop && stopWords[w] {
			continue
		}
		r := []rune(w)
		if unicode.IsDigit(r[0]) {
			b.WriteString(w) // keep numbers: "red dead redemption 2" → "rdr2"
		} else {
			b.WriteRune(r[0])
		}
	}
	return b.String()
}

// Expand builds the stored search text for a product title.
func Expand(title string) string {
	full := Normalize(title)
	base := Normalize(strings.SplitN(editionTail.ReplaceAllString(title, ""), " - ", 2)[0])
	// Remove store/platform words from the end ("… Steam Key GLOBAL") to get the game name.
	words := strings.Fields(base)
	for len(words) > 1 && storeWords[words[len(words)-1]] {
		words = words[:len(words)-1]
	}
	name := strings.Join(words, " ")
	parts := []string{full, name}
	parts = append(parts, numeralVariants(name)...)
	// Acronyms of the main title (before a colon) and of the whole name, with and without "of/the".
	main := Normalize(strings.SplitN(editionTail.ReplaceAllString(title, ""), ":", 2)[0])
	for _, src := range []string{main, name} {
		ws := strings.Fields(src)
		if len(ws) >= 2 {
			for _, skip := range []bool{false, true} {
				a := acronym(ws, skip)
				if len(a) >= 2 {
					parts = append(parts, a)
					for _, v := range numeralVariants(spaceDigits(a)) {
						parts = append(parts, v, strings.ReplaceAll(v, " ", ""))
					}
				}
			}
		}
	}
	for phrase, as := range aliases {
		if strings.Contains(" "+name+" ", " "+phrase+" ") {
			rest := strings.TrimSpace(strings.Replace(" "+name+" ", " "+phrase+" ", " ", 1))
			for _, a := range as {
				parts = append(parts, strings.TrimSpace(a+" "+rest))
				for _, v := range numeralVariants(strings.TrimSpace(a + " " + rest)) {
					parts = append(parts, v, strings.ReplaceAll(v, " ", ""))
				}
			}
		}
	}
	seen := map[string]bool{}
	var uniq []string
	for _, p := range parts {
		if p = strings.TrimSpace(p); p != "" && !seen[p] {
			seen[p] = true
			uniq = append(uniq, p)
		}
	}
	return strings.Join(uniq, " | ")
}

// spaceDigits separates a trailing number from letters: "gta6" → "gta 6", "rdr2" → "rdr 2".
func spaceDigits(s string) string {
	for i, r := range s {
		if unicode.IsDigit(r) && i > 0 {
			return s[:i] + " " + s[i:]
		}
	}
	return s
}

// QueryVariants returns the normalised query plus numeral variants ("gta 6" → "gta 6",
// "gta vi"), and a form with the digit split off ("gta6" → "gta 6").
func QueryVariants(q string) []string {
	n := Normalize(q)
	if n == "" {
		return nil
	}
	out := []string{n}
	if sd := spaceDigits(n); sd != n && !strings.Contains(n, " ") {
		out = append(out, sd)
	}
	for _, base := range append([]string(nil), out...) {
		out = append(out, numeralVariants(base)...)
	}
	seen := map[string]bool{}
	var uniq []string
	for _, v := range out {
		if !seen[v] {
			seen[v] = true
			uniq = append(uniq, v)
		}
	}
	return uniq
}
