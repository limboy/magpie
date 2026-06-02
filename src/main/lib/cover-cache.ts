import { app } from 'electron'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises'
import { parseFile } from 'music-metadata'

// Embedded cover art is extracted lazily, then cached on disk (keyed by path +
// mtime + size so it self-invalidates when a file changes) and in memory for
// the lifetime of the process. Covers are returned to the renderer as data URLs.

const memCache = new Map<string, string | null>()

function coversDir(): string {
  return join(app.getPath('userData'), 'covers')
}

export async function getCoverArt(path: string): Promise<string | null> {
  let s: Awaited<ReturnType<typeof stat>>
  try {
    s = await stat(path)
  } catch {
    return null
  }

  const key = createHash('sha1').update(`${path}:${s.mtimeMs}:${s.size}`).digest('hex')
  if (memCache.has(key)) return memCache.get(key) ?? null

  const dir = coversDir()
  const metaPath = join(dir, `${key}.json`)
  const binPath = join(dir, `${key}.bin`)

  // Disk cache hit
  try {
    const meta = JSON.parse(await readFile(metaPath, 'utf8')) as { mime?: string; empty?: boolean }
    if (meta.empty) {
      memCache.set(key, null)
      return null
    }
    const buf = await readFile(binPath)
    const dataUrl = `data:${meta.mime};base64,${buf.toString('base64')}`
    memCache.set(key, dataUrl)
    return dataUrl
  } catch {
    // fall through and parse the file
  }

  try {
    const meta = await parseFile(path, { duration: false })
    const pic = meta.common.picture?.[0]
    await mkdir(dir, { recursive: true })

    if (!pic) {
      await writeFile(metaPath, JSON.stringify({ empty: true }))
      memCache.set(key, null)
      return null
    }

    const mime = pic.format || 'image/jpeg'
    const data = Buffer.from(pic.data)
    await writeFile(binPath, data)
    await writeFile(metaPath, JSON.stringify({ mime }))

    const dataUrl = `data:${mime};base64,${data.toString('base64')}`
    memCache.set(key, dataUrl)
    return dataUrl
  } catch {
    memCache.set(key, null)
    return null
  }
}
