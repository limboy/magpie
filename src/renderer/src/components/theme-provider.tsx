import { useEffect, useState } from 'react'
import { ThemeProviderContext, type ResolvedTheme, type Theme } from '../hooks/use-theme'

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: Theme
  storageKey?: string
}

const getSystemTheme = (): ResolvedTheme =>
  window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'

export function ThemeProvider({
  children,
  defaultTheme = 'system',
  storageKey = 'soundbox-theme',
  ...props
}: ThemeProviderProps): React.JSX.Element {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem(storageKey) as Theme) || defaultTheme
  )
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() =>
    theme === 'system' ? getSystemTheme() : theme
  )

  useEffect(() => {
    const root = window.document.documentElement

    const applyTheme = (next: ResolvedTheme): void => {
      root.classList.remove('light', 'dark')
      root.classList.add(next)
      setResolvedTheme(next)
    }

    if (theme === 'system') {
      applyTheme(getSystemTheme())

      // Keep in sync if the OS-level appearance changes while the app is open.
      const media = window.matchMedia('(prefers-color-scheme: dark)')
      const handleChange = (): void => applyTheme(getSystemTheme())
      media.addEventListener('change', handleChange)
      return () => media.removeEventListener('change', handleChange)
    }

    applyTheme(theme)
    return undefined
  }, [theme])

  const value = {
    theme,
    resolvedTheme,
    setTheme: (theme: Theme) => {
      localStorage.setItem(storageKey, theme)
      setTheme(theme)
    }
  }

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}
