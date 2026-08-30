import { Moon, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'

type ThemeMode = 'dark' | 'light'

const STORAGE_KEY = 'fraudshield-theme'

function getStoredTheme(): ThemeMode {
  const saved = window.localStorage.getItem(STORAGE_KEY)
  if (saved === 'light' || saved === 'dark') return saved

  const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches
  return prefersLight ? 'light' : 'dark'
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeMode>('dark')

  useEffect(() => {
    const initialTheme = getStoredTheme()
    setTheme(initialTheme)
    document.documentElement.dataset.theme = initialTheme
    document.documentElement.style.colorScheme = initialTheme
  }, [])

  function toggleTheme() {
    const nextTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(nextTheme)
    document.documentElement.dataset.theme = nextTheme
    document.documentElement.style.colorScheme = nextTheme
    window.localStorage.setItem(STORAGE_KEY, nextTheme)
  }

  return (
    <Button
      type="button"
      variant="secondary"
      size="icon"
      onClick={toggleTheme}
      aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
      title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
      className="border border-hairline bg-surface-2 text-ink-muted hover:text-ink"
    >
      {theme === 'dark' ? <Sun className="h-4 w-4" aria-hidden /> : <Moon className="h-4 w-4" aria-hidden />}
    </Button>
  )
}
