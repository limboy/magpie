import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'

export function UpdateIndicator(): React.JSX.Element | null {
  const [updateVersion, setUpdateVersion] = useState<string | null>(null)
  const [applying, setApplying] = useState(false)

  useEffect(() => {
    const off = window.soundbox.update.onUpdateReady((info) => {
      setUpdateVersion(info.version)
    })

    if (import.meta.env.DEV) {
      ;(
        window as unknown as { __triggerUpdatePreview?: (v?: string) => void }
      ).__triggerUpdatePreview = (version = '1.0.1') => {
        setUpdateVersion(version)
      }
    }

    return off
  }, [])

  if (!updateVersion) return null

  const handleApply = (): void => {
    setApplying(true)
    void window.soundbox.update.apply()
  }

  return (
    <Button
      size="xs"
      className="h-5 bg-blue-500 px-2 text-[11px] text-white hover:bg-blue-600 hover:text-white"
      disabled={applying}
      onClick={handleApply}
      aria-label={applying ? 'Applying update' : `Apply update ${updateVersion}`}
      title={applying ? 'Applying update…' : `Apply update ${updateVersion}`}
    >
      {applying ? 'Updating…' : 'Update'}
    </Button>
  )
}
