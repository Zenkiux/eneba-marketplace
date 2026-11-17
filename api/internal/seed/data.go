package seed

// All catalog data below is fictional demo data: invented game titles, studios, sellers and
// ratings. Platform names describe where a key would be activated. Nothing here is a real product.

type named struct{ Slug, Name string }

var platforms = []named{
	{"steam", "Steam"}, {"xbox", "Xbox Live"}, {"psn", "PlayStation Network"},
	{"nintendo", "Nintendo eShop"}, {"gog", "GOG.com"}, {"epic", "Epic Games"}, {"keyshop", "keyshop"},
}

var regions = []named{
	{"global", "Global"}, {"europe", "Europe"}, {"north-america", "North America"}, {"united-kingdom", "United Kingdom"},
}

var productTypes = []named{
	{"game", "Game"}, {"dlc", "DLC"}, {"gift-card", "Gift card"}, {"subscription", "Subscription"}, {"software", "Software"},
}

type seller struct {
	Slug, Name string
	Rating     float64
	Count      int
	Verified   bool
}

var sellers = []seller{
	{"pixelvault", "PixelVault", 9.83, 48210, true},
	{"keyharbor", "KeyHarbor", 9.71, 30544, true},
	{"flashdealz", "FlashDealz", 9.68, 21980, false},
	{"nordic-keys", "Nordic Keys", 9.52, 12007, true},
	{"bytebazaar", "ByteBazaar", 9.34, 8650, false},
	{"lootlane", "LootLane", 9.12, 5233, false},
	{"gamegrid", "GameGrid", 8.87, 2961, false},
	{"quickcode", "QuickCode", 8.41, 1104, false},
}

// variant = one sellable listing of a title: platform, region, price, popularity.
type variant struct {
	Platform, Region string
	ListCents        int64
	Popularity       int
}

type title struct {
	Slug, Name, Type, Developer, Publisher, Release string
	Genres                                          []string
	Description                                     string
	Variants                                        []variant
}

var titles = []title{
	{"starfall-odyssey", "Starfall Odyssey", "game", "Lumen Forge", "Northlight Interactive", "2025-03-14",
		[]string{"Action", "RPG", "Open world"},
		"Chart a course through a shattered star system in this open-world action RPG. Build your crew, upgrade a living starship and decide the fate of twelve rival colonies.",
		[]variant{{"steam", "global", 5999, 980}, {"xbox", "europe", 6999, 640}, {"psn", "europe", 6999, 610}}},
	{"neon-drift-racing", "Neon Drift Racing", "game", "Overclock Studio", "Overclock Studio", "2024-09-02",
		[]string{"Racing", "Arcade"},
		"Arcade street racing through a rain-soaked megacity. 60 tuneable cars, split-screen and weekly online cups.",
		[]variant{{"steam", "global", 2999, 720}, {"nintendo", "europe", 3999, 300}}},
	{"hollow-crown", "Hollow Crown: Ashes of the Realm", "game", "Greyward Games", "Ironbark Publishing", "2025-06-20",
		[]string{"RPG", "Souls-like", "Fantasy"},
		"A demanding dark-fantasy action RPG. Reclaim a fallen kingdom one boss at a time, forge cursed weapons and uncover what burned the crown.",
		[]variant{{"steam", "global", 4999, 930}, {"psn", "north-america", 5999, 420}, {"xbox", "global", 5999, 380}}},
	{"iron-tide-tactics", "Iron Tide Tactics", "game", "Bastion Labs", "Bastion Labs", "2023-11-08",
		[]string{"Strategy", "Turn-based"},
		"Turn-based naval strategy across a procedurally generated archipelago. Command fleets, manage supply lines and outthink up to seven rivals.",
		[]variant{{"steam", "global", 3499, 410}, {"gog", "global", 3499, 160}}},
	{"pixel-pioneers", "Pixel Pioneers", "game", "Tiny Lantern", "Tiny Lantern", "2022-04-21",
		[]string{"Sandbox", "Indie", "Co-op"},
		"A cosy co-op sandbox: dig, build and automate a frontier town with up to four friends.",
		[]variant{{"steam", "global", 1999, 860}, {"nintendo", "global", 2499, 450}}},
	{"frostbound", "Frostbound", "game", "Polar Night Studio", "Polar Night Studio", "2024-01-30",
		[]string{"Survival", "Crafting"},
		"Survive an endless winter. Scavenge, build heated shelters and keep your settlement alive through blizzards and worse.",
		[]variant{{"steam", "global", 2499, 690}, {"steam", "europe", 2299, 210}}},
	{"velvet-heist", "Velvet Heist", "game", "Silk Road Games", "Crescent Media", "2025-02-11",
		[]string{"Stealth", "Co-op", "Action"},
		"Plan and pull off stylish casino heists in 1970s Monaco. Every crew member brings a different way in — and out.",
		[]variant{{"steam", "global", 3999, 570}, {"xbox", "north-america", 4999, 260}, {"psn", "europe", 4999, 300}}},
	{"echoes-of-aether", "Echoes of Aether", "game", "Lumen Forge", "Northlight Interactive", "2021-10-05",
		[]string{"Adventure", "Puzzle", "Story rich"},
		"A hand-painted adventure about a lighthouse keeper who can hear the past. Solve resonance puzzles to rebuild forgotten memories.",
		[]variant{{"steam", "global", 1499, 380}, {"gog", "global", 1499, 120}, {"epic", "global", 1499, 90}}},
	{"kingdom-forge-2", "Kingdom Forge 2", "game", "Ironbark Studios", "Ironbark Publishing", "2024-05-16",
		[]string{"Strategy", "City builder", "Medieval"},
		"Grow a hamlet into a medieval capital. Deeper economy, dynasties and real-time sieges in the sequel to the city-building favourite.",
		[]variant{{"steam", "global", 3999, 760}, {"steam", "united-kingdom", 3799, 140}}},
	{"shadow-protocol", "Shadow Protocol: Black Sky", "game", "Vector Nine", "Crescent Media", "2025-10-24",
		[]string{"Shooter", "Multiplayer", "Tactical"},
		"Tactical first-person shooter with destructible maps, 5v5 ranked play and a 12-mission story campaign.",
		[]variant{{"steam", "global", 6999, 990}, {"xbox", "global", 6999, 700}, {"psn", "global", 6999, 720}}},
	{"tiny-farm-valley", "Tiny Farm Valley", "game", "Meadowlight", "Meadowlight", "2023-03-09",
		[]string{"Simulation", "Farming", "Relaxing"},
		"Inherit a run-down farm, befriend the valley and grow it into something special at your own pace.",
		[]variant{{"steam", "global", 1499, 880}, {"nintendo", "europe", 1999, 520}, {"xbox", "europe", 1999, 210}}},
	{"abyssal-depths", "Abyssal Depths", "game", "Pressure Point", "Deepwater Games", "2024-08-27",
		[]string{"Horror", "Exploration"},
		"Descend into an abandoned deep-sea research station. Manage oxygen, light and sanity as something follows you down.",
		[]variant{{"steam", "global", 2799, 470}, {"psn", "europe", 3499, 230}}},
	{"galactic-trade-union", "Galactic Trade Union", "game", "Orbital Ledger", "Orbital Ledger", "2022-12-01",
		[]string{"Simulation", "Space", "Economy"},
		"Run an interstellar trading company: plot routes, speculate on commodities and outmanoeuvre rival corporations.",
		[]variant{{"steam", "global", 2499, 330}, {"gog", "global", 2499, 110}}},
	{"skyline-architect", "Skyline Architect", "game", "Blueprint Collective", "Blueprint Collective", "2025-04-03",
		[]string{"City builder", "Simulation"},
		"Design a modern metropolis from the ground up with realistic traffic, zoning and public transport.",
		[]variant{{"steam", "global", 3499, 540}, {"epic", "global", 3499, 140}}},
	{"wildfang-legends", "Wildfang Legends", "game", "Ember Peak", "Ironbark Publishing", "2023-07-18",
		[]string{"Action", "Adventure", "Open world"},
		"Ride, hunt and explore a vast frontier with your wolf companion in this open-world adventure.",
		[]variant{{"steam", "global", 3999, 610}, {"xbox", "europe", 4499, 330}, {"psn", "north-america", 4499, 290}}},
	{"moonlit-detective", "Moonlit Detective Agency", "game", "Inkwell & Co", "Inkwell & Co", "2024-10-31",
		[]string{"Mystery", "Adventure", "Story rich"},
		"Solve twelve interlinked cases in a noir city where every witness lies a little. Your deductions change the story.",
		[]variant{{"steam", "global", 1999, 290}, {"nintendo", "global", 2499, 180}}},
	{"thunder-arena-football-27", "Thunder Arena Football 27", "game", "Pitchside Interactive", "Pitchside Interactive", "2026-09-26",
		[]string{"Sports", "Multiplayer"},
		"Arcade-style football with fully customisable clubs, online leagues and a ten-season career mode.",
		[]variant{{"steam", "europe", 6999, 950}, {"psn", "europe", 7999, 900}, {"xbox", "europe", 7999, 820}}},
	{"dust-and-revolver", "Dust & Revolver", "game", "High Noon Works", "Crescent Media", "2022-06-14",
		[]string{"Action", "Western", "Shooter"},
		"A fast, stylish western shooter. Duel outlaws, defend a frontier town and chase a bounty across five territories.",
		[]variant{{"steam", "global", 1999, 430}, {"xbox", "global", 2499, 200}}},
	{"mecha-vanguard-zero", "Mecha Vanguard Zero", "game", "Steel Lotus", "Steel Lotus", "2027-02-18",
		[]string{"Action", "Mecha"},
		"Pre-order: pilot customisable mechs in high-speed arena battles and a branching story campaign. Keys are delivered now and unlock on release day.",
		[]variant{{"steam", "global", 5999, 670}, {"psn", "global", 6999, 590}}},
	{"quantum-puzzle-lab", "Quantum Puzzle Lab", "game", "Small Constant", "Small Constant", "2021-02-25",
		[]string{"Puzzle", "Indie"},
		"Physics puzzles where objects exist in two states at once. 120 hand-made chambers and a level editor.",
		[]variant{{"steam", "global", 999, 260}, {"gog", "global", 999, 80}}},
	{"crimson-samurai", "Crimson Samurai Chronicles", "game", "Red Lantern", "Ironbark Publishing", "2027-05-07",
		[]string{"Action", "Samurai", "Open world"},
		"Pre-order: an open-world samurai epic set in a mythical feudal island. Keys unlock on release day.",
		[]variant{{"steam", "global", 6999, 870}, {"xbox", "global", 6999, 520}}},
	{"coral-kingdom", "Coral Kingdom", "game", "Bluefin Studio", "Deepwater Games", "2025-08-12",
		[]string{"Adventure", "Exploration", "Relaxing"},
		"Explore and restore a vibrant reef kingdom, befriend sea creatures and uncover an ancient underwater city.",
		[]variant{{"nintendo", "global", 2999, 410}, {"steam", "global", 2499, 260}}},
	// DLC
	{"starfall-odyssey-void-expansion", "Starfall Odyssey: Void Expansion", "dlc", "Lumen Forge", "Northlight Interactive", "2025-11-04",
		[]string{"Action", "RPG", "Expansion"},
		"Expansion for Starfall Odyssey (base game required): a new star cluster, a 20-hour storyline and two new ship classes.",
		[]variant{{"steam", "global", 2499, 450}}},
	{"hollow-crown-season-pass", "Hollow Crown: Season Pass", "dlc", "Greyward Games", "Ironbark Publishing", "2025-06-20",
		[]string{"RPG", "Season pass"},
		"Includes all three upcoming story expansions for Hollow Crown: Ashes of the Realm (base game required).",
		[]variant{{"steam", "global", 2999, 380}, {"psn", "north-america", 2999, 150}}},
	// Gift cards / subscription (our own fictional store products)
	{"keyshop-gift-card-10", "keyshop Gift Card 10 EUR", "gift-card", "keyshop", "keyshop", "2024-01-01",
		[]string{"Gift card"}, "Top up your keyshop balance by 10 EUR. Demo product.",
		[]variant{{"keyshop", "global", 1000, 500}}},
	{"keyshop-gift-card-25", "keyshop Gift Card 25 EUR", "gift-card", "keyshop", "keyshop", "2024-01-01",
		[]string{"Gift card"}, "Top up your keyshop balance by 25 EUR. Demo product.",
		[]variant{{"keyshop", "global", 2500, 420}}},
	{"arcadia-pass-3-months", "Arcadia Pass 3 Months", "subscription", "Arcadia", "Arcadia", "2023-05-01",
		[]string{"Subscription"}, "Three months of the fictional Arcadia game-library subscription. Demo product.",
		[]variant{{"keyshop", "global", 2999, 350}}},
}

type bannerSeed struct {
	Slot, Title, Subtitle, Image, CTALabel, CTAHref string
}

var banners = []bannerSeed{
	{"main", "Crimson Samurai Chronicles", "Pre-order now and get the key before launch day", "/banners/crimson-samurai.jpg", "Pre-order", "/store?q=crimson+samurai"},
	{"main", "Winter Sale: up to -60%", "Hundreds of keys from trusted sellers", "/banners/winter-sale.jpg", "See the deals", "/store?sort=discount"},
	{"side", "Shadow Protocol: Black Sky", "From top-rated sellers", "/banners/shadow-protocol.jpg", "Buy now", "/store?q=shadow+protocol"},
	{"side", "Cosy games under 20 EUR", "Farming, puzzles and more", "/banners/cosy-games.jpg", "Browse", "/store?max_price=2000&sort=popular"},
	{"side", "keyshop Gift Cards", "The easy gift for any gamer", "/banners/gift-cards.jpg", "Shop gift cards", "/store?type=gift-card"},
}

type sectionSeed struct {
	Key, Type, Title string
	Config           string // JSON
}

// Homepage layout in display order. Edit these rows in the database to change the homepage.
var sections = []sectionSeed{
	{"hero", "banner", "", `{}`},
	{"categories", "category_strip", "", `{}`},
	{"recently-viewed", "recently_viewed", "Recently viewed", `{"limit": 10, "titles": {"lt": "Neseniai peržiūrėti", "de": "Zuletzt angesehen", "pl": "Ostatnio oglądane"}}`},
	{"recommended", "recommended", "Recommended for you", `{"limit": 10, "more": "/store?sort=popular", "titles": {"lt": "Rekomenduojama jums", "de": "Für dich empfohlen", "pl": "Polecane dla Ciebie"}}`},
	{"top-games", "bestsellers", "Top games", `{"limit": 10, "type": "game", "more": "/store?type=game&sort=popular", "titles": {"lt": "Populiariausi žaidimai", "de": "Top-Spiele", "pl": "Najpopularniejsze gry"}}`},
	{"deals", "deals", "Best deals right now", `{"limit": 10, "more": "/store?sort=discount", "titles": {"lt": "Geriausi pasiūlymai dabar", "de": "Die besten Angebote", "pl": "Najlepsze okazje teraz"}}`},
	{"new-releases", "new_releases", "New releases", `{"limit": 10, "more": "/store?sort=newest", "titles": {"lt": "Naujienos", "de": "Neuerscheinungen", "pl": "Nowości"}}`},
	{"gift-cards", "bestsellers", "Best selling gift cards", `{"limit": 10, "type": "gift-card", "more": "/store?type=gift-card", "titles": {"lt": "Perkamiausios dovanų kortelės", "de": "Meistverkaufte Geschenkkarten", "pl": "Najlepiej sprzedające się karty podarunkowe"}}`},
	{"upcoming", "upcoming", "Upcoming games", `{"limit": 10, "titles": {"lt": "Greitai pasirodysiantys žaidimai", "de": "Kommende Spiele", "pl": "Nadchodzące gry"}}`},
	{"genres", "genres", "Categories", `{"limit": 12, "titles": {"lt": "Kategorijos", "de": "Kategorien", "pl": "Kategorie"}}`},
}
