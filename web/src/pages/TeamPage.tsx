import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, MailPlus, ShieldCheck, Trash2, UserRound } from 'lucide-react'
import { toast } from 'sonner'
import { AppShell } from '@/components/layout/AppShell'
import { useAuth } from '@/features/auth/AuthContext'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { api, ApiError } from '@/lib/api'
import type { Role, TeamInvite, TeamMember, TeamResponse } from '@/lib/types'
import { formatDay } from '@/lib/format'

const roleOptions: Array<{ value: Role; label: string }> = [
  { value: 'OWNER', label: 'Proprietário' },
  { value: 'ADMIN', label: 'Administrador' },
  { value: 'OPERATOR', label: 'Operador' },
]

function inviteLink(email: string) {
  return `${window.location.origin}/registrar?convite=1&email=${encodeURIComponent(email)}`
}

type OrganizationInfo = TeamResponse['organization']

function OrganizationEditor({
  organization,
  canManage,
  onSaved,
}: {
  organization: OrganizationInfo
  canManage: boolean
  onSaved: () => void
}) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState(() => ({
    name: organization.name,
    document: organization.document ?? '',
    phone: organization.phone ?? '',
    email: organization.email ?? '',
    city: organization.city ?? '',
  }))

  const mutation = useMutation({
    mutationFn: () =>
      api.patch('/team/organization', {
        name: form.name.trim(),
        document: form.document.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        city: form.city.trim() || null,
      }),
    onSuccess: () => {
      toast.success('Dados da locadora atualizados')
      void queryClient.invalidateQueries({ queryKey: ['team'] })
      onSaved()
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Falha ao salvar dados'),
  })

  return (
    <form
      className="flex flex-col gap-4 p-5"
      onSubmit={(event) => {
        event.preventDefault()
        if (!form.name.trim()) {
          toast.error('Informe o nome da locadora')
          return
        }
        mutation.mutate()
      }}
    >
      <FieldGroup>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="org-name">Nome</FieldLabel>
            <Input
              id="org-name"
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              disabled={!canManage}
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="org-document">CNPJ</FieldLabel>
            <Input
              id="org-document"
              value={form.document}
              onChange={(event) => setForm((current) => ({ ...current, document: event.target.value }))}
              placeholder="12.345.678/0001-90"
              disabled={!canManage}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="org-phone">Telefone</FieldLabel>
            <Input
              id="org-phone"
              value={form.phone}
              onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
              placeholder="(11) 4002-8922"
              disabled={!canManage}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="org-email">E-mail</FieldLabel>
            <Input
              id="org-email"
              type="email"
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              placeholder="operacao@locadora.com.br"
              disabled={!canManage}
            />
          </Field>
          <Field className="sm:col-span-2">
            <FieldLabel htmlFor="org-city">Cidade</FieldLabel>
            <Input
              id="org-city"
              value={form.city}
              onChange={(event) => setForm((current) => ({ ...current, city: event.target.value }))}
              placeholder="São Paulo, SP"
              disabled={!canManage}
            />
          </Field>
        </div>
      </FieldGroup>

      {canManage ? (
        <div className="flex items-center justify-between gap-3">
          <p className="font-mono text-[10px] text-muted-foreground">
            somente proprietários e administradores editam estes dados
          </p>
          <Button type="submit" size="sm" disabled={mutation.isPending}>
            {mutation.isPending ? 'Salvando…' : 'Salvar dados'}
          </Button>
        </div>
      ) : null}
    </form>
  )
}

export function TeamPage() {
  const queryClient = useQueryClient()
  const { session, switchOrganization } = useAuth()
  const canManage = session?.organization.role === 'OWNER' || session?.organization.role === 'ADMIN'
  const isOwner = session?.organization.role === 'OWNER'

  const [inviteOpen, setInviteOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role>('OPERATOR')
  const [removeTarget, setRemoveTarget] = useState<TeamMember | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['team'],
    queryFn: () => api.get<TeamResponse>('/team'),
  })

  const inviteMutation = useMutation({
    mutationFn: () => api.post<{ type: 'member' | 'invite' }>('/team/invites', { email, role }),
    onSuccess: (result) => {
      toast.success(
        result.type === 'member' ? 'Pessoa adicionada à equipe' : 'Convite criado — envie o link de cadastro',
      )
      setInviteOpen(false)
      setEmail('')
      setRole('OPERATOR')
      void queryClient.invalidateQueries({ queryKey: ['team'] })
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Falha ao convidar'),
  })

  const roleMutation = useMutation({
    mutationFn: ({ membershipId, role: nextRole }: { membershipId: string; role: Role }) =>
      api.patch(`/team/members/${membershipId}`, { role: nextRole }),
    onSuccess: () => {
      toast.success('Papel atualizado')
      void queryClient.invalidateQueries({ queryKey: ['team'] })
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Falha ao atualizar papel'),
  })

  const removeMutation = useMutation({
    mutationFn: (membershipId: string) => api.delete(`/team/members/${membershipId}`),
    onSuccess: () => {
      toast.success('Membro removido da locadora')
      setRemoveTarget(null)
      void queryClient.invalidateQueries({ queryKey: ['team'] })
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Falha ao remover membro'),
  })

  const cancelInviteMutation = useMutation({
    mutationFn: (inviteId: string) => api.delete(`/team/invites/${inviteId}`),
    onSuccess: () => {
      toast.success('Convite cancelado')
      void queryClient.invalidateQueries({ queryKey: ['team'] })
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Falha ao cancelar convite'),
  })

  async function copyInvite(invite: TeamInvite) {
    try {
      await navigator.clipboard.writeText(inviteLink(invite.email))
      toast.success('Link de convite copiado')
    } catch {
      toast.error('Não foi possível copiar o link')
    }
  }

  return (
    <AppShell
      title="Equipe e locadora"
      subtitle="Acessos, papéis e dados cadastrais da operação"
      actions={
        canManage ? (
          <Button size="sm" onClick={() => setInviteOpen(true)}>
            <MailPlus data-icon="inline-start" />
            Convidar
          </Button>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-6">
        <section className="rounded-lg border border-border bg-card">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
            <div>
              <h2 className="font-heading text-base tracking-tight">Dados da locadora</h2>
              <p className="font-mono text-[10px] text-muted-foreground">
                aparecem no contrato impresso e nas comunicações
              </p>
            </div>
            <Badge variant="secondary" className="font-mono text-[10px]">
              {data?.organization.slug ?? '—'}
            </Badge>
          </header>

          {isLoading || !data ? (
            <div className="p-5">
              <Skeleton className="h-24 w-full" />
            </div>
          ) : (
            <OrganizationEditor
              key={data.organization.id}
              organization={data.organization}
              canManage={canManage}
              onSaved={() => {
                if (session) void switchOrganization(session.organization.id)
              }}
            />
          )}
        </section>

        <section className="overflow-hidden rounded-lg border border-border bg-card">
          <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-3">
            <div>
              <h2 className="font-heading text-base tracking-tight">Equipe</h2>
              <p className="font-mono text-[10px] text-muted-foreground">
                {data ? `${data.members.length} pessoa(s) com acesso` : 'carregando…'}
              </p>
            </div>
            <span className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
              <ShieldCheck className="size-3.5" /> proprietário define papéis
            </span>
          </header>

          {isLoading || !data ? (
            <div className="flex flex-col gap-2 p-4">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-11 w-full" />
              ))}
            </div>
          ) : (
            <>
              <div className="flex flex-col divide-y divide-border lg:hidden">
                {data.members.map((member) => {
                  const editable =
                    canManage &&
                    member.role !== 'OWNER' &&
                    !(session?.organization.role === 'ADMIN' && member.role === 'ADMIN')
                  return (
                    <div key={member.membershipId} className="flex flex-col gap-3 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-sm bg-secondary font-mono text-[10px]">
                            {member.name
                              .split(' ')
                              .slice(0, 2)
                              .map((part) => part[0])
                              .join('')}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-[13px] text-foreground">
                              {member.name}
                              {member.isCurrentUser ? (
                                <span className="ml-2 font-mono text-[10px] text-muted-foreground">você</span>
                              ) : null}
                            </p>
                            <p className="truncate font-mono text-[10px] text-muted-foreground">{member.email}</p>
                          </div>
                        </div>
                        {editable ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Remover ${member.name}`}
                            onClick={() => setRemoveTarget(member)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        ) : null}
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        {editable ? (
                          <Select
                            value={member.role}
                            onValueChange={(value) =>
                              roleMutation.mutate({ membershipId: member.membershipId, role: value as Role })
                            }
                            disabled={roleMutation.isPending}
                          >
                            <SelectTrigger className="h-8 w-[170px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                {roleOptions
                                  .filter((option) => option.value !== 'OWNER' || isOwner)
                                  .map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                      {option.label}
                                    </SelectItem>
                                  ))}
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className="flex items-center gap-2 text-[13px]">
                            <UserRound className="size-3.5 text-muted-foreground" />
                            {member.roleLabel}
                          </span>
                        )}
                        <span className="metric text-[10px] text-muted-foreground">
                          desde {formatDay(member.joinedAt)}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="hidden overflow-x-auto lg:block">
              <Table className="min-w-[720px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Membro</TableHead>
                    <TableHead className="w-[200px]">Papel</TableHead>
                    <TableHead className="w-[130px]">Desde</TableHead>
                    <TableHead className="w-[70px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.members.map((member) => {
                    const editable =
                      canManage &&
                      member.role !== 'OWNER' &&
                      !(session?.organization.role === 'ADMIN' && member.role === 'ADMIN')
                    return (
                      <TableRow key={member.membershipId}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <span className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-secondary font-mono text-[10px]">
                              {member.name
                                .split(' ')
                                .slice(0, 2)
                                .map((part) => part[0])
                                .join('')}
                            </span>
                            <div className="flex flex-col">
                              <span className="text-[13px] text-foreground">
                                {member.name}
                                {member.isCurrentUser ? (
                                  <span className="ml-2 font-mono text-[10px] text-muted-foreground">você</span>
                                ) : null}
                              </span>
                              <span className="font-mono text-[10px] text-muted-foreground">{member.email}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {editable ? (
                            <Select
                              value={member.role}
                              onValueChange={(value) =>
                                roleMutation.mutate({ membershipId: member.membershipId, role: value as Role })
                              }
                              disabled={roleMutation.isPending}
                            >
                              <SelectTrigger className="h-8 w-[180px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectGroup>
                                  {roleOptions
                                    .filter((option) => option.value !== 'OWNER' || isOwner)
                                    .map((option) => (
                                      <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                      </SelectItem>
                                    ))}
                                </SelectGroup>
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className="flex items-center gap-2 text-[13px]">
                              <UserRound className="size-3.5 text-muted-foreground" />
                              {member.roleLabel}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="metric text-xs text-muted-foreground">
                          {formatDay(member.joinedAt)}
                        </TableCell>
                        <TableCell>
                          {editable ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Remover ${member.name}`}
                              onClick={() => setRemoveTarget(member)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
            </>
          )}
        </section>

        {data && data.invites.length > 0 ? (
          <section className="overflow-hidden rounded-lg border border-border bg-card">
            <header className="border-b border-border px-5 py-3">
              <h2 className="font-heading text-base tracking-tight">Convites pendentes</h2>
              <p className="font-mono text-[10px] text-muted-foreground">
                o convite é aceito automaticamente quando a pessoa se cadastra com o mesmo e-mail
              </p>
            </header>
            <ul className="divide-y divide-border">
              {data.invites.map((invite) => (
                <li key={invite.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px]">{invite.email}</p>
                    <p className="font-mono text-[10px] text-muted-foreground">
                      {invite.roleLabel} · expira {formatDay(invite.expiresAt)}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => void copyInvite(invite)}>
                    <Copy data-icon="inline-start" />
                    Copiar link
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Cancelar convite de ${invite.email}`}
                    disabled={!canManage || cancelInviteMutation.isPending}
                    onClick={() => cancelInviteMutation.mutate(invite.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">Convidar para a equipe</DialogTitle>
            <DialogDescription>
              Se a pessoa já tem conta, entra na hora. Se não, criamos um convite e você envia o link de cadastro.
            </DialogDescription>
          </DialogHeader>
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault()
              if (!email.trim()) {
                toast.error('Informe o e-mail')
                return
              }
              inviteMutation.mutate()
            }}
          >
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="invite-email">E-mail</FieldLabel>
                <Input
                  id="invite-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="pessoa@locadora.com.br"
                  required
                />
              </Field>
              <Field>
                <FieldLabel>Papel</FieldLabel>
                <Select value={role} onValueChange={(value) => setRole(value as Role)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {roleOptions
                        .filter((option) => option.value !== 'OWNER' || isOwner)
                        .map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <FieldDescription>
                  Operador usa o dia a dia; administrador também edita catálogo, financeiro e equipe.
                </FieldDescription>
              </Field>
            </FieldGroup>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setInviteOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={inviteMutation.isPending}>
                {inviteMutation.isPending ? 'Convidando…' : 'Convidar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={removeTarget !== null} onOpenChange={(open) => !open && setRemoveTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-heading">Remover acesso</DialogTitle>
            <DialogDescription>
              {removeTarget?.name} perde o acesso a esta locadora. Locações e históricos permanecem.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRemoveTarget(null)}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={removeMutation.isPending}
              onClick={() => removeTarget && removeMutation.mutate(removeTarget.membershipId)}
            >
              {removeMutation.isPending ? 'Removendo…' : 'Remover acesso'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  )
}
