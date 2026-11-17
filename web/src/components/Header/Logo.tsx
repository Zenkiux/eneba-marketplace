/** Our own wordmark (not Eneba's logo): a yellow key-tag mark and "keyshop" in Metropolis. */
export function Logo() {
  return (
    <svg width="152" height="40" viewBox="0 0 152 40" role="img" aria-hidden="true">
      <rect x="1" y="5" width="30" height="30" fill="var(--color-cta)" transform="rotate(-8 16 20)" />
      <circle cx="11" cy="15" r="3.5" fill="var(--color-bg-page)" />
      <path d="M13 17 L24 28 M20 24 L23 21 M17 21 L20 18" stroke="var(--color-bg-page)" strokeWidth="3" />
      <text x="40" y="29" fill="currentColor" fontFamily="Metropolis, Arial, sans-serif" fontWeight="800" fontSize="26">
        keyshop
      </text>
    </svg>
  )
}
