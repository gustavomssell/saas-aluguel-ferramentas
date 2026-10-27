# Contribuindo

Este repositório segue **GitFlow** e **Conventional Commits**. Nada entra direto em `main` ou `develop` fora de release ou hotfix.

## 1. Preparar o ambiente

```bash
npm install
cp .env.example api/.env        # Windows: Copy-Item .env.example api/.env
npm run db:up
npm run db:generate
npm run db:migrate
npm run db:seed
```

Nunca versione `api/.env`. Ele está no `.gitignore`; use o `.env.example` como modelo.

## 2. Verificação antes de qualquer commit

```bash
npm run lint
npm test
npm run build
```

Os três comandos precisam passar antes de abrir pull request.

## 3. Modelo de branches

| Branch | Papel | Nasce de | Volta para |
| --- | --- | --- | --- |
| `main` | Produção, sempre liberável | `release/*` ou `hotfix/*` | — |
| `develop` | Integração contínua | `feature/*`, `release/*`, `hotfix/*` | `release/*` |
| `feature/*` | Nova funcionalidade ou melhoria | `develop` | `develop` |
| `release/*` | Estabilização e changelog de versão | `develop` | `main` e `develop` |
| `hotfix/*` | Correção urgente em produção | `main` | `main` e `develop` |

Nomeação de branches:

| Tipo | Padrão | Exemplo |
| --- | --- | --- |
| Feature | `feature/<slug-curto>` | `feature/montador-kits-pdf` |
| Bugfix | `feature/fix-<slug>` ou `fix/<slug>` | `fix/timeline-data-futura` |
| Release | `release/vX.Y.Z` | `release/v1.2.0` |
| Hotfix | `hotfix/vX.Y.Z` | `hotfix/v1.2.1` |

## 4. Fluxo de trabalho

Feature:

```bash
git switch develop
git pull
git switch -c feature/montador-kits-pdf
# ... commits convencionais ...
npm test
git push -u origin feature/montador-kits-pdf
```

Release:

```bash
git switch develop
git switch -c release/v1.2.0
# ajustes de versão, changelog e estabilização
git tag -a v1.2.0 -m "v1.2.0"
```

Hotfix:

```bash
git switch main
git switch -c hotfix/v1.2.1
# correção mínima
```

Regras:

- Todo pull request precisa de descrição, testes atualizados e checks verdes.
- Use `--no-ff` ao mesclar branches de feature, release e hotfix para preservar o histórico do fluxo.
- `main` recebe apenas merges de `release/*` e `hotfix/*`, mais tags de versão.
- `develop` recebe merges de `feature/*`, `release/*` e `hotfix/*`.

## 5. Conventional Commits

```text
<tipo>(<escopo>): <resumo no imperativo>

[corpo opcional]

[rodapé opcional]
```

Tipos aceitos: `feat`, `fix`, `docs`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.

Exemplos:

```text
feat(rentals): gerar PDF do contrato no servidor
fix(timeline): usar a data do servidor para marcar o dia atual
docs(readme): documentar GitFlow e arquitetura
ci: rodar lint, testes e build em pull requests
```

## 6. Versionamento

O projeto usa SemVer. A versão é tagada em `main` no formato `vX.Y.Z`:

| Incremento | Quando |
| --- | --- |
| Major | Quebra de contrato de API ou de dados |
| Minor | Nova funcionalidade compatível |
| Patch | Correção compatível |

Para publicar uma release:

```bash
git switch main
git pull --tags
git tag -a v1.2.0 -m "v1.2.0"
git push origin v1.2.0
```

## 7. Revisão

- Alterações de schema passam por `npm run db:migrate` com migração versionada em `api/prisma/migrations`.
- Mudanças de preço, disponibilidade ou cálculo de kit exigem teste em `pricing`, `kitCalculator` ou `contractPdf`.
- Rotas novas exigem validação Zod e filtro por organização da sessão.
- Não comitar segredos, `dist/`, `node_modules/`, bancos locais ou artefatos de upload.
