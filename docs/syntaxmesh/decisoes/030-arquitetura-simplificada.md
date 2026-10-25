# Arquitetura simplificada

## Contexto

O SyntaxMesh atualmente tem uma arquitetura complexa com múltiplos pacotes (`core`, `parser`, `report`, `storage`, `ui`, `language`, `richtext`, `markdown`, `worker-db`, `utils`, `service-worker`). O usuário quer simplificar esta arquitetura para reduzir a complexidade e melhorar a manutenibilidade.

## Decisão

Desenvolver **todo o projeto em `packages/core`**, incorporando aí os demais pacotes de domínio, que deixam de existir como pacotes separados:

- `packages/parser` → incorporado em `packages/core`
- `packages/report` → incorporado em `packages/core`
- `packages/richtext` → incorporado em `packages/core`
- `packages/markdown` → incorporado em `packages/core`
- `packages/language` → incorporado em `packages/core`
- `packages/storage` → incorporado em `packages/core`

Mantém-se apenas três pacotes de suporte, que **não recebem a lógica do core**:

- `packages/server` — para testes e execução do motor
- `packages/ui` — para interface do usuário
- `packages/service-worker` — para PWA e service worker

**Pacotes de apoio reais do bundle** (decisão confirmada em 2026-10-24): apenas `server`, `service-worker` e `ui` existem como pacotes; todo código de domínio — inclusive parser/lexer — vive em `packages/core` (subpastas `src/parser/`, `src/lexer/`, `src/i18n/`, `src/richtext/` etc.).

**Remover** os pacotes `packages/utils` e `packages/worker-db` e substituí-los por bibliotecas JSR padronizadas:

- `jsr:@vanaware/buildit` — para build pipeline, esbuild, export
- `jsr:@vanaware/workerdb` — para IndexedDB/OPFS storage

## Consequências

### Positivas
- Arquitetura mais simples e fácil de entender
- Menos pacotes para manter e configurar
- Dependência em bibliotecas JSR padronizadas em vez de implementações personalizadas
- Fronteira mais clara entre lógica de domínio e concerns de infraestrutura

### Negativas / Riscos
- Perda de controle sobre implementações personalizadas
- Dependência em bibliotecas externas (embora JSR é padronizado)
- Possível necessidade de adaptação se as JSR libraries não tiverem todas as funcionalidades necessárias

### Neutras / Observações
- Esta decisão alinha-se com o princípio de "Keep It Simple, Stupid" (KISS)
- Reduz a superfície de ataque de bugs devido a menos código personalizado
- Facilita a entrada de novos contribuidores devido à menor complexidade
- A transição deve ser feita gradualmente para minimizar interrupções

---

**Status:** Aceito
**Data:** 2026-10-12 (aceita em 2026-10-24)
**Autor(es):** Vanaware