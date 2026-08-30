import { protocol } from 'electron'
import { createReadStream, promises as fs } from 'node:fs'
import { extname } from 'node:path'
import { Readable } from 'node:stream'
import { isAuthorizedPath } from './store'

export const LOCAL_SCHEME = 'local'

function toResponseBody(stream: ReturnType<typeof createReadStream>): ReadableStream<Uint8Array> {
  // Node's and Electron's TypeScript libraries expose equivalent WHATWG
  // ReadableStream types from different modules, so bridge them at this API
  // boundary while keeping the runtime stream conversion explicit.
  return Readable.toWeb(stream) as unknown as ReadableStream<Uint8Array>
}

export function registerLocalSchemePrivileged(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: LOCAL_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        stream: true,
        corsEnabled: true
      }
    }
  ])
}

function isAuthorized(absPath: string): boolean {
  return isAuthorizedPath(absPath)
}

export function registerLocalProtocolHandler(): void {
  protocol.handle(LOCAL_SCHEME, async (request) => {
    let absPath: string
    try {
      const prefix = `${LOCAL_SCHEME}://`
      let raw = decodeURIComponent(request.url.slice(prefix.length))
      if (!raw.startsWith('/') && process.platform !== 'win32') {
        raw = '/' + raw
      }
      if (process.platform === 'win32' && /^\/[A-Za-z]:/.test(raw)) {
        raw = raw.slice(1)
      }
      absPath = raw
    } catch (err) {
      console.error('[Protocol] Bad URL:', request.url, err)
      return new Response('Bad URL', { status: 400 })
    }

    if (!isAuthorized(absPath)) {
      console.warn('[Protocol] Forbidden access:', {
        absPath,
        url: request.url
      })
      return new Response('Forbidden', { status: 403 })
    }

    try {
      const stats = await fs.stat(absPath)
      if (!stats.isFile()) {
        return new Response('Not a file', { status: 404 })
      }

      const mimeMap: Record<string, string> = {
        '.mp3': 'audio/mpeg',
        '.m4a': 'audio/mp4',
        '.m4b': 'audio/mp4',
        '.flac': 'audio/flac',
        '.ogg': 'audio/ogg',
        '.wav': 'audio/wav'
      }

      const contentType = mimeMap[extname(absPath).toLowerCase()] || 'application/octet-stream'

      const rangeHeader = request.headers.get('range')
      if (rangeHeader) {
        const m = rangeHeader.match(/bytes=(\d+)-(\d+)?/)
        if (m) {
          const start = parseInt(m[1], 10)
          const requestedEnd = m[2] ? parseInt(m[2], 10) : stats.size - 1
          const end = Math.min(requestedEnd, stats.size - 1)

          if (start < stats.size && end >= start) {
            const stream = createReadStream(absPath, { start, end })
            // Adapt the Node stream explicitly. Passing fs.ReadStream directly
            // makes Electron/undici install its own adapter, which can try to
            // close the WHATWG stream twice when an audio request is cancelled
            // just as it reaches EOF while the next track starts.
            return new Response(toResponseBody(stream), {
              status: 206,
              statusText: 'Partial Content',
              headers: {
                'Content-Type': contentType,
                'Content-Range': `bytes ${start}-${end}/${stats.size}`,
                'Content-Length': (end - start + 1).toString(),
                'Accept-Ranges': 'bytes'
              }
            })
          }

          // The range parsed cleanly but cannot be satisfied (start past EOF,
          // or an inverted range). Say so instead of falling through to the
          // full-file response, which would re-send the whole track with a 200.
          return new Response('Range Not Satisfiable', {
            status: 416,
            statusText: 'Range Not Satisfiable',
            headers: {
              'Content-Range': `bytes */${stats.size}`,
              'Accept-Ranges': 'bytes'
            }
          })
        }
      }

      const stream = createReadStream(absPath)
      return new Response(toResponseBody(stream), {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Content-Length': stats.size.toString(),
          'Accept-Ranges': 'bytes'
        }
      })
    } catch (err) {
      console.error('[Protocol] File access failed:', absPath, err)
      return new Response('File access failed', { status: 500 })
    }
  })
}
