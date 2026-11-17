/** Eneba-style wording for a 0–10 seller rating (our ratings are synthetic demo data). */
export function ratingLabel(r: number): string {
  if (r >= 9.8) return 'Superb'
  if (r >= 9.5) return 'Excellent'
  if (r >= 9) return 'Very good'
  if (r >= 8) return 'Good'
  return 'Fair'
}
