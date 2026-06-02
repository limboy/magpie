import { useEffect, useState } from 'react'

// Covers are fetched once per path and memoised for the session so revisiting a
// track is instant. The main process handles disk caching and invalidation.
const cache = new Map<string, string | null>()

export function useCoverArt(path: string | null): string | null {
  // Re-render trigger fired once an async fetch resolves into the cache.
  const [, bump] = useState(0)

  useEffect(() => {
    if (!path || cache.has(path)) return

    let cancelled = false
    window.soundbox
      .getCoverArt(path)
      .then((u) => {
        cache.set(path, u)
        if (!cancelled) bump((n) => n + 1)
      })
      .catch(() => {
        cache.set(path, null)
        if (!cancelled) bump((n) => n + 1)
      })

    return () => {
      cancelled = true
    }
  }, [path])

  return path ? (cache.get(path) ?? null) : null
}
