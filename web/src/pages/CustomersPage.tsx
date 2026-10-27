import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { MoreHorizontal, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'
import { api, ApiError } from '@/lib/api'
import type { Customer } from '@/lib/types'
import { formatNumber } from '@/lib/format'

type CustomerForm = {
  name: string
  document: string
  contactName: string
  phone: string
  email: string
  siteAddress: string
  city: string
  notes: string
}

const emptyForm: CustomerForm = {
  name: '',
  document: '',
  contactName: '',
  phone: '',
  email: '',
  siteAddress: '',
  city: '',
  notes: '',
}

function CustomerMenu({
  customer,
  onEdit,
  onDelete,
}: {
  customer: Customer
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8" aria-label={`Ações de ${customer.name}`}>
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onEdit}>
          <Pencil className="size-4" />
          Editar cliente
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onSelect={onDelete}>
          <Trash2 className="size-4" />
          Remover
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function CustomersPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Customer | null>(null)
  const [form, setForm] = useState<CustomerForm>(emptyForm)

  function openDialog(customer: Customer | null) {
    setEditing(customer)
    setForm(
      customer
        ? {
            name: customer.name,
            document: customer.document ?? '',
            contactName: customer.contactName ?? '',
            phone: customer.phone ?? '',
            email: customer.email ?? '',
            siteAddress: customer.siteAddress ?? '',
            city: customer.city ?? '',
            notes: customer.notes ?? '',
          }
        : emptyForm,
    )
    setDialogOpen(true)
  }

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ['customers'],
    queryFn: () => api.get<Customer[]>('/customers'),
  })

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return customers
    return customers.filter(
      (customer) =>
        customer.name.toLowerCase().includes(term) ||
        (customer.city ?? '').toLowerCase().includes(term) ||
        (customer.contactName ?? '').toLowerCase().includes(term),
    )
  }, [customers, search])

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        name: form.name.trim(),
        document: form.document.trim() || null,
        contactName: form.contactName.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        siteAddress: form.siteAddress.trim() || null,
        city: form.city.trim() || null,
        notes: form.notes.trim() || null,
      }
      return editing ? api.patch(`/customers/${editing.id}`, payload) : api.post('/customers', payload)
    },
    onSuccess: () => {
      toast.success(editing ? 'Cliente atualizado' : 'Cliente cadastrado')
      void queryClient.invalidateQueries({ queryKey: ['customers'] })
      setDialogOpen(false)
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Falha ao salvar cliente'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/customers/${id}`),
    onSuccess: () => {
      toast.success('Cliente removido')
      void queryClient.invalidateQueries({ queryKey: ['customers'] })
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Falha ao remover cliente'),
  })

  function update(field: keyof CustomerForm) {
    return (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((current) => ({ ...current, [field]: event.target.value }))
  }

  return (
    <AppShell
      title="Clientes e obras"
      subtitle={`${filtered.length} cliente(s) · ${formatNumber(filtered.reduce((total, customer) => total + customer.openRentals, 0))} locação(ões) aberta(s)`}
      actions={
        <Button
          size="sm"
          onClick={() => openDialog(null)}
        >
          <Plus data-icon="inline-start" />
          Novo cliente
        </Button>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nome, contato ou cidade"
            className="pl-9"
            aria-label="Buscar cliente"
          />
        </div>

        <div className="overflow-hidden rounded-lg border border-border bg-card">
          {isLoading ? (
            <div className="flex flex-col gap-2 p-4">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-11 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <Empty className="py-14">
              <EmptyHeader>
                <EmptyTitle>Nenhum cliente cadastrado</EmptyTitle>
                <EmptyDescription>Cadastre a construtora ou o responsável pela obra para abrir locações.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <>
              <div className="flex flex-col divide-y divide-border lg:hidden">
                {filtered.map((customer) => (
                  <div key={customer.id} className="flex flex-col gap-2 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-[13px] text-foreground">{customer.name}</p>
                        <p className="truncate font-mono text-[10px] text-muted-foreground">
                          {customer.document ?? 'documento não informado'} · {customer.rentalCount} contrato(s)
                        </p>
                      </div>
                      <CustomerMenu
                        customer={customer}
                        onEdit={() => openDialog(customer)}
                        onDelete={() => deleteMutation.mutate(customer.id)}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <span className="label-caps text-[9px] text-muted-foreground">Contato</span>
                        <span className="truncate text-[12px]">{customer.contactName ?? '—'}</span>
                        <span className="metric truncate text-[10px] text-muted-foreground">{customer.phone ?? '—'}</span>
                      </div>
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <span className="label-caps text-[9px] text-muted-foreground">Cidade</span>
                        <span className="truncate text-[12px]">{customer.city ?? '—'}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-2">
                      <span className="truncate font-mono text-[10px] text-muted-foreground">
                        {customer.siteAddress ?? 'endereço da obra não informado'}
                      </span>
                      <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                        {formatNumber(customer.openRentals)} em aberto
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="hidden overflow-x-auto lg:block">
              <Table className="min-w-[860px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="w-[180px]">Contato</TableHead>
                    <TableHead className="w-[160px]">Cidade</TableHead>
                    <TableHead className="w-[170px]">Endereço da obra</TableHead>
                    <TableHead className="w-[130px] text-right">Locações abertas</TableHead>
                    <TableHead className="w-[52px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-[13px] text-foreground">{customer.name}</span>
                          <span className="font-mono text-[10px] text-muted-foreground">
                            {customer.document ?? 'documento não informado'} · {customer.rentalCount} contrato(s)
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-[13px]">{customer.contactName ?? '—'}</span>
                          <span className="metric text-[10px] text-muted-foreground">{customer.phone ?? '—'}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-[13px] text-muted-foreground">{customer.city ?? '—'}</TableCell>
                      <TableCell className="text-[13px] text-muted-foreground">{customer.siteAddress ?? '—'}</TableCell>
                      <TableCell className="text-right">
                        <span className="metric text-sm">{formatNumber(customer.openRentals)}</span>
                      </TableCell>
                      <TableCell>
                        <CustomerMenu
                          customer={customer}
                          onEdit={() => openDialog(customer)}
                          onDelete={() => deleteMutation.mutate(customer.id)}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            </>
          )}
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="font-heading">{editing ? 'Editar cliente' : 'Novo cliente'}</DialogTitle>
          </DialogHeader>
          <form
            className="flex flex-col gap-5"
            onSubmit={(event) => {
              event.preventDefault()
              saveMutation.mutate()
            }}
          >
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="customer-name">Razão social / nome</FieldLabel>
                <Input id="customer-name" value={form.name} onChange={update('name')} required />
              </Field>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="customer-document">CNPJ / documento</FieldLabel>
                  <Input id="customer-document" value={form.document} onChange={update('document')} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="customer-contact">Responsável na obra</FieldLabel>
                  <Input id="customer-contact" value={form.contactName} onChange={update('contactName')} />
                </Field>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="customer-phone">Telefone</FieldLabel>
                  <Input id="customer-phone" value={form.phone} onChange={update('phone')} placeholder="(11) 90000-0000" />
                </Field>
                <Field>
                  <FieldLabel htmlFor="customer-email">E-mail</FieldLabel>
                  <Input id="customer-email" type="email" value={form.email} onChange={update('email')} />
                </Field>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="customer-address">Endereço da obra</FieldLabel>
                  <Input id="customer-address" value={form.siteAddress} onChange={update('siteAddress')} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="customer-city">Cidade</FieldLabel>
                  <Input id="customer-city" value={form.city} onChange={update('city')} />
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor="customer-notes">Observações de acesso</FieldLabel>
                <Textarea
                  id="customer-notes"
                  rows={3}
                  value={form.notes}
                  onChange={update('notes')}
                  placeholder="Portaria exige agendamento e nota de entrega assinada."
                />
              </Field>
            </FieldGroup>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'Salvando…' : editing ? 'Salvar alterações' : 'Cadastrar cliente'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  )
}
