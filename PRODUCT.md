# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Frontend React + TypeScript + Vite + Tailwind CSS + shadcn/ui. Backend Node.js + TypeScript + Express + Prisma. PostgreSQL via Docker Compose. Monorepo npm workspaces. (Confirmado pelo usuário.)

## Users

Operadores e donos de locadoras de andaimes e ferramentas para construção civil. Trabalham entre o galpão, o balcão de atendimento e o telefone com clientes em obra. A rotina é apertada, interrompida por caminhões e por conferência de peças, e hoje depende de planilhas, cadernos e sistemas legados difíceis de operar.

## Product Purpose

Centralizar a operação de uma locadora: saber o que está no galpão e o que está em cada obra, montar e orçar kits de andaime a partir da geometria da fachada, acompanhar prazos de locação em uma timeline e renovar ou encerrar contratos sem recalcular tudo à mão. Sucesso é o operador confiar no painel no meio do dia, sem precisar abrir a planilha.

## Positioning

O produto conecta três coisas que os sistemas genéricos de locação tratam separadas: a engenharia do kit (altura e metragem viram peças), a disponibilidade real por período no estoque e a cobrança coerente com o prazo. O montador de kits e a timeline compartilham o mesmo inventário, então a proposta já nasce com disponibilidade verificável.

## Operating Context

- Catálogo com peças de andaime (painéis, diagonais, sapatas, rodas, travessas) e ferramentas (betoneiras, rompedores, geradores, compactadores).
- Preços por dia, semana e mês; prazos costumam ser combinados por período e renovados por telefone.
- Obras de longa duração exigem medição parcial; devoluções chegam por caminhão e precisam de conferência peça a peça.
- O transporte considera peso e volume do kit.
- Operação em português do Brasil, com documentação de obra, NR-18 e linguagem de canteiro.

## Capabilities and Constraints

Confirmado para o primeiro ciclo:

- Autenticação com organizações (multi-tenant) e papéis de administrador/operador.
- Cadastro de organizações no onboarding; troca de organização entre as quais o usuário é membro.
- Catálogo de equipamentos e categorias por organização, com estoque total, preços por período e valor de reposição.
- Clientes (obras) por organização.
- Montador de kits: altura, metragem de fachada, cálculo de peças sugeridas, ajuste manual, peso total e salvamento do kit.
- Locações com itens, período, status e cliente; visualização em timeline por equipamento com filtro de categoria e cores por status.
- Dashboard com indicadores de estoque, equipamentos em obra, devoluções próximas e receita prevista.
- Check-in de devolução, contratos/PDF e faturamento ficam para o próximo ciclo. A timeline já deve exibir status de devolução pendente.

Premissas explícitas: nome de trabalho "Canteiro"; dados de demonstração são sintéticos e identificados como tal no seed; sem integração fiscal, assinatura digital ou pagamento neste ciclo.

## Brand Commitments

Nome de trabalho: Canteiro. Voz direta, técnica e sem jargão de marketing; português do Brasil. Aparência limpa e minimalista, mas enraizada no universo de obra: papel técnico, marcações de medição, sinalização de segurança e organização de galpão. Sem estética de startup genérica, sem gamificação.

## Evidence on Hand

Não há clientes, depoimentos, métricas reais ou ativos de marca. O seed cria uma locadora fictícia ("Locadora Horizonte"), equipe, catálogo, kits, clientes e locações de exemplo. Nenhum número de marketing deve ser inventado.

## Product Principles

1. O inventário é a fonte da verdade: toda tela de locação deve deixar claro o que está disponível, em obra, pendente ou em manutenção.
2. Proposta e disponibilidade caminham juntas; o kit só é vendável se as peças existirem no período.
3. Densidade sem ruído: informação operacional à vista, hierarquia por tipografia e réguas, não por caixas decorativas.
4. O operador trabalha em pé, com pressa e no celular na conferência; alvos de toque e leitura rápida importam.
5. Cada número deve ser rastreável a uma peça, um período ou um cliente.

## Accessibility & Inclusion

Interface web responsiva com foco em uso no galpão e no celular. Contraste mínimo AA, alvos de toque confortáveis, navegação por teclado nos formulários e estados de foco visíveis. Status não dependem apenas de cor, sempre acompanhados de rótulo.
