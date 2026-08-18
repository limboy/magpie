import type { AudioMark } from '../../../preload/soundbox'

export const AUDIO_MARKS: AudioMark[] = ['star', 'triangle', 'circle', 'square']

export function nextAudioMark(mark: AudioMark | null): AudioMark | null {
  if (mark === null) return AUDIO_MARKS[0]
  const index = AUDIO_MARKS.indexOf(mark)
  return index === AUDIO_MARKS.length - 1 ? null : AUDIO_MARKS[index + 1]
}

export function audioMarkLabel(mark: AudioMark | null): string {
  if (mark === null) return 'Unmarked'
  return mark[0].toUpperCase() + mark.slice(1)
}
