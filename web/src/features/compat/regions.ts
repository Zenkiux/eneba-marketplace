// Which countries each key region activates in — the same rules as api/internal/compat
// (RegionWorksIn). Based on the usual meaning of the labels; the product page states the region.

const EU_EEA = 'AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE IS LI NO CH'.split(' ')

const REGION_COUNTRIES: Record<string, string[]> = {
  europe: [...EU_EEA, 'GB'],
  'north-america': ['US', 'CA'],
  'united-kingdom': ['GB'],
  'latin-america': 'MX AR BR CL CO PE UY PY BO EC VE CR PA GT HN SV NI DO'.split(' '),
  turkey: ['TR'],
  argentina: ['AR'],
  brazil: ['BR'],
}

export function regionWorksIn(region: string, country: string): boolean {
  const c = country.trim().toUpperCase()
  if (!c || region === 'global' || !region) return true
  if (region === 'rest-of-world') return ![...(REGION_COUNTRIES.europe ?? []), 'US', 'CA'].includes(c)
  return (REGION_COUNTRIES[region] ?? []).includes(c)
}

export const COUNTRIES: { code: string; name: string }[] = [
  ['LT', 'Lithuania'], ['LV', 'Latvia'], ['EE', 'Estonia'], ['PL', 'Poland'], ['DE', 'Germany'], ['FR', 'France'],
  ['ES', 'Spain'], ['IT', 'Italy'], ['NL', 'Netherlands'], ['SE', 'Sweden'], ['FI', 'Finland'], ['DK', 'Denmark'],
  ['NO', 'Norway'], ['IE', 'Ireland'], ['PT', 'Portugal'], ['AT', 'Austria'], ['BE', 'Belgium'], ['CZ', 'Czechia'],
  ['GB', 'United Kingdom'], ['US', 'United States'], ['CA', 'Canada'], ['MX', 'Mexico'], ['BR', 'Brazil'],
  ['AR', 'Argentina'], ['TR', 'Turkey'], ['UA', 'Ukraine'], ['IN', 'India'], ['JP', 'Japan'], ['AU', 'Australia'],
].map(([code, name]) => ({ code: code!, name: name! }))
