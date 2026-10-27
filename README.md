# Canteiro

Gestão de locação de andaimes e ferramentas para construção civil: catálogo, montador de kits a partir da fachada, timeline de disponibilidade e controle financeiro em um só painel.

O produto foi desenhado para a rotina de uma locadora — estoque no galpão, equipamento em obra, prazo de devolução e cobrança — sem planilha paralela. Todos os dados do seed são sintéticos.

## Índice

- [Funcionalidades](#funcionalidades)
- [Começando](#começando)
- [Scripts](#scripts)
- [Arquitetura](#arquitetura)
- [API](#api)
- [Regras de negócio](#regras-de-negócio)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Testes](#testes)
- [Gitflow e contribuição](#gitflow-e-contribuição)
- [Limitações conhecidas](#limitações-conhecidas)
- [Licença](#licença)

## Funcionalidades

- Autenticação com organizações (multi-tenant), convite de equipe e papéis **proprietário / administrador / operador**.
- Catálogo de peças por categoria, com preços por dia/semana/mês, estoque, manutenção, peso e valor de reposição.
- Montador de kits: altura e metragem de fachada viram vãos, níveis e lista de peças, com ajuste manual, peso total e custo diário.
- Clientes e obras.
- Locações com itens, período, status, caução, ocorrências e timeline por equipamento.
- Checklists de entrega e devolução peça a peça, com avarias e faltantes que geram cobrança.
- Financeiro com cobranças, recebimentos, inadimplência e projeção.
- Relatórios operacionais e financeiros.
- Contrato em PDF gerado no servidor e página de impressão (`/locacoes/:id/contrato`).
- Tema claro/escuro, layout responsivo e navegação por teclado.

## Começando

Pré-requisitos: Docker, PostgreSQL local não exposto na porta `5439`, Node.js 20+ e npm.

```bash
# 1. dependências
npm install

# 2. variáveis de ambiente da API
cp .env.example api/.env        # Windows: Copy-Item .env.example api/.env

# 3. banco
npm run db:up
npm run db:generate
npm run db:migrate
npm run db:seed

# 4. API + web em paralelo
npm run dev
```

Serviços após `npm run dev`:

| Serviço | URL |
| --- | --- |
| Web | http://localhost:5173 |
| API | http://localhost:3333/api/health |
| PostgreSQL | `localhost:5439` |

Variáveis de ambiente em `api/.env` (valores em `.env.example`):

| Variável | Para que serve | Valor de desenvolvimento |
| --- | --- | --- |
| `DATABASE_URL` | Conexão do Prisma com o PostgreSQL | `postgresql://canteiro:canteiro@localhost:5439/canteiro?schema=public` |
| `JWT_SECRET` | Assinatura dos tokens de sessão | Segredo local **não usar em produção** |
| `PORT` | Porta da API | `3333` |
| `WEB_ORIGIN` | Origem liberada no CORS | `http://localhost:5173` |

### Acesso de demonstração

| Perfil | E-mail | Senha |
| --- | --- | --- |
| Proprietário | `demo@canteiro.app` | `canteiro123` |
| Operador | `operador@canteiro.app` | `canteiro123` |

O seed recria a locadora fictícia **Locadora Horizonte** com catálogo, kits, clientes, locações, cobranças e conferências de exemplo.

## Scripts

Todos os comandos partem da raiz do monorepo.

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Sobe API e web juntos |
| `npm run dev:api` / `npm run dev:web` | Sobe só um dos lados |
| `npm run db:up` / `npm run db:down` | Liga/desliga o PostgreSQL |
| `npm run db:generate` | Gera o client do Prisma |
| `npm run db:migrate` | Aplica migrações pendentes |
| `npm run db:seed` | Recria os dados de demonstração |
| `npm run db:reset` | Reseta o banco e reaplica migrações |
| `npm run lint` | Roda o oxlint no web |
| `npm test` | Roda a suíte Vitest |
| `npm run build` | Compila API e gera o bundle web |

## Arquitetura

```mermaid
flowchart LR
  subgraph browser["Navegador (React 19 + Vite)"]
    ui["SPA React<br/>TanStack Query"]
  end

  subgraph api["API Node.js"]
    express["Express 4<br/>rotas /api"]
    lib["regras<br/>preço, disponibilidade, PDF"]
    zod["validação Zod"]
  end

  subgraph data["Dados"]
    prisma["Prisma 6"]
    pg["PostgreSQL 16<br/>Docker Compose"]
  end

  ui --> express
  express --> zod
  express --> lib
  express --> prisma
  prisma --> pg

  express -->|"PDF de contrato"| ui
```

O front end consome a API em `/api`; o proxy do Vite encaminha para `localhost:3333` em desenvolvimento. Toda consulta é filtrada pela organização da sessão (multi-tenant).

## API

Todas as rotas ficam sob `/api` e exigem token Bearer, exceto as de autenticação pública.

| Método | Rota | Descrição |
| --- | --- | --- |
| `POST` | `/api/auth/register` | Cria um usuário e a primeira organização |
| `POST` | `/api/auth/login` | Inicia sessão |
| `POST` | `/api/auth/switch-org` | Troca a organização ativa |
| `GET` | `/api/auth/me` | Recarrega a sessão |
| `GET` | `/api/categories` | Categorias da organização |
| `GET` | `/api/equipment` | Catálogo com estoque e disponibilidade do dia |
| `POST` | `/api/equipment` | Cria peça (admin/dono) |
| `PATCH` | `/api/equipment/:id` | Edita peça (admin/dono) |
| `DELETE` | `/api/equipment/:id` | Arquiva peça (admin/dono) |
| `GET` | `/api/availability` | Disponibilidade por período |
| `GET` | `/api/customers` | Clientes e obras |
| `POST` | `/api/customers` | Cria cliente |
| `PATCH` | `/api/customers/:id` | Edita cliente |
| `DELETE` | `/api/customers/:id` | Remove cliente (admin/dono) |
| `GET` | `/api/kits` | Kits salvos |
| `POST` | `/api/kits` | Salva um kit |
| `DELETE` | `/api/kits/:id` | Remove kit |
| `GET` | `/api/rentals` | Locações da organização |
| `GET` | `/api/rentals/:id` | Detalhe da locação |
| `POST` | `/api/rentals` | Cria locação/proposta |
| `PATCH` | `/api/rentals/:id` | Ajusta período, itens ou caução |
| `POST` | `/api/rentals/:id/status` | Muda status (ativação, devolução pendente, encerramento) |
| `POST` | `/api/rentals/:id/inspections` | Registra checklists de entrega e devolução |
| `GET` | `/api/rentals/:id/contract` | Dados do contrato (JSON) |
| `GET` | `/api/rentals/:id/contract/pdf` | Contrato em PDF |
| `GET` | `/api/timeline` | Timeline de ocupação por período |
| `GET` | `/api/dashboard` | Indicadores do pátio |
| `GET` | `/api/finance/summary` | Resumo financeiro |
| `GET` | `/api/finance/charges` | Cobranças |
| `POST` | `/api/finance/charges` | Cria cobrança |
| `PATCH` | `/api/finance/charges/:id` | Edita/baixa cobrança |
| `DELETE` | `/api/finance/charges/:id` | Remove cobrança |
| `GET` | `/api/reports` | Relatórios operacionais e financeiros |
| `GET` | `/api/team` | Organização, membros e convites |
| `POST` | `/api/team/invites` | Convida pessoa (admin/dono) |
| `PATCH` | `/api/team/members/:id` | Muda papel (admin/dono) |
| `DELETE` | `/api/team/members/:id` | Remove membro (admin/dono) |
| `PATCH` | `/api/team/organization` | Edita dados da locadora (admin/dono) |
| `GET` | `/api/equipment/:id/movements` | Movimentações de estoque |
| `GET` | `/api/equipment/:id/history` | Histórico consolidado da peça |
| `POST` | `/api/equipment/:id/stock` | Ajusta estoque (admin/dono) |

## Regras de negócio

- **Precificação:** escolhe automaticamente o arranjo mais barato entre mês, semana e diária; se não houver preço semanal/mensal, deriva da diária.
- **Disponibilidade:** propostas (`QUOTED`), locações ativas e devoluções pendentes ocupam estoque no período. Manutenção é descontada da capacidade.
- **Devolução:** conferência item a item pode registrar avaria/falta; a locação é encerrada e a cobrança de reposição é criada.
- **Multi-tenant:** todas as consultas são filtradas pela organização da sessão; convites e papéis controlam o acesso.

## Estrutura do projeto

```
.
├── api/
│   ├── prisma/            schema, migrações e seed
│   └── src/
│       ├── auth/          JWT, middleware e tipos de sessão
│       ├── lib/           disponibilidade, precificação, PDF, helpers HTTP
│       └── routes/        auth, catálogo, clientes, kits, locações, timeline, financeiro, equipe, relatórios
├── web/
│   ├── public/            favicon e ícones
│   └── src/
│       ├── components/    auth, catálogo, financeiro, kit, layout, locações, timeline, tema, ui
│       ├── features/      sessão e troca de organização
│       ├── lib/           cliente HTTP, download, tipos, cálculo de kit, formatação
│       └── pages/         telas do painel
├── .github/workflows/     CI (build, lint e testes)
├── docker-compose.yml     PostgreSQL de desenvolvimento
├── CONTRIBUTING.md        fluxo de branches, commits e releases
└── vitest.config.ts       configuração da suíte de testes
```

## Testes

```bash
npm test
```

A suíte cobre o cálculo de preços (diária/semana/mês e arredondamento), o montador de kits (vãos, níveis, quantidades, escolha de painel, peso, custo e avisos de catálogo incompleto) e a geração do PDF de contrato, incluindo quebra de página com muitos itens.

A verificação completa antes de abrir PR é:

```bash
npm run lint
npm test
npm run build
```

## Gitflow e contribuição

O repositório segue GitFlow com Conventional Commits. O guia completo está em [`CONTRIBUTING.md`](CONTRIBUTING.md); o resumo operacional é:

| Branch | Papel | Origem | Destino |
| --- | --- | --- | --- |
| `main` | Produção | `release/*` ou `hotfix/*` | — |
| `develop` | Integração | `feature/*`, `release/*`, `hotfix/*` | `release/*` |
| `feature/*` | Funcionalidade | `develop` | `develop` |
| `release/*` | Preparação de versão | `develop` | `main` e `develop` |
| `hotfix/*` | Correção urgente | `main` | `main` e `develop` |

Exemplo de ciclo:

```bash
git switch develop
git switch -c feature/checklist-entrega
npm test
git commit -m "feat(rentals): ..."
git push -u origin feature/checklist-entrega
```

Versões são tagadas em `main` como `vX.Y.Z`. Toda mudança entra por pull request, com `npm run lint`, `npm test` e `npm run build` verdes.

## Limitações conhecidas

- Não há integração fiscal, assinatura digital, pagamento ou emissão de NF-e.
- Autenticação por JWT em `localStorage`; para produção, use HTTPS e segredos fortes em `JWT_SECRET`.
- Upload de fotos fica em `api/uploads`, armazenamento local.
- Os dados de demonstração não representam clientes, preços ou métricas reais.
- `npm audit` ainda aponta dependências com correção apenas em major (Zod 3 → 4); atualização exige migração de API.

## Licença

Projeto privado, sem licença pública definida.
