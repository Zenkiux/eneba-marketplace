package compat

import "testing"

func TestMatchGPUFromRendererStrings(t *testing.T) {
	cases := map[string]string{
		"ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Ti (0x00002489) Direct3D11 vs_5_0 ps_5_0, D3D11)":  "GeForce RTX 3060 Ti",
		"ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 (0x00002503) Direct3D11 vs_5_0 ps_5_0, D3D11)":     "GeForce RTX 3060",
		"ANGLE (AMD, AMD Radeon RX 6700 XT (0x000073DF) Direct3D11 vs_5_0 ps_5_0, D3D11)":          "Radeon RX 6700 XT",
		"ANGLE (Apple, ANGLE Metal Renderer: Apple M2 Pro, Unspecified Version)":                   "Apple M2 Pro",
		"ANGLE (Intel, Intel(R) Iris(R) Xe Graphics (0x00009A49) Direct3D11 vs_5_0 ps_5_0, D3D11)": "Intel Iris Xe",
		"Nvidia GeForce GTX 1060, 3GB": "GeForce GTX 1060 3GB",
	}
	for in, want := range cases {
		if g, ok := MatchGPU(in); !ok || g.Name != want {
			t.Errorf("MatchGPU(%q) = %v %v, want %s", in, g.Name, ok, want)
		}
	}
	if _, ok := MatchGPU("Apple GPU"); ok {
		t.Error("generic Safari renderer must not match a specific GPU")
	}
}

func TestParseEldenRingMinimum(t *testing.T) {
	l := ParseLevel(map[string]string{
		"System requirements": "Windows 10 64-bit", "Processor": "Intel Core i5-8400 | AMD Ryzen 3 3300X",
		"Memory": "12 GB RAM", "Graphics": "Nvidia GeForce GTX 1060, 3GB | AMD Radeon RX 580, 4GB", "Storage": "60 GB",
	})
	if l == nil || l.OS != "windows" || l.RAMGB != 12 || l.GPUScore != 3800 || l.CPUScore == 0 {
		t.Fatalf("parsed %+v", l)
	}
	strong := Device{OS: "windows", GPUScore: 8800, CPUScore: 1200, RAMGB: 16}
	if c := Compare(strong, l); !c.Meets {
		t.Fatalf("RTX 3060 PC should meet Elden Ring minimum: %+v", c)
	}
	weak := Device{OS: "windows", GPUScore: 1500, CPUScore: 600, RAMGB: 8}
	if c := Compare(weak, l); c.Meets || len(c.Short) != 3 {
		t.Fatalf("Iris Xe laptop with 8 GB should fail on gpu, cpu and ram: %+v", c)
	}
	mac := Device{OS: "mac", GPUScore: 9000, RAMGB: 32}
	if c := Compare(mac, l); c.Meets || c.Short[0] != "os" {
		t.Fatalf("Windows-only game on a Mac: %+v", c)
	}
	if c := Compare(Device{OS: "windows"}, l); !c.Meets {
		t.Fatal("unknown device parts must not count as failures")
	}
}

func TestCPUScoresAreOrdered(t *testing.T) {
	order := []string{"Intel Core 2 Duo E8400", "Intel Core i5-2500K", "AMD FX-8350", "Intel Core i5-8400", "AMD Ryzen 5 5600X", "Intel Core i7-12700K"}
	prev := 0
	for _, name := range order {
		s, ok := CPUScore(name)
		if !ok {
			t.Fatalf("%s not recognised", name)
		}
		if name != "AMD FX-8350" && s < prev {
			t.Errorf("%s (%d) should not score below the previous CPU (%d)", name, s, prev)
		}
		prev = s
	}
}

func TestRegions(t *testing.T) {
	cases := []struct {
		region, country string
		want            bool
	}{
		{"global", "LT", true}, {"europe", "LT", true}, {"europe", "US", false}, {"north-america", "US", true},
		{"north-america", "DE", false}, {"united-kingdom", "GB", true}, {"united-kingdom", "LT", false},
		{"latin-america", "MX", true}, {"rest-of-world", "LT", false}, {"rest-of-world", "IN", true}, {"europe", "", true},
	}
	for _, c := range cases {
		if got := RegionWorksIn(c.region, c.country); got != c.want {
			t.Errorf("RegionWorksIn(%s, %s) = %v", c.region, c.country, got)
		}
	}
}
