import { useEffect } from 'react'

const getSystemTheme = (): 'dark' | 'light' =>
  window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'

// Appearance always follows the OS — there is no in-app override to persist.
export function ThemeProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  useEffect(() => {
    const root = window.document.documentElement
    const applySystemTheme = (): void => {
      root.classList.remove('light', 'dark')
      root.classList.add(getSystemTheme())
    }

    applySystemTheme()
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    media.addEventListener('change', applySystemTheme)
    return () => media.removeEventListener('change', applySystemTheme)
  }, [])

  return <>{children}</>
}
