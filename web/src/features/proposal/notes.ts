// Explanations shown by 💡 markers when "Proposal notes" is on. Written for the Eneba team.

export interface Note {
  title: string
  problem: string
  solution: string
  how: string
  measure: string
}

export const NOTES: Record<string, Note> = {
  overview: {
    title: 'Proposal: “Will it work for me?”',
    problem:
      'On a key marketplace the most frustrating purchase is one the buyer can’t use: a key locked to another region, a key for a console they don’t own, or a game their PC can’t run. Each one costs a refund request, a support ticket and trust.',
    solution:
      'Tell buyers before they pay. One profile (country, PC, consoles) drives badges on cards, a “Works for me” store filter, a check on every product page and a warning in the cart. Like CYRI by System Requirements Lab, but inside the shop and without installing anything.',
    how: 'Country comes from Cloudflare (CF-IPCountry) or the browser language. The PC is read in the browser (WebGL GPU name, CPU cores, memory, OS) and can be corrected by hand. Requirements are parsed from each product’s official minimum/recommended specs into comparable scores (GPU table ≈ 3DMark Time Spy, CPU heuristic by brand/tier/generation). Filtering runs in SQL so counts and paging stay correct.',
    measure:
      'Refund/support tickets tagged “wrong region” or “can’t run”; conversion of visitors who set a profile vs. those who don’t; usage of the “Works for me” filter; share of cart warnings that lead to switching to another offer instead of abandoning.',
  },
  card: {
    title: 'Badge on every card',
    problem: 'Region and platform limits are written in small text in the title (“… Key EUROPE”), easy to miss when scanning a grid.',
    solution: 'A green “Works for you” or red “Won’t work” strip on each card once the buyer has a profile.',
    how: 'Cards already carry the region, platform and the minimum requirement scores; the verdict is computed in the browser with the same rules the API uses for filtering (unit-tested on both sides).',
    measure: 'Click-through on red-badged cards should fall; add-to-cart rate on green-badged ones should rise.',
  },
  filter: {
    title: '“Works for me” filter',
    problem: 'Browsing hundreds of listings that won’t work for you wastes time and leads to wrong purchases.',
    solution: 'One switch narrows the store to keys that activate in your country, are for a platform you own and that your PC can run.',
    how: 'Sent as query parameters (country, os, gpu, cpu, ram, consoles) to the existing products endpoint; the WHERE clause adds region and requirement conditions, so facets, totals and paging stay consistent.',
    measure: 'Filter usage, and refund rate of orders placed with the filter on vs. off.',
  },
  product: {
    title: 'Check on the product page',
    problem: 'Requirements are shown as raw text; buyers must know whether a “GTX 1060” is better than their card.',
    solution: 'Compare the buyer’s PC with the minimum and recommended requirements and say which part falls short.',
    how: 'Requirement text (“GTX 1060, 3GB | RX 580”) is parsed into scores; either listed alternative is enough, so the lowest one counts. Unknown values are shown as “unknown”, never as a failure.',
    measure: 'Support tickets about performance after purchase; time on page vs. purchase rate.',
  },
  detect: {
    title: 'Detection without installing anything',
    problem: 'CYRI-style tools need a download, which many buyers won’t do on a shop.',
    solution: 'Read what the browser already exposes, explain what was detected and let the buyer correct it.',
    how: 'WebGL renderer string → GPU table; hardwareConcurrency → CPU estimate; deviceMemory (Chromium, capped at 8 GB) → RAM floor; platform → OS. Nothing is stored on the server; the profile lives in localStorage.',
    measure: 'Share of detections where the GPU was recognised; how often buyers edit the detected values.',
  },
  cart: {
    title: 'Warning before paying',
    problem: 'The last chance to catch a wrong-region or wrong-platform key is checkout.',
    solution: 'Cart lines that won’t work get a clear warning and a link to choose another listing.',
    how: 'Same verdict function as the cards; no extra API calls.',
    measure: 'Lines removed or replaced after a warning; refunds for the same reasons.',
  },
}
