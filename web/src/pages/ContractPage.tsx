import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Download, Printer } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { api, ApiError, downloadFile } from '@/lib/api'
import type { ContractResponse } from '@/lib/types'
import { formatBRL, formatDay, formatNumber, formatWeight } from '@/lib/format'

export function ContractPage() {
  const { id } = useParams<{ id: string }>()
  const [downloading, setDownloading] = useState(false)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['contract', id],
    queryFn: () => api.get<ContractResponse>(`/rentals/${id}/contract`),
    enabled: Boolean(id),
  })

  if (isLoading) {
    return (
      <div className="mx-auto flex w-full max-w-[820px] flex-col gap-4 px-4 py-10">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-[900px] w-full" />
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-24 text-center">
        <p className="font-heading text-lg">Contrato indisponível</p>
        <p className="text-sm text-muted-foreground">A locação não foi encontrada ou você não tem acesso a ela.</p>
        <Button asChild variant="outline">
          <Link to="/locacoes">Voltar para locações</Link>
        </Button>
      </div>
    )
  }

  const { rental, organization, generatedAt } = data
  const org = organization
  const totalCharges = rental.finance.paidAmount + rental.finance.openAmount

  async function handleDownload() {
    if (!id) return
    setDownloading(true)
    try {
      const blob = await downloadFile(`/rentals/${id}/contract/pdf`)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `contrato-${rental.code}.pdf`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Falha ao gerar o PDF')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="min-h-screen bg-muted/40 py-6 print:bg-white print:py-0">
      <div className="no-print mx-auto mb-4 flex w-full max-w-[820px] items-center justify-between px-4">
        <Button asChild variant="ghost" size="sm">
          <Link to="/locacoes">
            <ArrowLeft data-icon="inline-start" />
            Voltar
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={handleDownload} disabled={downloading}>
            <Download data-icon="inline-start" />
            {downloading ? 'Gerando…' : 'Baixar PDF'}
          </Button>
          <Button size="sm" onClick={() => window.print()}>
            <Printer data-icon="inline-start" />
            Imprimir
          </Button>
        </div>
      </div>

      <article className="mx-auto w-full max-w-[820px] bg-white px-8 py-10 text-neutral-900 shadow-sm print:max-w-none print:px-0 print:py-0 print:shadow-none sm:px-12">
        <header className="flex flex-wrap items-start justify-between gap-6 border-b-2 border-neutral-900 pb-5">
          <div className="flex flex-col gap-1">
            <span className="font-heading text-xl font-semibold tracking-tight">{org?.name ?? 'Locadora'}</span>
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-neutral-500">
              locação de equipamentos
            </span>
            <span className="mt-2 text-[12px] leading-5 text-neutral-600">
              {org?.document ? `CNPJ ${org.document}` : 'CNPJ não informado'}
              {org?.city ? ` · ${org.city}` : ''}
              <br />
              {org?.phone ?? 'Telefone não informado'}
              {org?.email ? ` · ${org.email}` : ''}
            </span>
          </div>
          <div className="text-right">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-neutral-500">contrato</p>
            <p className="metric text-2xl font-semibold">{rental.code}</p>
            <p className="mt-1 font-mono text-[10px] text-neutral-500">emitido em {formatDay(generatedAt)}</p>
          </div>
        </header>

        <h1 className="mt-7 font-heading text-lg font-semibold uppercase tracking-[0.08em]">
          Contrato de locação de equipamentos
        </h1>

        <section className="mt-5 grid gap-6 sm:grid-cols-2">
          <div>
            <h2 className="label-caps text-[9px] text-neutral-500">Locadora</h2>
            <p className="mt-1 text-[13px] font-medium">{org?.name}</p>
            <p className="text-[12px] leading-5 text-neutral-600">
              {org?.document ? `CNPJ ${org.document}` : 'CNPJ não informado'}
              <br />
              {org?.city ?? 'Endereço não informado'}
              <br />
              {org?.phone ?? ''}
            </p>
          </div>
          <div>
            <h2 className="label-caps text-[9px] text-neutral-500">Locatário</h2>
            <p className="mt-1 text-[13px] font-medium">{rental.customer.name}</p>
            <p className="text-[12px] leading-5 text-neutral-600">
              {rental.customer.city ?? 'Cidade não informada'}
              {rental.customer.phone ? ` · ${rental.customer.phone}` : ''}
              <br />
              Obra: {rental.siteName ?? 'não informada'}
              <br />
              Período: {formatDay(rental.startsAt)} a {formatDay(rental.expectedReturnAt)} ({rental.days} dias)
            </p>
          </div>
        </section>

        <section className="mt-7">
          <h2 className="label-caps text-[9px] text-neutral-500">Equipamentos locados</h2>
          <table className="mt-2 w-full border-collapse text-[12px]">
            <thead>
              <tr className="border-y border-neutral-300 text-left">
                <th className="py-2 pr-2 font-medium">Código</th>
                <th className="py-2 pr-2 font-medium">Descrição</th>
                <th className="py-2 pr-2 text-right font-medium">Qtd.</th>
                <th className="py-2 pr-2 text-right font-medium">Peso</th>
                <th className="py-2 text-right font-medium">Total no período</th>
              </tr>
            </thead>
            <tbody>
              {rental.items.map((item) => (
                <tr key={item.id} className="border-b border-neutral-200">
                  <td className="py-2 pr-2 font-mono text-[11px] text-neutral-600">{item.code}</td>
                  <td className="py-2 pr-2">
                    {item.name}
                    <span className="block font-mono text-[10px] text-neutral-500">{item.categoryName}</span>
                  </td>
                  <td className="py-2 pr-2 text-right">{formatNumber(item.quantity)}</td>
                  <td className="py-2 pr-2 text-right">{formatWeight((item.weightKg ?? 0) * item.quantity)}</td>
                  <td className="py-2 text-right">{formatBRL(item.periodTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="mt-6 grid gap-6 sm:grid-cols-[1.4fr_1fr]">
          <div className="flex flex-col gap-3 text-[12px] leading-5 text-neutral-700">
            <h2 className="label-caps text-[9px] text-neutral-500">Condições</h2>
            <p>
              <strong className="font-medium text-neutral-900">1. Objeto.</strong> A locadora cede ao locatário, em regime
              de locação, os equipamentos descritos acima, destinados exclusivamente à obra indicada.
            </p>
            <p>
              <strong className="font-medium text-neutral-900">2. Prazo.</strong> O prazo contratado é de {rental.days}{' '}
              dias, contados de {formatDay(rental.startsAt)}. A prorrogação depende de disponibilidade e deve ser
              solicitada antes do vencimento.
            </p>
            <p>
              <strong className="font-medium text-neutral-900">3. Caução.</strong> A caução de{' '}
              {formatBRL(rental.depositAmount)} garante a conservação e a devolução dos equipamentos, sendo restituída
              após conferência de retorno, descontados eventuais danos ou faltas.
            </p>
            <p>
              <strong className="font-medium text-neutral-900">4. Devolução.</strong> O locatário devolve os
              equipamentos limpos e em condições de uso até {formatDay(rental.expectedReturnAt)}. Atrasos sujeitam-se à
              diária vigente e multa contratual.
            </p>
            <p>
              <strong className="font-medium text-neutral-900">5. Responsabilidade.</strong> O locatário responde por
              perda, furto, avaria ou mau uso, pelo valor de reposição de cada peça.
            </p>
          </div>

          <aside className="flex flex-col gap-2 self-start border border-neutral-300 p-4 text-[12px]">
            <h2 className="label-caps text-[9px] text-neutral-500">Resumo financeiro</h2>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-neutral-600">Locação ({rental.days} dias)</span>
              <span className="font-medium">{formatBRL(rental.periodTotal)}</span>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-neutral-600">Caução</span>
              <span className="font-medium">{formatBRL(rental.depositAmount)}</span>
            </div>
            <div className="flex items-baseline justify-between gap-3 border-t border-neutral-300 pt-2">
              <span className="font-medium">Total do contrato</span>
              <span className="text-base font-semibold">{formatBRL(rental.periodTotal + rental.depositAmount)}</span>
            </div>
            <div className="mt-1 flex flex-col gap-1 text-[10px] text-neutral-500">
              <span>Recebido: {formatBRL(rental.finance.paidAmount)}</span>
              <span>Em aberto: {formatBRL(rental.finance.openAmount)}</span>
              <span>
                Cobranças registradas: {formatBRL(totalCharges)} · peso {formatWeight(rental.totalWeightKg)}
              </span>
            </div>
          </aside>
        </section>

        <section className="mt-10 grid gap-8 sm:grid-cols-2">
          <div className="flex flex-col gap-8">
            <div className="border-t border-neutral-400 pt-2 text-center font-mono text-[10px] text-neutral-500">
              {org?.name}
              <br />
              Locadora
            </div>
          </div>
          <div className="flex flex-col gap-8">
            <div className="border-t border-neutral-400 pt-2 text-center font-mono text-[10px] text-neutral-500">
              {rental.customer.name}
              <br />
              Locatário
            </div>
          </div>
        </section>

        <footer className="mt-10 flex flex-wrap items-center justify-between gap-2 border-t border-neutral-200 pt-3 font-mono text-[9px] text-neutral-400">
          <span>
            {rental.code} · gerado em {formatDay(generatedAt)} pelo Canteiro
          </span>
          <span>Documento sem valor fiscal</span>
        </footer>
      </article>
    </div>
  )
}
