import { protocol } from 'electron'
import { createReadStream, promises as fs } from 'node:fs'
import { extname } from 'node:path'
import { isAuthorizedPath } from './store'

export const LOCAL_SCHEME = 'local'

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
          const end = m[2] ? parseInt(m[2], 10) : stats.size - 1

          if (start < stats.size) {
            const stream = createReadStream(absPath, { start, end })
            // @ts-ignore: ReadableStream and ReadStream are compatible here for Response body
            return new Response(stream, {
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
        }
      }

      const stream = createReadStream(absPath)
      // @ts-ignore: ReadableStream and ReadStream are compatible here for Response body
      return new Response(stream, {
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
