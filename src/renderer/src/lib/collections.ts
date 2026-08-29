import { basename } from './audio-extensions'
import { useLibrary } from '@/store/library-store'
import type { TreeNode } from '../../../preload/soundbox'

// Walks a folder, collects every audio file under it, and turns the result into
// a collection named after the folder (which stays watched, so later additions
// show up). Returns null when the folder holds no audio — nothing to make a
// collection out of.
export async function createCollectionFromFolder(path: string): Promise<string | null> {
  const tree = await window.soundbox.readTree(path)
  const items: string[] = []
  const flatten = (node: TreeNode): void => {
    if (node.kind === 'audio') items.push(node.path)
    else node.children.forEach(flatten)
  }
  flatten(tree)
  if (items.length === 0) return null
  return useLibrary.getState().addCollectionWithItems(basename(path), items, [path])
}
