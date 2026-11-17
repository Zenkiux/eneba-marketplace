import { useSyncExternalStore } from 'react'

// Products this browser viewed, newest first (Eneba's "Recently viewed"). Kept in localStorage
// only; the homepage sends the slugs to the API to get live cards and recommendations.
const KEY = 'keyshop.viewed.v1'
const MAX = 12
const listeners = new Set<() => void>()
let cache: string[] | undefined

function read(): string[] {
  if (cache) return cache
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    cache = Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string').slice(0, MAX) : []
  } catch {
    cache = []
  }
  return cache
}

export function recordViewed(slug: string) {
  const next = [slug, ...read().filter((s) => s !== slug)].slice(0, MAX)
  cache = next
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // storage blocked: remember for this page view only
  }
  listeners.forEach((l) => l())
}

export function useViewed(): string[] {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    read,
    read,
  )
}
