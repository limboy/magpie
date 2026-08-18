import { Circle, Square, Star, Triangle } from 'lucide-react'
import type { AudioMark } from '../../../../preload/soundbox'
import { cn } from '@/lib/utils'

export function AudioMarkIcon({
  mark,
  className
}: {
  mark: AudioMark | null
  className?: string
}): React.JSX.Element {
  const Icon =
    mark === 'triangle' ? Triangle : mark === 'circle' ? Circle : mark === 'square' ? Square : Star

  return <Icon className={cn(className, mark && 'fill-current')} aria-hidden="true" />
}
