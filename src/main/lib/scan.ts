import type { Dirent } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'

export const AUDIO_EXTS = new Set(['.mp3', '.m4a', '.m4b', '.flac', '.ogg', '.wav'])

export type TreeNode =
  | { kind: 'dir'; name: string; path: string; children: TreeNode[] }
  | { kind: 'audio'; name: string; path: string }

const IGNORE = new Set(['.DS_Store', 'Thumbs.db', '.git', 'node_modules', '.Trash'])

export async function readTree(root: string): Promise<TreeNode> {
  const name = basename(root) || root
  const rootNode: TreeNode = { kind: 'dir', name, path: root, children: [] }
  await walk(rootNode, 0)
  return rootNode
}

async function walk(node: Extract<TreeNode, { kind: 'dir' }>, depth: number): Promise<void> {
  if (depth > 12) return
  let entries: Dirent[] = []
  try {
    entries = (await readdir(node.path, { withFileTypes: true })) as Dirent[]
  } catch {
    return
  }
  entries.sort((a, b) => {
    if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1
    return a.name.localeCompare(b.name, undefined, {
      numeric: true,
      sensitivity: 'base'
    })
  })
  for (const entry of entries) {
    if (IGNORE.has(entry.name)) continue
    if (entry.name.startsWith('.')) continue
    const fullPath: string = join(node.path, entry.name)
    if (entry.isDirectory()) {
      const child: TreeNode = { kind: 'dir', name: entry.name, path: fullPath, children: [] }
      await walk(child, depth + 1)
      if (child.children.length > 0) node.children.push(child)
    } else if (entry.isFile()) {
      const ext: string = extname(entry.name).toLowerCase()
      if (AUDIO_EXTS.has(ext)) {
        node.children.push({ kind: 'audio', name: entry.name, path: fullPath })
      }
    }
  }
}

export function flattenAudio(node: TreeNode): Array<Extract<TreeNode, { kind: 'audio' }>> {
  const out: Array<Extract<TreeNode, { kind: 'audio' }>> = []
  const visit = (n: TreeNode): void => {
    if (n.kind === 'audio') out.push(n)
    else n.children.forEach(visit)
  }
  visit(node)
  return out
}
