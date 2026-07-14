import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'
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
      size="icon"
      className="size-6 bg-blue-500 text-white hover:bg-blue-500 hover:text-white"
      disabled={applying}
      onClick={handleApply}
      aria-label={applying ? 'Applying update' : `Apply update ${updateVersion}`}
      title={applying ? 'Applying update…' : `Apply update ${updateVersion}`}
    >
      <Download className="size-3.5" />
    </Button>
  )
}
