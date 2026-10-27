import 'dotenv/config'

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback
  if (!value) throw new Error(`Variável de ambiente ausente: ${name}`)
  return value
}

export const env = {
  databaseUrl: required('DATABASE_URL', 'postgresql://canteiro:canteiro@localhost:5439/canteiro?schema=public'),
  jwtSecret: required('JWT_SECRET', 'dev-secret-nao-use-em-producao'),
  port: Number(process.env.PORT ?? 3333),
  webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:5173',
}
