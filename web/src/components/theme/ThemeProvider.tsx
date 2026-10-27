import { useEffect } from 'react'
import { ThemeProvider as NextThemesProvider, useTheme } from 'next-themes'

const THEME_COLORS = {
  light: '#f3f0e7',
  dark: '#151610',
} as const

function ThemeColorSync() {
  const { resolvedTheme } = useTheme()

  useEffect(() => {
    const theme = resolvedTheme === 'dark' ? 'dark' : 'light'
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', THEME_COLORS[theme])
    document.documentElement.style.colorScheme = theme
  }, [resolvedTheme])

  return null
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      storageKey="canteiro.theme"
    >
      <ThemeColorSync />
      {children}
    </NextThemesProvider>
  )
}
