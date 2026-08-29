import { useEffect, useState } from 'react'
import { ArrowUpCircle } from 'lucide-react'

// Sits at the bottom of the collections sidebar and stays out of the way until
// an update is downloaded; the whole row is the apply button.
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
    <div className="shrink-0 border-t p-2">
      <button
        type="button"
        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-60"
        disabled={applying}
        onClick={handleApply}
        aria-label={applying ? 'Applying update' : `Apply update ${updateVersion}`}
        title={`Version ${updateVersion} is ready to install`}
      >
        <ArrowUpCircle className="size-3.5 shrink-0 text-blue-500" />
        <span className="min-w-0 flex-1 truncate">
          {applying ? 'Updating…' : `Update to ${updateVersion}`}
        </span>
      </button>
    </div>
  )
}
