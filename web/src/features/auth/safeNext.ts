/** Only same-site paths are allowed as a redirect target after sign-in (no open redirects). */
export function safeNext(next: string | null): string {
  return next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\') ? next : '/'
}
