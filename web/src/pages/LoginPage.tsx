import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { AuthShell } from '@/components/auth/AuthShell'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useAuth } from '@/features/auth/AuthContext'
import { ApiError } from '@/lib/api'

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('demo@canteiro.app')
  const [password, setPassword] = useState('canteiro123')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setPending(true)
    setError(null)
    try {
      await login(email, password)
      navigate('/', { replace: true })
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Não foi possível entrar agora')
    } finally {
      setPending(false)
    }
  }

  return (
    <AuthShell>
      <div className="flex flex-col gap-1">
        <h2 className="font-heading text-2xl tracking-tight">Entrar no pátio</h2>
        <p className="text-sm text-muted-foreground">Use a conta da locadora para liberar o painel operacional.</p>
      </div>

      <form className="mt-8 flex flex-col gap-5" onSubmit={handleSubmit}>
        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Não foi possível entrar</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="email">E-mail</FieldLabel>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="password">Senha</FieldLabel>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            <FieldDescription>Demonstração: demo@canteiro.app · senha canteiro123</FieldDescription>
          </Field>
        </FieldGroup>

        <Button type="submit" disabled={pending} className="w-full">
          {pending ? 'Verificando…' : 'Entrar'}
          <ArrowRight data-icon="inline-end" />
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          Ainda não tem conta?{' '}
          <Link to="/registrar" className="font-medium text-foreground underline decoration-primary decoration-2 underline-offset-4">
            Cadastrar locadora
          </Link>
        </p>
      </form>
    </AuthShell>
  )
}
