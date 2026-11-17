package seed

// Requirements for the fictional demo games, by price tier. PC platforms only; console keys and
// gift cards have none. Written in the same "key: value" form Eneba shows.
func demoRequirements(t title, v variant) (min, rec map[string]string) {
	switch v.Platform {
	case "steam", "gog", "epic":
	default:
		return nil, nil
	}
	if t.Type == "gift-card" || t.Type == "subscription" {
		return nil, nil
	}
	price := t.Variants[0].ListCents
	switch {
	case price >= 5999: // AAA
		min = map[string]string{
			"System requirements": "Windows 10 64-bit", "Processor": "Intel Core i5-8400 | AMD Ryzen 5 2600",
			"Memory": "16 GB RAM", "Graphics": "NVIDIA GeForce GTX 1070 | AMD Radeon RX 5600 XT", "Storage": "90 GB",
		}
		rec = map[string]string{
			"System requirements": "Windows 11 64-bit", "Processor": "Intel Core i7-10700K | AMD Ryzen 7 5800X",
			"Memory": "16 GB RAM", "Graphics": "NVIDIA GeForce RTX 3070 | AMD Radeon RX 6800", "Storage": "90 GB SSD",
		}
	case price >= 2999: // mid-range
		min = map[string]string{
			"System requirements": "Windows 10 64-bit", "Processor": "Intel Core i5-4590 | AMD FX-8350",
			"Memory": "8 GB RAM", "Graphics": "NVIDIA GeForce GTX 970 | AMD Radeon R9 290", "Storage": "40 GB",
		}
		rec = map[string]string{
			"System requirements": "Windows 10 64-bit", "Processor": "Intel Core i7-8700 | AMD Ryzen 5 3600",
			"Memory": "16 GB RAM", "Graphics": "NVIDIA GeForce RTX 2060 | AMD Radeon RX 5700", "Storage": "40 GB SSD",
		}
	default: // indie
		min = map[string]string{
			"System requirements": "Windows 10", "Processor": "Intel Core i3-6100 | AMD Ryzen 3 1200",
			"Memory": "4 GB RAM", "Graphics": "Intel UHD Graphics 620 | NVIDIA GeForce GTX 750 Ti", "Storage": "5 GB",
		}
		rec = map[string]string{
			"System requirements": "Windows 10", "Processor": "Intel Core i5-6600 | AMD Ryzen 5 1600",
			"Memory": "8 GB RAM", "Graphics": "NVIDIA GeForce GTX 1050 Ti | AMD Radeon RX 570", "Storage": "5 GB",
		}
	}
	return min, rec
}
