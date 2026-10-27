import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { AuthShell } from '@/components/auth/AuthShell'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useAuth } from '@/features/auth/AuthContext'
import { ApiError } from '@/lib/api'

export function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const inviteMode = params.get('convite') === '1'
  const [form, setForm] = useState({
    orgName: '',
    name: '',
    email: params.get('email') ?? '',
    password: '',
  })
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  function update(field: keyof typeof form) {
    return (event: React.ChangeEvent<HTMLInputElement>) =>
      setForm((current) => ({ ...current, [field]: event.target.value }))
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setPending(true)
    setError(null)
    try {
      await register({
        orgName: inviteMode ? undefined : form.orgName,
        name: form.name,
        email: form.email,
        password: form.password,
      })
      navigate('/', { replace: true })
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Não foi possível criar a locadora')
    } finally {
      setPending(false)
    }
  }

  return (
    <AuthShell>
      <div className="flex flex-col gap-1">
        <h2 className="font-heading text-2xl tracking-tight">
          {inviteMode ? 'Entrar na equipe' : 'Cadastrar locadora'}
        </h2>
        <p className="text-sm text-muted-foreground">
          {inviteMode
            ? 'Você foi convidado para uma locadora existente. Crie sua conta com o e-mail do convite para entrar.'
            : 'A conta criada vira administradora da organização e já nasce com catálogo vazio para você preencher.'}
        </p>
      </div>

      <form className="mt-8 flex flex-col gap-5" onSubmit={handleSubmit}>
        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Cadastro não concluído</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <FieldGroup>
          {inviteMode ? null : (
            <Field>
              <FieldLabel htmlFor="orgName">Nome da locadora</FieldLabel>
              <Input id="orgName" value={form.orgName} onChange={update('orgName')} placeholder="Andaimes Silva" required />
            </Field>
          )}
          <Field>
            <FieldLabel htmlFor="name">Seu nome</FieldLabel>
            <Input id="name" value={form.name} onChange={update('name')} placeholder="Maria Souza" required />
          </Field>
          <Field>
            <FieldLabel htmlFor="email">E-mail</FieldLabel>
            <Input id="email" type="email" value={form.email} onChange={update('email')} required />
            {inviteMode ? <FieldDescription>Use o mesmo e-mail que recebeu o convite.</FieldDescription> : null}
          </Field>
          <Field>
            <FieldLabel htmlFor="password">Senha</FieldLabel>
            <Input id="password" type="password" value={form.password} onChange={update('password')} required />
            <FieldDescription>Mínimo de 8 caracteres.</FieldDescription>
          </Field>
        </FieldGroup>

        <Button type="submit" disabled={pending} className="w-full">
          {pending ? 'Criando…' : inviteMode ? 'Aceitar convite' : 'Criar locadora'}
          <ArrowRight data-icon="inline-end" />
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          Já tem conta?{' '}
          <Link to="/login" className="font-medium text-foreground underline decoration-primary decoration-2 underline-offset-4">
            Entrar
          </Link>
        </p>
      </form>
    </AuthShell>
  )
}
