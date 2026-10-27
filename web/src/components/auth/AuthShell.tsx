import type { ReactNode } from 'react'
import { Ruler } from 'lucide-react'
import { ThemeToggle } from '@/components/theme/ThemeToggle'

function RulerEdge() {
  return (
    <div className="pointer-events-none absolute inset-y-0 left-0 hidden w-14 flex-col justify-between border-r border-white/10 py-6 md:flex" aria-hidden>
      {Array.from({ length: 32 }).map((_, index) => (
        <span
          key={index}
          className={index % 4 === 0 ? 'h-px w-8 bg-primary/70' : 'h-px w-4 bg-white/20'}
        />
      ))}
    </div>
  )
}

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <section className="relative hidden flex-col justify-between overflow-hidden bg-sidebar p-10 lg:flex">
        <RulerEdge />
        <div className="relative flex items-center gap-3 pl-10">
          <span className="flex size-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Ruler className="size-5" strokeWidth={2.4} />
          </span>
          <div className="flex flex-col leading-none">
            <span className="label-caps text-base text-sidebar-foreground">Canteiro</span>
            <span className="font-mono text-[10px] text-sidebar-foreground/55">locação de equipamentos</span>
          </div>
        </div>

        <div className="relative pl-10">
          <p className="label-caps text-[11px] text-primary">Pátio, obra e contrato no mesmo lugar</p>
          <h1 className="mt-4 max-w-md font-heading text-4xl leading-[1.05] text-sidebar-foreground">
            Cada peça contada. Cada prazo sob controle.
          </h1>
          <p className="mt-5 max-w-sm text-sm leading-relaxed text-sidebar-foreground/70">
            Do montador de kits por altura e metragem à timeline de disponibilidade do galpão — sem
            planilha paralela.
          </p>
          <dl className="mt-10 grid max-w-md grid-cols-3 gap-px overflow-hidden rounded-md border border-white/10 bg-white/5">
            {[
              { value: '17', label: 'linhas de catálogo' },
              { value: '1.263', label: 'peças rastreadas' },
              { value: '5', label: 'status de locação' },
            ].map((item) => (
              <div key={item.label} className="bg-sidebar/60 px-3 py-4">
                <dt className="label-caps text-[9px] text-sidebar-foreground/50">{item.label}</dt>
                <dd className="metric mt-1 text-xl text-sidebar-foreground">{item.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <p className="relative pl-10 font-mono text-[10px] text-sidebar-foreground/40">
          dados de demonstração · Locadora Horizonte
        </p>
      </section>

      <section className="relative flex items-center justify-center bg-background px-5 py-12 sm:px-10">
        <ThemeToggle className="absolute right-5 top-5" />
        <div className="w-full max-w-sm">{children}</div>
      </section>
    </div>
  )
}
