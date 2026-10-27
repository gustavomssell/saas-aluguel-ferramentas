import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme()

  // SPA sem SSR: o tema já foi aplicado pelo script inline do index.html.
  const isDark = resolvedTheme === 'dark'

  return (
    <Button
      variant="outline"
      size="icon"
      className={cn('relative', className)}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={isDark ? 'Ativar tema claro' : 'Ativar tema escuro'}
      title={isDark ? 'Tema claro' : 'Tema escuro'}
    >
      <Sun className={cn('size-4 transition-transform', isDark ? 'scale-100' : 'scale-0')} />
      <Moon
        className={cn(
          'absolute inset-0 m-auto size-4 transition-transform',
          isDark ? 'scale-0' : 'scale-100',
        )}
      />
    </Button>
  )
}
