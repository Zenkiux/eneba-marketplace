package search

import (
	"strings"
	"testing"
)

func TestNormalize(t *testing.T) {
	for in, want := range map[string]string{
		"Marvel's Spider-Man® Remastered": "marvel s spider man remastered",
		"  Pokémon  Scarlet ":             "pokemon scarlet",
		"Dust & Revolver":                 "dust and revolver",
	} {
		if got := Normalize(in); got != want {
			t.Errorf("Normalize(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestExpandFindsCommonNames(t *testing.T) {
	cases := map[string][]string{
		"Grand Theft Auto VI (PS5) PSN Key EUROPE":                      {"gta vi", "gta 6", "gta6", "grand theft auto 6"},
		"Grand Theft Auto V Rockstar Games Launcher Key GLOBAL":         {"gta v", "gta 5", "gta5"},
		"Red Dead Redemption 2 PC Rockstar Key GLOBAL":                  {"rdr2", "rdr 2", "rdr ii"},
		"Call of Duty: Modern Warfare 4 (Windows) XBOX LIVE Key GLOBAL": {"cod", "cod modern warfare 4"},
		"Counter-Strike 2 Prime Status Upgrade Steam Key GLOBAL":        {"cs2"},
	}
	for title, wants := range cases {
		text := " | " + Expand(title) + " | "
		for _, w := range wants {
			if !strings.Contains(text, w) {
				t.Errorf("Expand(%q) lacks %q:\n%s", title, w, text)
			}
		}
	}
}

func TestQueryVariants(t *testing.T) {
	got := strings.Join(QueryVariants("GTA6"), ",")
	for _, want := range []string{"gta6", "gta 6", "gta vi"} {
		if !strings.Contains(got, want) {
			t.Errorf("QueryVariants(GTA6) = %s, missing %q", got, want)
		}
	}
	if v := QueryVariants("  "); v != nil {
		t.Errorf("empty query should have no variants: %v", v)
	}
	if v := QueryVariants("V Rising"); strings.Contains(strings.Join(v, ","), "5 rising") {
		t.Errorf("a leading V is a letter: %v", v)
	}
}
